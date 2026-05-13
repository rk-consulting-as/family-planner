"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { THEMES } from "@/lib/invitations/themes";
import { FORMATS, getFormat } from "@/lib/invitations/formats";
import {
  updateInvitation,
  uploadInvitationAsset,
  deleteInvitationAsset,
  generateInvitationText,
  generateInvitationImage,
  pushInvitationToCalendar,
  deleteInvitation,
} from "@/lib/actions/invites";
import InvitationPreview from "./InvitationPreview";

export type Invitation = {
  id: string;
  group_id: string;
  title: string;
  occasion: string;
  theme: string;
  format: string;
  image_mode: "template" | "ai_generated";
  host_name: string | null;
  host_age: number | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  location_details: string | null;
  dress_code: string | null;
  gift_info: string | null;
  rsvp_deadline: string | null;
  rsvp_contact: string | null;
  extra_notes: string | null;
  generated_text: string | null;
  generated_image_url: string | null;
  status: string;
};

export type Asset = {
  id: string;
  kind: string;
  public_url: string | null;
  caption: string | null;
};

export type GroupMember = {
  profile_id: string;
  display_name: string;
  color_hex: string | null;
};

export default function InvitationEditor({
  invitation,
  assets,
  groupMembers,
  currentUserId,
}: {
  invitation: Invitation;
  assets: Asset[];
  groupMembers: GroupMember[];
  currentUserId: string;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Lokal state speiler invitation for live preview
  const [state, setState] = useState({
    title: invitation.title,
    occasion: invitation.occasion,
    theme: invitation.theme,
    format: invitation.format,
    image_mode: invitation.image_mode,
    host_name: invitation.host_name || "",
    host_age: invitation.host_age?.toString() || "",
    event_date: invitation.event_date || "",
    event_time: invitation.event_time?.slice(0, 5) || "",
    location: invitation.location || "",
    location_details: invitation.location_details || "",
    dress_code: invitation.dress_code || "",
    gift_info: invitation.gift_info || "",
    rsvp_deadline: invitation.rsvp_deadline || "",
    rsvp_contact: invitation.rsvp_contact || "",
    extra_notes: invitation.extra_notes || "",
    generated_text: invitation.generated_text || "",
  });
  const [generatedImageUrl, setGeneratedImageUrl] = useState(invitation.generated_image_url);

  const hostPhotoUrl = assets.find((a) => a.kind === "host_photo")?.public_url || null;
  const venuePhotoUrl = assets.find((a) => a.kind === "venue_photo")?.public_url || null;
  const logoUrl = assets.find((a) => a.kind === "logo")?.public_url || null;

  function set<K extends keyof typeof state>(key: K, value: (typeof state)[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  async function save() {
    setError(null);
    setInfo(null);
    const fd = new FormData();
    for (const [k, v] of Object.entries(state)) {
      fd.set(k, v);
    }
    startTransition(async () => {
      const res = await updateInvitation(invitation.id, fd);
      if (!res.ok) setError(res.error || "Klarte ikke å lagre");
      else setInfo("Lagret ✓");
    });
  }

  function aiText() {
    setError(null);
    setInfo("AI skriver tekst…");
    startTransition(async () => {
      // Lagre først så AI får riktig input
      const fd = new FormData();
      for (const [k, v] of Object.entries(state)) fd.set(k, v);
      await updateInvitation(invitation.id, fd);
      const res = await generateInvitationText(invitation.id);
      if (!res.ok) {
        setError(res.error || "AI feilet");
        setInfo(null);
        return;
      }
      if (res.text) set("generated_text", res.text);
      setInfo("AI har skrevet tekst ✓");
    });
  }

  function aiImage() {
    setError(null);
    setInfo("AI tegner bilde — kan ta opptil 30 sekunder…");
    startTransition(async () => {
      const res = await generateInvitationImage(invitation.id);
      if (!res.ok) {
        setError(res.error || "Bilde-generering feilet");
        setInfo(null);
        return;
      }
      if (res.url) {
        setGeneratedImageUrl(res.url);
        set("image_mode", "ai_generated");
      }
      setInfo("AI har tegnet bilde ✓");
    });
  }

  async function uploadAsset(kind: string, file: File) {
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadInvitationAsset(invitation.id, fd);
      if (!res.ok) setError(res.error || "Opplasting feilet");
      else setInfo("Bilde lastet opp — last siden på nytt for forhåndsvisning");
    });
  }

  function removeAsset(assetId: string) {
    if (!confirm("Slette dette bildet?")) return;
    startTransition(async () => {
      await deleteInvitationAsset(assetId, invitation.id);
    });
  }

  async function exportPng() {
    setError(null);
    setInfo("Lager PNG…");
    try {
      const mod = await import("html-to-image");
      if (!previewRef.current) throw new Error("Preview ikke klar");
      const dataUrl = await mod.toPng(previewRef.current, {
        cacheBust: true,
        pixelRatio: 1,
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${invitation.title.replace(/[^a-z0-9-]+/gi, "_")}.png`;
      link.click();
      setInfo("PNG lastet ned ✓");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eksport feilet");
    }
  }

  async function exportPdf() {
    setError(null);
    setInfo("Lager PDF…");
    try {
      const [imgMod, pdfMod] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);
      if (!previewRef.current) throw new Error("Preview ikke klar");
      const dataUrl = await imgMod.toPng(previewRef.current, {
        cacheBust: true,
        pixelRatio: 1,
      });
      const fmt = getFormat(state.format);
      const orientation = fmt.width > fmt.height ? "landscape" : "portrait";
      const pdfWidthMm = fmt.id === "a5_print" ? 148 : fmt.id === "a6_print" ? 105 : 210;
      const pdfHeightMm = fmt.id === "a5_print" ? 210 : fmt.id === "a6_print" ? 148 : 297;
      const pdf = new pdfMod.jsPDF({
        orientation,
        unit: "mm",
        format: fmt.use === "print" ? [pdfWidthMm, pdfHeightMm] : "a4",
      });
      const w = pdf.internal.pageSize.getWidth();
      const h = pdf.internal.pageSize.getHeight();
      pdf.addImage(dataUrl, "PNG", 0, 0, w, h);
      pdf.save(`${invitation.title.replace(/[^a-z0-9-]+/gi, "_")}.pdf`);
      setInfo("PDF lastet ned ✓");
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF-eksport feilet");
    }
  }

  function pushToCalendar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await pushInvitationToCalendar(invitation.id, fd);
      if (!res.ok) setError(res.error || "Feil ved push");
      else setInfo("Lagt til i kalender ✓");
    });
  }

  function handleDelete() {
    if (!confirm("Slette denne invitasjonen?")) return;
    startTransition(async () => {
      await deleteInvitation(invitation.id);
    });
  }

  const fmt = getFormat(state.format);
  // Beregn skalering så preview passer i ~360px bredde
  const previewScale = Math.min(360 / fmt.width, 480 / fmt.height);

  return (
    <div className="grid lg:grid-cols-[1fr,400px] gap-6 items-start">
      {/* Skjema */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Link href="/invitasjoner" className="text-sm text-brand-700 hover:underline">
            ← Tilbake til invitasjoner
          </Link>
          <Button size="sm" variant="ghost" onClick={handleDelete}>
            Slett
          </Button>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
            {error}
          </div>
        )}
        {info && !error && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-3">
            {info}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Grunninfo</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <Field label="Tittel">
              <Input value={state.title} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Type">
                <Select
                  value={state.occasion}
                  onChange={(e) => set("occasion", e.target.value)}
                >
                  <option value="childrens_birthday">🎂 Barnebursdag</option>
                  <option value="milestone_birthday">🥂 Rund-dag (voksen)</option>
                  <option value="wedding_anniversary">💐 Bryllup / jubileum</option>
                  <option value="school_event">📚 Skolearrangement</option>
                  <option value="class_party">🎈 Klassefest</option>
                  <option value="sports_event">⚽ Idrettsarrangement</option>
                  <option value="graduation">🎓 Avslutning</option>
                  <option value="generic">🎉 Annet</option>
                </Select>
              </Field>
              <Field label="Tema">
                <Select value={state.theme} onChange={(e) => set("theme", e.target.value)}>
                  {THEMES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.emoji} {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Format">
                <Select
                  value={state.format}
                  onChange={(e) => set("format", e.target.value)}
                >
                  {FORMATS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label} — {f.description}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Hvem feirer (navn)">
                <Input
                  value={state.host_name}
                  onChange={(e) => set("host_name", e.target.value)}
                  placeholder="F.eks. Henrik"
                />
              </Field>
              <Field label="Alder (hvis bursdag)">
                <Input
                  type="number"
                  value={state.host_age}
                  onChange={(e) => set("host_age", e.target.value)}
                  placeholder="7"
                />
              </Field>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tid og sted</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Dato">
                <Input
                  type="date"
                  value={state.event_date}
                  onChange={(e) => set("event_date", e.target.value)}
                />
              </Field>
              <Field label="Klokkeslett">
                <Input
                  type="time"
                  value={state.event_time}
                  onChange={(e) => set("event_time", e.target.value)}
                />
              </Field>
              <Field label="Sted">
                <Input
                  value={state.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="F.eks. Lekeland Sandnes"
                />
              </Field>
              <Field label="Adresse/detaljer">
                <Input
                  value={state.location_details}
                  onChange={(e) => set("location_details", e.target.value)}
                  placeholder="Storgata 12, 4306 Sandnes"
                />
              </Field>
              <Field label="Antrekk">
                <Input
                  value={state.dress_code}
                  onChange={(e) => set("dress_code", e.target.value)}
                  placeholder="Vanlige klær"
                />
              </Field>
              <Field label="Om gaver">
                <Input
                  value={state.gift_info}
                  onChange={(e) => set("gift_info", e.target.value)}
                  placeholder="Ingen gave nødvendig — bare deg!"
                />
              </Field>
              <Field label="Svarfrist">
                <Input
                  type="date"
                  value={state.rsvp_deadline}
                  onChange={(e) => set("rsvp_deadline", e.target.value)}
                />
              </Field>
              <Field label="Svar til">
                <Input
                  value={state.rsvp_contact}
                  onChange={(e) => set("rsvp_contact", e.target.value)}
                  placeholder="SMS til 90123456"
                />
              </Field>
            </div>
            <Field label="Ekstra info (brukes av AI for tekstforslag)">
              <Textarea
                rows={2}
                value={state.extra_notes}
                onChange={(e) => set("extra_notes", e.target.value)}
                placeholder="F.eks. allergier, hva man kan bli med å gjøre, ekstra praktisk info"
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Bilder</CardTitle>
            <p className="text-xs text-slate-500">Lastes opp og dukker opp i preview</p>
          </CardHeader>
          <CardBody className="space-y-3">
            <UploadRow
              label="Foto av hovedpersonen"
              kind="host_photo"
              existing={assets.find((a) => a.kind === "host_photo")}
              onUpload={(f) => uploadAsset("host_photo", f)}
              onRemove={removeAsset}
            />
            <UploadRow
              label="Foto av stedet"
              kind="venue_photo"
              existing={assets.find((a) => a.kind === "venue_photo")}
              onUpload={(f) => uploadAsset("venue_photo", f)}
              onRemove={removeAsset}
            />
            <UploadRow
              label="Logo (f.eks. klubblogo)"
              kind="logo"
              existing={assets.find((a) => a.kind === "logo")}
              onUpload={(f) => uploadAsset("logo", f)}
              onRemove={removeAsset}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI-hjelp</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={aiText} disabled={pending}>
                ✨ La AI skrive teksten
              </Button>
              <Button onClick={aiImage} disabled={pending} variant="ghost">
                🎨 La AI tegne et bilde (DALL-E)
              </Button>
            </div>
            <Field label="Invitasjonstekst (redigerbar)">
              <Textarea
                rows={8}
                value={state.generated_text}
                onChange={(e) => set("generated_text", e.target.value)}
                placeholder="Klikk «La AI skrive teksten» eller skriv selv…"
              />
            </Field>
            <div>
              <label className="text-sm flex items-center gap-2">
                <input
                  type="radio"
                  checked={state.image_mode === "template"}
                  onChange={() => set("image_mode", "template")}
                />
                Bruk opplastet bilde
              </label>
              <label className="text-sm flex items-center gap-2">
                <input
                  type="radio"
                  checked={state.image_mode === "ai_generated"}
                  onChange={() => set("image_mode", "ai_generated")}
                  disabled={!generatedImageUrl}
                />
                Bruk AI-tegnet bilde {!generatedImageUrl && "(klikk «AI tegne bilde» først)"}
              </label>
            </div>
          </CardBody>
        </Card>

        <div className="flex flex-wrap gap-2 sticky bottom-0 bg-white/80 backdrop-blur p-2 -mx-2 border-t border-slate-200">
          <Button onClick={save} disabled={pending}>
            {pending ? "Lagrer…" : "Lagre"}
          </Button>
          <Button onClick={exportPng} variant="ghost" disabled={pending}>
            📷 Last ned PNG
          </Button>
          <Button onClick={exportPdf} variant="ghost" disabled={pending}>
            📄 Last ned PDF
          </Button>
        </div>

        {/* Push til kalender */}
        <Card>
          <CardHeader>
            <CardTitle>Legg til i kalender</CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={pushToCalendar} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Hvem skal se det i kalenderen?
                </label>
                <div className="flex flex-col gap-1">
                  {groupMembers.map((m) => (
                    <label
                      key={m.profile_id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="participant_ids"
                        value={m.profile_id}
                        defaultChecked={m.profile_id === currentUserId}
                      />
                      {m.color_hex && (
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: m.color_hex }}
                        />
                      )}
                      {m.display_name}
                      {m.profile_id === currentUserId && (
                        <span className="text-xs text-slate-400">(meg)</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={pending}>
                📅 Push til kalender
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>

      {/* Forhåndsvisning */}
      <div className="lg:sticky lg:top-4">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Forhåndsvisning</CardTitle>
            <Badge>{fmt.label}</Badge>
          </CardHeader>
          <CardBody className="bg-slate-100 flex items-center justify-center min-h-[400px]">
            <InvitationPreview
              ref={previewRef}
              title={state.title}
              hostName={state.host_name || null}
              hostAge={state.host_age ? Number(state.host_age) : null}
              occasion={state.occasion}
              theme={state.theme}
              format={state.format}
              eventDate={state.event_date || null}
              eventTime={state.event_time || null}
              location={state.location || null}
              locationDetails={state.location_details || null}
              dressCode={state.dress_code || null}
              giftInfo={state.gift_info || null}
              rsvpDeadline={state.rsvp_deadline || null}
              rsvpContact={state.rsvp_contact || null}
              generatedText={state.generated_text || null}
              imageMode={state.image_mode}
              generatedImageUrl={generatedImageUrl}
              hostPhotoUrl={hostPhotoUrl}
              venuePhotoUrl={venuePhotoUrl}
              logoUrl={logoUrl}
              scale={previewScale}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function UploadRow({
  label,
  kind,
  existing,
  onUpload,
  onRemove,
}: {
  label: string;
  kind: string;
  existing?: Asset;
  onUpload: (f: File) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-200">
      {existing?.public_url ? (
        <img
          src={existing.public_url}
          alt={label}
          className="w-14 h-14 rounded-lg object-cover border border-slate-300"
        />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-white border-2 border-dashed border-slate-300 flex items-center justify-center text-2xl text-slate-300">
          +
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-slate-500">
          {existing ? "Lastet opp" : "Klikk for å laste opp"}
        </div>
      </div>
      {!existing ? (
        <label className="text-xs text-brand-700 hover:underline cursor-pointer">
          Velg fil
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
        </label>
      ) : (
        <button
          onClick={() => onRemove(existing.id)}
          className="text-xs text-slate-400 hover:text-red-600"
        >
          Fjern
        </button>
      )}
    </div>
  );
}
