import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/queries";
import Link from "next/link";
import { BookText, ChevronRight, Plus } from "lucide-react";

const C = {
  bg:         "#f6faff",
  surface:    "#ffffff",
  surfaceLow: "#ebf5ff",
  border:     "#ddeaf5",
  text:       "#111d25",
  textMuted:  "#71787f",
  primary:    "#1c648e",
};

const SUBJ: Record<string, string> = {
  engelsk: "Engelsk",
  sprak:   "Språk",
  matte:   "Matte",
  annet:   "Annet",
};

function weekLabel(wn: number | null, yr: number | null) {
  if (!wn) return "";
  return `Uke ${wn}${yr ? ` · ${yr}` : ""}`;
}

export default async function LesetreningPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;
  const sb = await createClient();

  const { data: sessions } = await sb
    .from("school_reading_sessions")
    .select("id, title, subject, book_title, created_at, week_number, year")
    .eq("group_id", ctx.group.id)
    .order("created_at", { ascending: false });

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.25rem" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
            <div style={{ background: C.surfaceLow, padding: "0.6rem", borderRadius: "0.875rem", border: `1px solid ${C.border}` }}>
              <BookText size={22} color={C.primary} />
            </div>
            <div>
              <h1 style={{ color: C.text, fontSize: "1.4rem", fontWeight: 800, margin: 0, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                Lesetrening
              </h1>
              <p style={{ color: C.textMuted, fontSize: "0.8rem", margin: 0 }}>
                AI-genererte spørsmål fra tekst
              </p>
            </div>
          </div>
          <Link href="/skole/lesetrening/ny" style={{
            display: "flex", alignItems: "center", gap: "0.4rem",
            background: C.primary, color: "#fff", textDecoration: "none",
            padding: "0.55rem 1rem", borderRadius: "0.625rem", fontSize: "0.875rem", fontWeight: 600,
          }}>
            <Plus size={16} />
            Ny økt
          </Link>
        </div>

        {/* Session list */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1rem", overflow: "hidden", boxShadow: "0 1px 3px rgba(17,29,37,.04)" }}>
          {(!sessions || sessions.length === 0) ? (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <BookText size={36} color={C.border} style={{ marginBottom: "0.75rem" }} />
              <p style={{ color: C.textMuted, fontSize: "0.9rem", margin: 0 }}>
                Ingen leseøkter ennå.<br />Klikk «Ny økt» for å laste opp en tekst og la AI lage spørsmål.
              </p>
            </div>
          ) : (
            sessions.map((s, i) => (
              <Link
                key={s.id}
                href={`/skole/lesetrening/${s.id}`}
                style={{
                  display: "flex", alignItems: "center",
                  padding: "1rem 1.25rem",
                  borderBottom: i < sessions.length - 1 ? `1px solid ${C.border}` : "none",
                  textDecoration: "none", gap: "1rem",
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: "0.625rem",
                  background: C.surfaceLow, border: `1px solid ${C.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <BookText size={18} color={C.primary} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.text, fontWeight: 600, fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.title}
                  </div>
                  <div style={{ color: C.textMuted, fontSize: "0.75rem", marginTop: "0.15rem" }}>
                    {SUBJ[s.subject] ?? s.subject}
                    {s.book_title && ` · ${s.book_title}`}
                    {s.week_number && ` · ${weekLabel(s.week_number, s.year)}`}
                  </div>
                </div>
                <ChevronRight size={16} color={C.textMuted} />
              </Link>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
