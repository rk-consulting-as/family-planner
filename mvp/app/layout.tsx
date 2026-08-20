import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "@/components/layout/ThemeProvider";

export const metadata: Metadata = {
  title: "Familie Kvelland",
  description: "Familieplanner – kalender, skole, utredning og gjøremål.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Familie",
  },
  formatDetection: { telephone: false },
  themeColor: "#1c648e",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nb">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Familie" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <ThemeProvider />
        {children}
      </body>
    </html>
  );
}
