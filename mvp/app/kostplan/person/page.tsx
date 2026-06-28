'use client'

import { useState, useEffect } from 'react'
import { createKpClient as createClient } from '@/lib/supabase/kp-client'
import { useRouter } from 'next/navigation'

type HealthGoal = string
type BudgetLevel = 'budget' | 'medium' | 'premium'

const HEALTH_GOALS: { value: HealthGoal; label: string; emoji: string; desc: string }[] = [
  { value: 'general',            label: 'Generelt sunt',          emoji: '🥗', desc: 'Variert og balansert kost' },
  { value: 'weight_loss',        label: 'Vektreduksjon',           emoji: '⚖️', desc: 'Kaloriredusert, mettende mat' },
  { value: 'weight_gain',        label: 'Vektøkning',              emoji: '💪', desc: 'Kaloritett og næringsrikt' },
  { value: 'anxiety_reduction',  label: 'Angstreduserende',        emoji: '🧘', desc: 'Omega-3, magnesium, stabilt blodsukker' },
  { value: 'anti_inflammatory',  label: 'Betennelsesdempende',     emoji: '🫚', desc: 'Antioksidanter og omega-3' },
  { value: 'gut_health',         label: 'Tarmhelse',               emoji: '🦠', desc: 'Probiotika og fiber' },
  { value: 'blood_sugar',        label: 'Blodsukkerstabilisering', emoji: '📊', desc: 'Lavt GI, jevnt energinivå' },
  { value: 'heart_health',       label: 'Hjertehelse',             emoji: '❤️', desc: 'Omega-3 og fiber' },
  { value: 'energy',             label: 'Energi',                  emoji: '⚡', desc: 'Jern, B-vitaminer, komplekse karbo' },
  { value: 'muscle_building',    label: 'Muskelbygging',           emoji: '🏋️', desc: 'Høyt protein, treningsfokus' },
  { value: 'adhd_focus',         label: 'Konsentrasjon / ADHD',   emoji: '🧠', desc: 'Omega-3, stabilt blodsukker' },
  { value: 'sleep',              label: 'Søvnforbedring',          emoji: '😴', desc: 'Magnesium, tryptofan' },
  { value: 'immune_support',     label: 'Immunforsvar',            emoji: '🛡️', desc: 'Vitamin C, D og sink' },
  { value: 'bone_health',        label: 'Skjeletthelse',           emoji: '🦴', desc: 'Kalsium og D-vitamin' },
  { value: 'sports_performance', label: 'Idrettsernæring',         emoji: '🏃', desc: 'Timing og restitusjon' },
]

const EMOJIS = ['🧑','👦','👧','👩','👨','🧒','👴','👵','🐱','🐶']
const COLORS = ['#3B7DD8','#C4622D','#16A34A','#9333EA','#DC2626','#0891B2','#D97706','#DB2777']

export default function NewPersonPage() {
  const [name, setName]             = useState('')
  const [emoji, setEmoji]           = useState('🧑')
  const [color, setColor]           = useState('#3B7DD8')
  const [healthGoal, setGoal]       = useState<HealthGoal>('general')
  const [healthNotes, setNotes]     = useState('')
  const [likes, setLikes]           = useState('')
  const [dislikes, setDislikes]     = useState('')
  const [allergies, setAllergies]   = useState('')
  const [pickiness, setPickiness]   = useState(3)
  const [budget, setBudget]         = useState<BudgetLevel>('medium')
  const [lunchbox, setLunchbox]     = useState(false)
  const [familyProfiles, setProfiles] = useState<{id: string; display_name: string; avatar_url: string|null; color_hex: string|null}[]>([])
  const [linkedProfile, setLinked]  = useState<string>('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [step, setStep]             = useState(1)
  const router = useRouter()
  const sb = createClient()

  useEffect(() => {
    // Hent familiemedlemmer for å koble person til eksisterende profil
    async function loadProfiles() {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      // Hent gruppemedlemmer via group_members
      const { data } = await sb.from('group_members')
        .select('profiles(id, display_name, avatar_url, color_hex)')
        .limit(20)
      if (data) {
        const profiles = data.flatMap((r: { profiles: { id: string; display_name: string; avatar_url: string | null; color_hex: string | null } | null }) => r.profiles ? [r.profiles] : [])
        setProfiles(profiles)
      }
    }
    loadProfiles()
  }, [sb])

  async function save() {
    if (!name.trim()) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/kostplan/person', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linked_profile_id: linkedProfile || null,
        name: name.trim(),
        avatar_emoji: emoji,
        color_hex: color,
        health_goal: healthGoal,
        health_notes: healthNotes || null,
        likes: likes.split(',').map(s => s.trim()).filter(Boolean),
        dislikes: dislikes.split(',').map(s => s.trim()).filter(Boolean),
        allergies: allergies.split(',').map(s => s.trim()).filter(Boolean),
        pickiness_level: pickiness,
        budget_level: budget,
        lunchbox_friendly: lunchbox,
      }),
    })

    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Noe gikk galt')
      setLoading(false)
      return
    }
    router.push(`/kostplan/dashboard?person=${json.id}`)
    setLoading(false)
  }

  const selectedGoal = HEALTH_GOALS.find(g => g.value === healthGoal)

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <button style={s.backBtn} onClick={() => router.push('/kostplan/dashboard')}>← Tilbake</button>
          <div style={s.logo}>Kost<span style={{ color: '#3B7DD8' }}>Plan</span></div>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Legg til person</h1>
        <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 24 }}>Hvem skal kostplanen lages for?</p>

        {/* Steg-indikator */}
        <div style={s.stepRow}>
          {['Hvem', 'Helsemål', 'Preferanser'].map((label, i) => (
            <div key={i} style={s.stepItem}>
              <div style={{ ...s.stepDot, background: i + 1 <= step ? '#3B7DD8' : '#E4E8EF', color: i + 1 <= step ? '#fff' : '#9CA3AF' }}>{i+1}</div>
              <div style={{ fontSize: 11, color: i + 1 === step ? '#3B7DD8' : '#9CA3AF', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Steg 1: Hvem */}
        {step === 1 && (
          <div>
            {/* Koble til familiemedlem */}
            {familyProfiles.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <label style={s.label}>Koble til familiemedlem (valgfritt)</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    style={{ ...s.profileBtn, ...(linkedProfile === '' ? s.profileBtnActive : {}) }}
                    onClick={() => { setLinked('') }}
                  >Ny person</button>
                  {familyProfiles.map(p => (
                    <button key={p.id}
                      style={{ ...s.profileBtn, ...(linkedProfile === p.id ? s.profileBtnActive : {}) }}
                      onClick={() => { setLinked(p.id); setName(p.display_name) }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color_hex || '#3B7DD8', display: 'inline-block', marginRight: 4 }} />
                      {p.display_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Field label="Navn">
              <input style={s.input} value={name} onChange={e => setName(e.target.value)} placeholder="f.eks. Rakel" autoFocus />
            </Field>

            <label style={s.label}>Emoji</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {EMOJIS.map(e => (
                <button key={e} style={{ ...s.emojiBtn, ...(emoji === e ? s.emojiBtnActive : {}) }} onClick={() => setEmoji(e)}>{e}</button>
              ))}
            </div>

            <label style={s.label}>Farge</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {COLORS.map(c => (
                <button key={c} style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: color === c ? '3px solid #111' : '2px solid transparent', cursor: 'pointer' }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>
        )}

        {/* Steg 2: Helsemål */}
        {step === 2 && (
          <div>
            <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 14 }}>Velg det målet som passer best. AI-forslagene tilpasses dette.</p>
            <div style={s.goalGrid}>
              {HEALTH_GOALS.map(g => (
                <button key={g.value}
                  style={{ ...s.goalBtn, ...(healthGoal === g.value ? s.goalBtnActive : {}) }}
                  onClick={() => setGoal(g.value)}
                >
                  <span style={{ fontSize: 22 }}>{g.emoji}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{g.label}</span>
                  <span style={{ fontSize: 11, color: healthGoal === g.value ? '#1D4ED8' : '#9CA3AF' }}>{g.desc}</span>
                </button>
              ))}
            </div>
            {selectedGoal && (
              <div style={{ marginTop: 14 }}>
                <Field label="Personlige helsenotater (valgfritt)">
                  <textarea style={{ ...s.input, minHeight: 70, resize: 'vertical' }}
                    value={healthNotes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder={`f.eks. "Diagnostisert med angst mars 2024, sensitiv for koffein"`}
                  />
                </Field>
              </div>
            )}
          </div>
        )}

        {/* Steg 3: Preferanser */}
        {step === 3 && (
          <div>
            <Field label="Liker (kommaseparert)">
              <input style={s.input} value={likes} onChange={e => setLikes(e.target.value)} placeholder="pasta, kylling, laks…" />
            </Field>
            <Field label="Liker ikke">
              <input style={s.input} value={dislikes} onChange={e => setDislikes(e.target.value)} placeholder="sopp, lever…" />
            </Field>
            <Field label="Allergier / intoleranser">
              <input style={s.input} value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="nøtter, gluten, laktose…" />
            </Field>

            <Field label={`Kresennivå: ${['','Spiser alt','Lite kresen','Middels','Ganske kresen','Veldig kresen'][pickiness]}`}>
              <input type="range" min={1} max={5} value={pickiness} onChange={e => setPickiness(+e.target.value)} style={{ width: '100%' }} />
            </Field>

            <Field label="Budsjett">
              <div style={{ display: 'flex', gap: 8 }}>
                {(['budget','medium','premium'] as BudgetLevel[]).map(b => (
                  <button key={b} style={{ ...s.numBtn, flex: 1, width: 'auto', height: 'auto', padding: '8px 0', fontSize: 13, ...(budget === b ? s.numActive : {}) }} onClick={() => setBudget(b)}>
                    {b === 'budget' ? '💰 Billig' : b === 'medium' ? '💳 Middels' : '⭐ Premium'}
                  </button>
                ))}
              </div>
            </Field>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <input type="checkbox" id="lunchbox" checked={lunchbox} onChange={e => setLunchbox(e.target.checked)} style={{ width: 16, height: 16 }} />
              <label htmlFor="lunchbox" style={{ fontSize: 14, cursor: 'pointer' }}>🎒 Maten bør egne seg i matboks</label>
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#DC2626', fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Navigasjon */}
        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          {step > 1 && <button style={s.btnGhost} onClick={() => setStep(s => s - 1)}>← Tilbake</button>}
          {step < 3
            ? <button style={{ ...s.btn, flex: 1 }} onClick={() => setStep(s => s + 1)} disabled={step === 1 && !name.trim()}>Neste →</button>
            : <button style={{ ...s.btn, flex: 1 }} onClick={save} disabled={loading}>{loading ? 'Lagrer…' : '✅ Opprett kostplan'}</button>
          }
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '.4px', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px' },
  card: { background: '#fff', border: '1px solid #E4E8EF', borderRadius: 12, padding: '28px 28px', width: '100%', maxWidth: 600, boxShadow: '0 1px 3px rgba(0,0,0,.08)' },
  logo: { fontSize: 16, fontWeight: 700 },
  backBtn: { fontSize: 13, color: '#6B7280', background: 'none', border: '1px solid #E4E8EF', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' },
  stepRow: { display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 24 },
  stepItem: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  stepDot: { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '.4px', marginBottom: 6 },
  input: { width: '100%', padding: '10px 14px', border: '1px solid #E4E8EF', borderRadius: 8, fontSize: 15, background: '#F4F6F9', color: '#111827', outline: 'none', fontFamily: 'inherit' },
  profileBtn: { padding: '6px 12px', border: '1px solid #E4E8EF', borderRadius: 7, background: '#F4F6F9', fontSize: 13, cursor: 'pointer', color: '#374151' },
  profileBtnActive: { background: '#EBF2FF', border: '1px solid #3B7DD8', color: '#1D4ED8' },
  emojiBtn: { width: 36, height: 36, border: '2px solid transparent', borderRadius: 8, background: '#F4F6F9', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emojiBtnActive: { border: '2px solid #3B7DD8', background: '#EBF2FF' },
  goalGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 },
  goalBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 6px', border: '1px solid #E4E8EF', borderRadius: 8, background: '#F4F6F9', cursor: 'pointer', textAlign: 'center' as const },
  goalBtnActive: { background: '#EBF2FF', border: '1px solid #3B7DD8' },
  numBtn: { width: 44, height: 44, borderRadius: 8, border: '1px solid #E4E8EF', background: '#F4F6F9', fontSize: 16, fontWeight: 600, color: '#374151', cursor: 'pointer' },
  numActive: { background: '#3B7DD8', color: '#fff', border: '1px solid #3B7DD8' },
  btn: { padding: '11px 0', background: '#3B7DD8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 500, cursor: 'pointer' },
  btnGhost: { padding: '11px 16px', background: 'transparent', color: '#6B7280', border: '1px solid #E4E8EF', borderRadius: 8, fontSize: 15, cursor: 'pointer' },
}
