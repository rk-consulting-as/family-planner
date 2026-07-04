'use server'

// ── Types ─────────────────────────────────────────────────────────────────────

export type UrgencyLevel = 'normal' | 'watch' | 'concern' | 'urgent'
export type TrendDirection = 'improving' | 'stable' | 'declining' | 'fluctuating' | 'single_reading'
export type MarkerStatus = 'normal' | 'borderline' | 'abnormal'

export interface BloodFinding {
  marker:               string
  trend:                TrendDirection
  status:               MarkerStatus
  values_summary:       string   // "4.5 → 3.9 G/L (2 målinger)"
  clinical_significance: string  // what this means medically
  patient_impact:       string   // what Rakel might experience
  priority:             number   // 1 = highest
}

export interface BloodAnalysis {
  generated_at:        string
  urgency_level:       UrgencyLevel
  overall_assessment:  string       // 2–3 sentence summary
  findings:            BloodFinding[]
  recommendations:     string[]
  data_coverage:       string       // e.g. "3 prøvetakinger over 8 måneder"
}

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(testsJson: string, patientAge: number): string {
  return `Du er en erfaren barnelege og hematolog (spesialist i blodprøver/blodsykdommer) som analyserer blodprøvetrender for en ung pasient.

PASIENT:
- Navn: Rakel Gausdal Kvelland
- Alder: ca. ${patientAge} år (jente)
- Kontekst: Utredning for mulig nevroutviklingsforstyrrelse (autism/ADHD-spekteret)

BLODPRØVEDATA (alle prøvetakinger, sortert etter dato):
${testsJson}

OPPGAVE:
Analyser trendene og gi en grundig medisinsk vurdering. Se spesielt etter:
1. Verdier som er vedvarende lave/høye over tid
2. Forverring eller bedring i trender
3. Kombinasjoner av avvikende verdier som kan peke mot en tilstand
4. Klinisk relevans for en jente på ${patientAge} år
5. Hva avvikende verdier kan bety for daglig fungering, energi, kognisjon, humør, immunforsvar

Returner KUN gyldig JSON (ingen forklaring, ingen markdown):

{
  "urgency_level": "normal|watch|concern|urgent",
  "overall_assessment": "2-3 setninger på norsk om det store bildet",
  "data_coverage": "f.eks. '3 prøvetakinger over 8 måneder (juni 2025 – juni 2026)'",
  "findings": [
    {
      "marker": "B-Leukocytter (LPK)",
      "trend": "declining",
      "status": "abnormal",
      "values_summary": "4.5 G/L (10.06.25) → 3.9 G/L (16.06.26)",
      "clinical_significance": "Lavt antall hvite blodceller (leukopeni). Referanse 4.5–14.0 G/L. Nivået har falt under nedre grense.",
      "patient_impact": "Økt risiko for infeksjoner. Kan oppleve at vanlige forkjølelser varer lenger eller er mer alvorlige.",
      "priority": 1
    }
  ],
  "recommendations": [
    "Kontroller leukocytt-nivå ved neste prøve",
    "Snakk med lege om D-vitamin-tilskudd"
  ]
}

Regler:
- Inkluder ALLE markører med avvikende verdier eller interessante trender
- Normal-verdier uten trend trenger ikke med
- Sorter findings etter priority (1 = viktigst)
- Bruk enkelt medisinsk norsk – forståelig for foreldre
- urgency_level: normal=alt OK, watch=noe å følge med på, concern=bør diskuteres med lege, urgent=trenger rask oppfølging
- Vær faglig presis men ikke skremmende – kontekstualisér alltid`
}

// ── API call ──────────────────────────────────────────────────────────────────

async function callClaude(prompt: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',   // Sonnet for deeper medical reasoning
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) { console.error('Claude API error:', await res.text()); return null }
    const json = await res.json()
    return json?.content?.[0]?.text ?? null
  } catch (e) {
    console.error('Claude fetch error:', e)
    return null
  }
}

function parseAnalysis(text: string | null): Omit<BloodAnalysis, 'generated_at'> | null {
  if (!text) return null
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0])
    if (!parsed.overall_assessment || !Array.isArray(parsed.findings)) return null
    // Sort findings by priority
    parsed.findings.sort((a: BloodFinding, b: BloodFinding) => (a.priority ?? 99) - (b.priority ?? 99))
    return parsed
  } catch { return null }
}

// ── Public server action ──────────────────────────────────────────────────────

interface BloodTest {
  test_date:   string
  institution: string | null
  values: Array<{
    marker:  string
    value:   number
    unit:    string
    ref_min: number | null
    ref_max: number | null
  }>
}

export async function analyzeBloodTrends(
  tests: BloodTest[],
  groupId: string,
): Promise<{ ok: true; data: BloodAnalysis } | { ok: false; error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: 'ANTHROPIC_API_KEY mangler' }
  if (tests.length === 0) return { ok: false, error: 'Ingen blodprøver å analysere' }

  // Format tests compactly for the prompt
  const sorted = [...tests].sort((a, b) => a.test_date.localeCompare(b.test_date))
  const testsJson = JSON.stringify(
    sorted.map(t => ({
      dato: t.test_date,
      institusjon: t.institution,
      verdier: t.values.map(m => ({
        markør: m.marker,
        verdi: m.value,
        enhet: m.unit,
        ref: m.ref_min !== null && m.ref_max !== null
          ? `${m.ref_min}–${m.ref_max}`
          : m.ref_max !== null ? `<${m.ref_max}`
          : m.ref_min !== null ? `>${m.ref_min}` : null,
      })),
    })),
    null, 2
  )

  // Rakel's age: born 14.04.2012
  const birthYear = 2012
  const patientAge = new Date().getFullYear() - birthYear

  const text = await callClaude(buildPrompt(testsJson, patientAge))
  const parsed = parseAnalysis(text)

  if (!parsed) return { ok: false, error: 'Kunne ikke tolke AI-svar. Prøv igjen.' }

  const analysis: BloodAnalysis = {
    ...parsed,
    generated_at: new Date().toISOString(),
  }

  // Persist to Supabase via direct fetch (server action, can use service role or anon+RLS)
  // We use the supabase client via import — but this is a server action so we need createClient
  const { createClient } = await import('@/lib/supabase/server')
  const sb = await createClient()
  await sb.from('rakel_blood_analysis').upsert(
    { group_id: groupId, analysis, updated_at: new Date().toISOString() },
    { onConflict: 'group_id' }
  )

  return { ok: true, data: analysis }
}
