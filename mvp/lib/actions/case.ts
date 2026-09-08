'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveContext } from '@/lib/queries'
import { revalidatePath } from 'next/cache'

// ── Types ──────────────────────────────────────────────────────────────────────

export type EventType =
  | 'møte' | 'vedtak' | 'rapport' | 'henvendelse'
  | 'brudd' | 'klage' | 'annet'

export type Institution =
  | 'Skole' | 'PPT' | 'BUP' | 'ABUP' | 'HABU'
  | 'Fastlege' | 'NAV' | 'Kommune' | 'Statsforvalter' | 'annet'

export interface CaseEvent {
  id: string
  group_id: string
  created_by: string
  event_date: string
  event_type: EventType
  institution: Institution
  title: string
  description: string | null
  responsible_party: string | null
  attendees: string[] | null
  legal_refs: string[] | null
  is_rights_violation: boolean
  violation_notes: string | null
  outcome: string | null
  follow_up_required: boolean
  follow_up_done: boolean
  follow_up_notes: string | null
  created_at: string
  updated_at: string
  documents?: CaseDocument[]
}

export interface CaseDocument {
  id: string
  group_id: string
  created_by: string
  event_id: string | null
  title: string
  document_type: string
  institution: string | null
  document_date: string | null
  file_url: string | null
  file_name: string | null
  notes: string | null
  is_key_evidence: boolean
  created_at: string
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function getCaseEvents(): Promise<CaseEvent[]> {
  const ctx = await getActiveContext()
  if (!ctx) return []

  const sb = await createClient()
  const { data } = await sb
    .from('case_events')
    .select('*')
    .eq('group_id', ctx.group.id)
    .order('event_date', { ascending: false })

  return (data ?? []) as CaseEvent[]
}

export async function getCaseDocuments(eventId?: string): Promise<CaseDocument[]> {
  const ctx = await getActiveContext()
  if (!ctx) return []

  const sb = await createClient()
  let q = sb.from('case_documents').select('*').eq('group_id', ctx.group.id)
  if (eventId) q = q.eq('event_id', eventId)
  const { data } = await q.order('created_at', { ascending: false })
  return (data ?? []) as CaseDocument[]
}

// ── Mutations ──────────────────────────────────────────────────────────────────

export async function createCaseEvent(formData: FormData): Promise<{ ok: boolean; id?: string; error?: string }> {
  const ctx = await getActiveContext()
  if (!ctx) return { ok: false, error: 'Ikke innlogget' }

  const sb = await createClient()

  const legalRefsRaw = formData.get('legal_refs') as string | null
  const legal_refs = legalRefsRaw
    ? legalRefsRaw.split(',').map(s => s.trim()).filter(Boolean)
    : null

  const attendeesRaw = formData.get('attendees') as string | null
  const attendees = attendeesRaw
    ? attendeesRaw.split(',').map(s => s.trim()).filter(Boolean)
    : null

  const { data, error } = await sb.from('case_events').insert({
    group_id:            ctx.group.id,
    created_by:          ctx.user.id,
    event_date:          formData.get('event_date') as string,
    event_type:          formData.get('event_type') as string,
    institution:         formData.get('institution') as string,
    title:               formData.get('title') as string,
    description:         (formData.get('description') as string) || null,
    responsible_party:   (formData.get('responsible_party') as string) || null,
    attendees,
    legal_refs,
    is_rights_violation: formData.get('is_rights_violation') === 'true',
    violation_notes:     (formData.get('violation_notes') as string) || null,
    outcome:             (formData.get('outcome') as string) || null,
    follow_up_required:  formData.get('follow_up_required') === 'true',
    follow_up_notes:     (formData.get('follow_up_notes') as string) || null,
  }).select('id').single()

  if (error) return { ok: false, error: error.message }

  revalidatePath('/sak')
  return { ok: true, id: data.id }
}

export async function updateCaseEvent(
  id: string,
  fields: Partial<Omit<CaseEvent, 'id' | 'group_id' | 'created_by' | 'created_at' | 'updated_at'>>
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getActiveContext()
  if (!ctx) return { ok: false, error: 'Ikke innlogget' }

  const sb = await createClient()
  const { error } = await sb
    .from('case_events')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('group_id', ctx.group.id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/sak')
  return { ok: true }
}

export async function deleteCaseEvent(id: string): Promise<{ ok: boolean }> {
  const ctx = await getActiveContext()
  if (!ctx) return { ok: false }

  const sb = await createClient()
  await sb.from('case_events').delete().eq('id', id).eq('group_id', ctx.group.id)
  revalidatePath('/sak')
  return { ok: true }
}

export async function createCaseDocument(formData: FormData): Promise<{ ok: boolean; id?: string; error?: string }> {
  const ctx = await getActiveContext()
  if (!ctx) return { ok: false, error: 'Ikke innlogget' }

  const sb = await createClient()
  const { data, error } = await sb.from('case_documents').insert({
    group_id:       ctx.group.id,
    created_by:     ctx.user.id,
    event_id:       (formData.get('event_id') as string) || null,
    title:          formData.get('title') as string,
    document_type:  formData.get('document_type') as string,
    institution:    (formData.get('institution') as string) || null,
    document_date:  (formData.get('document_date') as string) || null,
    file_url:       (formData.get('file_url') as string) || null,
    file_name:      (formData.get('file_name') as string) || null,
    notes:          (formData.get('notes') as string) || null,
    is_key_evidence: formData.get('is_key_evidence') === 'true',
  }).select('id').single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/sak')
  return { ok: true, id: data.id }
}

export async function deleteCaseDocument(id: string): Promise<{ ok: boolean }> {
  const ctx = await getActiveContext()
  if (!ctx) return { ok: false }

  const sb = await createClient()
  await sb.from('case_documents').delete().eq('id', id).eq('group_id', ctx.group.id)
  revalidatePath('/sak')
  return { ok: true }
}

export async function markFollowUpDone(id: string, done: boolean): Promise<void> {
  const ctx = await getActiveContext()
  if (!ctx) return

  const sb = await createClient()
  await sb.from('case_events')
    .update({ follow_up_done: done, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('group_id', ctx.group.id)

  revalidatePath('/sak')
}
