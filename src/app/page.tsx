'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard')
    } else if (status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [status, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1A3A5C] to-[#2C5282]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#D4A017] flex items-center justify-center animate-pulse">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <p className="text-white text-lg font-medium">Carregando...</p>
      </div>
    </div>
  )
}
