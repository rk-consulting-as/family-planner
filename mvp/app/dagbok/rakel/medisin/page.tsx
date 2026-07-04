'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { suggestMedicationInfo } from '@/lib/actions/nutrition'

interface Med {
  id: string
  name: string
  dosage: string
  unit: string
  notes: string
  active: boolean
  sort_order: number
}

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
  const [newName,    setNewName]    = useState('')
  const [newDosage,  setNewDosage]  = useState('')
  const [newUnit,    setNewUnit]    = useState('mg')
  const [newNotes,   setNewNotes]   = useState('')
  const [aiLoading,  setAiLoading]  = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/sign-in'); return }
      setUserId(user.id)

      const { data: gm } = await sb.from('group_members')
        .select('group_id, role')
        .eq('profile_id', user.id)
        .limit(1)
        .single()

      if (!gm) return
      const g = gm as { group_id: string; role: string }
      setGroupId(g.group_id)
      setIsAdmin(['owner', 'admin', 'parent'].includes(g.role))

      const { data } = await sb
        .from('rakel_medication_setup')
        .select('*')
        .eq('group_id', g.group_id)
        .order('sort_order')
      setMeds((data as Med[]) ?? [])
      setLoading(false)
    }
    init()
  }, [sb, router])

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
    setSaving(true)
    setError(null)
    const { data, error: err } = await sb.from('rakel_medication_setup').insert({
      group_id:   groupId,
      name:       newName.trim(),
      dosage:     newDosage.trim() || null,
      unit:       newUnit.trim()   || null,
      notes:      newNotes.trim()  || null,
      active:     true,
      sort_order: meds.length,
      created_by: userId,
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

  if (loading) return <div style={s.loading}>Laster…</div>
  if (!isAdmin) return <div style={s.loading}>Ingen tilgang.</div>

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9' }}>
      <header style={s.header}>
        <button style={s.back} onClick={() => router.push('/dagbok/rakel')}>← Tilbake</button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>💊 Rakels medisiner</span>
        <span />
      </header>

      <div style={s.main}>

        {/* Existing meds */}
        <div style={s.sh}>Konfigurerte medisiner</div>
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
                  onClick={() => deleteMed(m.id)}>
                  Slett
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Add new med */}
        <div style={s.sh}>Legg til ny medisin / tilskudd</div>
        <div style={s.card}>
          <div style={{ marginBottom: 12 }}>
            <label style={s.label}>Navn på medisin eller tilskudd</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...s.input, flex: 1 }}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="F.eks: Jerntilskudd, Melatonin, Ritalin…"
                onKeyDown={e => e.key === 'Enter' && aiSuggest()}
              />
              <button style={{ ...s.btn, minWidth: 120 }} onClick={aiSuggest} disabled={aiLoading || !newName.trim()}>
                {aiLoading ? '⏳ AI…' : '🤖 Foreslå'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
              Klikk "Foreslå" eller trykk Enter — AI fyller inn anbefalt dose og info.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={s.label}>Dose</label>
              <input style={s.input} value={newDosage}
                onChange={e => setNewDosage(e.target.value)}
                placeholder="F.eks: 10" />
            </div>
            <div>
              <label style={s.label}>Enhet</label>
              <input style={s.input} value={newUnit}
                onChange={e => setNewUnit(e.target.value)}
                placeholder="mg" />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>Notater (valgfritt)</label>
            <textarea style={{ ...s.input, minHeight: 56, resize: 'vertical' }}
              value={newNotes}
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
  loading: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
             fontSize: 14, color: '#94A3B8' },
  header:  { background: '#1B3A5C', color: 'white', padding: '0 16px', height: 54,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  back:    { background: 'rgba(255,255,255,.13)', border: '1px solid rgba(255,255,255,.22)',
              color: 'white', borderRadius: 7, padding: '5px 10px', cursor: 'pointer',
              fontSize: 12, fontFamily: 'inherit' },
  main:    { maxWidth: 600, margin: '0 auto', padding: '20px 14px 60px' },
  sh:      { fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const,
              letterSpacing: '.9px', paddingBottom: 7, borderBottom: '1px solid #E2E8F0',
              marginBottom: 12, marginTop: 24 },
  card:    { background: 'white', borderRadius: 10, padding: '14px 16px',
              border: '1px solid #E8EDF2' },
  badge:   { fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px',
              borderRadius: 999, border: '1px solid #BFDBFE' },
  label:   { display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 },
  input:   { width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8,
              fontSize: 14, color: '#1E293B', background: '#F8FAFC', fontFamily: 'inherit',
              outline: 'none', boxSizing: 'border-box' as const },
  btn:     { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
              background: '#1B3A5C', color: 'white', border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnSm:   { padding: '5px 10px', background: 'white', border: '1px solid #E2E8F0',
              borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#374151',
              fontFamily: 'inherit' },
}
