'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveContext } from '@/lib/queries'
import { revalidatePath } from 'next/cache'

export interface TimetableSlot {
  id: string
  day_of_week: number
  time_slot: number
  subject_name: string
  color_hex: string
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getTimetable(): Promise<TimetableSlot[]> {
  const ctx = await getActiveContext()
  if (!ctx) return []
  const sb = await createClient()
  const { data } = await sb
    .from('school_timetable')
    .select('id, day_of_week, time_slot, subject_name, color_hex')
    .eq('group_id', ctx.group.id)
    .order('day_of_week')
    .order('time_slot')
  return (data ?? []) as TimetableSlot[]
}

// ── Upsert (add or update a subject in a cell) ────────────────────────────────

export async function upsertTimetableSlot(
  day: number,
  slot: number,
  subject_name: string,
  color_hex: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getActiveContext()
  if (!ctx) return { ok: false, error: 'Ikke innlogget' }
  if (!['owner', 'admin', 'parent'].includes(ctx.role)) {
    return { ok: false, error: 'Ingen tilgang' }
  }
  const sb = await createClient()
  const { error } = await sb
    .from('school_timetable')
    .upsert(
      { group_id: ctx.group.id, day_of_week: day, time_slot: slot, subject_name, color_hex },
      { onConflict: 'group_id,day_of_week,time_slot' },
    )
  if (error) return { ok: false, error: error.message }
  revalidatePath('/skole/ukeplan')
  return { ok: true }
}

// ── Delete (remove a subject from a cell) ────────────────────────────────────

export async function deleteTimetableSlot(
  day: number,
  slot: number,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getActiveContext()
  if (!ctx) return { ok: false, error: 'Ikke innlogget' }
  if (!['owner', 'admin', 'parent'].includes(ctx.role)) {
    return { ok: false, error: 'Ingen tilgang' }
  }
  const sb = await createClient()
  const { error } = await sb
    .from('school_timetable')
    .delete()
    .eq('group_id', ctx.group.id)
    .eq('day_of_week', day)
    .eq('time_slot', slot)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/skole/ukeplan')
  return { ok: true }
}

// ── Move an activity to a new day/slot ────────────────────────────────────────

export async function moveWeekActivity(
  activityId: string,
  newDay: number,
  newSlot: number,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getActiveContext()
  if (!ctx) return { ok: false, error: 'Ikke innlogget' }
  const sb = await createClient()
  const { error } = await sb
    .from('school_week_activities')
    .update({ day_of_week: newDay, time_slot: newSlot })
    .eq('id', activityId)
    .eq('group_id', ctx.group.id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/skole/ukeplan')
  return { ok: true }
}

// ── Photo upload ──────────────────────────────────────────────────────────────

export async function addActivityPhoto(
  activityId: string,
  photoUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getActiveContext()
  if (!ctx) return { ok: false, error: 'Ikke innlogget' }
  const sb = await createClient()
  // Append URL to photos array
  const { error } = await sb.rpc('append_activity_photo', {
    p_activity_id: activityId,
    p_url: photoUrl,
    p_group_id: ctx.group.id,
  })
  if (error) {
    // Fallback: fetch+update if RPC not available
    const { data } = await sb
      .from('school_week_activities')
      .select('photos')
      .eq('id', activityId)
      .eq('group_id', ctx.group.id)
      .single()
    const existing: string[] = (data as any)?.photos ?? []
    const { error: e2 } = await sb
      .from('school_week_activities')
      .update({ photos: [...existing, photoUrl] })
      .eq('id', activityId)
      .eq('group_id', ctx.group.id)
    if (e2) return { ok: false, error: e2.message }
  }
  revalidatePath('/skole/ukeplan')
  return { ok: true }
}

export async function removeActivityPhoto(
  activityId: string,
  photoUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getActiveContext()
  if (!ctx) return { ok: false, error: 'Ikke innlogget' }
  const sb = await createClient()
  const { data } = await sb
    .from('school_week_activities')
    .select('photos')
    .eq('id', activityId)
    .eq('group_id', ctx.group.id)
    .single()
  const existing: string[] = (data as any)?.photos ?? []
  const { error } = await sb
    .from('school_week_activities')
    .update({ photos: existing.filter(u => u !== photoUrl) })
    .eq('id', activityId)
    .eq('group_id', ctx.group.id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/skole/ukeplan')
  return { ok: true }
}

// ── Upload photo to Supabase Storage ──────────────────────────────────────────
// Returns the public URL of the uploaded photo

export async function uploadActivityPhoto(
  formData: FormData,
  activityId: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const ctx = await getActiveContext()
  if (!ctx) return { ok: false, error: 'Ikke innlogget' }
  const file = formData.get('photo') as File | null
  if (!file) return { ok: false, error: 'Ingen fil' }

  const sb = await createClient()
  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `${ctx.group.id}/${activityId}/${Date.now()}.${ext}`

  const bytes  = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const { error: upErr } = await sb.storage
    .from('school-activity-photos')
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (upErr) return { ok: false, error: upErr.message }

  const { data: urlData } = sb.storage
    .from('school-activity-photos')
    .getPublicUrl(path)

  const url = urlData.publicUrl
  await addActivityPhoto(activityId, url)
  return { ok: true, url }
}
