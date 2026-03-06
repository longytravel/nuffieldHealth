import * as cheerio from "cheerio";
import type { BupaParseResult } from "@/lib/bupa-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collapse whitespace, trim, strip stray HTML tags */
function normalizeText(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

/** Extract list items from a section identified by heading text */
function extractListByHeading(
  $: cheerio.CheerioAPI,
  headingTexts: string[]
): string[] {
  for (const text of headingTexts) {
    // Find heading by text content (case-insensitive), any level
    const headings = $("h1, h2, h3, h4, h5, h6").filter((_i, el) => {
      const content = $(el).text().trim().toLowerCase();
      return content === text.toLowerCase();
    });

    if (headings.length === 0) continue;

    const heading = headings.first();
    // Collect sibling content until next heading
    const items: string[] = [];
    let next = heading.next();

    while (next.length > 0 && !next.is("h1, h2, h3, h4, h5, h6")) {
      // Check for list items
      next.find("li").each((_i, li) => {
        const val = normalizeText($(li).text());
        if (val) items.push(val);
      });
      // If no list items found, check for comma-separated or plain text
      if (items.length === 0) {
        const blockText = normalizeText(next.text());
        if (blockText) {
          // Split on commas if present, otherwise treat as single item
          if (blockText.includes(",")) {
            blockText.split(",").forEach((part) => {
              const trimmed = part.trim();
              if (trimmed) items.push(trimmed);
            });
          } else {
            items.push(blockText);
          }
        }
      }
      next = next.next();
    }

    if (items.length > 0) return items;
  }
  return [];
}

/** Extract text block following a heading */
function extractTextByHeading(
  $: cheerio.CheerioAPI,
  headingTexts: string[]
): string | null {
  for (const text of headingTexts) {
    const headings = $("h1, h2, h3, h4, h5, h6").filter((_i, el) => {
      const content = $(el).text().trim().toLowerCase();
      return content === text.toLowerCase();
    });

    if (headings.length === 0) continue;

    const heading = headings.first();
    const parts: string[] = [];
    let next = heading.next();

    while (next.length > 0 && !next.is("h1, h2, h3, h4, h5, h6")) {
      const blockText = normalizeText(next.text());
      if (blockText) parts.push(blockText);
      next = next.next();
    }

    const combined = parts.join(" ").trim();
    return combined.length > 0 ? combined : null;
  }
  return null;
}

// GMC patterns
const GMC_LABEL_REGEX =
  /(?:GMC|General\s+Medical\s+Council)\s*(?:number|no|reg(?:istration)?)?[:\s]*([0-9]{5,8})/i;
const GMC_STANDALONE_REGEX = /\b([0-9]{6,8})\b/;

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse a Playwright-rendered BUPA Finder profile page.
 * Returns best-effort result — never throws.
 */
export function parseBupaProfile(
  html: string,
  bupaId: string,
  bupaSlug: string,
  profileUrl: string
): BupaParseResult {
  const $ = cheerio.load(html);

  // --- Consultant name ---
  const consultantName = extractName($);

  // --- Registration number (GMC) ---
  const registrationNumber = extractRegistrationNumber($);

  // --- Photo ---
  const hasPhoto = detectPhoto($);

  // --- About text ---
  const aboutText = extractAboutText($);

  // --- Specialties ---
  const specialtyPrimary = extractListByHeading($, [
    "Specialties",
    "Speciality",
    "Specialty",
    "Main specialties",
    "Primary specialty",
  ]);
  const specialtySub = extractListByHeading($, [
    "Sub-specialties",
    "Sub specialties",
    "Sub-specialities",
    "Other specialties",
  ]);

  // --- Treatments ---
  const treatments = extractListByHeading($, [
    "Treatments",
    "Procedures",
    "Treatments and procedures",
    "Treatments & procedures",
  ]);

  // --- Qualifications ---
  const qualificationsCredentials = extractTextByHeading($, [
    "Qualifications",
    "Qualifications and credentials",
    "Education and qualifications",
    "Credentials",
  ]);

  // --- Memberships ---
  const memberships = extractListByHeading($, [
    "Memberships",
    "Professional memberships",
    "Memberships and associations",
    "Professional bodies",
  ]);

  // --- Clinical interests ---
  const clinicalInterests = extractListByHeading($, [
    "Clinical interests",
    "Special interests",
    "Areas of interest",
    "Interests",
  ]);

  // --- Languages ---
  const languages = extractListByHeading($, [
    "Languages",
    "Languages spoken",
  ]);

  // --- Hospital affiliations ---
  const hospitalAffiliations = extractHospitals($);

  // --- Fee assured ---
  const feeAssured = detectFeeAssured($);

  // Log warnings for key missing fields
  if (!consultantName) {
    console.warn(`[BUPA_PARSE] ${bupaSlug} — Could not extract consultant name`);
  }
  if (!registrationNumber) {
    console.warn(`[BUPA_PARSE] ${bupaSlug} — Could not extract registration number`);
  }

  return {
    bupa_id: bupaId,
    bupa_slug: bupaSlug,
    consultant_name: consultantName,
    registration_number: registrationNumber,
    profile_url: profileUrl,
    has_photo: hasPhoto,
    about_text: aboutText,
    specialty_primary: specialtyPrimary,
    specialty_sub: specialtySub,
    treatments,
    qualifications_credentials: qualificationsCredentials,
    memberships,
    clinical_interests: clinicalInterests,
    languages,
    hospital_affiliations: hospitalAffiliations,
    fee_assured: feeAssured,
  };
}

// ---------------------------------------------------------------------------
// Field extractors
// ---------------------------------------------------------------------------

function extractName($: cheerio.CheerioAPI): string | null {
  // Strategy 1: Schema.org / microdata
  const schemaName = $('[itemprop="name"]').first().text().trim();
  if (schemaName) return normalizeText(schemaName);

  // Strategy 2: Data attributes
  const dataName = $("[data-consultant-name]").attr("data-consultant-name");
  if (dataName) return normalizeText(dataName);

  // Strategy 3: Common CSS class patterns
  const classSelectors = [
    ".consultant-name",
    ".specialist-name",
    ".consultant-header h1",
    ".consultant-detail h1",
    ".profile-name",
    ".specialist-profile h1",
    ".consultant-profile__name",
  ];
  for (const sel of classSelectors) {
    const text = $(sel).first().text().trim();
    if (text) return normalizeText(text);
  }

  // Strategy 4: H1 — first non-empty h1 that looks like a name
  const h1Text = $("h1").first().text().trim();
  if (h1Text && h1Text.length < 100) return normalizeText(h1Text);

  return null;
}

function extractRegistrationNumber($: cheerio.CheerioAPI): string | null {
  const bodyText = $("body").text();

  // Strategy 1: Labelled GMC number
  const labelMatch = bodyText.match(GMC_LABEL_REGEX);
  if (labelMatch) return labelMatch[1];

  // Strategy 2: Meta tag
  const metaGmc =
    $('meta[name="gmc-number"]').attr("content") ||
    $('meta[property="gmc-number"]').attr("content");
  if (metaGmc) return metaGmc.trim();

  // Strategy 3: data attribute
  const dataGmc =
    $("[data-gmc]").attr("data-gmc") ||
    $("[data-gmc-number]").attr("data-gmc-number") ||
    $("[data-registration-number]").attr("data-registration-number");
  if (dataGmc) return dataGmc.trim();

  // Strategy 4: Look for text near "GMC" label elements
  const gmcElements = $("*").filter((_i, el) => {
    const text = $(el).text().trim();
    return /^GMC/i.test(text) && text.length < 50;
  });
  if (gmcElements.length > 0) {
    const nearText = gmcElements.first().parent().text();
    const match = nearText.match(GMC_STANDALONE_REGEX);
    if (match) return match[1];
  }

  return null;
}

function detectPhoto($: cheerio.CheerioAPI): boolean {
  // Strategy 1: img with consultant-related class/attribute
  const consultantImgs = $(
    'img.consultant-photo, img.consultant-image, img.profile-photo, img[data-consultant-photo], img.specialist-image, img[itemprop="image"]'
  );
  if (consultantImgs.length > 0) {
    const src = consultantImgs.first().attr("src") || "";
    // Check it's not a placeholder/default image
    if (src && !/placeholder|default|no[-_]?photo|silhouette/i.test(src)) {
      return true;
    }
  }

  // Strategy 2: Any img inside a profile header area
  const headerImgs = $(
    ".consultant-header img, .consultant-detail img, .profile-header img, .specialist-profile img, .consultant-profile__photo img"
  );
  if (headerImgs.length > 0) {
    const src = headerImgs.first().attr("src") || "";
    if (src && !/placeholder|default|no[-_]?photo|silhouette/i.test(src)) {
      return true;
    }
  }

  // Strategy 3: Open Graph image (not a generic site logo)
  const ogImage = $('meta[property="og:image"]').attr("content") || "";
  if (
    ogImage &&
    !/logo|brand|favicon|placeholder|default/i.test(ogImage) &&
    /consultant|doctor|profile/i.test(ogImage)
  ) {
    return true;
  }

  return false;
}

function extractAboutText($: cheerio.CheerioAPI): string | null {
  // Strategy 1: Heading-based
  const headingAbout = extractTextByHeading($, [
    "About",
    "About me",
    "Biography",
    "Profile",
    "Overview",
  ]);
  if (headingAbout) return headingAbout;

  // Strategy 2: CSS class
  const classSelectors = [
    ".consultant-about",
    ".consultant-bio",
    ".consultant-biography",
    ".consultant-profile__about",
    ".about-text",
    '[itemprop="description"]',
  ];
  for (const sel of classSelectors) {
    const text = normalizeText($(sel).first().text());
    if (text && text.length > 20) return text;
  }

  return null;
}

function extractHospitals($: cheerio.CheerioAPI): string[] {
  // Strategy 1: Heading-based list
  const headingHospitals = extractListByHeading($, [
    "Hospitals",
    "Hospital affiliations",
    "Practises at",
    "Available at",
    "Locations",
    "Where I practise",
  ]);
  if (headingHospitals.length > 0) return headingHospitals;

  // Strategy 2: CSS-based hospital list
  const classSelectors = [
    ".hospital-list li",
    ".consultant-hospitals li",
    ".location-list li",
    ".available-hospitals li",
    ".hospital-name",
  ];
  for (const sel of classSelectors) {
    const items: string[] = [];
    $(sel).each((_i, el) => {
      const val = normalizeText($(el).text());
      if (val) items.push(val);
    });
    if (items.length > 0) return items;
  }

  return [];
}

function detectFeeAssured($: cheerio.CheerioAPI): boolean {
  const bodyText = $("body").text().toLowerCase();

  // Check for "fee assured" text anywhere on the page
  if (/fee[\s-]?assured/i.test(bodyText)) return true;

  // Check for fee-assured badges/icons
  const feeAssuredEl = $(
    '.fee-assured, .fee_assured, [data-fee-assured], .badge-fee-assured, img[alt*="fee assured" i]'
  );
  if (feeAssuredEl.length > 0) return true;

  return false;
}
