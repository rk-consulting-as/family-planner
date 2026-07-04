'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────────────────
interface Entry {
  entry_date:      string
  day_score:       number | null
  mood_tags:       string[]
  positive:        string
  negative:        string
  school_note:     string
  has_episode:     boolean
  abc_trigger:     string
  abc_behavior:    string
  abc_helped:      string
  sleep_note:      string
  social_note:     string
  sensory_note:    string
  transition_note: string
  notes:           string
  last_edited_by:  string | null
}

function emptyEntry(date: string): Entry {
  return {
    entry_date: date, day_score: null, mood_tags: [], positive: '', negative: '',
    school_note: '', has_episode: false, abc_trigger: '', abc_behavior: '',
    abc_helped: '', sleep_note: '', social_note: '', sensory_note: '',
    transition_note: '', notes: '', last_edited_by: null,
  }
}

// ── Constants ──────────────────────────────────────────────────────────────
const DAYS  = ['Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Lørdag','Søndag']
const SHORT = ['Man','Tir','Ons','Tor','Fre','Lør','Søn']

const MOOD_TAGS = [
  { id: 'glad',       label: '😊 Glad',        color: '#16A34A' },
  { id: 'rolig',      label: '😌 Rolig',        color: '#0284C7' },
  { id: 'engstelig',  label: '😰 Engstelig',    color: '#D97706' },
  { id: 'trist',      label: '😢 Trist',        color: '#6366F1' },
  { id: 'sint',       label: '😠 Sint',          color: '#DC2626' },
  { id: 'urolig',     label: '😤 Urolig',        color: '#EA580C' },
  { id: 'sliten',     label: '😴 Sliten',        color: '#9333EA' },
  { id: 'hyperaktiv', label: '⚡ Hyperaktiv',    color: '#0891B2' },
  { id: 'fokusert',   label: '🎯 Fokusert',      color: '#059669' },
  { id: 'sosiabel',   label: '🤝 Sosiabel',      color: '#10B981' },
]

const SCORE_LABELS = ['Veldig vanskelig dag', 'Utfordrende', 'Middels', 'God dag', 'Utmerket dag']
const SCORE_COLORS = ['#DC2626', '#EA580C', '#D97706', '#16A34A', '#059669']

// ── Week helpers ────────────────────────────────────────────────────────────
function getMonday(off = 0): Date {
  const d   = new Date()
  const dow = d.getDay()
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow) + off * 7)
  d.setHours(0, 0, 0, 0)
  return d
}
function dayDate(off: number, idx: number): Date {
  const m = getMonday(off); m.setDate(m.getDate() + idx); return m
}
function dateStr(d: Date): string { return d.toISOString().slice(0, 10) }
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  return Math.ceil(((t.getTime() - new Date(Date.UTC(t.getUTCFullYear(), 0, 1)).getTime()) / 86400000 + 1) / 7)
}
function todayIdx(): number { const d = new Date().getDay(); return d === 0 ? 6 : d - 1 }

// ── Main component ──────────────────────────────────────────────────────────
export default function RakelDagbokPage() {
  const router    = useRouter()
  const sb        = createClient()
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()

  const [weekOff,   setWeekOff]   = useState(0)
  const [activeDay, setActiveDay] = useState(todayIdx)
  const [entries,   setEntries]   = useState<Map<string, Entry>>(new Map())
  const [userId,    setUserId]    = useState<string | null>(null)
  const [groupId,   setGroupId]   = useState<string | null>(null)
  const [editorName,setEditorName]= useState<string>('')
  const [saving,    setSaving]    = useState(false)
  const [saveTime,  setSaveTime]  = useState<string | null>(null)
  const [saveErr,   setSaveErr]   = useState(false)
  const [profiles,  setProfiles]  = useState<Record<string, string>>({})

  // ── Load week entries ──
  const loadWeek = useCallback(async (gid: string, off: number) => {
    const mon = getMonday(off)
    const sun = new Date(mon); sun.setDate(sun.getDate() + 6)
    const { data } = await sb.from('rakel_dagbok').select('*')
      .eq('group_id', gid)
      .gte('entry_date', dateStr(mon))
      .lte('entry_date', dateStr(sun))
    const map = new Map<string, Entry>()
    ;(data || []).forEach((row: Entry) => map.set(row.entry_date, row))
    setEntries(map)
  }, [sb])

  // ── Init ──
  useEffect(() => {
    async function init() {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/sign-in'); return }
      setUserId(user.id)

      // Hent group_id og profiler for gruppen
      const { data: gm } = await sb.from('group_members')
        .select('group_id, profiles!inner(id, display_name)')
        .eq('profile_id', user.id)
        .limit(1)
        .single()

      if (!gm) return
      const gid = (gm as { group_id: string }).group_id
      setGroupId(gid)

      // Hent alle profilene i gruppen for "sist redigert av"
      const { data: members } = await sb.from('group_members')
        .select('profile_id, profiles!inner(id, display_name)')
        .eq('group_id', gid)
      const map: Record<string, string> = {}
      ;(members || []).forEach((m: { profile_id: string; profiles: { display_name: string } }) => {
        map[m.profile_id] = m.profiles.display_name
      })
      setProfiles(map)

      // Eget navn
      const { data: prof } = await sb.from('profiles')
        .select('display_name').eq('id', user.id).single()
      if (prof) setEditorName((prof as { display_name: string }).display_name)

      loadWeek(gid, 0)
    }
    init()
  }, [sb, router, loadWeek])

  useEffect(() => {
    if (groupId) loadWeek(groupId, weekOff)
  }, [weekOff, groupId, loadWeek])

  // ── Current entry ──
  const curDate  = dateStr(dayDate(weekOff, activeDay))
  const curEntry: Entry = entries.get(curDate) ?? emptyEntry(curDate)

  // ── Save ──
  function updateEntry(patch: Partial<Entry>) {
    const updated = { ...curEntry, ...patch }
    setEntries(prev => new Map(prev).set(curDate, updated))
    setSaving(true)
    setSaveErr(false)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!groupId || !userId) return
      const payload = {
        group_id:        groupId,
        entry_date:      updated.entry_date,
        day_score:       updated.day_score ?? null,
        mood_tags:       updated.mood_tags,
        positive:        updated.positive        || null,
        negative:        updated.negative        || null,
        school_note:     updated.school_note     || null,
        has_episode:     updated.has_episode,
        abc_trigger:     updated.abc_trigger     || null,
        abc_behavior:    updated.abc_behavior    || null,
        abc_helped:      updated.abc_helped      || null,
        sleep_note:      updated.sleep_note      || null,
        social_note:     updated.social_note     || null,
        sensory_note:    updated.sensory_note    || null,
        transition_note: updated.transition_note || null,
        notes:           updated.notes           || null,
        last_edited_by:  userId,
      }
      const { error } = await sb.from('rakel_dagbok').upsert(
        payload, { onConflict: 'group_id,entry_date' }
      )
      if (error) {
        console.error('[rakel-dagbok] save error:', error)
        setSaving(false); setSaveErr(true); return
      }
      const now = new Date().toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
      setSaving(false); setSaveTime(now)
    }, 700)
  }

  function toggleTag(tag: string) {
    const tags = curEntry.mood_tags.includes(tag)
      ? curEntry.mood_tags.filter(t => t !== tag)
      : [...curEntry.mood_tags, tag]
    updateEntry({ mood_tags: tags })
  }

  const mon  = getMonday(weekOff)
  const sun  = new Date(mon); sun.setDate(sun.getDate() + 6)
  const wnum = isoWeek(mon)
  const fmtD = (d: Date) => d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
  const lastEditor = curEntry.last_edited_by ? (profiles[curEntry.last_edited_by] ?? '') : ''

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
              const d    = dayDate(weekOff, i)
              const e    = entries.get(dateStr(d))
              const sc   = e?.day_score ?? null
              const isTd = dateStr(d) === dateStr(new Date())
              const isCur = i === activeDay
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
                      <div style={{ fontSize: 9, color: '#94A3B8', lineHeight: 1.2 }}>
                        {SCORE_LABELS[sc - 1].split(' ')[0]}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 16, color: '#E2E8F0', marginTop: 4 }}>—</div>
                  )}
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
          {curEntry.day_score && (
            <div style={{ textAlign: 'center', fontSize: 13, color: SCORE_COLORS[curEntry.day_score - 1], fontWeight: 500 }}>
              {SCORE_LABELS[curEntry.day_score - 1]}
            </div>
          )}
        </div>

        {/* ── STEMNING ── */}
        <div style={s.sh}>Stemning og energi</div>
        <div style={s.card}>
          <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>Velg alle som passer — man kan ha flere stemninger på én dag.</div>
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
          <QItem num={1} label="✅ Positive opplevelser" hint="Hva gikk bra? Hva mestret Rakel? Hva ga glede?">
            <textarea style={{ ...s.input, minHeight: 72, resize: 'vertical' }}
              value={curEntry.positive}
              onChange={e => updateEntry({ positive: e.target.value })}
              placeholder="F.eks: Lekte godt med søster, ro under middag, sa fra verbalt i stedet for å reagere…" />
          </QItem>
          <QItem num={2} label="⚠️ Utfordrende opplevelser" hint="Hva var vanskelig? Hva utløste reaksjoner?">
            <textarea style={{ ...s.input, minHeight: 72, resize: 'vertical' }}
              value={curEntry.negative}
              onChange={e => updateEntry({ negative: e.target.value })}
              placeholder="F.eks: Ville ikke skifte klær, reagerte sterkt på lyd, nektet å avslutte…" />
          </QItem>
          <QItem num={3} label="🏫 Skole / barnehage / aktivitet" hint="Hvordan gikk det? Noe tilbakemelding fra lærere/ansatte?">
            <textarea style={{ ...s.input, minHeight: 56, resize: 'vertical' }}
              value={curEntry.school_note}
              onChange={e => updateEntry({ school_note: e.target.value })}
              placeholder="F.eks: Rolig dag på skolen, klarte gruppearbeid, hadde konflikter i friminuttet…" />
          </QItem>
        </div>

        {/* ── STØTTENDE OBSERVASJONER ── */}
        <div style={s.sh}>Støttende observasjoner</div>
        <div style={s.card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={s.sublabel}>😴 Søvn sist natt</label>
              <input style={s.input} value={curEntry.sleep_note}
                onChange={e => updateEntry({ sleep_note: e.target.value })}
                placeholder="F.eks: Sov dårlig, våknet mye…" />
            </div>
            <div>
              <label style={s.sublabel}>🤝 Sosial kontakt</label>
              <input style={s.input} value={curEntry.social_note}
                onChange={e => updateEntry({ social_note: e.target.value })}
                placeholder="F.eks: Lekte med venner, trakk seg tilbake…" />
            </div>
            <div>
              <label style={s.sublabel}>👂 Sanseobservasjoner</label>
              <input style={s.input} value={curEntry.sensory_note}
                onChange={e => updateEntry({ sensory_note: e.target.value })}
                placeholder="F.eks: Reagerte på lyder, ville ikke ha på seg klær…" />
            </div>
            <div>
              <label style={s.sublabel}>🔄 Overganger</label>
              <input style={s.input} value={curEntry.transition_note}
                onChange={e => updateEntry({ transition_note: e.target.value })}
                placeholder="F.eks: Vanskelig å slutte med iPad, bra overgang til middag…" />
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
              <div>
                <label style={{ ...s.sublabel, color: '#1B3A5C', fontWeight: 600 }}>
                  A — Antecedent: Hva skjedde rett før?
                </label>
                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 5 }}>
                  Situasjon, sted, tid, hvem var til stede, hva ble sagt/gjort
                </div>
                <textarea style={{ ...s.input, minHeight: 64, resize: 'vertical' }}
                  value={curEntry.abc_trigger}
                  onChange={e => updateEntry({ abc_trigger: e.target.value })}
                  placeholder="F.eks: Vi var på butikken, det var mye folk og lyd. Ble bedt om å vente…" />
              </div>
              <div>
                <label style={{ ...s.sublabel, color: '#DC2626', fontWeight: 600 }}>
                  B — Behavior: Hva skjedde? Hvordan reagerte Rakel?
                </label>
                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 5 }}>
                  Beskriv atferden konkret og nøytralt — hva gjorde og sa hun?
                </div>
                <textarea style={{ ...s.input, minHeight: 64, resize: 'vertical' }}
                  value={curEntry.abc_behavior}
                  onChange={e => updateEntry({ abc_behavior: e.target.value })}
                  placeholder="F.eks: Begynte å gråte, la seg på gulvet, skrek i ca. 10 minutter, ville ikke reise seg…" />
              </div>
              <div>
                <label style={{ ...s.sublabel, color: '#16A34A', fontWeight: 600 }}>
                  C — Consequence: Hva hjalp? Hva ble konsekvensen?
                </label>
                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 5 }}>
                  Hva gjorde dere? Hva roet situasjonen? Varighet?
                </div>
                <textarea style={{ ...s.input, minHeight: 64, resize: 'vertical' }}
                  value={curEntry.abc_helped}
                  onChange={e => updateEntry({ abc_helped: e.target.value })}
                  placeholder="F.eks: Gikk ut, ga tid og ro. Etter 5 minutter klarte hun å gå inn igjen…" />
              </div>
            </div>
          )}
        </div>

        {/* ── FRITEKST ── */}
        <div style={s.card}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#64748B', marginBottom: 6 }}>
            📝 Andre notater
          </div>
          <textarea style={{ ...s.input, minHeight: 64, resize: 'vertical', fontFamily: 'inherit' }}
            value={curEntry.notes}
            onChange={e => updateEntry({ notes: e.target.value })}
            placeholder="Noe annet du vil huske eller formidle videre…" />
        </div>

        {/* ── INFO-BOKS ── */}
        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '12px 16px', marginTop: 4 }}>
          <div style={{ fontSize: 12, color: '#1E40AF', lineHeight: 1.6 }}>
            <strong>💡 Tips:</strong> Dagboken lagres automatisk. Både du og Hilde kan skrive på samme dag.
            ABC-modellen er spesielt nyttig å ta med til møter med HABU, ABUP og PPT — den viser konkrete
            mønstre i hva som utløser reaksjoner og hva som hjelper.
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
