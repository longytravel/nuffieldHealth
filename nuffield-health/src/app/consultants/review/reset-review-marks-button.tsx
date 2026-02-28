"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResetReviewMarksButtonProps {
  runId: string;
}

export function ResetReviewMarksButton({ runId }: ResetReviewMarksButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function resetRunReviews() {
    const confirmed = window.confirm(
      "Reset reviewed status for the current run? This will put all profiles back into review workflow."
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_run",
          run_id: runId,
        }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={resetRunReviews}
      className="gap-1.5"
    >
      <RotateCcw className="h-3.5 w-3.5" />
      {loading ? "Resetting..." : "Reset Reviewed Marks"}
    </Button>
  );
}
