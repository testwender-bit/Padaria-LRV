import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  Truck,
  CalendarOff,
  DollarSign,
  Cookie,
  History,
  BookOpen,
} from 'lucide-react'

export const menuPrincipal = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-amber-500' },
  { href: '/producao', label: 'Produção', icon: ClipboardList, color: 'text-amber-600', destaque: true },
  { href: '/romaneio', label: 'Romaneio', icon: Truck, color: 'text-green-500' },
  { href: '/cardapio', label: 'Cardápio', icon: CalendarDays, color: 'text-purple-500' },
  { href: '/lanches', label: 'Lanches', icon: Cookie, color: 'text-pink-500' },
]

export const menuSecundario = [
  { href: '/feriados', label: 'Feriados', icon: CalendarOff, color: 'text-red-500' },
  { href: '/historico', label: 'Histórico', icon: History, color: 'text-teal-500' },
  { href: '/custos', label: 'Insumos', icon: DollarSign, color: 'text-emerald-500' },
  { href: '/nutricao', label: 'Nutrição', icon: BookOpen, color: 'text-cyan-600', destaque: true },
]
