"use client";

import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface RewriteButtonProps {
  slug: string;
  element?: string;
  variant?: "icon-only" | "full";
  className?: string;
}

export function RewriteButton({
  slug,
  element,
  variant = "full",
  className,
}: RewriteButtonProps) {
  const router = useRouter();

  function handleClick() {
    const params = new URLSearchParams({ slug });
    if (element) params.set("element", element);
    router.push(`/rewrite?${params.toString()}`);
  }

  if (variant === "icon-only") {
    return (
      <button
        onClick={handleClick}
        title={element ? `Rewrite ${element}` : "Rewrite profile"}
        className={cn(
          "inline-flex items-center justify-center rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--sensai-teal)]",
          className
        )}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-[var(--sensai-teal)] bg-[var(--sensai-teal)]/10 hover:bg-[var(--sensai-teal)]/20 transition-colors",
        className
      )}
    >
      <Pencil className="h-3.5 w-3.5" />
      Improve
    </button>
  );
}
