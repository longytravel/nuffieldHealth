import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { appendFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { getLatestRun, getConsultant, getSpecialtyAverageScore } from "@/db/queries";
import { GlassCard } from "@/components/ui/glass-card";
import { TierBadge } from "@/components/ui/tier-badge";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { PageTransition } from "@/components/ui/page-transition";
import { computeScoreBreakdown } from "./compute-score";
import { ProfileTabs } from "./profile-tabs";
import {
  ChevronRight,
  ExternalLink,
  MapPin,
  Award,
  CalendarDays,
} from "lucide-react";

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
    // Non-blocking -- audit log failure should not break the page
  }
}

function formatRegistrationNumber(regNum: string | null): { label: string; value: string } | null {
  if (!regNum) return null;
  if (regNum.startsWith("HCPC-")) {
    return { label: "HCPC Registration", value: regNum };
  }
  if (/^\d+$/.test(regNum)) {
    return { label: "Registration Number", value: regNum };
  }
  return { label: "Registration Number", value: regNum };
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

  // Audit logging (preserved from original)
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";
  auditLog(slug, ip);

  const c = consultant;
  const scoreDimensions = computeScoreBreakdown(c);
  const regInfo = formatRegistrationNumber(c.registration_number);

  // Get specialty average for comparison
  const primarySpecialty = c.specialty_primary.length > 0 ? c.specialty_primary[0] : null;
  const specialtyAvg = primarySpecialty
    ? await getSpecialtyAverageScore(run.run_id, primarySpecialty)
    : null;

  const bookingLabel =
    c.booking_state === "bookable_with_slots"
      ? "Bookable"
      : c.booking_state === "bookable_no_slots"
      ? "No Slots"
      : "Not Bookable";

  const bookingColor =
    c.booking_state === "bookable_with_slots"
      ? "var(--success)"
      : c.booking_state === "bookable_no_slots"
      ? "var(--warning)"
      : "var(--text-muted)";

  return (
    <PageTransition className="space-y-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
        <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">
          Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/consultants" className="hover:text-[var(--text-primary)] transition-colors">
          Consultants
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-[var(--text-primary)] font-medium">
          {c.consultant_name ?? c.slug}
        </span>
      </nav>

      {/* Hero Section */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        {/* Left: Photo + Info */}
        <div className="flex items-start gap-5">
          {/* Photo placeholder */}
          <div className={`h-20 w-20 shrink-0 rounded-2xl flex items-center justify-center text-2xl font-bold ${
            c.has_photo
              ? "bg-[var(--sensai-teal)]/15 text-[var(--sensai-teal)]"
              : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
          }`}>
            {(c.consultant_name ?? c.slug).charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-h1 text-[var(--text-primary)]">
              {c.consultant_title_prefix && !c.consultant_name?.startsWith(c.consultant_title_prefix)
                ? `${c.consultant_title_prefix} `
                : ""}
              {c.consultant_name ?? c.slug}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
              {c.hospital_name_primary && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {c.hospital_name_primary}
                </span>
              )}
              {regInfo && (
                <span className="flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5" />
                  {regInfo.label}: {regInfo.value}
                </span>
              )}
              {c.practising_since && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Practising since {c.practising_since}
                </span>
              )}
            </div>
            {c.specialty_primary.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.specialty_primary.map((s, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-[var(--sensai-teal)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--sensai-teal)]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Action Button */}
        <a
          href={`https://www.nuffieldhealth.com/consultants/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-glass)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--border-hover)] hover:shadow-[0_0_20px_rgba(6,182,212,0.08)] transition-all"
        >
          <ExternalLink className="h-4 w-4" />
          View Live Profile
        </a>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 grid-cols-3">
        {/* Tier Card */}
        <GlassCard className="flex flex-col items-center justify-center py-6">
          <p className="text-caption text-[var(--text-muted)] mb-2">Quality Tier</p>
          {c.quality_tier ? (
            <TierBadge
              tier={c.quality_tier.toLowerCase() as "gold" | "silver" | "bronze" | "incomplete"}
              className="text-sm px-3 py-1"
            />
          ) : (
            <span className="text-sm text-[var(--text-muted)]">Not Assessed</span>
          )}
        </GlassCard>

        {/* Score Gauge */}
        <GlassCard className="flex flex-col items-center justify-center py-4">
          <p className="text-caption text-[var(--text-muted)] mb-2">Profile Score</p>
          {c.profile_completeness_score != null ? (
            <ScoreGauge score={Math.round(c.profile_completeness_score)} size="md" />
          ) : (
            <span className="text-sm text-[var(--text-muted)]">N/A</span>
          )}
        </GlassCard>

        {/* Booking Status */}
        <GlassCard className="flex flex-col items-center justify-center py-6">
          <p className="text-caption text-[var(--text-muted)] mb-2">Booking Status</p>
          <span className="text-sm font-medium" style={{ color: bookingColor }}>
            {bookingLabel}
          </span>
          {c.available_slots_next_28_days != null && c.available_slots_next_28_days > 0 && (
            <span className="mt-1 text-xs text-[var(--text-muted)]">
              {c.available_slots_next_28_days} slots available
            </span>
          )}
        </GlassCard>
      </div>

      {/* Tabs */}
      <ProfileTabs
        consultant={c}
        scoreDimensions={scoreDimensions}
        specialtyAvg={specialtyAvg}
      />
    </PageTransition>
  );
}
