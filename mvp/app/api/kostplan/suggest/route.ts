import { NextRequest, NextResponse } from 'next/server'
import { callClaude, safeParseJson } from '@/lib/ai/anthropic'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Helsemål-beskrivelser som sendes til Claude
const GOAL_CONTEXT: Record<string, { nb: string; dietary_focus: string }> = {
  general:           { nb: 'Generelt sunt kosthold',         dietary_focus: 'Variert og balansert kost med mye grønnsaker, fullkorn og magert protein.' },
  weight_loss:       { nb: 'Vektreduksjon',                  dietary_focus: 'Kaloriredusert, høy fiber, høyt proteininnhold, lavt GI. Mettende måltider som reduserer sug. Unngå tomme kalorier.' },
  weight_gain:       { nb: 'Vektøkning',                     dietary_focus: 'Kaloritett mat, høyt proteininnhold, hyppige måltider. Næringsrikt og appetitstimulerende.' },
  anxiety_reduction: { nb: 'Angstreduserende kost',          dietary_focus: 'Høy omega-3 (laks, makrell, valnøtter), magnesiumrikt (grønne blader, frø), B-vitaminer, probiotika for tarmhelse. Unngå koffein, sukker og ultraprosessert mat. Stabilt blodsukker er viktig.' },
  anti_inflammatory: { nb: 'Betennelsesdempende',            dietary_focus: 'Rik på antioksidanter (bær, grønnsaker), omega-3, gurkemeie, ingefær. Unngå omega-6-overskudd, prosessert mat og sukker.' },
  gut_health:        { nb: 'Tarmhelse / IBS-vennlig',        dietary_focus: 'Probiotika (yoghurt, kefir, surkål), prebiotika (løk, hvitløk, banan), fiber. Unngå triggere ved IBS: hvete, løk rå, melk. Mild og lett fordøyelig mat.' },
  blood_sugar:       { nb: 'Blodsukkerstabilisering',        dietary_focus: 'Lavt GI, høy fiber, protein ved hvert måltid. Unngå hvitt brød, sukker og juice. Regelmessige måltider.' },
  heart_health:      { nb: 'Hjertehelse',                    dietary_focus: 'Omega-3, fiber (havre, belgfrukter), lite mettet fett og salt. Olivenolje, nøtter, bær og grønnsaker er sentralt.' },
  energy:            { nb: 'Energi og utholdenhet',          dietary_focus: 'Komplekse karbohydrater, jern (kjøtt, belgfrukter, grønne blader), B12, magnesium. Unngå sukkerkrasj. Jevnt energinivå gjennom dagen.' },
  muscle_building:   { nb: 'Muskelbygging / styrke',         dietary_focus: 'Høyt proteininnhold (1,6-2g/kg kroppsvekt), komplekse karbohydrater rundt treningsøkter, kreatin fra kjøtt.' },
  adhd_focus:        { nb: 'Konsentrasjon / ADHD-støtte',    dietary_focus: 'Omega-3 (laks, valnøtter), jern, sink, magnesium, protein til frokost. Unngå kunstige fargestoffer, sukker og koffein. Stabilt blodsukker gjennom dagen.' },
  sleep:             { nb: 'Søvnforbedring',                 dietary_focus: 'Magnesium, tryptofan (kalkun, egg, bananer, meieri), komplekse karbohydrater om kvelden. Unngå koffein etter kl 14, alkohol og tung mat sent.' },
  immune_support:    { nb: 'Immunforsvar',                   dietary_focus: 'Vitamin C (paprika, sitrus), D-vitamin (laks, solskinnet egg), sink (gresskar, kjøtt), probiotika og antioksidanter.' },
  bone_health:       { nb: 'Skjeletthelse',                  dietary_focus: 'Kalsium (meieri, grønnkål, sardiner), vitamin D (laks, egg), K2 (fermentert mat). Unngå overdreven salt og sukker.' },
  sports_performance:{ nb: 'Idrettsernæring',                dietary_focus: 'Karbohydratlading før økt, rask protein-restitusjon etter økt, elektrolytter. Timingen av måltider er viktig.' },
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'frokost',
  lunch: 'lunsj',
  dinner: 'middag',
  snack: 'mellommåltid / snack',
  supper: 'kveldsmat',
}

export interface MealSuggestion {
  title: string
  description: string
  ingredients: string[]
  tags: string[]
  prep_minutes: number
  nutrition_notes: string
  why_fits_goal: string
}

export async function POST(req: NextRequest) {
  try {
    // Auth
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

    const body = await req.json()
    const { person_id, meal_type, day_of_week, existing_meals } = body as {
      person_id: string
      meal_type: string
      day_of_week: number
      existing_meals: string[]
    }

    // Hent person med mål og preferanser
    const { data: person, error: personErr } = await supabase
      .from('kp_persons')
      .select('*')
      .eq('id', person_id)
      .single()

    if (personErr || !person) {
      return NextResponse.json({ error: 'Person ikke funnet' }, { status: 404 })
    }

    const goalInfo = GOAL_CONTEXT[person.health_goal] || GOAL_CONTEXT.general
    const dayName = ['mandag','tirsdag','onsdag','torsdag','fredag','lørdag','søndag'][day_of_week - 1] || 'ukjent dag'
    const mealLabel = MEAL_LABELS[meal_type] || meal_type

    // Bygg prompt
    const systemPrompt = `Du er en ernæringsfysiolog og personlig kokkassistent som lager norske måltidsforslag.
Gi alltid svar som gyldig JSON — ingen markdown, ingen forklaring utenfor JSON.
Svar på norsk bokmål.`

    const userPrompt = `Lag 4 måltidsforslag til ${person.name} for ${mealLabel} på ${dayName}.

HELSEMÅL: ${goalInfo.nb}
KOSTRÅD FOR MÅLET: ${goalInfo.dietary_focus}
${person.health_notes ? `PERSONLIGE HELSENOTATER: ${person.health_notes}` : ''}

PREFERANSER:
- Liker: ${person.likes?.join(', ') || 'ikke spesifisert'}
- Liker ikke: ${person.dislikes?.join(', ') || 'ingen'}
- Allergier / intoleranser: ${person.allergies?.join(', ') || 'ingen'}
- Kresennivå: ${person.pickiness_level}/5 (1=spiser alt, 5=veldig kresen)
- Matbudsjett: ${person.budget_level === 'budget' ? 'budsjett (billig mat)' : person.budget_level === 'premium' ? 'premium' : 'middels'}
${person.lunchbox_friendly ? '- Maten bør egne seg i matboks / tåle å pakkes.' : ''}

EKSISTERENDE MÅLTIDER DENNE UKEN (unngå gjentakelse):
${existing_meals?.length ? existing_meals.join(', ') : 'Ingen ennå'}

Returner et JSON-objekt med denne strukturen:
{
  "suggestions": [
    {
      "title": "Kortfattet navn på retten",
      "description": "1-2 setninger om retten",
      "ingredients": ["ingrediens 1", "ingrediens 2"],
      "tags": ["tag1", "tag2"],
      "prep_minutes": 20,
      "nutrition_notes": "Kort om næringsverdien",
      "why_fits_goal": "Kort forklaring på hvorfor dette passer til ${goalInfo.nb}"
    }
  ]
}`

    const raw = await callClaude({
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 2000,
    })

    const parsed = safeParseJson<{ suggestions: MealSuggestion[] }>(raw)
    if (!parsed?.suggestions) {
      return NextResponse.json({ error: 'Klarte ikke tolke AI-svar', raw }, { status: 500 })
    }

    // Logg AI-forespørsel
    await supabase.from('kp_ai_requests').insert({
      profile_id: user.id,
      provider: 'anthropic',
      mode: 'suggest_meals',
      model: 'claude-haiku-4-5',
      input_json: { person_id, meal_type, day_of_week, existing_meals },
      output_json: parsed,
    })

    return NextResponse.json({ suggestions: parsed.suggestions })

  } catch (err) {
    console.error('[kp/suggest]', err)
    return NextResponse.json({ error: 'Serverfeil' }, { status: 500 })
  }
}
