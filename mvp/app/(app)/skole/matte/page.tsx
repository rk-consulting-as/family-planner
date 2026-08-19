import { Calculator } from "lucide-react";

const C = {
  bg:         "#f6faff",
  surface:    "#ffffff",
  surfaceLow: "#ebf5ff",
  border:     "#ddeaf5",
  text:       "#111d25",
  textMuted:  "#71787f",
  primary:    "#1c648e",
};

export default function MattePage() {
  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.25rem" }}>

        <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", marginBottom: "2.5rem" }}>
          <div style={{ background: C.surfaceLow, padding: "0.6rem", borderRadius: "0.875rem", border: `1px solid ${C.border}` }}>
            <Calculator size={22} color={C.primary} />
          </div>
          <div>
            <h1 style={{ color: C.text, fontSize: "1.4rem", fontWeight: 800, margin: 0, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Matte-øving
            </h1>
            <p style={{ color: C.textMuted, fontSize: "0.8rem", margin: 0 }}>
              Scan oppgave → AI lager øvingsoppgaver
            </p>
          </div>
        </div>

        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: "1.25rem", padding: "3rem 2rem", textAlign: "center",
          boxShadow: "0 1px 4px rgba(17,29,37,.05)",
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔢</div>
          <h2 style={{ color: C.text, fontWeight: 700, fontSize: "1.1rem", margin: "0 0 0.5rem" }}>
            Kommer snart
          </h2>
          <p style={{ color: C.textMuted, fontSize: "0.875rem", maxWidth: 360, margin: "0 auto" }}>
            Her kan du ta bilde av en matteside. AI vil analysere oppgavene og lage tilsvarende øvingsoppgaver med tilpasset vanskelighetsgrad.
          </p>
        </div>

      </div>
    </div>
  );
}
