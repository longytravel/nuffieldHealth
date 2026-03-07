import { randomUUID } from "crypto";
import { gunzipSync } from "zlib";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/index";
import { consultants, consultantMatches } from "@/db/schema";
import { logger } from "@/lib/logger";
import type { BupaCandidate, ConsultantMatch } from "@/lib/bupa-types";

const SITEMAP_INDEX_GZ = "https://www.finder.bupa.co.uk/sitemap_index.xml.gz";
const SITEMAP_FALLBACK = "https://www.finder.bupa.co.uk/sitemap.xml";
const CONSULTANT_URL_PATTERN = /\/Consultant\/view\/(\d+)\/([^/\s<]+)/;
const MATCH_DELETE_CHUNK_SIZE = 400;

interface MatchConsultantOptions {
  persist?: boolean;
}

interface PersistMatchOptions {
  clearSlugs?: string[];
}

interface MatchableNuffieldConsultant {
  slug: string;
  consultant_name: string | null;
  registration_number: string | null;
  specialty_primary: string[];
  normalized_name: string | null;
  core_signature: string | null;
  loose_signature: string | null;
}

interface MatchableBupaCandidate extends BupaCandidate {
  normalized_name: string;
  core_signature: string | null;
  loose_signature: string | null;
}

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

  const candidates = extractConsultantCandidates(allXml);
  const seen = new Set<string>();
  const unique = candidates.filter((candidate) => {
    if (seen.has(candidate.bupa_id)) return false;
    seen.add(candidate.bupa_id);
    return true;
  });

  logger.info("BUPA_DISC", "sitemap", "success", `${unique.length} consultant URLs found`);
  return unique;
}

/**
 * Match BUPA candidates against the current Nuffield run.
 * Pre-crawl matching is name-based only, so the runner later validates with GMC
 * once the target BUPA page has been parsed.
 */
export async function matchConsultants(
  candidates: BupaCandidate[],
  nuffieldRunId: string,
  options: MatchConsultantOptions = {}
): Promise<ConsultantMatch[]> {
  const { persist = true } = options;

  const rawNuffieldConsultants = await db
    .select({
      slug: consultants.slug,
      consultant_name: consultants.consultant_name,
      registration_number: consultants.registration_number,
      specialty_primary: consultants.specialty_primary,
    })
    .from(consultants)
    .where(eq(consultants.run_id, nuffieldRunId));

  const nuffieldConsultants: MatchableNuffieldConsultant[] = rawNuffieldConsultants.map((consultant) => {
    const normalized_name = consultant.consultant_name
      ? normalizeNameForMatching(consultant.consultant_name)
      : null;

    return {
      ...consultant,
      normalized_name,
      core_signature: normalized_name ? buildCoreNameSignature(normalized_name) : null,
      loose_signature: normalized_name ? buildLooseNameSignature(normalized_name) : null,
    };
  });

  const preparedCandidates: MatchableBupaCandidate[] = candidates.map((candidate) => {
    const normalized_name = normalizeNameForMatching(candidate.name_from_url);

    return {
      ...candidate,
      normalized_name,
      core_signature: buildCoreNameSignature(normalized_name),
      loose_signature: buildLooseNameSignature(normalized_name),
    };
  });

  logger.info("BUPA_DISC", "match", "loaded", `${nuffieldConsultants.length} Nuffield consultants`);

  const byNormalizedName = new Map<string, MatchableBupaCandidate[]>();
  const byCoreSignature = new Map<string, MatchableBupaCandidate[]>();
  const byLooseSignature = new Map<string, MatchableBupaCandidate[]>();

  for (const candidate of preparedCandidates) {
    if (!byNormalizedName.has(candidate.normalized_name)) {
      byNormalizedName.set(candidate.normalized_name, []);
    }
    byNormalizedName.get(candidate.normalized_name)!.push(candidate);

    if (candidate.core_signature) {
      if (!byCoreSignature.has(candidate.core_signature)) {
        byCoreSignature.set(candidate.core_signature, []);
      }
      byCoreSignature.get(candidate.core_signature)!.push(candidate);
    }

    if (candidate.loose_signature) {
      if (!byLooseSignature.has(candidate.loose_signature)) {
        byLooseSignature.set(candidate.loose_signature, []);
      }
      byLooseSignature.get(candidate.loose_signature)!.push(candidate);
    }
  }

  const matches: ConsultantMatch[] = [];
  const matchedBupaIds = new Set<string>();

  for (const consultant of nuffieldConsultants) {
    if (!consultant.normalized_name) continue;
    const normalizedConsultantName = consultant.normalized_name;

    const exactCandidates = getAvailableCandidates(
      byNormalizedName.get(normalizedConsultantName),
      matchedBupaIds
    );
    if (exactCandidates.length === 1) {
      matches.push({
        nuffield_slug: consultant.slug,
        bupa_id: exactCandidates[0].bupa_id,
        match_method: "name_search",
        match_confidence: "medium",
        registration_number: consultant.registration_number,
      });
      matchedBupaIds.add(exactCandidates[0].bupa_id);
      continue;
    }

    const relaxedCandidates = getAvailableCandidates(
      consultant.core_signature ? byCoreSignature.get(consultant.core_signature) : undefined,
      matchedBupaIds
    ).filter((candidate) =>
      isLikelySameConsultantName(candidate.normalized_name, normalizedConsultantName)
    );
    if (relaxedCandidates.length === 1) {
      matches.push({
        nuffield_slug: consultant.slug,
        bupa_id: relaxedCandidates[0].bupa_id,
        match_method: "name_search",
        match_confidence: "low",
        registration_number: consultant.registration_number,
      });
      matchedBupaIds.add(relaxedCandidates[0].bupa_id);
      continue;
    }

    const fuzzyCandidates = getAvailableCandidates(
      consultant.loose_signature ? byLooseSignature.get(consultant.loose_signature) : undefined,
      matchedBupaIds
    )
      .map((candidate) => ({
        candidate,
        distance: levenshteinDistance(candidate.normalized_name, normalizedConsultantName),
      }))
      .filter((entry) => entry.distance > 0 && entry.distance <= 2)
      .sort((left, right) => left.distance - right.distance);

    if (fuzzyCandidates.length === 0) continue;

    const bestDistance = fuzzyCandidates[0].distance;
    const bestCandidates = fuzzyCandidates.filter((entry) => entry.distance === bestDistance);
    if (bestCandidates.length !== 1) continue;

    matches.push({
      nuffield_slug: consultant.slug,
      bupa_id: bestCandidates[0].candidate.bupa_id,
      match_method: "name_search",
      match_confidence: "low",
      registration_number: consultant.registration_number,
    });
    matchedBupaIds.add(bestCandidates[0].candidate.bupa_id);
  }

  logger.info("BUPA_DISC", "match", "complete", `${matches.length} matches found`);

  if (persist) {
    await persistConsultantMatches(matches, {
      clearSlugs: nuffieldConsultants.map((consultant) => consultant.slug),
    });
  }

  return matches;
}

export async function persistConsultantMatches(
  matches: ConsultantMatch[],
  options: PersistMatchOptions = {}
): Promise<void> {
  const clearSlugs = dedupeStrings(
    options.clearSlugs ?? matches.map((match) => match.nuffield_slug)
  );

  await deleteExistingMatchesForSlugs(clearSlugs);

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
  normalized = normalized.replace(/[_-]+/g, " ");

  for (const prefix of titlePrefixes) {
    const regex = new RegExp(`^${prefix}\\.?\\s+`, "i");
    normalized = normalized.replace(regex, "");
  }

  normalized = normalized.replace(/[-''\u2019]/g, "");
  normalized = normalized.replace(/[^a-z\s]/g, "");
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

export function normalizeRegistrationNumber(value: string | null | undefined): string | null {
  if (!value) return null;

  const digitsOnly = value.replace(/\D/g, "");
  if (!digitsOnly) return null;

  return digitsOnly.replace(/^0+/, "") || "0";
}

export function isLikelySameConsultantName(left: string, right: string): boolean {
  const normalizedLeft = normalizeNameForMatching(left);
  const normalizedRight = normalizeNameForMatching(right);

  if (normalizedLeft === normalizedRight) return true;

  const leftTokens = tokenizeNormalizedName(normalizedLeft);
  const rightTokens = tokenizeNormalizedName(normalizedRight);

  if (leftTokens.length < 2 || rightTokens.length < 2) return false;
  if (Math.abs(leftTokens.length - rightTokens.length) > 2) return false;
  if (leftTokens[0] !== rightTokens[0]) return false;
  if (leftTokens[leftTokens.length - 1] !== rightTokens[rightTokens.length - 1]) return false;

  const [shorter, longer] =
    leftTokens.length <= rightTokens.length
      ? [leftTokens, rightTokens]
      : [rightTokens, leftTokens];

  return isTokenSubsequence(shorter, longer);
}

// Internal helpers

async function fetchSitemapXml(url: string, isGzip: boolean): Promise<string> {
  const response = await fetch(url, {
    // @ts-expect-error Node fetch supports rejectUnauthorized via agent
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
    if (!match) continue;

    const bupaId = match[1];
    const nameSlug = match[2];
    const nameFromUrl = nameSlug.replace(/[-_]/g, " ");

    candidates.push({
      bupa_id: bupaId,
      bupa_slug: nameSlug,
      profile_url: url,
      name_from_url: nameFromUrl,
    });
  }

  return candidates;
}

function tokenizeNormalizedName(normalizedName: string): string[] {
  return normalizedName.split(" ").filter(Boolean);
}

function buildCoreNameSignature(normalizedName: string): string | null {
  const tokens = tokenizeNormalizedName(normalizedName);
  if (tokens.length < 2) return null;

  return `${tokens[0]}:${tokens[tokens.length - 1]}`;
}

function buildLooseNameSignature(normalizedName: string): string | null {
  const tokens = tokenizeNormalizedName(normalizedName);
  if (tokens.length < 2) return null;

  return `${tokens[0][0]}:${tokens[tokens.length - 1]}`;
}

function isTokenSubsequence(shorter: string[], longer: string[]): boolean {
  let shorterIndex = 0;

  for (const token of longer) {
    if (token === shorter[shorterIndex]) {
      shorterIndex++;
      if (shorterIndex === shorter.length) return true;
    }
  }

  return false;
}

function getAvailableCandidates(
  candidates: MatchableBupaCandidate[] | undefined,
  matchedBupaIds: Set<string>
): MatchableBupaCandidate[] {
  return (candidates ?? []).filter((candidate) => !matchedBupaIds.has(candidate.bupa_id));
}

async function deleteExistingMatchesForSlugs(slugs: string[]): Promise<void> {
  if (slugs.length === 0) return;

  for (let index = 0; index < slugs.length; index += MATCH_DELETE_CHUNK_SIZE) {
    const chunk = slugs.slice(index, index + MATCH_DELETE_CHUNK_SIZE);
    await db.delete(consultantMatches)
      .where(inArray(consultantMatches.nuffield_slug, chunk))
      .run();
  }
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (a === b) return 0;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}
