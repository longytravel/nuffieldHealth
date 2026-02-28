"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Microscope,
  Zap,
  ClipboardCheck,
  FileText,
  Bot,
  ChevronRight,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { AiCopilot } from "@/components/ui/ai-copilot";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/consultants", label: "Consultants", icon: Users },
  { href: "/hospitals", label: "Hospitals", icon: Building2 },
  { href: "/specialties", label: "Specialties", icon: Microscope },
  { href: "/actions", label: "Actions", icon: Zap },
  { href: "/review", label: "Review", icon: ClipboardCheck },
  { href: "/reports", label: "Reports", icon: FileText },
];

const sidebarSpring = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

type ScreenSize = "mobile" | "tablet" | "desktop";

function useScreenSize(): ScreenSize {
  const [size, setSize] = useState<ScreenSize>("desktop");

  useEffect(() => {
    function update() {
      if (window.innerWidth < 768) setSize("mobile");
      else if (window.innerWidth < 1024) setSize("tablet");
      else setSize("desktop");
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return size;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const screenSize = useScreenSize();
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isMobile = screenSize === "mobile";
  const collapsed = screenSize === "tablet" ? true : desktopCollapsed;

  return (
    <div className="flex min-h-screen w-full">
      {/* Mobile hamburger button */}
      {isMobile && (
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] shadow-lg"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Mobile overlay backdrop */}
      <AnimatePresence>
        {isMobile && mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      {isMobile ? (
        <AnimatePresence>
          {mobileOpen && (
            <MobileSidebar onClose={() => setMobileOpen(false)} />
          )}
        </AnimatePresence>
      ) : (
        <DesktopSidebar
          collapsed={collapsed}
          onToggle={() => {
            if (screenSize !== "tablet") {
              setDesktopCollapsed((prev) => !prev);
            }
          }}
        />
      )}

      {/* Main content */}
      {isMobile ? (
        <main id="main-content" className="min-w-0 flex-1 p-4 pt-16">
          {children}
        </main>
      ) : (
        <motion.main
          id="main-content"
          animate={{ paddingLeft: collapsed ? 80 : 256 }}
          transition={sidebarSpring}
          className="min-w-0 flex-1 overflow-x-clip pb-6 pr-4 pt-6 md:pb-8 md:pr-6 md:pt-8 lg:pb-8 lg:pr-8 lg:pt-8"
        >
          {children}
        </motion.main>
      )}

      <AiCopilot />
    </div>
  );
}

/** Desktop/tablet sidebar with expand/collapse */
function DesktopSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={sidebarSpring}
      aria-label="Main navigation"
      className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden"
    >
      {/* Logo area */}
      <div className="flex flex-col border-b border-[var(--border-subtle)]">
        <div
          className={cn(
            "flex items-center overflow-hidden px-2 pt-3 pb-1",
            collapsed ? "justify-center" : "justify-start"
          )}
        >
          {collapsed ? (
            <div className="h-8 w-10 shrink-0 overflow-hidden">
              <Image
                src="/sensai-logo.png"
                alt="SensAI"
                width={200}
                height={100}
                className="h-8 w-auto max-w-none"
                style={{
                  objectFit: "cover",
                  objectPosition: "12% center",
                }}
                priority
              />
            </div>
          ) : (
            <Image
              src="/sensai-logo.png"
              alt="SensAI — Unifying Vision with AI"
              width={200}
              height={50}
              className="h-10 w-auto"
              priority
            />
          )}
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="px-3 pb-2 text-[9px] leading-tight text-[var(--text-muted)] overflow-hidden"
            >
              Working in partnership with Nuffield Health
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                    active
                      ? "bg-[var(--bg-elevated)] text-[var(--text-accent)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active-indicator"
                      className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--sensai-teal)]"
                      transition={sidebarSpring}
                    />
                  )}
                  <item.icon className="h-5 w-5 shrink-0" />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="whitespace-nowrap overflow-hidden"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-[var(--border-subtle)] px-2 py-3">
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--text-secondary)]",
            collapsed ? "justify-center" : ""
          )}
        >
          <Bot className="h-5 w-5 shrink-0 text-[var(--sensai-teal)]" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="text-[var(--text-muted)] whitespace-nowrap overflow-hidden"
              >
                AI Copilot
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div
          className={cn(
            "mt-1 flex items-center gap-3 rounded-lg px-3 py-2",
            collapsed ? "justify-center" : ""
          )}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-secondary)]">
            R
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="flex flex-col overflow-hidden"
              >
                <span className="text-xs text-[var(--text-muted)]">Welcome</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  ROG
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="flex h-10 items-center justify-center border-t border-[var(--border-subtle)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <motion.div
          animate={{ rotate: collapsed ? 0 : 180 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <ChevronRight className="h-4 w-4" />
        </motion.div>
      </button>
    </motion.aside>
  );
}

/** Mobile slide-in sidebar overlay */
function MobileSidebar({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <motion.aside
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      exit={{ x: -280 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      aria-label="Main navigation"
      className="fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl"
    >
      {/* Header with close */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
        <Image
          src="/sensai-logo.png"
          alt="SensAI"
          width={140}
          height={35}
          className="h-8 w-auto"
          priority
        />
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors duration-150",
                    active
                      ? "bg-[var(--bg-elevated)] text-[var(--text-accent)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--sensai-teal)]" />
                  )}
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom */}
      <div className="border-t border-[var(--border-subtle)] px-3 py-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--text-secondary)]">
          <Bot className="h-5 w-5 shrink-0 text-[var(--sensai-teal)]" />
          <span className="text-[var(--text-muted)]">AI Copilot</span>
        </div>
        <div className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-secondary)]">
            R
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs text-[var(--text-muted)]">Welcome</span>
            <span className="text-sm font-medium text-[var(--text-primary)]">ROG</span>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
