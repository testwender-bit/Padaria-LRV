'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import {
  Menu,
  Wheat,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { useState } from 'react'
import { menuPrincipal, menuSecundario } from '@/lib/menu-config'

export function MobileHeader() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)

  const nomeUsuario = session?.user?.name || 'Usuário'

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <header className="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-amber-100 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1A3A5C] to-[#2C5282] flex items-center justify-center">
            <Wheat className="w-4 h-4 text-[#D4A017]" />
          </div>
          <span className="font-semibold text-sm text-[#1A3A5C]">Padaria Escolar</span>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Menu className="w-5 h-5 text-[#1A3A5C]" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-0 bg-gradient-to-b from-[#1A3A5C] to-[#0F2740]">
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D4A017] to-[#E8B84B] flex items-center justify-center">
                  <Wheat className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Padaria Escolar</p>
                  <p className="text-[10px] text-blue-200/60">{nomeUsuario}</p>
                </div>
              </div>
            </div>

            <nav className="px-3 py-4">
              <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-blue-300/50 mb-2">Principal</p>
              <ul className="space-y-1">
                {menuPrincipal.map((item) => {
                  const ativo = isActive(item.href)
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                          ativo ? 'bg-white/15 text-white' : 'text-blue-100/80 hover:bg-white/8 hover:text-white'
                        )}
                      >
                        <Icon className={cn('w-4 h-4', ativo ? 'text-[#D4A017]' : item.color)} />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>

              <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-blue-300/50 mt-6 mb-2">Gestão</p>
              <ul className="space-y-1">
                {menuSecundario.map((item) => {
                  const ativo = isActive(item.href)
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                          ativo ? 'bg-white/15 text-white' : 'text-blue-100/80 hover:bg-white/8 hover:text-white'
                        )}
                      >
                        <Icon className={cn('w-4 h-4', ativo ? 'text-[#D4A017]' : item.color)} />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>

              <Separator className="my-4 bg-white/10" />

              <Link
                href="/configuracoes"
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive('/configuracoes') ? 'bg-white/15 text-white' : 'text-blue-100/80 hover:bg-white/8 hover:text-white'
                )}
              >
                <Settings className="w-4 h-4 text-blue-300/60" />
                <span>Configurações</span>
              </Link>

              <button
                onClick={() => { signOut({ callbackUrl: '/login' }); setOpen(false) }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-300/80 hover:bg-red-500/20 hover:text-red-300 transition-all w-full mt-4"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair</span>
              </button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
