'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveContext } from '@/lib/queries'
import { revalidatePath } from 'next/cache'

// ── Types ──────────────────────────────────────────────────────────────────────

export type QuizLevel = 'lett' | 'middels' | 'vanskelig'
export type QuizLanguage = 'norsk' | 'engelsk'

export interface QuizOption {
  text: string
  is_correct: boolean
}

export interface QuizQuestion {
  id: string
  quiz_id: string
  question_order: number
  question_text: string
  options: QuizOption[]
  explanation: string | null
}

export interface Quiz {
  id: string
  group_id: string
  subject: string
  topic: string
  focus: string | null
  level: QuizLevel
  language: QuizLanguage
  question_count: number
  created_by: string | null
  created_at: string
}

export interface QuizSession {
  id: string
  quiz_id: string
  profile_id: string
  score: number
  total: number
  completed_at: string | null
  created_at: string
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function getQuizzes(): Promise<Quiz[]> {
  const ctx = await getActiveContext()
  if (!ctx) return []
  const supabase = await createClient()
  const colsWithFocus =
    'id,group_id,subject,topic,focus,level,language,question_count,created_by,created_at'
  const colsNoFocus =
    'id,group_id,subject,topic,level,language,question_count,created_by,created_at'
  let { data, error } = await supabase
    .from('quizzes')
    .select(colsWithFocus)
    .eq('group_id', ctx.group.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error && /focus/i.test(error.message)) {
    ({ data, error } = await supabase
      .from('quizzes')
      .select(colsNoFocus)
      .eq('group_id', ctx.group.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }))
  }
  return ((data ?? []) as Quiz[]).map((q) => ({ ...q, focus: q.focus ?? null }))
}

export async function getQuiz(id: string): Promise<Quiz | null> {
  const ctx = await getActiveContext()
  if (!ctx) return null
  const supabase = await createClient()
  const colsWithFocus =
    'id,group_id,subject,topic,focus,level,language,question_count,created_by,created_at'
  const colsNoFocus =
    'id,group_id,subject,topic,level,language,question_count,created_by,created_at'
  let { data, error } = await supabase
    .from('quizzes')
    .select(colsWithFocus)
    .eq('id', id)
    .eq('group_id', ctx.group.id)
    .is('deleted_at', null)
    .single()
  if (error && /focus/i.test(error.message)) {
    ({ data, error } = await supabase
      .from('quizzes')
      .select(colsNoFocus)
      .eq('id', id)
      .eq('group_id', ctx.group.id)
      .is('deleted_at', null)
      .single())
  }
  if (!data) return null
  return { ...(data as Quiz), focus: (data as Quiz).focus ?? null }
}

export async function getQuizQuestions(quizId: string): Promise<QuizQuestion[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('quiz_questions')
    .select('id,quiz_id,question_order,question_text,options,explanation')
    .eq('quiz_id', quizId)
    .order('question_order', { ascending: true })
  return (data ?? []) as QuizQuestion[]
}

export async function getQuizSessionsForQuiz(quizId: string): Promise<QuizSession[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('quiz_sessions')
    .select('id,quiz_id,profile_id,score,total,completed_at,created_at')
    .eq('quiz_id', quizId)
    .order('created_at', { ascending: false })
  return (data ?? []) as QuizSession[]
}

// ── Mutations ──────────────────────────────────────────────────────────────────

export async function deleteQuiz(id: string) {
  const ctx = await getActiveContext()
  if (!ctx) return
  const supabase = await createClient()
  await supabase
    .from('quizzes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('group_id', ctx.group.id)
  revalidatePath('/skole/quiz')
}

export async function startQuizSession(quizId: string, total: number): Promise<string | null> {
  const ctx = await getActiveContext()
  if (!ctx) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('quiz_sessions')
    .insert({ quiz_id: quizId, profile_id: ctx.user.id, score: 0, total })
    .select('id')
    .single()
  if (error) { console.error(error); return null }
  return data?.id ?? null
}

export async function saveAnswer(
  sessionId: string,
  questionId: string,
  selectedIndex: number,
  isCorrect: boolean
) {
  const supabase = await createClient()
  await supabase.from('quiz_session_answers').upsert({
    session_id: sessionId,
    question_id: questionId,
    selected_index: selectedIndex,
    is_correct: isCorrect,
  }, { onConflict: 'session_id,question_id' })
}

export async function finishQuizSession(sessionId: string, score: number, total: number) {
  const supabase = await createClient()
  await supabase
    .from('quiz_sessions')
    .update({ score, total, completed_at: new Date().toISOString() })
    .eq('id', sessionId)
}
