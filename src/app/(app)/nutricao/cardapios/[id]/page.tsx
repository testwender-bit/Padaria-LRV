'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ArrowLeft, FileText, Save, ChevronLeft, ChevronRight, Plus, Search,
  Trash2, RefreshCw, AlertTriangle, CheckCircle, XCircle, Menu, X, Clock, Users,
  Copy, Check
} from 'lucide-react'
import { toast } from 'sonner'
import {
  calcularResumoSemana,
  calcularNutrientesRefeicao,
  calcularPercapitaPorFase,
  emptyNutrienteDia,
  somarNutrientes,
  DIAS_SEMANA_NUTRI,
  CATEGORIAS_ESCOLA_NUTRI,
  FASES_ESCOLARES,
  type NutrienteDia,
  type ResumoNutricionalSemana,
  type FaseEscolar,
} from '@/lib/nutricao-utils'

// ── Types ──────────────────────────────────────────────────────

interface TipoRefeicao {
  id: string
  codigo: string
  nome: string
  horario: string
  ordem: number
}

interface Alimento {
  id: string
  nome: string
  grupo: string
  medida_caseira: string
  gramas_por_medida: number
  energia_kcal: number
  carboidratos_g: number
  proteinas_g: number
  lipidios_g: number
  fibra_alimentar_g: number
  sodio_mg: number
  ferro_mg: number
  ferro_heme_mg: number
  vitamina_a_mcg: number
  vitamina_c_mg: number
  calcio_mg: number
  magnesio_mg: number
  zinco_mg: number
  acucar_adicionado_g: number
}

interface PercapitaData {
  id: string
  ingrediente_id: string
  fase_escolar: string
  quantidade_gramas: number
  auto_calculado: boolean
}

interface IngredienteComAlimento {
  id: string
  quantidade_gramas: number
  mesma_percapita: boolean
  alimento: Alimento
  percapitas: PercapitaData[]
}

interface Preparacao {
  id: string
  nome: string
  descricao: string | null
  ingredientes: IngredienteComAlimento[]
}

interface CardapioItem {
  id: string
  tipo_refeicao_id: string
  preparacao_id: string
  porcoes: number
  tipo_refeicao: TipoRefeicao
  preparacao: Preparacao
}

interface CardapioDia {
  id: string
  dia_semana: string
  itens: CardapioItem[]
}

interface CardapioSemana {
  id: string
  numero: number
  data_inicio: string
  data_fim: string
  dias: CardapioDia[]
}

interface CardapioFull {
  id: string
  nome: string
  escola_id: string | null
  categoria_escola: string
  fase_escolar: string
  status: string
  ano: number
  semestre: number
  escola?: { id: string; nome: string } | null
  nutricionista?: { id: string; nome: string } | null
  semanas: CardapioSemana[]
}

interface MetaNutricional {
  id: string
  tipo_refeicao_id: string
  categoria_escola: string
  energia_kcal_min: number
  energia_kcal_max: number
  carboidratos_pct_min: number
  carboidratos_pct_max: number
  proteinas_pct_min: number
  proteinas_pct_max: number
  lipidios_pct_min: number
  lipidios_pct_max: number
  sodio_mg_max: number
  ferro_mg_min: number
  ferro_heme_dias_semana: number
  vitamina_a_mcg_min: number
  vitamina_a_dias_semana: number
  vitamina_c_mg_min: number
  acucar_pct_max: number
  acucar_proibido_menor3: boolean
}

interface CategoriaRefeicao {
  id: string
  categoria_escola: string
  tipo_refeicao_id: string
  percentual_energia: number
  tipo_refeicao: TipoRefeicao
}

// ── Helpers ────────────────────────────────────────────────────

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

function getFaseLabel(fase: string) {
  const f = FASES_ESCOLARES.find(fs => fs.value === fase)
  return f ? `${f.label} (${f.faixa})` : fase
}

function getFaseColor(fase: string) {
  const f = FASES_ESCOLARES.find(fs => fs.value === fase)
  return f?.cor || '#1A3A5C'
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function getAlertaIcon(tipo: string) {
  switch (tipo) {
    case 'CRITICO': return <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
    case 'ATENCAO': return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
    default: return <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
  }
}

function getAlertaBg(tipo: string) {
  switch (tipo) {
    case 'CRITICO': return 'bg-red-50 border-red-100'
    case 'ATENCAO': return 'bg-amber-50 border-amber-100'
    default: return 'bg-emerald-50 border-emerald-100'
  }
}

// ── Component ──────────────────────────────────────────────────

export default function CardapioEditorPage() {
  const params = useParams()
  const router = useRouter()
  const cardapioId = params.id as string

  const [cardapio, setCardapio] = useState<CardapioFull | null>(null)
  const [preparacoes, setPreparacoes] = useState<Preparacao[]>([])
  const [tiposRefeicao, setTiposRefeicao] = useState<TipoRefeicao[]>([])
  const [categoriasRefeicao, setCategoriasRefeicao] = useState<CategoriaRefeicao[]>([])
  const [metas, setMetas] = useState<MetaNutricional[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [currentSemana, setCurrentSemana] = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Add preparations dialog (multi-select)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addDiaId, setAddDiaId] = useState<string | null>(null)
  const [addTipoRefeicaoId, setAddTipoRefeicaoId] = useState<string | null>(null)
  const [addPrepSearch, setAddPrepSearch] = useState('')
  const [addSelectedPrepIds, setAddSelectedPrepIds] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)

  // Fase escolar selector
  const [faseDialogOpen, setFaseDialogOpen] = useState(false)
  const [selectedFase, setSelectedFase] = useState<string>('FUND_FINAL')

  // Copy day dialog — multi-day support
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [copyOrigemSemana, setCopyOrigemSemana] = useState<number>(1)
  const [copyOrigemDias, setCopyOrigemDias] = useState<Set<string>>(new Set())
  const [copyDestinoSemana, setCopyDestinoSemana] = useState<number>(1)
  const [copyDestinoDias, setCopyDestinoDias] = useState<Set<string>>(new Set())
  const [copying, setCopying] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cardRes, prepRes, tipoRes, catRes, metaRes] = await Promise.all([
        fetch(`/api/nutricao/cardapios/${cardapioId}`),
        fetch('/api/nutricao/preparacoes'),
        fetch('/api/nutricao/tipos-refeicao'),
        fetch('/api/nutricao/categorias-refeicao'),
        fetch('/api/nutricao/metas'),
      ])
      if (!cardRes.ok) throw new Error('Erro ao carregar cardápio')
      const cardData = await cardRes.json()
      const prepData = prepRes.ok ? await prepRes.json() : []
      const tipoData = tipoRes.ok ? await tipoRes.json() : []
      const catData = catRes.ok ? await catRes.json() : []
      const metaData = metaRes.ok ? await metaRes.json() : []
      setCardapio(cardData)
      setSelectedFase(cardData.fase_escolar || 'FUND_FINAL')
      setPreparacoes(Array.isArray(prepData) ? prepData : [])
      setTiposRefeicao(Array.isArray(tipoData) ? tipoData : [])
      setCategoriasRefeicao(Array.isArray(catData) ? catData : [])
      setMetas(Array.isArray(metaData) ? metaData : [])
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar o cardápio.')
    } finally {
      setLoading(false)
    }
  }, [cardapioId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Refeições for the current category (with schedule info)
  const refeicoesForCategoria = useMemo(() => {
    if (!cardapio) return []
    return categoriasRefeicao
      .filter((cr) => cr.categoria_escola === cardapio.categoria_escola)
      .sort((a, b) => a.tipo_refeicao.ordem - b.tipo_refeicao.ordem)
  }, [cardapio, categoriasRefeicao])

  // Current semana data
  const semanaAtual = useMemo(() => {
    if (!cardapio) return null
    return cardapio.semanas.find((s) => s.numero === currentSemana) || null
  }, [cardapio, currentSemana])

  // Get items for a specific day + refeição
  function getItensForSlot(diaSemana: string, tipoRefeicaoId: string): CardapioItem[] {
    if (!semanaAtual) return []
    const dia = semanaAtual.dias.find((d) => d.dia_semana === diaSemana)
    if (!dia) return []
    return dia.itens.filter((i) => i.tipo_refeicao_id === tipoRefeicaoId)
  }

  // Get percapita-adjusted gramas for an ingredient based on cardápio's fase_escolar
  function getGramasForFase(ing: IngredienteComAlimento): number {
    if (!cardapio) return ing.quantidade_gramas
    if (ing.mesma_percapita) return ing.quantidade_gramas
    const percapita = ing.percapitas?.find(p => p.fase_escolar === cardapio.fase_escolar)
    if (percapita) return percapita.quantidade_gramas
    return calcularPercapitaPorFase(ing.quantidade_gramas, cardapio.fase_escolar as FaseEscolar)
  }

  // Calculate nutritional summary for current week
  const resumoNutricional = useMemo((): ResumoNutricionalSemana | null => {
    if (!semanaAtual || !cardapio) return null

    const diasNutrientes: NutrienteDia[] = []
    for (const dia of semanaAtual.dias) {
      const diaNutri = dia.itens.reduce<NutrienteDia>((acc, item) => {
        const refeicaoNutri = calcularNutrientesRefeicao([{
          preparacao: {
            ingredientes: item.preparacao.ingredientes.map((ing) => ({
              quantidade_gramas: getGramasForFase(ing),
              alimento: ing.alimento,
            })),
          },
          porcoes: item.porcoes,
        }])
        return somarNutrientes(acc, refeicaoNutri)
      }, emptyNutrienteDia())
      diasNutrientes.push(diaNutri)
    }

    const meta = metas.find((m) => m.categoria_escola === cardapio.categoria_escola)
    if (!meta) {
      return {
        media_dia: diasNutrientes.length > 0 ? diasNutrientes.reduce(somarNutrientes, emptyNutrienteDia()) : emptyNutrienteDia(),
        alertas: [],
        dias_com_ferro_heme: 0,
        dias_com_vitamina_a: 0,
        percentuais: { carboidratos_pct: 0, proteinas_pct: 0, lipidios_pct: 0, acucar_pct: 0 },
      }
    }

    return calcularResumoSemana(diasNutrientes, {
      energia_kcal_min: meta.energia_kcal_min,
      energia_kcal_max: meta.energia_kcal_max,
      carboidratos_pct_min: meta.carboidratos_pct_min,
      carboidratos_pct_max: meta.carboidratos_pct_max,
      proteinas_pct_min: meta.proteinas_pct_min,
      proteinas_pct_max: meta.proteinas_pct_max,
      lipidios_pct_min: meta.lipidios_pct_min,
      lipidios_pct_max: meta.lipidios_pct_max,
      sodio_mg_max: meta.sodio_mg_max,
      ferro_mg_min: meta.ferro_mg_min,
      ferro_heme_dias_semana: meta.ferro_heme_dias_semana,
      vitamina_a_mcg_min: meta.vitamina_a_mcg_min,
      vitamina_a_dias_semana: meta.vitamina_a_dias_semana,
      vitamina_c_mg_min: meta.vitamina_c_mg_min,
      acucar_pct_max: meta.acucar_pct_max,
      acucar_proibido_menor3: meta.acucar_proibido_menor3,
    }, cardapio.categoria_escola)
  }, [semanaAtual, cardapio, metas])

  // Open add dialog for a specific slot
  function openAddDialog(diaId: string, tipoRefeicaoId: string) {
    setAddDiaId(diaId)
    setAddTipoRefeicaoId(tipoRefeicaoId)
    setAddPrepSearch('')
    setAddSelectedPrepIds(new Set())
    setAddDialogOpen(true)
  }

  // Toggle preparation selection
  function togglePrepSelection(prepId: string) {
    setAddSelectedPrepIds(prev => {
      const next = new Set(prev)
      if (next.has(prepId)) next.delete(prepId)
      else next.add(prepId)
      return next
    })
  }

  // Add all selected preparations
  async function handleAddPreparacoes() {
    if (!addDiaId || addSelectedPrepIds.size === 0) return
    setAdding(true)
    try {
      const items = Array.from(addSelectedPrepIds).map(prepId => ({
        dia_id: addDiaId,
        tipo_refeicao_id: addTipoRefeicaoId,
        preparacao_id: prepId,
        porcoes: 1,
      }))

      const res = await fetch(`/api/nutricao/cardapios/${cardapioId}/item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Erro ao adicionar preparações')
      }
      toast.success(`${addSelectedPrepIds.size} preparação(ões) adicionada(s)`)
      setAddDialogOpen(false)
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao adicionar preparações')
    } finally {
      setAdding(false)
    }
  }

  async function handleRemoveItem(itemId: string) {
    try {
      const res = await fetch(`/api/nutricao/cardapios/${cardapioId}/item`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId }),
      })
      if (!res.ok) throw new Error('Erro ao remover preparação')
      toast.success('Preparação removida')
      loadData()
    } catch {
      toast.error('Erro ao remover preparação')
    }
  }

  // Remove all items from a slot (refeição in a day)
  async function handleClearSlot(diaSemana: string, tipoRefeicaoId: string) {
    if (!semanaAtual) return
    const dia = semanaAtual.dias.find(d => d.dia_semana === diaSemana)
    if (!dia) return
    const itens = dia.itens.filter(i => i.tipo_refeicao_id === tipoRefeicaoId)
    if (itens.length === 0) return

    try {
      await Promise.all(itens.map(item =>
        fetch(`/api/nutricao/cardapios/${cardapioId}/item`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: item.id }),
        })
      ))
      toast.success('Refeição limpa')
      loadData()
    } catch {
      toast.error('Erro ao limpar refeição')
    }
  }

  async function handleSaveFase() {
    if (!cardapio) return
    setSaving(true)
    try {
      const res = await fetch(`/api/nutricao/cardapios/${cardapioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fase_escolar: selectedFase }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      toast.success('Fase escolar atualizada')
      setFaseDialogOpen(false)
      loadData()
    } catch {
      toast.error('Erro ao salvar fase escolar')
    } finally {
      setSaving(false)
    }
  }

  async function handleApprove() {
    if (!cardapio) return
    setSaving(true)
    try {
      const res = await fetch(`/api/nutricao/cardapios/${cardapioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APROVADO' }),
      })
      if (!res.ok) throw new Error('Erro ao aprovar')
      toast.success('Cardápio aprovado')
      loadData()
    } catch {
      toast.error('Erro ao aprovar cardápio')
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (!cardapio) return
    setSaving(true)
    try {
      const res = await fetch(`/api/nutricao/cardapios/${cardapioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fase_escolar: selectedFase }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      toast.success('Cardápio salvo')
      loadData()
    } catch {
      toast.error('Erro ao salvar cardápio')
    } finally {
      setSaving(false)
    }
  }

  // Open copy dialog — pre-select the clicked day
  function openCopyDialog(diaSemana: string, semanaNumero: number) {
    setCopyOrigemSemana(semanaNumero)
    setCopyOrigemDias(new Set([diaSemana]))
    setCopyDestinoSemana(semanaNumero === totalSemanas ? 1 : semanaNumero + 1)
    setCopyDestinoDias(new Set([diaSemana])) // same weekday by default
    setCopyDialogOpen(true)
  }

  // Toggle a day in a Set
  function toggleDiaInSet(dia: string, set: Set<string>, setter: (s: Set<string>) => void) {
    const next = new Set(set)
    if (next.has(dia)) next.delete(dia)
    else next.add(dia)
    setter(next)
  }

  // Select / deselect all weekdays
  function toggleAllDias(set: Set<string>, setter: (s: Set<string>) => void, select: boolean) {
    if (select) {
      setter(new Set(DIAS_SEMANA_NUTRI.map(d => d.value)))
    } else {
      setter(new Set())
    }
  }

  // "Match same days" — sets destination days = origin days
  function matchDestinoToOrigem() {
    setCopyDestinoDias(new Set(copyOrigemDias))
  }

  async function handleCopyDays() {
    if (copyOrigemDias.size === 0 || copyDestinoDias.size === 0) {
      toast.error('Selecione pelo menos um dia de origem e um de destino')
      return
    }

    // Build the mapping: origin days → destination days (sequential by weekday order)
    const origemSorted = DIAS_SEMANA_NUTRI.filter(d => copyOrigemDias.has(d.value))
    const destinoSorted = DIAS_SEMANA_NUTRI.filter(d => copyDestinoDias.has(d.value))

    if (origemSorted.length !== destinoSorted.length) {
      toast.error('Selecione a mesma quantidade de dias na origem e no destino')
      return
    }

    // Check for same source == destination
    const hasConflict = origemSorted.some((o, i) =>
      o.value === destinoSorted[i].value && copyOrigemSemana === copyDestinoSemana
    )
    if (hasConflict) {
      toast.error('Pelo menos um dia de origem é igual ao destino')
      return
    }

    const origens = origemSorted.map((o, i) => ({
      origem_semana: copyOrigemSemana,
      origem_dia: o.value,
      destino_semana: copyDestinoSemana,
      destino_dia: destinoSorted[i].value,
    }))

    setCopying(true)
    try {
      const res = await fetch(`/api/nutricao/cardapios/${cardapioId}/copiar-dia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origens, limpar_destino: true }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Erro ao copiar')
      }
      const result = await res.json()
      toast.success(`${result.total_itens_copiados} preparação(ões) copiada(s) em ${result.dias_copiados} dia(s) — Semana ${copyDestinoSemana}`)
      setCopyDialogOpen(false)
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao copiar dias')
    } finally {
      setCopying(false)
    }
  }

  const filteredPreparacoes = useMemo(() =>
    preparacoes.filter((p) =>
      p.nome.toLowerCase().includes(addPrepSearch.toLowerCase())
    ),
    [preparacoes, addPrepSearch]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
          <span className="text-muted-foreground">Carregando cardápio...</span>
        </div>
      </div>
    )
  }

  if (error || !cardapio) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-red-500 mb-3">{error || 'Cardápio não encontrado.'}</p>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="w-3 h-3 mr-1" /> Tentar novamente
        </Button>
      </div>
    )
  }

  const totalSemanas = cardapio.semanas.length || 22
  const faseInfo = FASES_ESCOLARES.find(f => f.value === cardapio.fase_escolar)

  return (
    <div className="space-y-3 max-w-[1600px] mx-auto">
      {/* Top Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-xl border border-[#1A3A5C]/10 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <Link href="/nutricao/cardapios">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#1A3A5C] truncate">{cardapio.nome}</h1>
              {getStatusBadge(cardapio.status)}
            </div>
            <p className="text-xs text-muted-foreground">
              {cardapio.escola?.nome || 'Modelo base'} · {cardapio.ano}/{cardapio.semestre}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Fase escolar badge */}
          <button
            onClick={() => setFaseDialogOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors hover:bg-gray-50"
            style={{ borderColor: faseInfo?.cor || '#1A3A5C', color: faseInfo?.cor || '#1A3A5C' }}
          >
            <Users className="w-3 h-3" />
            {faseInfo?.label || cardapio.fase_escolar}
            <span className="text-[10px] opacity-70">({faseInfo?.faixa || '—'})</span>
          </button>

          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            <span className="ml-1 text-xs">Resumo</span>
          </Button>
          <Link href={`/nutricao/cardapios/${cardapioId}/pdf`}>
            <Button variant="outline" size="sm" className="text-xs">
              <FileText className="w-3 h-3 mr-1" /> PDF
            </Button>
          </Link>
          {cardapio.status === 'RASCUNHO' && (
            <Button variant="outline" size="sm" className="text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={handleApprove} disabled={saving}>
              <CheckCircle className="w-3 h-3 mr-1" /> Aprovar
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-[#1A3A5C] hover:bg-[#1A3A5C]/90 text-xs">
            <Save className="w-3 h-3 mr-1" /> Salvar
          </Button>
        </div>
      </motion.div>

      {/* Week Navigation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center justify-between bg-white p-2 rounded-xl border border-[#1A3A5C]/10"
      >
        <Button variant="ghost" size="sm" onClick={() => setCurrentSemana(Math.max(1, currentSemana - 1))} disabled={currentSemana <= 1}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#1A3A5C]">Semana {currentSemana}</span>
          {semanaAtual && (
            <span className="text-xs text-muted-foreground">
              ({formatDate(semanaAtual.data_inicio)} — {formatDate(semanaAtual.data_fim)})
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setCurrentSemana(Math.min(totalSemanas, currentSemana + 1))} disabled={currentSemana >= totalSemanas}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </motion.div>

      {/* Refeições Schedule Bar */}
      {refeicoesForCategoria.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-[#1A3A5C]/10 overflow-x-auto"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1A3A5C] flex-shrink-0">
            <Clock className="w-3.5 h-3.5" />
            Horários:
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {refeicoesForCategoria.map((cr) => (
              <div key={cr.tipo_refeicao_id} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 border border-gray-100 text-xs">
                <span className="font-medium text-[#1A3A5C]">{cr.tipo_refeicao.nome}</span>
                <Badge variant="outline" className="text-[9px] h-4 px-1 border-[#1A3A5C]/20">{cr.tipo_refeicao.horario}</Badge>
                <span className="text-[9px] text-muted-foreground">{cr.percentual_energia}% VET</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Main Content */}
      <div className="flex gap-3">
        {/* Grid: 5 columns for days */}
        <div className="flex-1 min-w-0">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-5 gap-2"
          >
            {DIAS_SEMANA_NUTRI.map((dia) => {
              const diaData = semanaAtual?.dias.find((d) => d.dia_semana === dia.value)
              return (
                <div key={dia.value} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Day Header with Copy button */}
                  <div className="bg-[#1A3A5C] text-white py-1.5 px-2 flex items-center justify-between">
                    <span className="text-xs font-semibold">{dia.label}</span>
                    <button
                      onClick={() => openCopyDialog(dia.value, currentSemana)}
                      className="text-white/70 hover:text-white transition-colors"
                      title="Copiar refeições para outro dia"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Refeição slots */}
                  <div className="p-1.5 space-y-1.5">
                    {refeicoesForCategoria.map((cr) => {
                      const itens = getItensForSlot(dia.value, cr.tipo_refeicao_id)
                      return (
                        <div key={cr.tipo_refeicao_id} className="border border-gray-100 rounded-lg p-1.5 bg-gray-50/50">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-semibold text-[#1A3A5C] truncate">{cr.tipo_refeicao.nome}</span>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-[8px] h-4 px-1">{cr.tipo_refeicao.horario}</Badge>
                              {itens.length > 0 && (
                                <button
                                  onClick={() => handleClearSlot(dia.value, cr.tipo_refeicao_id)}
                                  className="text-red-300 hover:text-red-500 transition-colors"
                                  title="Limpar refeição"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Preparações list — no porção display */}
                          {itens.map((item) => (
                            <div key={item.id} className="flex items-center gap-1 mb-1 p-1 rounded bg-white border border-gray-100 text-[10px] group">
                              <span className="flex-1 truncate font-medium">{item.preparacao.nome}</span>
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                className="text-red-300 hover:text-red-500 ml-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remover preparação"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                          {/* Add button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-5 text-[9px] text-muted-foreground hover:text-[#1A3A5C] hover:bg-[#1A3A5C]/5"
                            onClick={() => {
                              if (diaData) {
                                openAddDialog(diaData.id, cr.tipo_refeicao_id)
                              }
                            }}
                          >
                            <Plus className="w-2.5 h-2.5 mr-0.5" /> Adicionar
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </motion.div>
        </div>

        {/* Right Sidebar */}
        {(sidebarOpen || typeof window !== 'undefined') && (
          <div className={`w-80 flex-shrink-0 ${sidebarOpen ? 'block' : 'hidden lg:block'}`}>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-[#1A3A5C]/10 sticky top-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-[#1A3A5C]">
                    Resumo Nutricional — Semana {currentSemana}
                  </CardTitle>
                  <div className="text-[10px] text-muted-foreground">
                    Cálculo para: <span className="font-medium" style={{ color: faseInfo?.cor || '#1A3A5C' }}>{faseInfo?.label} ({faseInfo?.faixa})</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {resumoNutricional ? (
                    <>
                      {/* Media Dia Table */}
                      <div className="text-[10px] space-y-1">
                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                          {[
                            { label: 'Energia', value: `${resumoNutricional.media_dia.energia_kcal.toFixed(0)} kcal` },
                            { label: 'Carboidratos', value: `${resumoNutricional.media_dia.carboidratos_g.toFixed(1)} g` },
                            { label: 'Proteínas', value: `${resumoNutricional.media_dia.proteinas_g.toFixed(1)} g` },
                            { label: 'Lipídios', value: `${resumoNutricional.media_dia.lipidios_g.toFixed(1)} g` },
                            { label: 'Fibra', value: `${resumoNutricional.media_dia.fibra_alimentar_g.toFixed(1)} g` },
                            { label: 'Sódio', value: `${resumoNutricional.media_dia.sodio_mg.toFixed(0)} mg` },
                            { label: 'Ferro', value: `${resumoNutricional.media_dia.ferro_mg.toFixed(1)} mg` },
                            { label: 'Vit A', value: `${resumoNutricional.media_dia.vitamina_a_mcg.toFixed(0)} mcg` },
                            { label: 'Vit C', value: `${resumoNutricional.media_dia.vitamina_c_mg.toFixed(1)} mg` },
                          ].map((row) => (
                            <div key={row.label} className="flex justify-between">
                              <span className="text-muted-foreground">{row.label}</span>
                              <span className="font-medium text-[#1A3A5C]">{row.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Percentuais */}
                      <div className="border-t pt-2 space-y-1.5">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">Percentuais VET</p>
                        {[
                          { label: 'Carboidratos', pct: resumoNutricional.percentuais.carboidratos_pct, color: 'bg-blue-500' },
                          { label: 'Proteínas', pct: resumoNutricional.percentuais.proteinas_pct, color: 'bg-red-500' },
                          { label: 'Lipídios', pct: resumoNutricional.percentuais.lipidios_pct, color: 'bg-yellow-500' },
                          { label: 'Açúcar', pct: resumoNutricional.percentuais.acucar_pct, color: 'bg-pink-500' },
                        ].map((p) => (
                          <div key={p.label}>
                            <div className="flex justify-between text-[10px] mb-0.5">
                              <span className="text-muted-foreground">{p.label}</span>
                              <span className="font-medium">{p.pct.toFixed(1)}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full ${p.color} rounded-full transition-all`} style={{ width: `${Math.min(100, p.pct)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Key Metrics */}
                      <div className="border-t pt-2 grid grid-cols-2 gap-2">
                        <div className="p-2 rounded-lg bg-red-50 border border-red-100">
                          <p className="text-[9px] text-red-600">Ferro Heme</p>
                          <p className="text-sm font-bold text-red-800">{resumoNutricional.dias_com_ferro_heme}/4</p>
                          <p className="text-[8px] text-red-500">dias na semana</p>
                        </div>
                        <div className="p-2 rounded-lg bg-orange-50 border border-orange-100">
                          <p className="text-[9px] text-orange-600">Vitamina A</p>
                          <p className="text-sm font-bold text-orange-800">{resumoNutricional.dias_com_vitamina_a}/3</p>
                          <p className="text-[8px] text-orange-500">dias na semana</p>
                        </div>
                      </div>

                      {/* Alertas PNAE */}
                      <div className="border-t pt-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Alertas PNAE</p>
                        {resumoNutricional.alertas.length === 0 ? (
                          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                            <span className="text-[10px] text-emerald-700">Todos os indicadores OK</span>
                          </div>
                        ) : (
                          <ScrollArea className="max-h-40">
                            <div className="space-y-1">
                              {resumoNutricional.alertas.map((alerta, idx) => (
                                <div key={idx} className={`flex items-start gap-1.5 p-1.5 rounded-lg border ${getAlertaBg(alerta.tipo)}`}>
                                  {getAlertaIcon(alerta.tipo)}
                                  <span className="text-[9px] leading-tight">{alerta.mensagem}</span>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">Semana sem dados</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}
      </div>

      {/* ═══ Add Preparações Dialog (Multi-Select) ═══ */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#1A3A5C] text-sm">Adicionar Preparações</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={addPrepSearch}
                onChange={(e) => setAddPrepSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
                autoFocus
              />
            </div>

            {/* Selected count */}
            {addSelectedPrepIds.size > 0 && (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#1A3A5C]/5 border border-[#1A3A5C]/10">
                <Check className="w-3.5 h-3.5 text-[#1A3A5C]" />
                <span className="text-xs font-medium text-[#1A3A5C]">{addSelectedPrepIds.size} selecionada(s)</span>
                <button
                  onClick={() => setAddSelectedPrepIds(new Set())}
                  className="ml-auto text-[10px] text-muted-foreground hover:text-foreground underline"
                >
                  Limpar seleção
                </button>
              </div>
            )}

            {/* Preparations list with checkboxes */}
            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-1">
                {filteredPreparacoes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    {addPrepSearch ? 'Nenhuma preparação encontrada' : 'Nenhuma preparação cadastrada'}
                  </p>
                ) : (
                  filteredPreparacoes.map((p) => (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-xs ${
                        addSelectedPrepIds.has(p.id)
                          ? 'bg-[#1A3A5C]/10 border border-[#1A3A5C]/20'
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <Checkbox
                        checked={addSelectedPrepIds.has(p.id)}
                        onCheckedChange={() => togglePrepSelection(p.id)}
                        className="flex-shrink-0"
                      />
                      <span className="font-medium truncate">{p.nome}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">
                        {p.ingredientes.length} ingred.
                      </span>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(false)} disabled={adding}>Cancelar</Button>
            <Button
              size="sm"
              onClick={handleAddPreparacoes}
              disabled={adding || addSelectedPrepIds.size === 0}
              className="bg-[#1A3A5C] hover:bg-[#1A3A5C]/90"
            >
              {adding ? 'Adicionando...' : `Adicionar ${addSelectedPrepIds.size} preparação(ões)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Copy Days Dialog (Multi-Day) ═══ */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#1A3A5C] text-sm">
              <Copy className="w-4 h-4 inline mr-1.5" />
              Copiar Refeições
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* ── ORIGEM ── */}
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Origem</p>
                <button
                  onClick={() => toggleAllDias(copyOrigemDias, setCopyOrigemDias, copyOrigemDias.size < 5)}
                  className="text-[10px] text-[#1A3A5C] hover:underline font-medium"
                >
                  {copyOrigemDias.size >= 5 ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              </div>
              <Select
                value={String(copyOrigemSemana)}
                onValueChange={(v) => setCopyOrigemSemana(Number(v))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: totalSemanas }, (_, i) => i + 1).map(n => (
                    <SelectItem key={n} value={String(n)} className="text-xs">
                      Semana {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-1.5 flex-wrap">
                {DIAS_SEMANA_NUTRI.map(d => {
                  // Count items in this day to show badge
                  const diaData = cardapio?.semanas.find(s => s.numero === copyOrigemSemana)?.dias.find(dd => dd.dia_semana === d.value)
                  const itemCount = diaData?.itens.length || 0
                  const selected = copyOrigemDias.has(d.value)
                  return (
                    <button
                      key={d.value}
                      onClick={() => toggleDiaInSet(d.value, copyOrigemDias, setCopyOrigemDias)}
                      className={`px-2.5 py-1.5 rounded-md border text-[10px] font-medium transition-colors ${
                        selected
                          ? 'bg-[#1A3A5C] text-white border-[#1A3A5C]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#1A3A5C]/30'
                      }`}
                    >
                      {d.label}
                      {itemCount > 0 && (
                        <span className={`ml-1 text-[8px] ${selected ? 'text-white/70' : 'text-muted-foreground'}`}>
                          ({itemCount})
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Arrow indicator ── */}
            <div className="flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-[#1A3A5C]/10 flex items-center justify-center">
                <Copy className="w-3.5 h-3.5 text-[#1A3A5C]" />
              </div>
            </div>

            {/* ── DESTINO ── */}
            <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Destino</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={matchDestinoToOrigem}
                    className="text-[10px] text-[#1A3A5C] hover:underline font-medium"
                  >
                    Mesmos dias
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => toggleAllDias(copyDestinoDias, setCopyDestinoDias, copyDestinoDias.size < 5)}
                    className="text-[10px] text-[#1A3A5C] hover:underline font-medium"
                  >
                    {copyDestinoDias.size >= 5 ? 'Desmarcar todos' : 'Selecionar todos'}
                  </button>
                </div>
              </div>
              <Select
                value={String(copyDestinoSemana)}
                onValueChange={(v) => setCopyDestinoSemana(Number(v))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: totalSemanas }, (_, i) => i + 1).map(n => (
                    <SelectItem key={n} value={String(n)} className="text-xs">
                      Semana {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-1.5 flex-wrap">
                {DIAS_SEMANA_NUTRI.map((d, idx) => {
                  const selected = copyDestinoDias.has(d.value)
                  // Find which origin day maps to this destination day
                  const origemSorted = DIAS_SEMANA_NUTRI.filter(dd => copyOrigemDias.has(dd.value))
                  const destinoSorted = DIAS_SEMANA_NUTRI.filter(dd => copyDestinoDias.has(dd.value))
                  const destIdx = destinoSorted.findIndex(dd => dd.value === d.value)
                  const origemMatch = destIdx >= 0 && destIdx < origemSorted.length ? origemSorted[destIdx] : null
                  return (
                    <button
                      key={d.value}
                      onClick={() => toggleDiaInSet(d.value, copyDestinoDias, setCopyDestinoDias)}
                      className={`px-2.5 py-1.5 rounded-md border text-[10px] font-medium transition-colors relative ${
                        selected
                          ? 'bg-[#1A3A5C] text-white border-[#1A3A5C]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      {d.label}
                      {selected && origemMatch && (
                        <span className={`ml-1 text-[8px] ${selected ? 'text-white/70' : 'text-muted-foreground'}`}>
                          ← {origemMatch.label}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Mapping preview ── */}
            {copyOrigemDias.size > 0 && copyDestinoDias.size > 0 && copyOrigemDias.size === copyDestinoDias.size && (
              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Mapeamento</p>
                <div className="space-y-0.5">
                  {DIAS_SEMANA_NUTRI
                    .filter(d => copyOrigemDias.has(d.value))
                    .map((o, i) => {
                      const destSorted = DIAS_SEMANA_NUTRI.filter(d => copyDestinoDias.has(d.value))
                      const dest = destSorted[i]
                      const isConflict = o.value === dest?.value && copyOrigemSemana === copyDestinoSemana
                      return (
                        <div key={o.value} className={`text-[10px] flex items-center gap-1.5 ${isConflict ? 'text-red-500' : 'text-gray-600'}`}>
                          <span className="font-medium">{o.label}</span>
                          <span className="text-gray-300">→</span>
                          <span className={isConflict ? 'font-medium' : ''}>{dest?.label || '?'}</span>
                          {isConflict && <AlertTriangle className="w-3 h-3" />}
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {/* Count mismatch warning */}
            {copyOrigemDias.size > 0 && copyDestinoDias.size > 0 && copyOrigemDias.size !== copyDestinoDias.size && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Selecione a mesma quantidade de dias ({copyOrigemDias.size} origem ≠ {copyDestinoDias.size} destino)
              </p>
            )}

            <p className="text-[10px] text-muted-foreground">
              As refeições dos dias de destino serão substituídas. Os dias são mapeados na ordem: 1° dia origem → 1° dia destino, etc.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setCopyDialogOpen(false)} disabled={copying}>Cancelar</Button>
            <Button
              size="sm"
              onClick={handleCopyDays}
              disabled={copying || copyOrigemDias.size === 0 || copyDestinoDias.size === 0 || copyOrigemDias.size !== copyDestinoDias.size}
              className="bg-[#1A3A5C] hover:bg-[#1A3A5C]/90"
            >
              {copying ? 'Copiando...' : `Copiar ${copyOrigemDias.size} dia(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fase Escolar Dialog */}
      <Dialog open={faseDialogOpen} onOpenChange={setFaseDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1A3A5C] text-sm">Fase Escolar — Cálculo Percapita</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Selecione a fase escolar para definir qual percapita será usada nos cálculos nutricionais. Cada fase aplica um percentual sobre a quantidade base (Ens. Fund. Final = 100%).
            </p>
            <div className="space-y-2">
              {FASES_ESCOLARES.map((fase) => (
                <button
                  key={fase.value}
                  onClick={() => setSelectedFase(fase.value)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-colors text-left ${
                    selectedFase === fase.value
                      ? 'border-current bg-gray-50'
                      : 'border-gray-100 hover:bg-gray-50'
                  }`}
                  style={selectedFase === fase.value ? { borderColor: fase.cor, color: fase.cor } : undefined}
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: fase.cor }} />
                  <div className="flex-1">
                    <div className="text-xs font-semibold">{fase.label}</div>
                    <div className="text-[10px] text-muted-foreground">{fase.faixa} · {fase.percentual}% da base</div>
                  </div>
                  {selectedFase === fase.value && (
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setFaseDialogOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSaveFase} disabled={saving} className="bg-[#1A3A5C] hover:bg-[#1A3A5C]/90">
                {saving ? 'Salvando...' : 'Aplicar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
