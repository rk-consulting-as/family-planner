import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kostplan',
  description: 'AI-drevet matplanlegger for familien',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <body>{children}</body>
    </html>
  )
}
