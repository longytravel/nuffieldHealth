import { existsSync, readFileSync } from "fs";
import { basename, join, resolve } from "path";
import { BUPA_HTML_CACHE_PATH } from "@/lib/config";
import { parseBupaProfile } from "@/scraper/bupa/parse-bupa";

type AuditArgs = {
  reportPath: string;
  cacheDir: string | null;
};

type PilotReportRow = {
  nuffield_slug: string;
  bupa_id: string;
  bupa_profile_url: string;
};

type PilotReport = {
  html_cache_dir?: string;
  pilot_run_id?: string;
  results: PilotReportRow[];
};

function parseArgs(): AuditArgs {
  const args = process.argv.slice(2);
  const reportPath = args[0];
  let cacheDir: string | null = null;

  for (let index = 1; index < args.length; index++) {
    if (args[index] === "--cache-dir" && index + 1 < args.length) {
      cacheDir = args[index + 1];
      index++;
    }
  }

  if (!reportPath) {
    console.error("Usage: pnpm bupa:audit-pilot -- <report-path> [--cache-dir <dir>]");
    process.exit(1);
  }

  return { reportPath, cacheDir };
}

function resolveCacheDir(report: PilotReport, cacheDirArg: string | null): string {
  if (cacheDirArg) {
    return resolve(cacheDirArg);
  }

  if (report.html_cache_dir) {
    return resolve(report.html_cache_dir);
  }

  if (report.pilot_run_id) {
    return resolve(join(process.cwd(), BUPA_HTML_CACHE_PATH, report.pilot_run_id));
  }

  throw new Error(
    "Could not determine cache directory from the report. Pass --cache-dir explicitly."
  );
}

async function main(): Promise<void> {
  const { reportPath, cacheDir } = parseArgs();
  const resolvedReportPath = resolve(reportPath);
  const report = JSON.parse(readFileSync(resolvedReportPath, "utf8")) as PilotReport;
  const resolvedCacheDir = resolveCacheDir(report, cacheDir);

  if (!existsSync(resolvedCacheDir)) {
    throw new Error(`Cache directory does not exist: ${resolvedCacheDir}`);
  }

  const rows = report.results.map((result) => {
    const htmlPath = join(resolvedCacheDir, `${result.bupa_id}.html`);
    const html = readFileSync(htmlPath, "utf8");
    const parsed = parseBupaProfile(
      html,
      result.bupa_id,
      basename(result.bupa_profile_url),
      result.bupa_profile_url
    );

    return {
      slug: result.nuffield_slug,
      about_present: Boolean(parsed.about_text?.trim()),
      has_photo: parsed.has_photo,
      treatments_count: parsed.treatments.length,
      memberships_count: parsed.memberships.length,
      phone_count: parsed.contact_phone_numbers.length,
      email_count: parsed.contact_email_addresses.length,
      website_count: parsed.website_urls.length,
      badge_count: parsed.accreditation_badges.length,
      unmapped: parsed.unmapped_section_keys,
      section_keys: Object.keys(parsed.source_sections),
    };
  });

  const unmappedFrequency = new Map<string, number>();
  for (const row of rows) {
    for (const key of row.unmapped) {
      unmappedFrequency.set(key, (unmappedFrequency.get(key) ?? 0) + 1);
    }
  }

  const summary = {
    report_path: resolvedReportPath,
    cache_dir: resolvedCacheDir,
    pilot_size: rows.length,
    with_about: rows.filter((row) => row.about_present).length,
    with_photo: rows.filter((row) => row.has_photo).length,
    with_treatments: rows.filter((row) => row.treatments_count > 0).length,
    with_memberships: rows.filter((row) => row.memberships_count > 0).length,
    with_phone: rows.filter((row) => row.phone_count > 0).length,
    with_email: rows.filter((row) => row.email_count > 0).length,
    with_website: rows.filter((row) => row.website_count > 0).length,
    with_badges: rows.filter((row) => row.badge_count > 0).length,
    unmapped_section_frequency: [...unmappedFrequency.entries()].sort((left, right) => right[1] - left[1]),
    anomalies: rows
      .filter(
        (row) =>
          row.unmapped.length > 0 ||
          !row.about_present ||
          row.treatments_count === 0 ||
          row.phone_count === 0
      )
      .map((row) => ({
        slug: row.slug,
        about_present: row.about_present,
        treatments_count: row.treatments_count,
        phone_count: row.phone_count,
        email_count: row.email_count,
        unmapped: row.unmapped,
        section_keys: row.section_keys,
      })),
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
