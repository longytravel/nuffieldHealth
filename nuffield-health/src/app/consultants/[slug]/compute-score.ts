import type { ScoreDimension } from "@/lib/types";

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
  return [
    {
      key: "photo",
      label: "Profile Photo",
      maxPoints: 10,
      earned: c.has_photo ? 10 : 0,
    },
    {
      key: "bio_depth",
      label: "Biography Depth",
      maxPoints: 15,
      earned:
        c.bio_depth === "substantive"
          ? 15
          : c.bio_depth === "adequate"
          ? 10
          : c.bio_depth === "thin"
          ? 5
          : 0,
    },
    {
      key: "treatments",
      label: "Treatments Listed",
      maxPoints: 10,
      earned: c.treatments.length > 0 ? 10 : 0,
    },
    {
      key: "qualifications",
      label: "Qualifications",
      maxPoints: 10,
      earned: c.qualifications_credentials != null ? 10 : 0,
    },
    {
      key: "specialty",
      label: "Specialty Defined",
      maxPoints: 10,
      earned: c.specialty_primary.length > 0 || c.specialty_sub.length > 0 ? 10 : 0,
    },
    {
      key: "insurers",
      label: "Insurers Listed",
      maxPoints: 8,
      earned: c.insurers.length > 0 ? 8 : 0,
    },
    {
      key: "consultation_times",
      label: "Consultation Times",
      maxPoints: 7,
      earned: c.consultation_times_raw.length > 0 ? 7 : 0,
    },
    {
      key: "plain_english",
      label: "Plain English Score",
      maxPoints: 10,
      earned:
        c.plain_english_score != null && c.plain_english_score >= 4
          ? 10
          : c.plain_english_score != null && c.plain_english_score >= 3
          ? 5
          : 0,
    },
    {
      key: "booking",
      label: "Booking Availability",
      maxPoints: 10,
      earned:
        c.booking_state === "bookable_with_slots"
          ? 10
          : c.booking_state === "bookable_no_slots"
          ? 5
          : 0,
    },
    {
      key: "practising_since",
      label: "Practising Since",
      maxPoints: 5,
      earned: c.practising_since != null ? 5 : 0,
    },
    {
      key: "memberships",
      label: "Memberships",
      maxPoints: 5,
      earned: c.memberships.length > 0 ? 5 : 0,
    },
  ];
}
