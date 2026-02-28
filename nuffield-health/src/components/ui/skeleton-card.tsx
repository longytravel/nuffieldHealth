import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  className?: string;
  lines?: number;
}

export function SkeletonCard({ className, lines = 3 }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-glass)] p-6 backdrop-blur-xl",
        className
      )}
    >
      {/* Icon placeholder */}
      <div className="mb-4 h-5 w-5 rounded animate-shimmer" />
      {/* Text lines */}
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="animate-shimmer rounded"
            style={{
              height: i === 0 ? "12px" : i === 1 ? "28px" : "12px",
              width: i === 0 ? "40%" : i === 1 ? "60%" : "30%",
            }}
          />
        ))}
      </div>
    </div>
  );
}
