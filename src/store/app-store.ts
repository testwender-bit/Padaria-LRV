import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { inicioSemana, dataISO } from '@/lib/date-utils'

interface AppState {
  semanaReferencia: string
  setSemanaReferencia: (date: string) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      semanaReferencia: '',
      setSemanaReferencia: (date) => set({ semanaReferencia: date }),
      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    {
      name: 'padaria-municipal-store',
      partialize: (state) => ({
        semanaReferencia: state.semanaReferencia,
      }),
      // Auto-fix stale dates: if persisted date is >30 days old, reset to current week
      merge: (persisted, current) => {
        const p = persisted as Partial<AppState>
        if (p.semanaReferencia) {
          const persistedDate = new Date(p.semanaReferencia + 'T12:00:00')
          const now = new Date()
          const diffDays = Math.abs(now.getTime() - persistedDate.getTime()) / (1000 * 60 * 60 * 24)
          if (diffDays > 30) {
            return { ...current, semanaReferencia: dataISO(inicioSemana(now)) }
          }
        }
        return { ...current, ...p }
      },
    }
  )
)
