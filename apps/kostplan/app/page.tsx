import { redirect } from 'next/navigation'

// Redirect from root to the app dashboard
export default function Home() {
  redirect('/dashboard')
}
