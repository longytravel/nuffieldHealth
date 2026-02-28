import * as cheerio from "cheerio";
import type { Element as DomElement } from "domhandler";
import type { Confidence, NewsItem } from "../lib/types";
import { HeadingCategory, classifyHeading, extractPractisingYear } from "./headings";

// Per-field confidence tracking
export interface FieldConfidence {
  consultant_name: Confidence;
  consultant_title_prefix: Confidence;
  registration_number: Confidence;
  has_photo: Confidence;
  specialty_primary: Confidence;
  specialty_sub: Confidence;
  treatments: Confidence;
  insurers: Confidence;
  qualifications_credentials: Confidence;
  practising_since: Confidence;
  memberships: Confidence;
  clinical_interests: Confidence;
  personal_interests: Confidence;
  languages: Confidence;
  consultation_times_raw: Confidence;
  declaration: Confidence;
  in_the_news: Confidence;
  professional_roles: Confidence;
  hospital_name_primary: Confidence;
  booking_state: Confidence;
  contact_phone: Confidence;
  contact_email: Confidence;
  patient_age_restriction: Confidence;
  cqc_rating: Confidence;
  external_website: Confidence;
}

export interface ParseResult {
  consultant_name: string | null;
  consultant_title_prefix: string | null;
  registration_number: string | null;
  gmc_code_for_booking: string | null;
  has_photo: boolean;
  specialty_primary: string[];
  specialty_sub: string[];
  treatments: string[];
  treatments_excluded: string[];
  insurers: string[];
  insurer_count: number;
  qualifications_credentials: string | null;
  practising_since: number | null;
  memberships: string[];
  clinical_interests: string[];
  personal_interests: string | null;
  languages: string[];
  consultation_times_raw: string[];
  declaration: string[] | null;
  declaration_substantive: boolean | null;
  in_the_news: NewsItem[] | null;
  professional_roles: string | null;
  patient_age_restriction: string | null;
  patient_age_restriction_min: number | null;
  patient_age_restriction_max: number | null;
  external_website: string | null;
  cqc_rating: string | null;
  booking_caveat: string | null;
  contact_phone: string | null;
  contact_mobile: string | null;
  contact_email: string | null;
  hospital_name_primary: string | null;
  hospital_code_primary: string | null;
  hospital_is_nuffield: boolean;
  hospital_nuffield_at_nhs: boolean;
  booking_state: "not_bookable" | "bookable_no_slots" | "bookable_with_slots";
  about_text: string | null;
  related_experience_text: string | null;
  overview_text: string | null;
  cms_corruption_detected: boolean;
  confidence: FieldConfidence;
}

// Title prefixes recognized in H1 text (order matters: "Professor" before checking shorter prefixes)
const TITLE_PREFIXES = ["Professor", "Prof", "Dr", "Mrs", "Miss", "Ms", "Mr"] as const;

// Regex for GMC/registration number extraction
const REGISTRATION_REGEX = /GMC\s*number:\s*([A-Za-z0-9-]+)/i;

// CMS corruption pattern: asterisks breaking words (e.g. "s****ees" from bold markdown errors)
const CMS_CORRUPTION_REGEX = /\w\*{2,}\w|\*{2,}\w+\*{2,}/;

// Phone number normalization: UK phone prefixes
// BUG-014: \d{1,3} (not \d{2,3}) to handle 3-digit area codes like 020 (London)
const PHONE_REGEX = /(?:0[1-3]\d{1,3}\s*\d{3,4}\s*\d{3,4}|07\d{3}\s*\d{3}\s*\d{3}|0300\s*\d{3}\s*\d{4}|0[1-3]\d{8,9}|07\d{9}|0300\d{7})/g;

// Age restriction patterns — BUG-009: require age-related keyword preamble to avoid matching phone numbers
const AGE_ADULTS_ONLY_REGEX = /only\s+sees?\s+adults/i;
const AGE_RANGE_REGEX = /(?:from\s+(?:the\s+)?)?ages?\s+(?:of\s+)?(\d{1,3})\s*(?:to|-)\s*(\d{1,3})/i;
const AGE_MIN_REGEX = /(?:ages?\s+(?:of\s+)?(?:over|above)|(?:over|above)\s+(?:the\s+)?age\s+(?:of\s+)?)(\d{1,3})/i;

// Nuffield Health naming patterns
const NUFFIELD_AT_NHS_REGEX = /nuffield\s+health\s+at\s+/i;
const NUFFIELD_REGEX = /nuffield/i;

// Declaration boilerplate patterns (case-insensitive)
const DECLARATION_BOILERPLATE_PATTERNS = [
  "no interests to declare",
  "no financial interests",
  "nothing to declare",
  "no relevant interests",
  "has no interests to declare",
  "does not have any interests to declare",
  "no declarable interests",
  "does not hold a share",
  "does not have a financial",
  "does not hold a financial interest",
  "no share or financial interest",
];

/**
 * Parse a consultant profile HTML page into structured data.
 *
 * @param html - The full HTML string of the profile page (already expanded — "View more" handled by crawl.ts)
 * @param slug - The profile slug (e.g. "mr-nigel-dsouza")
 * @returns ParseResult with all extracted fields and per-field confidence
 */
export function parseProfile(html: string, slug: string): ParseResult {
  const $ = cheerio.load(html);

  const confidence = createDefaultConfidence();

  // Extract consultant name — cascade selector to skip cookie banner H1
  const h1Text = extractConsultantH1($);
  const { name: consultantName, titlePrefix } = extractNameAndTitle(h1Text);
  confidence.consultant_name = consultantName ? "high" : "low";
  confidence.consultant_title_prefix = titlePrefix ? "high" : "medium";

  // Registration number (GMC number)
  const registrationNumber = extractRegistrationNumber($);
  confidence.registration_number = registrationNumber ? "high" : "low";

  // Derive gmc_code_for_booking
  const gmcCodeForBooking =
    registrationNumber && /^\d+$/.test(registrationNumber) ? registrationNumber : null;

  // Photo detection: aside.consultant__image with valid img src
  const hasPhoto = detectPhoto($);
  confidence.has_photo = "high";

  // Booking state: check for booking iframe
  const bookingState = detectBookingState($);
  confidence.booking_state = "high";

  // Booking caveat
  const bookingCaveat = extractBookingCaveat($);

  // CMS corruption detection
  const pageText = $("body").text();
  const cmsCorruptionDetected = CMS_CORRUPTION_REGEX.test(pageText);

  // Collect all heading-based sections
  const sections = collectSections($);

  // Extract fields from classified sections
  const specialtyPrimary = extractListItems($, sections, HeadingCategory.SPECIALTIES);
  const specialtySub = extractSpecialtySub($, sections);
  confidence.specialty_primary = specialtyPrimary.length > 0 ? "high" : "medium";
  confidence.specialty_sub = specialtySub.length > 0 ? "high" : "medium";

  // Treatments: merge from all treatment sections
  const treatments = extractListItems($, sections, HeadingCategory.TREATMENTS);
  confidence.treatments = treatments.length > 0 ? "high" : "medium";

  // Qualifications
  const qualifications = extractTextContent($, sections, HeadingCategory.QUALIFICATIONS);
  confidence.qualifications_credentials = qualifications ? "high" : "medium";

  // Consultation times
  const consultationTimes = extractListItems($, sections, HeadingCategory.CONSULTATION_TIMES);
  confidence.consultation_times_raw = consultationTimes.length > 0 ? "high" : "medium";

  // Declaration
  const declaration = extractParagraphs($, sections, HeadingCategory.DECLARATION);
  const declarationSubstantive = declaration ? isDeclarationSubstantive(declaration) : null;
  confidence.declaration = declaration ? "high" : "medium";

  // Insurers
  const insurers = extractListItems($, sections, HeadingCategory.INSURERS);
  confidence.insurers = insurers.length > 0 ? "high" : "medium";

  // Practising since — try heading first, then scan paragraphs as fallback
  const practisingYear =
    extractPractisingYearFromSections($, sections) ??
    scanParagraphsForPractisingYear($, sections);
  confidence.practising_since = practisingYear !== null ? "high" : "medium";

  // Interest sections
  const clinicalInterests = [
    ...extractListItems($, sections, HeadingCategory.SPECIAL_INTERESTS),
    ...extractListItems($, sections, HeadingCategory.OTHER_INTERESTS),
  ];
  confidence.clinical_interests = clinicalInterests.length > 0 ? "high" : "medium";

  const personalInterests = extractTextContent($, sections, HeadingCategory.PERSONAL_INTERESTS);
  confidence.personal_interests = personalInterests ? "high" : "medium";

  // Languages
  const languages = extractListItems($, sections, HeadingCategory.LANGUAGES);
  confidence.languages = languages.length > 0 ? "high" : "medium";

  // Research — captured as list items under clinical interests if relevant
  const researchItems = extractListItems($, sections, HeadingCategory.RESEARCH);

  // Memberships
  const memberships = extractListItems($, sections, HeadingCategory.MEMBERSHIPS);
  confidence.memberships = memberships.length > 0 ? "high" : "medium";

  // Professional roles
  const professionalRoles = extractTextContent($, sections, HeadingCategory.PROFESSIONAL_ROLES);
  confidence.professional_roles = professionalRoles ? "high" : "medium";

  // In the news
  const inTheNews = extractNewsItems($, sections);
  confidence.in_the_news = inTheNews ? "high" : "medium";

  // About text
  const aboutText = extractTextContent($, sections, HeadingCategory.ABOUT);

  // Related experience
  const relatedExperience = extractTextContent($, sections, HeadingCategory.RELATED_EXPERIENCE);

  // Overview
  const overviewText = extractTextContent($, sections, HeadingCategory.OVERVIEW);

  // Patient age restriction
  const ageRestriction = extractAgeRestriction($);
  confidence.patient_age_restriction = ageRestriction.text ? "high" : "medium";

  // Contact info
  const contacts = extractContactInfo($);
  confidence.contact_phone = contacts.phone ? "high" : "medium";
  confidence.contact_email = contacts.email ? "high" : "medium";

  // External website
  const externalWebsite = extractExternalWebsite($);
  confidence.external_website = externalWebsite ? "high" : "medium";

  // CQC rating
  const cqcRating = extractCqcRating($);
  confidence.cqc_rating = cqcRating ? "high" : "medium";

  // Hospital info
  const hospital = extractHospitalInfo($, sections);
  confidence.hospital_name_primary = hospital.name ? "high" : "medium";

  return {
    consultant_name: consultantName,
    consultant_title_prefix: titlePrefix,
    registration_number: registrationNumber,
    gmc_code_for_booking: gmcCodeForBooking,
    has_photo: hasPhoto,
    specialty_primary: specialtyPrimary,
    specialty_sub: specialtySub,
    treatments: deduplicateArray(treatments),
    treatments_excluded: [],
    insurers: deduplicateArray(insurers),
    insurer_count: insurers.length,
    qualifications_credentials: qualifications,
    practising_since: practisingYear,
    memberships: deduplicateArray(memberships),
    clinical_interests: deduplicateArray(clinicalInterests),
    personal_interests: personalInterests,
    languages: deduplicateArray(languages),
    consultation_times_raw: consultationTimes,
    declaration,
    declaration_substantive: declarationSubstantive,
    in_the_news: inTheNews,
    professional_roles: professionalRoles,
    patient_age_restriction: ageRestriction.text,
    patient_age_restriction_min: ageRestriction.min,
    patient_age_restriction_max: ageRestriction.max,
    external_website: externalWebsite,
    cqc_rating: cqcRating,
    booking_caveat: bookingCaveat,
    contact_phone: contacts.phone,
    contact_mobile: contacts.mobile,
    contact_email: contacts.email,
    hospital_name_primary: hospital.name,
    hospital_code_primary: hospital.code,
    hospital_is_nuffield: hospital.isNuffield,
    hospital_nuffield_at_nhs: hospital.nuffieldAtNhs,
    booking_state: bookingState,
    about_text: aboutText,
    related_experience_text: relatedExperience,
    overview_text: overviewText,
    cms_corruption_detected: cmsCorruptionDetected,
    confidence,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

interface ClassifiedSection {
  category: HeadingCategory;
  element: cheerio.Cheerio<DomElement>;
  headingText: string;
}

function createDefaultConfidence(): FieldConfidence {
  return {
    consultant_name: "medium",
    consultant_title_prefix: "medium",
    registration_number: "medium",
    has_photo: "high",
    specialty_primary: "medium",
    specialty_sub: "medium",
    treatments: "medium",
    insurers: "medium",
    qualifications_credentials: "medium",
    practising_since: "medium",
    memberships: "medium",
    clinical_interests: "medium",
    personal_interests: "medium",
    languages: "medium",
    consultation_times_raw: "medium",
    declaration: "medium",
    in_the_news: "medium",
    professional_roles: "medium",
    hospital_name_primary: "medium",
    booking_state: "high",
    contact_phone: "medium",
    contact_email: "medium",
    patient_age_restriction: "medium",
    cqc_rating: "medium",
    external_website: "medium",
  };
}

/**
 * Extract the consultant's H1 text, skipping cookie banner H1 elements.
 * Cascade: itemprop="name" → meta swiftype fullname → first H1 outside #ccc.
 */
function extractConsultantH1($: cheerio.CheerioAPI): string {
  // 1. Structured data: h1[itemprop="name"]
  const itempropH1 = $('h1[itemprop="name"]').first();
  if (itempropH1.length > 0) {
    const text = itempropH1.text().trim();
    if (text) return text;
  }

  // 2. Swiftype meta tag (used by Nuffield's search)
  const swiftypeMeta = $('meta.swiftype[name="fullname"]').first();
  if (swiftypeMeta.length > 0) {
    const content = swiftypeMeta.attr("content")?.trim();
    if (content) return content;
  }

  // 3. First H1 that is NOT inside a cookie consent container (#ccc, .ccc)
  let fallbackText = "";
  $("h1").each((_i, el) => {
    if (fallbackText) return;
    const $el = $(el);
    // Skip if inside cookie consent container
    if ($el.closest("#ccc, .ccc, #cookie-consent, .cookie-consent, #onetrust-consent-sdk").length > 0) return;
    const text = $el.text().trim();
    if (text) fallbackText = text;
  });

  return fallbackText;
}

/**
 * Extract name and title prefix from H1 text.
 * Handles: "Mr Nigel D'Souza", "Professor Rajesh Nanda", "Mr Jonathan A. Clamp"
 */
function extractNameAndTitle(h1Text: string): { name: string | null; titlePrefix: string | null } {
  if (!h1Text) return { name: null, titlePrefix: null };

  const trimmed = h1Text.trim();
  let titlePrefix: string | null = null;

  for (const prefix of TITLE_PREFIXES) {
    // Match prefix followed by space (case-insensitive)
    const regex = new RegExp(`^${prefix}\\b\\.?\\s*`, "i");
    if (regex.test(trimmed)) {
      // Normalize "Prof" to "Professor"
      titlePrefix = prefix === "Prof" ? "Professor" : prefix;
      break;
    }
  }

  // Normalise internal whitespace (BUG-008: H1 text may have double/triple spaces)
  const normalised = trimmed.replace(/\s+/g, " ");
  return { name: normalised || null, titlePrefix };
}

/**
 * Extract GMC/registration number from the page.
 */
function extractRegistrationNumber($: cheerio.CheerioAPI): string | null {
  const bodyText = $("body").text();
  const match = bodyText.match(REGISTRATION_REGEX);
  return match ? match[1] : null;
}

/**
 * Detect if consultant has a valid photo.
 * Checks for aside.consultant__image with an img that has a valid src URL.
 */
function detectPhoto($: cheerio.CheerioAPI): boolean {
  const aside = $("aside.consultant__image");
  if (aside.length === 0) return false;

  const img = aside.find("img");
  if (img.length === 0) return false;

  const src = img.attr("src");
  if (!src || src.trim() === "") return false;

  // Validate it looks like a URL (not just a placeholder attribute)
  return src.startsWith("http") || src.startsWith("/");
}

/**
 * Detect booking state from iframe presence.
 */
function detectBookingState(
  $: cheerio.CheerioAPI
): "not_bookable" | "bookable_no_slots" | "bookable_with_slots" {
  // Check for booking iframe
  const bookingIframe = $('iframe[src*="booking"], iframe[src*="book"]');
  if (bookingIframe.length > 0) {
    return "bookable_no_slots"; // actual slot count comes from API layer
  }

  // Check for booking-related elements
  const bookingSection = $('[class*="booking"], [id*="booking"]');
  if (bookingSection.length > 0) {
    return "bookable_no_slots";
  }

  return "not_bookable";
}

/**
 * Extract booking caveat text (e.g. "Online booking is for initial appointments only").
 */
function extractBookingCaveat($: cheerio.CheerioAPI): string | null {
  // Look for caveat text near booking sections
  const caveatSelectors = [
    ".booking-caveat",
    ".booking__caveat",
    '[class*="booking"] p',
    '[class*="booking"] .caveat',
  ];

  for (const selector of caveatSelectors) {
    const el = $(selector);
    if (el.length > 0) {
      const text = el.text().trim();
      if (text && text.toLowerCase().includes("booking")) {
        return text;
      }
    }
  }

  // Search for caveat text in the page body
  const pageHtml = $.html();
  const caveatMatch = pageHtml.match(
    /(?:Online booking is[^<]*(?:only|initial)[^<]*)/i
  );
  if (caveatMatch) {
    return caveatMatch[0].trim();
  }

  return null;
}

/**
 * Collect all heading-based sections by walking H2/H3/H4 elements.
 * Each section is the heading element itself — content is extracted
 * as siblings until the next heading of same or higher level.
 */
function collectSections($: cheerio.CheerioAPI): ClassifiedSection[] {
  const sections: ClassifiedSection[] = [];
  const seen = new Set<string>();

  $("h2, h3, h4").each((_i, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    const tagName = el.type === "tag" ? el.tagName.toLowerCase() : "";

    const category = classifyHeading(text, tagName);
    if (category !== null && category !== HeadingCategory.CTA_EXCLUDE) {
      // For some categories we allow multiple sections (TREATMENTS gets merged)
      const key = `${category}:${text}`;
      if (category !== HeadingCategory.TREATMENTS || !seen.has(key)) {
        sections.push({ category, element: $el, headingText: text });
        seen.add(key);
      }
    }
  });

  return sections;
}

/**
 * Get sibling elements until the next heading of the same or higher level.
 */
function getSectionContent(
  $: cheerio.CheerioAPI,
  headingEl: cheerio.Cheerio<DomElement>
): cheerio.Cheerio<DomElement> {
  const tagName = headingEl.prop("tagName")?.toLowerCase() ?? "h2";
  const level = parseInt(tagName.replace("h", ""), 10) || 2;

  const siblings: DomElement[] = [];
  let current = headingEl.next();

  while (current.length > 0) {
    const currentTag = current.prop("tagName")?.toLowerCase() ?? "";
    if (/^h[1-6]$/.test(currentTag)) {
      const currentLevel = parseInt(currentTag.replace("h", ""), 10);
      if (currentLevel <= level) break; // stop at same or higher level heading
    }
    siblings.push(current[0] as DomElement);
    current = current.next();
  }

  return $(siblings);
}

/**
 * Extract list items (li text) from sections matching a category.
 * Falls back to paragraph text split by newlines if no list found.
 */
function extractListItems(
  $: cheerio.CheerioAPI,
  sections: ClassifiedSection[],
  category: HeadingCategory
): string[] {
  const items: string[] = [];

  for (const section of sections) {
    if (section.category !== category) continue;

    const content = getSectionContent($, section.element);

    // Try list items first
    const listItems = content.find("li");
    if (listItems.length > 0) {
      listItems.each((_i, li) => {
        const text = $(li).text().trim();
        if (text) items.push(text);
      });
    } else {
      // Fall back to text content from paragraphs/divs
      content.each((_i, el) => {
        const $el = $(el);
        // Check if this element itself has list items
        const innerLi = $el.find("li");
        if (innerLi.length > 0) {
          innerLi.each((_j, li) => {
            const text = $(li).text().trim();
            if (text) items.push(text);
          });
        } else {
          let text = $el.text().trim();
          if (text) {
            // Strip known label prefixes (e.g. "Sub-specialties: Orthopaedics")
            text = stripLabelPrefix(text);
            // Split multi-line content into separate items
            const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
            items.push(...lines);
          }
        }
      });
    }
  }

  // Clean trailing commas and whitespace from all items
  return items.map((item) => item.replace(/,\s*$/, "").trim()).filter(Boolean);
}

// Known label prefixes to strip from paragraph text in list extraction
const LABEL_PREFIXES = [
  /^sub-specialties:\s*/i,
  /^specialties:\s*/i,
  /^treatments:\s*/i,
];

/**
 * Strip known label prefixes from paragraph text (e.g. "Sub-specialties: X, Y" → "X, Y").
 */
function stripLabelPrefix(text: string): string {
  for (const regex of LABEL_PREFIXES) {
    text = text.replace(regex, "");
  }
  return text.trim();
}

/**
 * Extract text content from the first section matching a category.
 */
function extractTextContent(
  $: cheerio.CheerioAPI,
  sections: ClassifiedSection[],
  category: HeadingCategory
): string | null {
  const section = sections.find((s) => s.category === category);
  if (!section) return null;

  const content = getSectionContent($, section.element);
  const texts: string[] = [];

  content.each((_i, el) => {
    const text = $(el).text().trim();
    if (text) texts.push(text);
  });

  return texts.length > 0 ? texts.join("\n") : null;
}

/**
 * Extract paragraphs from a section (for declaration).
 */
function extractParagraphs(
  $: cheerio.CheerioAPI,
  sections: ClassifiedSection[],
  category: HeadingCategory
): string[] | null {
  const section = sections.find((s) => s.category === category);
  if (!section) return null;

  const content = getSectionContent($, section.element);
  const paragraphs: string[] = [];

  content.each((_i, el) => {
    const text = $(el).text().trim();
    if (text) paragraphs.push(text);
  });

  return paragraphs.length > 0 ? paragraphs : null;
}

/**
 * Determine if a declaration contains substantive financial disclosures.
 */
function isDeclarationSubstantive(paragraphs: string[]): boolean {
  const fullText = paragraphs.join(" ").toLowerCase();

  // Check if the full text matches any single boilerplate pattern
  for (const pattern of DECLARATION_BOILERPLATE_PATTERNS) {
    if (fullText.includes(pattern)) {
      return false;
    }
  }

  // Aggregate check: if ALL sentences match boilerplate, it's non-substantive
  const sentences = fullText
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
  if (sentences.length > 0) {
    const allBoilerplate = sentences.every((sentence) =>
      DECLARATION_BOILERPLATE_PATTERNS.some((pattern) => sentence.includes(pattern))
    );
    if (allBoilerplate) return false;
  }

  // If it has text and doesn't match boilerplate, it's substantive
  return fullText.length > 10;
}

/**
 * Extract specialty sub-items (H3 under Specialties H2).
 */
function extractSpecialtySub(
  $: cheerio.CheerioAPI,
  sections: ClassifiedSection[]
): string[] {
  const specialtySection = sections.find(
    (s) => s.category === HeadingCategory.SPECIALTIES
  );
  if (!specialtySection) return [];

  const subs: string[] = [];
  const content = getSectionContent($, specialtySection.element);

  // Look for H3 headings and paragraph-based sub-specialties
  content.each((_i, el) => {
    const $el = $(el);
    const tagName = $el.prop("tagName")?.toLowerCase();
    if (tagName === "h3") {
      const text = $el.text().trim();
      if (text) subs.push(text);
    } else if (tagName === "p") {
      const text = $el.text().trim();
      // Check for "Sub-specialties: X, Y, Z" pattern in paragraphs
      const subMatch = text.match(/^sub-specialties:\s*(.+)/i);
      if (subMatch) {
        const items = subMatch[1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        subs.push(...items);
      }
    }
  });

  return subs;
}

/**
 * Extract practising since year from headings and inline elements.
 * Pattern 1: "Practising since: 2004" (year embedded in heading)
 * Pattern 2: "Practising since" heading with year as next inline element
 */
function extractPractisingYearFromSections(
  $: cheerio.CheerioAPI,
  sections: ClassifiedSection[]
): number | null {
  const section = sections.find(
    (s) => s.category === HeadingCategory.PRACTISING_SINCE
  );
  if (!section) return null;

  // Pattern 1: year embedded in heading text
  const yearFromHeading = extractPractisingYear(section.headingText);
  if (yearFromHeading !== null) return yearFromHeading;

  // Pattern 2: year as separate inline element after heading
  const content = getSectionContent($, section.element);
  let yearFromContent: number | null = null;

  content.each((_i, el) => {
    if (yearFromContent !== null) return;
    const text = $(el).text().trim();
    const year = extractPractisingYear(text);
    if (year !== null) yearFromContent = year;
  });

  if (yearFromContent !== null) return yearFromContent;

  // Also check immediate text nodes after the heading
  const nextSibling = section.element.next();
  if (nextSibling.length > 0) {
    const text = nextSibling.text().trim();
    const year = extractPractisingYear(text);
    if (year !== null) return year;
  }

  return null;
}

/**
 * Scan paragraphs in qualification/experience sections for "Practising since" text.
 * Fallback when no dedicated PRACTISING_SINCE heading exists.
 */
function scanParagraphsForPractisingYear(
  $: cheerio.CheerioAPI,
  sections: ClassifiedSection[]
): number | null {
  const candidateCategories = [
    HeadingCategory.QUALIFICATIONS,
    HeadingCategory.RELATED_EXPERIENCE,
  ];

  for (const category of candidateCategories) {
    for (const section of sections) {
      if (section.category !== category) continue;
      const content = getSectionContent($, section.element);
      let found: number | null = null;
      content.each((_i, el) => {
        if (found !== null) return;
        const $el = $(el);
        // Check paragraphs and their children
        const paragraphs = $el.is("p") ? $el : $el.find("p");
        paragraphs.each((_j, p) => {
          if (found !== null) return;
          const text = $(p).text().trim().toLowerCase();
          if (text.includes("practising since")) {
            const year = extractPractisingYear($(p).text());
            if (year !== null) found = year;
          }
        });
      });
      if (found !== null) return found;
    }
  }
  return null;
}

/**
 * Extract news items from "In the news" section.
 */
function extractNewsItems(
  $: cheerio.CheerioAPI,
  sections: ClassifiedSection[]
): NewsItem[] | null {
  const section = sections.find(
    (s) => s.category === HeadingCategory.IN_THE_NEWS
  );
  if (!section) return null;

  const content = getSectionContent($, section.element);
  const items: NewsItem[] = [];

  content.find("a").each((_i, a) => {
    const $a = $(a);
    const title = $a.text().trim();
    const url = $a.attr("href") ?? "";
    if (title && url) {
      items.push({ title, url });
    }
  });

  return items.length > 0 ? items : null;
}

/**
 * Extract patient age restriction info.
 * BUG-009: Scoped to short candidate elements containing age-related keywords,
 * not full body text. Requires keyword preamble and validates min <= max.
 */
function extractAgeRestriction(
  $: cheerio.CheerioAPI
): { text: string | null; min: number | null; max: number | null } {
  // Collect candidate text from short elements containing age-related keywords
  const candidates: string[] = [];
  $("p, li, span, div").each((_i, el) => {
    const $el = $(el);
    // Skip elements that contain block children (avoid concatenated text)
    if ($el.find("p, div, li").length > 0) return;
    const text = $el.text().trim();
    // Only consider short elements (under 200 chars) with age-related keywords
    if (text.length > 0 && text.length < 200 && /\bage[sd]?\b/i.test(text)) {
      candidates.push(text);
    }
  });

  // Also check full body for the adults-only pattern (it's distinctive enough)
  const bodyText = $("body").text();

  // Check for "only sees adults" pattern (safe on full body — very specific)
  const adultsMatch = bodyText.match(AGE_ADULTS_ONLY_REGEX);
  if (adultsMatch) {
    return { text: adultsMatch[0], min: 18, max: null };
  }

  // Search candidates for age range/min patterns
  for (const text of candidates) {
    const rangeMatch = text.match(AGE_RANGE_REGEX);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1], 10);
      const max = parseInt(rangeMatch[2], 10);
      // Sanity: reject if min > max or max > 120
      if (min <= max && max <= 120) {
        return { text: rangeMatch[0], min, max };
      }
    }

    const minMatch = text.match(AGE_MIN_REGEX);
    if (minMatch) {
      const min = parseInt(minMatch[1], 10);
      if (min <= 120) {
        return { text: minMatch[0], min, max: null };
      }
    }
  }

  return { text: null, min: null, max: null };
}

/**
 * Extract contact information (phone, mobile, email).
 */
function extractContactInfo(
  $: cheerio.CheerioAPI
): { phone: string | null; mobile: string | null; email: string | null } {
  let phone: string | null = null;
  let mobile: string | null = null;
  let email: string | null = null;

  // Extract email from mailto links
  $('a[href^="mailto:"]').each((_i, a) => {
    if (!email) {
      const href = $(a).attr("href") ?? "";
      email = href.replace("mailto:", "").trim() || null;
    }
  });

  // BUG-013: Prefer itemprop="telephone" (sidebar CTA / location section)
  // over tel: links, which may contain a central booking number
  const phoneNumbers: string[] = [];
  $('[itemprop="telephone"]').each((_i, el) => {
    const text = $(el).text().trim();
    const normalised = normalisePhone(text);
    if (normalised && !phoneNumbers.includes(normalised)) {
      phoneNumbers.push(normalised);
    }
  });

  // Fallback: Extract phone numbers from tel: links
  if (phoneNumbers.length === 0) {
    $('a[href^="tel:"]').each((_i, a) => {
      const href = $(a).attr("href") ?? "";
      const raw = href.replace("tel:", "").trim();
      const normalised = normalisePhone(raw);
      if (normalised && !phoneNumbers.includes(normalised)) {
        phoneNumbers.push(normalised);
      }
    });
  }

  // Final fallback: scan text for phone numbers
  if (phoneNumbers.length === 0) {
    const bodyText = $("body").text();
    const matches = bodyText.match(PHONE_REGEX);
    if (matches) {
      for (const m of matches) {
        const normalised = normalisePhone(m);
        if (normalised && !phoneNumbers.includes(normalised)) {
          phoneNumbers.push(normalised);
        }
      }
    }
  }

  // Classify phone numbers
  for (const num of phoneNumbers) {
    if (num.startsWith("07")) {
      if (!mobile) mobile = num;
    } else {
      if (!phone) phone = num;
    }
  }

  return { phone, mobile, email };
}

/**
 * Normalize a UK phone number: strip spaces, dashes, parentheses.
 * Accept 01/02/03/07/0300 prefixes.
 */
export function normalisePhone(raw: string): string | null {
  const stripped = raw.replace(/[\s\-()]+/g, "");
  // Must start with 0 and be 10-11 digits
  if (/^0[1-37]\d{8,9}$/.test(stripped)) {
    return stripped;
  }
  return null;
}

/**
 * Extract external website link.
 */
/**
 * Check if a hostname belongs to Nuffield or its related domains.
 */
/**
 * Check if a hostname belongs to Nuffield or its related/wrapper domains.
 */
function isNuffieldDomain(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "nuffieldhealth.com" ||
    h.endsWith(".nuffieldhealth.com") ||
    h === "nuffieldhealthcareers.com" ||
    h.endsWith(".nuffieldhealthcareers.com")
  );
}

/**
 * Check if a URL is an email-tracking/safelink wrapper around an internal URL.
 * E.g. Outlook SafeLinks wrapping nuffieldhealth.com links.
 */
function isSafelinkWrapper(href: string): boolean {
  try {
    const url = new URL(href);
    // Outlook SafeLinks
    if (url.hostname.endsWith("safelinks.protection.outlook.com")) {
      const innerUrl = url.searchParams.get("url");
      if (innerUrl) {
        try {
          const inner = new URL(decodeURIComponent(innerUrl));
          if (isNuffieldDomain(inner.hostname)) return true;
        } catch {}
      }
      return true; // SafeLinks are always tracking wrappers, not genuine external sites
    }
    return false;
  } catch {
    return false;
  }
}

function extractExternalWebsite($: cheerio.CheerioAPI): string | null {
  // Look for links that point to external domains
  let externalUrl: string | null = null;

  $("a[href]").each((_i, a) => {
    if (externalUrl) return;
    const href = $(a).attr("href") ?? "";
    // Skip non-http links
    if (
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("#") ||
      href.startsWith("/")
    ) {
      return;
    }
    // Must be a full URL
    if (href.startsWith("http")) {
      // Parse URL to check hostname properly
      try {
        const url = new URL(href);
        // Skip Nuffield domains (including subdomains and nuffieldhealthcareers.com)
        if (isNuffieldDomain(url.hostname)) return;
        // Skip email tracking/safelink wrappers
        if (isSafelinkWrapper(href)) return;

        // Skip social media / generic platforms
        const h = url.hostname.toLowerCase();
        if (
          h.includes("facebook.com") ||
          h.includes("twitter.com") ||
          h.includes("instagram.com") ||
          h.includes("linkedin.com") ||
          h.includes("youtube.com")
        ) {
          return;
        }

        externalUrl = href;
      } catch {
        // Invalid URL, skip
      }
    }
  });

  return externalUrl;
}

/**
 * Extract CQC rating from page.
 * BUG-012: Live pages render CQC as separate DOM elements ("CQC" / "Overall rating" / "Good")
 * which concatenate without colons. Broadened regex handles both formats.
 */
function extractCqcRating($: cheerio.CheerioAPI): string | null {
  const bodyText = $("body").text();
  // Match "CQC rating: Good" or "CQC Overall rating Good" (no colon)
  const cqcMatch = bodyText.match(/CQC\s*(?:Overall\s+)?rating\s*:?\s*(Outstanding|Good|Requires improvement|Inadequate)/i);
  return cqcMatch ? cqcMatch[1] : null;
}

/**
 * Extract hospital information from Locations section.
 */
function extractHospitalInfo(
  $: cheerio.CheerioAPI,
  sections: ClassifiedSection[]
): {
  name: string | null;
  code: string | null;
  isNuffield: boolean;
  nuffieldAtNhs: boolean;
} {
  // Try to get from Locations section
  const locationSection = sections.find(
    (s) => s.category === HeadingCategory.LOCATIONS
  );

  let hospitalName: string | null = null;

  if (locationSection) {
    // First H3 in location section is typically the primary hospital
    const content = getSectionContent($, locationSection.element);
    const firstH3 = content.find("h3").first();
    if (firstH3.length > 0) {
      hospitalName = firstH3.text().trim() || null;
    }
  }

  // Fallback: look for hospital name in page metadata or structured elements
  if (!hospitalName) {
    const hospitalEl = $(".consultant__hospital, .hospital-name, [class*='hospital']").first();
    if (hospitalEl.length > 0) {
      hospitalName = hospitalEl.text().trim() || null;
    }
  }

  // BUG-010: All profiles on nuffieldhealth.com are Nuffield-affiliated by default.
  // Only set false if hospital name contains explicit non-Nuffield indicators.
  const NON_NUFFIELD_INDICATORS = /\b(?:non-?nuffield|independent)\b/i;
  const isNuffield = hospitalName ? !NON_NUFFIELD_INDICATORS.test(hospitalName) : true;
  const nuffieldAtNhs = hospitalName ? NUFFIELD_AT_NHS_REGEX.test(hospitalName) : false;

  // Hospital code extraction from links or data attributes
  let hospitalCode: string | null = null;
  if (locationSection) {
    const content = getSectionContent($, locationSection.element);
    const link = content.find("a[href*='hospitals']").first();
    if (link.length > 0) {
      const href = link.attr("href") ?? "";
      const codeMatch = href.match(/hospitals\/([^/?#]+)/);
      if (codeMatch) hospitalCode = codeMatch[1];
    }
  }

  return { name: hospitalName, code: hospitalCode, isNuffield, nuffieldAtNhs };
}

/**
 * Heuristic bio depth assessment based on text length.
 * Used as fallback when AI assessment is unavailable.
 */
export function heuristicBioDepth(text: string | null): "substantive" | "adequate" | "thin" | "missing" {
  if (!text || text.trim().length === 0) return "missing";
  const len = text.trim().length;
  if (len > 300) return "substantive";
  if (len > 100) return "adequate";
  return "thin";
}

/**
 * Deduplicate an array of strings, preserving order.
 */
function deduplicateArray(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const lower = item.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}
