'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  extractBloodTestFromFile,
  ExtractedBloodTest,
  BloodTestSession,
  BloodMarkerExtracted,
} from '@/lib/actions/extract_blood_test'
import {
  analyzeBloodTrends,
  BloodAnalysis,
  UrgencyLevel,
} from '@/lib/actions/analyze_blood_trends'

// ── Types ──────────────────────────────────────────────────────────────────────
interface BloodMarker {
  marker:  string
  value:   number
  unit:    string
  ref_min: number | null
  ref_max: number | null
}

interface BloodTest {
  id:          string
  test_date:   string
  institution: string | null
  ordered_by:  string | null
  notes:       string | null
  values:      BloodMarker[]
  created_at:  string
}

// Common markers with typical reference ranges for manual add
const COMMON_MARKERS = [
  { marker: 'B-Hemoglobin',         unit: 'g/dL',   ref_min: 11.5, ref_max: 15.5 },
  { marker: 'S-Ferritin',           unit: 'µg/L',   ref_min: 10,   ref_max: 170 },
  { marker: 'B-Leukocytter (LPK)',  unit: 'G/L',    ref_min: 4.5,  ref_max: 14.0 },
  { marker: 'B-Trombocytter (TPK)', unit: 'G/L',    ref_min: 145,  ref_max: 390 },
  { marker: 'S-Vitamin B12',        unit: 'pmol/L', ref_min: 150,  ref_max: 820 },
  { marker: 'P-Folat',              unit: 'nmol/L', ref_min: 6,    ref_max: null },
  { marker: 'Vitamin D (25-OH)',     unit: 'nmol/L', ref_min: 50,   ref_max: 150 },
  { marker: 'S-TSH',                unit: 'mIE/L',  ref_min: 0.5,  ref_max: 4.9 },
  { marker: 'CRP',                  unit: 'mg/L',   ref_min: null, ref_max: 5 },
  { marker: 'S-Kreatinin',          unit: 'µmol/L', ref_min: 40,   ref_max: 70 },
]

function markerStatus(m: BloodMarker | BloodMarkerExtracted): 'low' | 'high' | 'ok' | 'unknown' {
  if (m.ref_min === null && m.ref_max === null) return 'unknown'
  if (m.ref_min !== null && m.value < m.ref_min) return 'low'
  if (m.ref_max !== null && m.value > m.ref_max) return 'high'
  return 'ok'
}

function StatusBadge({ status, value, unit }: { status: string; value: number; unit: string }) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold'
  if (status === 'low')  return <span className={`${base} bg-blue-100 text-blue-700`}>▼ {value} {unit}</span>
  if (status === 'high') return <span className={`${base} bg-red-100 text-red-700`}>▲ {value} {unit}</span>
  if (status === 'ok')   return <span className={`${base} bg-green-100 text-green-700`}>✓ {value} {unit}</span>
  return <span className={`${base} bg-slate-100 text-slate-600`}>{value} {unit}</span>
}

// Date formatting helpers
function fmtDateShort(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('nb-NO', {
    day: 'numeric', month: 'short', year: '2-digit',
  })
}
function fmtDateLong(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('nb-NO', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

// Mini sparkline with year-aware axis labels
function Sparkline({ history, refMin, refMax }: {
  history: { date: string; value: number }[]
  refMin: number | null
  refMax: number | null
}) {
  if (history.length < 2) return null
  const vals = history.map(h => h.value)
  const allY = [...vals]
  if (refMin !== null) allY.push(refMin)
  if (refMax !== null) allY.push(refMax)
  const domMin = Math.min(...allY) * 0.92
  const domMax = Math.max(...allY) * 1.08
  const domRange = domMax - domMin || 1
  const W = 90, H = 30
  const toX = (i: number) => (i / (history.length - 1)) * W
  const toY = (v: number) => H - ((v - domMin) / domRange) * H
  const pts = vals.map((v, i) => `${toX(i)},${toY(v)}`).join(' ')

  return (
    <svg width={W} height={H} className="inline-block align-middle">
      {refMin !== null && (
        <line x1={0} x2={W} y1={toY(refMin)} y2={toY(refMin)} stroke="#86efac" strokeWidth={1} strokeDasharray="2" />
      )}
      {refMax !== null && (
        <line x1={0} x2={W} y1={toY(refMax)} y2={toY(refMax)} stroke="#fca5a5" strokeWidth={1} strokeDasharray="2" />
      )}
      <polyline fill="none" stroke="#1B3A5C" strokeWidth={2} points={pts} />
      {history.map((h, i) => {
        const ok = (refMin === null || h.value >= refMin) && (refMax === null || h.value <= refMax)
        return <circle key={i} cx={toX(i)} cy={toY(h.value)} r={3} fill={ok ? '#16a34a' : '#dc2626'} />
      })}
    </svg>
  )
}

// ── Preview component for AI-extracted sessions ────────────────────────────────
function SessionPreview({
  session, institution, selected, onToggle,
}: {
  session: BloodTestSession
  institution: string | null
  selected: boolean
  onToggle: () => void
}) {
  const anomalies = session.markers.filter(m => {
    const st = markerStatus(m)
    return st === 'low' || st === 'high'
  }).length

  return (
    <div
      className={`rounded-xl border-2 p-3 cursor-pointer transition ${
        selected ? 'border-[#1B3A5C] bg-blue-50' : 'border-slate-200 bg-white'
      }`}
      onClick={onToggle}
    >
      <div className="flex items-center gap-3">
        <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center ${
          selected ? 'bg-[#1B3A5C] border-[#1B3A5C]' : 'border-slate-300'
        }`}>
          {selected && <span className="text-white text-xs">✓</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-800">{fmtDateLong(session.test_date)}</span>
            <span className="text-xs text-slate-500">{session.markers.length} markører</span>
            {anomalies > 0 && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                ⚠ {anomalies} utenfor ref.
              </span>
            )}
          </div>
          <div className="flex gap-1 mt-1 flex-wrap">
            {session.markers.slice(0, 5).map((m, i) => {
              const st = markerStatus(m)
              return (
                <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  st === 'high' ? 'bg-red-100 text-red-700'
                  : st === 'low' ? 'bg-blue-100 text-blue-700'
                  : 'bg-green-100 text-green-700'
                }`}>
                  {m.marker}: {m.value} {m.unit}
                </span>
              )
            })}
            {session.markers.length > 5 && (
              <span className="text-[10px] text-slate-400">+{session.markers.length - 5}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BlodproverPage() {
  const sb = createClient()
  const [tests, setTests] = useState<BloodTest[]>([])
  const [groupId, setGroupId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'history' | 'trends' | 'analyse'>('history')
  const [analysis, setAnalysis] = useState<BloodAnalysis | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState('')

  // Manual form state
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10))
  const [formInstitution, setFormInstitution] = useState('')
  const [formOrderedBy, setFormOrderedBy] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formMarkers, setFormMarkers] = useState<BloodMarker[]>([
    { marker: 'B-Hemoglobin', value: 0, unit: 'g/dL', ref_min: 11.5, ref_max: 15.5 },
  ])
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editInstitution, setEditInstitution] = useState('')
  const [editOrderedBy, setEditOrderedBy] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editMarkers, setEditMarkers] = useState<BloodMarker[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // AI import state
  const [aiExtracting, setAiExtracting] = useState(false)
  const [aiError, setAiError] = useState('')
  const [extracted, setExtracted] = useState<ExtractedBloodTest | null>(null)
  const [selectedSessions, setSelectedSessions] = useState<Set<number>>(new Set())
  const [importingAi, setImportingAi] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      const { data: gm } = await sb
        .from('group_members').select('group_id')
        .eq('profile_id', user.id).limit(1).single()
      if (!gm || !mounted) return
      setGroupId(gm.group_id)
      const { data } = await sb
        .from('rakel_blood_tests').select('*')
        .eq('group_id', gm.group_id)
        .order('test_date', { ascending: false })
      if (!mounted) return
      setTests((data || []) as BloodTest[])
      setLoading(false)

      // Load saved analysis
      const { data: saved } = await sb
        .from('rakel_blood_analysis')
        .select('analysis')
        .eq('group_id', gm.group_id)
        .maybeSingle()
      if (saved?.analysis && mounted) setAnalysis(saved.analysis as BloodAnalysis)
    })()
    return () => { mounted = false }
  }, [])

  async function runAnalysis() {
    if (!groupId || tests.length === 0) return
    setAnalysisLoading(true)
    setAnalysisError('')
    const result = await analyzeBloodTrends(tests, groupId)
    if (result.ok) {
      setAnalysis(result.data)
      setActiveTab('analyse')
    } else {
      setAnalysisError(result.error)
    }
    setAnalysisLoading(false)
  }

  // ── AI file import ───────────────────────────────────────────────────────
  async function handleFileAnalyse(file: File) {
    setAiExtracting(true)
    setAiError('')
    setExtracted(null)
    setSelectedSessions(new Set())

    if (file.size > 10 * 1024 * 1024) {
      setAiError('Filen er for stor (maks 10 MB).')
      setAiExtracting(false)
      return
    }
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const result = await extractBloodTestFromFile(base64, file.type)
      if (result.ok) {
        setExtracted(result.data)
        setSelectedSessions(new Set(result.data.sessions.map((_, i) => i)))
      } else {
        setAiError(result.error)
      }
    } catch {
      setAiError('Noe gikk galt. Prøv igjen.')
    }
    setAiExtracting(false)
  }

  async function handleImportSessions() {
    if (!groupId || !extracted) return
    setImportingAi(true)
    const { data: { user } } = await sb.auth.getUser()
    const toImport = extracted.sessions.filter((_, i) => selectedSessions.has(i))
    const inserts = toImport.map(s => ({
      group_id:    groupId,
      test_date:   s.test_date,
      institution: extracted.institution ?? null,
      ordered_by:  extracted.ordered_by ?? null,
      notes:       extracted.notes ?? null,
      values:      s.markers,
      created_by:  user?.id ?? null,
    }))
    const { data, error } = await sb.from('rakel_blood_tests').insert(inserts).select()
    if (!error && data) {
      setTests(prev => {
        const next = [...(data as BloodTest[]), ...prev]
        next.sort((a, b) => b.test_date.localeCompare(a.test_date))
        return next
      })
      setExtracted(null)
      setSelectedSessions(new Set())
      setShowForm(false)
    }
    setImportingAi(false)
  }

  function toggleSession(i: number) {
    setSelectedSessions(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  // ── Manual form helpers ──────────────────────────────────────────────────
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

  function applyPreset(idx: number, name: string) {
    const preset = COMMON_MARKERS.find(p => p.marker === name)
    if (!preset) return
    setFormMarkers(prev => prev.map((m, i) =>
      i === idx ? { ...m, marker: preset.marker, unit: preset.unit, ref_min: preset.ref_min, ref_max: preset.ref_max } : m
    ))
  }

  async function handleSave() {
    if (!groupId) return
    setSaving(true)
    setSaveError('')
    const valid = formMarkers.filter(m => m.marker.trim() && m.value > 0)
    if (valid.length === 0) { setSaveError('Legg til minst én markør med verdi.'); setSaving(false); return }
    const { data: { user } } = await sb.auth.getUser()
    const { data, error } = await sb.from('rakel_blood_tests').insert({
      group_id: groupId, test_date: formDate,
      institution: formInstitution || null, ordered_by: formOrderedBy || null,
      notes: formNotes || null, values: valid, created_by: user?.id ?? null,
    }).select().single()
    if (!error && data) {
      setTests(prev => [data as BloodTest, ...prev])
      setShowForm(false)
      setFormDate(new Date().toISOString().slice(0, 10))
      setFormInstitution(''); setFormOrderedBy(''); setFormNotes('')
      setFormMarkers([{ marker: 'B-Hemoglobin', value: 0, unit: 'g/dL', ref_min: 11.5, ref_max: 15.5 }])
    } else {
      setSaveError('Kunne ikke lagre. Prøv igjen.')
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Slett denne blodprøven?')) return
    await sb.from('rakel_blood_tests').delete().eq('id', id)
    setTests(prev => prev.filter(t => t.id !== id))
    if (editingId === id) setEditingId(null)
  }

  function startEdit(test: BloodTest) {
    setEditingId(test.id)
    setEditDate(test.test_date)
    setEditInstitution(test.institution ?? '')
    setEditOrderedBy(test.ordered_by ?? '')
    setEditNotes(test.notes ?? '')
    setEditMarkers(test.values.map(m => ({ ...m })))
    setEditError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError('')
  }

  function updateEditMarker(idx: number, field: keyof BloodMarker, val: string | number | null) {
    setEditMarkers(prev => prev.map((m, i) => i === idx ? { ...m, [field]: val } : m))
  }

  function removeEditMarker(idx: number) {
    setEditMarkers(prev => prev.filter((_, i) => i !== idx))
  }

  function addEditMarker() {
    setEditMarkers(prev => [...prev, { marker: '', value: 0, unit: '', ref_min: null, ref_max: null }])
  }

  async function handleSaveEdit() {
    if (!editingId) return
    setEditSaving(true)
    setEditError('')
    const valid = editMarkers.filter(m => m.marker.trim())
    if (valid.length === 0) { setEditError('Minst én markør må ha navn.'); setEditSaving(false); return }
    const { data, error } = await sb
      .from('rakel_blood_tests')
      .update({
        test_date:   editDate,
        institution: editInstitution || null,
        ordered_by:  editOrderedBy || null,
        notes:       editNotes || null,
        values:      valid,
      })
      .eq('id', editingId)
      .select()
      .single()
    if (!error && data) {
      setTests(prev => prev.map(t => t.id === editingId ? data as BloodTest : t))
      setEditingId(null)
    } else {
      setEditError('Kunne ikke lagre. Prøv igjen.')
    }
    setEditSaving(false)
  }

  // Build trend data across all tests
  const trendMap = new Map<string, { date: string; value: number; ref_min: number | null; ref_max: number | null }[]>()
  const sortedByDate = [...tests].sort((a, b) => a.test_date.localeCompare(b.test_date))
  for (const test of sortedByDate) {
    for (const m of test.values) {
      const arr = trendMap.get(m.marker) || []
      arr.push({ date: test.test_date, value: m.value, ref_min: m.ref_min, ref_max: m.ref_max })
      trendMap.set(m.marker, arr)
    }
  }

  const countAnomalies = (t: BloodTest) =>
    t.values.filter(m => markerStatus(m) !== 'ok' && markerStatus(m) !== 'unknown').length

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Laster blodprøver…</div>
  )

  return (
    <div className="space-y-5 pb-10 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1B3A5C] flex items-center gap-2">🩸 Blodprøver</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {tests.length} prøvetaking{tests.length !== 1 ? 'er' : ''} registrert
          </p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setExtracted(null); setAiError('') }}
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
            extracted ? 'border-[#1B3A5C] bg-blue-50' : 'border-slate-200 bg-slate-50'
          }`}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700">🤖 Analyser laboratorieresultat med AI</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Last opp bilde (JPEG/PNG) eller PDF — AI trekker ut alle datoer og verdier automatisk
                </p>
              </div>
              <label className={`flex-shrink-0 cursor-pointer px-3 py-2 rounded-lg text-sm font-semibold transition ${
                aiExtracting ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-[#1B3A5C] text-white hover:bg-[#243f5e]'
              }`}>
                {aiExtracting ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                    </svg>
                    Analyserer…
                  </span>
                ) : extracted ? '📎 Analyser ny fil' : '📎 Velg fil'}
                <input
                  ref={fileInputRef} type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden" disabled={aiExtracting}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileAnalyse(f); e.target.value = '' }}
                />
              </label>
            </div>

            {aiError && (
              <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">⚠ {aiError}</p>
            )}

            {/* Multi-session preview */}
            {extracted && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#1B3A5C]">
                    {extracted.sessions.length} prøvedato{extracted.sessions.length !== 1 ? 'er' : ''} funnet
                    {extracted.institution && ` · ${extracted.institution}`}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedSessions(new Set(extracted.sessions.map((_, i) => i)))}
                      className="text-xs text-brand-600 hover:underline"
                    >Velg alle</button>
                    <button
                      onClick={() => setSelectedSessions(new Set())}
                      className="text-xs text-slate-400 hover:underline"
                    >Ingen</button>
                  </div>
                </div>

                {extracted.sessions.map((s, i) => (
                  <SessionPreview
                    key={i} session={s}
                    institution={extracted.institution}
                    selected={selectedSessions.has(i)}
                    onToggle={() => toggleSession(i)}
                  />
                ))}

                <button
                  onClick={handleImportSessions}
                  disabled={selectedSessions.size === 0 || importingAi}
                  className="w-full py-2.5 bg-[#1B3A5C] text-white rounded-xl font-semibold text-sm
                             hover:bg-[#243f5e] disabled:opacity-50 transition mt-1"
                >
                  {importingAi
                    ? 'Importerer…'
                    : `💾 Importer ${selectedSessions.size} prøvedato${selectedSessions.size !== 1 ? 'er' : ''}`}
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">eller fyll inn manuelt</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Manual fields */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Dato</label>
              <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Institusjon</label>
              <input type="text" value={formInstitution} onChange={e => setFormInstitution(e.target.value)}
                placeholder="f.eks. Flekkefjord legesenter"
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

          {/* Marker rows */}
          <div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Verdier</span>
            <div className="space-y-2 mt-2">
              {formMarkers.map((m, idx) => (
                <div key={idx} className="flex gap-2 items-start flex-wrap sm:flex-nowrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex gap-1.5">
                      <select
                        value={COMMON_MARKERS.find(p => p.marker === m.marker) ? m.marker : '__custom__'}
                        onChange={e => e.target.value !== '__custom__' ? applyPreset(idx, e.target.value) : updateMarker(idx, 'marker', '')}
                        className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white"
                      >
                        <option value="__custom__">Egendefinert</option>
                        {COMMON_MARKERS.map(p => <option key={p.marker} value={p.marker}>{p.marker}</option>)}
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
                    <input type="text" value={m.unit} onChange={e => updateMarker(idx, 'unit', e.target.value)}
                      placeholder="Enhet" className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
                    <input type="number" step="any" value={m.ref_min ?? ''}
                      onChange={e => updateMarker(idx, 'ref_min', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="Min" className="w-14 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-green-50" title="Ref. min" />
                    <input type="number" step="any" value={m.ref_max ?? ''}
                      onChange={e => updateMarker(idx, 'ref_max', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="Max" className="w-14 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-red-50" title="Ref. max" />
                    <button onClick={() => setFormMarkers(prev => prev.filter((_, i) => i !== idx))}
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
                <button key={p.marker} onClick={() => addMarkerRow(p)}
                  className="text-xs text-slate-600 border border-slate-200 rounded-lg px-2 py-1.5 hover:bg-slate-50 transition">
                  + {p.marker}
                </button>
              ))}
            </div>
          </div>

          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          <button onClick={handleSave} disabled={saving}
            className="w-full py-2.5 bg-slate-700 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 disabled:opacity-50 transition">
            {saving ? 'Lagrer…' : '💾 Lagre manuell prøve'}
          </button>
        </div>
      )}

      {/* ── TABS + ANALYSE BUTTON ── */}
      {tests.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            {(['history', 'trends', 'analyse'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                  activeTab === tab ? 'bg-white shadow text-[#1B3A5C]' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {tab === 'history' ? '📋 Historikk' : tab === 'trends' ? '📈 Trender' : '🔬 Analyse'}
              </button>
            ))}
          </div>
          <button
            onClick={runAnalysis}
            disabled={analysisLoading || tests.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition ${
              analysisLoading
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-violet-600 text-white hover:bg-violet-700'
            }`}
          >
            {analysisLoading ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                </svg>
                Analyserer…
              </>
            ) : (
              <>🤖 {analysis ? 'Oppdater analyse' : 'Analyser trender'}</>
            )}
          </button>
          {analysisError && <p className="text-xs text-red-600">{analysisError}</p>}
        </div>
      )}

      {/* ── HISTORY ── */}
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
                <button
                  onClick={() => setExpandedId(isExpanded ? null : test.id)}
                  className="w-full text-left p-4 flex items-center gap-4 hover:bg-slate-50 transition"
                >
                  {/* Date tile */}
                  <div className="text-center bg-blue-50 rounded-xl px-3 py-2 flex-shrink-0 min-w-[52px]">
                    <div className="text-lg font-black text-[#1B3A5C] leading-none">
                      {new Date(test.test_date + 'T12:00:00').getDate()}
                    </div>
                    <div className="text-[10px] uppercase text-slate-500 leading-tight">
                      {new Date(test.test_date + 'T12:00:00').toLocaleDateString('nb-NO', { month: 'short' })}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400">
                      {new Date(test.test_date + 'T12:00:00').getFullYear()}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800">{test.institution || 'Blodprøve'}</span>
                      {test.ordered_by && <span className="text-xs text-slate-500">· {test.ordered_by}</span>}
                      {anomalies > 0 && (
                        <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          ⚠ {anomalies} utenfor ref.
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      {test.values.slice(0, 4).map((m, i) => (
                        <StatusBadge key={i} status={markerStatus(m)} value={m.value} unit={m.unit} />
                      ))}
                      {test.values.length > 4 && (
                        <span className="text-xs text-slate-400">+{test.values.length - 4} til</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(test.id) }}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition"
                      title="Slett prøve"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                      </svg>
                    </button>
                    <span className="text-slate-400">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </button>

                {isExpanded && editingId !== test.id && (
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
                          const history = trendMap.get(m.marker) || []
                          return (
                            <tr key={i} className={st === 'high' ? 'bg-red-50/50' : st === 'low' ? 'bg-blue-50/50' : ''}>
                              <td className="py-1.5 font-medium">
                                {m.marker}
                                {history.length >= 2 && (
                                  <span className="ml-2 align-middle">
                                    <Sparkline history={history.map(h => ({ date: h.date, value: h.value }))}
                                      refMin={m.ref_min} refMax={m.ref_max} />
                                  </span>
                                )}
                              </td>
                              <td className="text-right font-bold tabular-nums">{m.value} {m.unit}</td>
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
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => { startEdit(test); setExpandedId(test.id) }}
                        className="text-xs font-semibold text-[#1B3A5C] hover:underline flex items-center gap-1"
                      >
                        ✏️ Rediger verdier
                      </button>
                      <button onClick={() => handleDelete(test.id)}
                        className="text-xs text-slate-400 hover:text-red-600 transition">Slett prøve</button>
                    </div>
                  </div>
                )}

                {/* ── EDIT MODE ── */}
                {editingId === test.id && (
                  <div className="border-t border-blue-200 bg-blue-50/40 px-4 pb-4 pt-3 space-y-3">
                    <p className="text-xs font-bold text-[#1B3A5C] uppercase tracking-wider">Rediger prøve</p>

                    {/* Metadata */}
                    <div className="grid sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Dato</label>
                        <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Institusjon</label>
                        <input type="text" value={editInstitution} onChange={e => setEditInstitution(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Rekvirert av</label>
                        <input type="text" value={editOrderedBy} onChange={e => setEditOrderedBy(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Notater</label>
                        <input type="text" value={editNotes} onChange={e => setEditNotes(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white" />
                      </div>
                    </div>

                    {/* Editable marker rows */}
                    <div>
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Verdier</p>
                      <div className="space-y-1.5">
                        {editMarkers.map((m, idx) => (
                          <div key={idx} className="flex gap-1.5 items-center flex-wrap sm:flex-nowrap bg-white rounded-lg p-2 border border-slate-200">
                            <input
                              type="text" value={m.marker}
                              onChange={e => updateEditMarker(idx, 'marker', e.target.value)}
                              placeholder="Markørnavn"
                              className="flex-1 min-w-[120px] border border-slate-200 rounded px-2 py-1 text-xs"
                            />
                            <input
                              type="number" step="any" value={m.value || ''}
                              onChange={e => updateEditMarker(idx, 'value', parseFloat(e.target.value) || 0)}
                              placeholder="Verdi"
                              className="w-18 border border-slate-200 rounded px-2 py-1 text-xs w-16"
                            />
                            <input
                              type="text" value={m.unit}
                              onChange={e => updateEditMarker(idx, 'unit', e.target.value)}
                              placeholder="Enhet"
                              className="w-14 border border-slate-200 rounded px-2 py-1 text-xs"
                            />
                            <input
                              type="number" step="any" value={m.ref_min ?? ''}
                              onChange={e => updateEditMarker(idx, 'ref_min', e.target.value ? parseFloat(e.target.value) : null)}
                              placeholder="Min"
                              className="w-12 border border-green-200 rounded px-2 py-1 text-xs bg-green-50"
                              title="Referanse min"
                            />
                            <input
                              type="number" step="any" value={m.ref_max ?? ''}
                              onChange={e => updateEditMarker(idx, 'ref_max', e.target.value ? parseFloat(e.target.value) : null)}
                              placeholder="Max"
                              className="w-12 border border-red-200 rounded px-2 py-1 text-xs bg-red-50"
                              title="Referanse max"
                            />
                            <button
                              onClick={() => removeEditMarker(idx)}
                              className="text-slate-300 hover:text-red-500 transition px-1 flex-shrink-0"
                              title="Fjern markør"
                            >✕</button>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={addEditMarker}
                        className="mt-2 text-xs text-brand-600 border border-brand-200 rounded-lg px-3 py-1.5 hover:bg-brand-50 transition"
                      >
                        + Legg til markør
                      </button>
                    </div>

                    {editError && <p className="text-xs text-red-600">{editError}</p>}

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleSaveEdit} disabled={editSaving}
                        className="flex-1 py-2 bg-[#1B3A5C] text-white rounded-xl text-sm font-semibold hover:bg-[#243f5e] disabled:opacity-50 transition"
                      >
                        {editSaving ? 'Lagrer…' : '💾 Lagre endringer'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition"
                      >
                        Avbryt
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── TRENDS ── */}
      {activeTab === 'trends' && (
        <div className="space-y-4">
          {trendMap.size === 0 && (
            <p className="text-slate-400 text-sm text-center py-8">Ingen data å vise trender for.</p>
          )}
          {Array.from(trendMap.entries()).map(([marker, history]) => {
            const latest = history[history.length - 1]
            const st = markerStatus(latest)
            const vals = history.map(h => h.value)
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
                    <div className="text-[10px] text-slate-400 mt-0.5">Siste: {fmtDateShort(latest.date)}</div>
                  </div>
                </div>

                {/* SVG chart with year on x-axis */}
                <svg width="100%" viewBox={`-2 0 ${W + 4} ${H + 24}`} className="overflow-visible">
                  {refMin !== null && refMax !== null && (
                    <rect x={0} width={W} y={toY(refMax)} height={toY(refMin) - toY(refMax)}
                      fill="#86efac" fillOpacity={0.15} />
                  )}
                  {refMin !== null && (
                    <line x1={0} x2={W} y1={toY(refMin)} y2={toY(refMin)}
                      stroke="#16a34a" strokeWidth={1} strokeDasharray="4" />
                  )}
                  {refMax !== null && (
                    <line x1={0} x2={W} y1={toY(refMax)} y2={toY(refMax)}
                      stroke="#dc2626" strokeWidth={1} strokeDasharray="4" />
                  )}
                  {vals.length > 1 && (
                    <polyline fill="none" stroke="#1B3A5C" strokeWidth={2.5} points={pts} />
                  )}
                  {history.map((h, i) => {
                    const x = toX(i)
                    const y = toY(h.value)
                    const ok = (refMin === null || h.value >= refMin) && (refMax === null || h.value <= refMax)
                    const dateStr = fmtDateShort(h.date)
                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r={5} fill={ok ? '#16a34a' : '#dc2626'} />
                        <text x={x} y={y - 8} textAnchor="middle" fontSize={9} fill="#374151" fontWeight="600">
                          {h.value}
                        </text>
                        {/* X-axis label with year — stagger if close together */}
                        <text
                          x={x} y={H + 16}
                          textAnchor={i === 0 ? 'start' : i === history.length - 1 ? 'end' : 'middle'}
                          fontSize={8} fill="#9ca3af"
                        >
                          {dateStr}
                        </text>
                      </g>
                    )
                  })}
                </svg>

                <div className="flex gap-4 mt-1 text-xs text-slate-500 flex-wrap">
                  <span>Min: <strong>{Math.min(...vals)}</strong></span>
                  <span>Max: <strong>{Math.max(...vals)}</strong></span>
                  {refMin !== null && <span className="text-green-600">Ref min: {refMin}</span>}
                  {refMax !== null && <span className="text-red-600">Ref max: {refMax}</span>}
                  <span>{history.length} målinger</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── ANALYSE TAB ── */}
      {activeTab === 'analyse' && (
        <div className="space-y-4">
          {!analysis && !analysisLoading && (
            <div className="text-center py-16 text-slate-400">
              <div className="text-4xl mb-3">🔬</div>
              <p className="font-medium text-slate-600">Ingen analyse utført ennå</p>
              <p className="text-sm mt-1">
                Klikk <strong>«🤖 Analyser trender»</strong> for å få en medisinsk vurdering av blodprøvehistorikken
              </p>
            </div>
          )}

          {analysis && <AnalysisPanel analysis={analysis} />}
        </div>
      )}
    </div>
  )
}

// ── Urgency config ────────────────────────────────────────────────────────────
const URGENCY_CONFIG: Record<UrgencyLevel, { label: string; color: string; bg: string; border: string; icon: string }> = {
  normal:  { label: 'Alt OK',            color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200', icon: '✅' },
  watch:   { label: 'Følg med',          color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200', icon: '👁' },
  concern: { label: 'Diskuter med lege', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', icon: '⚠️' },
  urgent:  { label: 'Kontakt lege',      color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',   icon: '🚨' },
}

const TREND_ICONS: Record<string, string> = {
  improving:       '↗ Bedring',
  stable:          '→ Stabil',
  declining:       '↘ Synkende',
  fluctuating:     '↕ Varierende',
  single_reading:  '· Enkeltmåling',
}

const STATUS_STYLE: Record<string, string> = {
  normal:    'bg-green-100 text-green-800',
  borderline:'bg-amber-100 text-amber-800',
  abnormal:  'bg-red-100 text-red-800',
}

// ── Analysis panel component ──────────────────────────────────────────────────
function AnalysisPanel({ analysis }: { analysis: BloodAnalysis }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]))
  const urg = URGENCY_CONFIG[analysis.urgency_level] ?? URGENCY_CONFIG.watch

  function toggleFinding(i: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const genDate = new Date(analysis.generated_at).toLocaleDateString('nb-NO', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="space-y-4">
      {/* Overall card */}
      <div className={`rounded-2xl border-2 p-5 ${urg.bg} ${urg.border}`}>
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">{urg.icon}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${urg.bg} ${urg.color} border ${urg.border}`}>
                {urg.label}
              </span>
              <span className="text-xs text-slate-500">{analysis.data_coverage}</span>
            </div>
            <p className={`text-sm font-medium leading-relaxed ${urg.color}`}>
              {analysis.overall_assessment}
            </p>
          </div>
        </div>
      </div>

      {/* Findings */}
      {analysis.findings.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-700 text-sm">
              Funn og vurderinger ({analysis.findings.length})
            </h3>
            <span className="text-xs text-slate-400">Klikk for detaljer</span>
          </div>
          <div className="divide-y divide-slate-100">
            {analysis.findings.map((f, i) => {
              const isOpen = expanded.has(i)
              return (
                <div key={i}>
                  <button
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition flex items-center gap-3"
                    onClick={() => toggleFinding(i)}
                  >
                    <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[f.status] ?? STATUS_STYLE.normal}`}>
                      {f.status === 'normal' ? 'Normal' : f.status === 'borderline' ? 'Grenseverdi' : 'Avvikende'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-800">{f.marker}</span>
                        <span className="text-xs text-slate-500">{TREND_ICONS[f.trend] ?? f.trend}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{f.values_summary}</p>
                    </div>
                    <span className="text-slate-400 flex-shrink-0 text-sm">{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 space-y-3 bg-slate-50/50">
                      <div className="rounded-xl bg-white border border-slate-200 p-3 space-y-2">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Klinisk betydning</p>
                          <p className="text-sm text-slate-700 leading-relaxed">{f.clinical_significance}</p>
                        </div>
                        <div className="border-t border-slate-100 pt-2">
                          <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wide mb-0.5">For Rakel konkret</p>
                          <p className="text-sm text-slate-700 leading-relaxed">{f.patient_impact}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {analysis.recommendations.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <h3 className="font-bold text-slate-700 text-sm mb-3">Anbefalinger</h3>
          <ul className="space-y-2">
            {analysis.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="text-violet-500 font-bold flex-shrink-0 mt-0.5">→</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] text-slate-400 text-center">
        Generert {genDate} · AI-analyse er veiledende og erstatter ikke medisinsk faglig vurdering
      </p>
    </div>
  )
}
