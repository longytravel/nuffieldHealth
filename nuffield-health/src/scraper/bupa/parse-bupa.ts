import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { BupaParseResult, BupaSectionData } from "@/lib/bupa-types";

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

function splitDelimitedText(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[;,]/)
    .map((part) => normalizeText(part) ?? "")
    .filter(Boolean);
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizeSectionKey(raw: string): string {
  const normalized = normalizeText(raw)?.toLowerCase() ?? "";
  return normalized
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeRegistrationNumber(raw: string | undefined | null): string | null {
  if (!raw) return null;

  const digits = raw.replace(/\D+/g, "");
  if (!digits) return null;

  const normalized = digits.replace(/^0+/, "");
  return normalized.length > 0 ? normalized : "0";
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
          // Split on common delimiters if present, otherwise treat as single item
          if (/[;,]/.test(blockText)) {
            blockText.split(/[;,]/).forEach((part) => {
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
const MAPPED_OVERVIEW_SECTION_KEYS = new Set([
  "about",
  "about_me",
  "about_us",
  "biography",
  "profile",
  "overview",
  "specialties",
  "speciality",
  "specialty",
  "specialises_in",
  "main_specialties",
  "primary_specialty",
  "sub_specialties",
  "sub_specialities",
  "other_specialties",
  "treatments",
  "procedures",
  "treatments_and_procedures",
  "qualifications",
  "qualifications_and_credentials",
  "education_and_qualifications",
  "credentials",
  "additional_training",
  "memberships",
  "affiliations_memberships",
  "professional_memberships",
  "memberships_and_associations",
  "professional_bodies",
  "professional_bodies_positions_held_last_3_yrs",
  "clinical_interests",
  "special_interests",
  "areas_of_interest",
  "interests",
  "languages",
  "languages_spoken",
  "hospitals",
  "hospital_affiliations",
  "practises_at",
  "available_at",
  "locations",
  "where_i_practise",
  "gmc_registration",
]);

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
  const sourceSections = extractOverviewSections($);

  // --- Consultant name ---
  const consultantName = extractName($);

  // --- Registration number (GMC) ---
  const registrationNumber = extractRegistrationNumber($);

  // --- Photo ---
  const hasPhoto = detectPhoto($);

  // --- About text ---
  const aboutText = extractSectionText(sourceSections, [
    "About",
    "About me",
    "Biography",
    "Profile",
    "Overview",
  ]) ?? extractAboutText($);

  // --- Specialties ---
  const { primary: headerSpecialties, sub: headerSubSpecialties } = extractHeaderSpecialties($);
  const specialtyPrimary = headerSpecialties.length > 0
    ? headerSpecialties
    : extractSectionList(sourceSections, [
        "Specialties",
        "Speciality",
        "Specialty",
        "Main specialties",
        "Primary specialty",
      ]);
  const specialtySub = headerSubSpecialties.length > 0
    ? headerSubSpecialties
    : extractSectionList(sourceSections, [
        "Sub-specialties",
        "Sub specialties",
        "Sub-specialities",
        "Other specialties",
      ]);
  const normalizedSpecialtyPrimary =
    specialtyPrimary.length > 0 ? specialtyPrimary : extractListByHeading($, [
      "Specialties",
      "Speciality",
      "Specialty",
      "Main specialties",
      "Primary specialty",
    ]);
  const normalizedSpecialtySub =
    specialtySub.length > 0 ? specialtySub : extractListByHeading($, [
      "Sub-specialties",
      "Sub specialties",
      "Sub-specialities",
      "Other specialties",
    ]);

  // --- Treatments ---
  const rawTreatments = extractSectionList(sourceSections, [
    "Treatments",
    "Procedures",
    "Treatments and procedures",
    "Treatments & procedures",
    "Specialises in",
  ]);
  const normalizedTreatments = rawTreatments.length > 0 ? rawTreatments : extractListByHeading($, [
    "Treatments",
    "Procedures",
    "Treatments and procedures",
    "Treatments & procedures",
    "Specialises in",
  ]);

  // --- Qualifications ---
  const qualsPrimary = extractSectionText(sourceSections, [
    "Qualifications",
    "Qualifications and credentials",
    "Education and qualifications",
    "Credentials",
  ]) ?? extractTextByHeading($, [
    "Qualifications",
    "Qualifications and credentials",
    "Education and qualifications",
    "Credentials",
  ]);
  const qualsAdditional = extractSectionText(sourceSections, [
    "Additional training",
  ]);
  const qualificationsCredentials = [qualsPrimary, qualsAdditional]
    .filter(Boolean)
    .join(" ")
    .trim() || null;

  // --- Memberships ---
  const memberships = extractSectionList(sourceSections, [
    "Memberships",
    "Affiliations / memberships",
    "Professional memberships",
    "Memberships and associations",
    "Professional bodies",
    "Professional bodies (positions held - last 3 yrs)",
  ]);
  const normalizedMemberships = memberships.length > 0 ? memberships : extractListByHeading($, [
    "Memberships",
    "Affiliations / memberships",
    "Professional memberships",
    "Memberships and associations",
    "Professional bodies",
    "Professional bodies (positions held - last 3 yrs)",
  ]);

  // --- Clinical interests ---
  const clinicalInterests = extractSectionList(sourceSections, [
    "Clinical interests",
    "Special interests",
    "Areas of interest",
    "Interests",
  ]);
  const normalizedClinicalInterests =
    clinicalInterests.length > 0 ? clinicalInterests : extractListByHeading($, [
      "Clinical interests",
      "Special interests",
      "Areas of interest",
      "Interests",
    ]);
  const treatments = normalizedTreatments;

  // --- Languages ---
  const languages = extractSectionList(sourceSections, [
    "Languages",
    "Languages spoken",
  ]);
  const normalizedLanguages = languages.length > 0 ? languages : extractListByHeading($, [
    "Languages",
    "Languages spoken",
  ]);

  // --- Hospital affiliations ---
  const hospitalAffiliations = extractSectionList(sourceSections, [
    "Hospitals",
    "Hospital affiliations",
    "Practises at",
    "Available at",
    "Locations",
    "Where I practise",
  ]);
  const normalizedHospitalAffiliations =
    hospitalAffiliations.length > 0 ? hospitalAffiliations : extractHospitals($);

  // --- Fee assured ---
  const feeAssured = detectFeeAssured($);
  const contactPhoneNumbers = extractContactPhoneNumbers($);
  const contactEmailAddresses = extractContactEmailAddresses($);
  const websiteUrls = extractWebsiteUrls($);
  const accreditationBadges = extractAccreditationBadges($);
  const unmappedSectionKeys = Object.keys(sourceSections).filter(
    (key) => !MAPPED_OVERVIEW_SECTION_KEYS.has(key)
  );

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
    specialty_primary: normalizedSpecialtyPrimary,
    specialty_sub: normalizedSpecialtySub,
    treatments,
    qualifications_credentials: qualificationsCredentials,
    memberships: normalizedMemberships,
    clinical_interests: normalizedClinicalInterests,
    languages: normalizedLanguages,
    hospital_affiliations: normalizedHospitalAffiliations,
    fee_assured: feeAssured,
    contact_phone_numbers: contactPhoneNumbers,
    contact_email_addresses: contactEmailAddresses,
    website_urls: websiteUrls,
    accreditation_badges: accreditationBadges,
    source_sections: sourceSections,
    unmapped_section_keys: unmappedSectionKeys,
  };
}

// ---------------------------------------------------------------------------
// Field extractors
// ---------------------------------------------------------------------------

function extractName($: cheerio.CheerioAPI): string | null {
  // BUPA consultant pages expose the actual profile header in a dedicated block.
  const headerName = normalizeText($("#consultant-name-speciality h2 .cnwrpt").first().text())
    ?? normalizeText($("#consultant-name-speciality h2").first().text());
  if (headerName) return headerName;

  const titleText = normalizeText($("title").text().split(":")[0]);
  if (titleText && titleText.toLowerCase() !== "finder") return titleText;

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
  if (h1Text && h1Text.length < 100 && h1Text.toLowerCase() !== "finder") {
    return normalizeText(h1Text);
  }

  const h2Text = $("h2").first().text().trim();
  if (h2Text && h2Text.length < 100 && h2Text.toLowerCase() !== "finder") {
    return normalizeText(h2Text);
  }

  return null;
}

function extractRegistrationNumber($: cheerio.CheerioAPI): string | null {
  const clipboardRef = $("#consultant-name-speciality .cnref").attr("data-clipboard-text")
    ?? $("#consultant-name-speciality .cnref [data-clipboard-text]").attr("data-clipboard-text");
  if (clipboardRef?.trim()) return normalizeRegistrationNumber(clipboardRef);

  const gmcHeading = $("h4").filter((_i, el) =>
    $(el).text().trim().toLowerCase() === "gmc registration"
  ).first();
  if (gmcHeading.length > 0) {
    const gmcText = normalizeText(gmcHeading.next("p").text());
    const gmcMatch = gmcText?.match(GMC_STANDALONE_REGEX);
    if (gmcMatch) return normalizeRegistrationNumber(gmcMatch[1]);
  }

  const bodyText = $("body").text();

  // Strategy 1: Labelled GMC number
  const labelMatch = bodyText.match(GMC_LABEL_REGEX);
  if (labelMatch) return normalizeRegistrationNumber(labelMatch[1]);

  // Strategy 2: Meta tag
  const metaGmc =
    $('meta[name="gmc-number"]').attr("content") ||
    $('meta[property="gmc-number"]').attr("content");
  if (metaGmc) return normalizeRegistrationNumber(metaGmc);

  // Strategy 3: data attribute
  const dataGmc =
    $("[data-gmc]").attr("data-gmc") ||
    $("[data-gmc-number]").attr("data-gmc-number") ||
    $("[data-registration-number]").attr("data-registration-number");
  if (dataGmc) return normalizeRegistrationNumber(dataGmc);

  // Strategy 4: Look for text near "GMC" label elements
  const gmcElements = $("*").filter((_i, el) => {
    const text = $(el).text().trim();
    return /^GMC/i.test(text) && text.length < 50;
  });
  if (gmcElements.length > 0) {
    const nearText = gmcElements.first().parent().text();
    const match = nearText.match(GMC_STANDALONE_REGEX);
    if (match) return normalizeRegistrationNumber(match[1]);
  }

  return null;
}

function detectPhoto($: cheerio.CheerioAPI): boolean {
  // Strategy 1: img with consultant-related class/attribute
  const consultantImgs = $(
    'img.consultant-photo, img.consultant-image, img.profile-photo, img[data-consultant-photo], img.specialist-image, img[itemprop="image"], img.orient-me'
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

  // Strategy 4: BUPA serves consultant headshots from its image bucket with generic classes.
  const bucketPhoto = $("img").filter((_i, el) => {
    const src = $(el).attr("src") || "";
    const alt = $(el).attr("alt") || "";
    return (
      /bupa-images/i.test(src) &&
      !/placeholder|default|no[-_]?photo|silhouette/i.test(src) &&
      !!normalizeText(alt)
    );
  }).first();
  if (bucketPhoto.length > 0) {
    return true;
  }

  return false;
}

function extractAboutText($: cheerio.CheerioAPI): string | null {
  const aboutText = normalizeText($("#consultant-overview h4:contains('About me')").first().next("p").text());
  if (aboutText && aboutText.length > 20) return aboutText;

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

  // Strategy 2: BUPA map info — hospital links in #map-info-holder
  const mapHospitals: string[] = [];
  $('#map-info-holder .results a[href*="/Hospital/view/"]').each((_i, el) => {
    const val = normalizeText($(el).text());
    if (val) mapHospitals.push(val);
  });
  if (mapHospitals.length > 0) return dedupeStrings(mapHospitals);

  // Strategy 3: CSS-based hospital list
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

function extractOverviewSections($: cheerio.CheerioAPI): Record<string, BupaSectionData> {
  const sections: Record<string, BupaSectionData> = {};
  const seenRoots = new Set<AnyNode>();
  const rootSelectors = [
    "#consultant-overview",
    ".main-col-inner.pad",
    ".main-col-inner .toggle-able-content",
  ];

  for (const selector of rootSelectors) {
    $(selector).each((_index, rootEl) => {
      if (seenRoots.has(rootEl)) return;
      seenRoots.add(rootEl);

      $(rootEl).children("h1, h2, h3, h4, h5, h6").each((_headingIndex, headingEl) => {
        const headingText = normalizeText($(headingEl).text());
        if (!headingText) return;

        const values: string[] = [];
        let next = $(headingEl).next();

        while (next.length > 0 && !next.is("h1, h2, h3, h4, h5, h6")) {
          appendSectionBlockValues($, next, values);
          next = next.next();
        }

        const key = normalizeSectionKey(headingText);
        const existing = sections[key];
        sections[key] = {
          heading: existing?.heading ?? headingText,
          values: dedupeStrings([...(existing?.values ?? []), ...values]),
        };
      });
    });
  }

  return sections;
}

function appendSectionBlockValues(
  $: cheerio.CheerioAPI,
  block: cheerio.Cheerio<AnyNode>,
  values: string[]
): void {
  let addedAny = false;

  block.find("li").each((_i, li) => {
    const value = normalizeText($(li).text());
    if (!value) return;
    values.push(value);
    addedAny = true;
  });

  if (!addedAny) {
    const blockText = normalizeText(block.text());
    if (blockText) {
      values.push(blockText);
    }
  }
}

function extractSectionValues(
  sections: Record<string, BupaSectionData>,
  headingTexts: string[]
): string[] {
  for (const headingText of headingTexts) {
    const section = sections[normalizeSectionKey(headingText)];
    if (section && section.values.length > 0) {
      return section.values;
    }
  }

  return [];
}

function extractSectionText(
  sections: Record<string, BupaSectionData>,
  headingTexts: string[]
): string | null {
  const values = extractSectionValues(sections, headingTexts);
  return normalizeText(values.join(" "));
}

function extractSectionList(
  sections: Record<string, BupaSectionData>,
  headingTexts: string[]
): string[] {
  const values = extractSectionValues(sections, headingTexts);
  return dedupeStrings(
    values.flatMap((value) => {
      const parts = splitDelimitedText(value);
      return parts.length > 0 ? parts : [];
    })
  );
}

function extractContactPhoneNumbers($: cheerio.CheerioAPI): string[] {
  const phoneNumbers: string[] = [];

  $("#consultant-name-speciality a[data-tel-href], #consultant-name-speciality a[href^='tel:'], #gib-phone a").each(
    (_i, link) => {
      const raw =
        normalizeText($(link).text()) ??
        normalizeText($(link).attr("data-tel-href")?.replace(/^tel:/i, "")) ??
        normalizeText($(link).attr("href")?.replace(/^tel:/i, ""));

      if (raw) phoneNumbers.push(raw);
    }
  );

  return dedupeStrings(phoneNumbers);
}

function extractContactEmailAddresses($: cheerio.CheerioAPI): string[] {
  const emailAddresses: string[] = [];

  $("a[href^='mailto:']").each((_i, link) => {
    const href = ($(link).attr("href") || "").trim();
    const decoded = decodeURIComponent(href.replace(/^mailto:/i, ""));
    const normalized = normalizeText(decoded);
    if (!normalized) return;
    emailAddresses.push(normalized);
  });

  return dedupeStrings(emailAddresses);
}

function extractWebsiteUrls($: cheerio.CheerioAPI): string[] {
  const urls: string[] = [];

  $("#consultant-name-speciality a[href]").each((_i, link) => {
    const href = ($(link).attr("href") || "").trim();
    if (!/^https?:\/\//i.test(href)) return;
    if (/finder\.bupa\.co\.uk/i.test(href)) return;
    urls.push(href);
  });

  return dedupeStrings(urls);
}

function extractAccreditationBadges($: cheerio.CheerioAPI): string[] {
  const badges: string[] = [];

  $("img[alt]").each((_i, img) => {
    const alt = normalizeText($(img).attr("alt"));
    if (!alt) return;
    if (/follow bupa|linked-?in|support|company logo|google|new window|street view|pegman|powered by/i.test(alt)) {
      return;
    }
    if (/bupa accredited|programme|paediatrics|care centre/i.test(alt)) {
      badges.push(alt);
    }
  });

  return dedupeStrings(badges);
}

function extractHeaderSpecialties($: cheerio.CheerioAPI): { primary: string[]; sub: string[] } {
  const specialtyHeaderSource = $("#consultant-name-speciality h3").filter((_i, el) =>
    $(el).find(".cnref, .copy-me, #pnum").length > 0
  ).first();
  const specialtyHeader = (specialtyHeaderSource.length > 0
    ? specialtyHeaderSource
    : $("#consultant-name-speciality h3").not(".assoc-with").last()
  ).clone();
  specialtyHeader.find(".cnref, #pnum, a").remove();
  const headerText = normalizeText(specialtyHeader.text());

  if (headerText) {
    return {
      primary: splitDelimitedText(headerText),
      sub: [],
    };
  }

  const metaDescription = $('meta[name="Description"]').attr("content") ?? "";
  const primaryMatch = metaDescription.match(/specialty:\s*([^:]+?)(?:,\s*subspecialty:|$)/i);
  const subMatch = metaDescription.match(/subspecialty:\s*(.+)$/i);

  return {
    primary: splitDelimitedText(primaryMatch?.[1] ?? null),
    sub: splitDelimitedText(subMatch?.[1] ?? null),
  };
}

function detectFeeAssured($: cheerio.CheerioAPI): boolean {
  const bodyText = $("body").text().toLowerCase();

  if (/not[\s-]+fee[\s-]?assured/i.test(bodyText)) return false;

  if ($(".is-fee-assured, .fee-assured").length > 0) return true;
  if ($(".is-not-fee-assured").length > 0) return false;

  // Check for "fee assured" text anywhere on the page
  if (/fee[\s-]?assured/i.test(bodyText)) return true;

  // Check for fee-assured badges/icons
  const feeAssuredEl = $(
    '.fee-assured, .fee_assured, [data-fee-assured], .badge-fee-assured, img[alt*="fee assured" i]'
  );
  if (feeAssuredEl.length > 0) return true;

  return false;
}
