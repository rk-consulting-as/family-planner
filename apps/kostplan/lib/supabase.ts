import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ─── Typescript-typer for Kostplan-tabellene ───────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'supper'
export type NutritionFocus = 'iron' | 'folate' | 'vitamin_d' | 'protein' | 'fiber' | 'calcium' | 'omega3'
export type AIProvider = 'openai' | 'anthropic'
export type AIMode = 'suggest_meals' | 'replace_ingredient' | 'explain_meal' | 'weekly_refinement'

export interface KpPreferences {
  id: string
  profile_id: string
  likes: string[]
  dislikes: string[]
  allergies: string[]
  pickiness_level: number
  nutrition_focus: NutritionFocus[]
  household_size: number
  lunchbox_friendly: boolean
  language: string
}

export interface KpWeekPlan {
  id: string
  profile_id: string
  week_start: string  // 'YYYY-MM-DD'
  title: string | null
  notes: string | null
  created_at: string
}

export interface KpDayPlan {
  id: string
  week_plan_id: string
  day_of_week: number  // 1=mandag, 7=søndag
  notes: string | null
}

export interface KpMealSlot {
  id: string
  day_plan_id: string
  meal_type: MealType
  title: string | null
  description: string | null
  ingredients: string[]
  tags: string[]
  prep_minutes: number | null
  ai_generated: boolean
}

export interface Profile {
  id: string
  display_name: string
  email: string | null
  avatar_url: string | null
}
