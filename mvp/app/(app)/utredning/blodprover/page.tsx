'use client'

import { useState, useEffect, useTransition, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { extractBloodTestFromFile, ExtractedBloodTest } from '@/lib/actions/extract_blood_test'

// ── Types ──────────────────────────────────────────────────────────────────────
interface BloodMarker {
  marker: string
  value: number
  unit: string
  ref_min: number | null
  ref_max: number | null
}

interface BloodTest {
  id: string
  test_date: string
  institution: string | null
  ordered_by: string | null
  notes: string | null
  values: BloodMarker[]
  created_at: string
}

// Common blood markers with typical reference ranges (for quick-add)
const COMMON_MARKERS = [
  { marker: 'Hemoglobin',    unit: 'g/dL',  ref_min: 11.5, ref_max: 15.5 },
  { marker: 'Ferritin',      unit: 'µg/L',  ref_min: 10,   ref_max: 120 },
  { marker: 'Jern (S-Fe)',   unit: 'µmol/L',ref_min: 9,    ref_max: 34 },
  { marker: 'Transferrin',   unit: 'g/L',   ref_min: 2.0,  ref_max: 3.6 },
  { marker: 'Leukocytter',   unit: '×10⁹/L',ref_min: 4.5,  ref_max: 13.5 },
  { marker: 'Trombocytter',  unit: '×10⁹/L',ref_min: 150,  ref_max: 400 },
  { marker: 'CRP',           unit: 'mg/L',  ref_min: null, ref_max: 5 },
  { marker: 'TSH',           unit: 'mIU/L', ref_min: 0.4,  ref_max: 4.0 },
  { marker: 'Vitamin D',     unit: 'nmol/L',ref_min: 50,   ref_max: 150 },
  { marker: 'Vitamin B12',   unit: 'pmol/L',ref_min: 150,  ref_max: 700 },
  { marker: 'Folat',         unit: 'nmol/L',ref_min: 7,    ref_max: 45 },
  { marker: 'Glukose',       unit: 'mmol/L',ref_min: 3.9,  ref_max: 5.6 },
]

function markerStatus(m: BloodMarker): 'low' | 'high' | 'ok' | 'unknown' {
  if (m.ref_min === null && m.ref_max === null) return 'unknown'
  if (m.ref_min !== null && m.value < m.ref_min) return 'low'
  if (m.ref_max !== null && m.value > m.ref_max) return 'high'
  return 'ok'
}

function StatusBadge({ status, value, unit }: { status: string; value: number; unit: string }) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold'
  if (status === 'low')    return <span className={`${base} bg-blue-100 text-blue-700`}>▼ {value} {unit}</span>
  if (status === 'high')   return <span className={`${base} bg-red-100 text-red-700`}>▲ {value} {unit}</span>
  if (status === 'ok')     return <span className={`${base} bg-green-100 text-green-700`}>✓ {value} {unit}</span>
  return <span className={`${base} bg-slate-100 text-slate-600`}>{value} {unit}</span>
}

// Mini sparkline — simple SVG trend for a single marker across tests
function Sparkline({ values, refMin, refMax }: { values: number[]; refMin: number | null; refMax: number | null }) {
  if (values.length < 2) return null
  const min = Math.min(...values, refMin ?? Infinity) * 0.9
  const max = Math.max(...values, refMax ?? -Infinity) * 1.1
  const range = max - min || 1
  const W = 80, H = 28
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W
    const y = H - ((v - min) / range) * H
    return `${x},${y}`
  }).join(' ')
  const toY = (v: number) => H - ((v - min) / range) * H

  return (
    <svg width={W} height={H} className="inline-block">
      {refMin !== null && (
        <line x1={0} x2={W} y1={toY(refMin)} y2={toY(refMin)} stroke="#86efac" strokeWidth={1} strokeDasharray="2" />
      )}
      {refMax !== null && (
        <line x1={0} x2={W} y1={toY(refMax)} y2={toY(refMax)} stroke="#fca5a5" strokeWidth={1} strokeDasharray="2" />
      )}
      <polyline fill="none" stroke="#1B3A5C" strokeWidth={2} points={pts} />
      {values.map((v, i) => {
        const x = (i / (values.length - 1)) * W
        const y = toY(v)
        const ok = (refMin === null || v >= refMin) && (refMax === null || v <= refMax)
        return <circle key={i} cx={x} cy={y} r={3} fill={ok ? '#16a34a' : '#dc2626'} />
      })}
    </svg>
  )
}

export default function BlodproverPage() {
  const sb = createClient()
  const [tests, setTests] = useState<BloodTest[]>([])
  const [groupId, setGroupId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'history' | 'trends'>('history')

  // Form state
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10))
  const [formInstitution, setFormInstitution] = useState('')
  const [formOrderedBy, setFormOrderedBy] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formMarkers, setFormMarkers] = useState<BloodMarker[]>([
    { marker: 'Hemoglobin', value: 0, unit: 'g/dL', ref_min: 11.5, ref_max: 15.5 },
  ])
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  // AI file import state
  const [aiExtracting, setAiExtracting] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiSuccess, setAiSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Apply extracted data to form fields
  const applyExtracted = useCallback((data: ExtractedBloodTest) => {
    if (data.test_date)   setFormDate(data.test_date)
    if (data.institution) setFormInstitution(data.institution)
    if (data.ordered_by)  setFormOrderedBy(data.ordered_by)
    if (data.notes)       setFormNotes(data.notes)
    if (data.markers.length > 0) setFormMarkers(data.markers)
    setAiSuccess(true)
  }, [])

  async function handleFileAnalyse(file: File) {
    setAiExtracting(true)
    setAiError('')
    setAiSuccess(false)

    const MAX_MB = 8
    if (file.size > MAX_MB * 1024 * 1024) {
      setAiError(`Filen er for stor (maks ${MAX_MB} MB). Komprimer bildet eller ta et screenshot.`)
      setAiExtracting(false)
      return
    }

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          // Strip data URL prefix to get raw base64
          resolve(result.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const result = await extractBloodTestFromFile(base64, file.type)
      if (result.ok) {
        applyExtracted(result.data)
      } else {
        setAiError(result.error)
      }
    } catch {
      setAiError('Noe gikk galt under analyse. Prøv igjen.')
    }
    setAiExtracting(false)
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return

      // Get group
      const { data: gm } = await sb
        .from('group_members')
        .select('group_id')
        .eq('profile_id', user.id)
        .limit(1)
        .single()
      if (!gm || !mounted) return

      setGroupId(gm.group_id)

      const { data } = await sb
        .from('rakel_blood_tests')
        .select('*')
        .eq('group_id', gm.group_id)
        .order('test_date', { ascending: false })

      if (mounted) {
        setTests((data || []) as BloodTest[])
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  function addMarkerRow(preset?: typeof COMMON_MARKERS[0]) {
    setFormMarkers(prev => [...prev, {
      marker: preset?.marker ?? '',
      value: 0,
      unit: preset?.unit ?? '',
      ref_min: preset?.ref_min ?? null,
      ref_max: preset?.ref_max ?? null,
    }])
  }

  function updateMarker(idx: number, field: keyof BloodMarker, val: string | number | null) {
    setFormMarkers(prev => prev.map((m, i) => i === idx ? { ...m, [field]: val } : m))
  }

  function removeMarker(idx: number) {
    setFormMarkers(prev => prev.filter((_, i) => i !== idx))
  }

  function applyPreset(idx: number, presetName: string) {
    const preset = COMMON_MARKERS.find(p => p.marker === presetName)
    if (!preset) return
    setFormMarkers(prev => prev.map((m, i) => i === idx ? {
      ...m, marker: preset.marker, unit: preset.unit,
      ref_min: preset.ref_min, ref_max: preset.ref_max,
    } : m))
  }

  async function handleSave() {
    if (!groupId) return
    setSaving(true)
    setSaveError('')

    const validMarkers = formMarkers.filter(m => m.marker.trim() && m.value > 0)
    if (validMarkers.length === 0) {
      setSaveError('Legg til minst én markør med verdi.')
      setSaving(false)
      return
    }

    const { data: { user } } = await sb.auth.getUser()
    const { data, error } = await sb.from('rakel_blood_tests').insert({
      group_id: groupId,
      test_date: formDate,
      institution: formInstitution || null,
      ordered_by: formOrderedBy || null,
      notes: formNotes || null,
      values: validMarkers,
      created_by: user?.id ?? null,
    }).select().single()

    if (error || !data) {
      setSaveError('Kunne ikke lagre. Prøv igjen.')
    } else {
      setTests(prev => [data as BloodTest, ...prev])
      setShowForm(false)
      setFormDate(new Date().toISOString().slice(0, 10))
      setFormInstitution('')
      setFormOrderedBy('')
      setFormNotes('')
      setFormMarkers([{ marker: 'Hemoglobin', value: 0, unit: 'g/dL', ref_min: 11.5, ref_max: 15.5 }])
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Slett denne blodprøven?')) return
    await sb.from('rakel_blood_tests').delete().eq('id', id)
    setTests(prev => prev.filter(t => t.id !== id))
  }

  // Build trend data: for each marker name, collect all values across tests (sorted by date asc)
  const trendMap = new Map<string, { date: string; value: number; ref_min: number | null; ref_max: number | null }[]>()
  const sortedByDate = [...tests].sort((a, b) => a.test_date.localeCompare(b.test_date))
  for (const test of sortedByDate) {
    for (const m of test.values) {
      const arr = trendMap.get(m.marker) || []
      arr.push({ date: test.test_date, value: m.value, ref_min: m.ref_min, ref_max: m.ref_max })
      trendMap.set(m.marker, arr)
    }
  }

  const fmtDate = (s: string) =>
    new Date(s + 'T12:00:00').toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })

  // Count anomalies in a test
  const countAnomalies = (t: BloodTest) =>
    t.values.filter(m => markerStatus(m) !== 'ok' && markerStatus(m) !== 'unknown').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        Laster blodprøver…
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-10 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1B3A5C] flex items-center gap-2">
            🩸 Blodprøver
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {tests.length} prøvetaking{tests.length !== 1 ? 'er' : ''} registrert
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="px-4 py-2 rounded-xl bg-[#1B3A5C] text-white text-sm font-semibold hover:bg-[#243f5e] transition"
        >
          {showForm ? '✕ Avbryt' : '+ Ny prøve'}
        </button>
      </div>

      {/* ── ADD FORM ── */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h2 className="font-bold text-slate-700">Registrer blodprøve</h2>

          {/* ── AI FILE IMPORT ── */}
          <div className={`rounded-xl border-2 border-dashed p-4 transition ${
            aiSuccess ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-slate-50'
          }`}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  🤖 Analyser laboratorieresultat med AI
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Last opp bilde (JPEG, PNG) eller PDF av prøvesvaret — AI trekker ut alle verdier automatisk
                </p>
              </div>
              <label className={`flex-shrink-0 cursor-pointer px-3 py-2 rounded-lg text-sm font-semibold transition ${
                aiExtracting
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-[#1B3A5C] text-white hover:bg-[#243f5e]'
              }`}>
                {aiExtracting ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                    </svg>
                    Analyserer…
                  </span>
                ) : aiSuccess ? '📎 Analyser ny fil' : '📎 Velg fil'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  disabled={aiExtracting}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleFileAnalyse(file)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>

            {aiError && (
              <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">⚠ {aiError}</p>
            )}
            {aiSuccess && (
              <p className="mt-2 text-xs text-green-700 font-medium">
                ✓ Verdier hentet fra fil — kontroller og lagre nedenfor
              </p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Dato</label>
              <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Institusjon</label>
              <input type="text" value={formInstitution} onChange={e => setFormInstitution(e.target.value)}
                placeholder="f.eks. Sørlandet Sykehus HF"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Rekvirert av</label>
              <input type="text" value={formOrderedBy} onChange={e => setFormOrderedBy(e.target.value)}
                placeholder="f.eks. BUP Egersund"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Notater</label>
              <input type="text" value={formNotes} onChange={e => setFormNotes(e.target.value)}
                placeholder="Valgfritt notat"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Markers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Verdier</span>
            </div>

            <div className="space-y-2">
              {formMarkers.map((m, idx) => (
                <div key={idx} className="flex gap-2 items-start flex-wrap sm:flex-nowrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex gap-1.5">
                      <select
                        value={COMMON_MARKERS.find(p => p.marker === m.marker) ? m.marker : '__custom__'}
                        onChange={e => {
                          if (e.target.value !== '__custom__') applyPreset(idx, e.target.value)
                          else updateMarker(idx, 'marker', '')
                        }}
                        className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white"
                      >
                        <option value="__custom__">Egendefinert</option>
                        {COMMON_MARKERS.map(p => (
                          <option key={p.marker} value={p.marker}>{p.marker}</option>
                        ))}
                      </select>
                      {!COMMON_MARKERS.find(p => p.marker === m.marker) && (
                        <input type="text" value={m.marker} onChange={e => updateMarker(idx, 'marker', e.target.value)}
                          placeholder="Markørnavn" className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs flex-1" />
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1.5 flex-shrink-0 items-center">
                    <input type="number" step="any" value={m.value || ''}
                      onChange={e => updateMarker(idx, 'value', parseFloat(e.target.value) || 0)}
                      placeholder="Verdi" className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
                    <input type="text" value={m.unit}
                      onChange={e => updateMarker(idx, 'unit', e.target.value)}
                      placeholder="Enhet" className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
                    <input type="number" step="any" value={m.ref_min ?? ''}
                      onChange={e => updateMarker(idx, 'ref_min', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="Min" className="w-14 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-green-50" title="Referanse min" />
                    <input type="number" step="any" value={m.ref_max ?? ''}
                      onChange={e => updateMarker(idx, 'ref_max', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="Max" className="w-14 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-red-50" title="Referanse max" />
                    <button onClick={() => removeMarker(idx)}
                      className="text-slate-400 hover:text-red-500 text-sm px-1">✕</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-3 flex-wrap">
              <button onClick={() => addMarkerRow()}
                className="text-xs text-brand-600 border border-brand-300 rounded-lg px-3 py-1.5 hover:bg-brand-50 transition">
                + Egendefinert
              </button>
              {COMMON_MARKERS.slice(0, 6).map(p => (
                <button key={p.marker}
                  onClick={() => addMarkerRow(p)}
                  className="text-xs text-slate-600 border border-slate-200 rounded-lg px-2 py-1.5 hover:bg-slate-50 transition">
                  + {p.marker}
                </button>
              ))}
            </div>
          </div>

          {saveError && <p className="text-sm text-red-600">{saveError}</p>}

          <button onClick={handleSave} disabled={saving}
            className="w-full py-2.5 bg-[#1B3A5C] text-white rounded-xl font-semibold text-sm hover:bg-[#243f5e] disabled:opacity-50 transition">
            {saving ? 'Lagrer…' : '💾 Lagre prøve'}
          </button>
        </div>
      )}

      {/* ── TABS ── */}
      {tests.length > 0 && (
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          {(['history', 'trends'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                activeTab === tab ? 'bg-white shadow text-[#1B3A5C]' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {tab === 'history' ? '📋 Historikk' : '📈 Trender'}
            </button>
          ))}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {tests.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <div className="text-4xl mb-2">🩸</div>
              <p className="font-medium">Ingen blodprøver registrert ennå</p>
              <p className="text-sm mt-1">Klikk «+ Ny prøve» for å legge inn første prøvetaking</p>
            </div>
          )}

          {tests.map(test => {
            const anomalies = countAnomalies(test)
            const isExpanded = expandedId === test.id
            return (
              <div key={test.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                {/* Test header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : test.id)}
                  className="w-full text-left p-4 flex items-center gap-4 hover:bg-slate-50 transition"
                >
                  <div className="text-center bg-blue-50 rounded-xl px-3 py-2 flex-shrink-0">
                    <div className="text-lg font-black text-[#1B3A5C] leading-none">
                      {new Date(test.test_date + 'T12:00:00').getDate()}
                    </div>
                    <div className="text-[10px] uppercase text-slate-500">
                      {new Date(test.test_date + 'T12:00:00').toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800">
                        {test.institution || 'Blodprøve'}
                      </span>
                      {test.ordered_by && (
                        <span className="text-xs text-slate-500">· {test.ordered_by}</span>
                      )}
                      {anomalies > 0 && (
                        <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          ⚠ {anomalies} utenfor ref.
                        </span>
                      )}
                    </div>
                    {/* Mini preview of markers */}
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      {test.values.slice(0, 4).map((m, i) => (
                        <StatusBadge key={i} status={markerStatus(m)} value={m.value} unit={m.unit} />
                      ))}
                      {test.values.length > 4 && (
                        <span className="text-xs text-slate-400">+{test.values.length - 4} til</span>
                      )}
                    </div>
                  </div>
                  <span className="text-slate-400 flex-shrink-0">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                    {test.notes && (
                      <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-2">{test.notes}</p>
                    )}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 uppercase tracking-wide">
                          <th className="text-left pb-1">Markør</th>
                          <th className="text-right pb-1">Verdi</th>
                          <th className="text-right pb-1">Referanse</th>
                          <th className="text-right pb-1">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {test.values.map((m, i) => {
                          const st = markerStatus(m)
                          const refStr = m.ref_min !== null && m.ref_max !== null
                            ? `${m.ref_min}–${m.ref_max}`
                            : m.ref_max !== null ? `< ${m.ref_max}`
                            : m.ref_min !== null ? `> ${m.ref_min}` : '—'

                          // Trend for this marker
                          const history = trendMap.get(m.marker) || []
                          const vals = history.map(h => h.value)

                          return (
                            <tr key={i} className={st === 'high' ? 'bg-red-50/50' : st === 'low' ? 'bg-blue-50/50' : ''}>
                              <td className="py-1.5 font-medium">
                                {m.marker}
                                {vals.length >= 2 && (
                                  <span className="ml-2 align-middle">
                                    <Sparkline values={vals} refMin={m.ref_min} refMax={m.ref_max} />
                                  </span>
                                )}
                              </td>
                              <td className="text-right font-bold tabular-nums">
                                {m.value} {m.unit}
                              </td>
                              <td className="text-right text-slate-500 text-xs">{refStr} {m.unit}</td>
                              <td className="text-right">
                                {st === 'low'  && <span className="text-blue-600 font-bold text-xs">▼ Lav</span>}
                                {st === 'high' && <span className="text-red-600 font-bold text-xs">▲ Høy</span>}
                                {st === 'ok'   && <span className="text-green-600 font-bold text-xs">✓ OK</span>}
                                {st === 'unknown' && <span className="text-slate-400 text-xs">—</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <div className="flex justify-end">
                      <button onClick={() => handleDelete(test.id)}
                        className="text-xs text-slate-400 hover:text-red-600 transition">
                        Slett prøve
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── TRENDS TAB ── */}
      {activeTab === 'trends' && (
        <div className="space-y-4">
          {trendMap.size === 0 && (
            <p className="text-slate-400 text-sm text-center py-8">Ingen data å vise trender for.</p>
          )}
          {Array.from(trendMap.entries()).map(([marker, history]) => {
            const latest = history[history.length - 1]
            const st = markerStatus(latest)
            const vals = history.map(h => h.value)
            const min = Math.min(...vals)
            const max = Math.max(...vals)
            const refMin = latest.ref_min
            const refMax = latest.ref_max
            const W = 320, H = 80

            const allY = [...vals]
            if (refMin !== null) allY.push(refMin)
            if (refMax !== null) allY.push(refMax)
            const domMin = Math.min(...allY) * 0.92
            const domMax = Math.max(...allY) * 1.08
            const domRange = domMax - domMin || 1

            const toX = (i: number) => (i / Math.max(history.length - 1, 1)) * W
            const toY = (v: number) => H - ((v - domMin) / domRange) * H

            const pts = vals.map((v, i) => `${toX(i)},${toY(v)}`).join(' ')

            return (
              <div key={marker} className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-bold text-slate-800">{marker}</span>
                    <span className="text-xs text-slate-500 ml-2">({latest.unit})</span>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={st} value={latest.value} unit={latest.unit} />
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Siste: {fmtDate(latest.date)}
                    </div>
                  </div>
                </div>

                {/* SVG chart */}
                <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
                  {/* Reference band */}
                  {refMin !== null && refMax !== null && (
                    <rect
                      x={0} width={W}
                      y={toY(refMax)} height={toY(refMin) - toY(refMax)}
                      fill="#86efac" fillOpacity={0.15}
                    />
                  )}
                  {refMin !== null && (
                    <line x1={0} x2={W} y1={toY(refMin)} y2={toY(refMin)}
                      stroke="#16a34a" strokeWidth={1} strokeDasharray="4" />
                  )}
                  {refMax !== null && (
                    <line x1={0} x2={W} y1={toY(refMax)} y2={toY(refMax)}
                      stroke="#dc2626" strokeWidth={1} strokeDasharray="4" />
                  )}
                  {/* Line */}
                  {vals.length > 1 && (
                    <polyline fill="none" stroke="#1B3A5C" strokeWidth={2.5} points={pts} />
                  )}
                  {/* Points + labels */}
                  {history.map((h, i) => {
                    const x = toX(i)
                    const y = toY(h.value)
                    const ok = (refMin === null || h.value >= refMin) && (refMax === null || h.value <= refMax)
                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r={5} fill={ok ? '#16a34a' : '#dc2626'} />
                        <text x={x} y={y - 8} textAnchor="middle" fontSize={9} fill="#374151">
                          {h.value}
                        </text>
                        <text x={x} y={H + 12} textAnchor="middle" fontSize={8} fill="#9ca3af">
                          {new Date(h.date + 'T12:00:00').toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
                        </text>
                      </g>
                    )
                  })}
                </svg>

                <div className="flex gap-4 mt-2 text-xs text-slate-500">
                  <span>Min: <strong>{min}</strong></span>
                  <span>Max: <strong>{max}</strong></span>
                  {refMin !== null && <span className="text-green-600">Ref min: {refMin}</span>}
                  {refMax !== null && <span className="text-red-600">Ref max: {refMax}</span>}
                  <span>{history.length} målinger</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
