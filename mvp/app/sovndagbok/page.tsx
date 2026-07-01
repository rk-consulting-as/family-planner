'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────────────────
interface Entry {
  entry_date:   string
  functioning:  number | null
  naps:         string
  sleep_aids:   string
  bedtime:      string
  lights_off:   string
  latency:      string
  waking_count: string
  waking_dur:   string
  final_waking: string
  rise:         string
  quality:      number | null
  notes:        string
}

function emptyEntry(date: string): Entry {
  return {
    entry_date: date, functioning: null, naps: '', sleep_aids: '',
    bedtime: '', lights_off: '', latency: '', waking_count: '',
    waking_dur: '', final_waking: '', rise: '', quality: null, notes: '',
  }
}

// ── Constants ──────────────────────────────────────────────────────────────
const DAYS  = ['Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Lørdag','Søndag']
const SHORT = ['Man','Tir','Ons','Tor','Fre','Lør','Søn']

// ── Math helpers ────────────────────────────────────────────────────────────
function t2m(t: string): number | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function m2hm(m: number | null): string {
  if (m === null || isNaN(m) || m < 0) return '–'
  const h = Math.floor(m / 60), min = m % 60
  return h > 0 ? (min > 0 ? `${h}t ${min}m` : `${h}t`) : `${min}m`
}
function calcMetrics(e: Entry | null) {
  if (!e || !e.bedtime || !e.rise) return null
  const bed  = t2m(e.bedtime)!
  const rise = t2m(e.rise)!
  const lat   = Math.max(0, parseInt(e.latency) || 0)
  const wakes = (e.waking_dur || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0)
  const twake = wakes.reduce((a, b) => a + b, 0)
  let tib = rise - bed
  if (tib <= 0) tib += 1440
  const tst = Math.max(0, tib - lat - twake)
  const se  = tib > 0 ? Math.round(tst / tib * 100) : 0
  return { tib, tst, se, lat, twake, riseAdj: bed + tib }
}
function seColor(se: number) { return se >= 85 ? '#16A34A' : se >= 70 ? '#D97706' : '#DC2626' }

// ── Week helpers ────────────────────────────────────────────────────────────
function getMonday(off = 0): Date {
  const d   = new Date()
  const dow = d.getDay()
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow) + off * 7)
  d.setHours(0, 0, 0, 0)
  return d
}
function dayDate(off: number, idx: number): Date {
  const m = getMonday(off)
  m.setDate(m.getDate() + idx)
  return m
}
function dateStr(d: Date): string { return d.toISOString().slice(0, 10) }
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  return Math.ceil(((t.getTime() - new Date(Date.UTC(t.getUTCFullYear(), 0, 1)).getTime()) / 86400000 + 1) / 7)
}
function todayIdx(): number { const d = new Date().getDay(); return d === 0 ? 6 : d - 1 }

// ── Main component ──────────────────────────────────────────────────────────
export default function SovndagbokPage() {
  const router     = useRouter()
  const sb         = createClient()
  const saveTimer  = useRef<ReturnType<typeof setTimeout>>()

  const [weekOff,    setWeekOff]   = useState(0)
  const [activeDay,  setActiveDay] = useState(todayIdx)
  const [entries,    setEntries]   = useState<Map<string, Entry>>(new Map())
  const [userId,     setUserId]    = useState<string | null>(null)
  const [saved,      setSaved]     = useState(false)
  const [saving,     setSaving]    = useState(false)
  const [saveTime,   setSaveTime]  = useState<string | null>(null)

  // ── Load week entries ──
  const loadWeek = useCallback(async (uid: string, off: number) => {
    const mon = getMonday(off)
    const sun = new Date(mon); sun.setDate(sun.getDate() + 6)
    const { data } = await sb.from('sovn_entries').select('*')
      .eq('profile_id', uid)
      .gte('entry_date', dateStr(mon))
      .lte('entry_date', dateStr(sun))
    const map = new Map<string, Entry>()
    ;(data || []).forEach((row: Entry) => map.set(row.entry_date, row))
    setEntries(map)
  }, [sb])

  // ── Init ──
  useEffect(() => {
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/sign-in'); return }
      setUserId(user.id)
      loadWeek(user.id, 0)
    })
  }, [sb, router, loadWeek])

  // Reload when week changes
  useEffect(() => {
    if (userId) loadWeek(userId, weekOff)
  }, [weekOff, userId, loadWeek])

  // ── Current entry ──
  const curDate = dateStr(dayDate(weekOff, activeDay))
  const curEntry: Entry = entries.get(curDate) ?? emptyEntry(curDate)

  // ── Save to Supabase (debounced) ──
  function updateEntry(patch: Partial<Entry>) {
    const updated = { ...curEntry, ...patch }
    setEntries(prev => new Map(prev).set(curDate, updated))
    setSaving(true)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!userId) return
      await sb.from('sovn_entries').upsert(
        { profile_id: userId, ...updated },
        { onConflict: 'profile_id,entry_date' }
      )
      const now = new Date().toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
      setSaving(false)
      setSaved(true)
      setSaveTime(now)
      setTimeout(() => setSaved(false), 3000)
    }, 600)
  }

  const m    = calcMetrics(curEntry)
  const mon  = getMonday(weekOff)
  const sun  = new Date(mon); sun.setDate(sun.getDate() + 6)
  const wnum = isoWeek(mon)
  const fmtD = (d: Date) => d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex', flexDirection: 'column' }}>

      {/* ── HEADER ── */}
      <header style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={s.back} onClick={() => router.push('/dashboard')}>← Hjem</button>
          <span style={s.logo}>🌙 Søvndagbok</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginLeft: 4 }}>Uke {wnum}</span>
          {saving && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginLeft: 6 }}>
              Lagrer…
            </span>
          )}
          {!saving && saveTime && (
            <span style={{ fontSize: 12, color: 'rgba(134,239,172,.9)', marginLeft: 6 }}>
              ✓ Lagret {saveTime}
            </span>
          )}
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
          const d  = dayDate(weekOff, i)
          const e  = entries.get(dateStr(d))
          const has = e && (e.bedtime || e.rise || e.functioning)
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

        {/* Week overview */}
        <div style={s.card}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 10 }}>UKEOVERSIKT</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {DAYS.map((_, i) => {
              const d = dayDate(weekOff, i)
              const e = entries.get(dateStr(d))
              const m = calcMetrics(e ?? null)
              const isTd = dateStr(d) === dateStr(new Date())
              const isCur = i === activeDay
              return (
                <div key={i} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
                  background: isCur ? '#EFF6FF' : isTd ? '#F0FDF4' : 'transparent' }}
                  onClick={() => setActiveDay(i)}>
                  <div style={{ fontSize: 11, color: isCur ? '#1B3A5C' : '#64748B', fontWeight: isCur || isTd ? 700 : 400 }}>
                    {SHORT[i]}{isTd && <span style={{ display: 'block', fontSize: 8, color: '#16A34A' }}>i dag</span>}
                  </div>
                  {m ? (
                    <>
                      <div style={{ fontSize: 15, fontWeight: 700, color: seColor(m.se) }}>{m.se}%</div>
                      <div style={{ height: 3, background: seColor(m.se) + '33', borderRadius: 2, margin: '3px auto', width: '80%', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${m.se}%`, background: seColor(m.se), borderRadius: 2 }} />
                      </div>
                      <div style={{ fontSize: 10, color: '#64748B' }}>{m2hm(m.tst)}</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 16, color: '#E2E8F0', marginTop: 2 }}>—</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── DATE HEADING ── */}
        <div style={{ fontSize: 13, color: '#64748B', fontWeight: 500, marginBottom: 12, textTransform: 'capitalize' }}>
          {dayDate(weekOff, activeDay).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>

        {/* ── SECTION: Before bed ── */}
        <div style={s.sh}>Fylles ut FØR sengetid</div>
        <div style={s.card}>
          <QItem num={1} label="Hvordan har du fungert på dagtid?" hint="1 = veldig bra  ·  5 = veldig dårlig">
            <Scale name="func" value={curEntry.functioning}
              labels={['Veldig bra','Veldig dårlig']}
              onChange={v => updateEntry({ functioning: v })} />
          </QItem>
          <QItem num={2} label="Har du tatt blunder i løpet av dagen?" hint="Notér tidspunktene (f.eks. 16:00–16:30)">
            <input style={s.input} value={curEntry.naps}
              onChange={e => updateEntry({ naps: e.target.value })}
              placeholder="f.eks. 16:00–16:30, 18:15–18:30" />
          </QItem>
          <QItem num={3} label="Har du tatt sovemedisin og/eller alkohol for å sove?" hint="Notér medikament, dose og ev. alkohol">
            <input style={s.input} value={curEntry.sleep_aids}
              onChange={e => updateEntry({ sleep_aids: e.target.value })}
              placeholder="f.eks. 5 mg Imovane, 1 glass rødvin" />
          </QItem>
        </div>

        {/* ── SECTION: Next morning ── */}
        <div style={s.sh}>Fylles ut OM MORGENEN</div>
        <div style={s.card}>
          <QItem num={4} label="Når gikk du til sengs? Når skrudde du av lyset?">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={s.sublabel}>Sengetid</label>
                <input type="time" style={s.input} value={curEntry.bedtime}
                  onChange={e => updateEntry({ bedtime: e.target.value })} /></div>
              <div><label style={s.sublabel}>Lyset av</label>
                <input type="time" style={s.input} value={curEntry.lights_off}
                  onChange={e => updateEntry({ lights_off: e.target.value })} /></div>
            </div>
          </QItem>
          <QItem num={5} label="Hvor lang tid tok det fra lyset var av til du sovnet?" hint="Antall minutter">
            <input type="number" style={s.input} value={curEntry.latency} min={0} max={360}
              onChange={e => updateEntry({ latency: e.target.value })}
              placeholder="f.eks. 45" />
          </QItem>
          <QItem num={6} label="Hvor mange ganger våknet du i løpet av natten?">
            <input type="number" style={s.input} value={curEntry.waking_count} min={0} max={30}
              onChange={e => updateEntry({ waking_count: e.target.value })}
              placeholder="f.eks. 3" />
          </QItem>
          <QItem num={7} label="Hvor lange var oppvåkningsperiodene?" hint="Minutter per oppvåkning, kommaseparert">
            <input style={s.input} value={curEntry.waking_dur}
              onChange={e => updateEntry({ waking_dur: e.target.value })}
              placeholder="f.eks. 15, 30, 80" />
          </QItem>
          <QItem num={8} label="Når våknet du endelig uten å sove igjen?">
            <input type="time" style={s.input} value={curEntry.final_waking}
              onChange={e => updateEntry({ final_waking: e.target.value })} />
          </QItem>
          <QItem num={9} label="Når stod du opp?">
            <input type="time" style={s.input} value={curEntry.rise}
              onChange={e => updateEntry({ rise: e.target.value })} />
          </QItem>
          <QItem num={10} label="Hvordan var siste natts søvn totalt sett?" hint="1 = veldig lett  ·  5 = veldig dyp">
            <Scale name="qual" value={curEntry.quality}
              labels={['Veldig lett','Veldig dyp']}
              onChange={v => updateEntry({ quality: v })} />
          </QItem>
        </div>

        {/* ── NOTES ── */}
        <div style={s.card}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#64748B', marginBottom: 6 }}>📝 Notater</div>
          <textarea style={{ ...s.input, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
            value={curEntry.notes}
            onChange={e => updateEntry({ notes: e.target.value })}
            placeholder="Drømmer, stress, noe som forstyrret søvnen…" />
        </div>

        {/* ── METRICS ── */}
        <div style={s.metrics}>
          {m ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1B3A5C', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>
                📊 Beregnet søvnstatistikk
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
                {[['Liggetid', m2hm(m.tib), '#1B3A5C'], ['Søvntid', m2hm(m.tst), '#1B3A5C'],
                  ['Søvneffekt.', `${m.se}%`, seColor(m.se)], ['Innsovning', m2hm(m.lat), '#1B3A5C']].map(([lbl, val, clr]) => (
                  <div key={lbl} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 19, fontWeight: 700, color: clr }}>{val}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>{lbl}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748B', marginBottom: 3 }}>
                <span>Søvneffektivitet: <strong style={{ color: seColor(m.se) }}>{m.se}%</strong></span>
                <span style={{ color: '#94A3B8' }}>Mål: ≥ 85 %</span>
              </div>
              <div style={{ height: 7, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(m.se, 100)}%`, background: seColor(m.se), borderRadius: 4, transition: 'width .4s' }} />
              </div>
              {m.se < 85 && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#D97706' }}>
                  💡 <strong>Tips:</strong> Søvneffektivitet under 85 % er vanlig ved søvnproblemer. CBT-i fokuserer på å øke denne ved søvnrestriksjon og stimuluskontroll.
                </div>
              )}
              {m.se >= 85 && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#16A34A' }}>✓ God søvneffektivitet!</div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, color: '#94A3B8' }}>Fyll inn sengetid og oppstigingstid for å se beregninger.</div>
          )}
        </div>

      </div>

      {/* ── SAVED TOAST (mobil) ── */}
      {saved && (
        <div style={{ position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)',
          background: '#1B3A5C', color: 'white', padding: '8px 18px', borderRadius: 20,
          fontSize: 12, fontWeight: 500, zIndex: 99, boxShadow: '0 2px 10px rgba(0,0,0,.25)',
          whiteSpace: 'nowrap' }}>
          ✓ Lagret automatisk kl. {saveTime}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────
function QItem({ num, label, hint, children }: { num: number; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
        <span style={{ background: '#1B3A5C', color: 'white', borderRadius: '50%', width: 20, height: 20,
          fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
          {num}
        </span>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#1E293B' }}>{label}</span>
      </div>
      {hint && <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 7, paddingLeft: 28 }}>{hint}</div>}
      <div style={{ paddingLeft: 0 }}>{children}</div>
    </div>
  )
}

function Scale({ name, value, labels, onChange }: {
  name: string; value: number | null; labels: [string, string]; onChange: (v: number) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 3 }}>
        {[1,2,3,4,5].map(i => (
          <button key={i} onClick={() => onChange(i)}
            style={{ flex: 1, padding: '9px 2px', border: `1.5px solid ${value === i ? '#1B3A5C' : '#E2E8F0'}`,
              borderRadius: 8, background: value === i ? '#EFF6FF' : '#F8FAFC', cursor: 'pointer',
              fontSize: 15, fontWeight: 600, color: value === i ? '#1B3A5C' : '#64748B', fontFamily: 'inherit' }}>
            {i}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8' }}>
        <span>{labels[0]}</span><span>{labels[1]}</span>
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  header:     { background: '#1B3A5C', color: 'white', padding: '0 16px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, gap: 12, flexWrap: 'wrap' },
  logo:       { fontSize: 16, fontWeight: 600 },
  back:       { background: 'rgba(255,255,255,.13)', border: '1px solid rgba(255,255,255,.22)', color: 'white', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' },
  navBtn:     { background: 'rgba(255,255,255,.13)', border: '1px solid rgba(255,255,255,.22)', color: 'white', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap' },
  tabs:       { background: 'white', borderBottom: '1px solid #E2E8F0', display: 'flex', overflowX: 'auto' },
  tab:        { padding: '10px 12px', fontSize: 13, color: '#64748B', cursor: 'pointer', borderBottom: '2px solid transparent', whiteSpace: 'nowrap', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', fontFamily: 'inherit' },
  tabActive:  { color: '#1B3A5C', borderBottom: '2px solid #1B3A5C', fontWeight: 600 },
  todayBadge: { fontSize: 9, background: '#1B3A5C', color: 'white', padding: '1px 5px', borderRadius: 3, fontWeight: 700, marginLeft: 4, verticalAlign: 'middle' },
  main:       { maxWidth: 700, margin: '0 auto', padding: '18px 14px 48px' },
  sh:         { fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.9px', paddingBottom: 7, borderBottom: '1px solid #E2E8F0', marginBottom: 12, marginTop: 20 },
  card:       { background: 'white', borderRadius: 10, padding: '16px 18px', marginBottom: 12, border: '1px solid #E8EDF2' },
  sublabel:   { display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 },
  input:      { width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14, color: '#1E293B', background: '#F8FAFC', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  metrics:    { background: '#F0F7FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '14px 16px', marginTop: 12 },
}
