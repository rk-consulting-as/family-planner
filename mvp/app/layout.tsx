import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "@/components/layout/ThemeProvider";

export const metadata: Metadata = {
  title: "Kinship & Co",
  description: "Familie- og gruppeplanlegger med ukekalender, gjøremål og belønninger.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nb">
      <body>
        <ThemeProvider />
        {children}
      </body>
    </html>
  );
}
