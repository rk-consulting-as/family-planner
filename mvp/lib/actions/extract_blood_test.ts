'use server'

// ── Types ────────────────────────────────────────────────────────────────────

export interface BloodMarkerExtracted {
  marker:  string
  value:   number
  unit:    string
  ref_min: number | null
  ref_max: number | null
}

export interface BloodTestSession {
  test_date:   string   // ISO: "2025-06-10"
  markers:     BloodMarkerExtracted[]
}

export interface ExtractedBloodTest {
  // Shared metadata (same lab report)
  institution: string | null
  ordered_by:  string | null
  notes:       string | null
  // Each unique date found becomes its own session
  sessions:    BloodTestSession[]
}

// ── Prompt ───────────────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `Du er en medisinsk dataassistent. Analyser dette norske laboratorie-/blodprøveresultatet.

VIKTIG: Norske lab-utskrifter har ofte FLERE datokolonner per rad:
- "Siste dato" + "Siste svar" = den nyeste målingen
- "Forrige dato" + "Forrige svar" = en tidligere måling

Grupper ALLE målinger etter dato de ble tatt. Én unik dato = én session.

Returner KUN gyldig JSON (ingen forklaring, ingen markdown):

{
  "institution": "navn på sykehus/klinikk/legekontor eller null",
  "ordered_by": "rekvirent/lege/avdeling eller null",
  "notes": "kort sammendrag av evt. kommentarer eller null",
  "sessions": [
    {
      "test_date": "ÅÅÅÅ-MM-DD",
      "markers": [
        {
          "marker": "norsk navn på analysen (f.eks. B-Hemoglobin, S-Ferritin)",
          "value": 12.1,
          "unit": "g/dL",
          "ref_min": 11.7,
          "ref_max": 15.3
        }
      ]
    }
  ]
}

Regler:
- Inkluder ALLE analyseverdier du finner
- Datoformat i dokumentet: DD.MM.ÅÅ eller DD.MM.ÅÅÅÅ → konverter til ÅÅÅÅ-MM-DD
  Eks: "02.01.26" → "2026-01-02", "10.06.25" → "2025-06-10"
- Sorter sessions etter dato (eldst først)
- ref_min/ref_max: bruk referanseintervallet fra dokumentet (f.eks. "11.7-15.3" → ref_min:11.7, ref_max:15.3), ellers null
- value MÅ være et tall (float/int)
- Hvis en markør bare har én dato, legg den bare i én session`

// ── API call ─────────────────────────────────────────────────────────────────

async function callClaudeWithFile(base64: string, mediaType: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const fileBlock =
    mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64 } }
      : { type: 'image',    source: { type: 'base64', media_type: mediaType, data: base64 } }

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
        max_tokens: 4096,
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
      console.error('Claude API error:', await res.text())
      return null
    }
    const json = await res.json()
    return json?.content?.[0]?.text ?? null
  } catch (e) {
    console.error('Claude fetch error:', e)
    return null
  }
}

// ── Parse + validate ──────────────────────────────────────────────────────────

function coerceNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return isNaN(n) ? null : n
}

function parseExtracted(text: string | null): ExtractedBloodTest | null {
  if (!text) return null
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0]) as ExtractedBloodTest

    if (!Array.isArray(parsed.sessions)) return null

    // Sanitise each session
    parsed.sessions = parsed.sessions
      .map(s => ({
        test_date: s.test_date ?? '',
        markers: (Array.isArray(s.markers) ? s.markers : [])
          .map(m => ({
            marker:  String(m.marker ?? '').trim(),
            value:   coerceNum(m.value) ?? 0,
            unit:    String(m.unit ?? '').trim(),
            ref_min: coerceNum(m.ref_min),
            ref_max: coerceNum(m.ref_max),
          }))
          .filter(m => m.marker && !isNaN(m.value)),
      }))
      .filter(s => s.test_date && s.markers.length > 0)
      // Sort ascending by date
      .sort((a, b) => a.test_date.localeCompare(b.test_date))

    return parsed
  } catch {
    return null
  }
}

// ── Public server action ──────────────────────────────────────────────────────

export async function extractBloodTestFromFile(
  base64: string,
  mediaType: string,
): Promise<{ ok: true; data: ExtractedBloodTest } | { ok: false; error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: 'ANTHROPIC_API_KEY mangler i .env.local' }
  }

  const supported = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
  if (!supported.includes(mediaType)) {
    return { ok: false, error: `Filtype '${mediaType}' støttes ikke. Bruk JPEG, PNG eller PDF.` }
  }

  const text = await callClaudeWithFile(base64, mediaType)
  const data = parseExtracted(text)

  if (!data || data.sessions.length === 0) {
    return { ok: false, error: 'Ingen blodprøveverdier funnet. Prøv et klarere bilde.' }
  }

  return { ok: true, data }
}
