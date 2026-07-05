import { NextRequest, NextResponse } from 'next/server'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FoodSearchResult {
  id:       string
  name:     string
  per100g:  {
    kcal:          number
    protein:       number
    fat:           number
    saturated_fat: number
    carbs:         number
    sugar:         number
    fiber:         number
    sodium:        number
  }
  portions: {
    id:    string
    label: string
    grams: number
  }[]
}

// ── Module-level server-side cache ────────────────────────────────────────────

let cachedFoods: FoodSearchResult[] | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 h — matvaretabellen updates annually

// ── Parse raw food entry from matvaretabellen API ─────────────────────────────

// Defensive number extraction from various possible nutrient shapes
function num(val: unknown): number {
  if (typeof val === 'number') return val
  if (val && typeof val === 'object') {
    const v = val as Record<string, unknown>
    if (typeof v.quantity === 'number') return v.quantity
    if (typeof v.value === 'number') return v.value
  }
  return 0
}

function parseName(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    return String(r.nb ?? r.no ?? r.en ?? '')
  }
  return ''
}

// Known EuroFIR nutrient codes used by Matvaretabellen
const NUTRIENT_MAP: Record<string, (keyof FoodSearchResult['per100g'])[]> = {
  Enerc:      ['kcal'],
  EnercKcal:  ['kcal'],
  Prot:       ['protein'],
  Fat:        ['fat'],
  Fasat:      ['saturated_fat'],
  Choavl:     ['carbs'],
  Choavldf:   ['carbs'],
  Sugar:      ['sugar'],
  Sugars:     ['sugar'],
  Sugpt:      ['sugar'],
  Fibc:       ['fiber'],
  Fibtg:      ['fiber'],
  Na:         ['sodium'],
  Nacl:       ['sodium'],
}

function parseFood(raw: Record<string, unknown>): FoodSearchResult | null {
  const id   = String(raw.id ?? '')
  const name = parseName(raw.name ?? raw.foodName)
  if (!name || !id) return null

  // Parse nutrients
  const n  = (raw.nutrients ?? {}) as Record<string, unknown>
  const p: FoodSearchResult['per100g'] = { kcal: 0, protein: 0, fat: 0, saturated_fat: 0, carbs: 0, sugar: 0, fiber: 0, sodium: 0 }

  for (const [code, fields] of Object.entries(NUTRIENT_MAP)) {
    const val = num(n[code])
    if (val > 0) {
      for (const field of fields) {
        if (p[field] === 0) p[field] = Math.round(val)
      }
    }
  }

  // Parse portions
  const rawPortions = Array.isArray(raw.portions) ? raw.portions : []
  const portions: FoodSearchResult['portions'] = rawPortions
    .map((rp: unknown, i: number) => {
      const p2 = rp as Record<string, unknown>
      const label = parseName(p2.name ?? p2.portionName) || String(p2.portionId ?? `porsjon ${i+1}`)
      const grams = Number(p2.quantity ?? p2.grams ?? p2.amount ?? 0)
      if (grams <= 0) return null
      return { id: String(p2.portionId ?? i), label, grams: Math.round(grams) }
    })
    .filter(Boolean) as FoodSearchResult['portions']

  if (portions.length === 0) {
    portions.push({ id: '100g', label: '100 g', grams: 100 })
  }

  return { id, name, per100g: p, portions }
}

// ── Load + cache all foods ────────────────────────────────────────────────────

async function loadFoods(): Promise<FoodSearchResult[]> {
  if (cachedFoods && Date.now() - cacheTimestamp < CACHE_TTL_MS) return cachedFoods

  const res = await fetch('https://www.matvaretabellen.no/api/nb/foods.json', {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(20_000),
  })

  if (!res.ok) throw new Error(`Matvaretabellen fetch failed: ${res.status}`)

  const raw: unknown[] = await res.json()
  const foods = (raw as Record<string, unknown>[])
    .map(parseFood)
    .filter((f): f is FoodSearchResult => f !== null)

  cachedFoods    = foods
  cacheTimestamp = Date.now()

  console.log(`[matvaretabellen] Cached ${foods.length} foods`)
  return foods
}

// ── API handler ───────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase()
  if (q.length < 2) return NextResponse.json([])

  try {
    const foods = await loadFoods()

    const terms = q.split(/\s+/).filter(Boolean)

    const matches = foods
      .filter(f => {
        const name = f.name.toLowerCase()
        return terms.every(t => name.includes(t))
      })
      .sort((a, b) => {
        const al = a.name.toLowerCase()
        const bl = b.name.toLowerCase()
        // Prefer start-of-string match
        const aExact = al.startsWith(q) ? 0 : al.split(/\s+/).some(w => w.startsWith(q)) ? 1 : 2
        const bExact = bl.startsWith(q) ? 0 : bl.split(/\s+/).some(w => w.startsWith(q)) ? 1 : 2
        if (aExact !== bExact) return aExact - bExact
        return a.name.localeCompare(b.name, 'nb')
      })
      .slice(0, 18)

    return NextResponse.json(matches)
  } catch (err) {
    console.error('[matvaretabellen]', err)
    return NextResponse.json([], { status: 200 }) // Return empty list, not 500, so UI degrades gracefully
  }
}
