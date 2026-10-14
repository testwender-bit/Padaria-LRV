import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  CalendarOff,
  DollarSign,
  History,
  BookOpen,
} from 'lucide-react'

// v9.9.0: "Lanches" removido do menu principal — agora é uma aba dentro de
// /configuracoes (junto com Escolas, PF e PCQ). A rota /lanches redireciona
// para /configuracoes?tab=lanches (compatibilidade com links antigos).
// v9.10.9: "Romaneio" removido do menu principal — a página /romaneio foi
// inativada (o romaneio do motorista já sai na impressão da Produção, que é
// o único fluxo usado). /romaneio redireciona para /producao (mesmo padrão
// da /lanches); a API /api/romaneio segue ativa (alimenta a impressão).
export const menuPrincipal = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-amber-500' },
  { href: '/producao', label: 'Produção', icon: ClipboardList, color: 'text-amber-600', destaque: true },
  { href: '/cardapio', label: 'Cardápio', icon: CalendarDays, color: 'text-purple-500' },
]

export const menuSecundario = [
  { href: '/feriados', label: 'Feriados', icon: CalendarOff, color: 'text-red-500' },
  { href: '/historico', label: 'Histórico', icon: History, color: 'text-teal-500' },
  { href: '/custos', label: 'Controle de Estoque', icon: DollarSign, color: 'text-emerald-500' },
  { href: '/nutricao', label: 'Nutrição', icon: BookOpen, color: 'text-cyan-600', destaque: true },
]
