'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { SeletorSemana } from '@/components/seletor-semana'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  Wheat,
  ClipboardList,
  // v9.10.9: Truck removido — card do Romaneio inativado junto com a página
  CalendarOff,
  TrendingUp,
  Package,
  Cookie,
  CalendarDays,
  ArrowRight,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { dataISO } from '@/lib/date-utils'

interface DashboardData {
  totalEscolas: number
  totalPFSemana: number
  totalPCQSemana: number
  totalLancheSemana: number
  proximosFeriados: { id: string; data: string; nome: string; tipo: string; acao: string }[]
  tipoPao: string
  nomePao: string
  lancheRegular: string | null
  lancheBifasica: string | null
  // v9.6.7: aviso da semana (obs do cardápio)
  obs: string | null
  // v9.7.5: feriados da semana (seg-sex + dom D-1) — alerta complementar ao aviso
  feriados_semana: Array<{
    data: string
    nome: string
    tipo: string
    escolas_afetadas: string
    acao: string
  }>
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  // BUG FIX 4: Dashboard must use semanaReferencia
  const { semanaReferencia } = useAppStore()

  useEffect(() => {
    async function loadData() {
      try {
        const [escolasRes, feriadosRes, producaoRes] = await Promise.all([
          fetch('/api/escolas'),
          fetch('/api/feriados'),
          // BUG FIX 4: Pass semanaReferencia to production API
          fetch(`/api/producao${semanaReferencia ? `?data=${semanaReferencia}` : ''}`),
        ])

        const escolas = await escolasRes.json()
        const feriados = await feriadosRes.json()
        const producao = await producaoRes.json()

        // Defensive: ensure arrays even if API returns error objects
        const escolasArr = Array.isArray(escolas) ? escolas : []
        const feriadosArr = Array.isArray(feriados) ? feriados : []
        const producaoDias = Array.isArray(producao?.dias) ? producao.dias : []

        // Calcular totais
        let totalPF = 0
        let totalPCQ = 0
        let totalLanche = 0

        for (const dia of producaoDias) {
          totalPF += dia.total_pf || 0
          totalPCQ += dia.total_pcq || 0
          totalLanche += dia.total_lanche || 0
        }

        // Próximos feriados
        const hoje = new Date().toISOString().split('T')[0]
        const proximosFeriados = feriadosArr
          .filter((f: { data: string }) => f.data >= hoje)
          .slice(0, 5)

        setData({
          totalEscolas: (() => {
            const escolasComProducao = new Set<string>()
            for (const dia of producaoDias) {
              for (const item of (dia.itens_pf || [])) {
                if (item.quantidade > 0) escolasComProducao.add(item.escola_id)
              }
              for (const item of (dia.itens_pcq || [])) {
                if (item.quantidade > 0) escolasComProducao.add(item.escola_id)
              }
              for (const item of (dia.itens_lanche || [])) {
                if (item.quantidade > 0) escolasComProducao.add(item.escola_id)
              }
            }
            return escolasComProducao.size || escolasArr.length
          })(),
          totalPFSemana: totalPF,
          totalPCQSemana: totalPCQ,
          totalLancheSemana: totalLanche,
          proximosFeriados,
          tipoPao: producao.tipoPao || 'PADRAO',
          nomePao: producao.nomePao || 'Pão Francês',
          lancheRegular: producao.lancheRegular,
          lancheBifasica: producao.lancheBifasica,
          // v9.6.7: aviso da semana
          obs: producao.obs || null,
          // v9.7.5: feriados da semana
          feriados_semana: Array.isArray(producao?.feriados_semana) ? producao.feriados_semana : [],
        })
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [semanaReferencia])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
          <span className="text-muted-foreground">Carregando dashboard...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3A5C]">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral da produção da semana</p>
        </div>
        <SeletorSemana />
      </div>

      {/* v9.6.7: Aviso da semana (obs do cardápio) + v9.7.5: alerta de feriados da semana */}
      {(data?.obs || (data?.feriados_semana && data.feriados_semana.length > 0)) && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 space-y-3">
          {data?.obs && (
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Aviso da Semana</p>
                <p className="text-sm text-amber-700 mt-1">{data.obs}</p>
              </div>
            </div>
          )}
          {/* v9.7.5: Alerta de feriados da semana */}
          {data?.feriados_semana && data.feriados_semana.length > 0 && (
            <div className="flex items-start gap-3 border-t border-amber-200 pt-3">
              <CalendarOff className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-800">
                  {data.feriados_semana.length === 1
                    ? 'Feriado na semana:'
                    : `${data.feriados_semana.length} feriados na semana:`}
                </p>
                <ul className="text-sm text-red-700 mt-1 space-y-0.5">
                  {data.feriados_semana.map((f, idx) => (
                    <li key={`${f.data}-${idx}`} className="flex items-start gap-2">
                      <span className="font-mono text-red-900">
                        {new Date(f.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </span>
                      <span className="font-medium">{f.nome}</span>
                      <span className="text-red-500/70 text-xs">
                        ({f.acao === 'zerar_dia' ? 'zerar tudo' :
                          f.acao === 'zerar_pf' ? 'sem PF' :
                          f.acao === 'zerar_pcq' ? 'sem PCQ' :
                          f.acao === 'zerar_lanche' ? 'sem lanche' :
                          f.acao === 'apenas_observacao' ? 'observação' : f.acao})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <motion.div variants={item}>
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-amber-800">Pão Francês</CardTitle>
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Wheat className="w-4 h-4 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-900">{data?.totalPFSemana?.toLocaleString('pt-BR') || 0}</div>
              <p className="text-xs text-amber-600 mt-1">unidades na semana</p>
              <Badge variant="secondary" className="mt-2 bg-amber-100 text-amber-700 text-[10px]">
                {data?.nomePao}
              </Badge>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-orange-800">Pão Cachorro Quente</CardTitle>
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                <Package className="w-4 h-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900">{data?.totalPCQSemana?.toLocaleString('pt-BR') || 0}</div>
              <p className="text-xs text-orange-600 mt-1">formas na semana</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="border-pink-200 bg-gradient-to-br from-pink-50 to-white hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-pink-800">Lanches</CardTitle>
              <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center">
                <Cookie className="w-4 h-4 text-pink-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-pink-900">{data?.totalLancheSemana?.toLocaleString('pt-BR') || 0}</div>
              <p className="text-xs text-pink-600 mt-1">
                {data?.lancheRegular || 'Não definido'}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-emerald-800">Escolas Atendidas</CardTitle>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-900">{data?.totalEscolas || 0}</div>
              <p className="text-xs text-emerald-600 mt-1">escolas atendidas na semana</p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Próximos Feriados */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-red-100">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold text-[#1A3A5C] flex items-center gap-2">
                <CalendarOff className="w-5 h-5 text-red-500" />
                Próximos Feriados
              </CardTitle>
              <Link href="/feriados">
                <Button variant="ghost" size="sm" className="text-xs">
                  Ver todos <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {data?.proximosFeriados?.length ? (
                <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
                  {data.proximosFeriados.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 p-2 rounded-lg bg-red-50/50 border border-red-100">
                      <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-red-900 truncate">{f.nome}</p>
                        <p className="text-xs text-red-600">
                          {new Date(f.data + 'T12:00:00').toLocaleDateString('pt-BR')} · {f.tipo}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-red-300 text-red-700">
                        {f.acao === 'zerar_dia' ? 'Zerar tudo' : f.acao.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum feriado próximo</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Ações Rápidas */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-amber-100">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-[#1A3A5C] flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-amber-500" />
                Ações Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/producao">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 hover:shadow-md transition-all cursor-pointer group">
                    <ClipboardList className="w-6 h-6 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-semibold text-amber-900">Produção</p>
                    <p className="text-xs text-amber-600">Planejar semana</p>
                  </div>
                </Link>
                {/* v9.10.9: card "Romaneio" removido — a página /romaneio foi
                    inativada (o romaneio do motorista sai na impressão da
                    Produção). O código segue acessível via histórico do git. */}
                <Link href="/cardapio">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200 hover:shadow-md transition-all cursor-pointer group">
                    <CalendarDays className="w-6 h-6 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-semibold text-purple-900">Cardápio</p>
                    <p className="text-xs text-purple-600">Semestre letivo</p>
                  </div>
                </Link>
                <Link href="/configuracoes">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 hover:shadow-md transition-all cursor-pointer group">
                    <Wheat className="w-6 h-6 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-semibold text-emerald-900">Configurações</p>
                    <p className="text-xs text-emerald-600">Escolas e quantidades</p>
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
