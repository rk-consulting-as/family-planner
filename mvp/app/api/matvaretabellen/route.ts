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
//
// Actual API structure (from /api/nb/foods.json):
//   { foodId, foodName, calories: {quantity, unit},
//     portions: [{portionName, portionUnit, quantity, unit}],
//     constituents: [{nutrientId, quantity, unit, sourceId}] }

function parseFood(raw: Record<string, unknown>): FoodSearchResult | null {
  // Food ID and name
  const id   = String(raw.foodId ?? raw.id ?? '').trim()
  const name = typeof raw.foodName === 'string'
    ? raw.foodName.trim()
    : typeof raw.name === 'string'
      ? raw.name.trim()
      : ''
  if (!id || !name) return null

  // kcal — top-level "calories" field
  const calObj = raw.calories as Record<string, unknown> | undefined
  const kcal = typeof calObj?.quantity === 'number'
    ? Math.round(calObj.quantity)
    : 0

  // Other nutrients — "constituents" is an array of {nutrientId, quantity, unit}
  const rawConstituents = Array.isArray(raw.constituents) ? raw.constituents : []

  // Build a lookup: nutrientId → quantity
  const nutr: Record<string, number> = {}
  for (const c of rawConstituents) {
    const item = c as Record<string, unknown>
    const code = String(item.nutrientId ?? '')
    const qty  = typeof item.quantity === 'number' ? item.quantity : 0
    if (code && qty > 0) nutr[code] = qty
  }

  // EuroFIR code mapping
  const protein       = Math.round(nutr['Prot']   ?? 0)
  const fat           = Math.round(nutr['Fat']    ?? 0)
  const saturated_fat = Math.round(nutr['Fasat']  ?? 0)
  const carbs         = Math.round(nutr['Choavl'] ?? nutr['Choavldf'] ?? 0)
  const sugar         = Math.round(nutr['Sugar']  ?? nutr['Sugars']   ?? nutr['Sugpt'] ?? 0)
  const fiber         = Math.round(nutr['Fibc']   ?? nutr['Fibtg']    ?? 0)
  // Sodium stored as mg in Matvaretabellen; keep as mg
  const sodium        = Math.round(nutr['Na']     ?? nutr['Nacl']     ?? 0)

  // Portions
  const rawPortions = Array.isArray(raw.portions) ? raw.portions : []
  const portions: FoodSearchResult['portions'] = rawPortions
    .map((rp: unknown, i: number) => {
      const p = rp as Record<string, unknown>
      const portionName = String(p.portionName ?? p.name ?? '').trim()
      const portionUnit = String(p.portionUnit ?? '').trim()
      const grams = Number(p.quantity ?? p.grams ?? 0)
      if (grams <= 0) return null
      // portionName is the human label ("1 stk", "spiseskje", "desiliter")
      const label = portionName
        ? `${portionName} (${Math.round(grams)} g)`
        : `${Math.round(grams)} g`
      return { id: portionName || String(i), label, grams: Math.round(grams) }
    })
    .filter(Boolean) as FoodSearchResult['portions']

  if (portions.length === 0) {
    portions.push({ id: '100g', label: '100 g', grams: 100 })
  }

  return {
    id,
    name,
    per100g: { kcal, protein, fat, saturated_fat, carbs, sugar, fiber, sodium },
    portions,
  }
}

// ── Load + cache all foods ────────────────────────────────────────────────────

async function loadFoods(): Promise<FoodSearchResult[]> {
  if (cachedFoods && Date.now() - cacheTimestamp < CACHE_TTL_MS) return cachedFoods

  const res = await fetch('https://www.matvaretabellen.no/api/nb/foods.json', {
    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(25_000),
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

  // Debug endpoint: ?debug=1 returns first 3 raw + parsed foods
  if (request.nextUrl.searchParams.get('debug') === '1') {
    try {
      const res = await fetch('https://www.matvaretabellen.no/api/nb/foods.json', {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(25_000),
      })
      const raw = await res.json() as Record<string, unknown>[]
      const sample = raw.slice(0, 3)
      const parsed = sample.map(parseFood)
      return NextResponse.json({ count: raw.length, sample, parsed })
    } catch (err) {
      return NextResponse.json({ error: String(err) })
    }
  }

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
        const aExact = al.startsWith(q) ? 0 : al.split(/\s+/).some(w => w.startsWith(q)) ? 1 : 2
        const bExact = bl.startsWith(q) ? 0 : bl.split(/\s+/).some(w => w.startsWith(q)) ? 1 : 2
        if (aExact !== bExact) return aExact - bExact
        return a.name.localeCompare(b.name, 'nb')
      })
      .slice(0, 18)

    return NextResponse.json(matches)
  } catch (err) {
    console.error('[matvaretabellen]', err)
    return NextResponse.json([])
  }
}
