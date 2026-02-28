"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { TierBadge } from "@/components/ui/tier-badge";
import { Badge } from "@/components/ui/badge";
import type { ScoreDimension } from "@/lib/types";
import {
  FileText,
  Shield,
  Calendar,
  Brain,
  Code,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface Flag {
  code: string;
  severity: string;
  message: string;
}

interface ProfileTabsProps {
  consultant: {
    slug: string;
    run_id: string;
    consultant_name: string | null;
    about_text?: string | null;
    bio_depth: string | null;
    specialty_primary: string[];
    specialty_sub: string[];
    treatments: string[];
    qualifications_credentials: string | null;
    memberships: string[];
    languages: string[];
    clinical_interests: string[];
    personal_interests: string | null;
    professional_interests: string | null;
    professional_roles: string | null;
    declaration: string[] | null;
    declaration_substantive: boolean | null;
    // Quality
    profile_completeness_score: number | null;
    quality_tier: string | null;
    flags: Flag[];
    has_photo: boolean | null;
    // AI evidence
    plain_english_score: number | null;
    plain_english_reason: string | null;
    bio_depth_reason: string | null;
    treatment_specificity_score: string | null;
    treatment_specificity_reason: string | null;
    qualifications_completeness: string | null;
    qualifications_completeness_reason: string | null;
    ai_quality_notes: string | null;
    // Booking
    booking_state: string | null;
    online_bookable: boolean | null;
    available_days_next_28_days: number | null;
    available_slots_next_28_days: number | null;
    avg_slots_per_day: number | null;
    next_available_date: string | null;
    days_to_first_available: number | null;
    consultation_price: number | null;
    booking_caveat: string | null;
    // Other
    registration_number: string | null;
    scrape_status: string;
    scrape_error: string | null;
    profile_status: string;
    practising_since: number | null;
    consultation_times_raw: string[];
    insurers: string[];
    insurer_count: number | null;
    in_the_news: { title: string; url: string }[] | null;
    patient_age_restriction: string | null;
    external_website: string | null;
    cqc_rating: string | null;
    contact_phone: string | null;
    contact_mobile: string | null;
    contact_email: string | null;
  };
  scoreDimensions: ScoreDimension[];
  specialtyAvg: { avg_score: number; count: number } | null;
}

type TabId = "ai-insights" | "overview" | "quality" | "booking" | "raw";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "ai-insights", label: "AI Insights", icon: <Brain className="h-4 w-4" /> },
  { id: "overview", label: "Overview", icon: <FileText className="h-4 w-4" /> },
  { id: "quality", label: "Quality", icon: <Shield className="h-4 w-4" /> },
  { id: "booking", label: "Booking", icon: <Calendar className="h-4 w-4" /> },
  { id: "raw", label: "Raw Data", icon: <Code className="h-4 w-4" /> },
];

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
  fail: <AlertCircle className="h-4 w-4 text-[var(--danger)]" />,
  warn: <AlertTriangle className="h-4 w-4 text-[var(--warning)]" />,
  info: <Info className="h-4 w-4 text-[var(--info)]" />,
};

const SEVERITY_STYLES: Record<string, string> = {
  fail: "border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]",
  warn: "border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)]",
  info: "border-[var(--info)]/30 bg-[var(--info)]/10 text-[var(--info)]",
};

const FIELD_DEFINITIONS = {
  specialties:
    "Clinical specialties parsed from the profile. At least one specialty (primary or sub-specialty) is required for Bronze+ tier eligibility.",
  treatments:
    "Named treatments, procedures, or condition-focused services. Parsed from Treatments sections; if absent, the parser falls back to Special interests.",
  qualifications:
    "Professional credentials (for example MBBS, FRCS). Missing qualifications triggers a fail flag.",
  consultationTimes:
    "Published clinic/session times extracted from the consultant profile page.",
  insurers:
    "Private medical insurers explicitly listed on the profile page.",
} as const;

const SCORE_DIMENSION_DEFINITIONS: Record<string, string> = {
  photo: "Profile photo present.",
  bio_depth: "Depth and substance of profile biography content.",
  treatments: FIELD_DEFINITIONS.treatments,
  qualifications: FIELD_DEFINITIONS.qualifications,
  specialty: FIELD_DEFINITIONS.specialties,
  insurers: FIELD_DEFINITIONS.insurers,
  consultation_times: FIELD_DEFINITIONS.consultationTimes,
  plain_english: "Patient readability score for profile language.",
  booking: "Online booking availability and slot status.",
  practising_since: "Presence of practising-since year.",
  memberships: "Presence of professional body memberships.",
};

export function ProfileTabs({ consultant: c, scoreDimensions, specialtyAvg }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("ai-insights");

  const hasAiEvidence =
    c.plain_english_reason != null ||
    c.bio_depth_reason != null ||
    c.treatment_specificity_reason != null ||
    c.qualifications_completeness_reason != null ||
    c.ai_quality_notes != null;

  return (
    <div className="space-y-6">
      {/* Tab Bar */}
      <div className="flex gap-1 rounded-xl bg-[var(--bg-secondary)] p-1 border border-[var(--border-subtle)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-[var(--bg-elevated)] text-[var(--sensai-teal)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "ai-insights" && (
        <AiInsightsTab
          consultant={c}
          scoreDimensions={scoreDimensions}
          specialtyAvg={specialtyAvg}
          hasAiEvidence={hasAiEvidence}
        />
      )}
      {activeTab === "overview" && <OverviewTab consultant={c} />}
      {activeTab === "quality" && (
        <QualityTab consultant={c} scoreDimensions={scoreDimensions} />
      )}
      {activeTab === "booking" && <BookingTab consultant={c} />}
      {activeTab === "raw" && <RawDataTab consultant={c} />}
    </div>
  );
}

// ========== AI Insights Tab ==========
function AiInsightsTab({
  consultant: c,
  scoreDimensions,
  specialtyAvg,
  hasAiEvidence,
}: {
  consultant: ProfileTabsProps["consultant"];
  scoreDimensions: ScoreDimension[];
  specialtyAvg: { avg_score: number; count: number } | null;
  hasAiEvidence: boolean;
}) {
  if (!hasAiEvidence) {
    return (
      <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
        <Brain className="h-12 w-12 text-[var(--text-muted)] mb-4" />
        <h3 className="text-h3 text-[var(--text-primary)] mb-2">AI Assessment Not Yet Available</h3>
        <p className="text-sm text-[var(--text-secondary)] max-w-md">
          This profile has not been processed through the AI assessment pipeline.
          Run the scraper with AI assessment enabled to populate insights.
        </p>
      </GlassCard>
    );
  }

  const totalEarned = scoreDimensions.reduce((sum, d) => sum + d.earned, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* AI Recommendations */}
      <GlassCard className="lg:col-span-2">
        <h3 className="text-h3 text-[var(--text-primary)] mb-4">AI Recommendations</h3>
        <div className="space-y-3">
          {scoreDimensions
            .filter((d) => d.earned < d.maxPoints)
            .map((d) => (
              <div key={d.key} className="flex items-center gap-3 rounded-lg bg-[var(--bg-secondary)] px-4 py-3">
                <XCircle className="h-4 w-4 text-[var(--warning)] shrink-0" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{d.label}</span>
                  <span className="ml-2 text-xs text-[var(--text-muted)]">
                    (+{d.maxPoints - d.earned} points available)
                  </span>
                </div>
              </div>
            ))}
          {scoreDimensions.filter((d) => d.earned < d.maxPoints).length === 0 && (
            <div className="flex items-center gap-3 rounded-lg bg-[var(--success)]/10 px-4 py-3">
              <CheckCircle className="h-4 w-4 text-[var(--success)]" />
              <span className="text-sm text-[var(--success)]">All score dimensions are maximised</span>
            </div>
          )}
        </div>
      </GlassCard>

      {/* AI Evidence */}
      <GlassCard>
        <h3 className="text-h3 text-[var(--text-primary)] mb-4">Quality Assessment</h3>
        <div className="space-y-4">
          {c.plain_english_reason && (
            <EvidenceItem
              label="Plain English"
              score={c.plain_english_score != null ? `${c.plain_english_score}/5` : null}
              reason={c.plain_english_reason}
            />
          )}
          {c.bio_depth_reason && (
            <EvidenceItem label="Bio Depth" score={c.bio_depth} reason={c.bio_depth_reason} />
          )}
          {c.treatment_specificity_reason && (
            <EvidenceItem
              label="Treatment Specificity"
              score={c.treatment_specificity_score}
              reason={c.treatment_specificity_reason}
            />
          )}
          {c.qualifications_completeness_reason && (
            <EvidenceItem
              label="Qualifications"
              score={c.qualifications_completeness}
              reason={c.qualifications_completeness_reason}
            />
          )}
          {c.ai_quality_notes && (
            <div className="rounded-lg bg-[var(--bg-secondary)] p-4">
              <p className="text-xs font-medium text-[var(--text-muted)] mb-1">AI Notes</p>
              <p className="text-sm text-[var(--text-secondary)]">{c.ai_quality_notes}</p>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Comparison to Specialty Average */}
      <GlassCard>
        <h3 className="text-h3 text-[var(--text-primary)] mb-4">Specialty Comparison</h3>
        {specialtyAvg && specialtyAvg.count > 1 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">This Profile</span>
              <span className="text-lg font-bold text-[var(--text-primary)] font-mono">
                {totalEarned}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">
                Specialty Average ({specialtyAvg.count} consultants)
              </span>
              <span className="text-lg font-bold text-[var(--text-muted)] font-mono">
                {Math.round(specialtyAvg.avg_score)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden relative">
              <div
                className="absolute h-full rounded-full bg-[var(--text-muted)] opacity-50"
                style={{ width: `${Math.min(100, specialtyAvg.avg_score)}%` }}
              />
              <div
                className="absolute h-full rounded-full"
                style={{
                  width: `${Math.min(100, totalEarned)}%`,
                  backgroundColor:
                    totalEarned >= specialtyAvg.avg_score ? "var(--success)" : "var(--warning)",
                }}
              />
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {totalEarned >= specialtyAvg.avg_score
                ? `Above average by ${Math.round(totalEarned - specialtyAvg.avg_score)} points`
                : `Below average by ${Math.round(specialtyAvg.avg_score - totalEarned)} points`}
            </p>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            Not enough data to compare against specialty average.
          </p>
        )}
      </GlassCard>
    </div>
  );
}

function EvidenceItem({
  label,
  score,
  reason,
}: {
  label: string;
  score: string | number | null;
  reason: string;
}) {
  return (
    <div className="rounded-lg bg-[var(--bg-secondary)] p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>
        {score != null && (
          <span className="text-xs font-medium text-[var(--sensai-teal)]">{score}</span>
        )}
      </div>
      <p className="text-sm text-[var(--text-secondary)]">{reason}</p>
    </div>
  );
}

function SectionHeading({
  label,
  tooltip,
  suffix,
}: {
  label: string;
  tooltip?: string;
  suffix?: React.ReactNode;
}) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-h3 text-[var(--text-primary)]">
      <span>{label}</span>
      {suffix}
      {tooltip ? (
        <span
          title={tooltip}
          aria-label={`${label} definition`}
          className="inline-flex cursor-help"
        >
          <Info className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        </span>
      ) : null}
    </h3>
  );
}

// ========== Overview Tab ==========
function OverviewTab({ consultant: c }: { consultant: ProfileTabsProps["consultant"] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Specialties */}
      {(c.specialty_primary.length > 0 || c.specialty_sub.length > 0) && (
        <GlassCard>
          <SectionHeading
            label="Specialties"
            tooltip={FIELD_DEFINITIONS.specialties}
          />
          <div className="space-y-2">
            {c.specialty_primary.length > 0 && (
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1.5">Primary</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.specialty_primary.map((s, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-[var(--sensai-teal)]/15 px-2.5 py-1 text-xs font-medium text-[var(--sensai-teal)]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {c.specialty_sub.length > 0 && (
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1.5">Sub-specialties</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.specialty_sub.map((s, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-[var(--bg-elevated)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* Treatments */}
      {c.treatments.length > 0 && (
        <GlassCard>
          <SectionHeading
            label="Treatments"
            suffix={<span className="text-sm text-[var(--text-muted)]">({c.treatments.length})</span>}
            tooltip={FIELD_DEFINITIONS.treatments}
          />
          <div className="flex flex-wrap gap-1.5 max-h-[300px] overflow-y-auto">
            {c.treatments.map((t, i) => (
              <span
                key={i}
                className="rounded-md bg-[var(--bg-elevated)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
              >
                {t}
              </span>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Qualifications */}
      {c.qualifications_credentials && (
        <GlassCard>
          <SectionHeading
            label="Qualifications"
            tooltip={FIELD_DEFINITIONS.qualifications}
          />
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {c.qualifications_credentials}
          </p>
        </GlassCard>
      )}

      {/* Memberships */}
      {c.memberships.length > 0 && (
        <GlassCard>
          <h3 className="text-h3 text-[var(--text-primary)] mb-3">Memberships</h3>
          <ul className="space-y-1.5">
            {c.memberships.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                <CheckCircle className="h-4 w-4 text-[var(--success)] shrink-0 mt-0.5" />
                {m}
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {/* Languages */}
      {c.languages.length > 0 && (
        <GlassCard>
          <h3 className="text-h3 text-[var(--text-primary)] mb-3">Languages</h3>
          <div className="flex flex-wrap gap-1.5">
            {c.languages.map((lang, i) => (
              <span
                key={i}
                className="rounded-full bg-[var(--bg-elevated)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
              >
                {lang}
              </span>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Clinical Interests */}
      {c.clinical_interests.length > 0 && (
        <GlassCard>
          <h3 className="text-h3 text-[var(--text-primary)] mb-3">Clinical Interests</h3>
          <ul className="space-y-1.5">
            {c.clinical_interests.map((interest, i) => (
              <li key={i} className="text-sm text-[var(--text-secondary)]">
                {interest}
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {/* Personal Interests */}
      {c.personal_interests && (
        <GlassCard>
          <h3 className="text-h3 text-[var(--text-primary)] mb-3">Personal Interests</h3>
          <p className="text-sm text-[var(--text-secondary)]">{c.personal_interests}</p>
        </GlassCard>
      )}

      {/* Professional Interests (AI-populated) */}
      {c.professional_interests ? (
        <GlassCard>
          <h3 className="text-h3 text-[var(--text-primary)] mb-3">
            Professional Interests
            <span className="ml-2 text-xs font-normal text-[var(--sensai-teal)]">(AI)</span>
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">{c.professional_interests}</p>
        </GlassCard>
      ) : null}

      {/* Professional Roles */}
      {c.professional_roles && (
        <GlassCard>
          <h3 className="text-h3 text-[var(--text-primary)] mb-3">Professional Roles</h3>
          <p className="text-sm text-[var(--text-secondary)]">{c.professional_roles}</p>
        </GlassCard>
      )}

      {/* Declaration */}
      {c.declaration && c.declaration.length > 0 && (
        <GlassCard className="lg:col-span-2">
          <h3 className="text-h3 text-[var(--text-primary)] mb-3">
            Declaration
            {c.declaration_substantive && (
              <span className="ml-2 text-xs font-normal text-[var(--tier-gold)]">Substantive</span>
            )}
          </h3>
          <div className="space-y-2">
            {c.declaration.map((para, i) => (
              <p key={i} className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {para}
              </p>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

// ========== Quality Tab ==========
function QualityTab({
  consultant: c,
  scoreDimensions,
}: {
  consultant: ProfileTabsProps["consultant"];
  scoreDimensions: ScoreDimension[];
}) {
  const totalMax = scoreDimensions.reduce((sum, d) => sum + d.maxPoints, 0);
  const totalEarned = scoreDimensions.reduce((sum, d) => sum + d.earned, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Score Breakdown */}
      <GlassCard className="lg:col-span-2">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-h3 text-[var(--text-primary)]">Score Breakdown</h3>
          <div className="flex items-center gap-3">
            {c.quality_tier && (
              <TierBadge
                tier={c.quality_tier.toLowerCase() as "gold" | "silver" | "bronze" | "incomplete"}
              />
            )}
            <span className="text-lg font-bold font-mono text-[var(--text-primary)]">
              {totalEarned}/{totalMax}
            </span>
          </div>
        </div>
        <div className="space-y-3">
          {scoreDimensions.map((d) => (
            <div key={d.key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {d.earned === 0 ? (
                    <XCircle className="h-4 w-4 text-[var(--danger)]" />
                  ) : d.earned < d.maxPoints ? (
                    <AlertTriangle className="h-4 w-4 text-[var(--warning)]" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-[var(--success)]" />
                  )}
                  <span
                    className="text-[var(--text-secondary)]"
                    title={SCORE_DIMENSION_DEFINITIONS[d.key] ?? d.label}
                  >
                    {d.label}
                  </span>
                </div>
                <span className="text-xs tabular-nums text-[var(--text-muted)] font-mono">
                  {d.earned}/{d.maxPoints}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(d.earned / d.maxPoints) * 100}%`,
                    backgroundColor:
                      d.earned === d.maxPoints
                        ? "var(--success)"
                        : d.earned > 0
                        ? "var(--warning)"
                        : "var(--danger)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Flags */}
      {c.flags.length > 0 && (
        <GlassCard className="lg:col-span-2">
          <h3 className="text-h3 text-[var(--text-primary)] mb-4">
            Flags ({c.flags.length})
          </h3>
          <div className="space-y-2">
            {c.flags.map((flag, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${SEVERITY_STYLES[flag.severity] ?? ""}`}
              >
                {SEVERITY_ICONS[flag.severity]}
                <div className="flex-1">
                  <span className="text-sm font-medium">{flag.code}</span>
                  <p className="text-xs mt-0.5 opacity-80">{flag.message}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

// ========== Booking Tab ==========
function BookingTab({ consultant: c }: { consultant: ProfileTabsProps["consultant"] }) {
  const bookingFields: { label: string; value: string | number | null; formatter?: (v: string | number) => string }[] = [
    { label: "Booking State", value: c.booking_state },
    { label: "Online Bookable", value: c.online_bookable != null ? (c.online_bookable ? "Yes" : "No") : null },
    { label: "Available Days (28d)", value: c.available_days_next_28_days },
    { label: "Available Slots (28d)", value: c.available_slots_next_28_days },
    { label: "Avg Slots/Day", value: c.avg_slots_per_day != null ? c.avg_slots_per_day.toFixed(1) : null },
    { label: "Next Available", value: c.next_available_date },
    { label: "Days to First Available", value: c.days_to_first_available },
    { label: "Consultation Price", value: c.consultation_price != null ? `\u00A3${c.consultation_price}` : null },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <GlassCard className="lg:col-span-2">
        <h3 className="text-h3 text-[var(--text-primary)] mb-4">Booking Information</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          {bookingFields.map((field) => (
            <div key={field.label}>
              <p className="text-xs text-[var(--text-muted)] mb-0.5">{field.label}</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {field.value ?? <span className="text-[var(--text-muted)]">-</span>}
              </p>
            </div>
          ))}
        </div>
        {c.booking_caveat && (
          <div className="mt-4 rounded-lg bg-[var(--bg-secondary)] px-4 py-3">
            <p className="text-xs text-[var(--text-muted)] mb-0.5">Caveat</p>
            <p className="text-sm text-[var(--text-secondary)] italic">{c.booking_caveat}</p>
          </div>
        )}
      </GlassCard>

      {/* Consultation Times */}
      {c.consultation_times_raw.length > 0 && (
        <GlassCard>
          <SectionHeading
            label="Consultation Times"
            tooltip={FIELD_DEFINITIONS.consultationTimes}
          />
          <ul className="space-y-1.5">
            {c.consultation_times_raw.map((t, i) => (
              <li key={i} className="text-sm text-[var(--text-secondary)]">{t}</li>
            ))}
          </ul>
        </GlassCard>
      )}

      {/* Insurers */}
      {c.insurers.length > 0 && (
        <GlassCard>
          <SectionHeading
            label="Insurers"
            suffix={
              <span className="text-sm text-[var(--text-muted)]">
                ({c.insurer_count ?? c.insurers.length})
              </span>
            }
            tooltip={FIELD_DEFINITIONS.insurers}
          />
          <div className="flex flex-wrap gap-1.5 max-h-[250px] overflow-y-auto">
            {c.insurers.map((ins, i) => (
              <span
                key={i}
                className="rounded-md bg-[var(--bg-elevated)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
              >
                {ins}
              </span>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

// ========== Raw Data Tab ==========
function RawDataTab({ consultant: c }: { consultant: ProfileTabsProps["consultant"] }) {
  return (
    <div className="space-y-6">
      {/* Metadata */}
      <GlassCard>
        <h3 className="text-h3 text-[var(--text-primary)] mb-4">Metadata</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          <MetaItem label="Slug" value={c.slug} />
          <MetaItem label="Registration Number" value={c.registration_number} />
          <MetaItem label="Profile Status" value={c.profile_status} />
          <MetaItem label="Scrape Status" value={c.scrape_status} />
          <MetaItem label="Run ID" value={c.run_id} />
          {c.scrape_error && <MetaItem label="Scrape Error" value={c.scrape_error} />}
        </div>
      </GlassCard>

      {/* Full JSON */}
      <GlassCard>
        <h3 className="text-h3 text-[var(--text-primary)] mb-4">Full JSON Dump</h3>
        <pre className="overflow-auto rounded-lg bg-[var(--bg-secondary)] p-4 text-xs text-[var(--text-secondary)] font-mono max-h-[600px]">
          {JSON.stringify(c, null, 2)}
        </pre>
      </GlassCard>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="text-sm font-mono text-[var(--text-secondary)]">
        {value ?? <span className="text-[var(--text-muted)]">N/A</span>}
      </p>
    </div>
  );
}
