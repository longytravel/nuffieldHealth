"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ReviewActionsProps {
  runId: string;
  slug: string;
}

export function ReviewActions({ runId, slug }: ReviewActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function markReviewed() {
    setLoading(true);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: runId, slug }),
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
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={markReviewed}
    >
      {loading ? "Saving..." : "Mark Reviewed"}
    </Button>
  );
}
