"use client";

import { useRouter } from "next/navigation";

interface HospitalLeaderboardRowProps {
  href: string;
  children: React.ReactNode;
}

export function HospitalLeaderboardRow({ href, children }: HospitalLeaderboardRowProps) {
  const router = useRouter();

  return (
    <tr
      onClick={() => router.push(href)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(href); } }}
      tabIndex={0}
      role="link"
      aria-label="View hospital consultants"
      className="cursor-pointer border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-elevated)] last:border-0"
    >
      {children}
    </tr>
  );
}
