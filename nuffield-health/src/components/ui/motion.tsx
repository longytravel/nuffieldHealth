"use client";

import { motion, type Variants } from "framer-motion";

/**
 * Shared animation variants for the SensAI platform.
 * All animations use subtle, professional timing (150-300ms, ease-out).
 * Respects prefers-reduced-motion via framer-motion's built-in support.
 */

// --- Fade-in-up for page-level sections ---
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

// --- Stagger container for child animations ---
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

// --- KPI card entrance ---
export const kpiCardVariant: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.25, ease: "easeOut" },
  },
};

// --- Section entrance (for donut chart, leaderboard, etc.) ---
export const sectionVariant: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

// --- Page wrapper for route transitions ---
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeInUp}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

// --- Stagger wrapper ---
export function StaggerContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// --- Staggered child ---
export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={kpiCardVariant} className={className}>
      {children}
    </motion.div>
  );
}

// --- Animated section ---
export function AnimatedSection({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={sectionVariant}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Re-export motion for direct use
export { motion };
