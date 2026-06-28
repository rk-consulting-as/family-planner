'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

interface DayPlan { id: string; week_plan_id: string; day_of_week: number; notes: string | null }
interface MealSlot { id: string; day_plan_id: string; meal_type: MealType; title: string | null; ingredients: string[]; ai_generated: boolean }
interface Profile { id: string; display_name: string; avatar_url: string | null; color_hex: string | null }

const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']
const MEALS: { type: MealType; label: string; emoji: string }[] = [
  { type: 'breakfast', label: 'Frokost', emoji: '🌅' },
  { type: 'lunch',     label: 'Lunsj',   emoji: '🥗' },
  { type: 'dinner',    label: 'Middag',  emoji: '🍽️' },
  { type: 'snack',     label: 'Snack',   emoji: '🍎' },
]

function getMonday(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}

export default function KostPlanDashboard() {
  const [profile, setProfile]     = useState<Profile | null>(null)
  const [dayPlans, setDayPlans]   = useState<DayPlan[]>([])
  const [slots, setSlots]         = useState<MealSlot[]>([])
  const [loading, setLoading]     = useState(true)
  const [hasPrefs, setHasPrefs]   = useState(true)
  const [adding, setAdding]       = useState<{ dayId: string; type: MealType } | null>(null)
  const [newTitle, setNewTitle]   = useState('')
  const [newIngr, setNewIngr]     = useState('')
  const router = useRouter()
  const sb = createClient()
  const monday = getMonday()

  const init = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { router.push('/sign-in'); return }

    const [{ data: prof }, { data: prefs }] = await Promise.all([
      sb.from('profiles').select('id,display_name,avatar_url,color_hex').eq('id', user.id).single(),
      sb.from('kp_preferences').select('id').eq('profile_id', user.id).single(),
    ])
    setProfile(prof)
    setHasPrefs(!!prefs)

    // Hent eller opprett ukeplan
    let { data: wp } = await sb.from('kp_week_plans')
      .select('id').eq('profile_id', user.id).eq('week_start', monday).single()
    if (!wp) {
      const { data } = await sb.from('kp_week_plans').insert({ profile_id: user.id, week_start: monday }).select('id').single()
      wp = data
    }
    if (!wp) { setLoading(false); return }

    // Hent eller opprett dagplaner
    let { data: dps } = await sb.from('kp_day_plans').select('*').eq('week_plan_id', wp.id).order('day_of_week')
    if (!dps || dps.length < 7) {
      const existing = (dps || []).map((d: DayPlan) => d.day_of_week)
      const toCreate = [1,2,3,4,5,6,7].filter(d => !existing.includes(d)).map(d => ({ week_plan_id: wp!.id, day_of_week: d }))
      if (toCreate.length) await sb.from('kp_day_plans').insert(toCreate)
      const { data: refreshed } = await sb.from('kp_day_plans').select('*').eq('week_plan_id', wp.id).order('day_of_week')
      dps = refreshed
    }
    setDayPlans(dps || [])

    const ids = (dps || []).map((d: DayPlan) => d.id)
    if (ids.length) {
      const { data: sl } = await sb.from('kp_meal_slots').select('*').in('day_plan_id', ids)
      setSlots(sl || [])
    }
    setLoading(false)
  }, [monday, router, sb])

  useEffect(() => { init() }, [init])

  async function addMeal() {
    if (!adding || !newTitle.trim()) return
    const { data } = await sb.from('kp_meal_slots').insert({
      day_plan_id: adding.dayId,
      meal_type: adding.type,
      title: newTitle.trim(),
      ingredients: newIngr.split(',').map(s => s.trim()).filter(Boolean),
    }).select().single()
    if (data) setSlots(prev => [...prev, data])
    setAdding(null); setNewTitle(''); setNewIngr('')
  }

  async function deleteSlot(id: string) {
    await sb.from('kp_meal_slots').delete().eq('id', id)
    setSlots(prev => prev.filter(m => m.id !== id))
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#6B7280', fontSize: 14 }}>
      Laster KostPlan…
    </div>
  )

  const initials = profile?.display_name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  const weekLabel = new Date(monday).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={s.backBtn} onClick={() => router.push('/dashboard')} title="Tilbake til Familie-appen">
            ← Familie
          </button>
          <div style={s.logo}>Kost<span style={{ color: '#3B7DD8' }}>Plan</span></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#6B7280' }}>Uke fra {weekLabel}</span>
          {!hasPrefs && (
            <button style={s.setupBtn} onClick={() => router.push('/kostplan/onboarding')}>
              ⚙️ Sett opp preferanser
            </button>
          )}
          <button style={s.aiBtn} title="Kommer snart">✨ AI-forslag</button>
          <div style={{ ...s.avatar, background: profile?.color_hex || '#3B7DD8' }}>{initials}</div>
        </div>
      </header>

      {/* Ukegrid */}
      <div style={s.grid}>
        {dayPlans.map((day, i) => {
          const daySlots = slots.filter(m => m.day_plan_id === day.id)
          const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
          const isToday = i === todayIdx

          return (
            <div key={day.id} style={{ ...s.dayCol, ...(isToday ? s.dayToday : {}) }}>
              <div style={s.dayHead}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{DAYS[i]}</span>
                {isToday && <span style={s.todayBadge}>I dag</span>}
              </div>

              {MEALS.map(({ type, label, emoji }) => {
                const slot = daySlots.find(sl => sl.meal_type === type)
                return (
                  <div key={type} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 3 }}>{emoji} {label}</div>
                    {slot ? (
                      <div style={s.mealCard}>
                        <div style={{ fontSize: 13, fontWeight: 500, paddingRight: 16 }}>{slot.title}</div>
                        {slot.ingredients.length > 0 && (
                          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                            {slot.ingredients.slice(0, 3).join(', ')}{slot.ingredients.length > 3 ? '…' : ''}
                          </div>
                        )}
                        {slot.ai_generated && <span style={s.aiBadge}>✨</span>}
                        <button style={s.delBtn} onClick={() => deleteSlot(slot.id)}>×</button>
                      </div>
                    ) : (
                      <button style={s.addBtn} onClick={() => { setAdding({ dayId: day.id, type }); setNewTitle(''); setNewIngr('') }}>
                        + Legg til
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {adding && (
        <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) setAdding(null) }}>
          <div style={s.modal}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 18 }}>Legg til måltid</div>
            <div style={{ marginBottom: 14 }}>
              <label style={s.label}>Hva skal du spise?</label>
              <input style={s.input} autoFocus value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMeal()}
                placeholder="f.eks. Pastasalat med kylling" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={s.label}>Ingredienser (valgfritt)</label>
              <input style={s.input} value={newIngr}
                onChange={e => setNewIngr(e.target.value)}
                placeholder="pasta, kylling, paprika" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={s.btnGhost} onClick={() => setAdding(null)}>Avbryt</button>
              <button style={s.btnPrimary} onClick={addMeal}>Lagre</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  header: { background: '#fff', borderBottom: '1px solid #E4E8EF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 52, position: 'sticky', top: 0, zIndex: 10 },
  logo: { fontSize: 17, fontWeight: 700, letterSpacing: '-.4px' },
  backBtn: { fontSize: 13, color: '#6B7280', background: 'none', border: '1px solid #E4E8EF', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' },
  setupBtn: { fontSize: 13, background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 7, padding: '5px 12px', cursor: 'pointer' },
  aiBtn: { padding: '5px 12px', background: '#EBF2FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  avatar: { width: 30, height: 30, borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1, flex: 1, background: '#E4E8EF' },
  dayCol: { background: '#F4F6F9', padding: '10px 8px' },
  dayToday: { background: '#EBF2FF' },
  dayHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  todayBadge: { fontSize: 10, background: '#3B7DD8', color: '#fff', padding: '2px 5px', borderRadius: 4, fontWeight: 600 },
  mealCard: { background: '#fff', border: '1px solid #E4E8EF', borderRadius: 7, padding: '7px 9px', position: 'relative' },
  aiBadge: { position: 'absolute', bottom: 4, left: 6, fontSize: 10 },
  delBtn: { position: 'absolute', top: 3, right: 5, background: 'none', border: 'none', color: '#D1D5DB', cursor: 'pointer', fontSize: 15 },
  addBtn: { width: '100%', padding: '5px 0', background: 'transparent', border: '1px dashed #D1D5DB', borderRadius: 7, color: '#9CA3AF', fontSize: 12, cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 },
  modal: { background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.2)' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '.4px', marginBottom: 6 },
  input: { width: '100%', padding: '10px 14px', border: '1px solid #E4E8EF', borderRadius: 8, fontSize: 15, background: '#F4F6F9', outline: 'none' },
  btnPrimary: { padding: '9px 20px', background: '#3B7DD8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  btnGhost: { padding: '9px 16px', background: 'transparent', border: '1px solid #E4E8EF', borderRadius: 8, fontSize: 14, color: '#6B7280', cursor: 'pointer' },
}
