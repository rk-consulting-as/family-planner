'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getActiveContext } from '@/lib/queries'
import { revalidatePath } from 'next/cache'

const ai = new Anthropic()

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReadingQuestion {
  question_number: number
  level: 1 | 2 | 3
  question_text: string
  answer_options?: { key: string; text: string }[]   // level 1 only
  correct_answer?: string                            // level 1 only ("A"/"B"/"C"/"D")
}

export interface GeneratedSession {
  text_content: string
  questions: ReadingQuestion[]
}

// ── OCR + question generation ─────────────────────────────────────────────────

const QUESTION_PROMPT = `Du er en lærerassistent som lager tilpassede leseforståelsesoppgaver for en 14-åring i 9. klasse.
Eleven (Rakel) er under utredning for autisme og angst, og trenger:
- Tydelige, konkrete spørsmål uten tvetydighet
- Kort og enkel språklig stil
- Struktur og forutsigbarhet

Analyser teksten og lag NØYAKTIG dette antall spørsmål:

NIVÅ 1 – Gjenkjenning (4 spørsmål):
- Flervalg med 4 alternativer (A/B/C/D)
- Spørsmålet har ett klart riktig svar direkte fra teksten
- De 3 gale alternativene er plausible men feil
- Merk riktig svar

NIVÅ 2 – Forståelse (3 spørsmål):
- Spørsmål som krever 1-3 setningers svar
- Eleven skal forklare noe med egne ord basert på teksten
- Eksempel: "Beskriv hva som skjedde da...", "Forklar hvorfor..."

NIVÅ 3 – Refleksjon (2 spørsmål):
- Åpne spørsmål der eleven tenker selv
- Kobler teksten til egne erfaringer eller meninger
- Eksempel: "Hva tror du...", "Hva ville du ha gjort hvis...", "Hva synes du om..."

Svar KUN med gyldig JSON i dette formatet (ingen markdown, ingen forklaring):
{
  "questions": [
    {
      "question_number": 1,
      "level": 1,
      "question_text": "Spørsmålstekst her?",
      "answer_options": [
        {"key": "A", "text": "Første alternativ"},
        {"key": "B", "text": "Andre alternativ"},
        {"key": "C", "text": "Tredje alternativ"},
        {"key": "D", "text": "Fjerde alternativ"}
      ],
      "correct_answer": "A"
    },
    {
      "question_number": 5,
      "level": 2,
      "question_text": "Beskriv med egne ord...",
      "answer_options": null,
      "correct_answer": null
    },
    {
      "question_number": 8,
      "level": 3,
      "question_text": "Hva tror du...",
      "answer_options": null,
      "correct_answer": null
    }
  ]
}`

const OCR_PROMPT = `Ekstraher all tekst fra disse boksidene. Returner KUN den rene teksten.
Behold avsnittstruktur. Ingen forklaring, ingen kommentarer – bare teksten.`

const QUESTION_PROMPT_TEXT = `Du er en lærerassistent som lager leseforståelsesoppgaver for en 14-åring i 9. klasse.
Eleven (Rakel) trenger: tydelige konkrete spørsmål, enkel språklig stil, struktur.

Lag NØYAKTIG 9 spørsmål basert på teksten:

NIVÅ 1 – Gjenkjenning (4 spørsmål): Flervalg A/B/C/D, ett klart riktig svar fra teksten.
NIVÅ 2 – Forståelse (3 spørsmål): 1-3 setningers svar. F.eks. "Beskriv hva...", "Forklar hvorfor..."
NIVÅ 3 – Refleksjon (2 spørsmål): Åpne spørsmål. F.eks. "Hva tror du...", "Hva ville du ha gjort..."

Svar KUN med gyldig JSON (ingen markdown):
{"questions":[{"question_number":1,"level":1,"question_text":"?","answer_options":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}],"correct_answer":"A"},{"question_number":5,"level":2,"question_text":"Beskriv...","answer_options":null,"correct_answer":null},{"question_number":8,"level":3,"question_text":"Hva tror du...","answer_options":null,"correct_answer":null}]}`

// Step 1: OCR — extract text from all images in one call
export async function extractTextFromImages(
  imageBase64Array: string[],
  mimeTypes?: string[],
): Promise<string> {
  // Claude supports max 20 images, batch if needed
  const batch = imageBase64Array.slice(0, 10)
  const imageContent = batch.map((b64, i) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: ((mimeTypes?.[i] || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'),
      data: b64,
    },
  }))

  const response = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001',   // faster/cheaper for OCR only
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: [...imageContent, { type: 'text', text: OCR_PROMPT }],
    }],
  })

  return (response.content[0] as { text: string }).text.trim()
}

// Step 2: Generate questions from extracted text
export async function generateQuestionsFromText(text: string): Promise<ReadingQuestion[]> {
  const response = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `TEKST:\n${text.slice(0, 10000)}\n\n${QUESTION_PROMPT_TEXT}`,
    }],
  })

  const raw = (response.content[0] as { text: string }).text.trim()
  const json = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '')
  const parsed = JSON.parse(json) as { questions: ReadingQuestion[] }
  return parsed.questions
}

// ── Main server action: create session ────────────────────────────────────────

export async function createReadingSession(formData: FormData): Promise<{
  ok: boolean; sessionId?: string; error?: string
}> {
  try {
    const ctx = await getActiveContext()
    if (!ctx) return { ok: false, error: 'Ikke innlogget' }

    const supabase = await createClient()

    const title     = formData.get('title') as string
    const bookTitle = formData.get('book_title') as string | null
    const subject   = (formData.get('subject') as string) || 'engelsk'
    const weekNum   = formData.get('week_number') ? Number(formData.get('week_number')) : null
    const year      = formData.get('year') ? Number(formData.get('year')) : new Date().getFullYear()

    // Collect images (up to 8)
    const imageBase64s: string[] = []
    const imageMimes: string[] = []
    for (let i = 0; i < 8; i++) {
      const file = formData.get(`image_${i}`) as File | null
      if (!file || file.size === 0) continue
      const bytes = await file.arrayBuffer()
      imageBase64s.push(Buffer.from(bytes).toString('base64'))
      imageMimes.push(file.type || 'image/jpeg')
    }

    if (imageBase64s.length === 0) {
      return { ok: false, error: 'Last opp minst ett bilde' }
    }

    // Step 1: OCR (fast — Haiku model)
    const textContent = await extractTextFromImages(imageBase64s, imageMimes)
    if (!textContent || textContent.length < 50) {
      return { ok: false, error: 'Klarte ikke å lese tekst fra bildene. Prøv klarere bilder.' }
    }

    // Step 2: Generate questions (Sonnet — text only, no images)
    const questions = await generateQuestionsFromText(textContent)
    if (!questions || questions.length === 0) {
      return { ok: false, error: 'AI klarte ikke å lage spørsmål. Prøv igjen.' }
    }

    // Store session
    const { data: session, error: sessErr } = await supabase
      .from('school_reading_sessions')
      .insert({
        group_id:     ctx.group.id,
        created_by:   ctx.user.id,
        subject,
        title,
        book_title:   bookTitle || null,
        text_content: textContent,
        week_number:  weekNum,
        year,
      })
      .select('id')
      .single()

    if (sessErr || !session) {
      return { ok: false, error: 'Feil ved lagring av økt' }
    }

    // Store questions
    const questionRows = questions.map(q => ({
      session_id:      session.id,
      question_number: q.question_number,
      level:           q.level,
      question_text:   q.question_text,
      answer_options:  q.answer_options ?? null,
      correct_answer:  q.correct_answer ?? null,
    }))

    const { error: qErr } = await supabase.from('school_reading_questions').insert(questionRows)
    if (qErr) {
      console.error('Questions insert error:', qErr)
      // Session exists but questions failed — clean up and report
      await supabase.from('school_reading_sessions').delete().eq('id', session.id)
      return { ok: false, error: `Feil ved lagring av spørsmål: ${qErr.message}` }
    }

    revalidatePath('/skole/lesetrening')
    return { ok: true, sessionId: session.id }
  } catch (err) {
    console.error('createReadingSession error:', err)
    return { ok: false, error: 'Uventet feil – prøv igjen' }
  }
}

// ── Save answer ───────────────────────────────────────────────────────────────

export async function saveReadingAnswer(
  questionId: string,
  sessionId: string,
  answerText: string | null,
  selectedOption: string | null,
  correctAnswer: string | null
): Promise<{ ok: boolean }> {
  const ctx = await getActiveContext()
  if (!ctx) return { ok: false }

  const supabase = await createClient()
  const isCorrect = selectedOption != null && correctAnswer != null
    ? selectedOption === correctAnswer
    : null

  const { error } = await supabase
    .from('school_reading_answers')
    .upsert({
      session_id:      sessionId,
      question_id:     questionId,
      profile_id:      ctx.user.id,
      group_id:        ctx.group.id,
      answer_text:     answerText,
      selected_option: selectedOption,
      is_correct:      isCorrect,
      submitted_at:    new Date().toISOString(),
    }, { onConflict: 'question_id,profile_id' })

  revalidatePath(`/skole/lesetrening/${sessionId}`)
  return { ok: !error }
}

// ── Toggle week activity ──────────────────────────────────────────────────────

export async function toggleWeekActivity(activityId: string, done: boolean): Promise<void> {
  const ctx = await getActiveContext()
  if (!ctx) return

  const supabase = await createClient()
  await supabase.from('school_week_activities')
    .update({
      is_completed: done,
      completed_by: done ? ctx.user.id : null,
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq('id', activityId)

  revalidatePath('/skole/ukeplan')
}

// ── Create week activity ──────────────────────────────────────────────────────

export async function createWeekActivity(formData: FormData): Promise<{ ok: boolean; error?: string; id?: string }> {
  const ctx = await getActiveContext()
  if (!ctx) return { ok: false, error: 'Ikke innlogget' }

  const supabase = await createClient()
  const slotRaw = formData.get('time_slot')
  const slotNum = slotRaw !== null && slotRaw !== '' ? Number(slotRaw) : null

  const { data, error } = await supabase.from('school_week_activities').insert({
    group_id:      ctx.group.id,
    created_by:    ctx.user.id,
    assigned_to:   (formData.get('assigned_to') as string) || null,
    week_number:   Number(formData.get('week_number')),
    year:          Number(formData.get('year')),
    day_of_week:   Number(formData.get('day_of_week')),
    time_slot:     slotNum && slotNum > 0 ? slotNum : null,
    activity_type: (formData.get('activity_type') as string) || 'other',
    title:         formData.get('title') as string,
    description:   (formData.get('description') as string) || null,
  }).select('id').single()

  if (error) {
    console.error('createWeekActivity error:', error)
    return { ok: false, error: error.message }
  }

  revalidatePath('/skole/ukeplan')
  return { ok: true, id: data?.id }
}

// ── Update week activity ──────────────────────────────────────────────────────

export async function updateWeekActivity(
  activityId: string,
  data: { title: string; description: string | null; activity_type: string }
): Promise<{ ok: boolean }> {
  const ctx = await getActiveContext()
  if (!ctx) return { ok: false }

  const supabase = await createClient()
  const { error } = await supabase.from('school_week_activities')
    .update({
      title:         data.title,
      description:   data.description || null,
      activity_type: data.activity_type,
    })
    .eq('id', activityId)

  revalidatePath('/skole/ukeplan')
  return { ok: !error }
}

// ── Delete week activity ──────────────────────────────────────────────────────

export async function deleteWeekActivity(activityId: string): Promise<{ ok: boolean }> {
  const ctx = await getActiveContext()
  if (!ctx) return { ok: false }

  const supabase = await createClient()
  const { error } = await supabase.from('school_week_activities')
    .delete()
    .eq('id', activityId)

  revalidatePath('/skole/ukeplan')
  return { ok: !error }
}
