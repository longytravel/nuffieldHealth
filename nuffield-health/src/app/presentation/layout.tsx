import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cambridge Spark",
};

export default function PresentationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
