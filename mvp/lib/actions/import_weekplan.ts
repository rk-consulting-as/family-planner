'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getActiveContext } from '@/lib/queries'
import { revalidatePath } from 'next/cache'

const ai = new Anthropic()

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ImportedActivity {
  day: number        // 1=Mon … 5=Fri
  slot: number       // 1=08:15 … 6=13:05
  subject: string
  tema: string
  mal: string
  plan: string
  forberedelse: string
}

export interface ImportPreview {
  notices: string[]
  activities: ImportedActivity[]
}

// ── AI prompt ─────────────────────────────────────────────────────────────────

const EXTRACT_PROMPT = `Du er en assistent som analyserer norske ukeplaner fra skolen.

Rakel er elev i 9A og deltar i disse fagene: Engelsk, Engelsk fordypning (Språk), Matte.

Tidsspor:
- Slot 1 = 08:15-09:00
- Slot 2 = 09:10-09:55
- Slot 3 = 10:00-10:48
- Slot 4 = 11:18-12:06
- Slot 5 = 12:10-12:55
- Slot 6 = 13:05-13:50

Dager: 1=Mandag, 2=Tirsdag, 3=Onsdag, 4=Torsdag, 5=Fredag

Analyser ukeplanen og returner BARE gyldig JSON (ingen markdown, ingen forklaring):

{
  "notices": [
    "Beskjedtekst her"
  ],
  "activities": [
    {
      "day": 1,
      "slot": 4,
      "subject": "Engelsk",
      "tema": "Leseprosjekt",
      "mal": "Kunne samtale om en selvvalgt bok",
      "plan": "Vi låner bok og starter opp med leseprosjektet",
      "forberedelse": ""
    }
  ]
}

Regler:
- Inkluder KUN fag Rakel deltar i: Engelsk, Språk (Engelsk fordypning), Matte
- Hent "Tema", "Mål" og "På skolen" fra ukeplanen for hvert fag
- Hent "Forberedelse til timen" og lekser/hjemmeoppgaver der det finnes
- Hent alle viktige beskjeder fra "Beskjeder"-seksjonen (ikke trivia)
- Hvis et felt er tomt, bruk tom streng ""
- Slå opp dag og tidsspor fra timeplanen øverst i dokumentet
`

// ── Main import action ────────────────────────────────────────────────────────

export async function parseWeekplanDocx(formData: FormData): Promise<{
  ok: boolean
  preview?: ImportPreview
  error?: string
}> {
  try {
    const file = formData.get('docx') as File | null
    if (!file || file.size === 0) return { ok: false, error: 'Ingen fil valgt' }

    // Extract text from .docx using mammoth
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Dynamic import to avoid SSR issues
    const mammoth = (await import('mammoth')).default
    const { value: rawText } = await mammoth.extractRawText({ buffer })

    if (!rawText || rawText.length < 100) {
      return { ok: false, error: 'Klarte ikke å lese tekst fra filen' }
    }

    // Send to Claude for extraction
    const response = await ai.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `UKEPLAN:\n${rawText.slice(0, 12000)}\n\n${EXTRACT_PROMPT}`,
      }],
    })

    const raw = (response.content[0] as { text: string }).text.trim()
    const json = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '')
    const preview = JSON.parse(json) as ImportPreview

    return { ok: true, preview }
  } catch (err) {
    console.error('parseWeekplanDocx error:', err)
    return { ok: false, error: 'Klarte ikke å analysere filen – prøv igjen' }
  }
}

// ── Batch save after user confirms ────────────────────────────────────────────

export async function saveImportedWeekplan(
  weekNum: number,
  year: number,
  activities: ImportedActivity[],
  notices: string[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await getActiveContext()
    if (!ctx) return { ok: false, error: 'Ikke innlogget' }

    const supabase = await createClient()

    // Save notices
    if (notices.length > 0) {
      const { error: noticeErr } = await supabase
        .from('school_week_notices')
        .insert(notices.map(content => ({
          group_id:    ctx.group.id,
          week_number: weekNum,
          year,
          content,
          source: 'import',
        })))
      if (noticeErr) console.error('notices insert error:', noticeErr)
    }

    // Save activities — map slot → time label for description
    const SLOT_LABELS: Record<number, string> = {
      1: '08:15', 2: '09:10', 3: '10:00',
      4: '11:18', 5: '12:10', 6: '13:05',
    }

    const ACT_TYPE: Record<string, string> = {
      Engelsk: 'faglig', Språk: 'faglig', Matte: 'faglig',
    }

    if (activities.length > 0) {
      const rows = activities.map(a => {
        const parts: string[] = []
        if (a.tema)         parts.push(`📌 Tema: ${a.tema}`)
        if (a.mal)          parts.push(`🎯 Mål: ${a.mal}`)
        if (a.plan)         parts.push(`📋 I timen: ${a.plan}`)

        return {
          group_id:      ctx.group.id,
          created_by:    ctx.user.id,
          week_number:   weekNum,
          year,
          day_of_week:   a.day,
          time_slot:     a.slot,
          activity_type: ACT_TYPE[a.subject] ?? 'faglig',
          title:         a.subject,
          description:   parts.join('\n'),
          tema:          a.tema || null,
          mal:           a.mal || null,
          forberedelse:  a.forberedelse || null,
          is_completed:  false,
        }
      })

      const { error: actErr } = await supabase
        .from('school_week_activities')
        .insert(rows)
      if (actErr) {
        console.error('activities insert error:', actErr)
        return { ok: false, error: actErr.message }
      }
    }

    revalidatePath('/skole/ukeplan')
    return { ok: true }
  } catch (err) {
    console.error('saveImportedWeekplan error:', err)
    return { ok: false, error: 'Uventet feil ved lagring' }
  }
}

// ── Fetch notices for a given week ────────────────────────────────────────────

export async function getWeekNotices(weekNum: number, year: number) {
  const ctx = await getActiveContext()
  if (!ctx) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('school_week_notices')
    .select('id, content')
    .eq('group_id', ctx.group.id)
    .eq('week_number', weekNum)
    .eq('year', year)
    .order('created_at')
  return data ?? []
}
