// Heading variant dictionary and classification system for non-standardized HTML parsing.
// Profiles use inconsistent heading levels (H2/H3/H4) for the same section type.
// Classification matches by text content, not heading level.

export enum HeadingCategory {
  ABOUT = "ABOUT",
  QUALIFICATIONS = "QUALIFICATIONS",
  SPECIALTIES = "SPECIALTIES",
  CONSULTATION_TIMES = "CONSULTATION_TIMES",
  RELATED_EXPERIENCE = "RELATED_EXPERIENCE",
  DECLARATION = "DECLARATION",
  OVERVIEW = "OVERVIEW",
  TREATMENTS = "TREATMENTS",
  SPECIAL_INTERESTS = "SPECIAL_INTERESTS",
  OTHER_INTERESTS = "OTHER_INTERESTS",
  PERSONAL_INTERESTS = "PERSONAL_INTERESTS",
  LANGUAGES = "LANGUAGES",
  RESEARCH = "RESEARCH",
  MEMBERSHIPS = "MEMBERSHIPS",
  OTHER_POSTS = "OTHER_POSTS",
  PROFESSIONAL_ROLES = "PROFESSIONAL_ROLES",
  IN_THE_NEWS = "IN_THE_NEWS",
  PRACTISING_SINCE = "PRACTISING_SINCE",
  INSURERS = "INSURERS",
  LOCATIONS = "LOCATIONS",
  CTA_EXCLUDE = "CTA_EXCLUDE",
}

// Valid heading tag names for content sections
const VALID_HEADING_TAGS = new Set(["h2", "h3", "h4"]);

// Treatment heading partial-match patterns (case-insensitive)
const TREATMENT_PATTERNS: string[] = [
  "treatments and tests offered",
  "treatments, tests and scans",
  "specialises in the following treatments",
  "specialises the following treatments", // typo variant — missing "in"
  "performs the following treatments",
  "specialises in the following cosmetic treatments at", // cosmetic variant with hospital name
];

// CTA patterns to exclude from content parsing
const CTA_PATTERNS: string[] = [
  "book online",
  "ask a question",
  "enquire now",
];

/**
 * Classify a heading element's text content into a HeadingCategory.
 *
 * @param text - The trimmed text content of the heading element
 * @param tagName - The lowercase HTML tag name (e.g. "h2", "h3", "button")
 * @returns The HeadingCategory or null if unrecognized
 */
export function classifyHeading(text: string, tagName: string): HeadingCategory | null {
  const normalised = text.trim();
  const lower = normalised.toLowerCase();
  const tag = tagName.toLowerCase();

  // CTA exclusion — check first since these can appear at any heading level
  for (const pattern of CTA_PATTERNS) {
    if (lower.includes(pattern)) {
      return HeadingCategory.CTA_EXCLUDE;
    }
  }

  // OVERVIEW — only valid when the element is an actual heading tag, not a button/link/span
  if (lower === "overview") {
    if (VALID_HEADING_TAGS.has(tag)) {
      return HeadingCategory.OVERVIEW;
    }
    return null; // reject button/a/span "Overview" elements
  }

  // Exact text matches (case-insensitive)
  if (lower === "about") return HeadingCategory.ABOUT;
  if (lower === "qualifications") return HeadingCategory.QUALIFICATIONS;
  if (lower === "specialties") return HeadingCategory.SPECIALTIES;
  if (lower === "consultation times") return HeadingCategory.CONSULTATION_TIMES;
  if (lower === "related experience") return HeadingCategory.RELATED_EXPERIENCE;
  if (lower === "declaration") return HeadingCategory.DECLARATION;
  if (lower === "special interests") return HeadingCategory.SPECIAL_INTERESTS;
  if (lower === "other interests") return HeadingCategory.OTHER_INTERESTS;
  if (lower === "personal interests") return HeadingCategory.PERSONAL_INTERESTS;
  if (lower === "languages spoken") return HeadingCategory.LANGUAGES;
  if (lower === "research") return HeadingCategory.RESEARCH;
  if (lower === "memberships") return HeadingCategory.MEMBERSHIPS;
  if (lower === "other posts held") return HeadingCategory.OTHER_POSTS;
  if (lower === "professional roles") return HeadingCategory.PROFESSIONAL_ROLES;
  if (lower === "in the news") return HeadingCategory.IN_THE_NEWS;

  // Prefix matches
  if (lower.startsWith("practising since")) return HeadingCategory.PRACTISING_SINCE;
  if (lower.startsWith("insurers")) return HeadingCategory.INSURERS;
  if (lower.startsWith("locations")) return HeadingCategory.LOCATIONS;

  // Treatment partial matches — check if any pattern appears in the heading text
  for (const pattern of TREATMENT_PATTERNS) {
    if (lower.includes(pattern)) {
      return HeadingCategory.TREATMENTS;
    }
  }

  return null;
}

/**
 * Extract the year from a "Practising since" heading text.
 * Handles both "Practising since: 2004" and "Practising since: " (no year).
 *
 * @returns The year as a number, or null if no year found in the text
 */
export function extractPractisingYear(text: string): number | null {
  const match = text.match(/(\d{4})/);
  if (match) {
    const year = parseInt(match[1], 10);
    if (year >= 1950 && year <= 2030) {
      return year;
    }
  }
  return null;
}
