import { describe, it, expect } from "vitest";
import { parseProfile, normalisePhone, heuristicBioDepth } from "./parse";
import { classifyHeading, HeadingCategory, extractPractisingYear } from "./headings";

// ── Heading classification tests ──────────────────────────────────────────────

describe("classifyHeading", () => {
  it("classifies exact match headings case-insensitively", () => {
    expect(classifyHeading("About", "h2")).toBe(HeadingCategory.ABOUT);
    expect(classifyHeading("about", "h3")).toBe(HeadingCategory.ABOUT);
    expect(classifyHeading("Qualifications", "h2")).toBe(HeadingCategory.QUALIFICATIONS);
    expect(classifyHeading("Specialties", "h2")).toBe(HeadingCategory.SPECIALTIES);
    expect(classifyHeading("Consultation times", "h2")).toBe(HeadingCategory.CONSULTATION_TIMES);
    expect(classifyHeading("Related experience", "h2")).toBe(HeadingCategory.RELATED_EXPERIENCE);
    expect(classifyHeading("Declaration", "h2")).toBe(HeadingCategory.DECLARATION);
    expect(classifyHeading("Special interests", "h3")).toBe(HeadingCategory.SPECIAL_INTERESTS);
    expect(classifyHeading("Other interests", "h2")).toBe(HeadingCategory.OTHER_INTERESTS);
    expect(classifyHeading("Personal interests", "h3")).toBe(HeadingCategory.PERSONAL_INTERESTS);
    expect(classifyHeading("Languages spoken", "h3")).toBe(HeadingCategory.LANGUAGES);
    expect(classifyHeading("Research", "h3")).toBe(HeadingCategory.RESEARCH);
    expect(classifyHeading("Memberships", "h2")).toBe(HeadingCategory.MEMBERSHIPS);
    expect(classifyHeading("Other posts held", "h3")).toBe(HeadingCategory.OTHER_POSTS);
    expect(classifyHeading("Professional Roles", "h2")).toBe(HeadingCategory.PROFESSIONAL_ROLES);
    expect(classifyHeading("In the news", "h3")).toBe(HeadingCategory.IN_THE_NEWS);
  });

  it("classifies prefix-match headings", () => {
    expect(classifyHeading("Practising since: 2004", "h2")).toBe(HeadingCategory.PRACTISING_SINCE);
    expect(classifyHeading("Practising since", "h2")).toBe(HeadingCategory.PRACTISING_SINCE);
    expect(classifyHeading("Insurers Mr Smith works with", "h2")).toBe(HeadingCategory.INSURERS);
    expect(classifyHeading("Locations Dr Jones works with", "h2")).toBe(HeadingCategory.LOCATIONS);
  });

  it("classifies treatment heading variants with partial match", () => {
    expect(classifyHeading("Treatments and tests offered", "h2")).toBe(HeadingCategory.TREATMENTS);
    expect(classifyHeading("Treatments, tests and scans", "h2")).toBe(HeadingCategory.TREATMENTS);
    expect(
      classifyHeading("Mr Smith specialises in the following treatments", "h2")
    ).toBe(HeadingCategory.TREATMENTS);
    expect(
      classifyHeading("Dr Jones specialises the following treatments", "h3")
    ).toBe(HeadingCategory.TREATMENTS);
    expect(
      classifyHeading("Mr Lee performs the following treatments", "h2")
    ).toBe(HeadingCategory.TREATMENTS);
    expect(
      classifyHeading(
        "Ms Tzafetta specialises in the following cosmetic treatments at Nuffield Health Brentwood Hospital",
        "h3"
      )
    ).toBe(HeadingCategory.TREATMENTS);
  });

  it("disambiguates Overview: h2 accepted, button/span/a rejected", () => {
    expect(classifyHeading("Overview", "h2")).toBe(HeadingCategory.OVERVIEW);
    expect(classifyHeading("Overview", "h3")).toBe(HeadingCategory.OVERVIEW);
    expect(classifyHeading("Overview", "h4")).toBe(HeadingCategory.OVERVIEW);
    expect(classifyHeading("Overview", "button")).toBeNull();
    expect(classifyHeading("Overview", "a")).toBeNull();
    expect(classifyHeading("Overview", "span")).toBeNull();
  });

  it("classifies CTA headings for exclusion", () => {
    expect(classifyHeading("Book online Ask a question", "h2")).toBe(
      HeadingCategory.CTA_EXCLUDE
    );
    expect(classifyHeading("Book online", "h2")).toBe(HeadingCategory.CTA_EXCLUDE);
    expect(classifyHeading("Ask a question", "h2")).toBe(HeadingCategory.CTA_EXCLUDE);
    expect(classifyHeading("Enquire now", "h2")).toBe(HeadingCategory.CTA_EXCLUDE);
  });

  it("returns null for unknown headings", () => {
    expect(classifyHeading("Random Section", "h2")).toBeNull();
    expect(classifyHeading("Contact Us", "h2")).toBeNull();
    expect(classifyHeading("", "h2")).toBeNull();
  });

  it("handles heading levels H2, H3, H4 uniformly for text-matched sections", () => {
    expect(classifyHeading("Memberships", "h2")).toBe(HeadingCategory.MEMBERSHIPS);
    expect(classifyHeading("Memberships", "h3")).toBe(HeadingCategory.MEMBERSHIPS);
    expect(classifyHeading("Memberships", "h4")).toBe(HeadingCategory.MEMBERSHIPS);
  });
});

describe("extractPractisingYear", () => {
  it("extracts year from heading text", () => {
    expect(extractPractisingYear("Practising since: 2004")).toBe(2004);
    expect(extractPractisingYear("Practising since: 1998")).toBe(1998);
  });

  it("returns null when no year found", () => {
    expect(extractPractisingYear("Practising since")).toBeNull();
    expect(extractPractisingYear("")).toBeNull();
  });

  it("rejects unreasonable years", () => {
    expect(extractPractisingYear("Practising since: 1800")).toBeNull();
    expect(extractPractisingYear("Practising since: 2050")).toBeNull();
  });
});

// ── Phone normalisation tests ─────────────────────────────────────────────────

describe("normalisePhone", () => {
  it("strips spaces from phone numbers", () => {
    expect(normalisePhone("020 7394 3300")).toBe("02073943300");
    expect(normalisePhone("0300 131 1433")).toBe("03001311433");
  });

  it("handles numbers without spaces", () => {
    expect(normalisePhone("02073943300")).toBe("02073943300");
  });

  it("accepts 01, 02, 03, 07 prefixes", () => {
    expect(normalisePhone("01onal number")).toBeNull(); // not a valid phone
    expect(normalisePhone("01onal")).toBeNull();
    expect(normalisePhone("01onal number is")).toBeNull();
    expect(normalisePhone("01onal")).toBeNull();
    expect(normalisePhone("01onal")).toBeNull();
    expect(normalisePhone("01onal")).toBeNull();
  });

  it("handles mobile numbers (07 prefix)", () => {
    expect(normalisePhone("07949 483 300")).toBe("07949483300");
    expect(normalisePhone("07949483300")).toBe("07949483300");
  });

  it("rejects invalid phone numbers", () => {
    expect(normalisePhone("abc")).toBeNull();
    expect(normalisePhone("12345")).toBeNull();
    expect(normalisePhone("")).toBeNull();
  });
});

// ── HTML Profile Parsing tests ────────────────────────────────────────────────

// Helper to build minimal profile HTML
function buildProfileHTML(overrides: {
  h1?: string;
  gmcNumber?: string;
  photo?: boolean;
  headingSections?: Array<{ tag: string; text: string; content: string }>;
  bookingIframe?: boolean;
  ageRestriction?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  itemPropPhone?: string;
  externalLink?: string;
  cqcRating?: string;
  hospitalName?: string;
  cmsCorruption?: boolean;
}): string {
  const sections = overrides.headingSections ?? [];
  const sectionsHtml = sections
    .map(
      (s) => `<${s.tag}>${s.text}</${s.tag}>\n${s.content}`
    )
    .join("\n");

  const photoHtml = overrides.photo !== false
    ? `<aside class="consultant__image"><img src="https://images.nuffieldhealth.com/consultant/photo.jpg" /></aside>`
    : "";

  const gmcHtml = overrides.gmcNumber
    ? `<p>GMC number: ${overrides.gmcNumber}</p>`
    : "";

  const bookingHtml = overrides.bookingIframe
    ? `<iframe src="https://booking.nuffieldhealth.com/widget"></iframe>`
    : "";

  const ageHtml = overrides.ageRestriction
    ? `<p>${overrides.ageRestriction}</p>`
    : "";

  const emailHtml = overrides.email
    ? `<a href="mailto:${overrides.email}">${overrides.email}</a>`
    : "";

  const phoneHtml = overrides.phone
    ? `<a href="tel:${overrides.phone}">${overrides.phone}</a>`
    : "";

  const mobileHtml = overrides.mobile
    ? `<a href="tel:${overrides.mobile}">${overrides.mobile}</a>`
    : "";

  const externalLinkHtml = overrides.externalLink
    ? `<a href="${overrides.externalLink}">External site</a>`
    : "";

  const cqcHtml = overrides.cqcRating
    ? `<p>CQC rating: ${overrides.cqcRating}</p>`
    : "";

  const hospitalHtml = overrides.hospitalName
    ? `<div class="consultant__hospital">${overrides.hospitalName}</div>`
    : "";

  const corruptionHtml = overrides.cmsCorruption
    ? `<p>The consultant s****ees adults and children.</p>`
    : "";

  const itemPropPhoneHtml = overrides.itemPropPhone
    ? `<span class="cta-call__text" itemprop="telephone">${overrides.itemPropPhone}</span>`
    : "";

  return `
    <!DOCTYPE html>
    <html>
    <head><title>Test Profile</title></head>
    <body>
      <h1>${overrides.h1 ?? "Mr John Smith"}</h1>
      ${photoHtml}
      ${gmcHtml}
      ${hospitalHtml}
      ${itemPropPhoneHtml}
      ${sectionsHtml}
      ${bookingHtml}
      ${ageHtml}
      ${emailHtml}
      ${phoneHtml}
      ${mobileHtml}
      ${externalLinkHtml}
      ${cqcHtml}
      ${corruptionHtml}
    </body>
    </html>
  `;
}

describe("parseProfile — name extraction", () => {
  it("extracts Mr title prefix", () => {
    const html = buildProfileHTML({ h1: "Mr John Smith" });
    const result = parseProfile(html, "mr-john-smith");
    expect(result.consultant_name).toBe("Mr John Smith");
    expect(result.consultant_title_prefix).toBe("Mr");
  });

  it("extracts Mrs title prefix", () => {
    const html = buildProfileHTML({ h1: "Mrs Jane Smith" });
    const result = parseProfile(html, "mrs-jane-smith");
    expect(result.consultant_title_prefix).toBe("Mrs");
  });

  it("extracts Ms title prefix", () => {
    const html = buildProfileHTML({ h1: "Ms Kallirroi Tzafetta" });
    const result = parseProfile(html, "ms-kallirroi-tzafetta");
    expect(result.consultant_title_prefix).toBe("Ms");
  });

  it("extracts Miss title prefix", () => {
    const html = buildProfileHTML({ h1: "Miss Caroline Cheadle" });
    const result = parseProfile(html, "miss-caroline-cheadle");
    expect(result.consultant_title_prefix).toBe("Miss");
  });

  it("extracts Dr title prefix", () => {
    const html = buildProfileHTML({ h1: "Dr Rebecca Harris" });
    const result = parseProfile(html, "dr-rebecca-harris");
    expect(result.consultant_title_prefix).toBe("Dr");
  });

  it("extracts Professor title prefix", () => {
    const html = buildProfileHTML({ h1: "Professor Christof Kastner" });
    const result = parseProfile(html, "professor-christof-kastner");
    expect(result.consultant_title_prefix).toBe("Professor");
  });

  it("handles middle initials in name", () => {
    const html = buildProfileHTML({ h1: "Mr Jonathan A. Clamp" });
    const result = parseProfile(html, "mr-jonathan-clamp");
    expect(result.consultant_name).toBe("Mr Jonathan A. Clamp");
    expect(result.consultant_title_prefix).toBe("Mr");
  });

  it("returns null for missing H1", () => {
    const html = `<html><body><p>No heading here</p></body></html>`;
    const result = parseProfile(html, "test-slug");
    expect(result.consultant_name).toBeNull();
  });
});

describe("parseProfile — registration number", () => {
  it("extracts numeric GMC number", () => {
    const html = buildProfileHTML({ gmcNumber: "3556456" });
    const result = parseProfile(html, "test");
    expect(result.registration_number).toBe("3556456");
    expect(result.gmc_code_for_booking).toBe("3556456");
  });

  it("extracts non-numeric registration number", () => {
    const html = buildProfileHTML({ gmcNumber: "HCPC-OR05785" });
    const result = parseProfile(html, "test");
    expect(result.registration_number).toBe("HCPC-OR05785");
    expect(result.gmc_code_for_booking).toBeNull();
  });

  it("extracts alphanumeric registration number", () => {
    const html = buildProfileHTML({ gmcNumber: "PYL17432" });
    const result = parseProfile(html, "test");
    expect(result.registration_number).toBe("PYL17432");
    expect(result.gmc_code_for_booking).toBeNull();
  });

  it("returns null when no GMC number present", () => {
    const html = buildProfileHTML({});
    const result = parseProfile(html, "test");
    expect(result.registration_number).toBeNull();
    expect(result.gmc_code_for_booking).toBeNull();
  });
});

describe("parseProfile — photo detection", () => {
  it("detects photo when aside.consultant__image has valid img src", () => {
    const html = buildProfileHTML({ photo: true });
    const result = parseProfile(html, "test");
    expect(result.has_photo).toBe(true);
  });

  it("returns false when no aside.consultant__image", () => {
    const html = buildProfileHTML({ photo: false });
    const result = parseProfile(html, "test");
    expect(result.has_photo).toBe(false);
  });

  it("returns false when img has no src", () => {
    const html = `<html><body>
      <h1>Mr Test</h1>
      <aside class="consultant__image"><img /></aside>
    </body></html>`;
    const result = parseProfile(html, "test");
    expect(result.has_photo).toBe(false);
  });
});

describe("parseProfile — missing sections produce null/[]", () => {
  it("returns empty arrays and nulls for minimal profile", () => {
    const html = buildProfileHTML({
      headingSections: [],
    });
    const result = parseProfile(html, "test");

    expect(result.specialty_primary).toEqual([]);
    expect(result.specialty_sub).toEqual([]);
    expect(result.treatments).toEqual([]);
    expect(result.treatments_excluded).toEqual([]);
    expect(result.insurers).toEqual([]);
    expect(result.insurer_count).toBe(0);
    expect(result.memberships).toEqual([]);
    expect(result.clinical_interests).toEqual([]);
    expect(result.languages).toEqual([]);
    expect(result.consultation_times_raw).toEqual([]);
    expect(result.declaration).toBeNull();
    expect(result.in_the_news).toBeNull();
    expect(result.professional_roles).toBeNull();
    expect(result.practising_since).toBeNull();
    expect(result.qualifications_credentials).toBeNull();
    expect(result.personal_interests).toBeNull();
    expect(result.about_text).toBeNull();
    expect(result.related_experience_text).toBeNull();
    expect(result.overview_text).toBeNull();
  });
});

describe("parseProfile — CTA heading exclusion", () => {
  it("excludes Book online Ask a question from content parsing", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h2",
          text: "Book online Ask a question",
          content: "<p>Some CTA content</p>",
        },
        {
          tag: "h2",
          text: "About",
          content: "<p>Real about text here.</p>",
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.about_text).toBe("Real about text here.");
    // CTA content should not appear in any field
  });
});

describe("parseProfile — Overview disambiguation", () => {
  it("extracts Overview from h2 element", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h2",
          text: "Overview",
          content: "<p>This is the overview text.</p>",
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.overview_text).toBe("This is the overview text.");
  });

  it("ignores Overview from button element", () => {
    // Buttons won't be picked up by the h2/h3/h4 selector anyway, but verify
    const html = `<html><body>
      <h1>Mr Test</h1>
      <button>Overview</button>
      <p>This is not overview content.</p>
    </body></html>`;
    const result = parseProfile(html, "test");
    expect(result.overview_text).toBeNull();
  });
});

describe("parseProfile — Practising since", () => {
  it("extracts year embedded in heading text", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h2",
          text: "Practising since: 2004",
          content: "",
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.practising_since).toBe(2004);
  });

  it("extracts year from inline element after heading", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h2",
          text: "Practising since",
          content: "<p>1998</p>",
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.practising_since).toBe(1998);
  });

  it("returns null when no practising since heading", () => {
    const html = buildProfileHTML({ headingSections: [] });
    const result = parseProfile(html, "test");
    expect(result.practising_since).toBeNull();
  });
});

describe("parseProfile — Treatment heading variants", () => {
  it("extracts treatments from standard H2", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h2",
          text: "Treatments and tests offered",
          content: "<ul><li>Hip replacement</li><li>Knee surgery</li></ul>",
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.treatments).toEqual(["Hip replacement", "Knee surgery"]);
  });

  it("extracts from cosmetic treatment variant with hospital name", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h3",
          text: "Ms Tzafetta specialises in the following cosmetic treatments at Nuffield Health Brentwood Hospital",
          content: "<ul><li>Botox</li><li>Fillers</li></ul>",
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.treatments).toEqual(["Botox", "Fillers"]);
  });

  it("merges treatments from multiple heading variants", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h2",
          text: "Treatments and tests offered",
          content: "<ul><li>Treatment A</li></ul>",
        },
        {
          tag: "h3",
          text: "Mr Smith specialises in the following treatments",
          content: "<ul><li>Treatment B</li></ul>",
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.treatments).toContain("Treatment A");
    expect(result.treatments).toContain("Treatment B");
  });

  it("handles typo variant (missing 'in')", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h2",
          text: "Dr Jones specialises the following treatments",
          content: "<ul><li>Endoscopy</li></ul>",
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.treatments).toEqual(["Endoscopy"]);
  });
});

describe("parseProfile — CMS text corruption detection", () => {
  it("detects asterisk-broken words", () => {
    const html = buildProfileHTML({ cmsCorruption: true });
    const result = parseProfile(html, "test");
    expect(result.cms_corruption_detected).toBe(true);
  });

  it("no corruption in clean text", () => {
    const html = buildProfileHTML({ cmsCorruption: false });
    const result = parseProfile(html, "test");
    expect(result.cms_corruption_detected).toBe(false);
  });
});

describe("parseProfile — Age restriction", () => {
  it("detects 'only sees adults'", () => {
    const html = buildProfileHTML({ ageRestriction: "This consultant only sees adults" });
    const result = parseProfile(html, "test");
    expect(result.patient_age_restriction).toContain("only sees adults");
    expect(result.patient_age_restriction_min).toBe(18);
    expect(result.patient_age_restriction_max).toBeNull();
  });

  it("detects age range (0-18 paediatric)", () => {
    const html = buildProfileHTML({
      ageRestriction: "sees patients from the ages of 0 to 18",
    });
    const result = parseProfile(html, "test");
    expect(result.patient_age_restriction_min).toBe(0);
    expect(result.patient_age_restriction_max).toBe(18);
  });

  it("returns null when no age restriction", () => {
    const html = buildProfileHTML({});
    const result = parseProfile(html, "test");
    expect(result.patient_age_restriction).toBeNull();
    expect(result.patient_age_restriction_min).toBeNull();
    expect(result.patient_age_restriction_max).toBeNull();
  });
});

describe("parseProfile — Contact info", () => {
  it("extracts email from mailto link", () => {
    const html = buildProfileHTML({ email: "secretary@hospital.com" });
    const result = parseProfile(html, "test");
    expect(result.contact_email).toBe("secretary@hospital.com");
  });

  it("extracts phone from tel link", () => {
    const html = buildProfileHTML({ phone: "02073943300" });
    const result = parseProfile(html, "test");
    expect(result.contact_phone).toBe("02073943300");
  });

  it("extracts mobile separately from landline", () => {
    const html = buildProfileHTML({
      phone: "02073943300",
      mobile: "07949483300",
    });
    const result = parseProfile(html, "test");
    expect(result.contact_phone).toBe("02073943300");
    expect(result.contact_mobile).toBe("07949483300");
  });

  // BUG-013: Prefer itemprop="telephone" over tel: links
  it("prefers itemprop phone over tel: link (BUG-013)", () => {
    const html = buildProfileHTML({
      itemPropPhone: "01782 432227",
      phone: "01133227251",
    });
    const result = parseProfile(html, "test");
    expect(result.contact_phone).toBe("01782432227");
  });

  it("extracts itemprop phone when no tel: link exists (BUG-013)", () => {
    const html = buildProfileHTML({
      itemPropPhone: "020 8341 4182",
    });
    const result = parseProfile(html, "test");
    expect(result.contact_phone).toBe("02083414182");
  });

  it("falls back to tel: link when itemprop is empty (BUG-013)", () => {
    const html = `
      <!DOCTYPE html><html><head><title>Test</title></head><body>
        <h1>Dr Test Person</h1>
        <span itemprop="telephone"></span>
        <a href="tel:01892 531111">01892 531111</a>
      </body></html>
    `;
    const result = parseProfile(html, "test");
    expect(result.contact_phone).toBe("01892531111");
  });

  it("falls back to body text for London 020 numbers (BUG-014)", () => {
    const html = `
      <!DOCTYPE html><html><head><title>Test</title></head><body>
        <h1>Prof Test Person</h1>
        <span>Or call us on 020 8341 4182</span>
      </body></html>
    `;
    const result = parseProfile(html, "test");
    expect(result.contact_phone).toBe("02083414182");
  });
});

describe("parseProfile — Booking state", () => {
  it("detects booking iframe as bookable", () => {
    const html = buildProfileHTML({ bookingIframe: true });
    const result = parseProfile(html, "test");
    expect(result.booking_state).toBe("bookable_no_slots");
  });

  it("detects no iframe as not_bookable", () => {
    const html = buildProfileHTML({ bookingIframe: false });
    const result = parseProfile(html, "test");
    expect(result.booking_state).toBe("not_bookable");
  });
});

describe("parseProfile — Declaration", () => {
  it("extracts declaration paragraphs", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h2",
          text: "Declaration",
          content: "<p>I own shares in a medical equipment company.</p>",
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.declaration).toEqual([
      "I own shares in a medical equipment company.",
    ]);
    expect(result.declaration_substantive).toBe(true);
  });

  it("identifies boilerplate declaration as non-substantive", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h2",
          text: "Declaration",
          content: "<p>This consultant has no interests to declare.</p>",
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.declaration_substantive).toBe(false);
  });

  it("returns null declaration when section missing", () => {
    const html = buildProfileHTML({ headingSections: [] });
    const result = parseProfile(html, "test");
    expect(result.declaration).toBeNull();
    expect(result.declaration_substantive).toBeNull();
  });
});

describe("parseProfile — Hospital info", () => {
  it("detects Nuffield hospital", () => {
    const html = buildProfileHTML({
      hospitalName: "Nuffield Health Cambridge Hospital",
    });
    const result = parseProfile(html, "test");
    expect(result.hospital_is_nuffield).toBe(true);
    expect(result.hospital_nuffield_at_nhs).toBe(false);
  });

  it("detects Nuffield at NHS pattern", () => {
    const html = buildProfileHTML({
      hospitalName: "Nuffield Health at St Bartholomew's Hospital",
    });
    const result = parseProfile(html, "test");
    expect(result.hospital_is_nuffield).toBe(true);
    expect(result.hospital_nuffield_at_nhs).toBe(true);
  });

  it("defaults to true for hospitals without explicit non-Nuffield indicator (BUG-010)", () => {
    // All profiles on nuffieldhealth.com are Nuffield-affiliated by default
    const html = buildProfileHTML({
      hospitalName: "Royal Surrey County Hospital",
    });
    const result = parseProfile(html, "test");
    expect(result.hospital_is_nuffield).toBe(true);
    expect(result.hospital_nuffield_at_nhs).toBe(false);
  });

  it("detects explicit non-Nuffield indicator", () => {
    const html = buildProfileHTML({
      hospitalName: "Independent Clinic London",
    });
    const result = parseProfile(html, "test");
    expect(result.hospital_is_nuffield).toBe(false);
  });
});

describe("parseProfile — CQC rating", () => {
  it("extracts CQC rating", () => {
    const html = buildProfileHTML({ cqcRating: "Outstanding" });
    const result = parseProfile(html, "test");
    expect(result.cqc_rating).toBe("Outstanding");
  });

  it("returns null when no CQC rating (Wales/Scotland)", () => {
    const html = buildProfileHTML({});
    const result = parseProfile(html, "test");
    expect(result.cqc_rating).toBeNull();
  });
});

describe("parseProfile — External website", () => {
  it("extracts external website link", () => {
    const html = buildProfileHTML({ externalLink: "https://www.exeterheart.com" });
    const result = parseProfile(html, "test");
    expect(result.external_website).toBe("https://www.exeterheart.com");
  });

  it("returns null when no external link", () => {
    const html = buildProfileHTML({});
    const result = parseProfile(html, "test");
    expect(result.external_website).toBeNull();
  });
});

describe("parseProfile — Insurers", () => {
  it("extracts large insurer lists (36+ items)", () => {
    const insurerItems = Array.from(
      { length: 36 },
      (_, i) => `<li>Insurer ${i + 1}</li>`
    ).join("");

    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h2",
          text: "Insurers Mr Smith works with",
          content: `<ul>${insurerItems}</ul>`,
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.insurers.length).toBe(36);
    expect(result.insurer_count).toBe(36);
  });
});

describe("parseProfile — Confidence tracking", () => {
  it("returns confidence object with all fields", () => {
    const html = buildProfileHTML({
      gmcNumber: "1234567",
    });
    const result = parseProfile(html, "test");
    expect(result.confidence).toBeDefined();
    expect(result.confidence.consultant_name).toBe("high");
    expect(result.confidence.registration_number).toBe("high");
    expect(result.confidence.has_photo).toBe("high");
    expect(result.confidence.booking_state).toBe("high");
  });
});

// ── Full profile simulation ───────────────────────────────────────────────────

describe("parseProfile — Full profile with 15 headings", () => {
  it("parses a rich profile with all sections", () => {
    const html = buildProfileHTML({
      h1: "Mr Christopher Foxton",
      gmcNumber: "6128231",
      photo: true,
      bookingIframe: true,
      cqcRating: "Good",
      hospitalName: "Nuffield Health Cheltenham Hospital",
      headingSections: [
        {
          tag: "h2",
          text: "Overview",
          content: "<p>Mr Foxton is an experienced surgeon.</p>",
        },
        {
          tag: "h2",
          text: "About",
          content: "<p>Mr Foxton has been practising for over 20 years.</p>",
        },
        {
          tag: "h2",
          text: "Qualifications",
          content: "<p>MBBS, FRCS</p>",
        },
        {
          tag: "h2",
          text: "Specialties",
          content: "<ul><li>General Surgery</li><li>Vascular Surgery</li></ul>",
        },
        {
          tag: "h2",
          text: "Treatments and tests offered",
          content:
            "<ul><li>Varicose veins</li><li>Hernia repair</li><li>Gallbladder removal</li></ul>",
        },
        {
          tag: "h2",
          text: "Consultation times",
          content: "<ul><li>Monday 9am-5pm</li><li>Wednesday 2pm-6pm</li></ul>",
        },
        {
          tag: "h2",
          text: "Declaration",
          content: "<p>This consultant has no interests to declare.</p>",
        },
        {
          tag: "h2",
          text: "Insurers Mr Foxton works with",
          content:
            "<ul><li>Bupa</li><li>AXA Health</li><li>Aviva</li></ul>",
        },
        {
          tag: "h2",
          text: "Practising since: 2003",
          content: "",
        },
        {
          tag: "h2",
          text: "Special interests",
          content: "<ul><li>Minimally invasive surgery</li></ul>",
        },
        {
          tag: "h2",
          text: "Languages spoken",
          content: "<ul><li>English</li><li>French</li></ul>",
        },
        {
          tag: "h2",
          text: "Research",
          content: "<p>Published 30+ papers on vascular surgery.</p>",
        },
        {
          tag: "h2",
          text: "Memberships",
          content: "<ul><li>Royal College of Surgeons</li><li>British Medical Association</li></ul>",
        },
        {
          tag: "h2",
          text: "Other posts held",
          content: "<p>Senior lecturer at University of Bristol</p>",
        },
        {
          tag: "h2",
          text: "Locations Mr Foxton works with",
          content: '<h3>Nuffield Health Cheltenham Hospital</h3><p>Hospital details</p>',
        },
      ],
    });

    const result = parseProfile(html, "mr-christopher-foxton");

    expect(result.consultant_name).toBe("Mr Christopher Foxton");
    expect(result.consultant_title_prefix).toBe("Mr");
    expect(result.registration_number).toBe("6128231");
    expect(result.gmc_code_for_booking).toBe("6128231");
    expect(result.has_photo).toBe(true);
    expect(result.specialty_primary).toEqual(["General Surgery", "Vascular Surgery"]);
    expect(result.treatments).toContain("Varicose veins");
    expect(result.treatments).toContain("Hernia repair");
    expect(result.treatments).toContain("Gallbladder removal");
    expect(result.consultation_times_raw).toEqual([
      "Monday 9am-5pm",
      "Wednesday 2pm-6pm",
    ]);
    expect(result.declaration).toEqual([
      "This consultant has no interests to declare.",
    ]);
    expect(result.declaration_substantive).toBe(false);
    expect(result.insurers).toEqual(["Bupa", "AXA Health", "Aviva"]);
    expect(result.insurer_count).toBe(3);
    expect(result.practising_since).toBe(2003);
    expect(result.clinical_interests).toEqual(["Minimally invasive surgery"]);
    expect(result.languages).toEqual(["English", "French"]);
    expect(result.memberships).toEqual([
      "Royal College of Surgeons",
      "British Medical Association",
    ]);
    expect(result.booking_state).toBe("bookable_no_slots");
    expect(result.overview_text).toBe("Mr Foxton is an experienced surgeon.");
    expect(result.about_text).toBe(
      "Mr Foxton has been practising for over 20 years."
    );
    expect(result.qualifications_credentials).toBe("MBBS, FRCS");
    expect(result.cqc_rating).toBe("Good");
    expect(result.hospital_is_nuffield).toBe(true);
    expect(result.hospital_nuffield_at_nhs).toBe(false);
  });
});

describe("parseProfile — Sparse profile with only 5 headings", () => {
  it("handles minimal profile without errors", () => {
    const html = buildProfileHTML({
      h1: "Dr Emma McGrath",
      gmcNumber: "6117467",
      photo: true,
      bookingIframe: true,
      headingSections: [
        {
          tag: "h2",
          text: "Qualifications",
          content: "<p>MBChB, MRCGP</p>",
        },
        {
          tag: "h2",
          text: "Specialties",
          content: "<ul><li>General Practice</li></ul>",
        },
        {
          tag: "h2",
          text: "Overview",
          content: "<p>Dr McGrath is a GP.</p>",
        },
        {
          tag: "h2",
          text: "About",
          content: "<p>Dr McGrath works in the community.</p>",
        },
        {
          tag: "h2",
          text: "Locations Dr McGrath works with",
          content: "<h3>Nuffield Health Leeds Hospital</h3>",
        },
      ],
    });

    const result = parseProfile(html, "dr-emma-mcgrath");

    expect(result.consultant_name).toBe("Dr Emma McGrath");
    expect(result.consultant_title_prefix).toBe("Dr");
    expect(result.registration_number).toBe("6117467");
    expect(result.has_photo).toBe(true);
    expect(result.specialty_primary).toEqual(["General Practice"]);
    expect(result.treatments).toEqual([]);
    expect(result.insurers).toEqual([]);
    expect(result.insurer_count).toBe(0);
    expect(result.declaration).toBeNull();
    expect(result.consultation_times_raw).toEqual([]);
    expect(result.practising_since).toBeNull();
    expect(result.memberships).toEqual([]);
    expect(result.languages).toEqual([]);
    expect(result.clinical_interests).toEqual([]);
    expect(result.overview_text).toBe("Dr McGrath is a GP.");
  });
});

describe("parseProfile — record shape consistency", () => {
  it("all fields are present on every result, never undefined", () => {
    const html = buildProfileHTML({});
    const result = parseProfile(html, "test");

    // Check no field is undefined
    for (const [key, value] of Object.entries(result)) {
      expect(value).not.toBe(undefined);
      // Should be string, number, boolean, null, or array — never undefined
      if (value === null) continue;
      expect(
        typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean" ||
          Array.isArray(value) ||
          typeof value === "object"
      ).toBe(true);
    }
  });
});

describe("parseProfile — Deduplication", () => {
  it("deduplicates treatments across sections", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h2",
          text: "Treatments and tests offered",
          content: "<ul><li>Hip replacement</li><li>Knee surgery</li></ul>",
        },
        {
          tag: "h3",
          text: "Mr Smith performs the following treatments",
          content: "<ul><li>Hip replacement</li><li>Shoulder repair</li></ul>",
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.treatments).toEqual([
      "Hip replacement",
      "Knee surgery",
      "Shoulder repair",
    ]);
  });
});

describe("parseProfile — In the news", () => {
  it("extracts news items with title and URL", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h3",
          text: "In the news",
          content:
            '<ul><li><a href="https://bbc.co.uk/article1">BBC Health Feature</a></li></ul>',
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.in_the_news).toEqual([
      { title: "BBC Health Feature", url: "https://bbc.co.uk/article1" },
    ]);
  });

  it("returns null when no news section", () => {
    const html = buildProfileHTML({});
    const result = parseProfile(html, "test");
    expect(result.in_the_news).toBeNull();
  });
});

describe("parseProfile — Professional roles", () => {
  it("extracts professional roles text", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h2",
          text: "Professional Roles",
          content: "<p>Clinical Director of Surgery at NHS Trust</p>",
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.professional_roles).toBe(
      "Clinical Director of Surgery at NHS Trust"
    );
  });
});

describe("parseProfile — Specialty sub-items", () => {
  it("extracts H3 sub-specialties under Specialties H2", () => {
    const html = `<html><body>
      <h1>Mr Test Surgeon</h1>
      <h2>Specialties</h2>
      <ul><li>Surgery</li></ul>
      <h3>General Surgery</h3>
      <ul><li>Appendectomy</li></ul>
      <h2>About</h2>
      <p>Some text</p>
    </body></html>`;
    const result = parseProfile(html, "test");
    expect(result.specialty_primary).toContain("Surgery");
    expect(result.specialty_sub).toContain("General Surgery");
  });
});

// ── Bug fix tests (Live Scrape Round 1) ───────────────────────────────────────

describe("BUG-001: Cookie banner H1 skipping", () => {
  it("skips cookie banner H1 and finds real consultant name", () => {
    const html = `<html><body>
      <div id="ccc"><h1>Your choice regarding cookies</h1></div>
      <h1>Professor Stephen McDonnell</h1>
    </body></html>`;
    const result = parseProfile(html, "professor-stephen-mcdonnell");
    expect(result.consultant_name).toBe("Professor Stephen McDonnell");
    expect(result.consultant_title_prefix).toBe("Professor");
  });

  it("uses itemprop=name H1 when available", () => {
    const html = `<html><body>
      <div id="ccc"><h1>Your choice regarding cookies</h1></div>
      <h1 itemprop="name">Dr Jane Smith</h1>
    </body></html>`;
    const result = parseProfile(html, "dr-jane-smith");
    expect(result.consultant_name).toBe("Dr Jane Smith");
  });

  it("uses swiftype meta fallback", () => {
    const html = `<html><head>
      <meta class="swiftype" name="fullname" content="Mr Adam Brown" />
    </head><body>
      <div id="ccc"><h1>Cookie preferences</h1></div>
    </body></html>`;
    const result = parseProfile(html, "mr-adam-brown");
    expect(result.consultant_name).toBe("Mr Adam Brown");
  });
});

describe("BUG-002: Specialty label prefix stripping", () => {
  it("strips Sub-specialties: label prefix from paragraph fallback", () => {
    const html = `<html><body>
      <h1>Mr Test</h1>
      <h2>Specialties</h2>
      <ul><li>Orthopaedics</li></ul>
      <p>Sub-specialties: Hip, Knee, Shoulder</p>
      <h2>About</h2>
      <p>Text</p>
    </body></html>`;
    const result = parseProfile(html, "test");
    expect(result.specialty_sub).toContain("Hip");
    expect(result.specialty_sub).toContain("Knee");
    expect(result.specialty_sub).toContain("Shoulder");
    // Should NOT contain the "Sub-specialties:" label
    for (const item of result.specialty_sub) {
      expect(item).not.toMatch(/^sub-specialties/i);
    }
  });

  it("strips Specialties: label from paragraph text in list extraction", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h2",
          text: "Specialties",
          content: "<p>Specialties: Cardiology, Neurology</p>",
        },
      ],
    });
    const result = parseProfile(html, "test");
    // The label should be stripped, leaving clean items
    expect(result.specialty_primary).not.toContain("Specialties: Cardiology, Neurology");
  });
});

describe("BUG-003: Hospital name .filter→.find fix", () => {
  it("extracts hospital name from H3 inside location section content div", () => {
    const html = `<html><body>
      <h1>Mr Test Surgeon</h1>
      <h2>Locations Mr Test works with</h2>
      <div><h3>Nuffield Health Cambridge Hospital</h3><p>Hospital details</p></div>
      <h2>About</h2>
      <p>About text</p>
    </body></html>`;
    const result = parseProfile(html, "test");
    expect(result.hospital_name_primary).toBe("Nuffield Health Cambridge Hospital");
  });
});

describe("BUG-004: Practising since from paragraph", () => {
  it("extracts practising year from paragraph inside Qualifications section", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h2",
          text: "Qualifications",
          content: "<p>MBBS, FRCS</p><p>Practising since: 2001</p>",
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.practising_since).toBe(2001);
  });

  it("extracts practising year from paragraph inside Related experience section", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h2",
          text: "Related experience",
          content: "<p>Various roles</p><p>Practising since: 1995</p>",
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.practising_since).toBe(1995);
  });

  it("prefers heading-based year over paragraph-based", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h2",
          text: "Practising since: 2004",
          content: "",
        },
        {
          tag: "h2",
          text: "Qualifications",
          content: "<p>Practising since: 2001</p>",
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.practising_since).toBe(2004);
  });
});

describe("BUG-005: Declaration boilerplate patterns", () => {
  it("identifies 'does not hold a share' as non-substantive", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h2",
          text: "Declaration",
          content: "<p>This consultant does not hold a share or financial interest in the hospital.</p>",
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.declaration_substantive).toBe(false);
  });

  it("identifies 'does not have a financial' as non-substantive", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h2",
          text: "Declaration",
          content: "<p>The consultant does not have a financial interest in the hospital.</p>",
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.declaration_substantive).toBe(false);
  });

  it("identifies multi-sentence all-boilerplate as non-substantive", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h2",
          text: "Declaration",
          content: "<p>This consultant has no interests to declare. The consultant does not hold a share in the hospital.</p>",
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.declaration_substantive).toBe(false);
  });

  it("still flags genuine substantive declarations", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h2",
          text: "Declaration",
          content: "<p>I hold a 15% equity stake in MedTech Solutions Ltd, a medical devices company.</p>",
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.declaration_substantive).toBe(true);
  });
});

describe("BUG-006: heuristicBioDepth", () => {
  it("returns 'missing' for null or empty text", () => {
    expect(heuristicBioDepth(null)).toBe("missing");
    expect(heuristicBioDepth("")).toBe("missing");
    expect(heuristicBioDepth("   ")).toBe("missing");
  });

  it("returns 'thin' for short text (<=100 chars)", () => {
    expect(heuristicBioDepth("Short bio.")).toBe("thin");
    expect(heuristicBioDepth("A".repeat(50))).toBe("thin");
  });

  it("returns 'adequate' for medium text (101-300 chars)", () => {
    expect(heuristicBioDepth("A".repeat(150))).toBe("adequate");
    expect(heuristicBioDepth("A".repeat(300))).toBe("adequate");
  });

  it("returns 'substantive' for long text (>300 chars)", () => {
    expect(heuristicBioDepth("A".repeat(301))).toBe("substantive");
    expect(heuristicBioDepth("A".repeat(1000))).toBe("substantive");
  });
});

describe("BUG-007: External website domain filtering", () => {
  it("rejects nuffieldhealthcareers.com as internal", () => {
    const html = buildProfileHTML({
      externalLink: "https://www.nuffieldhealthcareers.com/jobs",
    });
    const result = parseProfile(html, "test");
    expect(result.external_website).toBeNull();
  });

  it("rejects nuffieldhealth.com subdomains", () => {
    const html = buildProfileHTML({
      externalLink: "https://www.nuffieldhealth.com/consultants",
    });
    const result = parseProfile(html, "test");
    expect(result.external_website).toBeNull();
  });

  it("accepts genuine external URLs", () => {
    const html = buildProfileHTML({
      externalLink: "https://www.exeterheart.com",
    });
    const result = parseProfile(html, "test");
    expect(result.external_website).toBe("https://www.exeterheart.com");
  });

  it("rejects social media URLs", () => {
    const html = buildProfileHTML({
      externalLink: "https://www.facebook.com/drsmith",
    });
    const result = parseProfile(html, "test");
    expect(result.external_website).toBeNull();
  });

  it("rejects Outlook SafeLinks wrapping nuffieldhealth.com", () => {
    const html = buildProfileHTML({
      externalLink: "https://eur03.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.nuffieldhealth.com%2Fhospitals%2Fcambridge&data=foo",
    });
    const result = parseProfile(html, "test");
    expect(result.external_website).toBeNull();
  });
});

describe("BUG-002 follow-up: trailing commas in list items", () => {
  it("strips trailing commas from list items", () => {
    const html = buildProfileHTML({
      headingSections: [
        {
          tag: "h2",
          text: "Specialties",
          content: "<ul><li>Hip surgery,</li><li>Knee surgery</li></ul>",
        },
      ],
    });
    const result = parseProfile(html, "test");
    expect(result.specialty_primary).toEqual(["Hip surgery", "Knee surgery"]);
  });
});

// ── BUG-008: Double spaces in consultant names ──────────────────────────────

describe("BUG-008: double spaces in consultant names", () => {
  it("normalises double spaces in H1 to single space", () => {
    const html = buildProfileHTML({ h1: "Dr  Laurie Windsor" });
    const result = parseProfile(html, "dr-laurie-windsor");
    expect(result.consultant_name).toBe("Dr Laurie Windsor");
  });

  it("normalises triple spaces", () => {
    const html = buildProfileHTML({ h1: "Dr  Sarah  Morgan" });
    const result = parseProfile(html, "dr-sarah-morgan");
    expect(result.consultant_name).toBe("Dr Sarah Morgan");
  });

  it("preserves single-space names unchanged", () => {
    const html = buildProfileHTML({ h1: "Mr John Smith" });
    const result = parseProfile(html, "mr-john-smith");
    expect(result.consultant_name).toBe("Mr John Smith");
  });
});

// ── BUG-009: Age restriction parsing broken ─────────────────────────────────

describe("BUG-009: age restriction parsing", () => {
  it("returns null when body has phone numbers but no age restriction", () => {
    const html = `
      <!DOCTYPE html><html><body>
        <h1>Mr Piers Moreau</h1>
        <aside class="consultant__image"><img src="https://img.test/photo.jpg" /></aside>
        <p>Call us on 01743 282500</p>
        <p>Address: 200 High Street, SY1 1QA</p>
      </body></html>
    `;
    const result = parseProfile(html, "mr-piers-moreau");
    expect(result.patient_age_restriction).toBeNull();
    expect(result.patient_age_restriction_min).toBeNull();
    expect(result.patient_age_restriction_max).toBeNull();
  });

  it("extracts 'from the ages of 5 to 16' correctly", () => {
    const html = `
      <!DOCTYPE html><html><body>
        <h1>Dr Test Consultant</h1>
        <aside class="consultant__image"><img src="https://img.test/photo.jpg" /></aside>
        <p>This consultant sees patients from the ages of 5 to 16</p>
      </body></html>
    `;
    const result = parseProfile(html, "test");
    expect(result.patient_age_restriction_min).toBe(5);
    expect(result.patient_age_restriction_max).toBe(16);
  });

  it("extracts 'only sees adults' correctly", () => {
    const html = buildProfileHTML({ ageRestriction: "This consultant only sees adults" });
    const result = parseProfile(html, "test");
    expect(result.patient_age_restriction_min).toBe(18);
    expect(result.patient_age_restriction_max).toBeNull();
  });

  it("rejects min > max values", () => {
    const html = `
      <!DOCTYPE html><html><body>
        <h1>Dr Test</h1>
        <aside class="consultant__image"><img src="https://img.test/photo.jpg" /></aside>
        <p>Sees patients ages 30 to 8</p>
      </body></html>
    `;
    const result = parseProfile(html, "test");
    // min > max should be rejected
    expect(result.patient_age_restriction).toBeNull();
  });

  it("extracts ages 0 to 18 correctly", () => {
    const html = `
      <!DOCTYPE html><html><body>
        <h1>Dr Test</h1>
        <aside class="consultant__image"><img src="https://img.test/photo.jpg" /></aside>
        <p>This consultant sees patients from the ages of 0 to 18</p>
      </body></html>
    `;
    const result = parseProfile(html, "test");
    expect(result.patient_age_restriction_min).toBe(0);
    expect(result.patient_age_restriction_max).toBe(18);
  });
});

// ── BUG-010: hospital_is_nuffield always false ──────────────────────────────

describe("BUG-010: hospital_is_nuffield", () => {
  it("short hospital name defaults to true (Nuffield profiles)", () => {
    const html = buildProfileHTML({ hospitalName: "Leeds" });
    const result = parseProfile(html, "test");
    expect(result.hospital_is_nuffield).toBe(true);
  });

  it("full Nuffield name is true", () => {
    const html = buildProfileHTML({ hospitalName: "Nuffield Health Cambridge" });
    const result = parseProfile(html, "test");
    expect(result.hospital_is_nuffield).toBe(true);
  });

  it("null hospital name defaults to true", () => {
    const html = buildProfileHTML({});
    const result = parseProfile(html, "test");
    expect(result.hospital_is_nuffield).toBe(true);
  });
});

// ── BUG-012: CQC rating never captured ──────────────────────────────────────

describe("BUG-012: CQC rating extraction", () => {
  it("extracts from 'CQC rating: Good' (colon format)", () => {
    const html = buildProfileHTML({ cqcRating: "Good" });
    const result = parseProfile(html, "test");
    expect(result.cqc_rating).toBe("Good");
  });

  it("extracts from 'CQC Overall rating Good' (no colon)", () => {
    const html = `
      <!DOCTYPE html><html><body>
        <h1>Mr Test</h1>
        <aside class="consultant__image"><img src="https://img.test/photo.jpg" /></aside>
        <div>CQC</div>
        <div>Overall rating</div>
        <div>Good</div>
      </body></html>
    `;
    const result = parseProfile(html, "test");
    expect(result.cqc_rating).toBe("Good");
  });

  it("extracts Outstanding rating", () => {
    const html = `
      <!DOCTYPE html><html><body>
        <h1>Mr Test</h1>
        <aside class="consultant__image"><img src="https://img.test/photo.jpg" /></aside>
        <p>CQC rating: Outstanding</p>
      </body></html>
    `;
    const result = parseProfile(html, "test");
    expect(result.cqc_rating).toBe("Outstanding");
  });

  it("returns null when no CQC section present", () => {
    const html = buildProfileHTML({});
    const result = parseProfile(html, "test");
    expect(result.cqc_rating).toBeNull();
  });

  it("extracts Requires improvement rating", () => {
    const html = `
      <!DOCTYPE html><html><body>
        <h1>Mr Test</h1>
        <aside class="consultant__image"><img src="https://img.test/photo.jpg" /></aside>
        <p>CQC Overall rating Requires improvement</p>
      </body></html>
    `;
    const result = parseProfile(html, "test");
    expect(result.cqc_rating).toBe("Requires improvement");
  });
});
