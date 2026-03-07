import { readFileSync } from "fs";
import { join } from "path";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/index";
import { bupaConsultants } from "@/db/schema";
import { parseBupaProfile } from "@/scraper/bupa/parse-bupa";
import { assessProfile } from "@/scraper/assess";
import { heuristicBioDepth } from "@/scraper/parse";
import { scoreConsultant } from "@/scraper/score";
import { BUPA_HTML_CACHE_PATH, BUPA_UNAVAILABLE_POINTS } from "@/lib/config";
import type { BookingState } from "@/lib/types";

const args = process.argv.slice(2);
const runId = args.find((a) => !a.startsWith("--"));
const doAssess = args.includes("--assess");

if (!runId) {
  console.error("Usage: pnpm tsx scripts/reparse-bupa-run.ts <bupa-run-id> [--assess]");
  process.exit(1);
}

function computeAdjustedScore(rawScore: number): number {
  const maxWithoutUnavailable = 100 - BUPA_UNAVAILABLE_POINTS; // 70
  return Math.round((rawScore / maxWithoutUnavailable) * 100 * 10) / 10;
}

async function main() {
  const rows = await db
    .select({
      bupa_id: bupaConsultants.bupa_id,
      bupa_slug: bupaConsultants.bupa_slug,
      profile_url: bupaConsultants.profile_url,
    })
    .from(bupaConsultants)
    .where(eq(bupaConsultants.run_id, runId!));

  let updated = 0;

  for (const row of rows) {
    const htmlPath = join(BUPA_HTML_CACHE_PATH, runId!, `${row.bupa_id}.html`);
    const html = readFileSync(htmlPath, "utf-8");
    const parsed = parseBupaProfile(html, row.bupa_id, row.bupa_slug, row.profile_url);

    let bioDepth = heuristicBioDepth(parsed.about_text);
    let plainEnglishScore = 1;
    let plainEnglishReason = "skip-assess test run";
    let bioDepthReason = "reparsed from cached BUPA HTML";

    if (doAssess) {
      const textParts: string[] = [];
      if (parsed.consultant_name) textParts.push(`Name: ${parsed.consultant_name}`);
      if (parsed.specialty_primary.length > 0) textParts.push(`Specialties: ${parsed.specialty_primary.join(", ")}`);
      if (parsed.about_text) textParts.push(`About:\n${parsed.about_text}`);
      if (parsed.treatments.length > 0) textParts.push(`Treatments: ${parsed.treatments.join(", ")}`);
      if (parsed.qualifications_credentials) textParts.push(`Qualifications: ${parsed.qualifications_credentials}`);
      const profileText = textParts.join("\n\n");

      try {
        const assessment = await assessProfile(profileText, row.bupa_id, { current: updated + 1, total: rows.length });
        plainEnglishScore = assessment.plain_english_score;
        plainEnglishReason = assessment.plain_english_reason;
        bioDepth = assessment.bio_depth === "missing" && parsed.about_text
          ? heuristicBioDepth(parsed.about_text)
          : assessment.bio_depth;
        bioDepthReason = assessment.bio_depth_reason;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[ASSESS] ${row.bupa_id} failed: ${msg} — using fallback`);
        plainEnglishReason = "AI assessment failed";
        bioDepthReason = "AI assessment failed — heuristic fallback";
      }
    }

    const scoreResult = scoreConsultant({
      has_photo: parsed.has_photo,
      bio_depth: bioDepth,
      treatments: parsed.treatments,
      qualifications_credentials: parsed.qualifications_credentials,
      specialty_primary: parsed.specialty_primary,
      specialty_sub: parsed.specialty_sub,
      insurers: [],
      consultation_times_raw: [],
      plain_english_score: plainEnglishScore,
      booking_state: null as BookingState | null,
      online_bookable: false,
      practising_since: null,
      memberships: parsed.memberships,
      available_slots_next_28_days: null,
      gmc_code_for_booking: null,
    });

    await db
      .update(bupaConsultants)
      .set({
        consultant_name: parsed.consultant_name,
        registration_number: parsed.registration_number,
        has_photo: parsed.has_photo,
        about_text: parsed.about_text,
        specialty_primary: parsed.specialty_primary,
        specialty_sub: parsed.specialty_sub,
        treatments: parsed.treatments,
        qualifications_credentials: parsed.qualifications_credentials,
        memberships: parsed.memberships,
        clinical_interests: parsed.clinical_interests,
        languages: parsed.languages,
        hospital_affiliations: parsed.hospital_affiliations,
        fee_assured: parsed.fee_assured,
        contact_phone_numbers: parsed.contact_phone_numbers,
        contact_email_addresses: parsed.contact_email_addresses,
        website_urls: parsed.website_urls,
        accreditation_badges: parsed.accreditation_badges,
        source_sections: parsed.source_sections,
        unmapped_section_keys: parsed.unmapped_section_keys,
        bio_depth: bioDepth,
        bio_depth_reason: bioDepthReason,
        plain_english_score: plainEnglishScore,
        plain_english_reason: plainEnglishReason,
        treatment_specificity_score: "not_applicable",
        treatment_specificity_reason: doAssess ? "reparsed+assessed" : "skip-assess test run",
        qualifications_completeness: parsed.qualifications_credentials ? "adequate" : "missing",
        qualifications_completeness_reason: "reparsed from cached BUPA HTML",
        ai_quality_notes: doAssess ? "reparsed+assessed from cached BUPA HTML" : "reparsed from cached BUPA HTML",
        profile_completeness_score: scoreResult.profile_completeness_score,
        adjusted_score: computeAdjustedScore(scoreResult.profile_completeness_score),
        quality_tier: scoreResult.quality_tier,
        flags: scoreResult.flags,
        scrape_status: "complete",
        scrape_error: null,
      })
      .where(and(eq(bupaConsultants.run_id, runId!), eq(bupaConsultants.bupa_id, row.bupa_id)))
      .run();

    updated++;
    if (updated % 25 === 0 || updated === rows.length) {
      console.log(`Reparsed ${updated}/${rows.length}`);
    }
  }

  console.log(`Reparsed run ${runId}${doAssess ? " (with AI assessment)" : ""}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
