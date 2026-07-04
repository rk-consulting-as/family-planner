'use server'

export interface ExtractedBloodTest {
  test_date:   string | null        // ISO date: "2026-06-16"
  institution: string | null
  ordered_by:  string | null
  notes:       string | null
  markers: Array<{
    marker:   string
    value:    number
    unit:     string
    ref_min:  number | null
    ref_max:  number | null
  }>
}

const EXTRACTION_PROMPT = `Du er en medisinsk dataassistent. Analyser dette laboratorie-/blodprøveresultatet.
Trekk ut ALL informasjon og returner KUN gyldig JSON — ingen forklaring, ingen markdown.

JSON-format:
{
  "test_date": "YYYY-MM-DD eller null",
  "institution": "navn på sykehus/lab eller null",
  "ordered_by": "rekvirent/lege/avdeling eller null",
  "notes": "kort sammendrag av evt. kommentarer eller null",
  "markers": [
    {
      "marker": "norsk navn på analysen",
      "value": 12.5,
      "unit": "g/dL",
      "ref_min": 11.5,
      "ref_max": 15.5
    }
  ]
}

Regler:
- Inkluder ALLE analyseverdier du finner, ikke bare noen få
- Bruk norske navn der det er naturlig (f.eks. "Hemoglobin" ikke "Hgb")
- ref_min/ref_max: bruk referanseintervallet fra dokumentet der det finnes, ellers null
- value MÅ være et tall (float), ikke tekst
- Hvis datoen er uklar, sett test_date til null`

async function callClaudeWithFile(
  base64: string,
  mediaType: string,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  // Build content block — image or document (PDF)
  const fileBlock = mediaType === 'application/pdf'
    ? {
        type: 'document',
        source: { type: 'base64', media_type: mediaType, data: base64 },
      }
    : {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 },
      }

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
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              fileBlock,
              { type: 'text', text: EXTRACTION_PROMPT },
            ],
          },
        ],
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('Claude API error:', err)
      return null
    }
    const json = await res.json()
    return json?.content?.[0]?.text ?? null
  } catch (e) {
    console.error('Claude fetch error:', e)
    return null
  }
}

function parseExtracted(text: string | null): ExtractedBloodTest | null {
  if (!text) return null
  try {
    // Extract first JSON object (handles any surrounding text)
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0]) as ExtractedBloodTest
    // Validate minimum shape
    if (!Array.isArray(parsed.markers)) return null
    // Coerce values to numbers, filter out bad rows
    parsed.markers = parsed.markers
      .map(m => ({
        ...m,
        value: typeof m.value === 'string' ? parseFloat(m.value) : m.value,
        ref_min: m.ref_min !== null && m.ref_min !== undefined ? Number(m.ref_min) : null,
        ref_max: m.ref_max !== null && m.ref_max !== undefined ? Number(m.ref_max) : null,
      }))
      .filter(m => m.marker && !isNaN(m.value))
    return parsed
  } catch {
    return null
  }
}

export async function extractBloodTestFromFile(
  base64: string,
  mediaType: string,
): Promise<
  | { ok: true; data: ExtractedBloodTest }
  | { ok: false; error: string }
> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: 'ANTHROPIC_API_KEY mangler i .env.local' }
  }

  const supported = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
  if (!supported.includes(mediaType)) {
    return { ok: false, error: `Filtype '${mediaType}' støttes ikke. Bruk JPEG, PNG, WebP eller PDF.` }
  }

  const text = await callClaudeWithFile(base64, mediaType)
  const data = parseExtracted(text)

  if (!data || data.markers.length === 0) {
    return { ok: false, error: 'Ingen blodprøveverdier funnet i filen. Prøv et klarere bilde.' }
  }

  return { ok: true, data }
}
