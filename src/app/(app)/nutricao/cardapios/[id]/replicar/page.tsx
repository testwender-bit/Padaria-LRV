'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ArrowLeft, RefreshCw, Copy, Users, Sandwich, Cookie, CheckCircle2, XCircle,
  AlertTriangle, Calendar, Info, Sparkles, Layers, CalendarOff
} from 'lucide-react'
import { toast } from 'sonner'
import { DIAS_SEMANA_ISO } from '@/lib/preparacao-categorias'

// ── Types ────────────────────────────────────────────────────

interface CardapioInfo {
  id: string
  nome: string
  ano: number
  semestre: number
  ciclo_semanas: number
  escola_id: string | null
  categoria_escola: string
  semanas: {
    id: string
    numero: number
    dias: {
      dia_semana: string
      itens: {
        preparacao: { id: string; nome: string; categoria: string }
      }[]
    }[]
  }[]
}

interface Escola {
  id: string
  nome: string
  nome_curto: string
  categoria: string
  segmento: string
  alunos_parcial: number
  alunos_integral: number
  dia_pao_frances: string | null
  dia_lanche: string | null
  ativo: boolean
}

interface EscolaConfig {
  escola_id: string
  dia_pao: string | null
  dia_lanche: string | null
}

interface ReplicarResponse {
  criados: {
    escola_id: string
    escola_nome: string
    cardapio_id: string
    trocas: { tipo: 'PAO' | 'LANCHE'; dia_origem: string; dia_destino: string; semanas_afetadas: number }[]
    feriados_marcados?: number
  }[]
  erros: { escola_id: string; motivo: string }[]
  base_info: {
    tem_pao: boolean
    tem_lanche: boolean
    dias_pao_base: string[]
    dias_lanche_base: string[]
  }
}

interface FeriadoSemestre {
  id: string
  data: string  // YYYY-MM-DD
  nome: string
  tipo: string
  escolas_afetadas: string
}

// ── Helpers ──────────────────────────────────────────────────

function diaPtToLabel(diaPt: string): string {
  const found = DIAS_SEMANA_ISO.find((d) => d.iso_pt === diaPt.toLowerCase())
  return found?.label || diaPt
}

function diaIsoToLabel(diaIso: string | null): string {
  if (!diaIso) return '—'
  const found = DIAS_SEMANA_ISO.find((d) => d.value === diaIso)
  return found?.label || diaIso
}

// ── Component ────────────────────────────────────────────────

export default function ReplicarCardapioPage() {
  const params = useParams()
  const router = useRouter()
  const cardapioId = params.id as string

  const [cardapio, setCardapio] = useState<CardapioInfo | null>(null)
  const [escolas, setEscolas] = useState<Escola[]>([])
  const [loading, setLoading] = useState(true)
  const [replicando, setReplicando] = useState(false)
  const [resultado, setResultado] = useState<ReplicarResponse | null>(null)

  // Escolas selecionadas e suas configurações de dia_pao / dia_lanche
  const [configs, setConfigs] = useState<Record<string, EscolaConfig>>({})
  const [expandirParaSemestre, setExpandirParaSemestre] = useState(true)
  const [sobrescreverExistente, setSobrescreverExistente] = useState(false)
  // v8: feriados do semestre
  const [feriados, setFeriados] = useState<FeriadoSemestre[]>([])
  const [marcarFeriados, setMarcarFeriados] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [cardRes, escRes, ferRes] = await Promise.all([
        fetch(`/api/nutricao/cardapios/${cardapioId}`),
        fetch('/api/escolas'),
        fetch('/api/feriados'),
      ])
      const cardData = await cardRes.json()
      const escData = await escRes.json()
      const ferData = await ferRes.json()
      setCardapio(cardData)
      setEscolas(Array.isArray(escData) ? escData : [])
      setFeriados(Array.isArray(ferData) ? ferData : [])
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [cardapioId])

  useEffect(() => { loadData() }, [loadData])

  // ── Detecta se o cardápio base tem pão e/ou lanche ──
  const baseInfo = useMemo(() => {
    if (!cardapio) return { temPao: false, temLanche: false, diasPao: new Set<string>(), diasLanche: new Set<string>() }
    const diasPao = new Set<string>()
    const diasLanche = new Set<string>()
    for (const semana of cardapio.semanas) {
      for (const dia of semana.dias) {
        for (const item of dia.itens) {
          if (item.preparacao.categoria === 'PAO') diasPao.add(dia.dia_semana)
          if (item.preparacao.categoria === 'LANCHE') diasLanche.add(dia.dia_semana)
        }
      }
    }
    return {
      temPao: diasPao.size > 0,
      temLanche: diasLanche.size > 0,
      diasPao,
      diasLanche,
    }
  }, [cardapio])

  // Escolas filtradas pela mesma categoria do cardápio base
  const escolasFiltradas = useMemo(() => {
    if (!cardapio) return []
    return escolas.filter((e) => e.ativo && e.categoria === cardapio.categoria_escola)
  }, [escolas, cardapio])

  function toggleEscola(escolaId: string) {
    setConfigs((prev) => {
      const next = { ...prev }
      if (next[escolaId]) {
        delete next[escolaId]
      } else {
        const escola = escolas.find((e) => e.id === escolaId)
        next[escolaId] = {
          escola_id: escolaId,
          // Default: usa o que está cadastrado na escola
          dia_pao: baseInfo.temPao ? (escola?.dia_pao_frances || null) : null,
          dia_lanche: baseInfo.temLanche ? (escola?.dia_lanche || null) : null,
        }
      }
      return next
    })
  }

  function updateDiaPao(escolaId: string, dia: string | null) {
    setConfigs((prev) => ({
      ...prev,
      [escolaId]: { ...prev[escolaId], dia_pao: dia },
    }))
  }

  function updateDiaLanche(escolaId: string, dia: string | null) {
    setConfigs((prev) => ({
      ...prev,
      [escolaId]: { ...prev[escolaId], dia_lanche: dia },
    }))
  }

  function selecionarTodasEscolas() {
    const next: Record<string, EscolaConfig> = {}
    for (const e of escolasFiltradas) {
      next[e.id] = {
        escola_id: e.id,
        dia_pao: baseInfo.temPao ? (e.dia_pao_frances || null) : null,
        dia_lanche: baseInfo.temLanche ? (e.dia_lanche || null) : null,
      }
    }
    setConfigs(next)
  }

  function limparSelecao() {
    setConfigs({})
  }

  // ── Enviar replicação ──
  async function handleReplicar() {
    const escolasArr = Object.values(configs)
    if (escolasArr.length === 0) {
      toast.error('Selecione ao menos uma escola')
      return
    }

    // Validações por escola
    for (const c of escolasArr) {
      if (baseInfo.temPao && !c.dia_pao) {
        toast.error(`Escola precisa de dia de pão definido (base tem pão)`)
        return
      }
      if (baseInfo.temLanche && !c.dia_lanche) {
        toast.error(`Escola precisa de dia de lanche definido (base tem lanche)`)
        return
      }
    }

    setReplicando(true)
    setResultado(null)
    try {
      const res = await fetch(`/api/nutricao/cardapios/${cardapioId}/replicar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          escolas: escolasArr,
          expandir_para_semestre: expandirParaSemestre,
          sobrescrever_existente: sobrescreverExistente,
          marcar_feriados: marcarFeriados,
          feriados: feriados.map(f => ({
            data: f.data,
            nome: f.nome,
            tipo: f.tipo,
            escolas_afetadas: f.escolas_afetadas,
          })),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao replicar')
      }
      const data: ReplicarResponse = await res.json()
      setResultado(data)

      if (data.criados.length > 0) {
        toast.success(`${data.criados.length} cardápio(s) criado(s) com sucesso`)
      }
      if (data.erros.length > 0) {
        toast.warning(`${data.erros.length} escola(s) com erro`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao replicar')
    } finally {
      setReplicando(false)
    }
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
      </div>
    )
  }

  if (!cardapio) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-red-500">Cardápio não encontrado</p>
        <Link href="/nutricao/cardapios">
          <Button variant="outline" size="sm" className="mt-3">Voltar</Button>
        </Link>
      </div>
    )
  }

  // Validação: cardápio precisa ser base (escola_id = null)
  if (cardapio.escola_id !== null) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto py-12">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <h2 className="text-lg font-bold text-amber-800">Este não é um cardápio base</h2>
            <p className="text-sm text-amber-700">
              A replicação só pode ser feita a partir de um <strong>cardápio base</strong> (sem escola vinculada).
              Este cardápio está associado à escola <strong>{cardapio.nome}</strong>.
            </p>
            <p className="text-xs text-amber-600">
              Para modificar este cardápio, use o editor. Para replicar, volte ao cardápio base original.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <Link href={`/nutricao/cardapios/${cardapioId}`}>
                <Button variant="outline" size="sm">
                  <ArrowLeft className="w-3 h-3 mr-1" /> Voltar ao editor
                </Button>
              </Link>
              <Link href="/nutricao/cardapios">
                <Button size="sm" className="bg-[#1A3A5C] hover:bg-[#1A3A5C]/90">
                  Ver todos os cardápios
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalSemanasBase = cardapio.ciclo_semanas || 5
  const escolasSelecionadasCount = Object.keys(configs).length

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <Link href={`/nutricao/cardapios/${cardapioId}`}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#1A3A5C] flex items-center gap-2">
              <Copy className="w-5 h-5 text-[#D4A017]" />
              Replicar Cardápio para Escolas
            </h1>
            <p className="text-xs text-muted-foreground">
              {cardapio.nome} · {cardapio.ano}/{cardapio.semestre} · {totalSemanasBase} semanas base
            </p>
          </div>
        </div>
      </motion.div>

      {/* Resumo do base */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-[#1A3A5C]/10 bg-gradient-to-br from-[#1A3A5C]/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#1A3A5C] flex items-center gap-2">
              <Info className="w-4 h-4" /> Resumo do Cardápio Base
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center gap-2 p-2 rounded-md bg-white/60 border border-[#1A3A5C]/10">
              <Layers className="w-4 h-4 text-[#1A3A5C]" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Semanas base</p>
                <p className="text-sm font-bold text-[#1A3A5C]">{totalSemanasBase}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-md bg-white/60 border border-[#1A3A5C]/10">
              <Sandwich className="w-4 h-4 text-[#B45309]" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Tem pão</p>
                <p className="text-sm font-bold text-[#1A3A5C]">
                  {baseInfo.temPao ? `Sim (${Array.from(baseInfo.diasPao).map(diaPtToLabel).join(', ')})` : 'Não'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-md bg-white/60 border border-[#1A3A5C]/10">
              <Cookie className="w-4 h-4 text-[#7C2D12]" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Tem lanche</p>
                <p className="text-sm font-bold text-[#1A3A5C]">
                  {baseInfo.temLanche ? `Sim (${Array.from(baseInfo.diasLanche).map(diaPtToLabel).join(', ')})` : 'Não'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-md bg-white/60 border border-[#1A3A5C]/10">
              <Users className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Escolas candidatas</p>
                <p className="text-sm font-bold text-[#1A3A5C]">{escolasFiltradas.length} ({cardapio.categoria_escola})</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Aviso se não tem pão nem lanche */}
      {!baseInfo.temPao && !baseInfo.temLanche && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-800">
                <strong>Nenhuma preparação de pão ou lanche encontrada no cardápio base.</strong>
                <br />
                Marque as preparações com categoria <code className="px-1 bg-amber-100 rounded">PAO</code> ou{' '}
                <code className="px-1 bg-amber-100 rounded">LANCHE</code> no cadastro de preparações para que o sistema saiba realocá-las.
                Sem isso, a replicação apenas copia o cardápio sem ajustar dias.
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Configurações gerais */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card className="border-[#1A3A5C]/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#1A3A5C]">
              Configurações da Replicação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={expandirParaSemestre}
                onCheckedChange={(v) => setExpandirParaSemestre(Boolean(v))}
              />
              <div>
                <p className="text-sm font-medium">Expandir para 22 semanas (semestre completo)</p>
                <p className="text-xs text-muted-foreground">
                  Gera 22 semanas: as {totalSemanasBase} base + réplicas automáticas (semana 6 = semana 1, etc). Desmarque para gerar apenas as {totalSemanasBase} semanas base.
                </p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={sobrescreverExistente}
                onCheckedChange={(v) => setSobrescreverExistente(Boolean(v))}
              />
              <div>
                <p className="text-sm font-medium">Sobrescrever cardápios existentes</p>
                <p className="text-xs text-muted-foreground">
                  Se uma escola já tem cardápio {cardapio.ano}/{cardapio.semestre}, deleta e recria. Caso contrário, pula e reporta erro.
                </p>
              </div>
            </label>

            {/* v8: Marcar feriados */}
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={marcarFeriados}
                onCheckedChange={(v) => setMarcarFeriados(Boolean(v))}
              />
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <CalendarOff className="w-3.5 h-3.5 text-red-500" />
                  Marcar feriados do semestre
                </p>
                <p className="text-xs text-muted-foreground">
                  Nos dias de feriado, os itens normais serão removidos (dia vazio) e a semana será marcada como diferenciada. Feriados em fins de semana são ignorados.
                </p>
              </div>
            </label>
          </CardContent>
        </Card>
      </motion.div>

      {/* v8: Lista de feriados do semestre */}
      {marcarFeriados && feriados.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <Card className="border-red-200/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#1A3A5C] flex items-center gap-2">
                <CalendarOff className="w-4 h-4 text-red-500" />
                Feriados do Semestre ({feriados.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {feriados.map((f) => {
                  // Formata data para dd/mm
                  const [y, m, d] = f.data.split('-')
                  const dataFmt = `${d}/${m}`
                  // Dia da semana
                  const dt = new Date(f.data + 'T12:00:00')
                  const diaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dt.getDay()]
                  const ehFimDeSemana = dt.getDay() === 0 || dt.getDay() === 6
                  return (
                    <div
                      key={f.id}
                      className={`p-2 rounded-md border flex items-center gap-2 text-xs ${
                        ehFimDeSemana
                          ? 'bg-gray-50 border-gray-200 opacity-60'
                          : 'bg-red-50/50 border-red-200'
                      }`}
                    >
                      <div className="flex-shrink-0 w-12 text-center">
                        <div className="font-bold text-[#1A3A5C]">{dataFmt}</div>
                        <div className="text-[9px] text-muted-foreground">{diaSemana}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{f.nome}</div>
                        <div className="text-[9px] text-muted-foreground flex items-center gap-1">
                          <Badge variant="outline" className="text-[8px] h-3 px-1">{f.tipo}</Badge>
                          {ehFimDeSemana && <span className="text-gray-500">(fim de semana — ignorado)</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {feriados.length > 0 && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  💡 Total de {feriados.filter(f => {
                    const dt = new Date(f.data + 'T12:00:00')
                    return dt.getDay() !== 0 && dt.getDay() !== 6
                  }).length} feriado(s) em dias úteis que serão marcados nos cardápios replicados.
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Aviso se não há feriados cadastrados */}
      {marcarFeriados && feriados.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-800">
                <strong>Nenhum feriado cadastrado.</strong> Cadastre feriados em <code className="px-1 bg-amber-100 rounded">/feriados</code> para que sejam automaticamente marcados nos cardápios replicados.
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Lista de escolas + configurador */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-[#1A3A5C]/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[#1A3A5C]">
                Escolas ({escolasSelecionadasCount} de {escolasFiltradas.length} selecionadas)
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selecionarTodasEscolas}
                  disabled={escolasFiltradas.length === 0}
                  className="text-xs h-7"
                >
                  Selecionar todas
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={limparSelecao}
                  disabled={escolasSelecionadasCount === 0}
                  className="text-xs h-7"
                >
                  Limpar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {escolasFiltradas.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhuma escola ativa com categoria <strong>{cardapio.categoria_escola}</strong> encontrada.
              </p>
            ) : (
              <ScrollArea className="h-[400px] border rounded-md">
                <div className="divide-y">
                  {escolasFiltradas.map((e) => {
                    const sel = !!configs[e.id]
                    const cfg = configs[e.id]
                    return (
                      <div
                        key={e.id}
                        className={`p-3 flex items-center gap-3 transition-colors ${
                          sel ? 'bg-[#1A3A5C]/5' : 'hover:bg-gray-50'
                        }`}
                      >
                        <Checkbox
                          checked={sel}
                          onCheckedChange={() => toggleEscola(e.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{e.nome}</span>
                            <Badge variant="outline" className="text-[9px] h-4">
                              {e.alunos_parcial}P + {e.alunos_integral}I
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Segmento: {e.segmento} · Pão padrão: {diaIsoToLabel(e.dia_pao_frances)} · Lanche padrão: {diaIsoToLabel(e.dia_lanche)}
                          </p>
                        </div>

                        {/* Configurações por escola (só aparecem se selecionada) */}
                        {sel && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {baseInfo.temPao && (
                              <div className="flex items-center gap-1">
                                <Sandwich className="w-3 h-3 text-[#B45309]" />
                                <Select
                                  value={cfg?.dia_pao || '__none__'}
                                  onValueChange={(v) => updateDiaPao(e.id, v === '__none__' ? null : v)}
                                >
                                  <SelectTrigger className="h-7 w-24 text-[10px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__" className="text-xs">—</SelectItem>
                                    {DIAS_SEMANA_ISO.map((d) => (
                                      <SelectItem key={d.value} value={d.value} className="text-xs">
                                        {d.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            {baseInfo.temLanche && (
                              <div className="flex items-center gap-1">
                                <Cookie className="w-3 h-3 text-[#7C2D12]" />
                                <Select
                                  value={cfg?.dia_lanche || '__none__'}
                                  onValueChange={(v) => updateDiaLanche(e.id, v === '__none__' ? null : v)}
                                >
                                  <SelectTrigger className="h-7 w-24 text-[10px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__" className="text-xs">—</SelectItem>
                                    {DIAS_SEMANA_ISO.map((d) => (
                                      <SelectItem key={d.value} value={d.value} className="text-xs">
                                        {d.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Ação principal */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="flex justify-end gap-2"
      >
        <Link href={`/nutricao/cardapios/${cardapioId}`}>
          <Button variant="outline" size="sm" disabled={replicando}>
            Cancelar
          </Button>
        </Link>
        <Button
          size="sm"
          onClick={handleReplicar}
          disabled={replicando || escolasSelecionadasCount === 0}
          className="bg-[#1A3A5C] hover:bg-[#1A3A5C]/90"
        >
          {replicando ? (
            <>
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Replicando...
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 mr-1" /> Replicar para {escolasSelecionadasCount} escola(s)
            </>
          )}
        </Button>
      </motion.div>

      {/* Resultado */}
      {resultado && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <Card className="border-[#1A3A5C]/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#1A3A5C] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#D4A017]" />
                Resultado da Replicação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded-md bg-emerald-50 border border-emerald-100">
                  <p className="text-[10px] text-emerald-600 uppercase">Criados</p>
                  <p className="text-lg font-bold text-emerald-700">{resultado.criados.length}</p>
                </div>
                <div className="p-2 rounded-md bg-red-50 border border-red-100">
                  <p className="text-[10px] text-red-600 uppercase">Erros</p>
                  <p className="text-lg font-bold text-red-700">{resultado.erros.length}</p>
                </div>
                <div className="p-2 rounded-md bg-blue-50 border border-blue-100">
                  <p className="text-[10px] text-blue-600 uppercase">Total</p>
                  <p className="text-lg font-bold text-blue-700">
                    {resultado.criados.length + resultado.erros.length}
                  </p>
                </div>
              </div>

              {/* Lista de criados */}
              {resultado.criados.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#1A3A5C] uppercase">Cardápios criados:</p>
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-1.5">
                      {resultado.criados.map((c) => (
                        <div
                          key={c.cardapio_id}
                          className="p-2 rounded-md bg-emerald-50/50 border border-emerald-100 flex items-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{c.escola_nome}</p>
                            {c.trocas.length > 0 ? (
                              <p className="text-[10px] text-muted-foreground">
                                {c.trocas.map((t, i) => (
                                  <span key={i}>
                                    {i > 0 && ' · '}
                                    {t.tipo === 'PAO' ? '🍞' : '🍪'} {t.dia_origem} → {t.dia_destino} ({t.semanas_afetadas} sem)
                                  </span>
                                ))}
                              </p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground">Sem trocas de dia</p>
                            )}
                          </div>
                          <Link href={`/nutricao/cardapios/${c.cardapio_id}`}>
                            <Button variant="outline" size="sm" className="text-[10px] h-6">
                              Abrir
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Lista de erros */}
              {resultado.erros.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-red-600 uppercase">Erros:</p>
                  <div className="space-y-1">
                    {resultado.erros.map((e, i) => {
                      const escola = escolas.find((es) => es.id === e.escola_id)
                      return (
                        <div
                          key={i}
                          className="p-2 rounded-md bg-red-50 border border-red-100 flex items-center gap-2"
                        >
                          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium">{escola?.nome || e.escola_id}</p>
                            <p className="text-[10px] text-red-600">{e.motivo}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Próximos passos */}
              {resultado.criados.length > 0 && (
                <div className="p-3 rounded-md bg-[#1A3A5C]/5 border border-[#1A3A5C]/10">
                  <p className="text-xs font-semibold text-[#1A3A5C] mb-1">Próximos passos:</p>
                  <ol className="text-[10px] text-muted-foreground space-y-0.5 list-decimal list-inside">
                    <li>Abra cada cardápio criado e revise as semanas.</li>
                    <li>Use o botão <strong>"Diferenciar Semana"</strong> no editor para marcar semanas ajustadas manualmente.</li>
                    <li>Para comparar com o base, use a página <strong>"Comparar com Base"</strong> no menu do cardápio.</li>
                  </ol>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
