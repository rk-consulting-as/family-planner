import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()

    // Verifiser bruker via SSR-klient
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
          },
        },
      }
    )

    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

    // Bruk service role key for å omgå RLS — vi har allerede verifisert brukeren
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const body = await req.json()

    const { data, error } = await adminClient
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
