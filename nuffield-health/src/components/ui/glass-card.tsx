"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlassCard({ className, children, hover = true }: GlassCardProps) {
  if (!hover) {
    return (
      <div
        className={cn(
          "rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-glass)] p-6 backdrop-blur-xl",
          className
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <motion.div
      whileHover={{
        scale: 1.008,
        boxShadow: "0 0 24px rgba(6, 182, 212, 0.1)",
        borderColor: "rgba(6, 182, 212, 0.3)",
      }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-glass)] p-6 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
