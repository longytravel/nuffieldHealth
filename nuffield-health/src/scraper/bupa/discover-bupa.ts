import { gunzipSync } from "zlib";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/db/index";
import { consultants, consultantMatches } from "@/db/schema";
import { logger } from "@/lib/logger";
import type { BupaCandidate, ConsultantMatch } from "@/lib/bupa-types";

const SITEMAP_INDEX_GZ = "https://www.finder.bupa.co.uk/sitemap_index.xml.gz";
const SITEMAP_FALLBACK = "https://www.finder.bupa.co.uk/sitemap.xml";
const CONSULTANT_URL_PATTERN = /\/Consultant\/view\/(\d+)\/([^/\s<]+)/;

/**
 * Fetch and parse BUPA sitemap(s) to discover consultant profile URLs.
 * Tries gzipped sitemap index first, falls back to plain sitemap.xml.
 */
export async function fetchBupaSitemapUrls(): Promise<BupaCandidate[]> {
  let xml: string;

  try {
    xml = await fetchSitemapXml(SITEMAP_INDEX_GZ, true);
    logger.info("BUPA_DISC", "sitemap", "fetched", "sitemap_index.xml.gz");
  } catch {
    logger.warn("BUPA_DISC", "sitemap", "gz-failed", "falling back to sitemap.xml");
    xml = await fetchSitemapXml(SITEMAP_FALLBACK, false);
    logger.info("BUPA_DISC", "sitemap", "fetched", "sitemap.xml");
  }

  // If this is a sitemap index, extract child sitemap URLs and fetch them
  const childSitemapUrls = extractLocUrls(xml).filter(
    (url) => url.endsWith(".xml") || url.endsWith(".xml.gz")
  );

  let allXml = xml;
  if (childSitemapUrls.length > 0) {
    logger.info("BUPA_DISC", "sitemap", "index", `${childSitemapUrls.length} child sitemaps`);
    for (const childUrl of childSitemapUrls) {
      try {
        const isGz = childUrl.endsWith(".gz");
        const childXml = await fetchSitemapXml(childUrl, isGz);
        allXml += "\n" + childXml;
      } catch {
        logger.warn("BUPA_DISC", "sitemap", "child-failed", childUrl);
      }
    }
  }

  // Extract consultant URLs from all collected XML
  const candidates = extractConsultantCandidates(allXml);

  // Deduplicate by bupa_id
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    if (seen.has(c.bupa_id)) return false;
    seen.add(c.bupa_id);
    return true;
  });

  logger.info("BUPA_DISC", "sitemap", "success", `${unique.length} consultant URLs found`);
  return unique;
}

/**
 * Match BUPA candidates against Nuffield consultant database.
 * Uses three signals: GMC match (high), exact name (medium), fuzzy name (low).
 */
export async function matchConsultants(
  candidates: BupaCandidate[],
  nuffieldRunId: string
): Promise<ConsultantMatch[]> {
  // Load all Nuffield consultants from the specified run
  const nuffieldConsultants = await db
    .select({
      slug: consultants.slug,
      consultant_name: consultants.consultant_name,
      registration_number: consultants.registration_number,
      specialty_primary: consultants.specialty_primary,
    })
    .from(consultants)
    .where(eq(consultants.run_id, nuffieldRunId));

  logger.info("BUPA_DISC", "match", "loaded", `${nuffieldConsultants.length} Nuffield consultants`);

  // Build lookup indices
  const byRegNumber = new Map<string, typeof nuffieldConsultants[number][]>();
  const byNormalizedName = new Map<string, typeof nuffieldConsultants[number][]>();

  for (const nc of nuffieldConsultants) {
    if (nc.registration_number) {
      const key = nc.registration_number.toLowerCase().trim();
      if (!byRegNumber.has(key)) byRegNumber.set(key, []);
      byRegNumber.get(key)!.push(nc);
    }
    if (nc.consultant_name) {
      const key = normalizeNameForMatching(nc.consultant_name);
      if (!byNormalizedName.has(key)) byNormalizedName.set(key, []);
      byNormalizedName.get(key)!.push(nc);
    }
  }

  const matches: ConsultantMatch[] = [];
  const matchedNuffieldSlugs = new Set<string>();
  const matchedBupaIds = new Set<string>();

  for (const candidate of candidates) {
    // Skip if this BUPA profile already matched
    if (matchedBupaIds.has(candidate.bupa_id)) continue;

    // Try name-based matching from URL slug (the only signal available pre-scrape)
    const normalizedBupaName = normalizeNameForMatching(candidate.name_from_url);

    // Exact name match (medium confidence)
    const exactMatches = byNormalizedName.get(normalizedBupaName) ?? [];
    for (const nc of exactMatches) {
      if (matchedNuffieldSlugs.has(nc.slug)) continue;

      matches.push({
        nuffield_slug: nc.slug,
        bupa_id: candidate.bupa_id,
        match_method: "name_search",
        match_confidence: "medium",
        registration_number: nc.registration_number,
      });
      matchedNuffieldSlugs.add(nc.slug);
      matchedBupaIds.add(candidate.bupa_id);
      break;
    }

    if (matchedBupaIds.has(candidate.bupa_id)) continue;

    // Fuzzy name match (low confidence) — requires Levenshtein distance <= 2
    for (const nc of nuffieldConsultants) {
      if (matchedNuffieldSlugs.has(nc.slug)) continue;
      if (!nc.consultant_name) continue;

      const normalizedNuffield = normalizeNameForMatching(nc.consultant_name);
      const distance = levenshteinDistance(normalizedBupaName, normalizedNuffield);

      if (distance > 0 && distance <= 2) {
        matches.push({
          nuffield_slug: nc.slug,
          bupa_id: candidate.bupa_id,
          match_method: "name_search",
          match_confidence: "low",
          registration_number: nc.registration_number,
        });
        matchedNuffieldSlugs.add(nc.slug);
        matchedBupaIds.add(candidate.bupa_id);
        break;
      }
    }
  }

  logger.info("BUPA_DISC", "match", "complete", `${matches.length} matches found`);

  // Persist matches to database
  for (const match of matches) {
    await db.insert(consultantMatches).values({
      match_id: randomUUID(),
      nuffield_slug: match.nuffield_slug,
      bupa_id: match.bupa_id,
      match_method: match.match_method,
      match_confidence: match.match_confidence,
      registration_number: match.registration_number,
      matched_at: new Date().toISOString(),
    });
  }

  return matches;
}

/**
 * Normalize a consultant name for matching.
 * Strips title prefixes, lowercases, removes punctuation, collapses whitespace.
 */
export function normalizeNameForMatching(name: string): string {
  const titlePrefixes = [
    "professor", "prof", "doctor", "dr", "mr", "mrs", "ms", "miss",
    "sir", "dame", "lord", "lady", "rev", "reverend",
  ];

  let normalized = name.toLowerCase().trim();

  // Remove title prefixes
  for (const prefix of titlePrefixes) {
    const regex = new RegExp(`^${prefix}\\.?\\s+`, "i");
    normalized = normalized.replace(regex, "");
  }

  // Normalize hyphens and apostrophes — remove them for comparison
  normalized = normalized.replace(/[-''\u2019]/g, "");

  // Remove non-alpha characters except spaces
  normalized = normalized.replace(/[^a-z\s]/g, "");

  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

// ── Internal helpers ──────────────────────────────────────────────

async function fetchSitemapXml(url: string, isGzip: boolean): Promise<string> {
  const response = await fetch(url, {
    // @ts-expect-error -- Node fetch supports rejectUnauthorized via agent
    dispatcher: undefined,
    headers: { "User-Agent": "CambrianBot/1.0 (consultant-intelligence)" },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: HTTP ${response.status} from ${url}`);
  }

  if (isGzip) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return gunzipSync(buffer).toString("utf-8");
  }

  return response.text();
}

function extractLocUrls(xml: string): string[] {
  const locRegex = /<loc>\s*(https?:\/\/[^<]+)\s*<\/loc>/gi;
  const urls: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1].trim());
  }

  return urls;
}

function extractConsultantCandidates(xml: string): BupaCandidate[] {
  const locUrls = extractLocUrls(xml);
  const candidates: BupaCandidate[] = [];

  for (const url of locUrls) {
    const match = url.match(CONSULTANT_URL_PATTERN);
    if (match) {
      const bupaId = match[1];
      const nameSlug = match[2];
      // Convert URL slug to readable name: "john-smith" -> "john smith"
      const nameFromUrl = nameSlug.replace(/-/g, " ");

      candidates.push({
        bupa_id: bupaId,
        bupa_slug: nameSlug,
        profile_url: url,
        name_from_url: nameFromUrl,
      });
    }
  }

  return candidates;
}

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Early exit for identical strings or empty inputs
  if (a === b) return 0;
  if (m === 0) return n;
  if (n === 0) return m;

  // Use single-row DP for memory efficiency
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}
