'use server'

export interface NutritionResult {
  kcal:          number
  protein:       number   // g
  carbs:         number   // g
  sugar:         number   // g
  fiber:         number   // g
  fat:           number   // g
  saturated_fat: number   // g
  sodium:        number   // mg
}

export interface DailyGoals extends NutritionResult {}

async function callClaude(prompt: string, maxTokens = 512): Promise<string | null> {
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
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return null
    const json = await res.json()
    return json?.content?.[0]?.text ?? null
  } catch {
    return null
  }
}

function parseJson<T>(text: string | null): T | null {
  if (!text) return null
  try {
    // Extract the first JSON object from the response
    const match = text.match(/\{[\s\S]*?\}/)
    if (!match) return null
    return JSON.parse(match[0]) as T
  } catch {
    return null
  }
}

// ── Calculate meal nutrition ───────────────────────────────────────────────
export async function calculateNutrition(
  mealDescription: string
): Promise<{ ok: true; data: NutritionResult } | { ok: false; error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: 'ANTHROPIC_API_KEY mangler' }

  const text = await callClaude(
    `Du er ernæringsekspert med full kunnskap om norske matvaretabeller (matvaretabellen.no) og næringsinnhold i norske merkevarer.

OPPGAVE: Beregn næringsinnhold for dette måltidet NØYAKTIG:
"${mealDescription}"

METODE – følg disse stegene nøye:
1. Del opp i enkeltingredienser med realistisk porsjonsstørrelse for norske forhold
2. For norske merkevarer (Nordfjord, Gilde, Prior, REMA 1000, etc.): bruk produsentens deklarerte verdier
3. For generiske råvarer: bruk matvaretabellen.no-verdier
4. Beregn ingrediens for ingrediens, summer til totalt

NORSKE REFERANSEVERDIER (bruk disse som utgangspunkt):
- Grillpølse/medisterpølse (1 stk ca 130g): 320 kcal, 10g protein, 5g karbo, 28g fett, 800mg sodium
- Lompe (1 stk ca 50g): 100 kcal, 2g protein, 22g karbo, 0.5g fett
- Wienerbrød/pølsebrød (1 stk): 120 kcal, 4g protein, 22g karbo, 2g fett
- Pizza (porsjon 200g): 450-520 kcal avhengig av topping
- Brødskive (35g): 85 kcal, 3g protein, 14g karbo, 1g fett
- Smør på brød (10g): 74 kcal, 0g protein, 0g karbo, 8g fett
- Melk 1dl: 46 kcal, 3.4g protein, 4.7g karbo, 1.5g fett
- Egg (1 stk 60g): 88 kcal, 7.5g protein, 0.5g karbo, 6.5g fett
- Yoghurt naturell (100g): 62 kcal, 3.5g protein, 4.7g karbo, 3g fett

Svar KUN med JSON (ingen forklaring, ingen markdown):
{"kcal":430,"protein":12,"carbs":27,"sugar":3,"fiber":1,"fat":29,"saturated_fat":10,"sodium":820}

Alle tall er heltall. kcal = totale kalorier. sodium i mg, resten i gram.
VIKTIG: Ikke overestimer — bruk realistiske norske porsjonsstørrelser.`,
    512
  )

  const data = parseJson<NutritionResult>(text)
  if (!data) return { ok: false, error: 'Kunne ikke tolke AI-svar' }
  return { ok: true, data }
}

// ── Calculate daily nutritional goals ─────────────────────────────────────
const ACTIVITY_LABELS: Record<string, string> = {
  low:       'Lav (stillesittende, lite bevegelse)',
  moderate:  'Moderat (noe aktiv, 1-3 dager/uke)',
  high:      'Høy (aktiv, 4-5 dager/uke)',
  very_high: 'Veldig høy (daglig trening/sport)',
}

export async function calculateDailyGoals(params: {
  age: number
  weight_kg: number
  activity_level: string
}): Promise<{ ok: true; data: DailyGoals } | { ok: false; error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: 'ANTHROPIC_API_KEY mangler' }

  const actLabel = ACTIVITY_LABELS[params.activity_level] ?? params.activity_level

  const text = await callClaude(
    `Beregn anbefalt daglig næringsinntak for et barn/ungdom:
- Alder: ${params.age} år
- Vekt: ${params.weight_kg} kg
- Kjønn: jente
- Aktivitetsnivå: ${actLabel}

Bruk norske/nordiske kostholdsanbefalinger (Helsedirektoratet).
Svar KUN med JSON (ingen forklaring):
{"kcal":1900,"protein":50,"carbs":240,"sugar":45,"fiber":22,"fat":65,"saturated_fat":20,"sodium":1500}

Alle tall er heltall. sodium i mg, resten i gram.`,
    256
  )

  const data = parseJson<DailyGoals>(text)
  if (!data) return { ok: false, error: 'Kunne ikke beregne dagsmål' }
  return { ok: true, data }
}

// ── Medication info suggestion ─────────────────────────────────────────────
export async function suggestMedicationInfo(
  medicationName: string
): Promise<{ ok: true; dosage: string; unit: string; notes: string } | { ok: false; error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: 'ANTHROPIC_API_KEY mangler' }

  const text = await callClaude(
    `Gi informasjon om medisinen eller tilskuddet: "${medicationName}"

Svar KUN med JSON (ingen forklaring):
{"dosage":"10","unit":"mg","notes":"Kort beskrivelse av hva det er og vanlig dosering for barn/ungdom"}

Bruk norsk. Maks 100 tegn i notes. Hvis ukjent, bruk tomme strenger.`,
    200
  )

  const data = parseJson<{ dosage: string; unit: string; notes: string }>(text)
  if (!data) return { ok: false, error: 'Kunne ikke tolke svar' }
  return { ok: true, dosage: data.dosage ?? '', unit: data.unit ?? '', notes: data.notes ?? '' }
}
