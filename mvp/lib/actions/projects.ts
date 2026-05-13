"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { callClaude, safeParseJson } from "@/lib/ai/anthropic";

// ----- Project CRUD --------------------------------------------------

export async function createProject(group_id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const title = String(formData.get("title") || "").trim();
  if (!title) return { ok: false, error: "Tittel er påkrevd" };
  const description = String(formData.get("description") || "").trim() || null;
  const context_subject = String(formData.get("context_subject") || "").trim() || null;
  const started_at = String(formData.get("started_at") || "") || null;

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      group_id,
      title,
      description,
      context_subject,
      started_at,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !project) return { ok: false, error: error?.message || "Klarte ikke" };

  // Trigger har lagt til creator. Legg også til andre admin-medlemmer hvis ønsket
  const additionalMembers = formData.getAll("additional_members") as string[];
  if (additionalMembers.length > 0) {
    await supabase
      .from("project_members")
      .insert(
        additionalMembers.filter(Boolean).map((id) => ({
          project_id: project.id,
          profile_id: id,
          role: "member" as const,
        }))
      );
  }

  revalidatePath("/prosjekter");
  redirect(`/prosjekter/${project.id}`);
}

export async function deleteProject(project_id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", project_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/prosjekter");
  redirect("/prosjekter");
}

export async function addProjectMember(project_id: string, profile_id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_members")
    .insert({ project_id, profile_id, role: "member" });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/prosjekter/${project_id}`);
  return { ok: true };
}

export async function removeProjectMember(project_id: string, profile_id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", project_id)
    .eq("profile_id", profile_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/prosjekter/${project_id}`);
  return { ok: true };
}

// ----- Parties --------------------------------------------------------

export async function addParty(project_id: string, formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false, error: "Navn er påkrevd" };
  const role = String(formData.get("role") || "").trim() || null;
  const organization = String(formData.get("organization") || "").trim() || null;
  const contact_info = String(formData.get("contact_info") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const is_internal = formData.get("is_internal") === "on";

  const { error } = await supabase.from("project_parties").insert({
    project_id,
    name,
    role,
    organization,
    contact_info,
    notes,
    is_internal,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/prosjekter/${project_id}`);
  return { ok: true };
}

export async function deleteParty(party_id: string, project_id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("project_parties").delete().eq("id", party_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/prosjekter/${project_id}`);
  return { ok: true };
}

export async function mergeParties(
  project_id: string,
  canonical_id: string,
  merge_ids: string[]
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("merge_parties", {
    p_project: project_id,
    p_canonical: canonical_id,
    p_to_merge: merge_ids,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/prosjekter/${project_id}`);
  return { ok: true };
}

export async function unmergeParty(party_id: string, project_id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unmerge_party", { p_party: party_id });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/prosjekter/${project_id}`);
  return { ok: true };
}

// ----- Milestone-kommentarer -----------------------------------------

export async function addMilestoneComment(
  milestone_id: string,
  project_id: string,
  formData: FormData
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };
  const body = String(formData.get("body") || "").trim();
  if (!body) return { ok: false, error: "Skriv noe" };
  const { error } = await supabase
    .from("project_milestone_comments")
    .insert({ milestone_id, project_id, author_id: user.id, body });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/prosjekter/${project_id}`);
  return { ok: true };
}

export async function deleteMilestoneComment(
  comment_id: string,
  project_id: string
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_milestone_comments")
    .delete()
    .eq("id", comment_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/prosjekter/${project_id}`);
  return { ok: true };
}

// ----- Milestones -----------------------------------------------------

export async function addMilestone(project_id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const title = String(formData.get("title") || "").trim();
  if (!title) return { ok: false, error: "Tittel er påkrevd" };
  const description = String(formData.get("description") || "").trim() || null;
  const kind = (String(formData.get("kind") || "past_event") as
    | "past_event" | "meeting" | "deadline" | "action_item" | "document" | "decision" | "note");
  const status = (String(formData.get("status") || "planned") as
    | "planned" | "completed" | "cancelled" | "overdue");
  const occurred_at_raw = String(formData.get("occurred_at") || "");
  const due_at_raw = String(formData.get("due_at") || "");
  const occurred_at = occurred_at_raw ? new Date(occurred_at_raw).toISOString() : null;
  const due_at = due_at_raw ? new Date(due_at_raw).toISOString() : null;
  const responsible_party_id = String(formData.get("responsible_party_id") || "") || null;
  const responsibles = (formData.getAll("responsible_profile_ids") as string[]).filter(Boolean);

  const { error } = await supabase.from("project_milestones").insert({
    project_id,
    title,
    description,
    kind,
    status,
    occurred_at,
    due_at,
    responsible_party_id,
    responsible_profile_ids: responsibles,
    created_by: user.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/prosjekter/${project_id}`);
  return { ok: true };
}

export async function updateMilestoneStatus(
  milestone_id: string,
  project_id: string,
  status: "planned" | "completed" | "cancelled"
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_milestones")
    .update({ status })
    .eq("id", milestone_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/prosjekter/${project_id}`);
  return { ok: true };
}

export async function updateMilestone(
  milestone_id: string,
  project_id: string,
  formData: FormData
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const update: Record<string, unknown> = {};
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const kind = String(formData.get("kind") || "").trim();
  const status = String(formData.get("status") || "").trim();
  const occurred_at_raw = String(formData.get("occurred_at") || "").trim();
  const due_at_raw = String(formData.get("due_at") || "").trim();
  const responsible_party_id = String(formData.get("responsible_party_id") || "").trim();
  const responsiblesRaw = formData.getAll("responsible_profile_ids") as string[];

  if (title) update.title = title;
  // Beskrivelse kan tømmes med vilje
  if (formData.has("description")) update.description = description || null;
  if (kind) update.kind = kind;
  if (status) update.status = status;
  if (formData.has("occurred_at")) {
    update.occurred_at = occurred_at_raw ? new Date(occurred_at_raw).toISOString() : null;
  }
  if (formData.has("due_at")) {
    update.due_at = due_at_raw ? new Date(due_at_raw).toISOString() : null;
  }
  if (formData.has("responsible_party_id")) {
    update.responsible_party_id = responsible_party_id || null;
  }
  if (formData.has("responsible_profile_ids")) {
    update.responsible_profile_ids = responsiblesRaw.filter(Boolean);
  }

  if (Object.keys(update).length === 0) {
    return { ok: false, error: "Ingen endringer" };
  }

  const { error } = await supabase
    .from("project_milestones")
    .update(update)
    .eq("id", milestone_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/prosjekter/${project_id}`);
  return { ok: true };
}

// Pusher en milestone som hendelse i gruppe-kalenderen.
// Velg deltakere (profile_ids) som skal se hendelsen.
export async function pushMilestoneToCalendar(
  milestone_id: string,
  project_id: string,
  formData: FormData
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  // Hent prosjekt + milestone
  const { data: ms } = await supabase
    .from("project_milestones")
    .select("id, project_id, title, description, kind, occurred_at, due_at")
    .eq("id", milestone_id)
    .single();
  if (!ms) return { ok: false, error: "Fant ikke milestone" };

  const { data: project } = await supabase
    .from("projects")
    .select("group_id, title")
    .eq("id", (ms as { project_id: string }).project_id)
    .single();
  if (!project) return { ok: false, error: "Fant ikke prosjekt" };
  const proj = project as { group_id: string; title: string };

  type MS = {
    title: string;
    description: string | null;
    kind: string;
    occurred_at: string | null;
    due_at: string | null;
  };
  const m = ms as MS;

  // Deltakere — minst én må være valgt; ellers default til opprettende bruker
  const participantsRaw = (formData.getAll("participant_ids") as string[]).filter(Boolean);
  const participant_ids = participantsRaw.length > 0 ? participantsRaw : [user.id];

  const all_day = formData.get("all_day") === "on";

  // Tid: ta fra formData hvis satt, ellers fra milestone selv
  const starts_at_raw = String(formData.get("starts_at") || "").trim();
  const ends_at_raw = String(formData.get("ends_at") || "").trim();

  let starts_at: Date | null = null;
  let ends_at: Date | null = null;

  if (starts_at_raw) {
    starts_at = new Date(starts_at_raw);
  } else {
    const base = m.due_at || m.occurred_at;
    if (!base) {
      return {
        ok: false,
        error: "Milestone har ingen dato — sett dato først eller velg starttidspunkt",
      };
    }
    starts_at = new Date(base);
  }

  if (ends_at_raw) {
    ends_at = new Date(ends_at_raw);
  } else {
    // Default: 1 time etter start, eller hele dagen hvis all_day
    ends_at = new Date(starts_at.getTime() + 60 * 60 * 1000);
  }

  if (all_day) {
    // Sett til midnatt → midnatt neste dag
    const d = new Date(starts_at);
    d.setHours(0, 0, 0, 0);
    starts_at = d;
    const e = new Date(d);
    e.setDate(e.getDate() + 1);
    ends_at = e;
  }

  // Title: bruk milestone-tittel, evt. prefix med ikon basert på kind
  const kindIcon: Record<string, string> = {
    past_event: "📌",
    meeting: "🤝",
    deadline: "⏰",
    action_item: "✅",
    document: "📄",
    decision: "⚖️",
    note: "📝",
  };
  const icon = kindIcon[m.kind] || "📌";

  const customTitle = String(formData.get("title") || "").trim();
  const eventTitle = customTitle || m.title;

  const description =
    `Fra prosjekt: ${proj.title}` +
    (m.description ? `\n\n${m.description}` : "");

  const reminderMinutes: number[] = [];
  const reminderRaw = String(formData.get("reminder_minutes") || "");
  if (reminderRaw && reminderRaw !== "none") {
    const n = Number(reminderRaw);
    if (!Number.isNaN(n)) reminderMinutes.push(n);
  }

  const { error } = await supabase.from("events").insert({
    group_id: proj.group_id,
    kind: "custom",
    title: eventTitle,
    description,
    starts_at: starts_at.toISOString(),
    ends_at: ends_at.toISOString(),
    all_day,
    participant_ids,
    created_by: user.id,
    reminder_minutes: reminderMinutes,
    icon,
    category: "project",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/prosjekter/${project_id}`);
  revalidatePath("/kalender");
  return { ok: true };
}

export async function deleteMilestone(milestone_id: string, project_id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_milestones")
    .delete()
    .eq("id", milestone_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/prosjekter/${project_id}`);
  return { ok: true };
}

// ----- Notes ----------------------------------------------------------

export async function addNote(project_id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };
  const body = String(formData.get("body") || "").trim();
  if (!body) return { ok: false, error: "Skriv noe" };
  const { error } = await supabase
    .from("project_notes")
    .insert({ project_id, body, author_id: user.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/prosjekter/${project_id}`);
  return { ok: true };
}

// ----- Documents ------------------------------------------------------

export async function addPastedDocument(project_id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };
  const title = String(formData.get("title") || "").trim() || "Innlimt tekst";
  const source_text = String(formData.get("source_text") || "").trim();
  if (!source_text) return { ok: false, error: "Tom tekst" };
  const source_date = String(formData.get("source_date") || "") || null;
  const kind = (String(formData.get("kind") || "email") as "email" | "note" | "document");

  const { data, error } = await supabase
    .from("project_documents")
    .insert({
      project_id,
      title,
      source_text,
      source_date,
      kind,
      uploaded_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/prosjekter/${project_id}`);
  return { ok: true, document_id: data?.id };
}

// ----- AI extraction --------------------------------------------------

export type ExtractedSuggestion = {
  parties: Array<{
    name: string;
    role?: string;
    organization?: string;
    is_internal?: boolean;
  }>;
  milestones: Array<{
    title: string;
    description?: string;
    kind: "past_event" | "meeting" | "deadline" | "action_item" | "document" | "decision" | "note";
    occurred_at?: string;        // ISO date
    due_at?: string;             // ISO date
    responsible_party_name?: string;
    source_excerpt?: string;
  }>;
  summary: string;
};

export async function extractFromText(
  project_id: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string; data?: ExtractedSuggestion }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const text = String(formData.get("text") || "").trim();
  if (!text) return { ok: false, error: "Lim inn tekst først" };
  if (text.length > 50000) return { ok: false, error: "Tekst for lang (maks 50k tegn)" };

  // Hent kontekst
  const { data: project } = await supabase
    .from("projects")
    .select("title, description, context_subject")
    .eq("id", project_id)
    .single();
  type P = { title?: string; description?: string; context_subject?: string } | null;
  const p = project as P;

  const today = new Date().toISOString().slice(0, 10);

  const system = `Du er en assistent som hjelper foreldre/admin å holde oversikt over et langvarig prosjekt rundt et barn (typisk utredning, behandling, søknader, utdanning).

Du får tilsendt rå tekst (epost, brev, notater) og skal trekke ut strukturert informasjon i JSON-format.

Fokus:
- Identifiser EKSTERNE INSTANSER og personer (lege, lærer, BUP, NAV, advokat, saksbehandler, etc.)
- Identifiser DATOER og hva som skjedde / skal skje
- Identifiser ANSVARSPUNKTER ("vi må ...", "skolen vil ...", "frist ...")
- IKKE finn på datoer eller navn — bare ta det som faktisk står i teksten
- Datoer som "i går", "neste mandag" etc. skal regnes ut basert på dagens dato: ${today}

Returner KUN JSON i nøyaktig dette formatet (ingen annet tekst):
{
  "summary": "1-2 setningers oppsummering på norsk",
  "parties": [
    { "name": "...", "role": "...", "organization": "...", "is_internal": false }
  ],
  "milestones": [
    {
      "title": "Kort tittel",
      "description": "Mer detaljer",
      "kind": "past_event" | "meeting" | "deadline" | "action_item" | "document" | "decision",
      "occurred_at": "YYYY-MM-DD" eller null,
      "due_at": "YYYY-MM-DD" eller null,
      "responsible_party_name": "Hvem (matcher en av parties hvis mulig)",
      "source_excerpt": "Direkte sitat fra teksten som støtter dette (maks 100 tegn)"
    }
  ]
}`;

  const userMsg = `Prosjektkontekst: ${p?.title || ""}${p?.context_subject ? ` (handler om ${p.context_subject})` : ""}${p?.description ? `\nBeskrivelse: ${p.description}` : ""}

Tekst som skal analyseres:
---
${text}
---

Returner JSON.`;

  let raw = "";
  try {
    raw = await callClaude({
      system,
      messages: [{ role: "user", content: userMsg }],
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI-kall feilet" };
  }

  const parsed = safeParseJson<ExtractedSuggestion>(raw);
  if (!parsed) {
    return { ok: false, error: "Klarte ikke å tolke AI-svaret. Prøv igjen." };
  }
  return { ok: true, data: parsed };
}

async function uploadProjectFile(
  project_id: string,
  file: File,
  user_id: string
): Promise<{ storage_path: string; public_url: string }> {
  const supabase = await createClient();
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const safeName = file.name.replace(/[^a-z0-9._-]+/gi, "_");
  const path = `${user_id}/projects/${project_id}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from("attachments")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("Kunne ikke laste opp filen: " + error.message);
  const { data: pub } = supabase.storage.from("attachments").getPublicUrl(path);
  void ext;
  return { storage_path: path, public_url: pub.publicUrl };
}

// Returnerer document_id slik at milestones kan kobles til kilden
export type ExtractResultWithSource = {
  ok: boolean;
  error?: string;
  data?: ExtractedSuggestion;
  source_document_id?: string;
};

// Send bilde (JPG/PNG/WEBP) til Claude med vision
export async function extractFromImageFile(
  project_id: string,
  formData: FormData
): Promise<ExtractResultWithSource> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const file = formData.get("file") as File | null;
  if (!file) return { ok: false, error: "Ingen fil valgt" };
  if (file.size > 4 * 1024 * 1024) {
    return { ok: false, error: "Bilde for stort (maks 4 MB)" };
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  let mediaType = file.type;
  // Noen nettlesere setter ikke type — utled fra navnet
  if (!mediaType) {
    const lname = file.name.toLowerCase();
    if (lname.endsWith(".jpg") || lname.endsWith(".jpeg")) mediaType = "image/jpeg";
    else if (lname.endsWith(".png")) mediaType = "image/png";
    else if (lname.endsWith(".webp")) mediaType = "image/webp";
    else if (lname.endsWith(".gif")) mediaType = "image/gif";
  }
  if (!allowedTypes.includes(mediaType)) {
    return { ok: false, error: "Bildet må være JPG, PNG, WEBP eller GIF" };
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const title = String(formData.get("title") || file.name).trim();

  // Last opp til Storage og lagre dokument-rad med URL
  let docId: string | undefined;
  try {
    const { storage_path, public_url } = await uploadProjectFile(project_id, file, user.id);
    const { data: docRow } = await supabase
      .from("project_documents")
      .insert({
        project_id,
        title,
        kind: "image",
        storage_path,
        public_url,
        mime_type: mediaType,
        size_bytes: file.size,
        source_text: `[Bilde, ${file.size} bytes — analysert av AI]`,
        uploaded_by: user.id,
      })
      .select("id")
      .single();
    docId = (docRow as { id?: string } | null)?.id;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Opplasting feilet" };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("title, description, context_subject")
    .eq("id", project_id)
    .single();
  type P = { title?: string; description?: string; context_subject?: string } | null;
  const p = project as P;

  const today = new Date().toISOString().slice(0, 10);

  const system = `Du er en assistent som hjelper foreldre/admin å holde oversikt over et langvarig prosjekt rundt et barn (typisk utredning, behandling, søknader, utdanning).

Du får tilsendt et bilde av et dokument, brev, melding eller skjermbilde og skal trekke ut strukturert informasjon i JSON-format.

Fokus:
- Identifiser EKSTERNE INSTANSER og personer (lege, lærer, BUP, NAV, advokat, saksbehandler, etc.)
- Identifiser DATOER og hva som skjedde / skal skje
- Identifiser ANSVARSPUNKTER
- IKKE finn på datoer eller navn — bare ta det som faktisk står i bildet
- Datoer som "i går", "neste mandag" etc. skal regnes ut basert på dagens dato: ${today}

Returner KUN JSON i nøyaktig dette formatet (ingen annet tekst):
{
  "summary": "1-2 setningers oppsummering på norsk",
  "parties": [
    { "name": "...", "role": "...", "organization": "...", "is_internal": false }
  ],
  "milestones": [
    {
      "title": "Kort tittel",
      "description": "Mer detaljer",
      "kind": "past_event" | "meeting" | "deadline" | "action_item" | "document" | "decision",
      "occurred_at": "YYYY-MM-DD" eller null,
      "due_at": "YYYY-MM-DD" eller null,
      "responsible_party_name": "Hvem (matcher en av parties hvis mulig)",
      "source_excerpt": "Direkte sitat fra bildet som støtter dette (maks 100 tegn)"
    }
  ]
}`;

  const userText = `Prosjektkontekst: ${p?.title || ""}${p?.context_subject ? ` (handler om ${p.context_subject})` : ""}${p?.description ? `\nBeskrivelse: ${p.description}` : ""}

Analyser det vedlagte bildet og returner JSON.`;

  let raw = "";
  try {
    raw = await callClaude({
      system,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
            { type: "text", text: userText },
          ],
        },
      ],
      max_tokens: 8192,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI-kall feilet" };
  }

  const parsed = safeParseJson<ExtractedSuggestion>(raw);
  if (!parsed) {
    return { ok: false, error: "Klarte ikke å tolke AI-svaret. Prøv igjen." };
  }
  return { ok: true, data: parsed, source_document_id: docId };
}

// Send PDF direkte til Claude — håndterer både tekst-PDF og skannede sider via OCR
export async function extractFromPdfFile(
  project_id: string,
  formData: FormData
): Promise<ExtractResultWithSource> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const file = formData.get("file") as File | null;
  if (!file) return { ok: false, error: "Ingen fil valgt" };
  if (file.size > 4 * 1024 * 1024) {
    return {
      ok: false,
      error:
        "PDF for stor (maks 4 MB for direkte AI-prosessering). Del opp PDF-en, eller bruk OCR-tjeneste først.",
    };
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { ok: false, error: "Kun PDF støttes for denne metoden" };
  }

  // Konverter til base64
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  // Last opp PDF til Storage og lagre dokument-rad
  const title = String(formData.get("title") || file.name).trim();
  let docId: string | undefined;
  try {
    const { storage_path, public_url } = await uploadProjectFile(project_id, file, user.id);
    const { data: docRow } = await supabase
      .from("project_documents")
      .insert({
        project_id,
        title,
        kind: "pdf",
        storage_path,
        public_url,
        mime_type: "application/pdf",
        size_bytes: file.size,
        source_text: `[PDF, ${file.size} bytes — analysert av AI med OCR]`,
        uploaded_by: user.id,
      })
      .select("id")
      .single();
    docId = (docRow as { id?: string } | null)?.id;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Opplasting feilet" };
  }

  // Hent kontekst
  const { data: project } = await supabase
    .from("projects")
    .select("title, description, context_subject")
    .eq("id", project_id)
    .single();
  type P = { title?: string; description?: string; context_subject?: string } | null;
  const p = project as P;

  const today = new Date().toISOString().slice(0, 10);

  const system = `Du er en assistent som hjelper foreldre/admin å holde oversikt over et langvarig prosjekt rundt et barn (typisk utredning, behandling, søknader, utdanning).

Du får tilsendt et PDF-dokument og skal trekke ut strukturert informasjon i JSON-format. PDF-en kan være skannet — les uansett.

Fokus:
- Identifiser EKSTERNE INSTANSER og personer (lege, lærer, BUP, NAV, advokat, saksbehandler, etc.)
- Identifiser DATOER og hva som skjedde / skal skje
- Identifiser ANSVARSPUNKTER ("vi må ...", "skolen vil ...", "frist ...")
- IKKE finn på datoer eller navn — bare ta det som faktisk står i dokumentet
- Datoer som "i går", "neste mandag" etc. skal regnes ut basert på dagens dato: ${today}

Returner KUN JSON i nøyaktig dette formatet (ingen annet tekst):
{
  "summary": "1-2 setningers oppsummering på norsk",
  "parties": [
    { "name": "...", "role": "...", "organization": "...", "is_internal": false }
  ],
  "milestones": [
    {
      "title": "Kort tittel",
      "description": "Mer detaljer",
      "kind": "past_event" | "meeting" | "deadline" | "action_item" | "document" | "decision",
      "occurred_at": "YYYY-MM-DD" eller null,
      "due_at": "YYYY-MM-DD" eller null,
      "responsible_party_name": "Hvem (matcher en av parties hvis mulig)",
      "source_excerpt": "Direkte sitat fra dokumentet som støtter dette (maks 100 tegn)"
    }
  ]
}`;

  const userText = `Prosjektkontekst: ${p?.title || ""}${p?.context_subject ? ` (handler om ${p.context_subject})` : ""}${p?.description ? `\nBeskrivelse: ${p.description}` : ""}

Analyser det vedlagte PDF-dokumentet og returner JSON.`;

  let raw = "";
  try {
    raw = await callClaude({
      system,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: userText,
            },
          ],
        },
      ],
      max_tokens: 8192,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI-kall feilet" };
  }

  const parsed = safeParseJson<ExtractedSuggestion>(raw);
  if (!parsed) {
    return { ok: false, error: "Klarte ikke å tolke AI-svaret. Prøv igjen." };
  }
  return { ok: true, data: parsed, source_document_id: docId };
}

export async function applyExtractedSuggestions(
  project_id: string,
  formData: FormData
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const payloadRaw = String(formData.get("payload") || "");
  const sourceDocId = String(formData.get("source_document_id") || "") || null;
  let parsed: { parties: ExtractedSuggestion["parties"]; milestones: ExtractedSuggestion["milestones"] };
  try {
    parsed = JSON.parse(payloadRaw);
  } catch {
    return { ok: false, error: "Ugyldig data" };
  }

  // Opprett eksterne instanser, lagre id-ene for kobling
  const partyIdByName = new Map<string, string>();
  for (const party of parsed.parties) {
    if (!party.name) continue;
    const { data } = await supabase
      .from("project_parties")
      .insert({
        project_id,
        name: party.name,
        role: party.role || null,
        organization: party.organization || null,
        is_internal: !!party.is_internal,
      })
      .select("id")
      .single();
    if (data) partyIdByName.set(party.name, data.id);
  }

  // Opprett milestones
  for (const m of parsed.milestones) {
    if (!m.title) continue;
    const responsible_party_id =
      m.responsible_party_name && partyIdByName.has(m.responsible_party_name)
        ? partyIdByName.get(m.responsible_party_name)
        : null;
    const occurred_at = m.occurred_at ? new Date(m.occurred_at).toISOString() : null;
    const due_at = m.due_at ? new Date(m.due_at).toISOString() : null;
    await supabase.from("project_milestones").insert({
      project_id,
      title: m.title,
      description: m.description || null,
      kind: m.kind || "note",
      status: m.kind === "action_item" || m.kind === "deadline" ? "planned" : "completed",
      occurred_at,
      due_at,
      responsible_party_id,
      source_document_id: sourceDocId,
      ai_extracted: true,
      ai_source_excerpt: m.source_excerpt || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      created_by: user.id,
    });
  }

  revalidatePath(`/prosjekter/${project_id}`);
  return { ok: true };
}
