'use client'

import { useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import type { NutritionFocus } from '../../lib/supabase'

const NUTRITION_OPTIONS: { value: NutritionFocus; label: string; emoji: string }[] = [
  { value: 'iron',      label: 'Jern',       emoji: '🥩' },
  { value: 'folate',    label: 'Folat',       emoji: '🥬' },
  { value: 'vitamin_d', label: 'Vitamin D',   emoji: '☀️' },
  { value: 'protein',   label: 'Protein',     emoji: '💪' },
  { value: 'fiber',     label: 'Fiber',       emoji: '🌾' },
  { value: 'calcium',   label: 'Kalsium',     emoji: '🥛' },
  { value: 'omega3',    label: 'Omega-3',     emoji: '🐟' },
]

export default function OnboardingPage() {
  const [step, setStep]               = useState(1)
  const [householdSize, setHousehold] = useState(4)
  const [pickiness, setPickiness]     = useState(3)
  const [likes, setLikes]             = useState('')
  const [dislikes, setDislikes]       = useState('')
  const [allergies, setAllergies]     = useState('')
  const [nutrition, setNutrition]     = useState<NutritionFocus[]>([])
  const [loading, setLoading]         = useState(false)
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
    if (!user) { router.push('/login'); return }

    await sb.from('kp_preferences').upsert({
      profile_id: user.id,
      likes:     likes.split(',').map(s => s.trim()).filter(Boolean),
      dislikes:  dislikes.split(',').map(s => s.trim()).filter(Boolean),
      allergies: allergies.split(',').map(s => s.trim()).filter(Boolean),
      pickiness_level: pickiness,
      nutrition_focus: nutrition,
      household_size: householdSize,
    })
    router.push('/dashboard')
    setLoading(false)
  }

  const steps = [
    { title: 'Husstand', icon: '👨‍👩‍👧‍👦' },
    { title: 'Matpreferanser', icon: '🍽️' },
    { title: 'Ernæringsfokus', icon: '💊' },
  ]

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>Kost<span style={{ color: '#3B7DD8' }}>Plan</span></div>
        <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 28 }}>
          La oss sette opp appen for deg
        </p>

        {/* Step indicators */}
        <div style={s.stepRow}>
          {steps.map((st, i) => (
            <div key={i} style={s.stepItem}>
              <div style={{
                ...s.stepDot,
                background: i + 1 <= step ? '#3B7DD8' : '#E4E8EF',
                color: i + 1 <= step ? '#fff' : '#9CA3AF',
              }}>{i + 1}</div>
              <div style={{ fontSize: 11, color: i + 1 === step ? '#3B7DD8' : '#9CA3AF', marginTop: 4 }}>{st.title}</div>
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div>
            <h2 style={s.stepTitle}>Hvor mange spiser dere?</h2>
            <div style={s.householdRow}>
              {[1,2,3,4,5,6].map(n => (
                <button key={n}
                  style={{ ...s.numBtn, ...(householdSize === n ? s.numBtnActive : {}) }}
                  onClick={() => setHousehold(n)}
                >{n}</button>
              ))}
            </div>
            <h2 style={{ ...s.stepTitle, marginTop: 24 }}>Hvor kresne er dere?</h2>
            <div style={s.householdRow}>
              {[
                { v: 1, label: 'Spiser alt' },
                { v: 2, label: 'Lite kresen' },
                { v: 3, label: 'Midt i mellom' },
                { v: 4, label: 'Ganske kresen' },
                { v: 5, label: 'Veldig kresen' },
              ].map(({ v, label }) => (
                <button key={v}
                  style={{ ...s.numBtn, ...(pickiness === v ? s.numBtnActive : {}), fontSize: 12, width: 'auto', padding: '8px 12px' }}
                  onClick={() => setPickiness(v)}
                >{label}</button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div>
            <Field label="Liker (kommaseparert)">
              <input style={s.input} value={likes} onChange={e => setLikes(e.target.value)}
                placeholder="pasta, kylling, løk, ris…" />
            </Field>
            <Field label="Liker ikke">
              <input style={s.input} value={dislikes} onChange={e => setDislikes(e.target.value)}
                placeholder="sopp, lever, blåmuggost…" />
            </Field>
            <Field label="Allergier / intoleranser">
              <input style={s.input} value={allergies} onChange={e => setAllergies(e.target.value)}
                placeholder="nøtter, gluten, laktose…" />
            </Field>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div>
            <h2 style={s.stepTitle}>Hva vil dere fokusere på?</h2>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
              Velg ett eller flere. AI-forslagene tilpasses dette.
            </p>
            <div style={s.nutritionGrid}>
              {NUTRITION_OPTIONS.map(({ value, label, emoji }) => (
                <button key={value}
                  style={{ ...s.nutritionBtn, ...(nutrition.includes(value) ? s.nutritionBtnActive : {}) }}
                  onClick={() => toggleNutrition(value)}
                >
                  <span style={{ fontSize: 20 }}>{emoji}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 8, marginTop: 28 }}>
          {step > 1 && (
            <button style={s.btnGhost} onClick={() => setStep(s => s - 1)}>← Tilbake</button>
          )}
          {step < 3 ? (
            <button style={{ ...s.btn, flex: 1 }} onClick={() => setStep(s => s + 1)}>
              Neste →
            </button>
          ) : (
            <button style={{ ...s.btn, flex: 1 }} onClick={finish} disabled={loading}>
              {loading ? 'Lagrer…' : 'Kom i gang! 🎉'}
            </button>
          )}
        </div>

        <button style={s.skip} onClick={() => router.push('/dashboard')}>
          Hopp over, sett opp senere
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F9', padding: 24 },
  card: { background: '#fff', border: '1px solid #E4E8EF', borderRadius: 12, padding: '36px 32px', width: '100%', maxWidth: 480, boxShadow: '0 1px 3px rgba(0,0,0,.08)' },
  logo: { fontSize: 22, fontWeight: 700, letterSpacing: '-.5px', marginBottom: 4 },
  stepRow: { display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 28 },
  stepItem: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  stepDot: { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 },
  stepTitle: { fontSize: 15, fontWeight: 600, marginBottom: 12 },
  householdRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  numBtn: { width: 44, height: 44, borderRadius: 8, border: '1px solid #E4E8EF', background: '#F4F6F9', fontSize: 16, fontWeight: 600, color: '#374151', cursor: 'pointer' },
  numBtnActive: { background: '#3B7DD8', color: '#fff', border: '1px solid #3B7DD8' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 },
  input: { width: '100%', padding: '10px 14px', border: '1px solid #E4E8EF', borderRadius: 8, fontSize: 15, background: '#F4F6F9', color: '#111827', outline: 'none' },
  nutritionGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 },
  nutritionBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 8px', border: '1px solid #E4E8EF', borderRadius: 8, background: '#F4F6F9', cursor: 'pointer' },
  nutritionBtnActive: { background: '#EBF2FF', border: '1px solid #3B7DD8', color: '#1D4ED8' },
  btn: { padding: '11px 0', background: '#3B7DD8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 500, cursor: 'pointer' },
  btnGhost: { padding: '11px 16px', background: 'transparent', color: '#6B7280', border: '1px solid #E4E8EF', borderRadius: 8, fontSize: 15, cursor: 'pointer' },
  skip: { display: 'block', width: '100%', marginTop: 14, background: 'none', border: 'none', color: '#9CA3AF', fontSize: 13, cursor: 'pointer', textAlign: 'center' },
}
