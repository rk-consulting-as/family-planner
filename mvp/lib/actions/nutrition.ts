'use server'

export interface NutritionResult {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export async function calculateNutrition(
  mealDescription: string
): Promise<{ ok: true; data: NutritionResult } | { ok: false; error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { ok: false, error: 'ANTHROPIC_API_KEY mangler i miljøvariabler' }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 128,
        messages: [
          {
            role: 'user',
            content: `Beregn næringsinnhold for dette måltidet basert på norske matvaretabeller:
"${mealDescription}"

Svar KUN med JSON (ingen forklaring, ingen markdown):
{"kcal":450,"protein":18,"carbs":52,"fat":14}

Rund av til nærmeste hele tall. Kcal = totale kalorier.`,
          },
        ],
      }),
    })

    if (!res.ok) {
      return { ok: false, error: `API-feil: ${res.status}` }
    }

    const json = await res.json()
    const text: string = json?.content?.[0]?.text ?? ''

    // Extract JSON even if there's extra whitespace
    const match = text.match(/\{[^}]+\}/)
    if (!match) return { ok: false, error: 'Kunne ikke tolke AI-svar' }

    const data = JSON.parse(match[0]) as NutritionResult
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function suggestMedicationInfo(
  medicationName: string
): Promise<{ ok: true; dosage: string; unit: string; notes: string } | { ok: false; error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { ok: false, error: 'ANTHROPIC_API_KEY mangler' }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Gi informasjon om medisinen eller tilskuddet: "${medicationName}"

Svar KUN med JSON (ingen forklaring):
{"dosage":"10","unit":"mg","notes":"Kort beskrivelse av hva det er og vanlig dosering for barn/ungdom"}

Bruk norsk. Vær kortfattet (maks 100 tegn i notes). Hvis ukjent, bruk tomme strenger.`,
          },
        ],
      }),
    })

    if (!res.ok) return { ok: false, error: `API-feil: ${res.status}` }

    const json = await res.json()
    const text: string = json?.content?.[0]?.text ?? ''
    const match = text.match(/\{[^}]+\}/)
    if (!match) return { ok: false, error: 'Kunne ikke tolke svar' }

    const data = JSON.parse(match[0])
    return { ok: true, dosage: data.dosage ?? '', unit: data.unit ?? '', notes: data.notes ?? '' }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
