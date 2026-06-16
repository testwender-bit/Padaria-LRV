'use client'

import { useSession } from 'next-auth/react'
import { Sidebar } from '@/components/sidebar'
import { MobileHeader } from '@/components/mobile-header'
import { Toaster } from '@/components/ui/sonner'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status } = useSession()

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1A3A5C] to-[#2C5282]">
        <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-[#D4A017] animate-spin" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null // middleware will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/30 via-white to-blue-50/20 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader />
        <main className="flex-1 p-4 lg:p-6 xl:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  )
}
