"use client";

import { useEffect } from "react";

// Setter dark-klasse på <html> BARE basert på eksplisitt brukervalg
// (localStorage). Vi auto-detekterer ikke systempreferanse fordi dark-mode
// trenger mer finpuss før det er trygt å rulle ut bredt.

export default function ThemeProvider() {
  useEffect(() => {
    const stored = localStorage.getItem("kinship-theme");
    const dark = stored === "dark";
    document.documentElement.classList.toggle("dark", dark);
  }, []);
  return null;
}
