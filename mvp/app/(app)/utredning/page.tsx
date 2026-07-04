import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import {
  ClipboardList, Calendar, Users, Activity,
  BookOpen, FileBarChart2, ArrowRight, AlertCircle, FlaskConical, Droplets,
} from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fmtDate(s: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(s + "T12:00:00").toLocaleDateString("nb-NO", opts ?? { day: "numeric", month: "short" });
}
function daysSince(s: string): number {
  return Math.floor((Date.now() - new Date(s + "T12:00:00").getTime()) / 86400000);
}
function daysUntil(s: string): number {
  return Math.ceil((new Date(s + "T12:00:00").getTime() - Date.now()) / 86400000);
}

const SCORE_COLOR = ["#DC2626","#EA580C","#D97706","#16A34A","#059669"];

const KIND_ICON: Record<string, string> = {
  meeting: "🤝", deadline: "⏰", action_item: "✅",
  past_event: "📌", document: "📄", decision: "⚖️", note: "📝",
};

// ── page ─────────────────────────────────────────────────────────────────────
export default async function UtredningPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const sb = await createClient();

  // ── Finn utredningsprosjekt (context_subject = 'Rakel', eller første aktive) ──
  const { data: projectsRaw } = await sb
    .from("projects")
    .select("id, title, description, status, started_at, context_subject")
    .is("deleted_at", null)
    .in("status", ["active", "paused"])
    .order("created_at", { ascending: true });

  type Proj = { id: string; title: string; description: string | null; status: string; started_at: string | null; context_subject: string | null };
  const projects = (projectsRaw || []) as Proj[];
  // Prioritér prosjekt med 'Rakel' i context_subject eller tittelen
  const project = projects.find(p =>
    p.context_subject?.toLowerCase().includes("rakel") ||
    p.title.toLowerCase().includes("utredning")
  ) ?? projects[0] ?? null;

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <AlertCircle className="w-10 h-10 text-slate-400" />
        <div>
          <p className="font-semibold text-slate-700">Ingen utredning funnet</p>
          <p className="text-sm text-slate-500 mt-1">Opprett et prosjekt under Planlegging → Prosjekter.</p>
        </div>
        <Link href="/prosjekter" className="text-sm text-brand-600 underline">Gå til prosjekter</Link>
      </div>
    );
  }

  const today = localDateStr(new Date());
  const now   = new Date().toISOString();

  // ── Parallell datahenting ──
  const [
    { data: milestonesRaw },
    { data: partiesRaw },
    { data: dagbokRaw },
    { data: bloodTestsRaw },
    { data: bloodAnalysisRaw },
  ] = await Promise.all([
    sb.from("project_milestones")
      .select("id, title, description, kind, status, occurred_at, due_at, ai_extracted")
      .eq("project_id", project.id)
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("occurred_at", { ascending: false, nullsFirst: false }),
    sb.from("project_parties")
      .select("id, name, role, organization, contact_info, notes, is_internal")
      .eq("project_id", project.id)
      .is("merged_into_id", null)
      .order("name"),
    sb.from("rakel_dagbok")
      .select("entry_date, day_score, mood_tags")
      .eq("group_id", ctx.group.id)
      .gte("entry_date", localDateStr(new Date(Date.now() - 14 * 86400000)))
      .lte("entry_date", today)
      .order("entry_date", { ascending: true }),
    sb.from("rakel_blood_tests")
      .select("id, test_date, institution, values")
      .eq("group_id", ctx.group.id)
      .order("test_date", { ascending: false })
      .limit(5),
    sb.from("rakel_blood_analysis")
      .select("analysis, updated_at")
      .eq("group_id", ctx.group.id)
      .maybeSingle(),
  ]);

  type MS = { id: string; title: string; description: string | null; kind: string; status: string; occurred_at: string | null; due_at: string | null; ai_extracted: boolean };
  type Party = { id: string; name: string; role: string | null; organization: string | null; contact_info: string | null; notes: string | null; is_internal: boolean };
  type DagbokRow = { entry_date: string; day_score: number | null; mood_tags: string[] };
  type BloodTestMini = { id: string; test_date: string; institution: string | null; values: Array<{ marker: string; value: number; unit: string; ref_min: number | null; ref_max: number | null }> };
  type BloodAnalysisMini = { urgency_level: string; overall_assessment: string; findings: Array<{ marker: string; status: string; trend: string }>; generated_at: string };

  const milestones    = (milestonesRaw || []) as MS[];
  const parties       = (partiesRaw || []) as Party[];
  const dagbok        = (dagbokRaw || []) as DagbokRow[];
  const bloodAnalysis = (bloodAnalysisRaw?.analysis ?? null) as BloodAnalysisMini | null;
  const bloodTests  = (bloodTestsRaw || []) as BloodTestMini[];

  // ── KPI-beregninger ──
  const upcoming = milestones.filter(m =>
    m.status === "planned" && m.due_at && m.due_at >= now &&
    (m.kind === "meeting" || m.kind === "deadline")
  ).slice(0, 5);

  const openTasks = milestones.filter(m =>
    m.status === "planned" && m.kind === "action_item"
  );

  const overdueTasks = milestones.filter(m =>
    m.status === "planned" && m.due_at && m.due_at < now
  );

  const externalParties = parties.filter(p => !p.is_internal);
  const totalEvents = milestones.filter(m => m.status === "completed" || m.occurred_at).length;

  const dagbokDays = dagbok.filter(d => d.day_score).length;
  const avgScore = dagbokDays > 0
    ? dagbok.filter(d => d.day_score).reduce((s, d) => s + (d.day_score ?? 0), 0) / dagbokDays
    : null;

  const startedAt = project.started_at ?? project.started_at;
  const dayCount  = startedAt ? daysSince(startedAt) : null;

  // Bygg 14-dagers-kart for dagbok
  const dagbokMap = new Map(dagbok.map(d => [d.entry_date, d]));
  const last14: { date: string; score: number | null }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const ds = localDateStr(d);
    last14.push({ date: ds, score: dagbokMap.get(ds)?.day_score ?? null });
  }

  return (
    <div className="space-y-5 pb-10">

      {/* ── HEADER ── */}
      <div className="rounded-2xl bg-[#1B3A5C] text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="w-5 h-5 opacity-70" />
            <span className="text-sm font-medium opacity-70">Utredning</span>
            {project.context_subject && (
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                Om: {project.context_subject}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold">{project.title}</h1>
          {project.description && (
            <p className="text-sm opacity-60 mt-1 max-w-lg line-clamp-2">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {overdueTasks.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              {overdueTasks.length} forfalt
            </span>
          )}
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            project.status === "active" ? "bg-green-400 text-green-900" : "bg-yellow-300 text-yellow-900"
          }`}>
            {project.status === "active" ? "Aktiv" : "Pauset"}
          </span>
          <Link
            href="/utredning/dokumentasjon"
            className="text-xs text-white/70 hover:text-white underline flex items-center gap-1"
          >
            Dokumentasjon <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* ── KPI-RAD ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiBox
          value={dayCount !== null ? `${dayCount}` : "—"}
          unit="dager"
          label="Siden oppstart"
          sub={startedAt ? fmtDate(startedAt, { day: "numeric", month: "long", year: "numeric" }) : ""}
          color="text-[#1B3A5C]"
          bg="bg-blue-50"
        />
        <KpiBox
          value={`${openTasks.length}`}
          unit="oppgaver"
          label="Åpne"
          sub={overdueTasks.length > 0 ? `${overdueTasks.length} forfalt` : "Ingen forfalte"}
          color={overdueTasks.length > 0 ? "text-red-600" : "text-amber-600"}
          bg={overdueTasks.length > 0 ? "bg-red-50" : "bg-amber-50"}
        />
        <KpiBox
          value={`${externalParties.length}`}
          unit="instanser"
          label="Involvert"
          sub={`${parties.length} totalt inkl. intern`}
          color="text-emerald-700"
          bg="bg-emerald-50"
        />
        <KpiBox
          value={`${totalEvents}`}
          unit="hendelser"
          label="I tidslinjen"
          sub={`${milestones.length} totalt`}
          color="text-violet-700"
          bg="bg-violet-50"
        />
      </div>

      {/* ── KOMMENDE + OPPGAVER ── */}
      <div className="grid sm:grid-cols-2 gap-4">

        {/* Kommende møter */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Kommende møter og frister
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">Ingen kommende registrert</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map(m => {
                const days = m.due_at ? daysUntil(m.due_at) : null;
                return (
                  <div key={m.id} className="flex gap-3 items-start">
                    {m.due_at && (
                      <div className="text-center bg-blue-50 rounded-lg px-2 py-1 min-w-[44px] flex-shrink-0">
                        <div className="text-lg font-black text-[#1B3A5C] leading-none">
                          {new Date(m.due_at + "T12:00:00" || m.due_at).getDate()}
                        </div>
                        <div className="text-[9px] uppercase text-slate-500">
                          {new Date(m.due_at + "T12:00:00" || m.due_at).toLocaleDateString("nb-NO", { month: "short" })}
                        </div>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span>{KIND_ICON[m.kind] ?? "📌"}</span>
                        <p className="text-sm font-semibold text-slate-800 truncate">{m.title}</p>
                      </div>
                      {days !== null && days <= 3 && (
                        <span className="inline-block mt-1 text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                          {days === 0 ? "I dag" : days === 1 ? "I morgen" : `Om ${days} dager`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Link href={`/prosjekter/${project.id}`}
            className="mt-4 text-xs text-brand-600 hover:underline flex items-center gap-1">
            Se alle i tidslinjen <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Åpne oppgaver */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" /> Åpne oppgaver
          </h2>
          {openTasks.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">Ingen åpne oppgaver 🎉</p>
          ) : (
            <div className="space-y-1.5">
              {openTasks.slice(0, 6).map(m => {
                const overdue = m.due_at && m.due_at < now;
                return (
                  <div key={m.id} className={`flex items-start gap-2 rounded-lg p-2 ${overdue ? "bg-red-50" : "bg-slate-50"}`}>
                    <span className="mt-0.5 text-sm">✅</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 leading-tight">{m.title}</p>
                      {m.due_at && (
                        <p className={`text-[10px] mt-0.5 font-medium ${overdue ? "text-red-600" : "text-slate-500"}`}>
                          {overdue ? "⚠ Forfalt " : "Frist "}{fmtDate(m.due_at)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              {openTasks.length > 6 && (
                <p className="text-xs text-slate-400 text-center pt-1">+ {openTasks.length - 6} til</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── DAGBOK + INSTANSER ── */}
      <div className="grid sm:grid-cols-2 gap-4">

        {/* Dagbok-miniatyr */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> Dagbok — siste 14 dager
          </h2>
          <div className="flex items-center gap-2 mb-3">
            {avgScore !== null ? (
              <>
                <span className="text-2xl font-black" style={{ color: SCORE_COLOR[Math.round(avgScore) - 1] }}>
                  {avgScore.toFixed(1)}
                </span>
                <span className="text-xs text-slate-500">snitt · {dagbokDays} dager logget</span>
              </>
            ) : (
              <span className="text-sm text-slate-400">Ingen oppføringer ennå</span>
            )}
          </div>

          {/* Mini bar chart */}
          <div className="flex gap-1 items-end h-10">
            {last14.map(d => (
              <div key={d.date} className="flex-1 flex flex-col justify-end" title={d.date}>
                {d.score ? (
                  <div
                    style={{
                      height: `${(d.score / 5) * 100}%`,
                      background: SCORE_COLOR[d.score - 1],
                      minHeight: 4,
                      borderRadius: 3,
                    }}
                  />
                ) : (
                  <div style={{ height: 3, background: "#E2E8F0", borderRadius: 3 }} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 mb-3">
            <span>{fmtDate(last14[0].date)}</span>
            <span>i dag</span>
          </div>

          <div className="flex gap-2">
            <Link href="/dagbok/rakel"
              className="flex-1 text-center text-xs font-semibold bg-[#1B3A5C] text-white rounded-lg py-2 hover:bg-[#243f5e] transition">
              Åpne dagbok
            </Link>
            <Link href="/dagbok/rakel/rapport"
              className="flex-1 text-center text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg py-2 hover:bg-slate-200 transition flex items-center justify-center gap-1">
              <FileBarChart2 className="w-3.5 h-3.5" /> Rapport
            </Link>
          </div>
        </div>

        {/* Instanser */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Instanser ({externalParties.length})
          </h2>
          {externalParties.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">
              Legg til instanser i prosjektet
            </p>
          ) : (
            <div className="space-y-2">
              {externalParties.map(p => (
                <div key={p.id} className="flex items-start gap-2.5 py-1.5 border-b border-slate-100 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-[#1B3A5C] mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                      {p.role && (
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full flex-shrink-0">
                          {p.role}
                        </span>
                      )}
                    </div>
                    {p.organization && (
                      <p className="text-xs text-slate-500 mt-0.5">{p.organization}</p>
                    )}
                    {p.contact_info && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{p.contact_info}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link href="/utredning/dokumentasjon"
            className="mt-3 text-xs text-brand-600 hover:underline flex items-center gap-1">
            Administrer instanser <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* ── BLODPRØVE ANALYSE KPI ── */}
      {bloodAnalysis && (() => {
        const URGENCY: Record<string, { label: string; bg: string; border: string; color: string; icon: string }> = {
          normal:  { label: "Alt OK",            bg: "bg-green-50",  border: "border-green-200", color: "text-green-700",  icon: "✅" },
          watch:   { label: "Følg med",          bg: "bg-amber-50",  border: "border-amber-200", color: "text-amber-700",  icon: "👁" },
          concern: { label: "Diskuter med lege", bg: "bg-orange-50", border: "border-orange-200",color: "text-orange-700", icon: "⚠️" },
          urgent:  { label: "Kontakt lege",      bg: "bg-red-50",    border: "border-red-200",   color: "text-red-700",   icon: "🚨" },
        };
        const urg = URGENCY[bloodAnalysis.urgency_level] ?? URGENCY.watch;
        const abnormal = bloodAnalysis.findings.filter((f: { status: string }) => f.status !== "normal");
        return (
          <div className={`rounded-2xl border-2 p-4 ${urg.bg} ${urg.border}`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">{urg.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h2 className={`text-sm font-bold ${urg.color}`}>Blodprøveanalyse · {urg.label}</h2>
                  {abnormal.length > 0 && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${urg.bg} ${urg.color} border ${urg.border}`}>
                      {abnormal.length} markør{abnormal.length !== 1 ? "er" : ""} krever oppmerksomhet
                    </span>
                  )}
                </div>
                <p className={`text-sm leading-snug ${urg.color} opacity-80`}>
                  {bloodAnalysis.overall_assessment.slice(0, 180)}{bloodAnalysis.overall_assessment.length > 180 ? "…" : ""}
                </p>
                {abnormal.length > 0 && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {abnormal.slice(0, 4).map((f: { marker: string; status: string; trend: string }, i: number) => (
                      <span key={i} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        f.status === "abnormal" ? "bg-red-100 text-red-700 border-red-200" : "bg-amber-100 text-amber-700 border-amber-200"
                      }`}>
                        {f.marker}
                      </span>
                    ))}
                    {abnormal.length > 4 && <span className="text-[10px] text-slate-400">+{abnormal.length - 4}</span>}
                  </div>
                )}
              </div>
              <Link href="/utredning/blodprover"
                className={`flex-shrink-0 text-xs font-semibold ${urg.color} underline flex items-center gap-0.5 whitespace-nowrap`}>
                Se analyse <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        );
      })()}

      {/* ── BLODPRØVER MINI ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Droplets className="w-3.5 h-3.5" /> Blodprøver — siste prøvetakinger
        </h2>
        {bloodTests.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Ingen blodprøver registrert ennå</p>
        ) : (
          <div className="space-y-2">
            {bloodTests.map(bt => {
              const anomalies = bt.values.filter(m => {
                if (m.ref_min !== null && m.value < m.ref_min) return true;
                if (m.ref_max !== null && m.value > m.ref_max) return true;
                return false;
              }).length;
              return (
                <div key={bt.id} className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
                  <div className="text-center bg-blue-50 rounded-lg px-2 py-1 min-w-[38px] flex-shrink-0">
                    <div className="text-sm font-black text-[#1B3A5C] leading-none">
                      {new Date(bt.test_date + "T12:00:00").getDate()}
                    </div>
                    <div className="text-[9px] uppercase text-slate-500">
                      {new Date(bt.test_date + "T12:00:00").toLocaleDateString("nb-NO", { month: "short" })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-700">{bt.institution || "Blodprøve"}</span>
                      {anomalies > 0 && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                          ⚠ {anomalies} utenfor ref.
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {bt.values.slice(0, 3).map((m, i) => {
                        const low = m.ref_min !== null && m.value < m.ref_min;
                        const high = m.ref_max !== null && m.value > m.ref_max;
                        return (
                          <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            high ? "bg-red-100 text-red-700" : low ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                          }`}>
                            {m.marker}: {m.value} {m.unit}
                          </span>
                        );
                      })}
                      {bt.values.length > 3 && <span className="text-[10px] text-slate-400">+{bt.values.length - 3}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Link href="/utredning/blodprover"
          className="mt-3 text-xs text-brand-600 hover:underline flex items-center gap-1">
          Se alle blodprøver <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* ── SNARVEIER ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Snarveier</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { href: "/utredning/dokumentasjon", icon: "📁", label: "Dokumentasjon", sub: `${milestones.length} hendelser` },
            { href: "/dagbok/rakel", icon: "📓", label: "Dagbok", sub: `${dagbokDays}/14 dager` },
            { href: "/dagbok/rakel/rapport", icon: "📊", label: "Rapport", sub: "Print / PDF" },
            { href: "/utredning/blodprover", icon: "🩸", label: "Blodprøver", sub: `${bloodTests.length} prøver` },
            { href: "/utredning/tester", icon: "🧪", label: "Tester", sub: "AQ-50 og mer" },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className="flex flex-col items-center text-center p-3 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 transition gap-1">
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs font-bold text-slate-700">{item.label}</span>
              <span className="text-[10px] text-slate-400">{item.sub}</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}

// ── KpiBox ────────────────────────────────────────────────────────────────────
function KpiBox({
  value, unit, label, sub, color, bg,
}: {
  value: string; unit: string; label: string; sub: string; color: string; bg: string;
}) {
  return (
    <div className={`${bg} rounded-xl p-4 border border-white`}>
      <div className={`text-2xl font-black ${color} leading-none`}>
        {value}
        <span className="text-sm font-semibold ml-1 opacity-70">{unit}</span>
      </div>
      <div className="text-xs font-semibold text-slate-700 mt-1">{label}</div>
      <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{sub}</div>
    </div>
  );
}
