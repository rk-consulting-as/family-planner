import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/queries";
import Link from "next/link";
import { GraduationCap, BookText, Calendar, Calculator, ChevronRight, CheckCircle2, Clock } from "lucide-react";

const C = {
  bg:         "#f6faff",
  surface:    "#ffffff",
  surfaceLow: "#ebf5ff",
  border:     "#ddeaf5",
  text:       "#111d25",
  textMid:    "#41484e",
  textMuted:  "#71787f",
  primary:    "#1c648e",
  green:  { bg: "#e8f5e9", border: "#81c784", text: "#2c6956" },
  yellow: { bg: "#fffde7", border: "#f9c74f", text: "#765b06" },
};

function getWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export default async function SkolePage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;
  const sb = await createClient();
  const now = new Date();
  const week = getWeekNumber(now);
  const year = now.getFullYear();

  const [{ data: sessions }, { data: activities }] = await Promise.all([
    sb.from("school_reading_sessions")
      .select("id, title, subject, book_title, created_at, week_number")
      .eq("group_id", ctx.group.id)
      .order("created_at", { ascending: false })
      .limit(5),
    sb.from("school_week_activities")
      .select("id, title, activity_type, is_completed, day_of_week")
      .eq("group_id", ctx.group.id)
      .eq("week_number", week)
      .eq("year", year)
      .order("day_of_week"),
  ]);

  const walks = (activities ?? []).filter(a => a.activity_type === "walk");
  const walksLeft = Math.max(0, 3 - walks.filter(a => a.is_completed).length);
  const DAYS = ["", "Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
  const SUBJ: Record<string, string> = { engelsk: "Engelsk", sprak: "Språk", matte: "Matte", annet: "Annet" };

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.25rem" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", marginBottom: "2rem" }}>
          <div style={{ background: C.surfaceLow, padding: "0.6rem", borderRadius: "0.875rem", border: `1px solid ${C.border}` }}>
            <GraduationCap size={22} color={C.primary} />
          </div>
          <div>
            <h1 style={{ color: C.text, fontSize: "1.5rem", fontWeight: 800, margin: 0, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Skole
            </h1>
            <p style={{ color: C.textMuted, fontSize: "0.875rem", margin: 0 }}>
              Uke {week} · Engelskprosjekt, Språk og Matte
            </p>
          </div>
        </div>

        {/* Quick links */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.875rem", marginBottom: "2rem" }}>
          {[
            { href: "/skole/lesetrening", icon: BookText, label: "Lesetrening", sub: "Scan → AI spørsmål" },
            { href: "/skole/ukeplan",     icon: Calendar, label: "Ukeplan",     sub: `Uke ${week}` },
            { href: "/skole/matte",       icon: Calculator, label: "Matte",     sub: "Øvingsoppgaver" },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              textAlign: "center", padding: "1.25rem 0.75rem", borderRadius: "1rem",
              background: C.surface, border: `1px solid ${C.border}`, textDecoration: "none",
              boxShadow: "0 1px 3px rgba(17,29,37,.04)",
              transition: "border-color 0.15s",
            }}>
              <item.icon size={24} color={C.primary} style={{ marginBottom: "0.5rem" }} />
              <span style={{ color: C.text, fontSize: "0.875rem", fontWeight: 700 }}>{item.label}</span>
              <span style={{ color: C.textMuted, fontSize: "0.72rem", marginTop: "0.2rem" }}>{item.sub}</span>
            </Link>
          ))}
        </div>

        {/* Gåtur-mål */}
        <div style={{
          background: walksLeft === 0 ? C.green.bg : C.surface,
          border: `1px solid ${walksLeft === 0 ? C.green.border : C.border}`,
          borderRadius: "1rem", padding: "1rem 1.25rem",
          marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem",
        }}>
          <span style={{ fontSize: "1.75rem" }}>🚶</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: walksLeft === 0 ? C.green.text : C.text, fontWeight: 700, fontSize: "0.9rem" }}>
              Gåtur-mål denne uka: {walks.filter(a => a.is_completed).length}/3 fullført
            </div>
            <div style={{ color: C.textMuted, fontSize: "0.78rem", marginTop: "0.2rem" }}>
              {walksLeft === 0 ? "🎉 Ukens mål er nådd!" : `${walksLeft} gåtur${walksLeft !== 1 ? "er" : ""} igjen for å nå målet`}
            </div>
          </div>
          <Link href="/skole/ukeplan" style={{
            fontSize: "0.78rem", color: C.primary, fontWeight: 600,
            textDecoration: "none", padding: "0.35rem 0.75rem",
            borderRadius: "0.5rem", background: C.surfaceLow, border: `1px solid ${C.border}`,
          }}>
            Planlegg →
          </Link>
        </div>

        {/* Recent sessions */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1rem", overflow: "hidden", boxShadow: "0 1px 3px rgba(17,29,37,.04)" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: C.text, fontWeight: 700, fontSize: "0.9rem" }}>Siste leseøkter</span>
            <Link href="/skole/lesetrening/ny" style={{
              fontSize: "0.8rem", fontWeight: 600, color: "#fff",
              background: C.primary, textDecoration: "none",
              padding: "0.4rem 0.875rem", borderRadius: "0.5rem",
            }}>
              + Ny økt
            </Link>
          </div>

          {(!sessions || sessions.length === 0) ? (
            <div style={{ padding: "2rem", textAlign: "center", color: C.textMuted, fontSize: "0.875rem" }}>
              Ingen leseøkter ennå. Klikk «+ Ny økt» for å starte.
            </div>
          ) : (
            <div>
              {sessions.map(s => (
                <Link key={s.id} href={`/skole/lesetrening/${s.id}`} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "0.875rem 1.25rem", borderBottom: `1px solid ${C.border}`,
                  textDecoration: "none",
                }}>
                  <div>
                    <div style={{ color: C.text, fontWeight: 600, fontSize: "0.875rem" }}>{s.title}</div>
                    <div style={{ color: C.textMuted, fontSize: "0.75rem", marginTop: "0.15rem" }}>
                      {SUBJ[s.subject] ?? s.subject}
                      {s.book_title && ` · ${s.book_title}`}
                      {s.week_number && ` · Uke ${s.week_number}`}
                    </div>
                  </div>
                  <ChevronRight size={16} color={C.textMuted} />
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
