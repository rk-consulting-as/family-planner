"use client";

import { useEffect } from "react";

// Setter dark-klasse på <html> basert på localStorage eller systempreferanse.
// Bør mountes en gang øverst i layouten.

export default function ThemeProvider() {
  useEffect(() => {
    const stored = localStorage.getItem("kinship-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = stored ? stored === "dark" : prefersDark;
    document.documentElement.classList.toggle("dark", dark);
  }, []);
  return null;
}
