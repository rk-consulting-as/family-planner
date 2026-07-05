"use client";

import { Printer } from "lucide-react";

const C_primary = "#1c648e";
const C_surface = "#ffffff";
const C_border  = "#ddeaf5";
const C_textMid = "#41484e";

export function PrintButton({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
  if (variant === "secondary") {
    return (
      <button
        onClick={() => window.print()}
        className="no-print"
        style={{
          display: "flex", alignItems: "center", gap: "0.4rem",
          padding: "0.65rem 1.25rem", borderRadius: "0.6rem",
          background: C_surface, border: `1px solid ${C_border}`,
          color: C_textMid, fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
        }}
      >
        <Printer size={15} /> Skriv ut / Lagre som PDF
      </button>
    );
  }
  return (
    <button
      onClick={() => window.print()}
      className="no-print"
      style={{
        display: "flex", alignItems: "center", gap: "0.4rem",
        padding: "0.55rem 1.1rem", borderRadius: "0.6rem",
        background: C_primary, border: "none",
        color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
      }}
    >
      <Printer size={15} /> Skriv ut / PDF
    </button>
  );
}
