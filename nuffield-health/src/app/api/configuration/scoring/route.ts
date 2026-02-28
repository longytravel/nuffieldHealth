import { NextResponse } from "next/server";
import { readScoringConfig, resetScoringConfig, saveScoringConfig } from "@/lib/scoring-config";
import {
  SCORING_WEIGHT_KEYS,
  coerceGateRules,
  coerceTierThresholds,
  isTierThresholdOrderValid,
  type PartialGateRules,
  type ScoringWeightKey,
} from "@/lib/scoring-config-schema";

interface SavePayload {
  action?: "save" | "reset";
  updatedBy?: string;
  weightsRaw?: Partial<Record<ScoringWeightKey, number>>;
  tierThresholds?: {
    gold?: number;
    silver?: number;
    bronze?: number;
  };
  gateRules?: PartialGateRules;
}

export async function GET() {
  const config = readScoringConfig();
  return NextResponse.json(config);
}

export async function POST(request: Request) {
  let payload: SavePayload;
  try {
    payload = (await request.json()) as SavePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updatedBy = payload.updatedBy?.trim() || "ROG";

  if (payload.action === "reset") {
    const config = resetScoringConfig(updatedBy);
    return NextResponse.json(config);
  }

  const tierThresholds = coerceTierThresholds(payload.tierThresholds);
  const gateRules = coerceGateRules(payload.gateRules);
  if (!isTierThresholdOrderValid(tierThresholds)) {
    return NextResponse.json(
      { error: "Thresholds must satisfy Gold > Silver > Bronze >= 0" },
      { status: 400 }
    );
  }

  const weightsRaw = payload.weightsRaw ?? {};
  const rawSum = SCORING_WEIGHT_KEYS.reduce((sum, key) => {
    const value = weightsRaw[key];
    return sum + (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0);
  }, 0);
  if (rawSum <= 0) {
    return NextResponse.json(
      { error: "At least one weight must be greater than zero" },
      { status: 400 }
    );
  }

  const config = saveScoringConfig({
    updatedBy,
    weightsRaw,
    tierThresholds,
    gateRules,
  });
  return NextResponse.json(config);
}
