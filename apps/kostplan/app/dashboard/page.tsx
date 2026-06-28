'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import type { KpWeekPlan, KpDayPlan, KpMealSlot, Profile } from '../../lib/supabase'

const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']
const MEALS = [
  { type: 'breakfast', label: 'Frokost', emoji: '🌅' },
  { type: 'lunch',     label: 'Lunsj',   emoji: '🥗' },
  { type: 'dinner',    label: 'Middag',  emoji: '🍽️' },
  { type: 'snack',     label: 'Snack',   emoji: '🍎' },
] as const

// Get Monday of current week
function getThisMonday(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}

export default function DashboardPage() {
  const [profile, setProfile]       = useState<Profile | null>(null)
  const [weekPlan, setWeekPlan]     = useState<KpWeekPlan | null>(null)
  const [dayPlans, setDayPlans]     = useState<KpDayPlan[]>([])
  const [mealSlots, setMealSlots]   = useState<KpMealSlot[]>([])
  const [loading, setLoading]       = useState(true)
  const [addingMeal, setAddingMeal] = useState<{ dayId: string; mealType: string } | null>(null)
  const [newTitle, setNewTitle]     = useState('')
  const [newIngr, setNewIngr]       = useState('')
  const router = useRouter()
  const sb = createClient()
  const monday = getThisMonday()

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: prof } = await sb.from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)

    // Get or create week plan
    let { data: wp } = await sb.from('kp_week_plans')
      .select('*').eq('profile_id', user.id).eq('week_start', monday).single()

    if (!wp) {
      const { data: created } = await sb.from('kp_week_plans')
        .insert({ profile_id: user.id, week_start: monday }).select().single()
      wp = created
    }
    setWeekPlan(wp)

    if (wp) {
      // Get or create day plans (1-7)
      let { data: dps } = await sb.from('kp_day_plans')
        .select('*').eq('week_plan_id', wp.id).order('day_of_week')

      if (!dps || dps.length < 7) {
        const existingDays = (dps || []).map((d: KpDayPlan) => d.day_of_week)
        const toCreate = [1,2,3,4,5,6,7].filter(d => !existingDays.includes(d))
          .map(d => ({ week_plan_id: wp!.id, day_of_week: d }))
        if (toCreate.length > 0) {
          await sb.from('kp_day_plans').insert(toCreate)
          const { data: refreshed } = await sb.from('kp_day_plans')
            .select('*').eq('week_plan_id', wp.id).order('day_of_week')
          dps = refreshed
        }
      }
      setDayPlans(dps || [])

      const dayIds = (dps || []).map((d: KpDayPlan) => d.id)
      if (dayIds.length > 0) {
        const { data: slots } = await sb.from('kp_meal_slots')
          .select('*').in('day_plan_id', dayIds)
        setMealSlots(slots || [])
      }
    }

    setLoading(false)
  }

  async function addMeal() {
    if (!addingMeal || !newTitle.trim()) return
    const { data } = await sb.from('kp_meal_slots').insert({
      day_plan_id: addingMeal.dayId,
      meal_type: addingMeal.mealType,
      title: newTitle.trim(),
      ingredients: newIngr.split(',').map(s => s.trim()).filter(Boolean),
    }).select().single()
    if (data) setMealSlots(prev => [...prev, data])
    setAddingMeal(null); setNewTitle(''); setNewIngr('')
  }

  async function deleteMeal(id: string) {
    await sb.from('kp_meal_slots').delete().eq('id', id)
    setMealSlots(prev => prev.filter(m => m.id !== id))
  }

  async function logout() {
    await sb.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#6B7280' }}>
      Laster…
    </div>
  )

  const initials = profile?.display_name?.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase() || '?'
  const weekLabel = new Date(monday).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.logo}>Kost<span style={{ color: '#3B7DD8' }}>Plan</span></div>
        <div style={s.headerRight}>
          <span style={s.weekLabel}>Uke fra {weekLabel}</span>
          <button style={s.aiBtn} title="AI-forslag kommer snart">✨ AI-forslag</button>
          <div style={s.avatar} title={`Logg ut ${profile?.display_name || ''}`} onClick={logout}>{initials}</div>
        </div>
      </header>

      {/* Week grid */}
      <div style={s.grid}>
        {dayPlans.map((day, i) => {
          const daySlots = mealSlots.filter(m => m.day_plan_id === day.id)
          const isToday = new Date(monday + 'T00:00:00').getDay() === 0
            ? i === 6
            : new Date().getDay() - 1 === i

          return (
            <div key={day.id} style={{ ...s.dayCol, ...(isToday ? s.dayColToday : {}) }}>
              <div style={s.dayHeader}>
                <span style={s.dayName}>{DAYS[i]}</span>
                {isToday && <span style={s.todayBadge}>I dag</span>}
              </div>

              {MEALS.map(({ type, label, emoji }) => {
                const slot = daySlots.find(sl => sl.meal_type === type)
                return (
                  <div key={type} style={s.mealBlock}>
                    <div style={s.mealLabel}>{emoji} {label}</div>
                    {slot ? (
                      <div style={s.mealCard}>
                        <div style={s.mealTitle}>{slot.title}</div>
                        {slot.ingredients.length > 0 && (
                          <div style={s.mealIngr}>{slot.ingredients.slice(0,3).join(', ')}{slot.ingredients.length > 3 ? '…' : ''}</div>
                        )}
                        <button style={s.deleteBtn} onClick={() => deleteMeal(slot.id)}>×</button>
                      </div>
                    ) : (
                      <button style={s.addMealBtn}
                        onClick={() => { setAddingMeal({ dayId: day.id, mealType: type }); setNewTitle(''); setNewIngr('') }}>
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

      {/* Add meal modal */}
      {addingMeal && (
        <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) setAddingMeal(null) }}>
          <div style={s.modal}>
            <div style={s.modalTitle}>Legg til måltid</div>
            <div style={{ marginBottom: 14 }}>
              <label style={s.label}>Hva skal du spise?</label>
              <input style={s.input} autoFocus value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMeal()}
                placeholder="f.eks. Pastasalat med kylling" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={s.label}>Ingredienser (valgfritt, kommaseparert)</label>
              <input style={s.input} value={newIngr}
                onChange={e => setNewIngr(e.target.value)}
                placeholder="pasta, kylling, paprika" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={s.btnGhost} onClick={() => setAddingMeal(null)}>Avbryt</button>
              <button style={s.btnPrimary} onClick={addMeal}>Lagre</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#F4F6F9' },
  header: {
    background: '#fff', borderBottom: '1px solid #E4E8EF',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px', height: 56, position: 'sticky', top: 0, zIndex: 10,
  },
  logo: { fontSize: 18, fontWeight: 700, letterSpacing: '-.4px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  weekLabel: { fontSize: 13, color: '#6B7280' },
  aiBtn: {
    padding: '6px 14px', background: '#EBF2FF', color: '#1D4ED8',
    border: '1px solid #BFDBFE', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
  },
  avatar: {
    width: 32, height: 32, borderRadius: '50%', background: '#3B7DD8', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: 1,
    padding: '0',
    background: '#E4E8EF',
    minHeight: 'calc(100vh - 56px)',
  },
  dayCol: { background: '#F4F6F9', padding: '12px 10px' },
  dayColToday: { background: '#EBF2FF' },
  dayHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  dayName: { fontSize: 13, fontWeight: 600, color: '#374151' },
  todayBadge: { fontSize: 10, background: '#3B7DD8', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 600 },
  mealBlock: { marginBottom: 8 },
  mealLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: 500, marginBottom: 4 },
  mealCard: {
    background: '#fff', border: '1px solid #E4E8EF', borderRadius: 8,
    padding: '8px 10px', position: 'relative', cursor: 'default',
  },
  mealTitle: { fontSize: 13, fontWeight: 500, color: '#111827', paddingRight: 16 },
  mealIngr: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  deleteBtn: {
    position: 'absolute', top: 4, right: 6, background: 'none', border: 'none',
    color: '#D1D5DB', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2,
  },
  addMealBtn: {
    width: '100%', padding: '6px 0', background: 'transparent',
    border: '1px dashed #D1D5DB', borderRadius: 8, color: '#9CA3AF',
    fontSize: 12, cursor: 'pointer',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16,
  },
  modal: {
    background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 420,
    boxShadow: '0 20px 60px rgba(0,0,0,.2)',
  },
  modalTitle: { fontSize: 18, fontWeight: 700, marginBottom: 20 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 },
  input: { width: '100%', padding: '10px 14px', border: '1px solid #E4E8EF', borderRadius: 8, fontSize: 15, background: '#F4F6F9', outline: 'none' },
  btnPrimary: { padding: '9px 20px', background: '#3B7DD8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  btnGhost: { padding: '9px 16px', background: 'transparent', border: '1px solid #E4E8EF', borderRadius: 8, fontSize: 14, color: '#6B7280', cursor: 'pointer' },
}
