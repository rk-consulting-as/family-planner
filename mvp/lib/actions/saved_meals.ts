'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SavedMealItem {
  id:        string        // local UUID
  name:      string        // food display name
  foodId?:   string        // matvaretabellen ID (optional)
  grams:     number
  nutrition: {
    kcal: number; protein: number; carbs: number; sugar: number
    fiber: number; fat: number; saturated_fat: number; sodium: number
  }
}

export interface SavedMeal {
  id:              string
  group_id:        string
  name:            string
  description:     string | null
  tags:            string[]
  items:           SavedMealItem[]
  total_nutrition: {
    kcal: number; protein: number; carbs: number; sugar: number
    fiber: number; fat: number; saturated_fat: number; sodium: number
  } | null
  created_by:  string | null
  created_at:  string
  updated_at:  string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sumNutrition(items: SavedMealItem[]) {
  return items.reduce(
    (acc, item) => ({
      kcal:          acc.kcal          + (item.nutrition?.kcal          ?? 0),
      protein:       acc.protein       + (item.nutrition?.protein       ?? 0),
      carbs:         acc.carbs         + (item.nutrition?.carbs         ?? 0),
      sugar:         acc.sugar         + (item.nutrition?.sugar         ?? 0),
      fiber:         acc.fiber         + (item.nutrition?.fiber         ?? 0),
      fat:           acc.fat           + (item.nutrition?.fat           ?? 0),
      saturated_fat: acc.saturated_fat + (item.nutrition?.saturated_fat ?? 0),
      sodium:        acc.sodium        + (item.nutrition?.sodium        ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, sugar: 0, fiber: 0, fat: 0, saturated_fat: 0, sodium: 0 }
  )
}

// ── Read ───────────────────────────────────────────────────────────────────────

export async function getSavedMeals(): Promise<SavedMeal[]> {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return []

  const { data: gm } = await sb.from('group_members')
    .select('group_id').eq('profile_id', user.id).limit(1).single()
  if (!gm) return []

  const { data } = await sb.from('family_saved_meals')
    .select('*')
    .eq('group_id', gm.group_id)
    .order('name')

  return (data ?? []) as SavedMeal[]
}

// ── Create ─────────────────────────────────────────────────────────────────────

export async function createSavedMeal(payload: {
  name:        string
  description: string
  tags:        string[]
  items:       SavedMealItem[]
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'Ikke innlogget' }

  const { data: gm } = await sb.from('group_members')
    .select('group_id, role').eq('profile_id', user.id).limit(1).single()
  if (!gm) return { ok: false, error: 'Ingen gruppe' }
  if (!['owner', 'admin'].includes((gm as { role: string }).role))
    return { ok: false, error: 'Kun admin kan opprette lagrede måltider' }

  const total_nutrition = sumNutrition(payload.items)

  const { data, error } = await sb.from('family_saved_meals').insert({
    group_id:        (gm as { group_id: string }).group_id,
    name:            payload.name.trim(),
    description:     payload.description.trim() || null,
    tags:            payload.tags,
    items:           payload.items,
    total_nutrition,
    created_by:      user.id,
  }).select('id').single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/maltidsplan/lagrede')
  return { ok: true, id: (data as { id: string }).id }
}

// ── Update ─────────────────────────────────────────────────────────────────────

export async function updateSavedMeal(
  id: string,
  payload: { name: string; description: string; tags: string[]; items: SavedMealItem[] }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'Ikke innlogget' }

  const total_nutrition = sumNutrition(payload.items)

  const { error } = await sb.from('family_saved_meals').update({
    name:            payload.name.trim(),
    description:     payload.description.trim() || null,
    tags:            payload.tags,
    items:           payload.items,
    total_nutrition,
    updated_at:      new Date().toISOString(),
  }).eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/maltidsplan/lagrede')
  return { ok: true }
}

// ── Delete ─────────────────────────────────────────────────────────────────────

export async function deleteSavedMeal(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = await createClient()
  const { error } = await sb.from('family_saved_meals').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/maltidsplan/lagrede')
  return { ok: true }
}
