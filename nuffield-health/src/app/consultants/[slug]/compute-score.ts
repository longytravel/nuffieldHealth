import type { ScoreDimension } from "@/lib/types";
import { getLegacyScoreConfig } from "@/lib/scoring-config";

interface ConsultantData {
  has_photo: boolean | null;
  bio_depth: string | null;
  treatments: string[];
  qualifications_credentials: string | null;
  specialty_primary: string[];
  specialty_sub: string[];
  insurers: string[];
  consultation_times_raw: string[];
  plain_english_score: number | null;
  booking_state: string | null;
  practising_since: number | null;
  memberships: string[];
}

export function computeScoreBreakdown(c: ConsultantData): ScoreDimension[] {
  const { weights } = getLegacyScoreConfig();

  return [
    {
      key: "photo",
      label: "Profile Photo",
      maxPoints: weights.has_photo,
      earned: c.has_photo ? weights.has_photo : 0,
    },
    {
      key: "bio_depth",
      label: "Biography Depth",
      maxPoints: weights.bio_depth_substantive,
      earned:
        c.bio_depth === "substantive"
          ? weights.bio_depth_substantive
          : c.bio_depth === "adequate"
          ? weights.bio_depth_adequate
          : 0,
    },
    {
      key: "treatments",
      label: "Treatments Listed",
      maxPoints: weights.treatments_non_empty,
      earned: c.treatments.length > 0 ? weights.treatments_non_empty : 0,
    },
    {
      key: "qualifications",
      label: "Qualifications",
      maxPoints: weights.qualifications_non_null,
      earned: c.qualifications_credentials != null ? weights.qualifications_non_null : 0,
    },
    {
      key: "specialty",
      label: "Specialty Defined",
      maxPoints: weights.specialty_primary_non_empty,
      earned:
        c.specialty_primary.length > 0 || c.specialty_sub.length > 0
          ? weights.specialty_primary_non_empty
          : 0,
    },
    {
      key: "insurers",
      label: "Insurers Listed",
      maxPoints: weights.insurers_non_empty,
      earned: c.insurers.length > 0 ? weights.insurers_non_empty : 0,
    },
    {
      key: "consultation_times",
      label: "Consultation Times",
      maxPoints: weights.consultation_times_non_empty,
      earned: c.consultation_times_raw.length > 0 ? weights.consultation_times_non_empty : 0,
    },
    {
      key: "plain_english",
      label: "Plain English Score",
      maxPoints: weights.plain_english_4_plus,
      earned:
        c.plain_english_score != null && c.plain_english_score >= 4
          ? weights.plain_english_4_plus
          : c.plain_english_score != null && c.plain_english_score >= 3
          ? weights.plain_english_3
          : 0,
    },
    {
      key: "booking",
      label: "Booking Availability",
      maxPoints: weights.booking_with_slots,
      earned:
        c.booking_state === "bookable_with_slots"
          ? weights.booking_with_slots
          : c.booking_state === "bookable_no_slots"
          ? weights.booking_no_slots
          : 0,
    },
    {
      key: "practising_since",
      label: "Practising Since",
      maxPoints: weights.practising_since_non_null,
      earned: c.practising_since != null ? weights.practising_since_non_null : 0,
    },
    {
      key: "memberships",
      label: "Memberships",
      maxPoints: weights.memberships_non_empty,
      earned: c.memberships.length > 0 ? weights.memberships_non_empty : 0,
    },
  ];
}
