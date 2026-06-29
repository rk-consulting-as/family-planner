import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()

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

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verifiser at personen tilhører innlogget bruker
    const { data: existing } = await adminClient
      .from('kp_persons')
      .select('created_by')
      .eq('id', id)
      .single()

    if (!existing || existing.created_by !== user.id) {
      return NextResponse.json({ error: 'Ikke tilgang' }, { status: 403 })
    }

    const body = await req.json()

    const { error } = await adminClient
      .from('kp_persons')
      .update({
        name:             body.name,
        avatar_emoji:     body.avatar_emoji,
        color_hex:        body.color_hex,
        health_goal:      body.health_goal,
        health_notes:     body.health_notes || null,
        likes:            body.likes ?? [],
        dislikes:         body.dislikes ?? [],
        allergies:        body.allergies ?? [],
        pickiness_level:  body.pickiness_level,
        budget_level:     body.budget_level,
        lunchbox_friendly: body.lunchbox_friendly,
      })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[kp/person/patch]', err)
    return NextResponse.json({ error: 'Serverfeil' }, { status: 500 })
  }
}
