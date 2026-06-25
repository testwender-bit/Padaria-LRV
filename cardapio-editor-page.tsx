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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ArrowLeft, FileText, Save, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus, Search,
  Trash2, RefreshCw, AlertTriangle, CheckCircle, XCircle, Menu, X, Clock, Users,
  Copy, Check, Repeat, Star, Zap, GripVertical, Smartphone, GitCompare, Unlock, Calendar, CalendarOff, Pencil, Clock as ClockIcon, ArrowDownUp, ArrowLeftRight
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
  limparNomeIngrediente,
} from '@/lib/nutricao-utils'
import { detectarAlergenosPreparacao, ALERGENOS_LIST } from '@/lib/alergenos-utils'
import { normalizeText } from '@/lib/busca-utils'
import { sortItensByRefeicao } from '@/lib/ordenacao-preparacoes'
import { PreparacaoFormDialog, type PreparacaoLite } from '@/components/preparacao-form-dialog'
import { parseHorarioToMinutes, ordenarPorHorario, contarHorarios, temMultiplosHorarios } from '@/lib/horario-utils'

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
  alimento_id: string  // v8: necessário para o sub-dialog de edição de preparação
  quantidade_gramas: number
  mesma_percapita: boolean
  alimento: Alimento
  percapitas: PercapitaData[]
}

interface Preparacao {
  id: string
  nome: string
  descricao: string | null
  modo_preparo: string | null  // v8: necessário para o sub-dialog de edição
  favorita: boolean
  vezes_usada: number
  categoria?: string  // v8: PREPARACAO | PAO | LANCHE | BEBIDA | SOBREMESA
  ingredientes: IngredienteComAlimento[]
}

interface CardapioItem {
  id: string
  tipo_refeicao_id: string
  preparacao_id: string
  porcoes: number
  ordem?: number  // v8: ordem de exibição (0 = auto-sort)
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
  diferenciada?: boolean  // v8: true se a semana foi manualmente ajustada vs base
  dias: CardapioDia[]
}

interface CardapioFull {
  id: string
  nome: string
  escola_id: string | null
  cardapio_base_id?: string | null  // v8: se preenchido, é instância replicada
  categoria_escola: string
  fase_escolar: string
  status: string
  ano: number
  semestre: number
  dia_pao_frances?: string | null    // v8: dia fixo de pão (SEG..SEX ou null)
  dia_lanche?: string | null         // v8: dia fixo de lanche (SEG..SEX ou null)
  escola?: { id: string; nome: string } | null
  nutricionista?: { id: string; nome: string } | null
  semanas: CardapioSemana[]
  // v8.7: horários customizados por refeição (override do default)
  horarios_refeicoes?: CardapioHorarioRefeicao[]
}

// v8.7: override de horário por cardápio
interface CardapioHorarioRefeicao {
  id: string
  cardapio_id: string
  tipo_refeicao_id: string
  horario: string         // ex: "09h00 / 15h00"
  multiplicador: number   // ex: 2 se tem 2 horários
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
  if (isNaN(d.getTime())) return '—'  // v8.8: data inválida
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
  // v8: exclusão do cardápio
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Add preparations dialog (multi-select)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addDiaId, setAddDiaId] = useState<string | null>(null)
  const [addTipoRefeicaoId, setAddTipoRefeicaoId] = useState<string | null>(null)
  const [addPrepSearch, setAddPrepSearch] = useState('')
  const [addSelectedPrepIds, setAddSelectedPrepIds] = useState<Set<string>>(new Set())
  // v8.8: rastreia quais preparações JÁ ESTAVAM no slot quando o dialog abriu
  // (para saber quais remover se o usuário desmarcar)
  const [addInitialPrepIds, setAddInitialPrepIds] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  // v8: editar/criar/clonar preparação dentro do dialog de adicionar
  const [editingPrepInDialog, setEditingPrepInDialog] = useState<string | null>(null)  // id da prep sendo editada, null = nova
  const [prepDialogOpenInCardapio, setPrepDialogOpenInCardapio] = useState(false)
  // Filtros do modal: todas | favoritas | recentes
  const [addFilter, setAddFilter] = useState<'all' | 'favoritas' | 'recentes'>('all')
  // Filtro alérgenos: exclui preparações com esses alérgenos
  const [addSemAlergenos, setAddSemAlergenos] = useState<Set<string>>(new Set())

  // Fase escolar selector
  const [faseDialogOpen, setFaseDialogOpen] = useState(false)
  // v8: dialog para configurar data de início do cardápio
  const [dataInicioDialogOpen, setDataInicioDialogOpen] = useState(false)
  const [dataInicio, setDataInicio] = useState('')
  // v8: dialog para editar nome do cardápio
  const [nomeDialogOpen, setNomeDialogOpen] = useState(false)
  const [editandoNome, setEditandoNome] = useState('')
  const [selectedFase, setSelectedFase] = useState<string>('FUND_FINAL')

  // Copy day dialog — multi-day support
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [copyOrigemSemana, setCopyOrigemSemana] = useState<number>(1)
  const [copyOrigemDias, setCopyOrigemDias] = useState<Set<string>>(new Set())
  const [copyDestinoSemana, setCopyDestinoSemana] = useState<number>(1)
  const [copyDestinoDias, setCopyDestinoDias] = useState<Set<string>>(new Set())
  const [copying, setCopying] = useState(false)

  // ── NOVOS v7: quick-add chips, drag-and-drop, mobile day picker, porções editing ──
  // Top 6 preparações mais usadas (para botões 1-clique)
  const [topPreparacoes, setTopPreparacoes] = useState<Preparacao[]>([])
  // Item sendo arrastado (drag-and-drop)
  const [draggedItem, setDraggedItem] = useState<CardapioItem | null>(null)
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null)
  // v8: dica visual de Alt+Drag = duplicar (banner fixo durante o arrasto)
  const [dragAltHint, setDragAltHint] = useState(false)
  // Modo mobile: mostra apenas 1 dia por vez (picker no topo)
  const [mobileDayView, setMobileDayView] = useState<string>('segunda')
  // Porções com edição inline em andamento (item_id)
  const [editingPorcoesId, setEditingPorcoesId] = useState<string | null>(null)
  // v6.4: Modo "Trocar dia" — usuário clica num dia (origem), depois em outro (destino)
  // e o sistema troca TODOS os itens entre os dois dias (lanche, almoço, hidratação, etc).
  // Valor: dia_semana de origem ('segunda', 'terca', etc.) ou null se modo desativado.
  const [diaTrocaOrigem, setDiaTrocaOrigem] = useState<string | null>(null)
  // Versão mobile (sidebar sempre colapsável)
  const [isMobile, setIsMobile] = useState(false)
  // v8: feriados para mostrar badge no editor
  const [feriados, setFeriados] = useState<Array<{ id: string; data: string; nome: string; tipo: string; escolas_afetadas: string }>>([])
  // v8.7: dialog para editar horário customizado de uma refeição
  const [horarioDialogOpen, setHorarioDialogOpen] = useState(false)
  const [horarioEditando, setHorarioEditando] = useState<{ tipoRefeicaoId: string; nome: string; horarioDefault: string; horarioAtual: string } | null>(null)
  const [horarioInput, setHorarioInput] = useState('')
  const [salvandoHorario, setSalvandoHorario] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cardRes, prepRes, tipoRes, catRes, metaRes, topRes, ferRes] = await Promise.all([
        fetch(`/api/nutricao/cardapios/${cardapioId}`),
        fetch('/api/nutricao/preparacoes'),
        fetch('/api/nutricao/tipos-refeicao'),
        fetch('/api/nutricao/categorias-refeicao'),
        fetch('/api/nutricao/metas'),
        fetch('/api/nutricao/preparacoes?recentes=true&limite_recentes=6'),
        fetch('/api/feriados'),
      ])
      if (!cardRes.ok) throw new Error('Erro ao carregar cardápio')
      const cardData = await cardRes.json()
      const prepData = prepRes.ok ? await prepRes.json() : []
      const tipoData = tipoRes.ok ? await tipoRes.json() : []
      const catData = catRes.ok ? await catRes.json() : []
      const metaData = metaRes.ok ? await metaRes.json() : []
      const topData = topRes.ok ? await topRes.json() : []
      const ferData = ferRes.ok ? await ferRes.json() : []
      setCardapio(cardData)
      setSelectedFase(cardData.fase_escolar || 'FUND_FINAL')
      setPreparacoes(Array.isArray(prepData) ? prepData : [])
      setTiposRefeicao(Array.isArray(tipoData) ? tipoData : [])
      setFeriados(Array.isArray(ferData) ? ferData : [])
      setCategoriasRefeicao(Array.isArray(catData) ? catData : [])
      setMetas(Array.isArray(metaData) ? metaData : [])
      setTopPreparacoes(Array.isArray(topData) ? topData : [])
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar o cardápio.')
    } finally {
      setLoading(false)
    }
  }, [cardapioId])

  // Detecta mobile/tablet para mudar layout
  useEffect(() => {
    function checkMobile() {
      setIsMobile(window.innerWidth < 1024)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Atalhos de teclado (F4) ──
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ignora se modal aberto ou foco em input
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (addDialogOpen || copyDialogOpen || faseDialogOpen) return

      // Alt+Seta esquerda/direita → navega semanas
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        setCurrentSemana((s) => Math.max(1, s - 1))
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault()
        setCurrentSemana((s) => Math.min(cardapio?.semanas.length || 22, s + 1))
      }
      // Alt+1..5 → ir para semana 1..5 (ciclo base)
      else if (e.altKey && /^[1-5]$/.test(e.key)) {
        e.preventDefault()
        setCurrentSemana(Number(e.key))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [addDialogOpen, copyDialogOpen, faseDialogOpen, cardapio])

  // Refeições for the current category (with schedule info)
  // v8.7: ORDENA POR HORÁRIO CRONOLÓGICO (não por tipo_refeicao.ordem).
  // Usa horário customizado do cardápio se existir, senão usa default de TipoRefeicao.
  const refeicoesForCategoria = useMemo(() => {
    if (!cardapio) return []
    const lista = categoriasRefeicao.filter((cr) => cr.categoria_escola === cardapio.categoria_escola)
    // Para cada CategoriaRefeicao, anexar o horário efetivo (override se existir)
    const horariosOverride = cardapio.horarios_refeicoes || []
    return ordenarPorHorario(
      lista.map((cr) => {
        const override = horariosOverride.find(h => h.tipo_refeicao_id === cr.tipo_refeicao_id)
        const horarioEfetivo = override?.horario ?? cr.tipo_refeicao.horario
        return {
          ...cr,
          // Adiciona campo virtual para uso na UI
          horario_efetivo: horarioEfetivo,
          horario_override: override ?? null,
        }
      })
    )
  }, [cardapio, categoriasRefeicao])

  // Current semana data
  const semanaAtual = useMemo(() => {
    if (!cardapio) return null
    return cardapio.semanas.find((s) => s.numero === currentSemana) || null
  }, [cardapio, currentSemana])

  // Get items for a specific day + refeição (com auto-sort)
  function getItensForSlot(diaSemana: string, tipoRefeicaoId: string): CardapioItem[] {
    if (!semanaAtual) return []
    const dia = semanaAtual.dias.find((d) => d.dia_semana === diaSemana)
    if (!dia) return []
    // v8: aplica ordenação automática baseada no tipo de refeição
    const itensDoSlot = dia.itens.filter((i) => i.tipo_refeicao_id === tipoRefeicaoId)
    return sortItensByRefeicao(itensDoSlot, tiposRefeicao)
  }

  // v8: Reordenar item dentro do slot (up/down) — OTIMISTICO (sem refresh)
  async function handleReordenarItem(itemId: string, direcao: 'up' | 'down') {
    if (!cardapio || !semanaAtual) return

    // Busca todos os itens do mesmo slot para encontrar qual trocar
    for (const dia of semanaAtual.dias) {
      const itemAtual = dia.itens.find(i => i.id === itemId)
      if (!itemAtual) continue

      // Encontra todos os itens do mesmo slot (mesma refeição)
      const itensDoSlot = dia.itens.filter(i => i.tipo_refeicao_id === itemAtual.tipo_refeicao_id)
      const sortedSlot = sortItensByRefeicao(itensDoSlot, tiposRefeicao)
      const idxAtual = sortedSlot.findIndex(i => i.id === itemId)
      if (idxAtual === -1) continue

      const idxTroca = direcao === 'up' ? idxAtual - 1 : idxAtual + 1
      if (idxTroca < 0 || idxTroca >= sortedSlot.length) return // já está no extremo

      const itemTroca = sortedSlot[idxTroca]

      // Se todos têm ordem 0, atribui ordens sequenciais a TODOS antes de trocar
      const todosZero = sortedSlot.every(i => (i.ordem ?? 0) === 0)
      const ordensMap: Record<string, number> = {}
      if (todosZero) {
        sortedSlot.forEach((item, idx) => {
          ordensMap[item.id] = idx + 1
        })
      } else {
        sortedSlot.forEach((item) => {
          ordensMap[item.id] = item.ordem ?? 0
        })
      }

      // Troca as ordens dos dois itens
      const temp = ordensMap[itemId]
      ordensMap[itemId] = ordensMap[itemTroca.id]
      ordensMap[itemTroca.id] = temp

      // Atualização otimista: aplica todas as ordens localmente
      setCardapio(prev => {
        if (!prev) return prev
        return {
          ...prev,
          semanas: prev.semanas.map(s => ({
            ...s,
            dias: s.dias.map(d => ({
              ...d,
              itens: d.itens.map(i => {
                if (ordensMap[i.id] !== undefined) {
                  return { ...i, ordem: ordensMap[i.id] }
                }
                return i
              }),
            })),
          })),
        }
      })

      // Envia para a API (sem esperar para não travar a UI)
      try {
        await fetch(`/api/nutricao/cardapios/${cardapioId}/reordenar-item`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: itemId, direcao }),
        })
      } catch {
        toast.error('Erro ao salvar ordem')
      }
      return
    }
  }

  // ─── v6: Reordenar TODA a SEMANA (todos os slots de todos os dias) ───
  // Botão "Reordenar" no header da semana — reseta ordens manuais e
  // reaplica a ordenação automática baseada em perfil + categoria do banco.
  async function handleReordenarSemana(semanaNumero: number) {
    if (!cardapio || !semanaAtual) return

    // Atualização otimista: aplica ordem 0 em todos os itens da semana localmente
    setCardapio(prev => {
      if (!prev) return prev
      return {
        ...prev,
        semanas: prev.semanas.map(s => {
          if (s.numero !== semanaNumero) return s
          return {
            ...s,
            dias: s.dias.map(d => ({
              ...d,
              itens: d.itens.map(i => ({ ...i, ordem: 0 })),
            })),
          }
        }),
      }
    })

    try {
      const resp = await fetch(`/api/nutricao/cardapios/${cardapioId}/reordenar-semana`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semana_numero: semanaNumero,
        }),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${resp.status}`)
      }

      const data = await resp.json()
      toast.success(`Semana reordenada (${data.slots_reordenados} slots, ${data.itens_reordenados} itens)`)

      // Recarrega o cardápio para refletir as ordens persistidas
      await recarregarCardapio()
    } catch (e) {
      toast.error('Erro ao reordenar semana: ' + (e instanceof Error ? e.message : ''))
      await recarregarCardapio()
    }
  }

  // Recarrega o cardápio do servidor (preserva semana selecionada)
  async function recarregarCardapio() {
    if (!cardapioId) return
    try {
      const resp = await fetch(`/api/nutricao/cardapios/${cardapioId}`)
      if (resp.ok) {
        const data = await resp.json()
        setCardapio(data)
      }
    } catch {
      // silencioso
    }
  }

  // ─── v6.4: Trocar dia inteiro (todas as refeições) ───
  // Modo de 2 cliques: clica no botão "Trocar dia" da origem, depois clica no dia destino.
  // O sistema troca TODOS os itens entre os dois dias (lanche, almoço, hidratação, etc).
  async function handleTrocarDia(diaDestino: string, semanaNumero: number) {
    if (!cardapio || !semanaAtual || !diaTrocaOrigem) return

    if (diaTrocaOrigem === diaDestino) {
      // Clicou no mesmo dia — cancela modo
      setDiaTrocaOrigem(null)
      toast.info('Troca cancelada')
      return
    }

    const diaOrigem = diaTrocaOrigem

    // Atualização otimista: troca os itens dos dias localmente
    setCardapio(prev => {
      if (!prev) return prev
      return {
        ...prev,
        semanas: prev.semanas.map(s => {
          if (s.numero !== semanaNumero) return s
          const diaA = s.dias.find(d => d.dia_semana === diaOrigem)
          const diaB = s.dias.find(d => d.dia_semana === diaDestino)
          if (!diaA || !diaB) return s
          return {
            ...s,
            dias: s.dias.map(d => {
              if (d.dia_semana === diaOrigem) return { ...diaB }
              if (d.dia_semana === diaDestino) return { ...diaA }
              return d
            }),
          }
        }),
      }
    })

    // Desativa modo troca imediatamente
    setDiaTrocaOrigem(null)

    try {
      const resp = await fetch(`/api/nutricao/cardapios/${cardapioId}/trocar-dia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semana_numero: semanaNumero,
          dia_a: diaOrigem,
          dia_b: diaDestino,
        }),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${resp.status}`)
      }

      const data = await resp.json()
      toast.success(`Dias trocados (${data.itens_trocados} itens)`)

      // Recarrega o cardápio para refletir o estado persistido
      await recarregarCardapio()
    } catch (e) {
      toast.error('Erro ao trocar dias: ' + (e instanceof Error ? e.message : ''))
      await recarregarCardapio()
    }
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
  // v8.8: pré-seleciona as preparações que JÁ ESTÃO no slot
  function openAddDialog(diaId: string, tipoRefeicaoId: string, diaSemana: string) {
    setAddDiaId(diaId)
    setAddTipoRefeicaoId(tipoRefeicaoId)
    setAddPrepSearch('')
    setAddFilter('all')
    setAddSemAlergenos(new Set())

    // Buscar itens que já estão neste slot e pré-selecioná-los
    const itensExistentes = getItensForSlot(diaSemana, tipoRefeicaoId)
    const prepIdsExistentes = new Set(itensExistentes.map(i => i.preparacao_id))
    setAddSelectedPrepIds(prepIdsExistentes)
    setAddInitialPrepIds(new Set(prepIdsExistentes))  // snapshot do estado inicial

    setAddDialogOpen(true)
  }

  // Toggle preparation selection
  // v8.8: ao selecionar, limpa a busca para mostrar todos
  function togglePrepSelection(prepId: string) {
    setAddSelectedPrepIds(prev => {
      const next = new Set(prev)
      if (next.has(prepId)) next.delete(prepId)
      else next.add(prepId)
      return next
    })
    // Limpar a busca após selecionar/desselecionar
    setAddPrepSearch('')
  }

  // v8.8: Adicionar E remover preparações (baseado no que foi marcado/desmarcado)
  async function handleAddPreparacoes() {
    if (!addDiaId) return
    // Permite size === 0 se o usuário desmarcou tudo (para remover todos)
    setAdding(true)
    try {
      // Calcular o que adicionar (marcado agora mas não estava antes)
      const paraAdicionar = Array.from(addSelectedPrepIds).filter(id => !addInitialPrepIds.has(id))
      // Calcular o que remover (estava antes mas foi desmarcado)
      const paraRemover = Array.from(addInitialPrepIds).filter(id => !addSelectedPrepIds.has(id))

      let adicionadas = 0
      let removidas = 0

      // ── ADICIONAR novas preparações ──
      if (paraAdicionar.length > 0) {
        const items = paraAdicionar.map(prepId => ({
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
        const itensCriados = await res.json()
        adicionadas = paraAdicionar.length

        // Atualização otimista
        const novosItens = (Array.isArray(itensCriados) ? itensCriados : [itensCriados]) as CardapioItem[]
        setCardapio(prev => {
          if (!prev) return prev
          return {
            ...prev,
            semanas: prev.semanas.map(s => ({
              ...s,
              dias: s.dias.map(d => {
                if (d.id !== addDiaId) return d
                return { ...d, itens: [...d.itens, ...novosItens] }
              }),
            })),
          }
        })
      }

      // ── REMOVER preparações desmarcadas ──
      if (paraRemover.length > 0) {
        // Para cada preparação a remover, encontrar o item no slot e deletar
        for (const prepId of paraRemover) {
          // Buscar o item no estado atual
          const dia = semanaAtual?.dias.find(d => d.id === addDiaId)
          const item = dia?.itens.find(i => i.preparacao_id === prepId && i.tipo_refeicao_id === addTipoRefeicaoId)
          if (!item) continue

          const res = await fetch(`/api/nutricao/cardapios/${cardapioId}/item`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_id: item.id }),
          })
          if (res.ok) {
            removidas++
            // Atualização otimista
            setCardapio(prev => {
              if (!prev) return prev
              return {
                ...prev,
                semanas: prev.semanas.map(s => ({
                  ...s,
                  dias: s.dias.map(d => {
                    if (d.id !== addDiaId) return d
                    return { ...d, itens: d.itens.filter(i => i.id !== item.id) }
                  }),
                })),
              }
            })
          }
        }
      }

      // Toast informativo
      if (adicionadas > 0 && removidas > 0) {
        toast.success(`${adicionadas} adicionada(s), ${removidas} removida(s)`)
      } else if (adicionadas > 0) {
        toast.success(`${adicionadas} preparação(ões) adicionada(s)`)
      } else if (removidas > 0) {
        toast.success(`${removidas} preparação(ões) removida(s)`)
      } else {
        toast.info('Nenhuma alteração')
      }

      setAddDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar preparações')
    } finally {
      setAdding(false)
    }
  }

  // ── v8: Abrir/fechar sub-dialog de preparação (nova ou editar) ──
  // Chamado a partir do dialog "Adicionar Preparações" — não abre nova aba.
  function openEditPrepInDialog(prepId: string) {
    setEditingPrepInDialog(prepId)
    setPrepDialogOpenInCardapio(true)
  }
  function openNewPrepInDialog() {
    setEditingPrepInDialog(null)
    setPrepDialogOpenInCardapio(true)
  }
  // Recarrega apenas a lista de preparações (após criar/editar no sub-dialog)
  async function refreshPreparacoes() {
    try {
      const [prepRes, topRes] = await Promise.all([
        fetch('/api/nutricao/preparacoes'),
        fetch('/api/nutricao/preparacoes?recentes=true&limite_recentes=6'),
      ])
      if (prepRes.ok) {
        const data = await prepRes.json()
        setPreparacoes(Array.isArray(data) ? data : [])
      }
      if (topRes.ok) {
        const top = await topRes.json()
        setTopPreparacoes(Array.isArray(top) ? top : [])
      }
    } catch {
      // silencioso — não bloqueia o fluxo
    }
  }
  function handlePrepSaved(info: { id: string; nome: string; isNew: boolean }) {
    refreshPreparacoes()
    // Seleciona automaticamente a preparação recém-criada para fácil adição
    if (info.isNew) {
      setAddSelectedPrepIds(prev => new Set(prev).add(info.id))
      toast.success(`Preparação "${info.nome}" criada e pré-selecionada`)
    } else {
      toast.success(`Preparação "${info.nome}" atualizada`)
    }
  }
  // v8: Após clonar — muda editingPrepId para a nova prep e mantém o dialog aberto
  // (o usuário continua editando a cópia sem sair da página)
  function handlePrepCloned(newId: string, clonedPrep: PreparacaoLite) {
    setEditingPrepInDialog(newId)
    // Atualização otimista: adiciona a nova prep à lista IMEDIATAMENTE
    // para que o `editingPrep` prop seja encontrado sem flash de formulário vazio.
    // O refreshPreparacoes abaixo vai buscar a versão canônica do banco.
    setPreparacoes(prev => [
      clonedPrep as unknown as Preparacao,
      ...prev.filter(p => p.id !== newId),
    ])
    // Também atualiza topPreparacoes (não afeta a cópia, mas mantém consistência)
    refreshPreparacoes()
  }
  // v8: Após excluir — fecha dialog e recarrega lista (a prep excluída some)
  function handlePrepDeleted(_id: string) {
    refreshPreparacoes()
    // Remove da seleção caso estivesse selecionada
    setAddSelectedPrepIds(prev => {
      const next = new Set(prev)
      next.delete(_id)
      return next
    })
  }

  // ── v8.7: Horário customizado de refeição ──
  // Abre o dialog de edição de horário para uma refeição
  function openHorarioDialog(tipoRefeicaoId: string, nomeRefeicao: string, horarioDefault: string, horarioAtual: string) {
    setHorarioEditando({ tipoRefeicaoId, nome: nomeRefeicao, horarioDefault, horarioAtual })
    setHorarioInput(horarioAtual || horarioDefault)
    setHorarioDialogOpen(true)
  }

  // Salva o horário customizado (POST na API)
  async function handleSaveHorario() {
    if (!horarioEditando) return
    if (!horarioInput.trim()) {
      toast.error('Horário não pode ser vazio')
      return
    }
    setSalvandoHorario(true)
    try {
      const res = await fetch(`/api/nutricao/cardapios/${cardapioId}/horarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_refeicao_id: horarioEditando.tipoRefeicaoId,
          horario: horarioInput.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao salvar horário')
      }
      const saved = await res.json()
      // Atualização otimista: atualiza o estado do cardápio
      setCardapio(prev => {
        if (!prev) return prev
        const existing = prev.horarios_refeicoes || []
        const others = existing.filter(h => h.tipo_refeicao_id !== horarioEditando.tipoRefeicaoId)
        return {
          ...prev,
          horarios_refeicoes: [
            ...others,
            { id: saved.id, cardapio_id: prev.id, tipo_refeicao_id: horarioEditando.tipoRefeicaoId, horario: saved.horario, multiplicador: saved.multiplicador },
          ],
        }
      })
      toast.success(`Horário de "${horarioEditando.nome}" atualizado para ${saved.horario}`)
      setHorarioDialogOpen(false)
      setHorarioEditando(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar horário')
    } finally {
      setSalvandoHorario(false)
    }
  }

  // Remove o override (volta a usar o default de TipoRefeicao)
  async function handleResetHorario() {
    if (!horarioEditando) return
    setSalvandoHorario(true)
    try {
      const res = await fetch(`/api/nutricao/cardapios/${cardapioId}/horarios?tipo_refeicao_id=${horarioEditando.tipoRefeicaoId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Erro ao remover horário')
      // Atualização otimista
      setCardapio(prev => {
        if (!prev) return prev
        return {
          ...prev,
          horarios_refeicoes: (prev.horarios_refeicoes || []).filter(h => h.tipo_refeicao_id !== horarioEditando.tipoRefeicaoId),
        }
      })
      toast.success(`Horário de "${horarioEditando.nome}" restaurado para o padrão (${horarioEditando.horarioDefault})`)
      setHorarioDialogOpen(false)
      setHorarioEditando(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover horário')
    } finally {
      setSalvandoHorario(false)
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

      // ── ATUALIZAÇÃO OTIMISTA (sem refresh) ──
      setCardapio(prev => {
        if (!prev) return prev
        return {
          ...prev,
          semanas: prev.semanas.map(s => ({
            ...s,
            dias: s.dias.map(d => ({
              ...d,
              itens: d.itens.filter(i => i.id !== itemId),
            })),
          })),
        }
      })

      // v8: marca semana atual como diferenciada (se for cardápio de escola)
      if (cardapio?.escola_id && cardapio?.cardapio_base_id) {
        handleDiferenciarSemana(currentSemana, true)
      }
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

      // ── ATUALIZAÇÃO OTIMISTA (sem refresh) ──
      const itemIds = new Set(itens.map(i => i.id))
      setCardapio(prev => {
        if (!prev) return prev
        return {
          ...prev,
          semanas: prev.semanas.map(s => ({
            ...s,
            dias: s.dias.map(d => ({
              ...d,
              itens: d.itens.filter(i => !itemIds.has(i.id)),
            })),
          })),
        }
      })

      // v8: marca semana atual como diferenciada
      if (cardapio?.escola_id && cardapio?.cardapio_base_id) {
        handleDiferenciarSemana(currentSemana, true)
      }
    } catch {
      toast.error('Erro ao limpar refeição')
    }
  }

  // ── NOVO v7: Quick-add (1-clique) para preparação universal ──
  async function handleQuickAdd(prepId: string, diaId: string, tipoRefeicaoId: string, prepNome?: string) {
    try {
      const res = await fetch(`/api/nutricao/cardapios/${cardapioId}/item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dia_id: diaId,
          tipo_refeicao_id: tipoRefeicaoId,
          preparacao_id: prepId,
          porcoes: 1,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Erro ao adicionar')
      }
      const itemCriado = await res.json()
      toast.success(`${prepNome || 'Preparação'} adicionada`)

      // ── ATUALIZAÇÃO OTIMISTA (sem refresh) ──
      // Encontra a preparação completa no estado `preparacoes` (já carregada)
      const prepCompleta = preparacoes.find(p => p.id === prepId)
      if (prepCompleta) {
        setCardapio(prev => {
          if (!prev) return prev
          return {
            ...prev,
            semanas: prev.semanas.map(s => ({
              ...s,
              dias: s.dias.map(d => {
                if (d.id !== diaId) return d
                // Adiciona o novo item (ou atualiza porções se já existia)
                const existente = d.itens.find(i => i.tipo_refeicao_id === tipoRefeicaoId && i.preparacao_id === prepId)
                if (existente) {
                  return {
                    ...d,
                    itens: d.itens.map(i => i.id === existente.id ? { ...i, porcoes: i.porcoes + 1 } : i),
                  }
                }
                return {
                  ...d,
                  itens: [...d.itens, {
                    id: itemCriado.id || `temp-${Date.now()}`,
                    tipo_refeicao_id: tipoRefeicaoId,
                    preparacao_id: prepId,
                    porcoes: 1,
                    tipo_refeicao: tiposRefeicao.find(t => t.id === tipoRefeicaoId) || { id: tipoRefeicaoId, nome: '', horario: '', ordem: 0, codigo: '' },
                    preparacao: prepCompleta,
                  }],
                }
              }),
            })),
          }
        })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao adicionar preparação')
    }
  }

  // v8: Porções não são mais editáveis inline — definidas no cadastro da preparação.
  // Função handleUpdatePorcoes removida.

  // ── NOVO v8: Marcar semana como diferenciada (manualmente ajustada vs base) ──
  async function handleDiferenciarSemana(semanaNumero: number, marcarComoDiferenciada?: boolean) {
    try {
      const res = await fetch(`/api/nutricao/cardapios/${cardapioId}/diferenciar-semana`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semana_numero: semanaNumero,
          diferenciada: marcarComoDiferenciada,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao marcar semana')
      }
      const data = await res.json()
      // Atualização otimista local
      setCardapio(prev => {
        if (!prev) return prev
        return {
          ...prev,
          semanas: prev.semanas.map(s =>
            s.numero === semanaNumero
              ? { ...s, diferenciada: data.diferenciada }
              : s
          ),
        }
      })
      toast.success(data.message)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao diferenciar semana')
    }
  }

  // ── NOVO v7: Mover item via drag-and-drop ──
  async function handleMoveItem(item: CardapioItem, destinoSemana: number, destinoDia: string, destinoTipoRefeicaoId: string) {
    // Não faz nada se for o mesmo slot
    const semanaOrigem = cardapio?.semanas.find(s => s.dias.some(d => d.itens.some(i => i.id === item.id)))
    const diaOrigem = semanaOrigem?.dias.find(d => d.itens.some(i => i.id === item.id))
    if (semanaOrigem?.numero === destinoSemana && diaOrigem?.dia_semana === destinoDia && item.tipo_refeicao_id === destinoTipoRefeicaoId) {
      return
    }

    try {
      const res = await fetch(`/api/nutricao/cardapios/${cardapioId}/mover-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: item.id,
          destino: {
            semana_numero: destinoSemana,
            dia_semana: destinoDia,
            tipo_refeicao_id: destinoTipoRefeicaoId,
          },
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Erro ao mover')
      }
      const data = await res.json()
      toast.success(`Movido para ${destinoDia}, semana ${destinoSemana}${data.action === 'merged' ? ' (mesclada com item existente)' : ''}`)

      // ── ATUALIZAÇÃO OTIMISTA (sem refresh) ──
      // IMPORTANTE: a API DELETE o item original e CRIA um novo item no destino
      // (com NOVO id). Precisamos usar o novo id retornado em data.item.id,
      // senão na próxima vez que o usuário tentar mover o mesmo item, o front
      // vai enviar o id ANTIGO (que não existe mais) → 404.
      const novoItemId = data.item?.id || item.id
      const novoItem: CardapioItem = {
        ...item,
        id: novoItemId,
        tipo_refeicao_id: destinoTipoRefeicaoId,
      }

      setCardapio(prev => {
        if (!prev) return prev
        return {
          ...prev,
          semanas: prev.semanas.map(s => {
            const isSemanaDestino = s.numero === destinoSemana

            return {
              ...s,
              dias: s.dias.map(d => {
                // Remove o item de qualquer dia onde ele esteja (origem) — usa id antigo
                const filteredItens = d.itens.filter(i => i.id !== item.id)

                // Se este é o dia destino, adiciona o item com novo id
                if (isSemanaDestino && d.dia_semana === destinoDia) {
                  if (data.action === 'merged') {
                    // Mesclou com item existente — não re-adiciona (origem já foi removida)
                    return { ...d, itens: filteredItens }
                  }
                  return {
                    ...d,
                    itens: [...filteredItens, novoItem],
                  }
                }
                return { ...d, itens: filteredItens }
              }),
            }
          }),
        }
      })

      // v8: marca a semana destino e origem como diferenciadas (se for cardápio de escola)
      if (cardapio?.escola_id && cardapio?.cardapio_base_id) {
        handleDiferenciarSemana(destinoSemana, true)
        if (semanaOrigem && semanaOrigem.numero !== destinoSemana) {
          handleDiferenciarSemana(semanaOrigem.numero, true)
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao mover preparação')
    }
  }

  // v8: Duplicar item (Alt+Drag) — cria cópia no destino sem remover origem
  async function handleDuplicateItem(item: CardapioItem, destinoSemana: number, destinoDia: string, destinoTipoRefeicaoId: string) {
    // Não duplica para o mesmo slot — dá feedback claro para o usuário
    const semanaOrigem = cardapio?.semanas.find(s => s.dias.some(d => d.itens.some(i => i.id === item.id)))
    const diaOrigem = semanaOrigem?.dias.find(d => d.itens.some(i => i.id === item.id))
    if (semanaOrigem?.numero === destinoSemana && diaOrigem?.dia_semana === destinoDia && item.tipo_refeicao_id === destinoTipoRefeicaoId) {
      toast.info('Mesmo slot de origem — arraste para outro dia ou refeição para duplicar')
      return
    }

    try {
      const res = await fetch(`/api/nutricao/cardapios/${cardapioId}/duplicar-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: item.id,
          destino: {
            semana_numero: destinoSemana,
            dia_semana: destinoDia,
            tipo_refeicao_id: destinoTipoRefeicaoId,
          },
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Erro ao duplicar')
      }
      const data = await res.json()
      toast.success(`Duplicado para ${destinoDia}, semana ${destinoSemana}${data.action === 'merged' ? ' (mesclado com item existente)' : ''}`)

      // Atualização otimista
      const novoItemId = data.item?.id || `temp-${Date.now()}`
      setCardapio(prev => {
        if (!prev) return prev
        return {
          ...prev,
          semanas: prev.semanas.map(s => {
            if (s.numero !== destinoSemana) return s
            return {
              ...s,
              dias: s.dias.map(d => {
                if (d.dia_semana !== destinoDia) return d
                if (data.action === 'merged') {
                  // Soma porções no item existente
                  return {
                    ...d,
                    itens: d.itens.map(i =>
                      i.preparacao_id === item.preparacao_id && i.tipo_refeicao_id === destinoTipoRefeicaoId
                        ? { ...i, porcoes: i.porcoes + item.porcoes }
                        : i
                    ),
                  }
                }
                // Adiciona novo item
                return {
                  ...d,
                  itens: [...d.itens, {
                    id: novoItemId,
                    tipo_refeicao_id: destinoTipoRefeicaoId,
                    preparacao_id: item.preparacao_id,
                    porcoes: item.porcoes,
                    ordem: 0,
                    tipo_refeicao: item.tipo_refeicao,
                    preparacao: item.preparacao,
                  }],
                }
              }),
            }
          }),
        }
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao duplicar preparação')
    }
  }

  // ── v8: Helper para verificar se um dia da semana atual é feriado ──
  function getFeriadoDoDia(diaSemanaPt: string): { nome: string; tipo: string } | null {
    if (!semanaAtual || !cardapio) return null
    const diaToIdx: Record<string, number> = {
      'domingo': 0, 'segunda': 1, 'terca': 2, 'quarta': 3,
      'quinta': 4, 'sexta': 5, 'sabado': 6,
    }
    const idxAlvo = diaToIdx[diaSemanaPt]
    if (idxAlvo === undefined) return null
    const offsetDias = idxAlvo - 1
    if (offsetDias < 0 || offsetDias > 4) return null
    // v8.8: se data_inicio está vazio (cardápio novo sem data configurada), não calcular feriados
    if (!semanaAtual.data_inicio) return null

    const inicio = new Date(semanaAtual.data_inicio + 'T12:00:00')
    if (isNaN(inicio.getTime())) return null  // data inválida — não calcular
    const dataDia = new Date(inicio)
    dataDia.setDate(inicio.getDate() + offsetDias)
    const dataIso = dataDia.toISOString().split('T')[0]

    const feriado = feriados.find((f) => f.data === dataIso)
    if (!feriado) return null
    const afetadas = feriado.escolas_afetadas || 'TODAS'
    if (afetadas === 'TODAS') return { nome: feriado.nome, tipo: feriado.tipo }
    const map: Record<string, string[]> = {
      'REGULARES': ['REGULAR'], 'INTEGRAIS': ['INTEGRAL'], 'CRECHES': ['CRECHE'],
      'BIFASICA': ['BIFASICA'], 'INTERIOR': ['INTERIOR'], 'OUTROS': ['OUTROS'],
    }
    if (!(map[afetadas] || [afetadas]).includes(cardapio.categoria_escola)) return null
    return { nome: feriado.nome, tipo: feriado.tipo }
  }

  // ── NOVO v7: Resumo nutricional por dia (para mini-painel) ──
  function getResumoDia(diaSemana: string): { energia: number; ferro_heme: boolean; vit_a: boolean; alertas: number } {
    if (!semanaAtual || !cardapio) return { energia: 0, ferro_heme: false, vit_a: false, alertas: 0 }
    const dia = semanaAtual.dias.find(d => d.dia_semana === diaSemana)
    if (!dia || dia.itens.length === 0) return { energia: 0, ferro_heme: false, vit_a: false, alertas: 0 }

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

    return {
      energia: diaNutri.energia_kcal,
      ferro_heme: diaNutri.ferro_heme_mg > 0,
      vit_a: diaNutri.vitamina_a_mcg > 0,
      alertas: 0,  // simplificado para o mini-resumo
    }
  }

  // Semáforo do dia baseado na energia vs meta
  function getDiaTrafficLight(energia: number): 'gray' | 'red' | 'amber' | 'green' {
    if (energia === 0) return 'gray'
    const meta = metas.find(m => m.categoria_escola === cardapio?.categoria_escola)
    if (!meta) return 'gray'
    if (energia < meta.energia_kcal_min * 0.7) return 'red'
    if (energia < meta.energia_kcal_min) return 'amber'
    if (energia > meta.energia_kcal_max) return 'amber'
    return 'green'
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

  // v8: Salvar data de início do cardápio
  async function handleSaveDataInicio() {
    if (!cardapio || !dataInicio) return
    setSaving(true)
    try {
      const res = await fetch(`/api/nutricao/cardapios/${cardapioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data_inicio: dataInicio }),
      })
      if (!res.ok) throw new Error('Erro ao salvar data')
      toast.success('Datas atualizadas — todas as semanas foram recalculadas')
      setDataInicioDialogOpen(false)
      loadData()
    } catch {
      toast.error('Erro ao salvar data de início')
    } finally {
      setSaving(false)
    }
  }

  // v8: Salvar nome do cardápio
  async function handleSaveNome() {
    if (!cardapio || !editandoNome.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/nutricao/cardapios/${cardapioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: editandoNome.trim() }),
      })
      if (!res.ok) throw new Error('Erro ao salvar nome')
      toast.success('Nome do cardápio atualizado')
      setNomeDialogOpen(false)
      loadData()
    } catch {
      toast.error('Erro ao salvar nome')
    } finally {
      setSaving(false)
    }
  }

  // v8.9: Editar semestre do cardápio
  async function handleSaveSemestre(semestre: number) {
    if (!cardapio) return
    setSaving(true)
    try {
      const res = await fetch(`/api/nutricao/cardapios/${cardapioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semestre }),
      })
      if (!res.ok) throw new Error('Erro ao salvar semestre')
      toast.success(`Semestre alterado para ${semestre}`)
      loadData()
    } catch {
      toast.error('Erro ao salvar semestre')
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

  // v8: Excluir cardápio
  async function handleDeleteCardapio() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/nutricao/cardapios/${cardapioId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao excluir')
      }
      toast.success('Cardápio excluído')
      router.push('/nutricao/cardapios')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir cardápio')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
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

  const filteredPreparacoes = useMemo(() => {
    let list = preparacoes

    // Filtro por aba
    if (addFilter === 'favoritas') {
      list = list.filter((p) => p.favorita)
    } else if (addFilter === 'recentes') {
      list = [...list].sort((a, b) => (b.vezes_usada || 0) - (a.vezes_usada || 0)).slice(0, 30)
    }

    // Filtro por alérgenos (excluir)
    if (addSemAlergenos.size > 0) {
      list = list.filter((p) => {
        const alergenos = detectarAlergenosPreparacao(
          p.ingredientes.map((ing) => ({
            nome: ing.alimento.nome,
            grupo: ing.alimento.grupo,
          }))
        )
        // Se tem QUALQUER alérgeno da lista de exclusão, remover
        return !alergenos.some((a) => addSemAlergenos.has(a))
      })
    }

    // v8.8: Busca inteligente — por palavras (AND), sem acento
    const q = normalizeText(addPrepSearch).trim()
    if (q) {
      const queryWords = q.split(/\s+/).filter(w => w.length > 0)
      list = list.filter((p) => {
        const nome = normalizeText(p.nome)
        return queryWords.every(qw => nome.includes(qw))
      })
    }

    // v8.8: Ordenar — selecionados PRIMEIRO (fixados no topo), depois alfabético
    const selIds = addSelectedPrepIds
    list = [...list].sort((a, b) => {
      const aSel = selIds.has(a.id) ? 0 : 1
      const bSel = selIds.has(b.id) ? 0 : 1
      if (aSel !== bSel) return aSel - bSel
      return a.nome.localeCompare(b.nome)
    })

    return list
  }, [preparacoes, addFilter, addSemAlergenos, addPrepSearch, addSelectedPrepIds])

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
      {/* v8: Banner de dica Alt+Drag = duplicar (somente durante o arrasto) */}
      {dragAltHint && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-[#1A3A5C] text-white text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
          <Copy className="w-3.5 h-3.5" />
          <span>Solte para <b className="font-bold">mover</b> · segure <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-mono">Alt</kbd> para <b className="font-bold">duplicar</b></span>
        </div>
      )}
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
              <h1
                className="text-lg font-bold text-[#1A3A5C] truncate cursor-pointer hover:text-blue-700 hover:underline"
                onClick={() => {
                  setEditandoNome(cardapio.nome)
                  setNomeDialogOpen(true)
                }}
                title="Clique para editar o nome do cardápio"
              >
                {cardapio.nome}
              </h1>
              {getStatusBadge(cardapio.status)}
            </div>
            <p className="text-xs text-muted-foreground">
              {cardapio.escola?.nome || 'Modelo base'} · {cardapio.ano}/
              {/* v8.9: Semestre editável */}
              <select
                value={cardapio.semestre}
                onChange={(e) => handleSaveSemestre(Number(e.target.value))}
                disabled={saving}
                className="inline-block bg-transparent border-0 text-xs text-muted-foreground cursor-pointer hover:text-[#1A3A5C] focus:outline-none focus:ring-0"
                style={{ appearance: 'none', '-webkit-appearance': 'none' } as React.CSSProperties}
                title="Clique para alterar o semestre"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
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

          {/* v8: Botão Configurar Datas */}
          <button
            onClick={() => {
              // Pega a data da primeira semana como default
              const primeiraSemana = cardapio.semanas?.[0]
              if (primeiraSemana?.data_inicio) {
                setDataInicio(primeiraSemana.data_inicio)
              }
              setDataInicioDialogOpen(true)
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors hover:bg-gray-50 border-blue-300 text-blue-700"
            title="Configurar data de início do cardápio"
          >
            <Calendar className="w-3 h-3" />
            {cardapio.semanas?.[0]?.data_inicio ? formatDate(cardapio.semanas[0].data_inicio) : 'Definir data'}
          </button>

          {/* Botão Replicar p/ Escolas (disponível para QUALQUER cardápio — base ou de escola) */}
          <Link href={`/nutricao/cardapios/${cardapioId}/replicar`}>
            <Button variant="outline" size="sm" className="text-xs h-8 border-purple-200 text-purple-700 hover:bg-purple-50">
              <Copy className="w-3 h-3 mr-1" /> Replicar p/ Escolas
            </Button>
          </Link>

          {/* Botão Comparar com Base (somente se for instância de escola) */}
          {cardapio.escola_id && (
            <Link href={`/nutricao/cardapios/${cardapioId}/comparar`}>
              <Button variant="outline" size="sm" className="text-xs h-8 border-blue-200 text-blue-700 hover:bg-blue-50">
                <GitCompare className="w-3 h-3 mr-1" /> Comparar c/ Base
              </Button>
            </Link>
          )}

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
          <Button
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700 text-xs"
            title="Excluir este cardápio permanentemente"
          >
            <Trash2 className="w-3 h-3 mr-1" /> Excluir
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
          {/* v8: Badge "Modificada" quando semana foi diferenciada vs base */}
          {semanaAtual?.diferenciada && (
            <Badge className="bg-[#D4A017]/10 text-[#D4A017] border-[#D4A017]/30 text-[9px]" title="Esta semana foi manualmente ajustada vs o cardápio base">
              <Unlock className="w-2.5 h-2.5 mr-0.5" /> Modificada
            </Badge>
          )}
          {semanaAtual && (
            <span className="text-xs text-muted-foreground">
              ({formatDate(semanaAtual.data_inicio)} — {formatDate(semanaAtual.data_fim)})
            </span>
          )}
          {/* v8: Botão "Diferenciar Semana" — só para cardápios de escola (instâncias de base) */}
          {cardapio.escola_id && cardapio.cardapio_base_id && semanaAtual && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-[#D4A017] hover:bg-[#D4A017]/10 ml-2"
              onClick={() => handleDiferenciarSemana(currentSemana)}
              title={semanaAtual.diferenciada
                ? "Restaurar como cópia do base (mas mantém as alterações feitas)"
                : "Marcar esta semana como modificada vs o cardápio base"
              }
            >
              <Unlock className="w-3 h-3 mr-0.5" />
              {semanaAtual.diferenciada ? 'Restaurar' : 'Diferenciar'}
            </Button>
          )}
          {/* v6: Botão "Reordenar semana" — re-aplica ordem canônica em todos os slots da semana */}
          {semanaAtual && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-[#1A3A5C] hover:bg-[#1A3A5C]/10 ml-2"
              onClick={() => handleReordenarSemana(currentSemana)}
              title="Reordenar toda a semana (aplica ordem canônica: bebida → pão → fruta / salada → arroz → feijão → proteína → acompanhamento → fruta / cuscuz → acompanhamento → fruta)"
            >
              <ArrowDownUp className="w-3 h-3 mr-0.5" />
              Reordenar
            </Button>
          )}
          {/* Legenda semáforo */}
          <div className="hidden md:flex items-center gap-2 ml-3 pl-3 border-l border-gray-200">
            <span className="text-[9px] text-muted-foreground">Semáforo:</span>
            <span className="flex items-center gap-1 text-[9px]"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> OK</span>
            <span className="flex items-center gap-1 text-[9px]"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Abaixo/Acima</span>
            <span className="flex items-center gap-1 text-[9px]"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Crítico</span>
          </div>
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
                {/* v8.7: usa horário efetivo (override se existir) */}
                <Badge
                  variant="outline"
                  className={`text-[9px] h-4 px-1 ${
                    (cr as { horario_override?: unknown }).horario_override
                      ? 'border-[#D4A017]/50 text-[#D4A017] bg-[#D4A017]/10'
                      : 'border-[#1A3A5C]/20'
                  }`}
                >
                  {(cr as { horario_efetivo?: string }).horario_efetivo ?? cr.tipo_refeicao.horario}
                </Badge>
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
          {/* ── NOVO v7: Mobile day picker (apenas 1 dia por vez em telas pequenas) ── */}
          {isMobile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="lg:hidden mb-2 bg-white p-1.5 rounded-xl border border-[#1A3A5C]/10 flex items-center gap-1 overflow-x-auto"
            >
              <Smartphone className="w-3.5 h-3.5 text-[#1A3A5C] flex-shrink-0 ml-1" />
              {DIAS_SEMANA_NUTRI.map((d) => {
                const isActive = mobileDayView === d.value
                const resumo = getResumoDia(d.value)
                const semaforo = getDiaTrafficLight(resumo.energia)
                return (
                  <button
                    key={d.value}
                    onClick={() => setMobileDayView(d.value)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium flex items-center gap-1 flex-shrink-0 transition-colors ${
                      isActive
                        ? 'bg-[#1A3A5C] text-white'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      semaforo === 'green' ? 'bg-emerald-400' :
                      semaforo === 'amber' ? 'bg-amber-400' :
                      semaforo === 'red' ? 'bg-red-400' : 'bg-gray-300'
                    }`} />
                    {d.label}
                  </button>
                )
              })}
            </motion.div>
          )}

          {/* ── NOVO v7: Quick-add chips bar (top 6 mais usadas) ── */}
          {topPreparacoes.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-2 bg-white p-2 rounded-xl border border-[#1A3A5C]/10"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 text-[10px] font-semibold text-[#1A3A5C] flex-shrink-0">
                  <Zap className="w-3 h-3 text-[#D4A017]" />
                  1-clique:
                </div>
                {topPreparacoes.map((p) => {
                  // Dia alvo: no mobile usa mobileDayView, no desktop usa a primeira refeição da primeira segunda
                  const diaAlvo = isMobile ? mobileDayView : 'segunda'
                  const diaDataAlvo = semanaAtual?.dias.find(d => d.dia_semana === diaAlvo)
                  const primeiraRefeicao = refeicoesForCategoria[0]
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (diaDataAlvo && primeiraRefeicao) {
                          handleQuickAdd(p.id, diaDataAlvo.id, primeiraRefeicao.tipo_refeicao_id, p.nome)
                          if (!isMobile) {
                            toast.info(`Adicionado em ${diaAlvo}/${primeiraRefeicao.tipo_refeicao.nome} — arraste para mover`)
                          }
                        } else {
                          toast.error('Semana sem dias configurados')
                        }
                      }}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#1A3A5C]/5 border border-[#1A3A5C]/20 text-[#1A3A5C] hover:bg-[#1A3A5C]/10 transition-colors flex items-center gap-1"
                      title={`Adicionar "${p.nome}" em ${diaAlvo}/${primeiraRefeicao?.tipo_refeicao.nome || ''} — depois arraste para o dia desejado`}
                    >
                      <Plus className="w-2.5 h-2.5" />
                      {p.nome}
                      {p.vezes_usada > 0 && (
                        <span className="text-[8px] text-muted-foreground">({p.vezes_usada}×)</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`grid gap-2 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-5'}`}
          >
            {DIAS_SEMANA_NUTRI.filter(d => !isMobile || d.value === mobileDayView).map((dia) => {
              const diaData = semanaAtual?.dias.find((d) => d.dia_semana === dia.value)
              const resumoDia = getResumoDia(dia.value)
              const semaforo = getDiaTrafficLight(resumoDia.energia)
              // v6.4: estado visual do modo "Trocar dia"
              const ehOrigemTroca = diaTrocaOrigem === dia.value
              const emModoTroca = diaTrocaOrigem !== null
              return (
                <div
                  key={dia.value}
                  className={`bg-white rounded-xl border overflow-hidden relative transition-all ${
                    ehOrigemTroca
                      ? 'border-[#D4A017] ring-2 ring-[#D4A017]'
                      : emModoTroca
                        ? 'border-[#D4A017]/40 cursor-pointer hover:border-[#D4A017] hover:ring-1 hover:ring-[#D4A017]/50'
                        : 'border-gray-200'
                  }`}
                  // v6.4: se em modo troca e NÃO é a origem, clicar no card troca com a origem
                  onClick={(e) => {
                    if (emModoTroca && !ehOrigemTroca) {
                      e.preventDefault()
                      handleTrocarDia(dia.value, currentSemana)
                    }
                  }}
                >
                  {/* Day Header with Copy button + traffic-light dot */}
                  <div className={`text-white py-1.5 px-2 flex items-center justify-between ${
                    ehOrigemTroca ? 'bg-[#D4A017]' : 'bg-[#1A3A5C]'
                  }`}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        semaforo === 'green' ? 'bg-emerald-400' :
                        semaforo === 'amber' ? 'bg-amber-400' :
                        semaforo === 'red' ? 'bg-red-400' : 'bg-gray-400'
                      }`} title={`Energia: ${resumoDia.energia.toFixed(0)} kcal`} />
                      <span className="text-xs font-semibold">{dia.label}</span>
                      {/* v8: Badge de feriado */}
                      {(() => {
                        const feriado = getFeriadoDoDia(dia.value)
                        return feriado ? (
                          <span className="ml-1 inline-flex items-center gap-0.5 px-1 py-0 rounded bg-red-500/30 border border-red-400/50 text-[8px] text-red-100 font-bold flex-shrink-0" title={`Feriado: ${feriado.nome}`}>
                            <CalendarOff className="w-2 h-2" />
                            <span className="truncate max-w-[60px]">{feriado.nome}</span>
                          </span>
                        ) : null
                      })()}
                      {/* v6.4: Badge "Origem" quando em modo troca */}
                      {ehOrigemTroca && (
                        <span className="ml-1 px-1 py-0 rounded bg-white/20 text-[8px] font-bold flex-shrink-0">
                          ORIGEM
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* v6.4: Botão "Trocar dia" — ativa modo de troca (2 cliques) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (ehOrigemTroca) {
                            setDiaTrocaOrigem(null)
                            toast.info('Troca cancelada')
                          } else {
                            setDiaTrocaOrigem(dia.value)
                            toast.info(`Clique em outro dia para trocar com ${dia.label}`)
                          }
                        }}
                        className={`transition-colors ${
                          ehOrigemTroca
                            ? 'text-white'
                            : 'text-white/70 hover:text-[#D4A017]'
                        }`}
                        title={ehOrigemTroca ? 'Cancelar troca' : 'Trocar este dia com outro (clique depois no destino)'}
                      >
                        <ArrowLeftRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openCopyDialog(dia.value, currentSemana)
                        }}
                        className="text-white/70 hover:text-white transition-colors"
                        title="Copiar refeições para outro dia"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Refeição slots */}
                  <div className="p-1.5 space-y-1.5">
                    {refeicoesForCategoria.map((cr) => {
                      const itens = getItensForSlot(dia.value, cr.tipo_refeicao_id)
                      const slotKey = `${dia.value}-${cr.tipo_refeicao_id}`
                      const isDragOver = dragOverSlot === slotKey
                      return (
                        <div
                          key={cr.tipo_refeicao_id}
                          className={`border rounded-lg p-1.5 bg-gray-50/50 transition-colors ${
                            isDragOver
                              ? 'border-[#D4A017] bg-[#D4A017]/5 ring-1 ring-[#D4A017]/30'
                              : 'border-gray-100'
                          }`}
                          onDragOver={(e) => {
                            e.preventDefault()
                            // ⚠️ Importante: usar 'copyMove' para permitir tanto move quanto copy
                            // (setar apenas 'move' faz o navegador bloquear o cursor de cópia com Alt)
                            e.dataTransfer.dropEffect = e.altKey ? 'copy' : 'move'
                            if (!isDragOver) setDragOverSlot(slotKey)
                          }}
                          onDragLeave={() => {
                            if (dragOverSlot === slotKey) setDragOverSlot(null)
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            setDragOverSlot(null)
                            if (draggedItem) {
                              // Alt+Drop = duplicar (cópia); Drop normal = mover
                              if (e.altKey) {
                                handleDuplicateItem(draggedItem, currentSemana, dia.value, cr.tipo_refeicao_id)
                              } else {
                                handleMoveItem(draggedItem, currentSemana, dia.value, cr.tipo_refeicao_id)
                              }
                              setDraggedItem(null)
                              setDragAltHint(false)
                            }
                          }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-semibold text-[#1A3A5C] truncate">{cr.tipo_refeicao.nome}</span>
                            <div className="flex items-center gap-1">
                              {/* v8.7: Badge de horário clicável (mostra override se existir) */}
                              <button
                                onClick={() => openHorarioDialog(
                                  cr.tipo_refeicao_id,
                                  cr.tipo_refeicao.nome,
                                  cr.tipo_refeicao.horario,
                                  (cr as { horario_efetivo?: string }).horario_efetivo ?? cr.tipo_refeicao.horario,
                                )}
                                className={`text-[8px] h-4 px-1 inline-flex items-center gap-0.5 rounded border transition-colors ${
                                  (cr as { horario_override?: unknown }).horario_override
                                    ? 'bg-[#D4A017]/15 border-[#D4A017]/50 text-[#D4A017]'
                                    : 'bg-transparent border-gray-200 text-gray-600 hover:border-[#1A3A5C]/40 hover:text-[#1A3A5C]'
                                }`}
                                title={`Horário padrão: ${cr.tipo_refeicao.horario}. Clique para editar.`}
                              >
                                <ClockIcon className="w-2.5 h-2.5" />
                                {(cr as { horario_efetivo?: string }).horario_efetivo ?? cr.tipo_refeicao.horario}
                              </button>
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
                          {/* Preparações list com drag handle + porções inline */}
                          {itens.map((item) => (
                            <div
                              key={item.id}
                              draggable
                              onDragStart={(e) => {
                                setDraggedItem(item)
                                // ⚠️ 'copyMove' permite que o navegador mostre cursor de cópia (Alt) OU de mover
                                e.dataTransfer.effectAllowed = 'copyMove'
                                // Dica visual temporária para o usuário saber que Alt = duplicar
                                setDragAltHint(true)
                              }}
                              onDragEnd={() => {
                                setDraggedItem(null)
                                setDragOverSlot(null)
                                setDragAltHint(false)
                              }}
                              className={`flex items-center gap-1 mb-1 p-1 rounded bg-white border border-gray-100 text-[10px] group cursor-grab active:cursor-grabbing ${
                                draggedItem?.id === item.id ? 'opacity-50' : ''
                              }`}
                              title="Arraste para mover • Alt+Arraste para duplicar"
                            >
                              <GripVertical className="w-2.5 h-2.5 text-gray-300 flex-shrink-0 group-hover:text-gray-400" />
                              <span className="flex-1 truncate font-medium">{item.preparacao.nome}</span>
                              {/* v8: Botões up/down para reordenar dentro do slot */}
                              <div className="flex flex-col flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleReordenarItem(item.id, 'up') }}
                                  className="text-gray-300 hover:text-[#1A3A5C] leading-none"
                                  title="Mover para cima"
                                >
                                  <ChevronUp className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleReordenarItem(item.id, 'down') }}
                                  className="text-gray-300 hover:text-[#1A3A5C] leading-none"
                                  title="Mover para baixo"
                                >
                                  <ChevronDown className="w-2.5 h-2.5" />
                                </button>
                              </div>
                              {/* Porções (display estático — definidas no cadastro da preparação) */}
                              {item.porcoes > 1 && (
                                <span
                                  className="px-1.5 py-0.5 rounded border border-gray-200 text-[9px] font-bold text-[#1A3A5C] flex-shrink-0"
                                  title={`${item.porcoes} porções`}
                                >
                                  {item.porcoes}×
                                </span>
                              )}
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
                                openAddDialog(diaData.id, cr.tipo_refeicao_id, dia.value)
                              }
                            }}
                          >
                            <Plus className="w-2.5 h-2.5 mr-0.5" /> Adicionar
                          </Button>
                        </div>
                      )
                    })}
                  </div>

                  {/* ── NOVO v7: Mini-resumo do dia (energia + indicadores) ── */}
                  {resumoDia.energia > 0 && (
                    <div className="px-2 py-1 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between text-[9px]">
                      <span className="text-muted-foreground">
                        {resumoDia.energia.toFixed(0)} kcal
                      </span>
                      <div className="flex items-center gap-1">
                        {resumoDia.ferro_heme && (
                          <span title="Contém ferro heme" className="px-1 py-0.5 rounded bg-red-50 text-red-700 text-[8px] font-bold border border-red-100">Fe-H</span>
                        )}
                        {resumoDia.vit_a && (
                          <span title="Contém Vitamina A" className="px-1 py-0.5 rounded bg-orange-50 text-orange-700 text-[8px] font-bold border border-orange-100">Vit-A</span>
                        )}
                      </div>
                    </div>
                  )}
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
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-2 p-4 overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-[#1A3A5C] text-sm">Gerenciar Preparações</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
            {/* Abas de filtro rápido */}
            <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-md flex-shrink-0">
              <button
                onClick={() => setAddFilter('all')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                  addFilter === 'all' ? 'bg-white text-[#1A3A5C] shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Search className="w-3 h-3" /> Todas
              </button>
              <button
                onClick={() => setAddFilter('favoritas')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                  addFilter === 'favoritas' ? 'bg-white text-[#D4A017] shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Star className="w-3 h-3" /> Favoritas
              </button>
              <button
                onClick={() => setAddFilter('recentes')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                  addFilter === 'recentes' ? 'bg-white text-[#1A3A5C] shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Zap className="w-3 h-3" /> + Usadas
              </button>
            </div>

            {/* Search */}
            <div className="relative flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={addPrepSearch}
                onChange={(e) => setAddPrepSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
                autoFocus
              />
            </div>

            {/* Filtro alérgenos (excluir) */}
            <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
              <span className="text-[10px] text-muted-foreground">Sem alérgeno:</span>
              {ALERGENOS_LIST.map((a) => {
                const active = addSemAlergenos.has(a.sigla)
                return (
                  <button
                    key={a.sigla}
                    onClick={() => {
                      setAddSemAlergenos(prev => {
                        const next = new Set(prev)
                        if (next.has(a.sigla)) next.delete(a.sigla)
                        else next.add(a.sigla)
                        return next
                      })
                    }}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                      active
                        ? 'bg-red-50 border-red-300 text-red-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                    title={`Excluir preparações com ${a.nome}`}
                  >
                    {a.sigla} {a.nome}
                  </button>
                )
              })}
            </div>

            {/* v8.8: Contador compacto (sem chips — selecionados aparecem no topo da lista) */}
            {addSelectedPrepIds.size > 0 && (
              <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-[#1A3A5C]/5 border border-[#1A3A5C]/10 flex-shrink-0">
                <Check className="w-3.5 h-3.5 text-[#1A3A5C]" />
                <span className="text-xs font-medium text-[#1A3A5C]">{addSelectedPrepIds.size} selecionada(s)</span>
                {(() => {
                  const paraAdd = Array.from(addSelectedPrepIds).filter(id => !addInitialPrepIds.has(id)).length
                  const paraRem = Array.from(addInitialPrepIds).filter(id => !addSelectedPrepIds.has(id)).length
                  if (paraAdd > 0 || paraRem > 0) {
                    return (
                      <span className="text-[10px] text-[#D4A017] font-medium ml-1">
                        ({paraAdd > 0 ? `+${paraAdd}` : ''}{paraAdd > 0 && paraRem > 0 ? ' ' : ''}{paraRem > 0 ? `-${paraRem}` : ''})
                      </span>
                    )
                  }
                  return null
                })()}
                <button
                  onClick={() => setAddSelectedPrepIds(new Set())}
                  className="ml-auto text-[10px] text-muted-foreground hover:text-foreground underline"
                >
                  Limpar
                </button>
              </div>
            )}

            {/* v8.8: Lista com selecionados fixados no topo + info nutricional */}
            <ScrollArea className="flex-1 min-h-0 border rounded-lg">
              <div className="p-1">
                {filteredPreparacoes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    {addPrepSearch ? 'Nenhuma preparação encontrada' : 'Nenhuma preparação cadastrada'}
                  </p>
                ) : (
                  filteredPreparacoes.map((p) => {
                    const alergenos = detectarAlergenosPreparacao(
                      p.ingredientes.map((ing) => ({
                        nome: ing.alimento.nome,
                        grupo: ing.alimento.grupo,
                      }))
                    )
                    const isSelected = addSelectedPrepIds.has(p.id)
                    const ehNovo = isSelected && !addInitialPrepIds.has(p.id)
                    // v8.8: Calcular info nutricional (kcal + proteína) usando quantidade_gramas base (100%)
                    // Mesma lógica da página de preparações — NÃO usar percapitas[0] que pode ser BERCARIO
                    const kcal = p.ingredientes.reduce((sum, ing) => {
                      const g = ing.quantidade_gramas
                      return sum + (g * (ing.alimento.energia_kcal || 0)) / 100
                    }, 0)
                    const prot = p.ingredientes.reduce((sum, ing) => {
                      const g = ing.quantidade_gramas
                      return sum + (g * (ing.alimento.proteinas_g || 0)) / 100
                    }, 0)
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-colors text-xs ${
                          isSelected
                            ? ehNovo
                              ? 'bg-emerald-50 border border-emerald-300'
                              : 'bg-[#1A3A5C]/10 border border-[#1A3A5C]/30'
                            : 'hover:bg-gray-50 border border-transparent'
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => togglePrepSelection(p.id)}
                          className="flex-shrink-0"
                        />
                        {p.favorita && (
                          <Star className="w-3 h-3 text-[#D4A017] flex-shrink-0 fill-[#D4A017]" />
                        )}
                        {ehNovo && (
                          <span className="text-[7px] font-bold text-emerald-600 bg-emerald-100 px-0.5 rounded flex-shrink-0 leading-tight">NEW</span>
                        )}
                        <span className="font-medium truncate flex-1 min-w-0">{p.nome}</span>
                        {/* Info compacta à direita */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {kcal > 0 && (
                            <span className="text-[8px] text-muted-foreground whitespace-nowrap tabular-nums">
                              {kcal.toFixed(0)}kcal
                            </span>
                          )}
                          {alergenos.length > 0 && (
                            <div className="flex items-center gap-px">
                              {alergenos.map((sigla) => (
                                <span
                                  key={sigla}
                                  className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm border border-gray-300 text-[7px] font-bold text-gray-600"
                                  title={sigla}
                                >
                                  {sigla}
                                </span>
                              ))}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              openEditPrepInDialog(p.id)
                            }}
                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded p-0.5 transition-colors"
                            title="Editar preparação"
                          >
                            <Pencil className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </label>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter className="gap-2 flex-shrink-0">
            {/* v8: Botão para criar nova preparação — abre sub-dialog (não abre nova aba) */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openNewPrepInDialog}
              className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 mr-auto"
            >
              <Plus className="w-3 h-3 mr-1" /> Nova Preparação
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(false)} disabled={adding}>Cancelar</Button>
            <Button
              size="sm"
              onClick={handleAddPreparacoes}
              disabled={adding}
              className="bg-[#1A3A5C] hover:bg-[#1A3A5C]/90"
            >
              {adding ? 'Salvando...' : (() => {
                const paraAdd = Array.from(addSelectedPrepIds).filter(id => !addInitialPrepIds.has(id)).length
                const paraRem = Array.from(addInitialPrepIds).filter(id => !addSelectedPrepIds.has(id)).length
                if (paraAdd > 0 && paraRem > 0) return `Salvar (+${paraAdd} / -${paraRem})`
                if (paraAdd > 0) return `Adicionar ${paraAdd} preparação(ões)`
                if (paraRem > 0) return `Remover ${paraRem} preparação(ões)`
                return 'Nenhuma alteração'
              })()}
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

      {/* v8: Dialog Configurar Data de Início */}
      <Dialog open={dataInicioDialogOpen} onOpenChange={setDataInicioDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1A3A5C] text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Configurar Data de Início
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Defina a data de início da <strong>Semana 1</strong> (deve ser uma segunda-feira).
              Todas as demais semanas serão calculadas automaticamente (semana 2 = +7 dias, etc).
              As datas são usadas para mostrar feriados no PDF e no editor.
            </p>
            <div className="space-y-2">
              <Label className="text-sm">Data de início (Segunda-feira)</Label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                {dataInicio && new Date(dataInicio + 'T12:00:00').getDay() !== 1 && (
                  <span className="text-amber-600 font-medium">
                    ⚠️ Esta data não é uma segunda-feira. Recomendamos ajustar para o início da semana.
                  </span>
                )}
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDataInicioDialogOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSaveDataInicio} disabled={saving || !dataInicio} className="bg-[#1A3A5C] hover:bg-[#1A3A5C]/90">
                {saving ? 'Salvando...' : 'Atualizar Datas'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* v8: Dialog Editar Nome do Cardápio */}
      <Dialog open={nomeDialogOpen} onOpenChange={setNomeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1A3A5C] text-sm flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              Editar Nome do Cardápio
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label className="text-sm">Nome</Label>
              <Input
                value={editandoNome}
                onChange={(e) => setEditandoNome(e.target.value)}
                placeholder="Ex: Cardápio Creche 2025/2"
                className="text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editandoNome.trim()) {
                    handleSaveNome()
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setNomeDialogOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSaveNome} disabled={saving || !editandoNome.trim()} className="bg-[#1A3A5C] hover:bg-[#1A3A5C]/90">
                {saving ? 'Salvando...' : 'Salvar Nome'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* v8: AlertDialog de Exclusão do Cardápio */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(v) => !deleting && setDeleteDialogOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              Excluir este cardápio?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{cardapio?.nome}</strong>?
              <br />
              <span className="text-red-600 font-medium">
                Esta ação é irreversível e removerá TODAS as semanas, dias e itens deste cardápio.
              </span>
              <br /><br />
              Se for um cardápio de escola, o cardápio base permanece intacto. Se for um base, as instâncias já criadas nas escolas também permanecem (mas perdem o vínculo de origem).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCardapio}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Excluindo...' : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ Sub-dialog: Nova/Editar Preparação (sem sair da página) ═══ */}
      <PreparacaoFormDialog
        open={prepDialogOpenInCardapio}
        onOpenChange={setPrepDialogOpenInCardapio}
        editingPrepId={editingPrepInDialog}
        editingPrep={
          editingPrepInDialog
            ? (preparacoes.find((p) => p.id === editingPrepInDialog) as PreparacaoLite | undefined)
            : null
        }
        onSaved={handlePrepSaved}
        onCloned={handlePrepCloned}
        onDeleted={handlePrepDeleted}
      />

      {/* ═══ v8.7: Dialog para editar horário customizado de refeição ═══ */}
      <Dialog open={horarioDialogOpen} onOpenChange={setHorarioDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1A3A5C] text-sm flex items-center gap-2">
              <ClockIcon className="w-4 h-4" />
              Editar Horário — {horarioEditando?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Defina o horário desta refeição para <b>este cardápio</b>. O padrão é{' '}
              <code className="bg-gray-100 px-1 rounded text-[10px]">{horarioEditando?.horarioDefault}</code>.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Horário</Label>
              <Input
                value={horarioInput}
                onChange={(e) => setHorarioInput(e.target.value)}
                placeholder="Ex: 09h00 / 15h00"
                autoFocus
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Para indicar que a refeição é servida em mais de um horário, separe com{' '}
                <code className="bg-gray-100 px-1 rounded">/</code>. Exemplo:{' '}
                <code className="bg-gray-100 px-1 rounded">09h00 / 15h00</code>.
                A preparação aparece <b>uma vez só</b> no cardápio, mas com ambos os horários discriminados.
              </p>
            </div>

            {/* Sugestões rápidas */}
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] text-muted-foreground self-center mr-1">Sugestões:</span>
              {[
                '09h00 / 15h00',
                '07h30min',
                '09h00min',
                '11h00min',
                '15h00min',
              ].map(s => (
                <button
                  key={s}
                  onClick={() => setHorarioInput(s)}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 hover:bg-gray-50 hover:border-[#1A3A5C]/30"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2 flex justify-between sm:justify-between">
            {/* Reset (remove override) */}
            {horarioEditando && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetHorario}
                disabled={salvandoHorario}
                className="text-red-600 border-red-200 hover:bg-red-50"
                title="Remove o override e volta para o horário padrão"
              >
                Restaurar padrão
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={() => setHorarioDialogOpen(false)} disabled={salvandoHorario}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSaveHorario}
                disabled={salvandoHorario || !horarioInput.trim()}
                className="bg-[#1A3A5C] hover:bg-[#1A3A5C]/90"
              >
                {salvandoHorario ? 'Salvando...' : 'Salvar Horário'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
