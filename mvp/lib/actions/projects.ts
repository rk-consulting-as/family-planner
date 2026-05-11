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
