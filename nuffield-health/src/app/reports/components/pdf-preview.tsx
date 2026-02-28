"use client";

import { useRef, useState } from "react";
import {
  Download,
  Eye,
  Users,
  Award,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Loader2,
  Sparkles,
  ShieldAlert,
  Target,
  MessageSquare,
} from "lucide-react";
import Image from "next/image";
import { GlassCard } from "@/components/ui/glass-card";

interface PdfPreviewProps {
  runId: string;
  runDate: string;
  totalProfiles: number;
  avgScore: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  incompleteCount: number;
  quickActions: {
    description: string;
    profilesAffected: number;
    potentialUplift: number;
    totalImpact: number;
  }[];
  hospitalLeaderboard: {
    hospitalName: string;
    consultantCount: number;
    avgScore: number;
    goldCount: number;
    silverCount: number;
    bronzeCount: number;
    incompleteCount: number;
  }[];
  specialties: {
    specialty: string;
    consultantCount: number;
    avgScore: number;
    goldCount: number;
    silverCount: number;
    bronzeCount: number;
    incompleteCount: number;
    photoPct: number;
    bioQualityPct: number;
    bookablePct: number;
    avgPlainEnglish: number;
    insurerPct: number;
    commonFlags: { code: string; count: number }[];
  }[];
  impactSummary: {
    currentAvgScore: number;
    projectedAvgScore: number;
    currentGoldPct: number;
    projectedGoldPct: number;
    totalProfiles: number;
  };
  topPerformers: {
    consultantName: string;
    slug: string;
    hospitalName: string;
    qualityTier: string | null;
    score: number | null;
    bookingState: string | null;
    hasPhoto: boolean | null;
    bioDepth: string | null;
    insurerCount: number | null;
    plainEnglishScore: number | null;
  }[];
  atRiskProfiles: {
    consultantName: string;
    slug: string;
    hospitalName: string;
    qualityTier: string | null;
    score: number | null;
    bookingState: string | null;
    hasPhoto: boolean | null;
    bioDepth: string | null;
    insurerCount: number | null;
    plainEnglishScore: number | null;
  }[];
  aiReport: {
    boardHeadline: string;
    executiveSummary: string;
    strengths: string[];
    risks: string[];
    keyActions: {
      action: string;
      rationale: string;
      expectedImpact: string;
      timeHorizon: string;
    }[];
    boardQuestions: string[];
    confidenceNote: string;
    source: "claude-haiku" | "fallback";
  };
}

function triggerDownload(blob: Blob, filename: string): void {
  const nav = window.navigator as Navigator & {
    msSaveOrOpenBlob?: (file: Blob, defaultName?: string) => boolean;
  };

  if (typeof nav.msSaveOrOpenBlob === "function") {
    nav.msSaveOrOpenBlob(blob, filename);
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1500);
}

async function persistDownloadToDisk(blob: Blob, filename: string): Promise<void> {
  try {
    const formData = new FormData();
    const file = new File([blob], filename, {
      type: blob.type || "application/octet-stream",
    });
    formData.append("file", file);

    const response = await fetch("/api/reports/save-download", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const message = await response.text();
      console.warn("Server-side save failed:", message);
    }
  } catch (error) {
    console.warn("Server-side save failed:", error);
  }
}

function formatTierColor(tier: string | null): string {
  if (tier === "Gold") return "#F59E0B";
  if (tier === "Silver") return "#94A3B8";
  if (tier === "Bronze") return "#D97706";
  if (tier === "Incomplete") return "#EF4444";
  return "#6B7280";
}

function tierPercent(count: number, total: number): string {
  return total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
}

export function PdfPreview({
  runId,
  runDate,
  totalProfiles,
  avgScore,
  goldCount,
  silverCount,
  bronzeCount,
  incompleteCount,
  quickActions,
  hospitalLeaderboard,
  specialties,
  impactSummary,
  topPerformers,
  atRiskProfiles,
  aiReport,
}: PdfPreviewProps) {
  const templateRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const totalTiers = goldCount + silverCount + bronzeCount + incompleteCount;
  const goldPct = tierPercent(goldCount, totalTiers);
  const silverPct = tierPercent(silverCount, totalTiers);
  const bronzePct = tierPercent(bronzeCount, totalTiers);
  const incompletePct = tierPercent(incompleteCount, totalTiers);

  async function handleGeneratePdf() {
    if (!templateRef.current || isGenerating) return;
    setIsGenerating(true);

    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(templateRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");

      const pageWidth = 210;
      const pageHeight = 297;
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
        heightLeft -= pageHeight;
      }

      const pageCount = pdf.getNumberOfPages();
      for (let page = 1; page <= pageCount; page++) {
        pdf.setPage(page);
        pdf.setFontSize(8);
        pdf.setTextColor(120);
        pdf.text(`Page ${page} of ${pageCount}`, 200, 292, { align: "right" });
      }

      const pdfBlob = pdf.output("blob");
      const filename = `sensai-executive-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      triggerDownload(pdfBlob, filename);
      await persistDownloadToDisk(pdfBlob, filename);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setIsGenerating(false);
    }
  }

  function handlePreview() {
    if (!templateRef.current) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>SensAI Executive Report - Preview</title>
          <style>
            body { margin: 0; padding: 24px; font-family: system-ui, -apple-system, sans-serif; background: #fff; color: #111827; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #E5E7EB; padding: 6px; font-size: 11px; text-align: left; }
            th { background: #F9FAFB; font-weight: 600; }
            @media print { body { padding: 12px; } }
          </style>
        </head>
        <body>${templateRef.current.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-h3 text-[var(--text-primary)]">Executive PDF Report</h2>
          <p className="text-caption text-[var(--text-muted)]">
            Data-rich report with AI narrative, KPI graphs, and action tables
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePreview}
            className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
          <button
            onClick={handleGeneratePdf}
            disabled={isGenerating}
            className="flex items-center gap-2 rounded-lg bg-[var(--sensai-teal)] px-4 py-2 text-sm font-medium text-[var(--bg-primary)] transition-colors hover:bg-[var(--sensai-teal-light)] disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isGenerating ? "Generating..." : "Generate PDF"}
          </button>
        </div>
      </div>

      <GlassCard className="overflow-hidden p-0">
        <div ref={templateRef} className="space-y-6 bg-white p-8 text-gray-900">
          <div className="flex items-center justify-between border-b-2 border-[#06B6D4] pb-4">
            <Image
              src="/sensai-logo.png"
              alt="SensAI"
              width={140}
              height={35}
              className="h-9 w-auto"
            />
            <div className="text-right">
              <p className="text-xs text-gray-500">Working in partnership with</p>
              <p className="text-sm font-semibold text-[#1a5632]">Nuffield Health</p>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">Consultant Profile Quality Report</h1>
            <p className="mt-1 text-xs text-gray-500">
              Run {runId.slice(0, 8)} | Generated {runDate}
            </p>
          </div>

          <div className="rounded-xl border border-[#D1FAE5] bg-[#ECFEFF] p-4">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 text-[#0E7490]" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#0E7490]">
                  AI Board Headline ({aiReport.source === "claude-haiku" ? "Claude Haiku" : "Fallback"})
                </p>
                <p className="mt-1 text-sm font-semibold text-[#164E63]">{aiReport.boardHeadline}</p>
                <p className="mt-2 text-xs leading-relaxed text-[#155E75]">{aiReport.executiveSummary}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-[10px] uppercase tracking-wider text-gray-500">Total Profiles</span>
              </div>
              <p className="mt-1 font-mono text-lg font-bold text-gray-900">{totalProfiles}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-[10px] uppercase tracking-wider text-gray-500">Average Score</span>
              </div>
              <p className="mt-1 font-mono text-lg font-bold text-gray-900">{avgScore.toFixed(1)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-[#F59E0B]" />
                <span className="text-[10px] uppercase tracking-wider text-gray-500">Gold Tier</span>
              </div>
              <p className="mt-1 font-mono text-lg font-bold text-[#F59E0B]">{goldPct}%</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-[#EF4444]" />
                <span className="text-[10px] uppercase tracking-wider text-gray-500">Incomplete</span>
              </div>
              <p className="mt-1 font-mono text-lg font-bold text-[#EF4444]">{incompleteCount}</p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Quality Tier Distribution
            </h3>
            <div className="mt-2 flex h-6 overflow-hidden rounded-full">
              {goldCount > 0 && (
                <div className="flex items-center justify-center bg-[#F59E0B] text-[9px] font-bold text-white" style={{ width: `${goldPct}%` }}>
                  {goldPct}%
                </div>
              )}
              {silverCount > 0 && (
                <div className="flex items-center justify-center bg-[#94A3B8] text-[9px] font-bold text-white" style={{ width: `${silverPct}%` }}>
                  {silverPct}%
                </div>
              )}
              {bronzeCount > 0 && (
                <div className="flex items-center justify-center bg-[#D97706] text-[9px] font-bold text-white" style={{ width: `${bronzePct}%` }}>
                  {bronzePct}%
                </div>
              )}
              {incompleteCount > 0 && (
                <div className="flex items-center justify-center bg-[#EF4444] text-[9px] font-bold text-white" style={{ width: `${incompletePct}%` }}>
                  {incompletePct}%
                </div>
              )}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 text-[10px] text-gray-600">
              <span>Gold: {goldCount}</span>
              <span>Silver: {silverCount}</span>
              <span>Bronze: {bronzeCount}</span>
              <span>Incomplete: {incompleteCount}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-[#DCFCE7] bg-[#F0FDF4] p-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-[#15803D]" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#166534]">
                  Key Strengths
                </h4>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-[#14532D]">
                {aiReport.strengths.map((item, i) => (
                  <li key={`strength-${i}`}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-[#FEE2E2] bg-[#FEF2F2] p-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-[#B91C1C]" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#991B1B]">
                  Key Risks
                </h4>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-[#7F1D1D]">
                {aiReport.risks.map((item, i) => (
                  <li key={`risk-${i}`}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#0EA5E9]" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                AI Priority Action Plan
              </h4>
            </div>
            <table className="mt-2 w-full text-[10px]">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="border border-gray-200 px-2 py-1 text-left">Action</th>
                  <th className="border border-gray-200 px-2 py-1 text-left">Rationale</th>
                  <th className="border border-gray-200 px-2 py-1 text-left">Expected Impact</th>
                  <th className="border border-gray-200 px-2 py-1 text-left">Horizon</th>
                </tr>
              </thead>
              <tbody>
                {aiReport.keyActions.map((row, i) => (
                  <tr key={`ai-action-${i}`} className="align-top">
                    <td className="border border-gray-200 px-2 py-1 font-semibold text-gray-700">{row.action}</td>
                    <td className="border border-gray-200 px-2 py-1 text-gray-600">{row.rationale}</td>
                    <td className="border border-gray-200 px-2 py-1 text-gray-600">{row.expectedImpact}</td>
                    <td className="border border-gray-200 px-2 py-1 font-medium text-gray-700">{row.timeHorizon}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-200 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                Deterministic Top Actions
              </h4>
              <table className="mt-2 w-full text-[10px]">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="border border-gray-200 px-2 py-1 text-left">Action</th>
                    <th className="border border-gray-200 px-2 py-1 text-right">Affected</th>
                    <th className="border border-gray-200 px-2 py-1 text-right">Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {quickActions.slice(0, 5).map((a, i) => (
                    <tr key={`qa-${i}`}>
                      <td className="border border-gray-200 px-2 py-1 text-gray-700">{a.description}</td>
                      <td className="border border-gray-200 px-2 py-1 text-right font-mono text-gray-600">{a.profilesAffected}</td>
                      <td className="border border-gray-200 px-2 py-1 text-right font-mono text-gray-700">+{a.totalImpact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                Impact Projection
              </h4>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded border border-gray-200 bg-gray-50 p-2">
                  <p className="text-[10px] text-gray-500">Current Avg Score</p>
                  <p className="font-mono text-sm font-semibold text-gray-800">{impactSummary.currentAvgScore.toFixed(1)}</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 p-2">
                  <p className="text-[10px] text-gray-500">Projected Avg Score</p>
                  <p className="font-mono text-sm font-semibold text-[#0F766E]">{impactSummary.projectedAvgScore.toFixed(1)}</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 p-2">
                  <p className="text-[10px] text-gray-500">Current Gold %</p>
                  <p className="font-mono text-sm font-semibold text-gray-800">{impactSummary.currentGoldPct.toFixed(1)}%</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 p-2">
                  <p className="text-[10px] text-gray-500">Projected Gold %</p>
                  <p className="font-mono text-sm font-semibold text-[#0F766E]">{impactSummary.projectedGoldPct.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-200 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                Hospital Leaderboard
              </h4>
              <table className="mt-2 w-full text-[10px]">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="border border-gray-200 px-2 py-1 text-left">Hospital</th>
                    <th className="border border-gray-200 px-2 py-1 text-right">Avg</th>
                    <th className="border border-gray-200 px-2 py-1 text-right">Gold</th>
                  </tr>
                </thead>
                <tbody>
                  {hospitalLeaderboard.map((h, i) => (
                    <tr key={`hosp-${i}`}>
                      <td className="border border-gray-200 px-2 py-1 text-gray-700">{h.hospitalName}</td>
                      <td className="border border-gray-200 px-2 py-1 text-right font-mono text-gray-700">{h.avgScore.toFixed(1)}</td>
                      <td className="border border-gray-200 px-2 py-1 text-right font-mono text-gray-600">{h.goldCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                Top Specialty Performance
              </h4>
              <table className="mt-2 w-full text-[10px]">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="border border-gray-200 px-2 py-1 text-left">Specialty</th>
                    <th className="border border-gray-200 px-2 py-1 text-right">N</th>
                    <th className="border border-gray-200 px-2 py-1 text-right">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {specialties.map((s, i) => (
                    <tr key={`spec-${i}`}>
                      <td className="border border-gray-200 px-2 py-1 text-gray-700">{s.specialty}</td>
                      <td className="border border-gray-200 px-2 py-1 text-right font-mono text-gray-600">{s.consultantCount}</td>
                      <td className="border border-gray-200 px-2 py-1 text-right font-mono text-gray-700">{s.avgScore.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-200 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                Top Performing Profiles
              </h4>
              <table className="mt-2 w-full text-[10px]">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="border border-gray-200 px-2 py-1 text-left">Consultant</th>
                    <th className="border border-gray-200 px-2 py-1 text-right">Score</th>
                    <th className="border border-gray-200 px-2 py-1 text-right">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {topPerformers.map((p, i) => (
                    <tr key={`top-${i}`}>
                      <td className="border border-gray-200 px-2 py-1 text-gray-700">{p.consultantName}</td>
                      <td className="border border-gray-200 px-2 py-1 text-right font-mono text-gray-700">{p.score?.toFixed(1) ?? "-"}</td>
                      <td className="border border-gray-200 px-2 py-1 text-right font-semibold" style={{ color: formatTierColor(p.qualityTier) }}>
                        {p.qualityTier ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                At-Risk Profiles
              </h4>
              <table className="mt-2 w-full text-[10px]">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="border border-gray-200 px-2 py-1 text-left">Consultant</th>
                    <th className="border border-gray-200 px-2 py-1 text-right">Score</th>
                    <th className="border border-gray-200 px-2 py-1 text-right">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {atRiskProfiles.map((p, i) => (
                    <tr key={`risk-${i}`}>
                      <td className="border border-gray-200 px-2 py-1 text-gray-700">{p.consultantName}</td>
                      <td className="border border-gray-200 px-2 py-1 text-right font-mono text-gray-700">{p.score?.toFixed(1) ?? "-"}</td>
                      <td className="border border-gray-200 px-2 py-1 text-right font-semibold" style={{ color: formatTierColor(p.qualityTier) }}>
                        {p.qualityTier ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#0EA5E9]" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                Questions For Board Discussion
              </h4>
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-gray-700">
              {aiReport.boardQuestions.map((q, i) => (
                <li key={`q-${i}`}>{q}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-[10px] text-gray-600">
            <p className="font-semibold text-gray-700">Confidence Note</p>
            <p className="mt-1">{aiReport.confidenceNote}</p>
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 pt-3 text-[9px] text-gray-400">
            <span>SensAI Consultant Intelligence Platform | Confidential</span>
            <span>Generated from live run snapshot {runId.slice(0, 8)}</span>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Report Configuration</h3>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
          <span className="rounded bg-[var(--bg-elevated)] px-2 py-1">AI narrative</span>
          <span className="rounded bg-[var(--bg-elevated)] px-2 py-1">KPI and tier graphs</span>
          <span className="rounded bg-[var(--bg-elevated)] px-2 py-1">Action and impact tables</span>
          <span className="rounded bg-[var(--bg-elevated)] px-2 py-1">Hospital and specialty comparisons</span>
        </div>
      </GlassCard>
    </div>
  );
}
