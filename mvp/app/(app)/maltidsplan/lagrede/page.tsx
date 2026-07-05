'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  getSavedMeals, createSavedMeal, updateSavedMeal, deleteSavedMeal,
  type SavedMeal, type SavedMealItem,
} from '@/lib/actions/saved_meals'
import type { FoodSearchResult } from '@/app/api/matvaretabellen/route'

// ── Constants ──────────────────────────────────────────────────────────────────

const TAGS = ['Frokost','Lunsj','Middag','Kveldsmat','Snacks','Dessert']

const NUTR_COLORS: Record<string, string> = {
  kcal: '#F59E0B', protein: '#10B981', carbs: '#3B82F6', fat: '#8B5CF6',
  sugar: '#EC4899', fiber: '#84CC16', saturated_fat: '#F97316', sodium: '#64748B',
}

// ── Ingredient row ─────────────────────────────────────────────────────────────

function IngredientBuilder({
  items, onChange, disabled,
}: {
  items: SavedMealItem[]
  onChange: (items: SavedMealItem[]) => void
  disabled?: boolean
}) {
  const [query,       setQuery]       = useState('')
  const [suggestions, setSuggestions] = useState<FoodSearchResult[]>([])
  const [showDrop,    setShowDrop]    = useState(false)
  const [searching,   setSearching]   = useState(false)
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null)
  const [portionIdx,  setPortionIdx]  = useState(0)
  const [customGrams, setCustomGrams] = useState(100)
  const [useCustom,   setUseCustom]   = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  function onQuery(q: string) {
    setQuery(q); setSelectedFood(null)
    clearTimeout(timer.current)
    if (q.length < 2) { setSuggestions([]); setShowDrop(false); return }
    setSearching(true)
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/matvaretabellen?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setSuggestions(data); setShowDrop(data.length > 0)
      } catch { /* ignore */ }
      finally { setSearching(false) }
    }, 300)
  }

  function pick(food: FoodSearchResult) {
    setSelectedFood(food); setQuery(food.name)
    setShowDrop(false); setPortionIdx(0)
    setUseCustom(false); setCustomGrams(food.portions[0]?.grams ?? 100)
  }

  function addIngredient() {
    if (!selectedFood) return
    const grams = useCustom ? customGrams : (selectedFood.portions[portionIdx]?.grams ?? customGrams)
    const portionLabel = useCustom
      ? `${grams} g`
      : selectedFood.portions[portionIdx]?.label ?? `${grams} g`
    const scale = grams / 100
    const f = selectedFood.per100g
    const nutrition = {
      kcal:          Math.round(f.kcal          * scale),
      protein:       Math.round(f.protein       * scale),
      carbs:         Math.round(f.carbs         * scale),
      sugar:         Math.round(f.sugar         * scale),
      fiber:         Math.round(f.fiber         * scale),
      fat:           Math.round(f.fat           * scale),
      saturated_fat: Math.round(f.saturated_fat * scale),
      sodium:        Math.round(f.sodium        * scale),
    }
    const item: SavedMealItem = {
      id: crypto.randomUUID(),
      name: `${selectedFood.name} (${portionLabel})`,
      foodId: selectedFood.id,
      grams,
      nutrition,
    }
    onChange([...items, item])
    setQuery(''); setSelectedFood(null); setSuggestions([])
    setPortionIdx(0); setUseCustom(false); setCustomGrams(100)
  }

  const currentGrams = selectedFood
    ? (useCustom ? customGrams : (selectedFood.portions[portionIdx]?.grams ?? 100))
    : 100

  return (
    <div>
      {/* Existing items */}
      {items.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {items.map((item, i) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', background: '#F8FAFC', borderRadius: 7,
              border: '1px solid #E2E8F0', marginBottom: 5 }}>
              <span style={{ flex: 1, fontSize: 13, color: '#1E293B' }}>{item.name}</span>
              <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600 }}>{item.nutrition.kcal} kcal</span>
              <span style={{ fontSize: 11, color: '#10B981' }}>{item.nutrition.protein}g prot</span>
              <span style={{ fontSize: 11, color: '#3B82F6' }}>{item.nutrition.carbs}g karbo</span>
              <span style={{ fontSize: 11, color: '#8B5CF6' }}>{item.nutrition.fat}g fett</span>
              <button onClick={() => onChange(items.filter((_, j) => j !== i))}
                disabled={disabled}
                style={{ fontSize: 14, color: '#CBD5E1', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      {!disabled && (
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={query}
              onChange={e => onQuery(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowDrop(true)}
              onBlur={() => setTimeout(() => setShowDrop(false), 150)}
              placeholder="Søk ingrediens (f.eks. yoghurt, havregryn…)"
              style={{ flex: 1, padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 7,
                fontSize: 13, fontFamily: 'inherit', background: '#F8FAFC', outline: 'none', boxSizing: 'border-box' }}
            />
            {searching && <span style={{ position: 'absolute', right: 14, top: 10, fontSize: 11, color: '#94A3B8' }}>⏳</span>}
          </div>

          {showDrop && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
              background: 'white', border: '1px solid #E2E8F0', borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,.1)', maxHeight: 220, overflowY: 'auto' }}>
              {suggestions.map(food => (
                <button key={food.id} onMouseDown={() => pick(food)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                    border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    borderBottom: '1px solid #F1F5F9', fontSize: 13, color: '#1E293B' }}>
                  <div style={{ fontWeight: 500 }}>{food.name}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>
                    {food.per100g.kcal} kcal · {food.per100g.protein}g prot · {food.per100g.carbs}g karbo (per 100g)
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Portion picker */}
      {selectedFood && !disabled && (
        <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8,
          padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: '#0369A1', fontWeight: 600, marginBottom: 6 }}>
            {selectedFood.name} — velg mengde:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {selectedFood.portions.map((p, i) => (
              <button key={p.id} onClick={() => { setPortionIdx(i); setUseCustom(false); setCustomGrams(p.grams) }}
                style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                  fontFamily: 'inherit', border: 'none',
                  background: !useCustom && portionIdx === i ? '#0369A1' : '#E0F2FE',
                  color: !useCustom && portionIdx === i ? 'white' : '#0369A1',
                  fontWeight: !useCustom && portionIdx === i ? 700 : 400 }}>
                {p.label} ({p.grams}g)
              </button>
            ))}
            <button onClick={() => { setUseCustom(true); setCustomGrams(100) }}
              style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                fontFamily: 'inherit', border: 'none',
                background: useCustom ? '#0369A1' : '#E0F2FE',
                color: useCustom ? 'white' : '#0369A1',
                fontWeight: useCustom ? 700 : 400 }}>
              Tilpass gram
            </button>
          </div>
          {useCustom && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <input type="number" min={1} max={2000} value={customGrams}
                onChange={e => setCustomGrams(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: 80, padding: '4px 8px', border: '1px solid #BAE6FD', borderRadius: 6,
                  fontSize: 13, fontFamily: 'inherit', background: 'white' }} />
              <span style={{ fontSize: 12, color: '#64748B' }}>gram</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {[
              { k: 'kcal', l: 'Kcal', u: '' }, { k: 'protein', l: 'Protein', u: 'g' },
              { k: 'carbs', l: 'Karbo', u: 'g' }, { k: 'fat', l: 'Fett', u: 'g' },
            ].map(({ k, l, u }) => {
              const val = Math.round((selectedFood.per100g[k as keyof typeof selectedFood.per100g] as number) * currentGrams / 100)
              const c = NUTR_COLORS[k]
              return (
                <span key={k} style={{ fontSize: 11, background: c + '18', color: c,
                  padding: '2px 8px', borderRadius: 999, border: `1px solid ${c}40`, fontWeight: 700 }}>
                  {l}: {val}{u}
                </span>
              )
            })}
          </div>
          <button onClick={addIngredient}
            style={{ padding: '6px 14px', background: '#0369A1', color: 'white', border: 'none',
              borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Legg til ingrediens
          </button>
        </div>
      )}
    </div>
  )
}

// ── Nutrition summary ──────────────────────────────────────────────────────────

function NutritionSummary({ n }: { n: SavedMeal['total_nutrition'] }) {
  if (!n) return null
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
      {[
        { k: 'kcal', l: 'Kcal', u: '' }, { k: 'protein', l: 'Prot', u: 'g' },
        { k: 'carbs', l: 'Karbo', u: 'g' }, { k: 'fat', l: 'Fett', u: 'g' },
      ].map(({ k, l, u }) => {
        const c = NUTR_COLORS[k]
        return (
          <span key={k} style={{ fontSize: 11, background: c + '15', color: c,
            padding: '2px 7px', borderRadius: 999, border: `1px solid ${c}35`, fontWeight: 600 }}>
            {l}: {(n as Record<string, number>)[k]}{u}
          </span>
        )
      })}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function LagredeMAltiderPage() {
  const router = useRouter()
  const sb     = createClient()

  const [meals,   setMeals]   = useState<SavedMeal[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // Form state
  const [showForm,  setShowForm]  = useState(false)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [formName,  setFormName]  = useState('')
  const [formDesc,  setFormDesc]  = useState('')
  const [formTags,  setFormTags]  = useState<string[]>([])
  const [formItems, setFormItems] = useState<SavedMealItem[]>([])
  const [saving,    setSaving]    = useState(false)
  const [saveErr,   setSaveErr]   = useState('')

  // Expanded card
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/sign-in'); return }

      const { data: gm } = await sb.from('group_members')
        .select('role').eq('profile_id', user.id).limit(1).single()
      if (gm) setIsAdmin(['owner', 'admin'].includes((gm as { role: string }).role))

      const data = await getSavedMeals()
      setMeals(data)
      setLoading(false)
    }
    init()
  }, [sb, router])

  function openCreate() {
    setEditId(null); setFormName(''); setFormDesc('')
    setFormTags([]); setFormItems([]); setSaveErr('')
    setShowForm(true)
  }

  function openEdit(meal: SavedMeal) {
    setEditId(meal.id); setFormName(meal.name)
    setFormDesc(meal.description ?? ''); setFormTags(meal.tags ?? [])
    setFormItems(meal.items ?? []); setSaveErr('')
    setShowForm(true)
  }

  async function handleSave() {
    if (!formName.trim() || formItems.length === 0) {
      setSaveErr('Navn og minst én ingrediens er påkrevd.')
      return
    }
    setSaving(true); setSaveErr('')
    const payload = { name: formName, description: formDesc, tags: formTags, items: formItems }

    let result
    if (editId) {
      result = await updateSavedMeal(editId, payload)
    } else {
      result = await createSavedMeal(payload)
    }

    if (!result.ok) { setSaveErr(result.error); setSaving(false); return }

    // Refresh list
    const updated = await getSavedMeals()
    setMeals(updated)
    setShowForm(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Slett dette lagrede måltidet?')) return
    await deleteSavedMeal(id)
    setMeals(prev => prev.filter(m => m.id !== id))
  }

  function toggleTag(tag: string) {
    setFormTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const totalItems = formItems.reduce(
    (acc, item) => ({
      kcal:          acc.kcal          + item.nutrition.kcal,
      protein:       acc.protein       + item.nutrition.protein,
      carbs:         acc.carbs         + item.nutrition.carbs,
      sugar:         acc.sugar         + item.nutrition.sugar,
      fiber:         acc.fiber         + item.nutrition.fiber,
      fat:           acc.fat           + item.nutrition.fat,
      saturated_fat: acc.saturated_fat + item.nutrition.saturated_fat,
      sodium:        acc.sodium        + item.nutrition.sodium,
    }),
    { kcal: 0, protein: 0, carbs: 0, sugar: 0, fiber: 0, fat: 0, saturated_fat: 0, sodium: 0 }
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9' }}>
      {/* Header */}
      <header style={{ background: '#1B3A5C', color: 'white', padding: '0 20px',
        height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push('/maltidsplan')}
            style={{ background: 'rgba(255,255,255,.13)', border: '1px solid rgba(255,255,255,.22)',
              color: 'white', borderRadius: 7, padding: '5px 10px', cursor: 'pointer',
              fontSize: 12, fontFamily: 'inherit' }}>← Tilbake</button>
          <span style={{ fontSize: 16, fontWeight: 600 }}>🍽️ Lagrede måltider</span>
        </div>
        {isAdmin && !showForm && (
          <button onClick={openCreate}
            style={{ padding: '6px 14px', background: 'rgba(255,255,255,.15)',
              border: '1px solid rgba(255,255,255,.3)', color: 'white', borderRadius: 7,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Nytt måltid
          </button>
        )}
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 60px' }}>

        {/* ── Create / Edit form ── */}
        {showForm && (
          <div style={{ background: 'white', borderRadius: 12, padding: '20px 20px',
            border: '1px solid #E2E8F0', marginBottom: 20, boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1B3A5C', marginBottom: 16 }}>
              {editId ? '✏️ Rediger måltid' : '➕ Opprett nytt måltid'}
            </div>

            {/* Name */}
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Navn på måltidet *</label>
              <input style={inp} value={formName} onChange={e => setFormName(e.target.value)}
                placeholder="F.eks. Gresk yoghurt med honning og granola" />
            </div>

            {/* Description */}
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Beskrivelse (valgfritt)</label>
              <input style={inp} value={formDesc} onChange={e => setFormDesc(e.target.value)}
                placeholder="Kort beskrivelse, notater…" />
            </div>

            {/* Tags */}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Kategori</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {TAGS.map(tag => (
                  <button key={tag} onClick={() => toggleTag(tag)}
                    style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                      fontFamily: 'inherit', border: 'none',
                      background: formTags.includes(tag) ? '#1B3A5C' : '#F1F5F9',
                      color: formTags.includes(tag) ? 'white' : '#64748B',
                      fontWeight: formTags.includes(tag) ? 600 : 400 }}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Ingredients */}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Ingredienser *</label>
              <IngredientBuilder items={formItems} onChange={setFormItems} />
            </div>

            {/* Nutrition total */}
            {formItems.length > 0 && (
              <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 12px',
                border: '1px solid #E2E8F0', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B',
                  letterSpacing: '.06em', marginBottom: 6 }}>TOTALT NÆRINGSINNHOLD</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { k: 'kcal', l: 'Kcal', u: '' }, { k: 'protein', l: 'Protein', u: 'g' },
                    { k: 'carbs', l: 'Karbo', u: 'g' }, { k: 'fat', l: 'Fett', u: 'g' },
                    { k: 'sugar', l: 'Sukker', u: 'g' }, { k: 'fiber', l: 'Fiber', u: 'g' },
                    { k: 'saturated_fat', l: 'Met.fett', u: 'g' }, { k: 'sodium', l: 'Salt', u: 'mg' },
                  ].map(({ k, l, u }) => {
                    const c = NUTR_COLORS[k]
                    return (
                      <span key={k} style={{ fontSize: 11, background: c + '15', color: c,
                        padding: '2px 8px', borderRadius: 999, border: `1px solid ${c}35`, fontWeight: 600 }}>
                        {l}: {(totalItems as Record<string, number>)[k]}{u}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {saveErr && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626',
                borderRadius: 7, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>
                {saveErr}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ padding: '8px 20px', background: '#1B3A5C', color: 'white', border: 'none',
                  borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Lagrer…' : editId ? 'Oppdater' : 'Lagre måltid'}
              </button>
              <button onClick={() => setShowForm(false)}
                style={{ padding: '8px 14px', background: '#F1F5F9', color: '#64748B', border: 'none',
                  borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Avbryt
              </button>
            </div>
          </div>
        )}

        {/* ── Meal list ── */}
        {loading ? (
          <div style={{ textAlign: 'center', color: '#94A3B8', padding: 40 }}>Laster…</div>
        ) : meals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', background: 'white',
            borderRadius: 12, border: '1px dashed #E2E8F0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
            <div style={{ fontSize: 15, color: '#64748B', marginBottom: 6 }}>Ingen lagrede måltider ennå</div>
            {isAdmin && (
              <button onClick={openCreate}
                style={{ marginTop: 12, padding: '8px 18px', background: '#1B3A5C', color: 'white',
                  border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                + Opprett første måltid
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {meals.map(meal => {
              const expanded = expandedId === meal.id
              return (
                <div key={meal.id} style={{ background: 'white', borderRadius: 10,
                  border: '1px solid #E8EDF2', overflow: 'hidden' }}>
                  {/* Card header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                    padding: '14px 16px', cursor: 'pointer' }}
                    onClick={() => setExpandedId(expanded ? null : meal.id)}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>🍽️</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1E293B' }}>{meal.name}</div>
                      {meal.description && (
                        <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>{meal.description}</div>
                      )}
                      {meal.tags?.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                          {meal.tags.map(t => (
                            <span key={t} style={{ fontSize: 10, background: '#F1F5F9', color: '#64748B',
                              padding: '1px 6px', borderRadius: 10, border: '1px solid #E2E8F0' }}>{t}</span>
                          ))}
                        </div>
                      )}
                      <NutritionSummary n={meal.total_nutrition} />
                    </div>
                    <span style={{ fontSize: 12, color: '#CBD5E1', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
                  </div>

                  {/* Expanded detail */}
                  {expanded && (
                    <div style={{ borderTop: '1px solid #F1F5F9', padding: '12px 16px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B',
                        letterSpacing: '.06em', marginBottom: 8 }}>INGREDIENSER</div>
                      {(meal.items ?? []).map(item => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8,
                          padding: '5px 0', borderBottom: '1px solid #F8FAFC' }}>
                          <span style={{ flex: 1, fontSize: 13, color: '#1E293B' }}>{item.name}</span>
                          <span style={{ fontSize: 11, color: '#F59E0B' }}>{item.nutrition.kcal} kcal</span>
                          <span style={{ fontSize: 11, color: '#10B981' }}>{item.nutrition.protein}g</span>
                          <span style={{ fontSize: 11, color: '#3B82F6' }}>{item.nutrition.carbs}g</span>
                          <span style={{ fontSize: 11, color: '#8B5CF6' }}>{item.nutrition.fat}g</span>
                        </div>
                      ))}
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button onClick={() => openEdit(meal)}
                            style={{ padding: '6px 12px', background: '#F1F5F9', color: '#1B3A5C',
                              border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                            ✏️ Rediger
                          </button>
                          <button onClick={() => handleDelete(meal.id)}
                            style={{ padding: '6px 12px', background: '#FEF2F2', color: '#DC2626',
                              border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                            🗑 Slett
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8,
  fontSize: 14, color: '#1E293B', background: '#F8FAFC', fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box',
}
