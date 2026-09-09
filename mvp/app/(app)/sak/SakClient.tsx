"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Scale, Plus, AlertTriangle, CheckCircle2, Clock, FileText,
  ChevronDown, ChevronUp, BookOpen, X, Check, Trash2, Compass
} from "lucide-react";
import {
  createCaseEvent, deleteCaseEvent, markFollowUpDone
} from "@/lib/actions/case";
import type { CaseEvent, CaseDocument, EventType, Institution } from "@/lib/actions/case";

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:         "#f6faff",
  surface:    "#ffffff",
  surfaceLow: "#ebf5ff",
  border:     "#ddeaf5",
  text:       "#111d25",
  textMid:    "#41484e",
  textMuted:  "#71787f",
  primary:    "#1c648e",
  red:   { bg: "#fde8e8", border: "#f28b82", text: "#b71c1c" },
  green: { bg: "#e8f5e9", border: "#81c784", text: "#1b5e20" },
  orange:{ bg: "#fff3e0", border: "#ffb74d", text: "#e65100" },
  purple:{ bg: "#f3e5f5", border: "#ce93d8", text: "#4a148c" },
  teal:  { bg: "#e0f2f1", border: "#80cbc4", text: "#004d40" },
  blue:  { bg: "#e3f2fd", border: "#90caf9", text: "#0d47a1" },
  gray:  { bg: "#f5f5f5", border: "#bdbdbd", text: "#424242" },
};

// ── Norske lovhenvisninger (valgmeny) ──────────────────────────────────────────
const LEGAL_REFS = [
  { group: "Opplæringsloven (Oppl.)", refs: [
    "Oppl. § 5-1 — Rett til spesialundervisning",
    "Oppl. § 5-3 — Sakkyndig vurdering fra PPT",
    "Oppl. § 5-4 — Foreldrenes rett til å medvirke",
    "Oppl. § 5-5 — Individuell opplæringsplan (IOP)",
    "Oppl. § 5-6 — PPTs plikt til å hjelpe skolen",
    "Oppl. § 9A-2 — Rett til trygt og godt skolemiljø",
    "Oppl. § 9A-4 — Skolens aktivitetsplikt",
    "Oppl. § 9A-9 — Håndhevingsordning hos Statsforvalteren",
  ]},
  { group: "Forvaltningsloven (Fvl.)", refs: [
    "Fvl. § 17 — Forvaltningens utredningsplikt",
    "Fvl. § 24 — Plikt til å begrunne vedtak",
    "Fvl. § 28 — Rett til å klage på vedtak",
    "Fvl. § 35 — Omgjøring av ugyldig vedtak",
  ]},
  { group: "Pasient- og brukerrettighetsloven (Pbrl.)", refs: [
    "Pbrl. § 2-1a — Rett til nødvendig helsehjelp",
    "Pbrl. § 2-5 — Rett til individuell plan",
    "Pbrl. § 3-1 — Pasientens rett til medvirkning",
    "Pbrl. § 7-2 — Klage til Statsforvalteren",
  ]},
  { group: "Barnekonvensjonen (BK)", refs: [
    "BK art. 3 — Barnets beste",
    "BK art. 23 — Funksjonshemmede barns rettigheter",
    "BK art. 28 — Rett til utdanning",
  ]},
  { group: "Erstatning / ansvar", refs: [
    "Skl. § 2-1 — Det offentliges arbeidsgiveransvar",
    "Kommunens erstatningsansvar — svikt i tjenester",
    "Statens erstatningsansvar — langvarig svikt",
  ]},
];

// ── Veiledning: faseinndelt sjekkliste basert på norsk opplæringslov ───────────
type GuideItem = {
  title: string;
  type: EventType;
  institution: Institution;
  legal: string[];
  description: string;
  law_note?: string;
  is_violation?: boolean;
  required?: boolean;
};
type GuidePhase = {
  phase: string;
  desc: string;
  color: { bg: string; border: string; text: string };
  items: GuideItem[];
};

const GUIDE_PHASES: GuidePhase[] = [
  {
    phase: "1. Tidlig bekymring",
    desc: "Første signal fra skolen og skolens plikt til tilpasset opplæring",
    color: C.blue,
    items: [
      {
        title: "Første bekymringsmelding fra skolen",
        type: "rapport", institution: "Skole",
        legal: ["Oppl. § 5-1 — Rett til spesialundervisning"],
        description: "Skolen informerte oss for første gang om at Rakel slet med læringsutbytte eller trivsel. Logg dato, hvem som sa det og hva som ble sagt.",
        law_note: "Skolen har plikt til å melde bekymring til PPT dersom elever ikke har tilfredsstillende utbytte av opplæringen (Oppl. § 5-1, § 5-6). Logg dette som startpunkt for saken.",
        required: true,
      },
      {
        title: "Tilpasset opplæring ble forsøkt / iverksatt",
        type: "vedtak", institution: "Skole",
        legal: ["Oppl. § 5-1 — Rett til spesialundervisning"],
        description: "Skolen satte i gang tilpasset opplæring som alternativ til spesialundervisning. Hva ble gjort, og var det tilstrekkelig?",
        law_note: "Skolen SKAL prøve tilpasset opplæring, men har ikke lov til å bruke dette som unnskyldning for å vente med PPT-melding i årevis.",
      },
      {
        title: "Tilpasset opplæring var ikke tilstrekkelig — logg manglende tiltak",
        type: "brudd", institution: "Skole",
        legal: ["Oppl. § 5-1 — Rett til spesialundervisning", "Fvl. § 17 — Forvaltningens utredningsplikt"],
        description: "Tilpasset opplæring hjalp ikke, men skolen tok likevel ikke neste steg (PPT-melding). Logg tidsrom og hva som manglet.",
        law_note: "Jo lenger tid det tok fra bekymring ble kjent til PPT ble kontaktet, jo sterkere brudd. Dokumenter dette grundig.",
        is_violation: true,
      },
    ],
  },
  {
    phase: "2. PPT-melding og utredning",
    desc: "Hvem meldte, når, og hva PPT gjennomførte",
    color: C.purple,
    items: [
      {
        title: "PPT-melding ble sendt",
        type: "henvendelse", institution: "PPT",
        legal: ["Oppl. § 5-4 — Foreldrenes rett til å medvirke", "Oppl. § 5-6 — PPTs plikt til å hjelpe skolen"],
        description: "Skolen eller vi som foreldre meldte formelt til PPT om Rakel. Logg hvem som sendte, dato og eventuelle vedlegg.",
        law_note: "Foreldre kan selv kreve sakkyndig vurdering fra PPT (Oppl. § 5-4, 3. ledd). Skolen KAN IKKE nekte å sende meldingen videre. Å nekte eller utsette er et brudd.",
        required: true,
      },
      {
        title: "PPT bekreftet mottak og oppstart av utredning",
        type: "rapport", institution: "PPT",
        legal: ["Oppl. § 5-3 — Sakkyndig vurdering fra PPT"],
        description: "PPT bekreftet at de mottok meldingen og startet kartlegging. Hva ble sagt om fremdrift og tidsfrist?",
        law_note: "PPT har normalt 3 måneder på sakkyndig vurdering etter at melding er mottatt. Lengre saksbehandlingstid kan klages inn til Statsforvalteren.",
      },
      {
        title: "PPT-melding ble forsinket / avslått av skolen",
        type: "brudd", institution: "Skole",
        legal: ["Oppl. § 5-4 — Foreldrenes rett til å medvirke", "Oppl. § 5-6 — PPTs plikt til å hjelpe skolen", "Fvl. § 35 — Omgjøring av ugyldig vedtak"],
        description: "Skolen nektet å sende PPT-melding, ba oss vente, eller utsatte meldingen uten saklig grunn.",
        law_note: "Dette er et rettighetsbr. Foreldre kan gå direkte til PPT og be om sakkyndig vurdering uten å gå via skolen.",
        is_violation: true,
        required: true,
      },
      {
        title: "Sakkyndig vurdering mottatt fra PPT",
        type: "rapport", institution: "PPT",
        legal: ["Oppl. § 5-3 — Sakkyndig vurdering fra PPT"],
        description: "PPT leverte sin sakkyndige vurdering. Hva anbefalte den? Var vi enige? Ble anbefalingene fulgt?",
        law_note: "Vurderingen er ikke bindende for skolen, men skolen SKAL begrunne skriftlig hvorfor de eventuelt avviker fra den.",
        required: true,
      },
    ],
  },
  {
    phase: "3. Vedtak om spesialundervisning",
    desc: "Rektor fatter vedtak — rettigheter og klageadgang",
    color: C.teal,
    items: [
      {
        title: "Vedtak om spesialundervisning ble fattet",
        type: "vedtak", institution: "Skole",
        legal: ["Oppl. § 5-1 — Rett til spesialundervisning", "Fvl. § 24 — Plikt til å begrunne vedtak"],
        description: "Rektor fattet vedtak om spesialundervisning. Logg hva vedtaket inneholder, omfang (timer/uke), og om vi fikk tilstrekkelig begrunnelse.",
        law_note: "Vedtaket skal være skriftlig og begrunnet (Fvl. § 24). Klagefrist er 3 uker fra mottaksdato (Fvl. § 29).",
        required: true,
      },
      {
        title: "Vedtak ble avslått eller ga for lite hjelp",
        type: "brudd", institution: "Skole",
        legal: ["Oppl. § 5-1 — Rett til spesialundervisning", "Fvl. § 28 — Rett til å klage på vedtak", "Fvl. § 24 — Plikt til å begrunne vedtak"],
        description: "Skolen avslo søknad om spesialundervisning, eller vedtaket ga vesentlig mindre hjelp enn PPT anbefalte.",
        law_note: "Dere kan klage til Statsforvalteren innen 3 uker (Fvl. § 28). Statsforvalteren kan overprøve vedtaket.",
        is_violation: true,
      },
      {
        title: "For lang tid fra PPT-vurdering til vedtak",
        type: "brudd", institution: "Skole",
        legal: ["Oppl. § 5-3 — Sakkyndig vurdering fra PPT", "Fvl. § 17 — Forvaltningens utredningsplikt"],
        description: "Det tok urimelig lang tid fra PPT leverte sin vurdering til skolen fattet vedtak.",
        law_note: "Vedtaket skal fattes innen rimelig tid. Mer enn 2–3 måneder uten begrunnelse er et tegn på saksbehandlingssvikt.",
        is_violation: true,
      },
    ],
  },
  {
    phase: "4. IOP – Individuell Opplæringsplan",
    desc: "Utarbeidelse, innhold og halvårlig evaluering",
    color: { bg: "#e8f5e9", border: "#81c784", text: "#1b5e20" },
    items: [
      {
        title: "IOP ble utarbeidet",
        type: "rapport", institution: "Skole",
        legal: ["Oppl. § 5-5 — Individuell opplæringsplan (IOP)", "Oppl. § 5-4 — Foreldrenes rett til å medvirke"],
        description: "Skolen utarbeidet IOP i samarbeid med oss. Logg dato, hva IOP inneholder og om vi fikk delta i utarbeidelsen.",
        law_note: "IOP skal utarbeides innen 4 uker etter vedtak. Foreldre HAR RETT til å delta i utarbeidelsen (§ 5-4).",
        required: true,
      },
      {
        title: "IOP ikke utarbeidet innen 4 uker",
        type: "brudd", institution: "Skole",
        legal: ["Oppl. § 5-5 — Individuell opplæringsplan (IOP)"],
        description: "IOP ble ikke laget innen 4 uker etter vedtak, eller foreldre ble ikke involvert i utarbeidelsen.",
        law_note: "Manglende eller forsinket IOP er et direkte brudd på § 5-5. Dokumenter tidsforløpet nøye.",
        is_violation: true,
        required: true,
      },
      {
        title: "Halvårsrapport / evaluering av IOP mottatt",
        type: "rapport", institution: "Skole",
        legal: ["Oppl. § 5-5 — Individuell opplæringsplan (IOP)"],
        description: "Skolen sendte halvårsrapport. Hva sier rapporten om Rakels utvikling og IOP-måloppnåelse?",
        law_note: "Skolen plikter å sende halvårsrapport til foreldre hvert halvår (Oppl. § 5-5, siste ledd). Manglende rapport er et brudd.",
        required: true,
      },
      {
        title: "Halvårsrapport mangler / ble ikke sendt",
        type: "brudd", institution: "Skole",
        legal: ["Oppl. § 5-5 — Individuell opplæringsplan (IOP)"],
        description: "Vi mottok ikke halvårsrapport for det aktuelle halvåret.",
        is_violation: true,
      },
    ],
  },
  {
    phase: "5. Skolemiljø (§ 9A)",
    desc: "Aktivitetsplikt og Statsforvalterens håndhevingsordning",
    color: C.orange,
    items: [
      {
        title: "Bekymring for Rakels trivsel og skolemiljø meldt til skolen",
        type: "henvendelse", institution: "Skole",
        legal: ["Oppl. § 9A-2 — Rett til trygt og godt skolemiljø", "Oppl. § 9A-4 — Skolens aktivitetsplikt"],
        description: "Vi meldte bekymring til skolen om at Rakel ikke hadde det bra på skolen. Logg hva vi sa og til hvem.",
        law_note: "Skolen har aktivitetsplikt og SKAL undersøke og sette inn tiltak innen rimelig tid. Det holder at skolen 'hadde grunn til å tro' at eleven ikke hadde det bra — de behøver ikke bevis.",
      },
      {
        title: "Skolen fulgte ikke opp aktivitetsplikten",
        type: "brudd", institution: "Skole",
        legal: ["Oppl. § 9A-4 — Skolens aktivitetsplikt", "Oppl. § 9A-9 — Håndhevingsordning hos Statsforvalteren"],
        description: "Skolen undersøkte ikke, satte ikke inn tiltak, eller tiltakene var åpenbart utilstrekkelige.",
        law_note: "Dere kan klage direkte til Statsforvalteren under § 9A-9. Statsforvalteren kan gi pålegg og fatte vedtak om tiltak selv dersom skolen ikke følger opp.",
        is_violation: true,
      },
    ],
  },
  {
    phase: "6. Klager og juridisk opptrapping",
    desc: "Klage til Statsforvalter, erstatningskrav og dokumentasjon av tap",
    color: C.red,
    items: [
      {
        title: "Formell klage sendt til Statsforvalteren",
        type: "klage", institution: "Statsforvalter",
        legal: ["Fvl. § 28 — Rett til å klage på vedtak", "Oppl. § 9A-9 — Håndhevingsordning hos Statsforvalteren"],
        description: "Vi sendte formell klage til Statsforvalteren. Logg dato, hva klagen gjelder, og hva vi forventer som svar.",
        law_note: "Klagefristen er 3 uker fra vedtak ble mottatt (Fvl. § 29). Klagen skal normalt sendes via skolen/kommunen, men kan ved særlige grunner sendes direkte.",
      },
      {
        title: "Dokumentasjon av økonomisk tap (far mistet jobb)",
        type: "rapport", institution: "NAV",
        legal: ["Skl. § 2-1 — Det offentliges arbeidsgiveransvar", "Kommunens erstatningsansvar — svikt i tjenester"],
        description: "Dokumenter at langvarig involvering i Rakels sak og utilstrekkelig oppfølging fra skolen/PPT påvirket arbeidsevnen og resulterte i tap av stilling/inntekt.",
        law_note: "Erstatningskrav krever: (1) ansvarlig feil eller forsømmelse fra det offentlige, (2) dokumentert økonomisk tap, (3) årsakssammenheng mellom feil og tap. Tap av stilling og inntekt kan dokumenteres med arbeidskontrakt, oppsigelse, lønnslipper og legeerklæring.",
        required: true,
      },
      {
        title: "Erstatningskrav fremsatt mot kommunen",
        type: "klage", institution: "Kommune",
        legal: ["Skl. § 2-1 — Det offentliges arbeidsgiveransvar", "Kommunens erstatningsansvar — svikt i tjenester", "Statens erstatningsansvar — langvarig svikt"],
        description: "Erstatningskrav ble formelt fremsatt mot kommunen for langvarig svikt i oppfølging av Rakel og konsekvensene dette har hatt for familien.",
        law_note: "Kommunen kan holdes erstatningsansvarlig etter arbeidsgiveransvaret (Skl. § 2-1) for ansattes feil/forsømmelse. Konsulter advokat for konkret vurdering.",
      },
    ],
  },
];

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: "møte",         label: "Møte / samtale" },
  { value: "vedtak",       label: "Vedtak / beslutning" },
  { value: "rapport",      label: "Rapport / dokument" },
  { value: "henvendelse",  label: "Henvendelse (fra oss)" },
  { value: "brudd",        label: "Brudd / manglende oppfølging" },
  { value: "klage",        label: "Klage" },
  { value: "annet",        label: "Annet" },
];

const INSTITUTIONS: { value: Institution; label: string }[] = [
  { value: "Skole",          label: "Skole" },
  { value: "PPT",            label: "PPT (Ped.-psyk. tjeneste)" },
  { value: "BUP",            label: "BUP (Barne- og ungdomspsyk.)" },
  { value: "ABUP",           label: "ABUP" },
  { value: "HABU",           label: "HABU (Habiliteringstjenesten)" },
  { value: "Fastlege",       label: "Fastlege / spesialist" },
  { value: "NAV",            label: "NAV" },
  { value: "Kommune",        label: "Kommune / kommunedirektør" },
  { value: "Statsforvalter", label: "Statsforvalter / Fylkesmann" },
  { value: "annet",          label: "Annet" },
];

function eventColor(type: EventType) {
  switch (type) {
    case "møte":        return C.blue;
    case "vedtak":      return C.purple;
    case "rapport":     return C.teal;
    case "henvendelse": return C.orange;
    case "brudd":       return C.red;
    case "klage":       return C.orange;
    default:            return C.gray;
  }
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  events: CaseEvent[];
  documents: CaseDocument[];
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SakClient({ events, documents }: Props) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("alle");
  const [filterInst, setFilterInst] = useState<string>("alle");
  const [filterViolation, setFilterViolation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showRights, setShowRights] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);

  // New event form state
  const [form, setForm] = useState({
    event_date: new Date().toISOString().split("T")[0],
    event_type: "møte" as EventType,
    institution: "Skole" as Institution,
    title: "",
    description: "",
    responsible_party: "",
    attendees: "",
    legal_refs: [] as string[],
    is_rights_violation: false,
    violation_notes: "",
    outcome: "",
    follow_up_required: false,
    follow_up_notes: "",
  });

  const violations   = events.filter(e => e.is_rights_violation).length;
  const pending      = events.filter(e => e.follow_up_required && !e.follow_up_done).length;
  const institutions = [...new Set(events.map(e => e.institution))].length;

  const filtered = events.filter(e => {
    if (filterType !== "alle" && e.event_type !== filterType) return false;
    if (filterInst !== "alle" && e.institution !== filterInst) return false;
    if (filterViolation && !e.is_rights_violation) return false;
    return true;
  });

  async function handleSave() {
    if (!form.title.trim() || !form.event_date) return;
    setSaving(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (k === "legal_refs") fd.set(k, (v as string[]).join(","));
      else fd.set(k, String(v));
    });
    await createCaseEvent(fd);
    setSaving(false);
    setShowNew(false);
    setForm(f => ({ ...f, title: "", description: "", legal_refs: [], violation_notes: "", outcome: "", follow_up_notes: "", attendees: "", responsible_party: "" }));
    router.refresh();
  }

  function toggleLegalRef(ref: string) {
    setForm(f => ({
      ...f,
      legal_refs: f.legal_refs.includes(ref)
        ? f.legal_refs.filter(r => r !== ref)
        : [...f.legal_refs, ref],
    }));
  }

  function presetFromTemplate(tpl: GuideItem) {
    setForm(f => ({
      ...f,
      title: tpl.title,
      description: tpl.description,
      event_type: tpl.type,
      institution: tpl.institution,
      legal_refs: tpl.legal,
      is_rights_violation: tpl.is_violation ?? false,
      violation_notes: "",
      follow_up_required: false,
      follow_up_notes: "",
      attendees: "",
      responsible_party: "",
      outcome: "",
    }));
    setShowGuide(false);
    setShowNew(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.6rem 0.875rem",
    borderRadius: "0.625rem", border: `1px solid ${C.border}`,
    background: C.surface, color: C.text, fontSize: "0.875rem",
    outline: "none", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = {
    display: "block", color: C.textMid, fontSize: "0.775rem",
    fontWeight: 600, marginBottom: "0.3rem",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.25rem" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <div style={{ background: C.surfaceLow, padding: "0.6rem", borderRadius: "0.875rem", border: `1px solid ${C.border}` }}>
            <Scale size={22} color={C.primary} />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ color: C.text, fontSize: "1.3rem", fontWeight: 800, margin: 0, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Sak / Juridisk dokumentasjon
            </h1>
            <p style={{ color: C.textMuted, fontSize: "0.8rem", margin: 0 }}>
              Hendelseslogg, rettighetsoversikt og bevisarkiv for Rakel
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => { setShowGuide(!showGuide); setShowRights(false); }}
              style={{ background: showGuide ? C.primary : C.surfaceLow, border: `1px solid ${showGuide ? C.primary : C.border}`, borderRadius: "0.625rem", padding: "0.5rem 0.875rem", color: showGuide ? "#fff" : C.primary, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              <Compass size={15} /> Veiledning
            </button>
            <button
              onClick={() => { setShowRights(!showRights); setShowGuide(false); }}
              style={{ background: C.surfaceLow, border: `1px solid ${C.border}`, borderRadius: "0.625rem", padding: "0.5rem 0.875rem", color: C.primary, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              <BookOpen size={15} /> Rettigheter
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {[
            { label: "Hendelser totalt", value: events.length, color: C.primary },
            { label: "Rettighetsbr.", value: violations, color: violations > 0 ? C.red.text : C.green.text },
            { label: "Venter oppfølg.", value: pending, color: pending > 0 ? C.orange.text : C.green.text },
          ].map(s => (
            <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.875rem", padding: "1rem", textAlign: "center", boxShadow: "0 1px 3px rgba(17,29,37,.04)" }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: "0.75rem", color: C.textMuted, marginTop: "0.1rem" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Rights panel */}
        {showRights && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1rem", padding: "1.25rem", marginBottom: "1.5rem", boxShadow: "0 1px 3px rgba(17,29,37,.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ color: C.text, fontSize: "1rem", fontWeight: 700, margin: 0 }}>Relevante rettigheter og lovhenvisninger</h2>
              <button onClick={() => setShowRights(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color={C.textMuted} /></button>
            </div>
            {LEGAL_REFS.map(g => (
              <div key={g.group} style={{ marginBottom: "1rem" }}>
                <div style={{ color: C.primary, fontSize: "0.775rem", fontWeight: 700, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>{g.group}</div>
                {g.refs.map(r => {
                  const [code, ...rest] = r.split(" — ");
                  return (
                    <div key={r} style={{ padding: "0.4rem 0.75rem", marginBottom: "0.25rem", borderRadius: "0.5rem", background: C.surfaceLow, fontSize: "0.82rem", color: C.text }}>
                      <span style={{ fontWeight: 700, color: C.primary }}>{code}</span>
                      {rest.length > 0 && <span style={{ color: C.textMid }}> — {rest.join(" — ")}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
            <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: C.orange.bg, border: `1px solid ${C.orange.border}`, borderRadius: "0.625rem", fontSize: "0.8rem", color: C.orange.text }}>
              <strong>Tips:</strong> Bruk Statsforvalterens håndhevingsordning (Oppl. § 9A-9) hvis skolen ikke følger opp skolemiljøsaker. Klagefrist er normalt 3 uker etter at vedtak er mottatt (Fvl. § 29).
            </div>
          </div>
        )}

        {/* Guide panel */}
        {showGuide && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1rem", padding: "1.25rem", marginBottom: "1.5rem", boxShadow: "0 1px 3px rgba(17,29,37,.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
              <div>
                <h2 style={{ color: C.text, fontSize: "1rem", fontWeight: 700, margin: 0 }}>Saksveiledning — Rakels opplæringsrettigheter</h2>
                <p style={{ color: C.textMuted, fontSize: "0.8rem", margin: "0.3rem 0 0" }}>
                  Faseinndelt sjekkliste basert på Opplæringsloven. Klikk «Logg hendelse» for å forhåndsutfylle skjemaet med riktig type, instans og lovhenvisninger.
                </p>
              </div>
              <button onClick={() => setShowGuide(false)} style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}><X size={18} color={C.textMuted} /></button>
            </div>

            {/* Utredning-tip */}
            <div style={{ background: C.blue.bg, border: `1px solid ${C.blue.border}`, borderRadius: "0.625rem", padding: "0.625rem 0.875rem", marginBottom: "1rem", fontSize: "0.8rem", color: C.blue.text }}>
              <strong>💡 Tips:</strong> Du kan bruke datoer og dokumenter fra <strong>Utredning</strong>-modulen som kilde. Finn hendelsen der, noter dato og innhold, og logg den her som juridisk bevisførsel.
            </div>

            {/* Phases */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {GUIDE_PHASES.map((phase, pi) => {
                const open = expandedPhase === pi;
                return (
                  <div key={pi} style={{ border: `1px solid ${phase.color.border}`, borderRadius: "0.75rem", overflow: "hidden" }}>
                    {/* Phase header */}
                    <button
                      onClick={() => setExpandedPhase(open ? null : pi)}
                      style={{ width: "100%", background: phase.color.bg, border: "none", padding: "0.75rem 1rem", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: phase.color.text, fontSize: "0.875rem" }}>{phase.phase}</div>
                        <div style={{ color: phase.color.text, fontSize: "0.75rem", opacity: 0.8 }}>{phase.desc}</div>
                      </div>
                      {open ? <ChevronUp size={16} color={phase.color.text} /> : <ChevronDown size={16} color={phase.color.text} />}
                    </button>

                    {/* Phase items */}
                    {open && (
                      <div style={{ background: C.surface, padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                        {phase.items.map((item, ii) => (
                          <div key={ii} style={{ border: `1px solid ${item.is_violation ? C.red.border : C.border}`, borderRadius: "0.625rem", padding: "0.75rem", background: item.is_violation ? C.red.bg : C.surfaceLow }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.4rem" }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                                  {item.required && (
                                    <span style={{ background: "#fff3cd", border: "1px solid #ffc107", color: "#856404", borderRadius: "0.3rem", padding: "0.05rem 0.4rem", fontSize: "0.65rem", fontWeight: 700 }}>
                                      NØKKELMILEPÆL
                                    </span>
                                  )}
                                  {item.is_violation && (
                                    <span style={{ background: C.red.bg, border: `1px solid ${C.red.border}`, color: C.red.text, borderRadius: "0.3rem", padding: "0.05rem 0.4rem", fontSize: "0.65rem", fontWeight: 700 }}>
                                      ⚠ RETTIGHETSBR.
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontWeight: 700, color: item.is_violation ? C.red.text : C.text, fontSize: "0.85rem" }}>{item.title}</div>
                                <div style={{ color: C.textMid, fontSize: "0.78rem", marginTop: "0.2rem" }}>{item.description}</div>
                                {item.law_note && (
                                  <div style={{ marginTop: "0.35rem", fontSize: "0.75rem", color: C.primary, fontStyle: "italic" }}>
                                    📖 {item.law_note}
                                  </div>
                                )}
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.4rem" }}>
                                  {item.legal.map(r => (
                                    <span key={r} style={{ background: C.blue.bg, border: `1px solid ${C.blue.border}`, color: C.blue.text, borderRadius: "0.3rem", padding: "0.05rem 0.45rem", fontSize: "0.68rem", fontWeight: 700 }}>
                                      {r.split(" — ")[0]}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <button
                                onClick={() => presetFromTemplate(item)}
                                style={{ flexShrink: 0, background: C.primary, color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.4rem 0.75rem", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem", whiteSpace: "nowrap" }}
                              >
                                <Plus size={13} /> Logg hendelse
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom note */}
            <div style={{ marginTop: "1rem", padding: "0.75rem", background: C.orange.bg, border: `1px solid ${C.orange.border}`, borderRadius: "0.625rem", fontSize: "0.8rem", color: C.orange.text }}>
              <strong>Viktig for erstatningssak:</strong> Dokumenter alltid (1) hva som ble lovet, (2) hva som faktisk skjedde, (3) tidsgap mellom lov og gjennomføring, og (4) konsekvenser for Rakel og familien. Jo mer konkret og datert, jo sterkere sak.
            </div>
          </div>
        )}

        {/* Filters + Add button */}
        <div style={{ display: "flex", gap: "0.625rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={{ ...inp, width: "auto", flex: "1 1 140px" }}>
            <option value="alle">Alle typer</option>
            {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={filterInst} onChange={e => setFilterInst(e.target.value)}
            style={{ ...inp, width: "auto", flex: "1 1 140px" }}>
            <option value="alle">Alle instanser</option>
            {INSTITUTIONS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
          <button
            onClick={() => setFilterViolation(!filterViolation)}
            style={{
              padding: "0.6rem 0.875rem", borderRadius: "0.625rem", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
              background: filterViolation ? C.red.bg : C.surface,
              border: `1px solid ${filterViolation ? C.red.border : C.border}`,
              color: filterViolation ? C.red.text : C.textMid,
            }}
          >
            ⚠ Brudd kun
          </button>
          <button
            onClick={() => setShowNew(true)}
            style={{ marginLeft: "auto", background: C.primary, color: "#fff", border: "none", borderRadius: "0.75rem", padding: "0.6rem 1rem", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <Plus size={16} /> Ny hendelse
          </button>
        </div>

        {/* New event form */}
        {showNew && (
          <div style={{ background: C.surface, border: `2px solid ${C.primary}`, borderRadius: "1rem", padding: "1.5rem", marginBottom: "1.5rem", boxShadow: "0 4px 12px rgba(28,100,142,.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <h2 style={{ color: C.text, fontSize: "1rem", fontWeight: 700, margin: 0 }}>Registrer hendelse</h2>
              <button onClick={() => setShowNew(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color={C.textMuted} /></button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem", marginBottom: "0.875rem" }}>
              <div>
                <label style={lbl}>Dato *</label>
                <input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Type hendelse *</label>
                <select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value as EventType }))} style={inp}>
                  {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Instans *</label>
                <select value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value as Institution }))} style={inp}>
                  {INSTITUTIONS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Ansvarlig person (navn + stilling)</label>
                <input value={form.responsible_party} onChange={e => setForm(f => ({ ...f, responsible_party: e.target.value }))} placeholder="F.eks. Kari Olsen, rektor" style={inp} />
              </div>
            </div>

            <div style={{ marginBottom: "0.875rem" }}>
              <label style={lbl}>Tittel *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Kort beskrivelse av hendelsen" style={inp} />
            </div>

            <div style={{ marginBottom: "0.875rem" }}>
              <label style={lbl}>Utfyllende beskrivelse</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Hva skjedde? Hva ble sagt? Hva ble lovet men ikke holdt?" rows={4}
                style={{ ...inp, resize: "vertical" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem", marginBottom: "0.875rem" }}>
              <div>
                <label style={lbl}>Tilstede (kommaseparert)</label>
                <input value={form.attendees} onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))} placeholder="Navn, navn, navn..." style={inp} />
              </div>
              <div>
                <label style={lbl}>Resultat / vedtak</label>
                <input value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))} placeholder="Hva ble bestemt?" style={inp} />
              </div>
            </div>

            {/* Legal refs */}
            <div style={{ marginBottom: "0.875rem" }}>
              <label style={lbl}>Relevante lovhenvisninger</label>
              <div style={{ background: C.surfaceLow, border: `1px solid ${C.border}`, borderRadius: "0.625rem", padding: "0.75rem", maxHeight: 180, overflowY: "auto" }}>
                {LEGAL_REFS.map(g => (
                  <div key={g.group} style={{ marginBottom: "0.625rem" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, color: C.primary, textTransform: "uppercase", marginBottom: "0.3rem" }}>{g.group}</div>
                    {g.refs.map(r => {
                      const [code] = r.split(" — ");
                      const sel = form.legal_refs.includes(r);
                      return (
                        <label key={r} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", marginBottom: "0.2rem", fontSize: "0.8rem", color: sel ? C.primary : C.text }}>
                          <input type="checkbox" checked={sel} onChange={() => toggleLegalRef(r)} style={{ accentColor: C.primary }} />
                          <span style={{ fontWeight: sel ? 700 : 400 }}>{code}</span>
                          <span style={{ color: C.textMuted, fontSize: "0.75rem" }}>{r.split(" — ")[1] ?? ""}</span>
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
              {form.legal_refs.length > 0 && (
                <div style={{ marginTop: "0.4rem", display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                  {form.legal_refs.map(r => (
                    <span key={r} style={{ background: C.blue.bg, border: `1px solid ${C.blue.border}`, color: C.blue.text, borderRadius: "0.4rem", padding: "0.1rem 0.5rem", fontSize: "0.72rem", fontWeight: 700 }}>
                      {r.split(" — ")[0]}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Violation flag */}
            <div style={{ marginBottom: "0.875rem", background: form.is_rights_violation ? C.red.bg : C.surfaceLow, border: `1px solid ${form.is_rights_violation ? C.red.border : C.border}`, borderRadius: "0.75rem", padding: "0.875rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", cursor: "pointer" }}>
                <input type="checkbox" checked={form.is_rights_violation} onChange={e => setForm(f => ({ ...f, is_rights_violation: e.target.checked }))} style={{ accentColor: C.red.text, width: 16, height: 16 }} />
                <span style={{ fontWeight: 700, color: form.is_rights_violation ? C.red.text : C.textMid, fontSize: "0.875rem" }}>
                  ⚠ Dette representerer et brudd på rettigheter / manglende oppfølging
                </span>
              </label>
              {form.is_rights_violation && (
                <textarea value={form.violation_notes} onChange={e => setForm(f => ({ ...f, violation_notes: e.target.value }))}
                  placeholder="Beskriv hva som ble brutt og konsekvensene..." rows={2}
                  style={{ ...inp, marginTop: "0.625rem", resize: "vertical", background: C.surface }} />
              )}
            </div>

            {/* Follow-up */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem", color: C.textMid, fontWeight: 600 }}>
                <input type="checkbox" checked={form.follow_up_required} onChange={e => setForm(f => ({ ...f, follow_up_required: e.target.checked }))} style={{ accentColor: C.primary }} />
                Krever oppfølging
              </label>
              {form.follow_up_required && (
                <input value={form.follow_up_notes} onChange={e => setForm(f => ({ ...f, follow_up_notes: e.target.value }))}
                  placeholder="Hva må følges opp og av hvem?" style={{ ...inp, marginTop: "0.5rem" }} />
              )}
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={() => setShowNew(false)}
                style={{ flex: 1, padding: "0.75rem", borderRadius: "0.75rem", border: `1px solid ${C.border}`, background: C.surface, color: C.textMid, fontWeight: 600, cursor: "pointer" }}>
                Avbryt
              </button>
              <button onClick={handleSave} disabled={saving || !form.title.trim()}
                style={{ flex: 2, padding: "0.75rem", borderRadius: "0.75rem", border: "none", background: saving || !form.title.trim() ? "#a8c7db" : C.primary, color: "#fff", fontWeight: 700, cursor: saving || !form.title.trim() ? "not-allowed" : "pointer" }}>
                {saving ? "Lagrer..." : "Lagre hendelse"}
              </button>
            </div>
          </div>
        )}

        {/* Timeline */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: C.textMuted }}>
            <Scale size={40} color={C.border} style={{ marginBottom: "1rem" }} />
            <p style={{ fontWeight: 600, color: C.textMid }}>Ingen hendelser registrert ennå</p>
            <p style={{ fontSize: "0.85rem" }}>Trykk «Ny hendelse» for å starte hendelsesloggen</p>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            {/* Vertical line */}
            <div style={{ position: "absolute", left: 17, top: 0, bottom: 0, width: 2, background: C.border }} />

            {filtered.map((ev, idx) => {
              const col = eventColor(ev.event_type);
              const expanded = expandedId === ev.id;
              const docs = documents.filter(d => d.event_id === ev.id);

              return (
                <div key={ev.id} style={{ position: "relative", paddingLeft: "2.75rem", marginBottom: "1.25rem" }}>
                  {/* Dot */}
                  <div style={{
                    position: "absolute", left: 8, top: 18,
                    width: 20, height: 20, borderRadius: "50%",
                    background: ev.is_rights_violation ? C.red.bg : col.bg,
                    border: `2px solid ${ev.is_rights_violation ? C.red.border : col.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {ev.is_rights_violation && <AlertTriangle size={10} color={C.red.text} />}
                  </div>

                  <div style={{ background: C.surface, border: `1px solid ${ev.is_rights_violation ? C.red.border : C.border}`, borderRadius: "1rem", boxShadow: "0 1px 3px rgba(17,29,37,.04)", overflow: "hidden" }}>
                    {/* Card header */}
                    <button
                      onClick={() => setExpandedId(expanded ? null : ev.id)}
                      style={{ width: "100%", background: "none", border: "none", padding: "0.875rem 1rem", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                          <span style={{ fontSize: "0.75rem", color: C.textMuted }}>{ev.event_date}</span>
                          <span style={{ background: col.bg, border: `1px solid ${col.border}`, color: col.text, borderRadius: "0.4rem", padding: "0.05rem 0.5rem", fontSize: "0.7rem", fontWeight: 700 }}>
                            {EVENT_TYPES.find(t => t.value === ev.event_type)?.label ?? ev.event_type}
                          </span>
                          <span style={{ background: C.surfaceLow, border: `1px solid ${C.border}`, color: C.textMid, borderRadius: "0.4rem", padding: "0.05rem 0.5rem", fontSize: "0.7rem", fontWeight: 600 }}>
                            {ev.institution}
                          </span>
                          {ev.is_rights_violation && (
                            <span style={{ background: C.red.bg, border: `1px solid ${C.red.border}`, color: C.red.text, borderRadius: "0.4rem", padding: "0.05rem 0.5rem", fontSize: "0.7rem", fontWeight: 700 }}>
                              ⚠ Rettighetsbr.
                            </span>
                          )}
                          {ev.follow_up_required && !ev.follow_up_done && (
                            <span style={{ background: C.orange.bg, border: `1px solid ${C.orange.border}`, color: C.orange.text, borderRadius: "0.4rem", padding: "0.05rem 0.5rem", fontSize: "0.7rem", fontWeight: 700 }}>
                              ⏳ Venter oppf.
                            </span>
                          )}
                          {ev.follow_up_required && ev.follow_up_done && (
                            <span style={{ background: C.green.bg, border: `1px solid ${C.green.border}`, color: C.green.text, borderRadius: "0.4rem", padding: "0.05rem 0.5rem", fontSize: "0.7rem", fontWeight: 700 }}>
                              ✓ Oppf. gjort
                            </span>
                          )}
                        </div>
                        <div style={{ fontWeight: 700, color: C.text, fontSize: "0.9rem" }}>{ev.title}</div>
                        {ev.description && !expanded && (
                          <div style={{ color: C.textMuted, fontSize: "0.8rem", marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ev.description}
                          </div>
                        )}
                      </div>
                      {expanded ? <ChevronUp size={18} color={C.textMuted} /> : <ChevronDown size={18} color={C.textMuted} />}
                    </button>

                    {/* Expanded details */}
                    {expanded && (
                      <div style={{ padding: "0 1rem 1rem", borderTop: `1px solid ${C.border}` }}>
                        {ev.description && (
                          <div style={{ marginTop: "0.875rem" }}>
                            <div style={{ ...lbl }}>Beskrivelse</div>
                            <div style={{ color: C.text, fontSize: "0.875rem", whiteSpace: "pre-wrap" }}>{ev.description}</div>
                          </div>
                        )}
                        {ev.responsible_party && (
                          <div style={{ marginTop: "0.75rem" }}>
                            <div style={lbl}>Ansvarlig</div>
                            <div style={{ color: C.text, fontSize: "0.875rem" }}>{ev.responsible_party}</div>
                          </div>
                        )}
                        {ev.attendees?.length ? (
                          <div style={{ marginTop: "0.75rem" }}>
                            <div style={lbl}>Tilstede</div>
                            <div style={{ color: C.text, fontSize: "0.875rem" }}>{ev.attendees.join(", ")}</div>
                          </div>
                        ) : null}
                        {ev.outcome && (
                          <div style={{ marginTop: "0.75rem" }}>
                            <div style={lbl}>Resultat / vedtak</div>
                            <div style={{ color: C.text, fontSize: "0.875rem" }}>{ev.outcome}</div>
                          </div>
                        )}
                        {ev.legal_refs?.length ? (
                          <div style={{ marginTop: "0.75rem" }}>
                            <div style={lbl}>Lovhenvisninger</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                              {ev.legal_refs.map(r => (
                                <span key={r} style={{ background: C.blue.bg, border: `1px solid ${C.blue.border}`, color: C.blue.text, borderRadius: "0.4rem", padding: "0.2rem 0.6rem", fontSize: "0.75rem", fontWeight: 700 }}>
                                  {r.split(" — ")[0]}
                                  {r.includes(" — ") && <span style={{ fontWeight: 400, color: C.textMid }}> — {r.split(" — ")[1]}</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {ev.is_rights_violation && ev.violation_notes && (
                          <div style={{ marginTop: "0.75rem", background: C.red.bg, border: `1px solid ${C.red.border}`, borderRadius: "0.625rem", padding: "0.75rem" }}>
                            <div style={{ ...lbl, color: C.red.text }}>Brudd — noter</div>
                            <div style={{ color: C.red.text, fontSize: "0.875rem" }}>{ev.violation_notes}</div>
                          </div>
                        )}
                        {ev.follow_up_required && (
                          <div style={{ marginTop: "0.75rem", background: C.orange.bg, border: `1px solid ${C.orange.border}`, borderRadius: "0.625rem", padding: "0.75rem", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ ...lbl, color: C.orange.text }}>Oppfølging kreves</div>
                              {ev.follow_up_notes && <div style={{ color: C.orange.text, fontSize: "0.875rem" }}>{ev.follow_up_notes}</div>}
                            </div>
                            <button
                              onClick={() => { markFollowUpDone(ev.id, !ev.follow_up_done); router.refresh(); }}
                              style={{ background: ev.follow_up_done ? C.green.bg : C.surface, border: `1px solid ${ev.follow_up_done ? C.green.border : C.border}`, borderRadius: "0.5rem", padding: "0.35rem 0.75rem", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", color: ev.follow_up_done ? C.green.text : C.textMid, display: "flex", alignItems: "center", gap: "0.3rem" }}
                            >
                              <Check size={13} /> {ev.follow_up_done ? "Gjort" : "Merk gjort"}
                            </button>
                          </div>
                        )}
                        {/* Actions */}
                        <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
                          <button
                            onClick={async () => { await deleteCaseEvent(ev.id); router.refresh(); }}
                            style={{ background: "none", border: `1px solid ${C.red.border}`, color: C.red.text, borderRadius: "0.5rem", padding: "0.35rem 0.75rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem" }}
                          >
                            <Trash2 size={13} /> Slett hendelse
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
