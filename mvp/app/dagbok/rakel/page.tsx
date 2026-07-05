'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { calculateNutrition, type NutritionResult, type DailyGoals } from '@/lib/actions/nutrition'

// ── Types ──────────────────────────────────────────────────────────────────
interface FieldEditor { name: string; at: string }

interface Meal {
  id: string
  description: string
  logged_by: string       // display_name
  logged_at: string       // ISO
  nutrition: NutritionResult | null
}

interface MedTaken {
  taken: boolean
  logged_by: string
  logged_at: string
}

interface MedSetup {
  id: string
  name: string
  dosage: string | null
  unit: string | null
  notes: string | null
  active: boolean
}

interface Entry {
  entry_date:       string
  day_score:        number | null
  mood_tags:        string[]
  positive:         string
  negative:         string
  school_note:      string
  has_episode:      boolean
  abc_trigger:      string
  abc_behavior:     string
  abc_helped:       string
  // Sleep (structured)
  bedtime:          string    // "HH:MM"
  waketime:         string
  risetime:         string
  sleep_note:       string    // optional free text
  // Other observations
  social_note:      string
  sensory_note:     string
  transition_note:  string
  notes:            string
  // New JSONB fields
  meals:            Meal[]
  medications_taken: Record<string, MedTaken>   // med_id → taken info
  field_editors:    Record<string, FieldEditor>  // field_name → last editor
  last_edited_by:   string | null
}

function emptyEntry(date: string): Entry {
  return {
    entry_date: date, day_score: null, mood_tags: [], positive: '', negative: '',
    school_note: '', has_episode: false, abc_trigger: '', abc_behavior: '',
    abc_helped: '', bedtime: '', waketime: '', risetime: '', sleep_note: '',
    social_note: '', sensory_note: '', transition_note: '', notes: '',
    meals: [], medications_taken: {}, field_editors: {}, last_edited_by: null,
  }
}

// ── Constants ──────────────────────────────────────────────────────────────
const DAYS  = ['Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Lørdag','Søndag']
const SHORT = ['Man','Tir','Ons','Tor','Fre','Lør','Søn']

const MOOD_TAGS = [
  { id: 'glad',       label: '😊 Glad',      color: '#16A34A' },
  { id: 'rolig',      label: '😌 Rolig',      color: '#0284C7' },
  { id: 'engstelig',  label: '😰 Engstelig',  color: '#D97706' },
  { id: 'trist',      label: '😢 Trist',      color: '#6366F1' },
  { id: 'sint',       label: '😠 Sint',        color: '#DC2626' },
  { id: 'urolig',     label: '😤 Urolig',      color: '#EA580C' },
  { id: 'sliten',     label: '😴 Sliten',      color: '#9333EA' },
  { id: 'hyperaktiv', label: '⚡ Hyperaktiv',  color: '#0891B2' },
  { id: 'fokusert',   label: '🎯 Fokusert',    color: '#059669' },
  { id: 'sosiabel',   label: '🤝 Sosiabel',    color: '#10B981' },
]

const SCORE_LABELS = ['Veldig vanskelig dag','Utfordrende','Middels','God dag','Utmerket dag']
const SCORE_COLORS = ['#DC2626','#EA580C','#D97706','#16A34A','#059669']

// ── Week helpers ────────────────────────────────────────────────────────────
function getMonday(off = 0): Date {
  const d = new Date(); const dow = d.getDay()
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow) + off * 7)
  d.setHours(0, 0, 0, 0); return d
}
function dayDate(off: number, idx: number): Date {
  const m = getMonday(off); m.setDate(m.getDate() + idx); return m
}
function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  return Math.ceil(((t.getTime() - new Date(Date.UTC(t.getUTCFullYear(), 0, 1)).getTime()) / 86400000 + 1) / 7)
}
function todayIdx(): number { const d = new Date().getDay(); return d === 0 ? 6 : d - 1 }
function fmtTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
}

// ── Main component ──────────────────────────────────────────────────────────
export default function RakelDagbokPage() {
  const router    = useRouter()
  const sb        = createClient()
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const dirtyFields = useRef<Set<string>>(new Set())

  const [weekOff,    setWeekOff]    = useState(0)
  const [activeDay,  setActiveDay]  = useState(todayIdx)
  const [entries,    setEntries]    = useState<Map<string, Entry>>(new Map())
  const [userId,     setUserId]     = useState<string | null>(null)
  const [groupId,    setGroupId]    = useState<string | null>(null)
  const [isAdmin,    setIsAdmin]    = useState(false)
  const [editorName, setEditorName] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [saveTime,   setSaveTime]   = useState<string | null>(null)
  const [saveErr,    setSaveErr]    = useState(false)
  const [profiles,   setProfiles]   = useState<Record<string, string>>({})
  const [meds,       setMeds]       = useState<MedSetup[]>([])
  const [dailyGoals, setDailyGoals] = useState<DailyGoals | null>(null)

  // Meal entry state
  const [mealInput,     setMealInput]     = useState('')
  const [mealCalcId,    setMealCalcId]    = useState<string | null>(null)  // which meal is being calculated
  const [editNutrId,    setEditNutrId]    = useState<string | null>(null)
  const [editNutr,      setEditNutr]      = useState<Partial<NutritionResult>>({})

  // ── Load week entries ──
  const loadWeek = useCallback(async (gid: string, off: number) => {
    const mon = getMonday(off)
    const sun = new Date(mon); sun.setDate(sun.getDate() + 6)
    const { data } = await sb.from('rakel_dagbok').select('*')
      .eq('group_id', gid)
      .gte('entry_date', dateStr(mon))
      .lte('entry_date', dateStr(sun))
    const map = new Map<string, Entry>()
    ;(data || []).forEach((row: Record<string, unknown>) => {
      const e = row as Entry
      // Ensure JSONB arrays/objects are correctly typed
      if (!Array.isArray(e.meals)) e.meals = []
      if (!e.medications_taken || typeof e.medications_taken !== 'object') e.medications_taken = {}
      if (!e.field_editors || typeof e.field_editors !== 'object') e.field_editors = {}
      e.bedtime  = (e.bedtime  as string) ?? ''
      e.waketime = (e.waketime as string) ?? ''
      e.risetime = (e.risetime as string) ?? ''
      map.set(e.entry_date, e)
    })
    setEntries(map)
  }, [sb])

  // ── Init ──
  useEffect(() => {
    async function init() {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/sign-in'); return }
      setUserId(user.id)

      const { data: gm } = await sb.from('group_members')
        .select('group_id, role, profiles!inner(id, display_name)')
        .eq('profile_id', user.id).limit(1).single()

      if (!gm) return
      const g = gm as { group_id: string; role: string }
      setGroupId(g.group_id)
      setIsAdmin(['owner', 'admin', 'parent'].includes(g.role))

      // Profiles map for "redigert av"
      const { data: members } = await sb.from('group_members')
        .select('profile_id, profiles!inner(id, display_name)')
        .eq('group_id', g.group_id)
      const map: Record<string, string> = {}
      ;(members || []).forEach((m: { profile_id: string; profiles: { display_name: string } }) => {
        map[m.profile_id] = m.profiles.display_name
      })
      setProfiles(map)

      const { data: prof } = await sb.from('profiles')
        .select('display_name').eq('id', user.id).single()
      if (prof) setEditorName((prof as { display_name: string }).display_name)

      // Load medications + nutrition profile in parallel
      const [{ data: medsData }, { data: profData }] = await Promise.all([
        sb.from('rakel_medication_setup')
          .select('id, name, dosage, unit, notes, active')
          .eq('group_id', g.group_id).eq('active', true).order('sort_order'),
        sb.from('rakel_nutrition_profile')
          .select('daily_goals').eq('group_id', g.group_id).maybeSingle(),
      ])
      setMeds((medsData as MedSetup[]) ?? [])
      if (profData && (profData as { daily_goals: DailyGoals | null }).daily_goals) {
        setDailyGoals((profData as { daily_goals: DailyGoals }).daily_goals)
      }

      loadWeek(g.group_id, 0)
    }
    init()
  }, [sb, router, loadWeek])

  useEffect(() => {
    if (groupId) loadWeek(groupId, weekOff)
  }, [weekOff, groupId, loadWeek])

  const curDate  = dateStr(dayDate(weekOff, activeDay))
  const curEntry: Entry = entries.get(curDate) ?? emptyEntry(curDate)

  // ── Save ──
  function updateEntry(patch: Partial<Entry>, trackFields = true) {
    if (trackFields) {
      Object.keys(patch).forEach(k => {
        if (!['field_editors','last_edited_by','meals','medications_taken'].includes(k)) {
          dirtyFields.current.add(k)
        }
      })
    }
    const updated = { ...curEntry, ...patch }
    setEntries(prev => new Map(prev).set(curDate, updated))
    setSaving(true); setSaveErr(false)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!groupId || !userId) return

      // Build updated field_editors for dirty fields
      const fe = { ...updated.field_editors }
      const now = new Date().toISOString()
      dirtyFields.current.forEach(field => {
        fe[field] = { name: editorName, at: now }
      })
      dirtyFields.current.clear()

      const payload = {
        group_id: groupId,
        entry_date:       updated.entry_date,
        day_score:        updated.day_score ?? null,
        mood_tags:        updated.mood_tags,
        positive:         updated.positive        || null,
        negative:         updated.negative        || null,
        school_note:      updated.school_note     || null,
        has_episode:      updated.has_episode,
        abc_trigger:      updated.abc_trigger     || null,
        abc_behavior:     updated.abc_behavior    || null,
        abc_helped:       updated.abc_helped      || null,
        bedtime:          updated.bedtime         || null,
        waketime:         updated.waketime        || null,
        risetime:         updated.risetime        || null,
        sleep_note:       updated.sleep_note      || null,
        social_note:      updated.social_note     || null,
        sensory_note:     updated.sensory_note    || null,
        transition_note:  updated.transition_note || null,
        notes:            updated.notes           || null,
        meals:            updated.meals,
        medications_taken: updated.medications_taken,
        field_editors:    fe,
        last_edited_by:   userId,
      }
      const { error } = await sb.from('rakel_dagbok').upsert(
        payload, { onConflict: 'group_id,entry_date' }
      )
      if (error) { setSaving(false); setSaveErr(true); return }
      // Update field_editors in state
      setEntries(prev => {
        const m = new Map(prev)
        const e = m.get(curDate)
        if (e) m.set(curDate, { ...e, field_editors: fe })
        return m
      })
      const t = new Date().toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
      setSaving(false); setSaveTime(t)
    }, 700)
  }

  function toggleTag(tag: string) {
    const tags = curEntry.mood_tags.includes(tag)
      ? curEntry.mood_tags.filter(t => t !== tag)
      : [...curEntry.mood_tags, tag]
    updateEntry({ mood_tags: tags })
  }

  // ── Meals ──
  async function addMeal() {
    if (!mealInput.trim() || !editorName) return
    const meal: Meal = {
      id: crypto.randomUUID(),
      description: mealInput.trim(),
      logged_by:   editorName,
      logged_at:   new Date().toISOString(),
      nutrition:   null,
    }
    const updated = [...curEntry.meals, meal]
    setMealInput('')
    updateEntry({ meals: updated }, false)

    // Calculate nutrition in background
    setMealCalcId(meal.id)
    const res = await calculateNutrition(meal.description)
    setMealCalcId(null)
    if (res.ok) {
      const withNutr = updated.map(m => m.id === meal.id ? { ...m, nutrition: res.data } : m)
      updateEntry({ meals: withNutr }, false)
    }
  }

  function deleteMeal(id: string) {
    updateEntry({ meals: curEntry.meals.filter(m => m.id !== id) }, false)
  }

  function startEditNutr(meal: Meal) {
    setEditNutrId(meal.id)
    setEditNutr(meal.nutrition ?? {})
  }
  function cancelEditNutr() { setEditNutrId(null); setEditNutr({}) }
  function saveEditNutr(mealId: string) {
    const withNutr = curEntry.meals.map(m =>
      m.id === mealId ? { ...m, nutrition: editNutr as NutritionResult } : m
    )
    updateEntry({ meals: withNutr }, false)
    setEditNutrId(null)
    setEditNutr({})
  }
  async function recalcMeal(meal: Meal) {
    setMealCalcId(meal.id)
    const res = await calculateNutrition(meal.description)
    setMealCalcId(null)
    if (res.ok) {
      const withNutr = curEntry.meals.map(m => m.id === meal.id ? { ...m, nutrition: res.data } : m)
      updateEntry({ meals: withNutr }, false)
    }
  }

  // ── Medications ──
  function toggleMed(medId: string, currentTaken: boolean) {
    const mt = { ...curEntry.medications_taken }
    if (currentTaken) {
      delete mt[medId]
    } else {
      mt[medId] = { taken: true, logged_by: editorName, logged_at: new Date().toISOString() }
    }
    updateEntry({ medications_taken: mt }, false)
  }

  const mon  = getMonday(weekOff)
  const sun  = new Date(mon); sun.setDate(sun.getDate() + 6)
  const wnum = isoWeek(mon)
  const fmtD = (d: Date) => d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
  const lastEditor = curEntry.last_edited_by ? (profiles[curEntry.last_edited_by] ?? '') : ''

  // Helper: who last edited a specific field
  function fieldEditor(field: string) {
    const e = curEntry.field_editors?.[field]
    if (!e) return null
    return (
      <span style={{ fontSize: 10, color: '#94A3B8', display: 'block', marginTop: 3 }}>
        ✏ {e.name} · {fmtTime(e.at)}
      </span>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex', flexDirection: 'column' }}>

      {/* ── HEADER ── */}
      <header style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button style={s.back} onClick={() => router.push('/dashboard')}>← Hjem</button>
          <span style={s.logo}>📓 Rakels dagbok</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginLeft: 4 }}>Uke {wnum}</span>
          {saving && <span style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginLeft: 6 }}>Lagrer…</span>}
          {!saving && saveErr && <span style={{ fontSize: 12, color: '#FCA5A5', marginLeft: 6 }}>⚠ Lagring feilet</span>}
          {!saving && !saveErr && saveTime && <span style={{ fontSize: 12, color: 'rgba(134,239,172,.9)', marginLeft: 6 }}>✓ Lagret {saveTime}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={{ ...s.navBtn, background: 'rgba(255,255,255,.95)', color: '#1B3A5C', fontWeight: 600 }}
            onClick={() => router.push('/dagbok/rakel/rapport')}>
            📊 Rapport
          </button>
          {isAdmin && (
            <button style={s.navBtn} onClick={() => router.push('/dagbok/rakel/medisin')}>
              ⚙️ Innstillinger
            </button>
          )}
          <button style={s.navBtn} onClick={() => setWeekOff(w => w - 1)}>← Forrige</button>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', minWidth: 130, textAlign: 'center' }}>
            {fmtD(mon)} – {fmtD(sun)}
          </span>
          <button style={s.navBtn} onClick={() => setWeekOff(w => w + 1)}>Neste →</button>
        </div>
      </header>

      {/* ── DAY TABS ── */}
      <div style={s.tabs}>
        {DAYS.map((day, i) => {
          const d   = dayDate(weekOff, i)
          const e   = entries.get(dateStr(d))
          const has = e && (e.day_score || e.positive || e.negative)
          const isToday = dateStr(d) === dateStr(new Date())
          return (
            <button key={i} style={{ ...s.tab, ...(i === activeDay ? s.tabActive : {}) }}
              onClick={() => setActiveDay(i)}>
              {day}
              {isToday && <span style={s.todayBadge}>i dag</span>}
              {has && !isToday && <span style={{ color: '#22C55E', marginLeft: 3, fontSize: 9 }}>●</span>}
            </button>
          )
        })}
      </div>

      {/* ── MAIN ── */}
      <div style={s.main}>

        {/* ── UKEOVERSIKT ── */}
        <div style={s.card}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 10 }}>UKEOVERSIKT</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {DAYS.map((_, i) => {
              const d = dayDate(weekOff, i); const e = entries.get(dateStr(d))
              const sc = e?.day_score ?? null
              const isTd = dateStr(d) === dateStr(new Date()); const isCur = i === activeDay
              return (
                <div key={i} onClick={() => setActiveDay(i)}
                  style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
                    background: isCur ? '#EFF6FF' : isTd ? '#F0FDF4' : 'transparent' }}>
                  <div style={{ fontSize: 11, color: isCur ? '#1B3A5C' : '#64748B', fontWeight: isCur || isTd ? 700 : 400 }}>
                    {SHORT[i]}{isTd && <span style={{ display: 'block', fontSize: 8, color: '#16A34A' }}>i dag</span>}
                  </div>
                  {sc ? (
                    <>
                      <div style={{ fontSize: 18, fontWeight: 700, color: SCORE_COLORS[sc - 1] }}>{sc}</div>
                      <div style={{ fontSize: 9, color: '#94A3B8', lineHeight: 1.2 }}>{SCORE_LABELS[sc-1].split(' ')[0]}</div>
                    </>
                  ) : <div style={{ fontSize: 16, color: '#E2E8F0', marginTop: 4 }}>—</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── DATE + EDITOR ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: '#64748B', fontWeight: 500, textTransform: 'capitalize' }}>
            {dayDate(weekOff, activeDay).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          {lastEditor && (
            <div style={{ fontSize: 11, color: '#94A3B8' }}>
              Sist redigert av <strong style={{ color: '#64748B' }}>{lastEditor}</strong>
            </div>
          )}
        </div>

        {/* ── DAGSCORE ── */}
        <div style={s.sh}>Hvordan var dagen totalt sett?</div>
        <div style={s.card}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {[1,2,3,4,5].map(i => (
              <button key={i} onClick={() => updateEntry({ day_score: i })}
                style={{ flex: 1, padding: '12px 4px', border: `2px solid ${curEntry.day_score === i ? SCORE_COLORS[i-1] : '#E2E8F0'}`,
                  borderRadius: 10, background: curEntry.day_score === i ? SCORE_COLORS[i-1] + '15' : '#F8FAFC',
                  cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: curEntry.day_score === i ? SCORE_COLORS[i-1] : '#94A3B8' }}>{i}</div>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
            <span>1 = Veldig vanskelig</span><span>5 = Utmerket dag</span>
          </div>
          {curEntry.day_score && (
            <div style={{ textAlign: 'center', fontSize: 13, color: SCORE_COLORS[curEntry.day_score - 1], fontWeight: 600, marginTop: 8 }}>
              {SCORE_LABELS[curEntry.day_score - 1]}
            </div>
          )}
        </div>

        {/* ── STEMNING ── */}
        <div style={s.sh}>Stemning og energi</div>
        <div style={s.card}>
          <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>Velg alle som passer.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {MOOD_TAGS.map(tag => {
              const active = curEntry.mood_tags.includes(tag.id)
              return (
                <button key={tag.id} onClick={() => toggleTag(tag.id)}
                  style={{ padding: '6px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                    border: `1.5px solid ${active ? tag.color : '#E2E8F0'}`,
                    background: active ? tag.color + '18' : '#F8FAFC',
                    color: active ? tag.color : '#64748B', fontWeight: active ? 600 : 400 }}>
                  {tag.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── OBSERVASJONER ── */}
        <div style={s.sh}>Observasjoner</div>
        <div style={s.card}>
          <QItem num={1} label="✅ Positive opplevelser" hint="Hva gikk bra? Hva mestret Rakel?">
            <textarea style={{ ...s.input, minHeight: 72, resize: 'vertical' }}
              value={curEntry.positive}
              onChange={e => updateEntry({ positive: e.target.value })}
              placeholder="F.eks: Lekte godt med søster, ro under middag…" />
            {fieldEditor('positive')}
          </QItem>
          <QItem num={2} label="⚠️ Utfordrende opplevelser" hint="Hva var vanskelig? Hva utløste reaksjoner?">
            <textarea style={{ ...s.input, minHeight: 72, resize: 'vertical' }}
              value={curEntry.negative}
              onChange={e => updateEntry({ negative: e.target.value })}
              placeholder="F.eks: Ville ikke skifte klær, reagerte sterkt på lyd…" />
            {fieldEditor('negative')}
          </QItem>
          <QItem num={3} label="🏫 Skole / barnehage / aktivitet" hint="Noe tilbakemelding fra lærere/ansatte?">
            <textarea style={{ ...s.input, minHeight: 56, resize: 'vertical' }}
              value={curEntry.school_note}
              onChange={e => updateEntry({ school_note: e.target.value })}
              placeholder="F.eks: Rolig dag på skolen, klarte gruppearbeid…" />
            {fieldEditor('school_note')}
          </QItem>
        </div>

        {/* ── SØVN (strukturert) ── */}
        <div style={s.sh}>Søvn</div>
        <div style={s.card}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={s.sublabel}>🌙 La seg</label>
              <input type="time" style={s.input} value={curEntry.bedtime}
                onChange={e => updateEntry({ bedtime: e.target.value })} />
              {fieldEditor('bedtime')}
            </div>
            <div>
              <label style={s.sublabel}>👁 Våknet</label>
              <input type="time" style={s.input} value={curEntry.waketime}
                onChange={e => updateEntry({ waketime: e.target.value })} />
              {fieldEditor('waketime')}
            </div>
            <div>
              <label style={s.sublabel}>☀️ Sto opp</label>
              <input type="time" style={s.input} value={curEntry.risetime}
                onChange={e => updateEntry({ risetime: e.target.value })} />
              {fieldEditor('risetime')}
            </div>
          </div>
          <div>
            <label style={s.sublabel}>Notat om søvnkvalitet (valgfritt)</label>
            <input style={s.input} value={curEntry.sleep_note}
              onChange={e => updateEntry({ sleep_note: e.target.value })}
              placeholder="F.eks: Urolig natt, våknet flere ganger, sov godt…" />
            {fieldEditor('sleep_note')}
          </div>
        </div>

        {/* ── MÅLTIDER ── */}
        <div style={s.sh}>Måltider</div>
        <div style={s.card}>
          {/* Existing meals */}
          {curEntry.meals.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {curEntry.meals.map(meal => (
                <div key={meal.id} style={{ borderLeft: '3px solid #E2E8F0', paddingLeft: 12, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: '#1E293B', marginBottom: 3 }}>{meal.description}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8' }}>{meal.logged_by} · {fmtTime(meal.logged_at)}</div>
                    </div>
                    <button onClick={() => deleteMeal(meal.id)}
                      style={{ fontSize: 16, color: '#CBD5E1', background: 'none', border: 'none',
                        cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
                  </div>
                  {editNutrId === meal.id ? (
                    <div style={{ marginTop: 8, background: '#F8FAFC', borderRadius: 8, padding: '10px 12px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 8 }}>Rediger næringsverdier:</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
                        {([
                          { key: 'kcal',          label: 'Kcal',     unit: '' },
                          { key: 'protein',       label: 'Protein',  unit: 'g' },
                          { key: 'carbs',         label: 'Karbo',    unit: 'g' },
                          { key: 'fat',           label: 'Fett',     unit: 'g' },
                          { key: 'sugar',         label: 'Sukker',   unit: 'g' },
                          { key: 'fiber',         label: 'Fiber',    unit: 'g' },
                          { key: 'saturated_fat', label: 'Met.fett', unit: 'g' },
                          { key: 'sodium',        label: 'Salt',     unit: 'mg' },
                        ] as { key: keyof NutritionResult; label: string; unit: string }[]).map(f => (
                          <div key={f.key}>
                            <label style={{ fontSize: 10, color: '#94A3B8', display: 'block', marginBottom: 2 }}>
                              {f.label}{f.unit ? ` (${f.unit})` : ''}
                            </label>
                            <input type="number" min={0}
                              style={{ width: '100%', padding: '4px 6px', border: '1px solid #E2E8F0',
                                borderRadius: 5, fontSize: 13, fontFamily: 'inherit',
                                boxSizing: 'border-box', background: 'white' }}
                              value={(editNutr as Record<string, number>)[f.key] ?? 0}
                              onChange={e => setEditNutr(prev => ({ ...prev, [f.key]: parseInt(e.target.value) || 0 }))} />
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => saveEditNutr(meal.id)}
                          style={{ padding: '5px 14px', background: '#1B3A5C', color: 'white', border: 'none',
                            borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Lagre
                        </button>
                        <button onClick={cancelEditNutr}
                          style={{ padding: '5px 10px', background: '#F1F5F9', color: '#64748B', border: 'none',
                            borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Avbryt
                        </button>
                      </div>
                    </div>
                  ) : mealCalcId === meal.id ? (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#94A3B8' }}>⏳ Beregner næring…</div>
                  ) : meal.nutrition ? (
                    <div style={{ marginTop: 8 }}>
                      {/* Primary row */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 5, alignItems: 'center' }}>
                        {[
                          { label: 'Kcal',    val: meal.nutrition.kcal,          color: '#F59E0B', unit: '' },
                          { label: 'Protein', val: meal.nutrition.protein,        color: '#10B981', unit: 'g' },
                          { label: 'Karbo',   val: meal.nutrition.carbs,          color: '#3B82F6', unit: 'g' },
                          { label: 'Fett',    val: meal.nutrition.fat,            color: '#8B5CF6', unit: 'g' },
                        ].map(n => (
                          <span key={n.label} style={{ fontSize: 11, background: n.color + '15',
                            color: n.color, padding: '2px 8px', borderRadius: 999,
                            border: `1px solid ${n.color}40`, fontWeight: 600 }}>
                            {n.label}: {n.val}{n.unit}
                          </span>
                        ))}
                        <button onClick={() => startEditNutr(meal)} title="Rediger næringsverdier manuelt"
                          style={{ fontSize: 11, color: '#94A3B8', background: 'none',
                            border: '1px solid #E2E8F0', borderRadius: 5, padding: '1px 7px',
                            cursor: 'pointer', lineHeight: 1.6, marginLeft: 2 }}>✏</button>
                        <button onClick={() => recalcMeal(meal)} title="Beregn næring på nytt med AI"
                          style={{ fontSize: 11, color: '#94A3B8', background: 'none',
                            border: '1px solid #E2E8F0', borderRadius: 5, padding: '1px 7px',
                            cursor: 'pointer', lineHeight: 1.6 }}>🔄</button>
                      </div>
                      {/* Secondary row */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {[
                          { label: 'Sukker',      val: meal.nutrition.sugar,         color: '#EC4899', unit: 'g' },
                          { label: 'Fiber',       val: meal.nutrition.fiber,          color: '#84CC16', unit: 'g' },
                          { label: 'Met.fett',    val: meal.nutrition.saturated_fat,  color: '#F97316', unit: 'g' },
                          { label: 'Salt',        val: meal.nutrition.sodium,         color: '#64748B', unit: 'mg' },
                        ].map(n => (
                          <span key={n.label} style={{ fontSize: 10, color: n.color,
                            padding: '1px 7px', borderRadius: 999, background: n.color + '10',
                            border: `1px solid ${n.color}30` }}>
                            {n.label}: {n.val}{n.unit}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#CBD5E1', display: 'flex', gap: 8, alignItems: 'center' }}>
                      Ingen næringsdata
                      <button onClick={() => recalcMeal(meal)}
                        style={{ fontSize: 11, color: '#94A3B8', background: 'none', border: '1px solid #E2E8F0',
                          borderRadius: 5, padding: '1px 7px', cursor: 'pointer' }}>🔄 Beregn</button>
                    </div>
                  )}
                </div>
              ))}

              {/* Daily totals + progress vs goals */}
              {curEntry.meals.some(m => m.nutrition) && (() => {
                const tot = curEntry.meals.reduce((acc, m) => {
                  if (!m.nutrition) return acc
                  return {
                    kcal:          acc.kcal          + m.nutrition.kcal,
                    protein:       acc.protein       + m.nutrition.protein,
                    carbs:         acc.carbs         + m.nutrition.carbs,
                    sugar:         acc.sugar         + m.nutrition.sugar,
                    fiber:         acc.fiber         + m.nutrition.fiber,
                    fat:           acc.fat           + m.nutrition.fat,
                    saturated_fat: acc.saturated_fat + m.nutrition.saturated_fat,
                    sodium:        acc.sodium        + m.nutrition.sodium,
                  }
                }, { kcal:0, protein:0, carbs:0, sugar:0, fiber:0, fat:0, saturated_fat:0, sodium:0 })

                const rows: { key: keyof typeof tot; label: string; color: string; unit: string }[] = [
                  { key: 'kcal',          label: 'Kalorier',     color: '#F59E0B', unit: 'kcal' },
                  { key: 'protein',       label: 'Protein',      color: '#10B981', unit: 'g' },
                  { key: 'carbs',         label: 'Karbohydrat',  color: '#3B82F6', unit: 'g' },
                  { key: 'sugar',         label: 'Sukker',       color: '#EC4899', unit: 'g' },
                  { key: 'fiber',         label: 'Kostfiber',    color: '#84CC16', unit: 'g' },
                  { key: 'fat',           label: 'Fett',         color: '#8B5CF6', unit: 'g' },
                  { key: 'saturated_fat', label: 'Mettet fett',  color: '#F97316', unit: 'g' },
                  { key: 'sodium',        label: 'Natrium',      color: '#64748B', unit: 'mg' },
                ]

                return (
                  <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 14px', marginBottom: 10,
                    border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B',
                      letterSpacing: '.06em', marginBottom: 10 }}>DAGSTOTALT</div>

                    {dailyGoals ? (
                      // Progress bars
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {rows.map(row => {
                          const actual = tot[row.key]
                          const goal   = dailyGoals[row.key]
                          const pct    = goal > 0 ? Math.min((actual / goal) * 100, 120) : 0
                          const over   = goal > 0 && actual > goal * 1.1
                          const low    = goal > 0 && actual < goal * 0.7
                          const barColor = over ? '#DC2626' : low ? '#F59E0B' : row.color
                          return (
                            <div key={row.key}>
                              <div style={{ display: 'flex', justifyContent: 'space-between',
                                fontSize: 11, color: '#64748B', marginBottom: 2 }}>
                                <span style={{ fontWeight: 600 }}>{row.label}</span>
                                <span>
                                  <span style={{ color: barColor, fontWeight: 700 }}>{actual}{row.unit}</span>
                                  <span style={{ color: '#CBD5E1' }}> / {goal}{row.unit}</span>
                                  <span style={{ color: barColor, marginLeft: 4 }}>
                                    ({Math.round((actual / goal) * 100)}%)
                                  </span>
                                  {over && <span style={{ color: '#DC2626', marginLeft: 4 }}>↑ over</span>}
                                </span>
                              </div>
                              <div style={{ height: 6, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: barColor,
                                  borderRadius: 999, transition: 'width .4s' }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      // Plain totals if no goals set
                      <div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                          {rows.slice(0, 4).map(n => (
                            <span key={n.key} style={{ fontSize: 13, color: n.color, fontWeight: 700 }}>
                              {n.label}: {tot[n.key]}{n.unit}
                            </span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {rows.slice(4).map(n => (
                            <span key={n.key} style={{ fontSize: 12, color: n.color }}>
                              {n.label}: {tot[n.key]}{n.unit}
                            </span>
                          ))}
                        </div>
                        <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>
                          💡 Sett opp næringsprofil under ⚙️-innstillinger for å se fremgang mot dagsmål.
                        </p>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {/* Add meal */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...s.input, flex: 1 }}
              value={mealInput}
              onChange={e => setMealInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addMeal()}
              placeholder="F.eks: 2 pølser i lompe med ketchup, glass melk…" />
            <button
              style={{ padding: '9px 14px', background: '#1B3A5C', color: 'white', border: 'none',
                borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              onClick={addMeal}
              disabled={!mealInput.trim()}>
              + Legg til
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 5 }}>
            Næring estimeres av AI basert på norske matvaretabeller. Trykk ✏ for å korrigere, 🔄 for å beregne på nytt.
          </p>
        </div>

        {/* ── MEDISIN ── */}
        {meds.length > 0 && (
          <>
            <div style={s.sh}>Medisin i dag</div>
            <div style={s.card}>
              {meds.map(med => {
                const medState = curEntry.medications_taken[med.id]
                const taken = !!medState?.taken
                return (
                  <div key={med.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => toggleMed(med.id, taken)}
                          style={{ width: 22, height: 22, border: `2px solid ${taken ? '#16A34A' : '#CBD5E1'}`,
                            borderRadius: 6, background: taken ? '#16A34A' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', flexShrink: 0 }}>
                          {taken && <span style={{ color: 'white', fontSize: 12 }}>✓</span>}
                        </button>
                        <div>
                          <span style={{ fontSize: 14, color: '#1E293B', fontWeight: taken ? 600 : 400 }}>
                            💊 {med.name}
                          </span>
                          {med.dosage && (
                            <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 6 }}>
                              {med.dosage} {med.unit}
                            </span>
                          )}
                        </div>
                      </div>
                      {med.notes && <p style={{ fontSize: 11, color: '#94A3B8', margin: '3px 0 0 30px' }}>{med.notes}</p>}
                    </div>
                    {taken && medState && (
                      <span style={{ fontSize: 10, color: '#16A34A' }}>
                        ✏ {medState.logged_by} · {fmtTime(medState.logged_at)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
        {meds.length === 0 && isAdmin && (
          <>
            <div style={s.sh}>Medisin</div>
            <div style={{ ...s.card, textAlign: 'center', padding: '20px 16px' }}>
              <p style={{ color: '#94A3B8', fontSize: 14, margin: '0 0 10px' }}>
                Ingen medisiner konfigurert ennå.
              </p>
              <button style={{ padding: '7px 14px', background: '#1B3A5C', color: 'white', border: 'none',
                borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                onClick={() => router.push('/dagbok/rakel/medisin')}>
                💊 Legg til medisiner
              </button>
            </div>
          </>
        )}

        {/* ── STØTTENDE OBSERVASJONER ── */}
        <div style={s.sh}>Støttende observasjoner</div>
        <div style={s.card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={s.sublabel}>🤝 Sosial kontakt</label>
              <input style={s.input} value={curEntry.social_note}
                onChange={e => updateEntry({ social_note: e.target.value })}
                placeholder="F.eks: Lekte med venner, trakk seg tilbake…" />
              {fieldEditor('social_note')}
            </div>
            <div>
              <label style={s.sublabel}>👂 Sanseobservasjoner</label>
              <input style={s.input} value={curEntry.sensory_note}
                onChange={e => updateEntry({ sensory_note: e.target.value })}
                placeholder="F.eks: Reagerte på lyder, klær…" />
              {fieldEditor('sensory_note')}
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={s.sublabel}>🔄 Overganger</label>
              <input style={s.input} value={curEntry.transition_note}
                onChange={e => updateEntry({ transition_note: e.target.value })}
                placeholder="F.eks: Vanskelig å slutte med iPad, bra overgang til middag…" />
              {fieldEditor('transition_note')}
            </div>
          </div>
        </div>

        {/* ── ABC-EPISODE ── */}
        <div style={s.sh}>
          ABC-analyse
          <span style={{ fontSize: 11, fontWeight: 400, color: '#94A3B8', marginLeft: 8 }}>
            — fyll ut kun hvis det skjedde noe spesifikt
          </span>
        </div>
        <div style={s.card}>
          <div style={{ marginBottom: 14 }}>
            <button onClick={() => updateEntry({ has_episode: !curEntry.has_episode })}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'none',
                border: 'none', fontSize: 14, color: '#1E293B', fontFamily: 'inherit', padding: 0 }}>
              <span style={{ width: 20, height: 20, border: `2px solid ${curEntry.has_episode ? '#1B3A5C' : '#CBD5E1'}`,
                borderRadius: 5, background: curEntry.has_episode ? '#1B3A5C' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {curEntry.has_episode && <span style={{ color: 'white', fontSize: 12 }}>✓</span>}
              </span>
              Det skjedde noe spesifikt i dag jeg vil dokumentere
            </button>
          </div>
          {curEntry.has_episode && (
            <div style={{ borderLeft: '3px solid #1B3A5C', paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { field: 'abc_trigger',  color: '#1B3A5C', label: 'A — Antecedent: Hva skjedde rett før?',           ph: 'Situasjon, sted, hvem var til stede…' },
                { field: 'abc_behavior', color: '#DC2626', label: 'B — Behavior: Hva skjedde? Hvordan reagerte Rakel?', ph: 'Beskriv atferden konkret og nøytralt…' },
                { field: 'abc_helped',   color: '#16A34A', label: 'C — Consequence: Hva hjalp?',                     ph: 'Hva gjorde dere? Hva roet situasjonen?' },
              ].map(({ field, color, label, ph }) => (
                <div key={field}>
                  <label style={{ ...s.sublabel, color, fontWeight: 600 }}>{label}</label>
                  <textarea style={{ ...s.input, minHeight: 64, resize: 'vertical' }}
                    value={(curEntry as Record<string, unknown>)[field] as string}
                    onChange={e => updateEntry({ [field]: e.target.value })}
                    placeholder={ph} />
                  {fieldEditor(field)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── FRITEKST ── */}
        <div style={s.card}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#64748B', marginBottom: 6 }}>📝 Andre notater</div>
          <textarea style={{ ...s.input, minHeight: 64, resize: 'vertical', fontFamily: 'inherit' }}
            value={curEntry.notes}
            onChange={e => updateEntry({ notes: e.target.value })}
            placeholder="Noe annet du vil huske eller formidle videre…" />
          {fieldEditor('notes')}
        </div>

        {/* ── INFO-BOKS ── */}
        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '12px 16px', marginTop: 4 }}>
          <div style={{ fontSize: 12, color: '#1E40AF', lineHeight: 1.6 }}>
            <strong>💡 Tips:</strong> Dagboken lagres automatisk. Klikk ✏ under et felt for å se hvem som sist redigerte det.
            Næring beregnes automatisk av AI når du legger til et måltid.
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────
function QItem({ num, label, hint, children }: {
  num: number; label: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
        <span style={{ background: '#1B3A5C', color: 'white', borderRadius: '50%', width: 20, height: 20,
          fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginTop: 1 }}>{num}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#1E293B' }}>{label}</span>
      </div>
      {hint && <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 6, paddingLeft: 28 }}>{hint}</div>}
      <div>{children}</div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  header:    { background: '#1B3A5C', color: 'white', padding: '0 16px', height: 54,
               display: 'flex', alignItems: 'center', justifyContent: 'space-between',
               position: 'sticky', top: 0, zIndex: 10, gap: 12, flexWrap: 'wrap' },
  logo:      { fontSize: 16, fontWeight: 600 },
  back:      { background: 'rgba(255,255,255,.13)', border: '1px solid rgba(255,255,255,.22)',
               color: 'white', borderRadius: 7, padding: '5px 10px', cursor: 'pointer',
               fontSize: 12, fontFamily: 'inherit' },
  navBtn:    { background: 'rgba(255,255,255,.13)', border: '1px solid rgba(255,255,255,.22)',
               color: 'white', borderRadius: 7, padding: '5px 10px', cursor: 'pointer',
               fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap' },
  tabs:      { background: 'white', borderBottom: '1px solid #E2E8F0', display: 'flex', overflowX: 'auto' },
  tab:       { padding: '10px 12px', fontSize: 13, color: '#64748B', cursor: 'pointer',
               borderBottom: '2px solid transparent', whiteSpace: 'nowrap', background: 'none',
               borderTop: 'none', borderLeft: 'none', borderRight: 'none', fontFamily: 'inherit' },
  tabActive: { color: '#1B3A5C', borderBottom: '2px solid #1B3A5C', fontWeight: 600 },
  todayBadge:{ fontSize: 9, background: '#1B3A5C', color: 'white', padding: '1px 5px',
               borderRadius: 3, fontWeight: 700, marginLeft: 4, verticalAlign: 'middle' },
  main:      { maxWidth: 700, margin: '0 auto', padding: '18px 14px 48px' },
  sh:        { fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase',
               letterSpacing: '.9px', paddingBottom: 7, borderBottom: '1px solid #E2E8F0',
               marginBottom: 12, marginTop: 20 },
  card:      { background: 'white', borderRadius: 10, padding: '16px 18px', marginBottom: 12,
               border: '1px solid #E8EDF2' },
  sublabel:  { display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 },
  input:     { width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8,
               fontSize: 14, color: '#1E293B', background: '#F8FAFC', fontFamily: 'inherit',
               outline: 'none', boxSizing: 'border-box' },
}
