'use client'

import { useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [tab, setTab]       = useState<'login' | 'register'>('login')
  const [email, setEmail]   = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]     = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const sb = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else router.push('/dashboard')
    setLoading(false)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Skriv inn navn')
    if (password.length < 8) return setError('Passordet må ha minst 8 tegn')
    setLoading(true); setError('')

    const { data, error } = await sb.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false); return }

    if (data.user) {
      await sb.from('profiles').upsert({
        id: data.user.id,
        display_name: name.trim(),
        email,
      })
      // Opprett tomme preferanser
      await sb.from('kp_preferences').upsert({
        profile_id: data.user.id,
      })
      router.push('/onboarding')
    }
    setLoading(false)
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>Kost<span style={{ color: '#3B7DD8' }}>Plan</span></div>
        <p style={styles.tagline}>Smart matplanlegging for hele familien</p>

        {/* Tabs */}
        <div style={styles.tabRow}>
          {(['login', 'register'] as const).map(t => (
            <button
              key={t}
              style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
              onClick={() => { setTab(t); setError('') }}
            >
              {t === 'login' ? 'Logg inn' : 'Opprett konto'}
            </button>
          ))}
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {tab === 'login' ? (
          <form onSubmit={handleLogin}>
            <Field label="E-post">
              <input style={styles.input} type="email" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="deg@example.com" required />
            </Field>
            <Field label="Passord">
              <input style={styles.input} type="password" value={password}
                onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </Field>
            <button style={styles.btn} type="submit" disabled={loading}>
              {loading ? 'Logger inn…' : 'Logg inn'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <Field label="Navn">
              <input style={styles.input} type="text" value={name}
                onChange={e => setName(e.target.value)} placeholder="Ola Nordmann" required />
            </Field>
            <Field label="E-post">
              <input style={styles.input} type="email" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="deg@example.com" required />
            </Field>
            <Field label="Passord">
              <input style={styles.input} type="password" value={password}
                onChange={e => setPassword(e.target.value)} placeholder="Minst 8 tegn" required />
            </Field>
            <button style={styles.btn} type="submit" disabled={loading}>
              {loading ? 'Oppretter konto…' : 'Opprett konto'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F4F6F9',
    padding: 24,
  },
  card: {
    background: '#fff',
    border: '1px solid #E4E8EF',
    borderRadius: 12,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 380,
    boxShadow: '0 1px 3px rgba(0,0,0,.08)',
  },
  logo: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: '-.5px',
    marginBottom: 4,
  },
  tagline: {
    color: '#6B7280',
    fontSize: 14,
    marginBottom: 28,
  },
  tabRow: {
    display: 'flex',
    gap: 4,
    marginBottom: 24,
    background: '#F4F6F9',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    padding: '8px 0',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    background: 'transparent',
    color: '#6B7280',
    fontWeight: 500,
    cursor: 'pointer',
  },
  tabActive: {
    background: '#fff',
    color: '#111827',
    boxShadow: '0 1px 3px rgba(0,0,0,.08)',
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#6B7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '.4px',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #E4E8EF',
    borderRadius: 8,
    fontSize: 15,
    background: '#F4F6F9',
    color: '#111827',
    outline: 'none',
  },
  btn: {
    width: '100%',
    padding: '11px 0',
    background: '#3B7DD8',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
    marginTop: 4,
  },
  error: {
    background: '#FEE2E2',
    color: '#B91C1C',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    marginBottom: 14,
  },
}
