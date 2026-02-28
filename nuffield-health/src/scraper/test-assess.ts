/**
 * One-off script to test AI assessment on a single cached profile.
 * Usage: npx tsx src/scraper/test-assess.ts [slug]
 * Defaults to dr-sam-firoozi if no slug provided.
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { parseProfile } from "./parse";
import { assessProfile } from "./assess";

const slug = process.argv[2] ?? "dr-sam-firoozi";

// Find the latest run that has this slug cached
const cacheDir = join(__dirname, "../../data/html-cache");
const runDirs = readdirSync(cacheDir);
let html: string | null = null;
let usedRunId = "";

for (const runId of runDirs.reverse()) {
  const filePath = join(cacheDir, runId, `${slug}.html`);
  try {
    html = readFileSync(filePath, "utf-8");
    usedRunId = runId;
    break;
  } catch {
    continue;
  }
}

if (!html) {
  console.error(`No cached HTML found for slug: ${slug}`);
  process.exit(1);
}

console.log(`\n=== Testing AI Assessment ===`);
console.log(`Slug: ${slug}`);
console.log(`Run ID: ${usedRunId}`);
console.log(`HTML size: ${(html.length / 1024).toFixed(1)} KB\n`);

// Parse the HTML first
const parsed = parseProfile(html, slug);

console.log(`--- Parsed Profile Summary ---`);
console.log(`Name: ${parsed.consultant_name}`);
console.log(`Specialty: ${parsed.specialty_primary.join(", ")}`);
console.log(`Treatments: ${parsed.treatments.length} items`);
console.log(`Has photo: ${parsed.has_photo}`);
console.log(`About text: ${parsed.about_text ? parsed.about_text.substring(0, 150) + "..." : "MISSING"}`);
console.log(`Declaration: ${parsed.declaration ? parsed.declaration.length + " paragraphs" : "MISSING"}`);
console.log();

// Build the profile text exactly as the pipeline does (runAssessStage)
const textParts: string[] = [];
if (parsed.consultant_name) textParts.push(`Name: ${parsed.consultant_name}`);
if (parsed.specialty_primary.length > 0) textParts.push(`Specialties: ${parsed.specialty_primary.join(", ")}`);
if (parsed.about_text) textParts.push(`About:\n${parsed.about_text}`);
if (parsed.overview_text) textParts.push(`Overview:\n${parsed.overview_text}`);
if (parsed.related_experience_text) textParts.push(`Related Experience:\n${parsed.related_experience_text}`);
if (parsed.treatments.length > 0) textParts.push(`Treatments: ${parsed.treatments.join(", ")}`);
if (parsed.qualifications_credentials) textParts.push(`Qualifications: ${parsed.qualifications_credentials}`);
if (parsed.declaration) textParts.push(`Declaration: ${parsed.declaration.join(" ")}`);
if (parsed.clinical_interests.length > 0) textParts.push(`Clinical Interests: ${parsed.clinical_interests.join(", ")}`);

const profileText = textParts.join("\n\n");
console.log(`--- Profile Text Sent to Haiku (${profileText.length} chars) ---`);
console.log(profileText);
console.log(`\n--- Calling Claude Haiku... ---\n`);

async function main() {
  const result = await assessProfile(profileText, slug);
  console.log(`--- AI Assessment Result ---`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
