'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────────────────
interface Entry {
  entry_date:      string
  day_score:       number | null
  mood_tags:       string[]
  positive:        string | null
  negative:        string | null
  school_note:     string | null
  has_episode:     boolean
  abc_trigger:     string | null
  abc_behavior:    string | null
  abc_helped:      string | null
  sleep_note:      string | null
  social_note:     string | null
  sensory_note:    string | null
  transition_note: string | null
  notes:           string | null
  last_edited_by:  string | null
}

// ── Constants ──────────────────────────────────────────────────────────────
const SCORE_LABELS = ['Veldig vanskelig', 'Utfordrende', 'Middels', 'God dag', 'Utmerket']
const SCORE_COLORS = ['#DC2626', '#EA580C', '#D97706', '#16A34A', '#059669']
const SCORE_BG     = ['#FEE2E2', '#FFEDD5', '#FEF3C7', '#DCFCE7', '#D1FAE5']

const ALL_TAGS = [
  { id: 'glad',       label: 'Glad',       emoji: '😊' },
  { id: 'rolig',      label: 'Rolig',       emoji: '😌' },
  { id: 'engstelig',  label: 'Engstelig',   emoji: '😰' },
  { id: 'trist',      label: 'Trist',       emoji: '😢' },
  { id: 'sint',       label: 'Sint',         emoji: '😠' },
  { id: 'urolig',     label: 'Urolig',       emoji: '😤' },
  { id: 'sliten',     label: 'Sliten',       emoji: '😴' },
  { id: 'hyperaktiv', label: 'Hyperaktiv',   emoji: '⚡' },
  { id: 'fokusert',   label: 'Fokusert',     emoji: '🎯' },
  { id: 'sosiabel',   label: 'Sosiabel',     emoji: '🤝' },
]

const RANGES = [
  { label: 'Siste 7 dager',  days: 7  },
  { label: 'Siste 14 dager', days: 14 },
  { label: 'Siste 30 dager', days: 30 },
  { label: 'Alt',            days: 365 },
]

function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtDate(s: string): string {
  const d = new Date(s + 'T12:00:00')
  return d.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })
}

function fmtLong(s: string): string {
  const d = new Date(s + 'T12:00:00')
  return d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function RapportPage() {
  const router = useRouter()
  const sb     = createClient()

  const [entries,   setEntries]   = useState<Entry[]>([])
  const [profiles,  setProfiles]  = useState<Record<string, string>>({})
  const [rangeIdx,  setRangeIdx]  = useState(1)   // default: 14 dager
  const [groupId,   setGroupId]   = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [childName, setChildName] = useState('Rakel')

  // ── Load ──
  useEffect(() => {
    async function init() {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/sign-in'); return }

      const { data: gm } = await sb.from('group_members')
        .select('group_id, groups!inner(name)')
        .eq('profile_id', user.id)
        .limit(1)
        .single()

      if (!gm) return
      const gid = (gm as { group_id: string }).group_id
      setGroupId(gid)

      const { data: members } = await sb.from('group_members')
        .select('profile_id, profiles!inner(display_name)')
        .eq('group_id', gid)
      const map: Record<string, string> = {}
      ;(members || []).forEach((m: { profile_id: string; profiles: { display_name: string } }) => {
        map[m.profile_id] = m.profiles.display_name
      })
      setProfiles(map)
    }
    init()
  }, [sb, router])

  useEffect(() => {
    if (!groupId) return
    loadEntries(groupId, rangeIdx)
  }, [groupId, rangeIdx])

  async function loadEntries(gid: string, rIdx: number) {
    setLoading(true)
    const days = RANGES[rIdx].days
    const from = new Date()
    from.setDate(from.getDate() - days + 1)
    from.setHours(0, 0, 0, 0)
    const { data } = await sb.from('rakel_dagbok')
      .select('*')
      .eq('group_id', gid)
      .gte('entry_date', localDateStr(from))
      .order('entry_date', { ascending: true })
    setEntries((data || []) as Entry[])
    setLoading(false)
  }

  // ── Computed stats ──
  const scored  = entries.filter(e => e.day_score !== null)
  const avgScore = scored.length
    ? (scored.reduce((s, e) => s + (e.day_score ?? 0), 0) / scored.length)
    : null

  const episodes = entries.filter(e => e.has_episode)

  const tagCounts: Record<string, number> = {}
  entries.forEach(e => (e.mood_tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] ?? 0) + 1 }))
  const topTags = ALL_TAGS
    .map(t => ({ ...t, count: tagCounts[t.id] ?? 0 }))
    .filter(t => t.count > 0)
    .sort((a, b) => b.count - a.count)
  const maxTagCount = Math.max(...topTags.map(t => t.count), 1)

  const goodDays  = scored.filter(e => (e.day_score ?? 0) >= 4).length
  const hardDays  = scored.filter(e => (e.day_score ?? 0) <= 2).length

  const today     = localDateStr(new Date())
  const fromRange = RANGES[rangeIdx]

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9' }}>

      {/* ── HEADER (skjules ved print) ── */}
      <header style={s.header} className="no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={s.back} onClick={() => router.push('/dagbok/rakel')}>← Dagbok</button>
          <span style={s.logo}>📊 Rapport — {childName}s dagbok</span>
        </div>
        <button style={s.printBtn} onClick={() => window.print()}>
          🖨️ Skriv ut / PDF
        </button>
      </header>

      {/* ── PERIODEVALG (skjules ved print) ── */}
      <div style={{ background: 'white', borderBottom: '1px solid #E2E8F0', padding: '10px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }} className="no-print">
        {RANGES.map((r, i) => (
          <button key={i} onClick={() => setRangeIdx(i)}
            style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
              fontFamily: 'inherit', border: `1.5px solid ${i === rangeIdx ? '#1B3A5C' : '#E2E8F0'}`,
              background: i === rangeIdx ? '#1B3A5C' : 'white',
              color: i === rangeIdx ? 'white' : '#64748B', fontWeight: i === rangeIdx ? 600 : 400 }}>
            {r.label}
          </button>
        ))}
      </div>

      <div style={s.main}>

        {/* ── RAPPORT-TITTEL (synlig ved print) ── */}
        <div style={{ marginBottom: 20 }} className="print-only" >
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1B3A5C', margin: 0 }}>
            Dagbokrapport — {childName}
          </h1>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
            Periode: {fromRange.label} · Generert {fmtLong(today)}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: '#94A3B8', borderTop: '1px solid #E2E8F0', paddingTop: 8 }}>
            Denne rapporten er utarbeidet av foresatte og er ment som dokumentasjonsgrunnlag
            for oppfølging hos HABU, ABUP og/eller PPT.
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>Laster data…</div>
        ) : entries.length < 3 ? (
          <div style={{ ...s.card, textAlign: 'center', padding: 40, color: '#64748B' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📓</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Ikke nok data ennå</div>
            <div style={{ fontSize: 13, color: '#94A3B8' }}>
              Det trengs minst 3 oppføringer for å lage en rapport.
              Fortsett å logge i dagboken!
            </div>
          </div>
        ) : (
          <>
            {/* ── NØKKELTALL ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 12 }}>
              <StatBox
                value={`${entries.length} dager`}
                label="Dager logget"
                color="#1B3A5C"
                bg="#EFF6FF"
              />
              <StatBox
                value={avgScore !== null ? avgScore.toFixed(1) + ' / 5' : '—'}
                label="Gjennomsnittsdag"
                color={avgScore !== null ? SCORE_COLORS[Math.round(avgScore) - 1] : '#94A3B8'}
                bg={avgScore !== null ? SCORE_BG[Math.round(avgScore) - 1] : '#F8FAFC'}
              />
              <StatBox
                value={`${goodDays} dager`}
                label="Gode dager (4–5)"
                color="#16A34A"
                bg="#DCFCE7"
              />
              <StatBox
                value={`${hardDays} dager`}
                label="Vanskelige dager (1–2)"
                color="#DC2626"
                bg="#FEE2E2"
              />
            </div>

            {/* ── DAGSCORE TREND ── */}
            <SectionTitle>Dagscore per dag</SectionTitle>
            <div style={s.card}>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 12 }}>
                1 = Veldig vanskelig  ·  5 = Utmerket dag
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {entries.map(e => (
                  <div key={e.entry_date} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 80, fontSize: 11, color: '#64748B', flexShrink: 0, textAlign: 'right' }}>
                      {fmtDate(e.entry_date)}
                    </div>
                    {e.day_score ? (
                      <>
                        <div style={{ flex: 1, height: 22, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            width: `${(e.day_score / 5) * 100}%`, height: '100%',
                            background: SCORE_COLORS[e.day_score - 1],
                            borderRadius: 4, transition: 'width .3s',
                            display: 'flex', alignItems: 'center', paddingLeft: 8,
                          }}>
                            <span style={{ fontSize: 11, color: 'white', fontWeight: 700 }}>
                              {e.day_score} — {SCORE_LABELS[e.day_score - 1]}
                            </span>
                          </div>
                        </div>
                        {(e.mood_tags || []).length > 0 && (
                          <div style={{ fontSize: 13, flexShrink: 0 }}>
                            {(e.mood_tags || []).map(t => ALL_TAGS.find(x => x.id === t)?.emoji ?? '').join('')}
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ flex: 1, fontSize: 12, color: '#CBD5E1' }}>Ikke utfylt</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── STEMNINGSFREKVENS ── */}
            {topTags.length > 0 && (
              <>
                <SectionTitle>Stemning og energi — hyppighet</SectionTitle>
                <div style={s.card}>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 12 }}>
                    Antall dager med registrert stemning
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {topTags.map(tag => (
                      <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 90, fontSize: 12, color: '#475569', flexShrink: 0 }}>
                          {tag.emoji} {tag.label}
                        </div>
                        <div style={{ flex: 1, height: 20, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            width: `${(tag.count / maxTagCount) * 100}%`, height: '100%',
                            background: '#1B3A5C', borderRadius: 4,
                            display: 'flex', alignItems: 'center', paddingLeft: 8,
                          }}>
                            <span style={{ fontSize: 11, color: 'white', fontWeight: 600 }}>{tag.count}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── ABC-EPISODER ── */}
            {episodes.length > 0 && (
              <>
                <SectionTitle>Dokumenterte episoder — ABC-analyse ({episodes.length} stk)</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {episodes.map(e => (
                    <div key={e.entry_date} style={{ ...s.card, borderLeft: '4px solid #1B3A5C' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1B3A5C', marginBottom: 10 }}>
                        📅 {fmtLong(e.entry_date)}
                        {e.day_score && (
                          <span style={{ marginLeft: 10, fontSize: 11, color: SCORE_COLORS[e.day_score - 1],
                            background: SCORE_BG[e.day_score - 1], padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                            Dagscore: {e.day_score}
                          </span>
                        )}
                      </div>
                      {e.abc_trigger && (
                        <AbcRow letter="A" color="#1B3A5C" label="Antecedent — hva skjedde rett før?" text={e.abc_trigger} />
                      )}
                      {e.abc_behavior && (
                        <AbcRow letter="B" color="#DC2626" label="Behavior — hva skjedde / hvordan reagerte Rakel?" text={e.abc_behavior} />
                      )}
                      {e.abc_helped && (
                        <AbcRow letter="C" color="#16A34A" label="Consequence — hva hjalp?" text={e.abc_helped} />
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── POSITIVE OBSERVASJONER ── */}
            {entries.some(e => e.positive) && (
              <>
                <SectionTitle>Positive observasjoner</SectionTitle>
                <div style={s.card}>
                  {entries.filter(e => e.positive).map(e => (
                    <div key={e.entry_date} style={{ marginBottom: 12, paddingBottom: 12,
                      borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 3 }}>{fmtLong(e.entry_date)}</div>
                      <div style={{ fontSize: 13, color: '#1E293B', lineHeight: 1.6 }}>{e.positive}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── UTFORDRENDE OBSERVASJONER ── */}
            {entries.some(e => e.negative) && (
              <>
                <SectionTitle>Utfordrende observasjoner</SectionTitle>
                <div style={s.card}>
                  {entries.filter(e => e.negative).map(e => (
                    <div key={e.entry_date} style={{ marginBottom: 12, paddingBottom: 12,
                      borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 3 }}>{fmtLong(e.entry_date)}</div>
                      <div style={{ fontSize: 13, color: '#1E293B', lineHeight: 1.6 }}>{e.negative}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── STØTTENDE OBSERVASJONER (skole, søvn, sanser, overganger) ── */}
            {entries.some(e => e.school_note || e.sleep_note || e.sensory_note || e.transition_note) && (
              <>
                <SectionTitle>Støttende observasjoner</SectionTitle>
                <div style={s.card}>
                  {entries.filter(e => e.school_note || e.sleep_note || e.sensory_note || e.transition_note).map(e => (
                    <div key={e.entry_date} style={{ marginBottom: 14, paddingBottom: 14,
                      borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1B3A5C', marginBottom: 6 }}>
                        {fmtLong(e.entry_date)}
                      </div>
                      {e.school_note && <NoteRow icon="🏫" label="Skole" text={e.school_note} />}
                      {e.sleep_note  && <NoteRow icon="😴" label="Søvn"  text={e.sleep_note}  />}
                      {e.sensory_note && <NoteRow icon="👂" label="Sanser" text={e.sensory_note} />}
                      {e.transition_note && <NoteRow icon="🔄" label="Overganger" text={e.transition_note} />}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── OPPSUMMERING / PRINT-FOOTER ── */}
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10,
              padding: '14px 16px', marginTop: 8 }} className="print-only">
              <div style={{ fontSize: 12, color: '#1E40AF' }}>
                <strong>Om rapporten:</strong> Data er hentet fra den digitale dagboken til familien Kvelland,
                ført av foresatte. Observasjonene er subjektive vurderinger fra hverdagen.
                ABC-episodene er dokumentert etter standardmodellen brukt i atferdsanalyse og er
                relevante for vurdering hos HABU, ABUP og PPT.
              </div>
            </div>

          </>
        )}
      </div>

      {/* Print-styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase',
      letterSpacing: '.9px', paddingBottom: 7, borderBottom: '1px solid #E2E8F0',
      marginBottom: 10, marginTop: 20 }}>
      {children}
    </div>
  )
}

function StatBox({ value, label, color, bg }: { value: string; label: string; color: string; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '14px 16px', border: `1px solid ${color}20` }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function AbcRow({ letter, color, label, text }: { letter: string; color: string; label: string; text: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
      <span style={{ width: 22, height: 22, borderRadius: '50%', background: color, color: 'white',
        fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginTop: 1 }}>{letter}</span>
      <div>
        <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, color: '#1E293B', lineHeight: 1.6 }}>{text}</div>
      </div>
    </div>
  )
}

function NoteRow({ icon, label, text }: { icon: string; label: string; text: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 5, fontSize: 13 }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span><strong style={{ color: '#64748B' }}>{label}:</strong> <span style={{ color: '#1E293B' }}>{text}</span></span>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  header:   { background: '#1B3A5C', color: 'white', padding: '0 16px', height: 54,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              position: 'sticky', top: 0, zIndex: 10, gap: 12 },
  logo:     { fontSize: 15, fontWeight: 600 },
  back:     { background: 'rgba(255,255,255,.13)', border: '1px solid rgba(255,255,255,.22)',
              color: 'white', borderRadius: 7, padding: '5px 10px', cursor: 'pointer',
              fontSize: 12, fontFamily: 'inherit' },
  printBtn: { background: 'white', border: 'none', borderRadius: 7, padding: '7px 14px',
              cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1B3A5C', fontFamily: 'inherit' },
  main:     { maxWidth: 720, margin: '0 auto', padding: '18px 14px 60px' },
  card:     { background: 'white', borderRadius: 10, padding: '16px 18px', marginBottom: 10,
              border: '1px solid #E8EDF2' },
}
