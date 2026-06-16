'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import {
  Settings,
  LogOut,
  Wheat,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { menuPrincipal, menuSecundario } from '@/lib/menu-config'

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const nomeUsuario = session?.user?.name || 'Usuário'
  const emailUsuario = session?.user?.email || ''

  function handleLogout() {
    signOut({ callbackUrl: '/login' })
  }

  const iniciais = nomeUsuario
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 bg-gradient-to-b from-[#1A3A5C] to-[#0F2740] shadow-xl">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4A017] to-[#E8B84B] flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Wheat className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-white leading-tight">Padaria Escolar</h1>
            <p className="text-[11px] text-blue-200/70">Lucas do Rio Verde</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-blue-300/50 mb-2">
          Principal
        </p>
        <ul className="space-y-1">
          {menuPrincipal.map((item) => {
            const ativo = isActive(item.href)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    ativo
                      ? 'bg-white/15 text-white shadow-lg backdrop-blur-sm'
                      : 'text-blue-100/80 hover:bg-white/8 hover:text-white',
                    item.destaque && !ativo && 'bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
                  )}
                >
                  <Icon className={cn('w-4 h-4', ativo ? 'text-[#D4A017]' : item.color)} />
                  <span>{item.label}</span>
                  {item.destaque && !ativo && (
                    <span className="ml-auto text-[9px] bg-[#D4A017]/20 text-[#D4A017] px-1.5 py-0.5 rounded font-semibold">
                      FOCO
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>

        <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-blue-300/50 mt-6 mb-2">
          Gestão
        </p>
        <ul className="space-y-1">
          {menuSecundario.map((item) => {
            const ativo = isActive(item.href)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    ativo
                      ? 'bg-white/15 text-white shadow-lg backdrop-blur-sm'
                      : 'text-blue-100/80 hover:bg-white/8 hover:text-white'
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
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
            isActive('/configuracoes')
              ? 'bg-white/15 text-white shadow-lg backdrop-blur-sm'
              : 'text-blue-100/80 hover:bg-white/8 hover:text-white'
          )}
        >
          <Settings className="w-4 h-4 text-blue-300/60" />
          <span>Configurações</span>
        </Link>
      </nav>

      {/* Perfil */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
          <Avatar className="w-9 h-9">
            <AvatarFallback className="bg-gradient-to-br from-[#D4A017] to-[#E8B84B] text-white text-xs font-semibold">
              {iniciais || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{nomeUsuario}</p>
            <p className="text-[10px] text-blue-200/50 truncate">{emailUsuario}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md hover:bg-red-500/20 text-blue-300/50 hover:text-red-400 transition-colors"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
