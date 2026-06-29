'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { createKpClient as createClient } from '@/lib/supabase/kp-client'
import { useRouter, useSearchParams } from 'next/navigation'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

interface Person {
  id: string; name: string; avatar_emoji: string; color_hex: string
  health_goal: string; health_notes: string | null
  likes: string[]; dislikes: string[]; allergies: string[]
  pickiness_level: string; budget_level: string; lunchbox_friendly: boolean
}
interface DayPlan { id: string; week_plan_id: string; day_of_week: number }
interface MealSlot { id: string; day_plan_id: string; meal_type: MealType; title: string | null; ingredients: string[]; ai_generated: boolean }
interface AISuggestion { title: string; description: string; ingredients: string[]; tags: string[]; prep_minutes: number; nutrition_notes: string; why_fits_goal: string }

const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']
const MEALS: { type: MealType; label: string; emoji: string }[] = [
  { type: 'breakfast', label: 'Frokost', emoji: '🌅' },
  { type: 'lunch',     label: 'Lunsj',   emoji: '🥗' },
  { type: 'dinner',    label: 'Middag',  emoji: '🍽️' },
  { type: 'snack',     label: 'Snack',   emoji: '🍎' },
]

const EMOJIS = ['👦','👧','👨','👩','🧑','👴','👵','👶','🧒','🧓','🐻','🐱','🦊','🐼','🦁','🐶','🐸','🦋','🌟','⚡']
const COLORS = ['#3B7DD8','#16A34A','#DC2626','#D97706','#7C3AED','#0891B2','#E11D48','#059669','#6366F1','#CA8A04','#EA580C','#64748B']

const GOAL_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  general:            { label: 'Generelt sunt',        emoji: '🥗', color: '#16A34A' },
  weight_loss:        { label: 'Vektreduksjon',         emoji: '⚖️', color: '#DC2626' },
  weight_gain:        { label: 'Vektøkning',            emoji: '💪', color: '#D97706' },
  anxiety_reduction:  { label: 'Angstreduserende',      emoji: '🧘', color: '#7C3AED' },
  anti_inflammatory:  { label: 'Betennelsesdempende',   emoji: '🫚', color: '#0891B2' },
  gut_health:         { label: 'Tarmhelse',             emoji: '🦠', color: '#65A30D' },
  blood_sugar:        { label: 'Blodsukker',            emoji: '📊', color: '#EA580C' },
  heart_health:       { label: 'Hjertehelse',           emoji: '❤️', color: '#E11D48' },
  energy:             { label: 'Energi',                emoji: '⚡', color: '#CA8A04' },
  muscle_building:    { label: 'Muskelbygging',         emoji: '🏋️', color: '#1D4ED8' },
  adhd_focus:         { label: 'Konsentrasjon',         emoji: '🧠', color: '#7C3AED' },
  sleep:              { label: 'Søvn',                  emoji: '😴', color: '#1D4ED8' },
  immune_support:     { label: 'Immunforsvar',          emoji: '🛡️', color: '#059669' },
  bone_health:        { label: 'Skjeletthelse',         emoji: '🦴', color: '#6B7280' },
  sports_performance: { label: 'Idrettsernæring',       emoji: '🏃', color: '#DC2626' },
}

function getMonday(): string {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  return d.toISOString().slice(0, 10)
}

function KostPlanDashboard() {
  const [persons, setPersons]       = useState<Person[]>([])
  const [activePerson, setActive]   = useState<Person | null>(null)
  const [dayPlans, setDayPlans]     = useState<DayPlan[]>([])
  const [slots, setSlots]           = useState<MealSlot[]>([])
  const [loading, setLoading]       = useState(true)
  const [personOpen, setPersonOpen] = useState(false)

  // Legg til måltid manuelt
  const [adding, setAdding]   = useState<{ dayId: string; type: MealType; dayIdx: number } | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newIngr, setNewIngr]   = useState('')

  // AI-forslag
  const [aiPanel, setAiPanel]       = useState<{ dayId: string; type: MealType; dayIdx: number } | null>(null)
  const [aiSuggestions, setAiSugg]  = useState<AISuggestion[]>([])
  const [aiLoading, setAiLoading]   = useState(false)
  const [aiError, setAiError]       = useState('')

  // Rediger profil-modal
  const [editPersonOpen, setEditPersonOpen] = useState(false)
  const [editForm, setEditForm] = useState<{
    name: string; avatar_emoji: string; color_hex: string; health_goal: string; health_notes: string
    likes: string; dislikes: string; allergies: string
    pickiness_level: string; budget_level: string; lunchbox_friendly: boolean
  } | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError]   = useState('')

  // Rediger måltid inline
  const [editSlot, setEditSlot] = useState<{ id: string; title: string; ingredients: string } | null>(null)

  const router       = useRouter()
  const searchParams = useSearchParams()
  const sb           = createClient()
  const monday       = getMonday()

  const loadWeekPlan = useCallback(async (person: Person) => {
    const { data: { user } } = await sb.auth.getUser()
    let { data: wp } = await sb.from('kp_week_plans')
      .select('id').eq('person_id', person.id).eq('week_start', monday).single()
    if (!wp) {
      const { data } = await sb.from('kp_week_plans')
        .insert({ person_id: person.id, week_start: monday, profile_id: user?.id }).select('id').single()
      wp = data
    }
    if (!wp) return

    let { data: dps } = await sb.from('kp_day_plans').select('*').eq('week_plan_id', wp.id).order('day_of_week')
    if (!dps || dps.length < 7) {
      const existing = (dps || []).map((d: DayPlan) => d.day_of_week)
      const toCreate = [1,2,3,4,5,6,7].filter(d => !existing.includes(d)).map(d => ({ week_plan_id: wp!.id, day_of_week: d }))
      if (toCreate.length) await sb.from('kp_day_plans').insert(toCreate)
      const { data: r } = await sb.from('kp_day_plans').select('*').eq('week_plan_id', wp.id).order('day_of_week')
      dps = r
    }
    setDayPlans(dps || [])

    const ids = (dps || []).map((d: DayPlan) => d.id)
    if (ids.length) {
      const { data: sl } = await sb.from('kp_meal_slots').select('*').in('day_plan_id', ids)
      setSlots(sl || [])
    } else {
      setSlots([])
    }
  }, [monday, sb])

  const init = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { router.push('/sign-in'); return }

    const { data: ps } = await sb.from('kp_persons')
      .select('id,name,avatar_emoji,color_hex,health_goal,health_notes,likes,dislikes,allergies,pickiness_level,budget_level,lunchbox_friendly')
      .order('created_at')
    setPersons(ps || [])

    if (ps && ps.length > 0) {
      const paramId = searchParams.get('person')
      const selected = ps.find((p: Person) => p.id === paramId) || ps[0]
      setActive(selected)
      await loadWeekPlan(selected)
    }
    setLoading(false)
  }, [router, sb, searchParams, loadWeekPlan])

  useEffect(() => { init() }, [init])

  async function switchPerson(p: Person) {
    setActive(p)
    setPersonOpen(false)
    setSlots([])
    setDayPlans([])
    await loadWeekPlan(p)
  }

  // ── Rediger profil ──
  function openPersonEdit() {
    if (!activePerson) return
    setEditForm({
      name: activePerson.name,
      avatar_emoji: activePerson.avatar_emoji,
      color_hex: activePerson.color_hex,
      health_goal: activePerson.health_goal,
      health_notes: activePerson.health_notes || '',
      likes: (activePerson.likes || []).join(', '),
      dislikes: (activePerson.dislikes || []).join(', '),
      allergies: (activePerson.allergies || []).join(', '),
      pickiness_level: activePerson.pickiness_level || 'moderate',
      budget_level: activePerson.budget_level || 'medium',
      lunchbox_friendly: activePerson.lunchbox_friendly || false,
    })
    setPersonOpen(false)
    setEditPersonOpen(true)
    setEditError('')
  }

  async function savePersonEdit() {
    if (!activePerson || !editForm) return
    setEditSaving(true)
    setEditError('')

    const res = await fetch(`/api/kostplan/person/${activePerson.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name.trim(),
        avatar_emoji: editForm.avatar_emoji,
        color_hex: editForm.color_hex,
        health_goal: editForm.health_goal,
        health_notes: editForm.health_notes.trim() || null,
        likes: editForm.likes.split(',').map(s => s.trim()).filter(Boolean),
        dislikes: editForm.dislikes.split(',').map(s => s.trim()).filter(Boolean),
        allergies: editForm.allergies.split(',').map(s => s.trim()).filter(Boolean),
        pickiness_level: editForm.pickiness_level,
        budget_level: editForm.budget_level,
        lunchbox_friendly: editForm.lunchbox_friendly,
      }),
    })

    const json = await res.json()
    if (!res.ok) {
      setEditError(json.error ?? 'Noe gikk galt')
      setEditSaving(false)
      return
    }

    const updated: Person = {
      ...activePerson,
      name: editForm.name.trim(),
      avatar_emoji: editForm.avatar_emoji,
      color_hex: editForm.color_hex,
      health_goal: editForm.health_goal,
      health_notes: editForm.health_notes.trim() || null,
      likes: editForm.likes.split(',').map(s => s.trim()).filter(Boolean),
      dislikes: editForm.dislikes.split(',').map(s => s.trim()).filter(Boolean),
      allergies: editForm.allergies.split(',').map(s => s.trim()).filter(Boolean),
      pickiness_level: editForm.pickiness_level,
      budget_level: editForm.budget_level,
      lunchbox_friendly: editForm.lunchbox_friendly,
    }
    setActive(updated)
    setPersons(prev => prev.map(p => p.id === activePerson.id ? updated : p))
    setEditPersonOpen(false)
    setEditSaving(false)
  }

  // ── Rediger måltid ──
  function startEditSlot(slot: MealSlot) {
    setEditSlot({ id: slot.id, title: slot.title || '', ingredients: (slot.ingredients || []).join(', ') })
  }

  async function saveMealEdit() {
    if (!editSlot) return
    const { data } = await sb.from('kp_meal_slots').update({
      title: editSlot.title.trim(),
      ingredients: editSlot.ingredients.split(',').map(s => s.trim()).filter(Boolean),
    }).eq('id', editSlot.id).select().single()
    if (data) setSlots(prev => prev.map(sl => sl.id === editSlot.id ? data : sl))
    setEditSlot(null)
  }

  // ── Manuelt legg til måltid ──
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

  // ── AI-forslag ──
  async function openAI(dayId: string, type: MealType, dayIdx: number) {
    if (!activePerson) return
    setAiPanel({ dayId, type, dayIdx })
    setAiSugg([])
    setAiError('')
    setAiLoading(true)
    const existingTitles = slots.filter(s => s.title).map(s => s.title as string)
    try {
      const res = await fetch('/api/kostplan/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: activePerson.id, meal_type: type, day_of_week: dayIdx + 1, existing_meals: existingTitles }),
      })
      const data = await res.json()
      if (data.error) setAiError(data.error)
      else setAiSugg(data.suggestions || [])
    } catch {
      setAiError('Noe gikk galt. Prøv igjen.')
    }
    setAiLoading(false)
  }

  async function pickSuggestion(suggestion: AISuggestion) {
    if (!aiPanel) return
    const { data } = await sb.from('kp_meal_slots').insert({
      day_plan_id: aiPanel.dayId, meal_type: aiPanel.type,
      title: suggestion.title, description: suggestion.description,
      ingredients: suggestion.ingredients, tags: suggestion.tags,
      prep_minutes: suggestion.prep_minutes, nutrition_notes: suggestion.nutrition_notes,
      ai_generated: true,
    }).select().single()
    if (data) setSlots(prev => [...prev, data])
    setAiPanel(null); setAiSugg([])
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

  const goal = activePerson ? (GOAL_LABELS[activePerson.health_goal] || GOAL_LABELS.general) : null
  const weekLabel = new Date(monday).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* ── HEADER ── */}
      <header style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={s.backBtn} onClick={() => router.push('/dashboard')}>← Familie</button>
          <div style={s.logo}>Kost<span style={{ color: '#3B7DD8' }}>Plan</span></div>
          <span style={{ color: '#D1D5DB', fontSize: 16 }}>|</span>

          {persons.length === 0 ? (
            <button style={s.addPersonBtn} onClick={() => router.push('/kostplan/person')}>+ Legg til person</button>
          ) : (
            <div style={{ position: 'relative' }}>
              <button style={s.personPill} onClick={() => setPersonOpen(v => !v)}>
                <span style={{ fontSize: 16 }}>{activePerson?.avatar_emoji}</span>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{activePerson?.name}</span>
                {goal && (
                  <span style={{ ...s.goalBadge, color: goal.color, background: goal.color + '18', border: `1px solid ${goal.color}30` }}>
                    {goal.emoji} {goal.label}
                  </span>
                )}
                <span style={{ color: '#9CA3AF', fontSize: 12 }}>▾</span>
              </button>
              {personOpen && (
                <div style={s.personDropdown}>
                  {persons.map(p => {
                    const g = GOAL_LABELS[p.health_goal] || GOAL_LABELS.general
                    return (
                      <button key={p.id} style={{ ...s.personDropItem, ...(p.id === activePerson?.id ? { background: '#EBF2FF' } : {}) }}
                        onClick={() => switchPerson(p)}>
                        <span style={{ fontSize: 18 }}>{p.avatar_emoji}</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: g.color }}>{g.emoji} {g.label}</div>
                        </div>
                      </button>
                    )
                  })}
                  <div style={{ borderTop: '1px solid #E4E8EF', marginTop: 4, paddingTop: 4 }}>
                    <button style={{ ...s.personDropItem, color: '#6B7280', fontSize: 13 }} onClick={openPersonEdit}>
                      ✏️ Rediger {activePerson?.name}
                    </button>
                    <button style={{ ...s.personDropItem, color: '#3B7DD8', fontSize: 13 }} onClick={() => { setPersonOpen(false); router.push('/kostplan/person') }}>
                      + Legg til person
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>Uke fra {weekLabel}</span>
        </div>
      </header>

      {persons.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#6B7280' }}>
          <div style={{ fontSize: 48 }}>🍽️</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>Ingen kostplan ennå</div>
          <div style={{ fontSize: 14 }}>Legg til en person for å starte</div>
          <button style={{ ...s.btn, width: 'auto', padding: '10px 24px', marginTop: 8 }} onClick={() => router.push('/kostplan/person')}>
            + Legg til person
          </button>
        </div>
      ) : (
        /* ── UKEGRID ── */
        <div style={s.grid}>
          {dayPlans.map((day, i) => {
            const daySlots = slots.filter(m => m.day_plan_id === day.id)
            const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
            const isToday = i === todayIdx

            return (
              <div key={day.id} style={{ ...s.dayCol, ...(isToday ? s.dayToday : {}) }}>
                <div style={s.dayHead}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: isToday ? '#1D4ED8' : '#374151' }}>{DAYS[i]}</span>
                  {isToday && <span style={s.todayBadge}>I dag</span>}
                </div>

                {MEALS.map(({ type, label, emoji }) => {
                  const slot = daySlots.find(sl => sl.meal_type === type)
                  const isEditing = editSlot?.id === slot?.id
                  return (
                    <div key={type} style={{ marginBottom: 5 }}>
                      <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 2 }}>{emoji} {label}</div>
                      {slot ? (
                        isEditing ? (
                          /* ── REDIGERING AV MÅLTID ── */
                          <div style={{ ...s.mealCard, padding: 8 }}>
                            <input autoFocus
                              style={{ width: '100%', padding: '4px 6px', border: '1px solid #93C5FD', borderRadius: 5, fontSize: 12, background: '#fff', marginBottom: 4, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                              value={editSlot.title}
                              onChange={e => setEditSlot(prev => prev ? { ...prev, title: e.target.value } : null)}
                              onKeyDown={e => { if (e.key === 'Enter') saveMealEdit(); if (e.key === 'Escape') setEditSlot(null) }}
                              placeholder="Hva skal du spise?"
                            />
                            <input
                              style={{ width: '100%', padding: '4px 6px', border: '1px solid #E4E8EF', borderRadius: 5, fontSize: 11, background: '#fff', marginBottom: 6, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                              value={editSlot.ingredients}
                              onChange={e => setEditSlot(prev => prev ? { ...prev, ingredients: e.target.value } : null)}
                              placeholder="Ingredienser, kommaseparert"
                            />
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button style={{ padding: '3px 9px', background: '#3B7DD8', color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, cursor: 'pointer' }} onClick={saveMealEdit}>Lagre</button>
                              <button style={{ padding: '3px 7px', background: 'transparent', border: '1px solid #E4E8EF', borderRadius: 5, fontSize: 11, color: '#6B7280', cursor: 'pointer' }} onClick={() => setEditSlot(null)}>×</button>
                            </div>
                          </div>
                        ) : (
                          /* ── VISNING AV MÅLTID (klikk for å redigere) ── */
                          <div style={{ ...s.mealCard, cursor: 'pointer' }} onClick={() => startEditSlot(slot)} title="Klikk for å redigere">
                            <div style={{ fontSize: 12, fontWeight: 500, paddingRight: 14, lineHeight: 1.3 }}>{slot.title}</div>
                            {slot.ingredients.length > 0 && (
                              <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>
                                {slot.ingredients.slice(0, 3).join(', ')}{slot.ingredients.length > 3 ? '…' : ''}
                              </div>
                            )}
                            {slot.ai_generated && <span style={{ position: 'absolute', bottom: 3, left: 6, fontSize: 9, color: '#6366F1' }}>✨ AI</span>}
                            <button style={s.delBtn} onClick={e => { e.stopPropagation(); deleteSlot(slot.id) }}>×</button>
                          </div>
                        )
                      ) : (
                        <div style={{ display: 'flex', gap: 3 }}>
                          <button style={s.addBtn} onClick={() => { setAdding({ dayId: day.id, type, dayIdx: i }); setNewTitle(''); setNewIngr('') }}>+</button>
                          {activePerson && (
                            <button style={s.aiSmallBtn} onClick={() => openAI(day.id, type, i)} title="AI-forslag">✨</button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* ── MANUELL LEGG TIL MODAL ── */}
      {adding && (
        <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) setAdding(null) }}>
          <div style={s.modal}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>Legg til måltid</div>
            <Field label="Hva skal du spise?">
              <input style={s.input} autoFocus value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMeal()}
                placeholder="f.eks. Pastasalat med kylling" />
            </Field>
            <Field label="Ingredienser (valgfritt, kommaseparert)">
              <input style={s.input} value={newIngr} onChange={e => setNewIngr(e.target.value)} placeholder="pasta, kylling, paprika" />
            </Field>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button style={s.btnGhost} onClick={() => setAdding(null)}>Avbryt</button>
              <button style={s.btnPrimary} onClick={addMeal}>Lagre</button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI-FORSLAG PANEL ── */}
      {aiPanel && (
        <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) { setAiPanel(null); setAiSugg([]) } }}>
          <div style={{ ...s.modal, maxWidth: 540 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>✨ AI-forslag</div>
              <button style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 18 }} onClick={() => { setAiPanel(null); setAiSugg([]) }}>×</button>
            </div>
            {activePerson && goal && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '8px 12px', background: '#F4F6F9', borderRadius: 8 }}>
                <span style={{ fontSize: 20 }}>{activePerson.avatar_emoji}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{activePerson.name}</div>
                  <div style={{ fontSize: 11, color: goal.color }}>{goal.emoji} {goal.label}</div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 12, color: '#6B7280' }}>
                  {DAYS[aiPanel.dayIdx]} — {MEALS.find(m => m.type === aiPanel.type)?.label}
                </div>
              </div>
            )}
            {aiLoading && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#6B7280' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🤔</div>
                <div style={{ fontSize: 14 }}>Claude lager forslag tilpasset {activePerson?.name}…</div>
              </div>
            )}
            {aiError && (
              <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '10px 14px', borderRadius: 8, fontSize: 14, marginBottom: 12 }}>
                {aiError}
              </div>
            )}
            {aiSuggestions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {aiSuggestions.map((sug, idx) => (
                  <div key={idx} style={s.suggCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{sug.title}</div>
                        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>{sug.description}</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>
                          🥦 {sug.ingredients.slice(0,4).join(', ')}{sug.ingredients.length > 4 ? '…' : ''}
                          {sug.prep_minutes ? ` · ⏱ ${sug.prep_minutes} min` : ''}
                        </div>
                        <div style={{ fontSize: 11, color: '#6366F1', background: '#EEF2FF', padding: '4px 8px', borderRadius: 5, display: 'inline-block' }}>
                          💡 {sug.why_fits_goal}
                        </div>
                      </div>
                      <button style={s.pickBtn} onClick={() => pickSuggestion(sug)}>Velg</button>
                    </div>
                  </div>
                ))}
                <button style={{ ...s.btnGhost, marginTop: 4 }} onClick={() => openAI(aiPanel.dayId, aiPanel.type, aiPanel.dayIdx)}>
                  🔄 Nye forslag
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── REDIGER PROFIL MODAL ── */}
      {editPersonOpen && editForm && (
        <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) setEditPersonOpen(false) }}>
          <div style={{ ...s.modal, maxWidth: 520 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>Rediger profil</div>
              <button style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 20 }} onClick={() => setEditPersonOpen(false)}>×</button>
            </div>

            {/* Avatar + navn + farge */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>Avatar</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxWidth: 168 }}>
                  {EMOJIS.map(em => (
                    <button key={em} style={{ fontSize: 17, padding: 4, borderRadius: 6, border: editForm.avatar_emoji === em ? '2px solid #3B7DD8' : '2px solid transparent', cursor: 'pointer', background: editForm.avatar_emoji === em ? '#EBF2FF' : 'transparent' }}
                      onClick={() => setEditForm(f => f ? { ...f, avatar_emoji: em } : f)}>{em}</button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Navn">
                  <input style={s.input} value={editForm.name}
                    onChange={e => setEditForm(f => f ? { ...f, name: e.target.value } : f)}
                    placeholder="Navn" />
                </Field>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>Farge</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {COLORS.map(c => (
                      <button key={c} style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: editForm.color_hex === c ? '3px solid #111827' : '2px solid transparent', cursor: 'pointer', padding: 0 }}
                        onClick={() => setEditForm(f => f ? { ...f, color_hex: c } : f)} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Helsemål */}
            <Field label="Helsemål">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                {Object.entries(GOAL_LABELS).map(([key, { label, emoji, color }]) => (
                  <button key={key}
                    style={{ padding: '6px 8px', borderRadius: 7, border: editForm.health_goal === key ? `2px solid ${color}` : '1px solid #E4E8EF', background: editForm.health_goal === key ? color + '18' : '#F8F9FA', cursor: 'pointer', fontSize: 11, color: editForm.health_goal === key ? color : '#374151', fontWeight: editForm.health_goal === key ? 600 : 400, textAlign: 'left' }}
                    onClick={() => setEditForm(f => f ? { ...f, health_goal: key } : f)}>
                    {emoji} {label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Helsenotes (valgfritt)">
              <textarea
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #E4E8EF', borderRadius: 8, fontSize: 14, background: '#F4F6F9', color: '#111827', outline: 'none', fontFamily: 'inherit', minHeight: 56, resize: 'vertical', boxSizing: 'border-box' }}
                value={editForm.health_notes}
                onChange={e => setEditForm(f => f ? { ...f, health_notes: e.target.value } : f)}
                placeholder="F.eks. diabetiker, laktoseintoleranse, spiser ikke svin…" />
            </Field>

            <Field label="Liker (kommaseparert)">
              <input style={s.input} value={editForm.likes}
                onChange={e => setEditForm(f => f ? { ...f, likes: e.target.value } : f)}
                placeholder="pizza, pasta, kylling" />
            </Field>

            <Field label="Liker ikke (kommaseparert)">
              <input style={s.input} value={editForm.dislikes}
                onChange={e => setEditForm(f => f ? { ...f, dislikes: e.target.value } : f)}
                placeholder="brokkoli, sennep" />
            </Field>

            <Field label="Allergier (kommaseparert)">
              <input style={s.input} value={editForm.allergies}
                onChange={e => setEditForm(f => f ? { ...f, allergies: e.target.value } : f)}
                placeholder="gluten, nøtter, melk" />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Kresennivå">
                <select
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #E4E8EF', borderRadius: 8, fontSize: 14, background: '#F4F6F9', color: '#111827', fontFamily: 'inherit', cursor: 'pointer' }}
                  value={editForm.pickiness_level}
                  onChange={e => setEditForm(f => f ? { ...f, pickiness_level: e.target.value } : f)}>
                  <option value="flexible">Fleksibel</option>
                  <option value="moderate">Moderat</option>
                  <option value="selective">Kresen</option>
                  <option value="very_picky">Svært kresen</option>
                </select>
              </Field>
              <Field label="Budsjett">
                <select
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #E4E8EF', borderRadius: 8, fontSize: 14, background: '#F4F6F9', color: '#111827', fontFamily: 'inherit', cursor: 'pointer' }}
                  value={editForm.budget_level}
                  onChange={e => setEditForm(f => f ? { ...f, budget_level: e.target.value } : f)}>
                  <option value="low">Lavt</option>
                  <option value="medium">Middels</option>
                  <option value="high">Høyt</option>
                </select>
              </Field>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 12px', background: '#F4F6F9', borderRadius: 8 }}>
              <input type="checkbox" id="lunchbox-edit" checked={editForm.lunchbox_friendly}
                onChange={e => setEditForm(f => f ? { ...f, lunchbox_friendly: e.target.checked } : f)}
                style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="lunchbox-edit" style={{ fontSize: 14, cursor: 'pointer', color: '#111827' }}>
                🧃 Matboks-vennlig (tilpass til skole/jobb)
              </label>
            </div>

            {editError && (
              <div style={{ marginBottom: 12, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#DC2626', fontSize: 13 }}>
                ⚠️ {editError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={s.btnGhost} onClick={() => setEditPersonOpen(false)}>Avbryt</button>
              <button style={{ ...s.btnPrimary, opacity: editSaving ? 0.6 : 1 }} onClick={savePersonEdit} disabled={editSaving}>
                {editSaving ? 'Lagrer…' : 'Lagre endringer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function KostPlanDashboardPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#6B7280', fontSize: 14 }}>
        Laster KostPlan…
      </div>
    }>
      <KostPlanDashboard />
    </Suspense>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '.4px', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  header:          { background: '#fff', borderBottom: '1px solid #E4E8EF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 50, position: 'sticky', top: 0, zIndex: 20, gap: 8 },
  logo:            { fontSize: 15, fontWeight: 700, letterSpacing: '-.4px', whiteSpace: 'nowrap' },
  backBtn:         { fontSize: 12, color: '#6B7280', background: 'none', border: '1px solid #E4E8EF', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' },
  addPersonBtn:    { fontSize: 13, color: '#3B7DD8', background: '#EBF2FF', border: '1px solid #BFDBFE', borderRadius: 7, padding: '5px 12px', cursor: 'pointer' },
  personPill:      { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: '#F4F6F9', border: '1px solid #E4E8EF', borderRadius: 8, cursor: 'pointer' },
  goalBadge:       { fontSize: 11, padding: '2px 7px', borderRadius: 20, fontWeight: 500 },
  personDropdown:  { position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff', border: '1px solid #E4E8EF', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: 200, zIndex: 50, padding: '4px 0' },
  personDropItem:  { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const },
  grid:            { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1, flex: 1, background: '#E4E8EF', minHeight: 'calc(100vh - 50px)' },
  dayCol:          { background: '#F4F6F9', padding: '8px 6px' },
  dayToday:        { background: '#EBF2FF' },
  dayHead:         { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  todayBadge:      { fontSize: 9, background: '#3B7DD8', color: '#fff', padding: '2px 5px', borderRadius: 4, fontWeight: 600 },
  mealCard:        { background: '#fff', border: '1px solid #E4E8EF', borderRadius: 6, padding: '6px 8px', position: 'relative', minHeight: 36 },
  delBtn:          { position: 'absolute', top: 2, right: 4, background: 'none', border: 'none', color: '#D1D5DB', cursor: 'pointer', fontSize: 14, lineHeight: 1 },
  addBtn:          { flex: 1, padding: '4px 0', background: 'transparent', border: '1px dashed #D1D5DB', borderRadius: 6, color: '#9CA3AF', fontSize: 14, cursor: 'pointer' },
  aiSmallBtn:      { width: 28, padding: '4px 0', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 6, fontSize: 12, cursor: 'pointer' },
  overlay:         { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 },
  modal:           { background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,.2)', maxHeight: '90vh', overflowY: 'auto' },
  suggCard:        { background: '#F8F9FF', border: '1px solid #E0E7FF', borderRadius: 10, padding: '12px 14px' },
  pickBtn:         { padding: '7px 14px', background: '#3B7DD8', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', flexShrink: 0 },
  input:           { width: '100%', padding: '10px 14px', border: '1px solid #E4E8EF', borderRadius: 8, fontSize: 15, background: '#F4F6F9', color: '#111827', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  btn:             { padding: '11px 0', background: '#3B7DD8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 500, cursor: 'pointer', width: '100%' },
  btnPrimary:      { padding: '9px 20px', background: '#3B7DD8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  btnGhost:        { padding: '9px 16px', background: 'transparent', border: '1px solid #E4E8EF', borderRadius: 8, fontSize: 14, color: '#6B7280', cursor: 'pointer', width: '100%' },
}
