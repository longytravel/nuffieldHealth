import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { getLatestRun } from "@/db/queries";
import { consultants } from "@/db/schema";
import {
  fetchBupaSitemapUrls,
  matchConsultants,
  normalizeRegistrationNumber,
} from "@/scraper/bupa/discover-bupa";
import {
  applyBupaScrapeDelay,
  fetchBupaProfile,
  launchBupaBrowser,
} from "@/scraper/bupa/crawl-bupa";
import { BUPA_HTML_CACHE_PATH } from "@/lib/config";
import { parseBupaProfile } from "@/scraper/bupa/parse-bupa";

type PilotArgs = {
  limit: number;
  slug: string | null;
  output: string | null;
};

type PilotResult = {
  nuffield_slug: string;
  nuffield_name: string | null;
  nuffield_registration_number: string | null;
  bupa_id: string;
  bupa_profile_url: string;
  match_confidence: string;
  parsed_name: string | null;
  parsed_registration_number: string | null;
  registration_status: "match" | "mismatch" | "missing_on_bupa" | "missing_on_nuffield" | "missing_both";
  parsed_specialty_primary: string[];
  parsed_about_present: boolean;
  parsed_treatments: string[];
  parsed_treatments_count: number;
  parsed_memberships: string[];
  parsed_memberships_count: number;
  parsed_clinical_interests: string[];
  parsed_languages: string[];
  parsed_hospital_affiliations: string[];
  has_photo: boolean;
  contact_phone_numbers: string[];
  contact_email_addresses: string[];
  website_urls: string[];
  accreditation_badges: string[];
  source_sections: Record<string, { heading: string; values: string[] }>;
  unmapped_section_keys: string[];
};

const MATCH_CONFIDENCE_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function parseArgs(): PilotArgs {
  const args = process.argv.slice(2);
  let limit = 10;
  let slug: string | null = null;
  let output: string | null = null;

  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--limit" && index + 1 < args.length) {
      limit = Number.parseInt(args[index + 1], 10);
      index++;
    } else if (args[index] === "--slug" && index + 1 < args.length) {
      slug = args[index + 1];
      index++;
    } else if (args[index] === "--output" && index + 1 < args.length) {
      output = args[index + 1];
      index++;
    }
  }

  return { limit, slug, output };
}

function buildRegistrationStatus(
  nuffieldRegistrationNumber: string | null,
  bupaRegistrationNumber: string | null
): PilotResult["registration_status"] {
  if (nuffieldRegistrationNumber && bupaRegistrationNumber) {
    return nuffieldRegistrationNumber === bupaRegistrationNumber ? "match" : "mismatch";
  }
  if (nuffieldRegistrationNumber) return "missing_on_bupa";
  if (bupaRegistrationNumber) return "missing_on_nuffield";
  return "missing_both";
}

async function main(): Promise<void> {
  const { limit, slug, output } = parseArgs();
  const run = await getLatestRun();
  if (!run) {
    throw new Error("No latest Nuffield run found");
  }

  const candidates = await fetchBupaSitemapUrls();
  let matches = await matchConsultants(candidates, run.run_id, { persist: false });
  matches = [...matches].sort((left, right) => {
    const confidenceDelta =
      (MATCH_CONFIDENCE_ORDER[left.match_confidence] ?? 99) -
      (MATCH_CONFIDENCE_ORDER[right.match_confidence] ?? 99);
    if (confidenceDelta !== 0) return confidenceDelta;
    return left.nuffield_slug.localeCompare(right.nuffield_slug);
  });

  if (slug) {
    matches = matches.filter((match) => match.nuffield_slug === slug);
  }

  const selectedMatches = matches.slice(0, Math.max(1, limit));
  if (selectedMatches.length === 0) {
    throw new Error(slug ? `No BUPA match found for ${slug}` : "No BUPA matches found");
  }

  const selectedSlugs = selectedMatches.map((match) => match.nuffield_slug);
  const nuffieldRows = await db
    .select({
      slug: consultants.slug,
      consultant_name: consultants.consultant_name,
      registration_number: consultants.registration_number,
      hospital_name_primary: consultants.hospital_name_primary,
      specialty_primary: consultants.specialty_primary,
    })
    .from(consultants)
    .where(
      and(
        eq(consultants.run_id, run.run_id),
        inArray(consultants.slug, selectedSlugs)
      )
    );

  const nuffieldBySlug = new Map(nuffieldRows.map((row) => [row.slug, row]));
  const candidateById = new Map(candidates.map((candidate) => [candidate.bupa_id, candidate]));
  const pilotRunId = `pilot-${new Date().toISOString().replace(/[:.]/g, "-")}`;

  const browser = await launchBupaBrowser();
  const results: PilotResult[] = [];

  try {
    for (let index = 0; index < selectedMatches.length; index++) {
      const match = selectedMatches[index];
      const candidate = candidateById.get(match.bupa_id);
      const nuffield = nuffieldBySlug.get(match.nuffield_slug);

      if (!candidate || !nuffield) continue;

      const progress = { current: index + 1, total: selectedMatches.length };
      const crawlResult = await fetchBupaProfile(
        browser,
        candidate.profile_url,
        candidate.bupa_id,
        pilotRunId,
        progress
      );
      const parsed = parseBupaProfile(
        crawlResult.html,
        candidate.bupa_id,
        candidate.bupa_slug,
        candidate.profile_url
      );

      const normalizedNuffieldRegistration = normalizeRegistrationNumber(nuffield.registration_number);
      const normalizedBupaRegistration = normalizeRegistrationNumber(parsed.registration_number);

      results.push({
        nuffield_slug: nuffield.slug,
        nuffield_name: nuffield.consultant_name,
        nuffield_registration_number: normalizedNuffieldRegistration,
        bupa_id: candidate.bupa_id,
        bupa_profile_url: candidate.profile_url,
        match_confidence: match.match_confidence,
        parsed_name: parsed.consultant_name,
        parsed_registration_number: normalizedBupaRegistration,
        registration_status: buildRegistrationStatus(
          normalizedNuffieldRegistration,
          normalizedBupaRegistration
        ),
        parsed_specialty_primary: parsed.specialty_primary,
        parsed_about_present: Boolean(parsed.about_text),
        parsed_treatments: parsed.treatments,
        parsed_treatments_count: parsed.treatments.length,
        parsed_memberships: parsed.memberships,
        parsed_memberships_count: parsed.memberships.length,
        parsed_clinical_interests: parsed.clinical_interests,
        parsed_languages: parsed.languages,
        parsed_hospital_affiliations: parsed.hospital_affiliations,
        has_photo: parsed.has_photo,
        contact_phone_numbers: parsed.contact_phone_numbers,
        contact_email_addresses: parsed.contact_email_addresses,
        website_urls: parsed.website_urls,
        accreditation_badges: parsed.accreditation_badges,
        source_sections: parsed.source_sections,
        unmapped_section_keys: parsed.unmapped_section_keys,
      });

      if (index < selectedMatches.length - 1) {
        await applyBupaScrapeDelay();
      }
    }
  } finally {
    await browser.close();
  }

  const outputDir = output ? join(process.cwd(), output) : join(process.cwd(), "data", "bupa-pilot");
  mkdirSync(outputDir, { recursive: true });
  const reportPath = join(outputDir, `${pilotRunId}.json`);

  const report = {
    generated_at: new Date().toISOString(),
    nuffield_run_id: run.run_id,
    pilot_run_id: pilotRunId,
    html_cache_dir: join(process.cwd(), BUPA_HTML_CACHE_PATH, pilotRunId),
    matched_count: matches.length,
    pilot_size: results.length,
    slug_filter: slug,
    results,
  };

  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const registrationMatches = results.filter((result) => result.registration_status === "match").length;
  const registrationMismatches = results.filter((result) => result.registration_status === "mismatch").length;

  console.log(JSON.stringify({
    report_path: reportPath,
    nuffield_run_id: run.run_id,
    matched_count: matches.length,
    pilot_size: results.length,
    registration_matches: registrationMatches,
    registration_mismatches: registrationMismatches,
    slugs: results.map((result) => result.nuffield_slug),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
