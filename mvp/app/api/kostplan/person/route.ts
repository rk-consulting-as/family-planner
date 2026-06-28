import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()

    // Bruk SSR-klient kun for å verifisere sesjon og hente token
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {}
          },
        },
      }
    )

    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

    // Hent access token eksplisitt
    const { data: { session } } = await authClient.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Ingen sesjon' }, { status: 401 })

    // Lag en klient med eksplisitt Authorization-header — garanterer at auth.uid() fungerer i RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${session.access_token}` } } }
    )

    const body = await req.json()

    const { data, error } = await supabase
      .from('kp_persons')
      .insert({
        created_by: user.id,
        linked_profile_id: body.linked_profile_id || null,
        name: body.name,
        avatar_emoji: body.avatar_emoji,
        color_hex: body.color_hex,
        health_goal: body.health_goal,
        health_notes: body.health_notes || null,
        likes: body.likes ?? [],
        dislikes: body.dislikes ?? [],
        allergies: body.allergies ?? [],
        pickiness_level: body.pickiness_level,
        budget_level: body.budget_level,
        lunchbox_friendly: body.lunchbox_friendly,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ id: data.id })
  } catch (err) {
    console.error('[kp/person]', err)
    return NextResponse.json({ error: 'Serverfeil' }, { status: 500 })
  }
}
