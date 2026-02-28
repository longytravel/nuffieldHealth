import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppShell } from "@/components/ui/sidebar-nav";
import { MotionProvider } from "@/components/ui/motion-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SensAI - Consultant Profile Quality",
  description: "AI-powered consultant profile quality management dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        {/* Skip to content link — visible on focus for keyboard users */}
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-[100] -translate-y-16 rounded-lg bg-[var(--sensai-teal)] px-4 py-2 text-sm font-medium text-[var(--bg-primary)] shadow-lg transition-transform focus:translate-y-0"
        >
          Skip to main content
        </a>
        <MotionProvider>
          <AppShell>{children}</AppShell>
        </MotionProvider>
      </body>
    </html>
  );
}
