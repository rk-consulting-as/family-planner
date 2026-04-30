import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Family Planner",
  description: "Familie- og gruppeplanlegger med ukekalender, gjøremål og belønninger.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nb">
      <body>{children}</body>
    </html>
  );
}
