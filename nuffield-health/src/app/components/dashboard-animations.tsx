"use client";

import { motion, type Variants } from "framer-motion";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const kpiItem: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.25, ease: "easeOut" },
  },
};

/** Wraps the entire dashboard page content with a fade-in */
export function DashboardPageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeInUp}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="space-y-8"
    >
      {children}
    </motion.div>
  );
}

/** Wraps the KPI grid to stagger card entrances */
export function KpiStaggerGrid({
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

/** Wraps individual KPI cards for staggered entrance */
export function KpiStaggerItem({ children }: { children: React.ReactNode }) {
  return <motion.div variants={kpiItem}>{children}</motion.div>;
}

/** Wraps sections (donut chart, leaderboard) with delayed fade-in-up */
export function DashboardSection({
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
      variants={fadeInUp}
      transition={{ duration: 0.3, ease: "easeOut", delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
