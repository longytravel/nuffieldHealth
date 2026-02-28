"use client";

import { useState, type ReactNode } from "react";
import { FileText, Download, History } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportTabsProps {
  pdfPreview: ReactNode;
  csvExport: ReactNode;
  runHistory: ReactNode;
}

const TABS = [
  { id: "pdf", label: "Executive PDF", icon: FileText },
  { id: "csv", label: "CSV Export", icon: Download },
  { id: "history", label: "Run History", icon: History },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ReportTabs({ pdfPreview, csvExport, runHistory }: ReportTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("pdf");

  return (
    <div className="flex flex-col gap-6">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-glass)] p-1 backdrop-blur-xl">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-[var(--bg-elevated)] text-[var(--text-accent)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "pdf" && pdfPreview}
        {activeTab === "csv" && csvExport}
        {activeTab === "history" && runHistory}
      </div>
    </div>
  );
}
