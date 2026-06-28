'use client'

import { useState } from 'react'
import { createKpClient as createClient } from '@/lib/supabase/kp-client'
import { useRouter } from 'next/navigation'

type NutritionFocus = 'iron' | 'folate' | 'vitamin_d' | 'protein' | 'fiber' | 'calcium' | 'omega3'

const NUTRITION_OPTIONS: { value: NutritionFocus; label: string; emoji: string }[] = [
  { value: 'iron',      label: 'Jern',      emoji: '🥩' },
  { value: 'folate',    label: 'Folat',      emoji: '🥬' },
  { value: 'vitamin_d', label: 'Vitamin D',  emoji: '☀️' },
  { value: 'protein',   label: 'Protein',    emoji: '💪' },
  { value: 'fiber',     label: 'Fiber',      emoji: '🌾' },
  { value: 'calcium',   label: 'Kalsium',    emoji: '🥛' },
  { value: 'omega3',    label: 'Omega-3',    emoji: '🐟' },
]

export default function KostPlanOnboarding() {
  const [step, setStep]           = useState(1)
  const [householdSize, setSize]  = useState(4)
  const [pickiness, setPickiness] = useState(3)
  const [likes, setLikes]         = useState('')
  const [dislikes, setDislikes]   = useState('')
  const [allergies, setAllergies] = useState('')
  const [nutrition, setNutrition] = useState<NutritionFocus[]>([])
  const [loading, setLoading]     = useState(false)
  const router = useRouter()
  const sb = createClient()

  function toggleNutrition(val: NutritionFocus) {
    setNutrition(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    )
  }

  async function finish() {
    setLoading(true)
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return

    await sb.from('kp_preferences').upsert({
      profile_id: user.id,
      likes:     likes.split(',').map(s => s.trim()).filter(Boolean),
      dislikes:  dislikes.split(',').map(s => s.trim()).filter(Boolean),
      allergies: allergies.split(',').map(s => s.trim()).filter(Boolean),
      pickiness_level: pickiness,
      nutrition_focus: nutrition,
      household_size: householdSize,
    })
    router.push('/kostplan/dashboard')
    setLoading(false)
  }

  const steps = ['Husstand', 'Matpreferanser', 'Ernæringsfokus']

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>Kost<span style={{ color: '#3B7DD8' }}>Plan</span></div>
        <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 24 }}>La oss sette opp appen for deg</p>

        {/* Steg-indikator */}
        <div style={s.stepRow}>
          {steps.map((label, i) => (
            <div key={i} style={s.stepItem}>
              <div style={{ ...s.stepDot, background: i + 1 <= step ? '#3B7DD8' : '#E4E8EF', color: i + 1 <= step ? '#fff' : '#9CA3AF' }}>
                {i + 1}
              </div>
              <div style={{ fontSize: 11, color: i + 1 === step ? '#3B7DD8' : '#9CA3AF', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {step === 1 && (
          <div>
            <p style={s.stepTitle}>Hvor mange spiser dere?</p>
            <div style={s.row}>
              {[1,2,3,4,5,6].map(n => (
                <button key={n} style={{ ...s.numBtn, ...(householdSize === n ? s.numActive : {}) }} onClick={() => setSize(n)}>{n}</button>
              ))}
            </div>
            <p style={{ ...s.stepTitle, marginTop: 20 }}>Hvor kresne er dere?</p>
            <div style={{ ...s.row, flexWrap: 'wrap' }}>
              {[{v:1,l:'Spiser alt'},{v:2,l:'Lite'},{v:3,l:'Middels'},{v:4,l:'Ganske'},{v:5,l:'Veldig'}].map(({ v, l }) => (
                <button key={v} style={{ ...s.numBtn, ...(pickiness === v ? s.numActive : {}), width: 'auto', padding: '8px 12px', fontSize: 13 }} onClick={() => setPickiness(v)}>{l}</button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <Field label="Liker (kommaseparert)">
              <input style={s.input} value={likes} onChange={e => setLikes(e.target.value)} placeholder="pasta, kylling, ris…" />
            </Field>
            <Field label="Liker ikke">
              <input style={s.input} value={dislikes} onChange={e => setDislikes(e.target.value)} placeholder="sopp, lever…" />
            </Field>
            <Field label="Allergier / intoleranser">
              <input style={s.input} value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="nøtter, gluten…" />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div>
            <p style={s.stepTitle}>Hva vil dere fokusere på?</p>
            <div style={s.nutritionGrid}>
              {NUTRITION_OPTIONS.map(({ value, label, emoji }) => (
                <button key={value}
                  style={{ ...s.nutritionBtn, ...(nutrition.includes(value) ? s.nutritionActive : {}) }}
                  onClick={() => toggleNutrition(value)}
                >
                  <span style={{ fontSize: 20 }}>{emoji}</span>
                  <span style={{ fontSize: 13 }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          {step > 1 && <button style={s.btnGhost} onClick={() => setStep(s => s - 1)}>← Tilbake</button>}
          {step < 3
            ? <button style={{ ...s.btn, flex: 1 }} onClick={() => setStep(s => s + 1)}>Neste →</button>
            : <button style={{ ...s.btn, flex: 1 }} onClick={finish} disabled={loading}>{loading ? 'Lagrer…' : 'Kom i gang! 🎉'}</button>
          }
        </div>
        <button style={s.skip} onClick={() => router.push('/kostplan/dashboard')}>Hopp over, sett opp senere</button>
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
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { background: '#fff', border: '1px solid #E4E8EF', borderRadius: 12, padding: '36px 32px', width: '100%', maxWidth: 480, boxShadow: '0 1px 3px rgba(0,0,0,.08)' },
  logo: { fontSize: 22, fontWeight: 700, letterSpacing: '-.5px', marginBottom: 4 },
  stepRow: { display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 24 },
  stepItem: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  stepDot: { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 },
  stepTitle: { fontSize: 15, fontWeight: 600, marginBottom: 12 },
  row: { display: 'flex', gap: 8 },
  numBtn: { width: 44, height: 44, borderRadius: 8, border: '1px solid #E4E8EF', background: '#F4F6F9', fontSize: 16, fontWeight: 600, color: '#374151', cursor: 'pointer' },
  numActive: { background: '#3B7DD8', color: '#fff', border: '1px solid #3B7DD8' },
  input: { width: '100%', padding: '10px 14px', border: '1px solid #E4E8EF', borderRadius: 8, fontSize: 15, background: '#F4F6F9', color: '#111827', outline: 'none' },
  nutritionGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 },
  nutritionBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 8px', border: '1px solid #E4E8EF', borderRadius: 8, background: '#F4F6F9', cursor: 'pointer' },
  nutritionActive: { background: '#EBF2FF', border: '1px solid #3B7DD8' },
  btn: { padding: '11px 0', background: '#3B7DD8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 500, cursor: 'pointer' },
  btnGhost: { padding: '11px 16px', background: 'transparent', color: '#6B7280', border: '1px solid #E4E8EF', borderRadius: 8, fontSize: 15, cursor: 'pointer' },
  skip: { display: 'block', width: '100%', marginTop: 12, background: 'none', border: 'none', color: '#9CA3AF', fontSize: 13, cursor: 'pointer', textAlign: 'center' },
}
