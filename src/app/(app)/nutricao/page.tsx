'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Apple, ChefHat, BookOpen, UserCheck, ArrowRight, RefreshCw, ShoppingCart } from 'lucide-react'

interface CardapioResumo {
  id: string
  nome: string
  escola_id: string | null
  categoria_escola: string
  status: string
  ano: number
  semestre: number
  escola?: { id: string; nome: string } | null
  nutricionista?: { id: string; nome: string } | null
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
}

const quickCards = [
  {
    title: 'Alimentos (TACO)',
    href: '/nutricao/alimentos',
    icon: Apple,
    gradient: 'from-green-50 to-emerald-50',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    titleColor: 'text-emerald-800',
    desc: 'Base TACO de alimentos',
  },
  {
    title: 'Preparações',
    href: '/nutricao/preparacoes',
    icon: ChefHat,
    gradient: 'from-amber-50 to-orange-50',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    titleColor: 'text-amber-800',
    desc: 'Receitas e preparações',
  },
  {
    title: 'Cardápios',
    href: '/nutricao/cardapios',
    icon: BookOpen,
    gradient: 'from-blue-50 to-cyan-50',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    titleColor: 'text-blue-800',
    desc: 'Cardápios escolares PNAE',
  },
  {
    title: 'Nutricionistas',
    href: '/nutricao/nutricionistas',
    icon: UserCheck,
    gradient: 'from-purple-50 to-violet-50',
    border: 'border-purple-200',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    titleColor: 'text-purple-800',
    desc: 'Equipe de nutrição',
  },
  {
    title: 'Lista de Compras',
    href: '/nutricao/lista-compras',
    icon: ShoppingCart,
    gradient: 'from-emerald-50 to-teal-50',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    titleColor: 'text-emerald-800',
    desc: 'Consolidado por escola',
  },
]

function getStatusBadge(status: string) {
  switch (status) {
    case 'APROVADO':
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px]">Aprovado</Badge>
    case 'RASCUNHO':
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px]">Rascunho</Badge>
    default:
      return <Badge variant="outline" className="text-[10px]">{status}</Badge>
  }
}

function getCategoriaBadge(categoria: string) {
  const map: Record<string, { label: string; className: string }> = {
    REGULAR: { label: 'Regular', className: 'bg-blue-100 text-blue-700' },
    INTEGRAL: { label: 'Integral', className: 'bg-teal-100 text-teal-700' },
    BIFASICA: { label: 'Bifásica', className: 'bg-cyan-100 text-cyan-700' },
    CRECHE: { label: 'Creche', className: 'bg-pink-100 text-pink-700' },
    INTERIOR: { label: 'Interior', className: 'bg-orange-100 text-orange-700' },
  }
  const info = map[categoria] || { label: categoria, className: 'bg-gray-100 text-gray-700' }
  return <Badge className={`${info.className} text-[10px] hover:${info.className}`}>{info.label}</Badge>
}

export default function NutricaoDashboardPage() {
  const [cardapios, setCardapios] = useState<CardapioResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadCardapios() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/nutricao/cardapios')
      if (!res.ok) throw new Error('Erro ao carregar cardápios')
      const data = await res.json()
      setCardapios(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar os cardápios.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCardapios()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
          <span className="text-muted-foreground">Carregando módulo de nutrição...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold text-[#1A3A5C]">Nutrição — Cardápio Escolar PNAE</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Módulo de planejamento nutricional conforme o Programa Nacional de Alimentação Escolar.
          Gerencie alimentos, preparações, cardápios e acompanhe a conformidade PNAE.
        </p>
      </motion.div>

      {/* Quick Access Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {quickCards.map((card) => {
          const Icon = card.icon
          return (
            <motion.div key={card.href} variants={item}>
              <Link href={card.href}>
                <Card className={`${card.border} bg-gradient-to-br ${card.gradient} hover:shadow-lg transition-all cursor-pointer group h-full`}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className={`text-sm font-medium ${card.titleColor}`}>{card.title}</CardTitle>
                    <div className={`w-8 h-8 rounded-lg ${card.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <Icon className={`w-4 h-4 ${card.iconColor}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{card.desc}</p>
                    <div className="mt-3 flex items-center text-xs font-medium text-[#1A3A5C] group-hover:text-[#D4A017] transition-colors">
                      Acessar <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Recent Cardápios */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <Card className="border-[#1A3A5C]/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-[#1A3A5C] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#D4A017]" />
              Cardápios Recentes
            </CardTitle>
            <Link href="/nutricao/cardapios">
              <Button variant="ghost" size="sm" className="text-xs">
                Ver todos <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="text-center py-8">
                <p className="text-sm text-red-500 mb-3">{error}</p>
                <Button variant="outline" size="sm" onClick={loadCardapios}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Tentar novamente
                </Button>
              </div>
            ) : cardapios.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">Nenhum cardápio encontrado.</p>
                <Link href="/nutricao/cardapios">
                  <Button size="sm" className="mt-3 bg-[#1A3A5C] hover:bg-[#1A3A5C]/90">
                    Criar primeiro cardápio
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                {cardapios.slice(0, 10).map((c) => (
                  <Link key={c.id} href={`/nutricao/cardapios/${c.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50/50 transition-colors group">
                      <div className="w-8 h-8 rounded-lg bg-[#1A3A5C]/5 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-4 h-4 text-[#1A3A5C]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1A3A5C] truncate group-hover:text-[#D4A017] transition-colors">
                          {c.nome}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.escola?.nome || 'Modelo base'} · {c.ano}/{c.semestre}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getCategoriaBadge(c.categoria_escola)}
                        {getStatusBadge(c.status)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
