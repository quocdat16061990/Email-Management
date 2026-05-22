import { type ReactNode } from 'react'
import Header from './Header'
import Toast from '../shared/Toast'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Header />
      <main className="max-w-9xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
      <Toast />
    </div>
  )
}
