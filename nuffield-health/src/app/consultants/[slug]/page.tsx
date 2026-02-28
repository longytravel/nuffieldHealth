import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { appendFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { getLatestRun, getConsultant } from "@/db/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TIER_STYLES: Record<string, string> = {
  Gold: "bg-amber-100 text-amber-800",
  Silver: "bg-slate-100 text-slate-700",
  Bronze: "bg-orange-100 text-orange-800",
  Incomplete: "bg-red-100 text-red-700",
};

const SEVERITY_STYLES: Record<string, string> = {
  fail: "bg-red-100 text-red-800",
  warn: "bg-yellow-100 text-yellow-800",
  info: "bg-blue-100 text-blue-800",
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

function auditLog(slug: string, ip: string) {
  const logPath = "data/audit.log";
  try {
    mkdirSync(dirname(logPath), { recursive: true });
    appendFileSync(
      logPath,
      `${new Date().toISOString()}\tdetail_view\t${slug}\t${ip}\n`
    );
  } catch {
    // Non-blocking — audit log failure should not break the page
  }
}

export default async function ConsultantDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const run = await getLatestRun();

  if (!run) {
    notFound();
  }

  const consultant = await getConsultant(run.run_id, slug);

  if (!consultant) {
    notFound();
  }

  // Audit logging
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";
  auditLog(slug, ip);

  const c = consultant;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/consultants"
            className="mb-2 inline-block text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; Back to consultants
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">
            {c.consultant_title_prefix ? `${c.consultant_title_prefix} ` : ""}
            {c.consultant_name ?? c.slug}
          </h1>
          <div className="mt-1 flex flex-wrap gap-2 text-sm text-muted-foreground">
            {c.specialty_primary.length > 0 && (
              <span>{c.specialty_primary.join(", ")}</span>
            )}
            {c.hospital_name_primary && (
              <>
                <span>at</span>
                <span>{c.hospital_name_primary}</span>
              </>
            )}
          </div>
        </div>
        <a
          href={`https://www.nuffieldhealth.com/consultants/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          View Live Profile
        </a>
      </div>

      {/* Quality Card */}
      <Card>
        <CardHeader>
          <CardTitle>Quality Assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {c.quality_tier && (
              <Badge
                className={`text-base px-3 py-1 ${TIER_STYLES[c.quality_tier] ?? ""}`}
              >
                {c.quality_tier}
              </Badge>
            )}
            {c.profile_completeness_score != null && (
              <div className="flex-1">
                <div className="mb-1 flex justify-between text-sm">
                  <span>Completeness Score</span>
                  <span className="font-medium">
                    {Math.round(c.profile_completeness_score)}/100
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{
                      width: `${Math.min(100, c.profile_completeness_score)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {c.flags.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Flags</p>
              <div className="flex flex-wrap gap-2">
                {c.flags.map((flag, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className={SEVERITY_STYLES[flag.severity] ?? ""}
                  >
                    {flag.code}: {flag.message}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* About / Bio */}
        {c.bio_depth && (
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                <span className="font-medium">Bio Depth:</span>{" "}
                <Badge variant="outline">{c.bio_depth}</Badge>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Treatments */}
        {c.treatments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Treatments ({c.treatments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-4 text-sm">
                {c.treatments.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Qualifications */}
        {c.qualifications_credentials && (
          <Card>
            <CardHeader>
              <CardTitle>Qualifications</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{c.qualifications_credentials}</p>
            </CardContent>
          </Card>
        )}

        {/* Insurers */}
        {c.insurers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                Insurers ({c.insurer_count ?? c.insurers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {c.insurers.map((ins, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {ins}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Consultation Times */}
        {c.consultation_times_raw.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Consultation Times</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {c.consultation_times_raw.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Booking Info */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Booking State</span>
              <span className="font-medium">{c.booking_state ?? "-"}</span>
              <span className="text-muted-foreground">Online Bookable</span>
              <span className="font-medium">{c.online_bookable ? "Yes" : "No"}</span>
              <span className="text-muted-foreground">Slots (next 28 days)</span>
              <span className="font-medium">
                {c.available_slots_next_28_days ?? "-"}
              </span>
              <span className="text-muted-foreground">Next Available</span>
              <span className="font-medium">{c.next_available_date ?? "-"}</span>
              <span className="text-muted-foreground">Price</span>
              <span className="font-medium">
                {c.consultation_price ? `£${c.consultation_price}` : "-"}
              </span>
            </div>
            {c.booking_caveat && (
              <p className="mt-2 text-xs text-muted-foreground italic">
                {c.booking_caveat}
              </p>
            )}
          </CardContent>
        </Card>

        {/* AI Assessment */}
        <Card>
          <CardHeader>
            <CardTitle>AI Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Plain English Score</span>
              <span className="font-medium">
                {c.plain_english_score != null ? `${c.plain_english_score}/5` : "-"}
              </span>
              <span className="text-muted-foreground">Bio Depth</span>
              <span className="font-medium">{c.bio_depth ?? "-"}</span>
              <span className="text-muted-foreground">Treatment Specificity</span>
              <span className="font-medium">
                {c.treatment_specificity_score ?? "-"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        {(c.contact_phone || c.contact_mobile || c.contact_email) && (
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="mb-2 text-xs text-muted-foreground italic">
                Sensitive data - access logged for audit purposes
              </p>
              <div className="grid grid-cols-2 gap-2">
                {c.contact_phone && (
                  <>
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-medium">{c.contact_phone}</span>
                  </>
                )}
                {c.contact_mobile && (
                  <>
                    <span className="text-muted-foreground">Mobile</span>
                    <span className="font-medium">{c.contact_mobile}</span>
                  </>
                )}
                {c.contact_email && (
                  <>
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium">{c.contact_email}</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Declaration */}
        {c.declaration && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Declaration
                {c.declaration_substantive && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                    Substantive
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(c.declaration as string[]).map((para, i) => (
                <p key={i} className="mb-2 text-sm">
                  {para}
                </p>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Memberships */}
        {c.memberships.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Memberships</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-4 text-sm">
                {c.memberships.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Languages */}
        {c.languages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Languages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {c.languages.map((lang, i) => (
                  <Badge key={i} variant="outline">
                    {lang}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clinical Interests */}
        {c.clinical_interests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Clinical Interests</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-4 text-sm">
                {c.clinical_interests.map((interest, i) => (
                  <li key={i}>{interest}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Personal Interests */}
        {c.personal_interests && (
          <Card>
            <CardHeader>
              <CardTitle>Personal Interests</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{c.personal_interests}</p>
            </CardContent>
          </Card>
        )}

        {/* Professional Roles */}
        {c.professional_roles && (
          <Card>
            <CardHeader>
              <CardTitle>Professional Roles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{c.professional_roles}</p>
            </CardContent>
          </Card>
        )}

        {/* Age Restriction */}
        {c.patient_age_restriction && (
          <Card>
            <CardHeader>
              <CardTitle>Patient Age Restriction</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p>{c.patient_age_restriction}</p>
              {(c.patient_age_restriction_min != null ||
                c.patient_age_restriction_max != null) && (
                <p className="mt-1 text-muted-foreground">
                  Range: {c.patient_age_restriction_min ?? "0"} -{" "}
                  {c.patient_age_restriction_max ?? "no limit"}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* External Website */}
        {c.external_website && (
          <Card>
            <CardHeader>
              <CardTitle>External Website</CardTitle>
            </CardHeader>
            <CardContent>
              <a
                href={c.external_website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary underline"
              >
                {c.external_website}
              </a>
            </CardContent>
          </Card>
        )}

        {/* CQC Rating */}
        {c.cqc_rating && (
          <Card>
            <CardHeader>
              <CardTitle>CQC Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="text-sm">
                {c.cqc_rating}
              </Badge>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Raw Data (Collapsible) */}
      <details className="rounded-lg border">
        <summary className="cursor-pointer px-6 py-4 text-sm font-medium">
          Raw Extracted Data (Audit)
        </summary>
        <div className="border-t px-6 py-4">
          <pre className="overflow-auto rounded-md bg-muted p-4 text-xs">
            {JSON.stringify(c, null, 2)}
          </pre>
        </div>
      </details>

      {/* Metadata */}
      <div className="text-xs text-muted-foreground">
        <p>Slug: {c.slug}</p>
        <p>Registration Number: {c.registration_number ?? "N/A"}</p>
        <p>Profile Status: {c.profile_status}</p>
        <p>Scrape Status: {c.scrape_status}</p>
        {c.has_photo != null && <p>Has Photo: {c.has_photo ? "Yes" : "No"}</p>}
        {c.hospital_is_nuffield != null && (
          <p>Nuffield Hospital: {c.hospital_is_nuffield ? "Yes" : "No"}</p>
        )}
        {c.hospital_nuffield_at_nhs != null && (
          <p>
            Nuffield at NHS: {c.hospital_nuffield_at_nhs ? "Yes" : "No"}
          </p>
        )}
        <p>
          Practising Since: {c.practising_since ?? "N/A"}
        </p>
      </div>
    </div>
  );
}
