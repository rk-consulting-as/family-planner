import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'KostPlan',
  description: 'Smart matplanlegging for familien',
}

// KostPlan har sitt eget fullskjerm-layout uten familie-appens TopNav
export default function KostPlanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9' }}>
      {children}
    </div>
  )
}
