import { describe, expect, it } from "vitest";
import { parseBupaProfile } from "./parse-bupa";

const sampleHtml = `
  <html>
    <head>
      <meta name="Description" content="Name: Dr Stuart Cairns, specialty: Gastroenterology, General (internal) medicine, subspecialty: Endoscopy, Hepatobiliary">
      <title>Dr Stuart Cairns : Gastroenterology</title>
    </head>
    <body>
      <div id="consultant-name-speciality">
        <h2><span class="cnwrpt">Dr Stuart Cairns</span></h2>
        <h3 class="assoc-with">Dr Stu Cairns</h3>
        <h3>
          Gastroenterology, General (internal) medicine
          <span class="copy-me cnref" data-clipboard-text="02211202"></span>
        </h3>
        <ul>
          <li id="gib-website">
            <a href="https://example.com/profile" target="_blank">
              <img src="/images/view-pages/Website.png" alt="New Window">Launch Website
            </a>
          </li>
          <li id="gib-phone">
            <a data-tel-href="tel:0208 194 8539" class="tel-disabled">020 8194 8539</a>
          </li>
          <li class="secretary-email">
            <a href="mailto:secretary%40example.com">secretary@example.com</a>
          </li>
        </ul>
      </div>
      <div id="consultant-overview">
        <h4>About me</h4>
        <p>Dr Stuart Cairns is a Consultant Physician and specialist in Gastroenterology.</p>
        <h4>Areas of interest</h4>
        <p>Biliary disease; Endoscopic procedures</p>
        <h4>GMC registration</h4>
        <p>Reference number 2211202</p>
        <h4>Affiliations / memberships</h4>
        <p>American Society of Gastrointestinal Endoscopy</p>
      </div>
      <img
        class="orient-me"
        src="https://s3-eu-west-1.amazonaws.com/bupa-images-4b24291849b400303aea648fcd38a718/14932/example.png"
        alt="Dr Stuart Cairns"
      >
      <img
        src="/images/view-pages/breast-specialist-18x18.png"
        alt="Bupa accredited breast care centre"
      >
      <div class="is-not-fee-assured">Not Fee assured</div>
    </body>
  </html>
`;

describe("parseBupaProfile", () => {
  it("extracts consultant-specific BUPA fields from the profile header", () => {
    const parsed = parseBupaProfile(
      sampleHtml,
      "14932",
      "dr_stuart_cairns",
      "https://www.finder.bupa.co.uk/Consultant/view/14932/dr_stuart_cairns"
    );

    expect(parsed.consultant_name).toBe("Dr Stuart Cairns");
    expect(parsed.registration_number).toBe("2211202");
    expect(parsed.specialty_primary).toEqual([
      "Gastroenterology",
      "General (internal) medicine",
    ]);
    expect(parsed.about_text).toContain("Consultant Physician");
    expect(parsed.clinical_interests).toEqual([
      "Biliary disease",
      "Endoscopic procedures",
    ]);
    expect(parsed.treatments).toEqual([]);
    expect(parsed.memberships).toEqual([
      "American Society of Gastrointestinal Endoscopy",
    ]);
    expect(parsed.contact_phone_numbers).toEqual(["020 8194 8539"]);
    expect(parsed.contact_email_addresses).toEqual(["secretary@example.com"]);
    expect(parsed.website_urls).toEqual(["https://example.com/profile"]);
    expect(parsed.accreditation_badges).toEqual(["Bupa accredited breast care centre"]);
    expect(parsed.source_sections.about_me.values).toEqual([
      "Dr Stuart Cairns is a Consultant Physician and specialist in Gastroenterology.",
    ]);
    expect(parsed.unmapped_section_keys).toEqual([]);
    expect(parsed.has_photo).toBe(true);
    expect(parsed.fee_assured).toBe(false);
  });
});
