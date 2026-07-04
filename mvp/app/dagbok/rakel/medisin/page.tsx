'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { suggestMedicationInfo, calculateDailyGoals, type DailyGoals } from '@/lib/actions/nutrition'

interface Med {
  id: string; name: string; dosage: string; unit: string
  notes: string; active: boolean; sort_order: number
}

interface NutritionProfile {
  age: number | ''
  weight_kg: number | ''
  activity_level: string
  daily_goals: DailyGoals | null
}

const ACTIVITY_OPTIONS = [
  { value: 'low',       label: 'Lav',        desc: 'Stillesittende, lite bevegelse' },
  { value: 'moderate',  label: 'Moderat',     desc: 'Noe aktiv, 1–3 dager/uke' },
  { value: 'high',      label: 'Høy',         desc: 'Aktiv, 4–5 dager/uke' },
  { value: 'very_high', label: 'Veldig høy',  desc: 'Daglig trening/sport' },
]

const GOAL_FIELDS: { key: keyof DailyGoals; label: string; unit: string }[] = [
  { key: 'kcal',          label: 'Kalorier',       unit: 'kcal' },
  { key: 'protein',       label: 'Protein',         unit: 'g' },
  { key: 'carbs',         label: 'Karbohydrater',   unit: 'g' },
  { key: 'sugar',         label: 'Sukker',          unit: 'g' },
  { key: 'fiber',         label: 'Kostfiber',       unit: 'g' },
  { key: 'fat',           label: 'Fett',            unit: 'g' },
  { key: 'saturated_fat', label: 'Mettet fett',     unit: 'g' },
  { key: 'sodium',        label: 'Salt (natrium)',  unit: 'mg' },
]

export default function MedisinAdminPage() {
  const router = useRouter()
  const sb = createClient()

  const [groupId,  setGroupId]  = useState<string | null>(null)
  const [userId,   setUserId]   = useState<string | null>(null)
  const [isAdmin,  setIsAdmin]  = useState(false)
  const [meds,     setMeds]     = useState<Med[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  // New med form
  const [newName,   setNewName]   = useState('')
  const [newDosage, setNewDosage] = useState('')
  const [newUnit,   setNewUnit]   = useState('mg')
  const [newNotes,  setNewNotes]  = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  // Nutrition profile
  const [profile,       setProfile]       = useState<NutritionProfile>({
    age: '', weight_kg: '', activity_level: 'moderate', daily_goals: null,
  })
  const [goalLoading,   setGoalLoading]   = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg,    setProfileMsg]    = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/sign-in'); return }
      setUserId(user.id)

      const { data: gm } = await sb.from('group_members')
        .select('group_id, role').eq('profile_id', user.id).limit(1).single()
      if (!gm) return
      const g = gm as { group_id: string; role: string }
      setGroupId(g.group_id)
      setIsAdmin(['owner', 'admin', 'parent'].includes(g.role))

      const [{ data: medsData }, { data: profData }] = await Promise.all([
        sb.from('rakel_medication_setup').select('*').eq('group_id', g.group_id).order('sort_order'),
        sb.from('rakel_nutrition_profile').select('*').eq('group_id', g.group_id).maybeSingle(),
      ])
      setMeds((medsData as Med[]) ?? [])
      if (profData) {
        const p = profData as { age: number; weight_kg: number; activity_level: string; daily_goals: DailyGoals | null }
        setProfile({ age: p.age ?? '', weight_kg: p.weight_kg ?? '', activity_level: p.activity_level ?? 'moderate', daily_goals: p.daily_goals })
      }
      setLoading(false)
    }
    init()
  }, [sb, router])

  // ── Medication actions ──────────────────────────────────────────────────
  async function aiSuggest() {
    if (!newName.trim()) return
    setAiLoading(true)
    const res = await suggestMedicationInfo(newName.trim())
    setAiLoading(false)
    if (res.ok) {
      if (res.dosage) setNewDosage(res.dosage)
      if (res.unit)   setNewUnit(res.unit)
      if (res.notes)  setNewNotes(res.notes)
    }
  }

  async function addMed() {
    if (!newName.trim() || !groupId || !userId) return
    setSaving(true); setError(null)
    const { data, error: err } = await sb.from('rakel_medication_setup').insert({
      group_id: groupId, name: newName.trim(), dosage: newDosage.trim() || null,
      unit: newUnit.trim() || null, notes: newNotes.trim() || null,
      active: true, sort_order: meds.length, created_by: userId,
    }).select().single()
    setSaving(false)
    if (err) { setError(err.message); return }
    setMeds(prev => [...prev, data as Med])
    setNewName(''); setNewDosage(''); setNewUnit('mg'); setNewNotes('')
  }

  async function toggleActive(id: string, current: boolean) {
    await sb.from('rakel_medication_setup').update({ active: !current }).eq('id', id)
    setMeds(prev => prev.map(m => m.id === id ? { ...m, active: !current } : m))
  }
  async function deleteMed(id: string) {
    if (!confirm('Fjern denne medisinen?')) return
    await sb.from('rakel_medication_setup').delete().eq('id', id)
    setMeds(prev => prev.filter(m => m.id !== id))
  }

  // ── Nutrition profile actions ───────────────────────────────────────────
  async function generateGoals() {
    const age = Number(profile.age); const wt = Number(profile.weight_kg)
    if (!age || !wt) { setProfileMsg('Fyll inn alder og vekt først.'); return }
    setGoalLoading(true); setProfileMsg(null)
    const res = await calculateDailyGoals({ age, weight_kg: wt, activity_level: profile.activity_level })
    setGoalLoading(false)
    if (!res.ok) { setProfileMsg(`AI-feil: ${res.error}`); return }
    setProfile(p => ({ ...p, daily_goals: res.data }))
    setProfileMsg('Dagsmål beregnet! Klikk "Lagre profil" for å lagre.')
  }

  async function saveProfile() {
    if (!groupId || !userId) return
    setProfileSaving(true); setProfileMsg(null)
    const payload = {
      group_id: groupId,
      age: Number(profile.age) || null,
      weight_kg: Number(profile.weight_kg) || null,
      activity_level: profile.activity_level,
      daily_goals: profile.daily_goals,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }
    const { error: err } = await sb.from('rakel_nutrition_profile')
      .upsert(payload, { onConflict: 'group_id' })
    setProfileSaving(false)
    setProfileMsg(err ? `Feil: ${err.message}` : '✓ Profil lagret!')
  }

  function updateGoal(key: keyof DailyGoals, val: string) {
    setProfile(p => ({
      ...p,
      daily_goals: { ...(p.daily_goals ?? {} as DailyGoals), [key]: Number(val) || 0 }
    }))
  }

  if (loading) return <div style={s.loading}>Laster…</div>
  if (!isAdmin) return <div style={s.loading}>Ingen tilgang.</div>

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9' }}>
      <header style={s.header}>
        <button style={s.back} onClick={() => router.push('/dagbok/rakel')}>← Tilbake</button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>⚙️ Rakels innstillinger</span>
        <span />
      </header>

      <div style={s.main}>

        {/* ── NÆRINGSPROFIL ── */}
        <div style={s.sh}>🥗 Næringsprofil og dagsmål</div>
        <div style={s.card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={s.label}>Alder (år)</label>
              <input type="number" style={s.input} value={profile.age}
                onChange={e => setProfile(p => ({ ...p, age: e.target.value === '' ? '' : Number(e.target.value) }))}
                placeholder="F.eks: 12" min={1} max={25} />
            </div>
            <div>
              <label style={s.label}>Vekt (kg)</label>
              <input type="number" style={s.input} value={profile.weight_kg}
                onChange={e => setProfile(p => ({ ...p, weight_kg: e.target.value === '' ? '' : Number(e.target.value) }))}
                placeholder="F.eks: 42" min={10} max={150} step={0.5} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>Aktivitetsnivå</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {ACTIVITY_OPTIONS.map(opt => {
                const active = profile.activity_level === opt.value
                return (
                  <button key={opt.value}
                    onClick={() => setProfile(p => ({ ...p, activity_level: opt.value }))}
                    style={{ padding: '8px 12px', textAlign: 'left', border: `2px solid ${active ? '#1B3A5C' : '#E2E8F0'}`,
                      background: active ? '#EFF6FF' : '#F8FAFC', borderRadius: 8,
                      cursor: 'pointer', fontFamily: 'inherit' }}>
                    <div style={{ fontSize: 13, fontWeight: active ? 700 : 400, color: active ? '#1B3A5C' : '#374151' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{opt.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button style={{ ...s.btn, flex: 1, justifyContent: 'center' }}
              onClick={generateGoals} disabled={goalLoading || !profile.age || !profile.weight_kg}>
              {goalLoading ? '⏳ AI beregner…' : '🤖 Beregn dagsmål med AI'}
            </button>
            <button style={{ ...s.btn, flex: 1, justifyContent: 'center',
              background: profileSaving ? '#94A3B8' : '#16A34A' }}
              onClick={saveProfile} disabled={profileSaving}>
              {profileSaving ? 'Lagrer…' : '💾 Lagre profil'}
            </button>
          </div>

          {profileMsg && (
            <p style={{ fontSize: 12, color: profileMsg.startsWith('✓') ? '#16A34A' : '#DC2626',
              marginBottom: 10 }}>{profileMsg}</p>
          )}

          {/* Editable goals table */}
          {profile.daily_goals && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 8 }}>
                Dagsmål (kan justeres manuelt)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {GOAL_FIELDS.map(({ key, label, unit }) => (
                  <div key={key}>
                    <label style={{ ...s.label, marginBottom: 2 }}>{label}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="number" style={{ ...s.input, textAlign: 'right' }}
                        value={profile.daily_goals?.[key] ?? 0}
                        onChange={e => updateGoal(key, e.target.value)} />
                      <span style={{ fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap' }}>{unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── MEDISINER ── */}
        <div style={s.sh}>💊 Medisiner og tilskudd</div>
        {meds.length === 0 && (
          <p style={{ color: '#94A3B8', fontSize: 14, marginBottom: 16 }}>Ingen medisiner lagt til ennå.</p>
        )}
        {meds.map(m => (
          <div key={m.id} style={{ ...s.card, opacity: m.active ? 1 : 0.55, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>💊 {m.name}</span>
                  {m.dosage && <span style={s.badge}>{m.dosage} {m.unit}</span>}
                  {!m.active && <span style={{ ...s.badge, background: '#F1F5F9', color: '#94A3B8' }}>Inaktiv</span>}
                </div>
                {m.notes && <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>{m.notes}</p>}
              </div>
              <div style={{ display: 'flex', gap: 6, marginLeft: 12, flexShrink: 0 }}>
                <button style={s.btnSm} onClick={() => toggleActive(m.id, m.active)}>
                  {m.active ? 'Deaktiver' : 'Aktiver'}
                </button>
                <button style={{ ...s.btnSm, color: '#DC2626', borderColor: '#FECACA' }}
                  onClick={() => deleteMed(m.id)}>Slett</button>
              </div>
            </div>
          </div>
        ))}

        <div style={s.sh}>Legg til medisin / tilskudd</div>
        <div style={s.card}>
          <div style={{ marginBottom: 12 }}>
            <label style={s.label}>Navn</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...s.input, flex: 1 }} value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="F.eks: Jerntilskudd, Melatonin, Ritalin…"
                onKeyDown={e => e.key === 'Enter' && aiSuggest()} />
              <button style={{ ...s.btn, minWidth: 120 }} onClick={aiSuggest}
                disabled={aiLoading || !newName.trim()}>
                {aiLoading ? '⏳ AI…' : '🤖 Foreslå'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
              Trykk Enter eller "Foreslå" — AI fyller inn anbefalt dose.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={s.label}>Dose</label>
              <input style={s.input} value={newDosage}
                onChange={e => setNewDosage(e.target.value)} placeholder="F.eks: 10" />
            </div>
            <div>
              <label style={s.label}>Enhet</label>
              <input style={s.input} value={newUnit}
                onChange={e => setNewUnit(e.target.value)} placeholder="mg" />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>Notater (valgfritt)</label>
            <textarea style={{ ...s.input, minHeight: 56, resize: 'vertical' }} value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              placeholder="F.eks: Tas om kvelden, jerntilskudd for jernmangel…" />
          </div>
          {error && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 10 }}>⚠ {error}</p>}
          <button style={{ ...s.btn, width: '100%', justifyContent: 'center' }}
            onClick={addMed} disabled={saving || !newName.trim()}>
            {saving ? 'Lagrer…' : '+ Legg til medisin'}
          </button>
        </div>

      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  loading:  { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#94A3B8' },
  header:   { background: '#1B3A5C', color: 'white', padding: '0 16px', height: 54,
               display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  back:     { background: 'rgba(255,255,255,.13)', border: '1px solid rgba(255,255,255,.22)',
               color: 'white', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' },
  main:     { maxWidth: 600, margin: '0 auto', padding: '20px 14px 60px' },
  sh:       { fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const,
               letterSpacing: '.9px', paddingBottom: 7, borderBottom: '1px solid #E2E8F0', marginBottom: 12, marginTop: 24 },
  card:     { background: 'white', borderRadius: 10, padding: '14px 16px', border: '1px solid #E8EDF2' },
  badge:    { fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: 999, border: '1px solid #BFDBFE' },
  label:    { display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 },
  input:    { width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8,
               fontSize: 14, color: '#1E293B', background: '#F8FAFC', fontFamily: 'inherit',
               outline: 'none', boxSizing: 'border-box' as const },
  btn:      { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#1B3A5C',
               color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
               cursor: 'pointer', fontFamily: 'inherit' },
  btnSm:    { padding: '5px 10px', background: 'white', border: '1px solid #E2E8F0', borderRadius: 6,
               fontSize: 12, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' },
}
