'use client'

import { useEffect, useState, useCallback, useMemo, Fragment } from 'react'
import { motion } from 'framer-motion'
import { SeletorSemana } from '@/components/seletor-semana'
import { AjusteDialog } from '@/components/ajuste-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Wheat,
  Package,
  Cookie,
  Printer,
  AlertTriangle,
  AlertCircle,
  Table2,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  Save,
  CalendarOff,
  ListChecks,
} from 'lucide-react'
// v9.10.13: quadro de tarefas do aviso — checklist clicável no banner +
// quebras de linha preservadas (antes o texto saía tudo corrido)
import { AvisoConteudo } from '@/components/aviso-conteudo'
import { alternarTarefa, converterLinhasEmTarefas } from '@/lib/aviso-utils'
// v9.10.9: import Link removido — só servia ao botão "Romaneio →" (inativado)
import { formatarData, numeroSemana, anoSemana, inicioSemana, fimSemana, formatarPeriodoSemana, dataISO, DIAS_SEMANA, DIAS_LABEL_CURTO, DIAS_PRODUCAO, DIAS_LABEL_CURTO_PRODUCAO, type DiaSemana, type DiaProducao } from '@/lib/date-utils'
import type { ProducaoDia, ItemProducao } from '@/lib/producao-utils'
import { PF_PRODUCAO_PARA_ENTREGA, ehDiaProducaoDoProduto } from '@/lib/producao-utils'
// v9.10.14: 2ª via da folha de PF virou GUIA DE SEPARAÇÃO — manhã = pão
// comum (entregas da manhã), tarde = complemento (sai junto com o PCQ)
import { montarGuiaSeparacao, formatarDataCurta, diaProduzidoLabel } from '@/lib/separacao-utils'
// v9.9.1: legenda discreta do PCQ para unidades Busca Própria — 1 forma = 50 pães
// v9.9.2: formatarFormas — exibição pt-BR (vírgula) das formas nas tabelas de PCQ
import { ehBuscaPropria, legendaPcqPaes, FORMA_PCQ_PAES, formatarFormas, formatarPfComComplemento, parseQuantidadeDecimal, formatarValorDecimal, mesclarItensPcqExcepcionais, type EscolaPcqHabilitada } from '@/lib/producao-utils'
import { consolidarProducaoSemana } from '@/lib/producao-semana-utils'
import type { RomaneioMotorista } from '@/lib/romaneio-utils'
import { agruparExtrasLancheFora } from '@/lib/romaneio-utils'  // v9.10.7
import { useAppStore } from '@/store/app-store'
import { addDays, format } from 'date-fns'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

// Mapeia dia de PRODUÇÃO → dia de ENTREGA para PCQ/Lanche (mesmo dia)
function entregaFromProducao(diaProd: DiaProducao, produto: string): string {
  if (produto === 'PF') {
    return PF_PRODUCAO_PARA_ENTREGA[diaProd] || diaProd
  }
  return diaProd
}

// v9.10.14: rótulo completo dos dias de entrega no título da guia de separação
const DIAS_LABEL_GUIA: Record<DiaSemana, string> = {
  segunda: 'SEGUNDA-FEIRA',
  terca: 'TERÇA-FEIRA',
  quarta: 'QUARTA-FEIRA',
  quinta: 'QUINTA-FEIRA',
  sexta: 'SEXTA-FEIRA',
}

export default function ProducaoPage() {
  const [data, setData] = useState<{
    semana: number
    ano: number
    tipoPao: string
    nomePao: string
    lancheRegular: string | null
    lancheBifasica: string | null
    obs: string | null
    // v9.7.5: id do cardápio da semana (para PATCH do obs)
    cardapio_id: string | null
    // v9.7.5: feriados que caem na semana (seg-sex + dom D-1)
    feriados_semana: Array<{
      data: string
      nome: string
      tipo: string
      escolas_afetadas: string
      acao: string
    }>
    dias: ProducaoDia[]
    // v9.10.12: escolas ATIVAS com PCQ habilitado (recebe_pcq + config) — view
    // Por Dia lista unidades elegíveis em ter/qui como linhas excepcionais
    escolas_pcq?: EscolaPcqHabilitada[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'dia' | 'semana'>('semana')
  const [activeTab, setActiveTab] = useState<string>('')
  const { semanaReferencia } = useAppStore()

  const [romaneios, setRomaneios] = useState<RomaneioMotorista[]>([])
  const [ajusteOpen, setAjusteOpen] = useState(false)
  // v9.5: produção extra (instituições avulsas)
  // v9.10.5: campo motorista ('JOSE' | 'AROLDO' | 'BUSCA_PROPRIA' | null —
  // null = registro anterior à v9.10.5, sem motorista definido)
  const [producaoExtra, setProducaoExtra] = useState<Array<{
    id: string; nome_instituicao: string; produto: string; dia_semana: string; motorista?: string | null; lanche_nome?: string | null; quantidade: number; observacao?: string | null
  }>>([])
  const [extraDialogOpen, setExtraDialogOpen] = useState(false)
  const [extraForm, setExtraForm] = useState({
    nome_instituicao: '', produto: 'PF', dia_semana: 'segunda', motorista: '', quantidade: 0, observacao: '',
  })
  // v9.10.12: quantidade do Inst. Extra vive em TEXTO p/ aceitar decimais
  // ("0,5" de PCQ) sem o input resetar durante a digitação
  const [extraQtdTexto, setExtraQtdTexto] = useState('')
  // v9.10.6: lanches cadastrados (página Lanches) — alimentam o select do
  // Inst. Extra: o usuário escolhe Pão Francês, PCQ ou um lanche cadastrado.
  const [lanchesCadastrados, setLanchesCadastrados] = useState<Array<{ id: string; nome: string }>>([])
  useEffect(() => {
    fetch('/api/lanches')
      .then((r) => (r.ok ? r.json() : []))
      .then((json) => setLanchesCadastrados(
        Array.isArray(json)
          ? json.filter((l: any) => l && l.nome).map((l: any) => ({ id: l.id, nome: l.nome }))
          : []
      ))
      .catch(() => setLanchesCadastrados([]))
  }, [])
  // v9.7.5: edição inline do "Aviso da Semana" (obs do cardápio semestral)
  const [avisoDialogOpen, setAvisoDialogOpen] = useState(false)
  const [avisoEditando, setAvisoEditando] = useState('')
  const [avisoSalvando, setAvisoSalvando] = useState(false)
  const [ajusteTarget, setAjusteTarget] = useState({
    escolaId: '', escolaNome: '', diaSemana: '', produto: '', quantidadeOriginal: 0,
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = semanaReferencia ? `?data=${semanaReferencia}` : ''
      const [prodRes, romRes] = await Promise.all([
        fetch(`/api/producao${params}`),
        fetch(`/api/romaneio${params}`),
      ])
      const prodJson = await prodRes.json()
      const romJson = await romRes.json()

      if (prodJson && Array.isArray(prodJson.dias)) {
        setData(prodJson)
        setActiveTab(prodJson.dias[0]?.data || '')
        setProducaoExtra(prodJson.producaoExtra || [])  // v9.5
      } else if (prodJson && !prodJson.error) {
        setData({ ...prodJson, dias: [] })
        setProducaoExtra(prodJson.producaoExtra || [])  // v9.5
      } else {
        setData(null)
      }

      if (romJson && Array.isArray(romJson.romaneios)) {
        setRomaneios(romJson.romaneios)
      }
    } catch { setData(null) }
    finally { setLoading(false) }
  }, [semanaReferencia])

  useEffect(() => { loadData() }, [loadData])

  // v9.5: handlers para produção extra
  async function handleSaveExtra() {
    // v9.10.12: quantidade parseada de texto (vírgula/ponto, decimal ok)
    const qtdExtra = parseQuantidadeDecimal(extraQtdTexto)
    if (!extraForm.nome_instituicao.trim() || qtdExtra <= 0) {
      toast.error('Preencha nome e quantidade')
      return
    }
    // v9.10.5: motorista é obrigatório — é ele que define em qual romaneio
    // o extra vai aparecer (sem motorista, o extra fica só na produção)
    if (!extraForm.motorista) {
      toast.error('Selecione o motorista que vai levar o extra')
      return
    }
    // v9.10.6: decodifica o select de produto — 'lanche:<nome>' = lanche
    // cadastrado escolhido; PF/PCQ continuam diretos.
    const ehLancheCadastrado = extraForm.produto.startsWith('lanche:')
    const produto = ehLancheCadastrado ? 'LANCHE' : extraForm.produto
    const lanche_nome = ehLancheCadastrado ? extraForm.produto.slice('lanche:'.length) : ''
    if (produto === 'LANCHE' && !lanche_nome) {
      toast.error('Selecione qual lanche será produzido')
      return
    }
    try {
      const inicio = semanaReferencia ? new Date(semanaReferencia + 'T12:00:00') : new Date()
      const ano = inicio.getFullYear()
      const semana = numeroSemana(inicio)
      const res = await fetch('/api/producao/extra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_instituicao: extraForm.nome_instituicao,
          produto,
          lanche_nome,
          dia_semana: extraForm.dia_semana,
          motorista: extraForm.motorista,
          quantidade: qtdExtra,
          observacao: extraForm.observacao,
          ano,
          semana,
        }),
      })
      if (res.ok) {
        toast.success('Produção extra adicionada!')
        setExtraDialogOpen(false)
        setExtraForm({ nome_instituicao: '', produto: 'PF', dia_semana: 'segunda', motorista: '', quantidade: 0, observacao: '' })
        setExtraQtdTexto('')
        loadData()
      } else {
        const json = await res.json().catch(() => ({}))
        toast.error(json.error || 'Erro ao salvar')
      }
    } catch { toast.error('Erro ao salvar') }
  }

  async function handleDeleteExtra(id: string) {
    try {
      const res = await fetch(`/api/producao/extra?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Removido')
        loadData()
      }
    } catch { toast.error('Erro ao remover') }
  }

  // v9.10.13: marcar/desmarcar tarefa do quadro de avisos (checklist) —
  // atualização otimista + PATCH /api/cardapio (mesmo fluxo do editar aviso;
  // sem reload completo para o clique não "piscar" a página toda)
  async function alternarTarefaAviso(indice: number) {
    if (!data || !data.obs || !data.cardapio_id) return
    const novoObs = alternarTarefa(data.obs, indice)
    if (novoObs === data.obs) return
    const obsAnterior = data.obs
    setData({ ...data, obs: novoObs })
    try {
      const res = await fetch('/api/cardapio', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardapio_id: data.cardapio_id,
          obs: novoObs,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error(json.error || 'Erro ao salvar tarefa')
        setData({ ...data, obs: obsAnterior })
      }
    } catch {
      toast.error('Erro de conexão')
      setData({ ...data, obs: obsAnterior })
    }
  }

  // v9.7.5: abrir diálogo de edição do "Aviso da Semana"
  function abrirEdicaoAviso() {
    if (!data) return
    if (!data.cardapio_id) {
      toast.error('Semana sem cardápio cadastrado. Cadastre primeiro em /cardapio.')
      return
    }
    setAvisoEditando(data.obs || '')
    setAvisoDialogOpen(true)
  }

  // v9.7.5: salvar aviso da semana (PATCH /api/cardapio com apenas o obs)
  async function handleSaveAviso() {
    if (!data) return
    setAvisoSalvando(true)
    try {
      const res = await fetch('/api/cardapio', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // v9.8.7: usar cardapio_id (mais confiável que ano+semana, que
          // vinham errados — API de produção retorna semana ISO 1-52, não
          // semana letiva 1-22 que é a chave única no banco).
          cardapio_id: data.cardapio_id,
          obs: avisoEditando,
        }),
      })
      if (res.ok) {
        toast.success('Aviso da semana atualizado!')
        setAvisoDialogOpen(false)
        loadData()
      } else {
        const json = await res.json().catch(() => ({}))
        toast.error(json.error || 'Erro ao salvar aviso')
      }
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setAvisoSalvando(false)
    }
  }

  function openAjuste(item: ItemProducao) {
    // v9.10.6: instituições extras (Inst. Extra) não são escolas — o POST de
    // ajuste com o id delas ("extra_...") violava a FK Ajuste_escola_id_fkey
    // (P2003). O ajuste delas não existe: edita/remove pelo botão Inst. Extra.
    if (item.escola_id?.startsWith('extra_')) {
      toast.info('Produção extra não usa ajuste — edite ou remova pelo botão "Inst. Extra"')
      return
    }
    setAjusteTarget({
      escolaId: item.escola_id, escolaNome: item.escola_nome,
      diaSemana: item.dia_entrega || '', produto: item.produto,
      quantidadeOriginal: item.zerado ? 0 : item.quantidade,
    })
    setAjusteOpen(true)
  }

  function openAjusteFromWeekly(escolaId: string, escolaNome: string, diaProd: DiaProducao, produto: 'PF' | 'PCQ' | 'LANCHE', quantidade: number) {
    // v9.10.6: mesma guarda do openAjuste — linhas de instituições extras na
    // view Semanal não são escolas (evita P2003 no /api/ajustes)
    if (escolaId?.startsWith('extra_')) {
      toast.info('Produção extra não usa ajuste — edite ou remova pelo botão "Inst. Extra"')
      return
    }
    // v9.4: permite ajustar mesmo se quantidade for 0 (célula vazia)
    const diaEntrega = entregaFromProducao(diaProd, produto)

    // v9.7.4: Se já tem ajuste, mostrar o motivo antes de abrir o dialog
    const ajusteKey = `${escolaId}_${diaEntrega}_${produto}`
    const ajusteInfo = ajustesInfoMap.get(ajusteKey)
    if (ajusteInfo) {
      // Mostra o motivo e permite editar
      const confirmar = window.confirm(
        `Ajuste existente:\n\n` +
        `Quantidade original: ${ajusteInfo.qtd_original}\n` +
        `Quantidade atual: ${quantidade}\n` +
        `Motivo: ${ajusteInfo.motivo}\n\n` +
        `Deseja editar este ajuste?`
      )
      if (!confirmar) return
    }

    setAjusteTarget({
      escolaId,
      escolaNome,
      diaSemana: diaEntrega,
      produto,
      quantidadeOriginal: quantidade,
    })
    setAjusteOpen(true)
  }

  // v9.5: injeta produções extras como ItemProducao nos dias de produção
  // (silenciosamente — aparecem junto com as escolas na produção e impressão)
  // IMPORTANTE: este useMemo fica ANTES do early return para respeitar
  // as Rules of Hooks do React (não pode haver hook depois de return).
  // v9.10.6: extras de LANCHE cujo lanche escolhido é DIFERENTE do lanche da
  // semana (regular/bifásico) NÃO são injetados — não podem misturar com a
  // produção normal de lanches (totais/tabelas). Eles aparecem "separadinhos"
  // na folha de produção de Lanches (bloco próprio, mesma página) e anotados
  // no romaneio do motorista.
  const diasComExtra = useMemo<ProducaoDia[]>(() => {
    if (!data || producaoExtra.length === 0) return data?.dias || []
    // v9.10.6: nomes dos lanches da semana (regular + bifásico) para comparar
    const lanchesDaSemana = [data.lancheRegular, data.lancheBifasica]
      .filter((n): n is string => !!n && !!n.trim())
      .map((n) => n.trim().toLowerCase())
    const ehLancheForaDaSemana = (extra: { produto: string; lanche_nome?: string | null }) =>
      extra.produto === 'LANCHE' && !!extra.lanche_nome?.trim() &&
      !lanchesDaSemana.includes(extra.lanche_nome.trim().toLowerCase())
    const extrasParaInjetar = producaoExtra.filter((extra) => !ehLancheForaDaSemana(extra))
    if (extrasParaInjetar.length === 0) return data.dias || []
    // Deep copy dos dias com seus arrays de itens (para não mutar o estado)
    const novosDias: ProducaoDia[] = (data.dias || []).map((d) => ({
      ...d,
      itens_pf: [...(d.itens_pf || [])],
      itens_pcq: [...(d.itens_pcq || [])],
      itens_lanche: [...(d.itens_lanche || [])],
    }))
    // Inverte o mapa PF: entrega -> produção (D-1)
    const entregaParaProducaoPF: Record<string, string> = {}
    Object.entries(PF_PRODUCAO_PARA_ENTREGA).forEach(([prodKey, entregaKey]) => {
      entregaParaProducaoPF[entregaKey] = prodKey
    })
    for (const extra of extrasParaInjetar) {
      let diaKeyAlvo: string | null = null
      if (extra.produto === 'PF') {
        diaKeyAlvo = entregaParaProducaoPF[extra.dia_semana] || null
      } else {
        // PCQ/Lanche: produção = entrega (mesmo dia)
        diaKeyAlvo = extra.dia_semana
      }
      if (!diaKeyAlvo) continue
      const dia = novosDias.find((d) => d.dia_key === diaKeyAlvo)
      if (!dia) continue
      const nomeCurto =
        extra.nome_instituicao.length > 25
          ? extra.nome_instituicao.substring(0, 25)
          : extra.nome_instituicao
      const novoItem: ItemProducao = {
        escola_id: `extra_${extra.id}`,
        escola_nome: extra.nome_instituicao,
        escola_curto: nomeCurto,
        categoria: 'EXTRA',
        rota: 'OUTROS',
        // v9.5.2: ordem_rota alta para aparecer por último dentro da rota OUTROS
        ordem_rota: 9999,
        // v9.6.3: ordem_pcq alta para aparecer por último no PCQ também
        ordem_pcq: 9999,
        busca_propria: false,
        produto: extra.produto as ItemProducao['produto'],
        quantidade: extra.quantidade,
        unidade: extra.produto === 'PF' ? 'un' : 'formas',
        dia_entrega: extra.dia_semana,
        obs: extra.observacao || undefined,
      }
      if (extra.produto === 'PF') {
        dia.itens_pf.push(novoItem)
        dia.total_pf = (dia.total_pf || 0) + extra.quantidade
      } else if (extra.produto === 'PCQ') {
        dia.itens_pcq.push(novoItem)
        dia.total_pcq = (dia.total_pcq || 0) + extra.quantidade
      } else if (extra.produto === 'LANCHE') {
        dia.itens_lanche.push(novoItem)
        dia.total_lanche = (dia.total_lanche || 0) + extra.quantidade
      }
    }
    return novosDias
  }, [data, producaoExtra])

  // Usa diasComExtra para que as instituições extras apareçam junto (silenciosamente)
  const consolidado = consolidarProducaoSemana(diasComExtra)

  // v9.7.4: Construir lookup de ajustes para destacar células e mostrar motivo
  // MOVIDO para antes do early return (Rules of Hooks)
  const ajustesInfoMap = useMemo(() => {
    const map = new Map<string, { motivo: string; qtd_original: number }>()
    if (!data) return map
    for (const dia of diasComExtra) {
      const allItems = [...(dia.itens_pf || []), ...(dia.itens_pcq || []), ...(dia.itens_lanche || [])]
      for (const item of allItems) {
        if (item.ajustado && item.dia_entrega) {
          const key = `${item.escola_id}_${item.dia_entrega}_${item.produto}`
          map.set(key, {
            motivo: (item as any).ajuste_motivo || 'Sem motivo informado',
            qtd_original: (item as any).ajuste_qtd_original ?? item.quantidade,
          })
        }
      }
    }
    return map
  }, [diasComExtra, data])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
          <span className="text-muted-foreground">Calculando produção...</span>
        </div>
      </div>
    )
  }

  // PF unit label
  const pfUnit = 'unid.'
  const pcqUnit = 'formas'

  // v9.7.3: estas variáveis precisam estar depois do early return
  const inicio = semanaReferencia ? new Date(semanaReferencia + 'T12:00:00') : new Date()
  const domingo = addDays(inicio, -1)
  const semanaLabel = `Semana ${data.semana} — ${formatarPeriodoSemana(inicioSemana(inicio), fimSemana(inicio))}`

  // Lanche name
  const lancheNome = data.lancheRegular || data.lancheBifasica || 'Lanche'

  // v9.10.6: extras de lanche FORA da semana (preparação diferente da semana).
  // Não entram na injeção (diasComExtra) — portanto não misturam com os totais
  // do lanche normal — e aparecem "separadinhos" na folha de produção de
  // Lanches (P4), agrupados pelo lanche escolhido, na MESMA página.
  const lanchesDaSemanaNomes = [data.lancheRegular, data.lancheBifasica]
    .filter((n): n is string => !!n && !!n.trim())
    .map((n) => n.trim().toLowerCase())
  const DIAS_ENTREGA_EXTRA = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']
  function extraEhLancheDiferente(nome: string | null | undefined): boolean {
    if (!nome || !nome.trim()) return false
    return !lanchesDaSemanaNomes.includes(nome.trim().toLowerCase())
  }
  const extrasLancheDiferente = (producaoExtra || []).filter((extra) =>
    extra.produto === 'LANCHE' &&
    extraEhLancheDiferente(extra.lanche_nome) &&
    DIAS_ENTREGA_EXTRA.includes(extra.dia_semana) &&
    extra.quantidade > 0)
  // Agrupado por lanche (case-insensitive) → blocos compactos na P4, ordenados
  // por nome; extras dentro do bloco ordenados por dia da semana.
  const gruposLancheExtra: Array<{ lanche: string; extras: typeof extrasLancheDiferente }> = []
  for (const e of extrasLancheDiferente) {
    const nome = (e.lanche_nome || '').trim()
    let g = gruposLancheExtra.find((x) => x.lanche.toLowerCase() === nome.toLowerCase())
    if (!g) { g = { lanche: nome, extras: [] }; gruposLancheExtra.push(g) }
    g.extras.push(e)
  }
  gruposLancheExtra.sort((a, b) => a.lanche.localeCompare(b.lanche))
  gruposLancheExtra.forEach((g) =>
    g.extras.sort((a, b) => DIAS_ENTREGA_EXTRA.indexOf(a.dia_semana) - DIAS_ENTREGA_EXTRA.indexOf(b.dia_semana)))

  // Data/hora de geração
  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm")

  // v9.5.4: ordenação puramente SEQUENCIAL por ordem_rota → nome_curto.
  // NÃO agrupa por rota — usuário quer 1, 2, 3, 4... independente do motorista.
  function sortEscolas(a: any, b: any) {
    if ((a.ordem_rota ?? 0) !== (b.ordem_rota ?? 0)) return (a.ordem_rota ?? 0) - (b.ordem_rota ?? 0)
    return (a.nome_curto || '').localeCompare(b.nome_curto || '')
  }

  // v9.6.3: ordenação ESPECÍFICA para PCQ (pão de cachorro quente).
  // Usa o campo ordem_pcq (separado de ordem_rota) para permitir que o
  // usuário defina uma ordem diferente apenas para PCQ nos documentos
  // impressos de produção. Se ordem_pcq for 0 para ambas, cai no desempate
  // alfabético por nome_curto.
  function sortEscolasPCQ(a: any, b: any) {
    const oa = a.ordem_pcq ?? 0
    const ob = b.ordem_pcq ?? 0
    if (oa !== ob) return oa - ob
    return (a.nome_curto || '').localeCompare(b.nome_curto || '')
  }

  // v9.7.3: não filtrar por total > 0 na view semanal — escolas com ajuste zerando
  // continuam visíveis (igual view Por Dia). A impressão continua filtrando zerados.
  // v9.7.4: helper para destacar células ajustadas na view semanal
  // v9.7.5: BUGFIX — só retorna ajuste se o dia for um dia VÁLIDO de produção
  // para o produto. Antes, ajuste de quinta (PF D-1 entrega sexta) "vazava"
  // para a coluna sexta na tabela de PF (que não tem produção na sexta).
  function getAjusteInfo(escolaId: string, diaProd: DiaProducao, produto: string) {
    if (!ehDiaProducaoDoProduto(diaProd, produto)) return undefined
    const diaEntrega = entregaFromProducao(diaProd, produto)
    return ajustesInfoMap.get(`${escolaId}_${diaEntrega}_${produto}`)
  }

  const escolasPF = consolidado.escolas.filter(e => e.total_pf > 0).sort(sortEscolas)
  const escolasRegularesPF = escolasPF.filter(e => (e.rota || '').toUpperCase() !== 'OUTROS')
  const escolasOutrasPF = escolasPF.filter(e => (e.rota || '').toUpperCase() === 'OUTROS')

  // v9.7.4: PCQ e Lanche na view semanal — mostra escolas que RECEBEM o produto
  // (recebe_pcq === true) mesmo se zerado por ajuste/feriado, para permitir reajustar.
  // Não mostra escolas desmarcadas (recebe_pcq === false).
  const escolasPCQ = consolidado.escolas.filter(e => e.total_pcq > 0 || (e as any).recebe_pcq === true).sort(sortEscolasPCQ)
  const escolasLanche = consolidado.escolas.filter(e => e.total_lanche > 0 || (e as any).recebe_lanche === true).sort(sortEscolas)

  // v9.9.1: existem unidades Busca Própria com PCQ nesta semana? Usado para
  // exibir a nota de legenda "(N) = pães · 1 forma = 60 pães" na tela e na
  // impressão da página PCQ.
  const temBuscaPropriaPCQ = escolasPCQ.some((e) => ehBuscaPropria(e) && e.total_pcq > 0)

  // Datas para o romaneio (entrega: segunda-sexta)
  const datasEntrega: Record<DiaSemana, string> = {
    segunda: dataISO(inicio),
    terca: dataISO(addDays(inicio, 1)),
    quarta: dataISO(addDays(inicio, 2)),
    quinta: dataISO(addDays(inicio, 3)),
    sexta: dataISO(addDays(inicio, 4)),
  }

  // v9.10.14: dados da GUIA DE SEPARAÇÃO (2ª via do PF) — mesmo consolidador
  // da folha: manhã = base (pf − pf_comp), tarde = complemento (pf_comp)
  const guiaSeparacao = montarGuiaSeparacao(escolasPF, datasEntrega)

  // ---------- Componente de impressão da página PF ----------
  const printPFPage = (copyLabel?: string) => (
    <div>
      {/* Header */}
      <div className="print-doc-header">
        <div className="print-doc-header-left">
          <div className="print-doc-logo"><img src="/brasao.jpg" alt="Brasão" /></div>
          <div className="print-doc-title-block">
            <div className="print-doc-title">PRODUÇÃO — PÃO FRANCÊS{copyLabel ? ` (${copyLabel})` : ''}</div>
            <div className="print-doc-subtitle">Padaria Escolar Municipal — Prefeitura de Lucas do Rio Verde / MT</div>
            <div className="print-doc-subtitle">Quantidades a produzir por dia da semana</div>
          </div>
        </div>
        <div className="print-doc-header-right">
          <div className="print-doc-gerado">GERADO EM</div>
          <div className="print-doc-gerado-date">{geradoEm}</div>
        </div>
      </div>

      {/* Info block — PÃO e LANCHE lado a lado */}
      <div className="print-info-block">
        <div className="print-info-left">
          <div className="print-info-semana">SEMANA {data.semana} / {data.ano}</div>
          <div className="print-info-periodo">{formatarPeriodoSemana(inicioSemana(inicio), fimSemana(inicio))}</div>
        </div>
        <div className="print-info-right">
          <div className="print-info-inline">
            <span className="print-info-item"><span className="print-info-label">PÃO:</span> {data.nomePao}</span>
            {lancheNome && <span className="print-info-item print-info-divider"><span className="print-info-label">LANCHE:</span> {lancheNome}</span>}
          </div>
        </div>
      </div>

      {/* PF Section */}
      <div className="print-section-header">
        <span className="print-section-title-text">PÃO FRANCÊS</span>
        <span className="print-section-total">Total: {consolidado.total_pf.toLocaleString('pt-BR')} {pfUnit}</span>
      </div>
      <table className="print-table">
        <thead>
          <tr>
            <th className="print-col-escola">ESCOLA / UNIDADE</th>
            {DIAS_PRODUCAO.map((d) => (
              <th key={d} className="print-col-dia">{DIAS_LABEL_CURTO_PRODUCAO[d]}</th>
            ))}
            <th className="print-col-total">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {escolasRegularesPF.map((escola) => (
            <tr key={escola.id}>
              <td className="print-col-escola">
                <span className="print:hidden" style={{ color: '#999', fontSize: '0.85em', marginRight: '0.3em' }}>{escola.ordem_rota}</span>
                {escola.nome_curto}
              </td>
              {/* v9.10.10 · v9.10.11: dia com complemento mostra "base + complemento"
                  (ex.: "150 + 10"; creche/qualquer escola com SÓ complemento no
                  dia mostra "0 + 10") — a soma continua a mesma; sem complemento,
                  número puro como sempre. Totais ficam em soma pura (abaixo). */}
              {DIAS_PRODUCAO.map((d) => (
                <td key={d} className="print-col-dia">
                  {formatarPfComComplemento(escola.pf[d], escola.pf_comp[d])}
                </td>
              ))}
              {/* v9.10.11: coluna TOTAL volta à somatória pura (sem "+ x") */}
              <td className="print-col-total">{escola.total_pf.toLocaleString('pt-BR')}</td>
            </tr>
          ))}
          {escolasOutrasPF.length > 0 && (
            <tr className="print-row-separator-black">
              <td colSpan={8}>Produção Extra</td>
            </tr>
          )}
          {escolasOutrasPF.map((escola) => (
            <tr key={`outros-${escola.id}`}>
              <td className="print-col-escola">
                <span className="print:hidden" style={{ color: '#999', fontSize: '0.85em', marginRight: '0.3em' }}>{escola.ordem_rota}</span>
                {escola.nome_curto}
              </td>
              {/* v9.10.10: mesmo formato das escolas regulares (extras não têm
                  complemento — pf_comp fica 0 e a célula sai como sempre) */}
              {DIAS_PRODUCAO.map((d) => (
                <td key={d} className="print-col-dia">
                  {formatarPfComComplemento(escola.pf[d], escola.pf_comp[d])}
                </td>
              ))}
              {/* v9.10.11: idem no bloco Produção Extra — TOTAL puro */}
              <td className="print-col-total">{escola.total_pf.toLocaleString('pt-BR')}</td>
            </tr>
          ))}
          <tr className="print-row-total">
            <td className="print-col-escola">TOTAL GERAL ({pfUnit.toUpperCase()})</td>
            {/* v9.10.11: linha TOTAL GERAL volta à somatória pura (ex.: "1200") —
                sem o "+ x" para não poluir; o desdobramento fica nas células
                de dia das escolas (formato v9.10.10/11 acima) */}
            {DIAS_PRODUCAO.map((d) => (
              <td key={d} className="print-col-dia">{consolidado.totais_por_dia.pf[d] || '—'}</td>
            ))}
            <td className="print-col-total">{consolidado.total_pf.toLocaleString('pt-BR')}</td>
          </tr>
        </tbody>
      </table>
      {/* v9.8.2: Aviso da Semana removido da impressão (é interno do planejamento) */}

      {/* Footer */}
      <div className="print-footer">Sistema de Gestão da Padaria Escolar Municipal — Lucas do Rio Verde / MT</div>
    </div>
  )

  // ---------- v9.10.14: PÁGINA 2 — GUIA DE SEPARAÇÃO (substitui a 2ª via) ----------
  // Os padeiros misturavam o pão comum (manhã) com o complemento (tarde) na
  // hora de despachar. A guia lista, por DIA DE ENTREGA, o que separar de
  // MANHÃ (pão comum) e à TARDE (complemento, que sai junto com o PCQ), com
  // quadrinho para marcar cada linha conferida.
  const printGuiaSeparacao = () => (
    <div>
      <div className="print-doc-header">
        <div className="print-doc-header-left">
          <div className="print-doc-logo"><img src="/brasao.jpg" alt="Brasão" /></div>
          <div className="print-doc-title-block">
            <div className="print-doc-title">GUIA DE SEPARAÇÃO — PÃO FRANCÊS</div>
            <div className="print-doc-subtitle">Padaria Escolar Municipal — Prefeitura de Lucas do Rio Verde / MT</div>
            <div className="print-doc-subtitle">Separar por escola, quantidade e PERÍODO — manhã e tarde NÃO se misturam</div>
          </div>
        </div>
        <div className="print-doc-header-right">
          <div className="print-doc-gerado">GERADO EM</div>
          <div className="print-doc-gerado-date">{geradoEm}</div>
        </div>
      </div>

      <div className="print-info-block">
        <div className="print-info-left">
          <div className="print-info-semana">SEMANA {data.semana} / {data.ano}</div>
          <div className="print-info-periodo">{formatarPeriodoSemana(inicioSemana(inicio), fimSemana(inicio))}</div>
        </div>
        <div className="print-info-right">
          <div className="print-info-inline">
            <span className="print-info-item"><span className="print-info-label">PÃO:</span> {data.nomePao}</span>
          </div>
        </div>
      </div>

      {/* A regra que resolve a confusão, logo no topo */}
      <div className="print-feriado">
        MANHÃ = pão francês comum (entregas da manhã) · TARDE = PÃO COMPLEMENTO (sai junto com o PCQ). Separe em caixas diferentes e marque cada linha conferida.
      </div>

      {guiaSeparacao.length === 0 && (
        <div className="print-feriado">Nenhum pão francês a separar nesta semana.</div>
      )}

      {guiaSeparacao.map((dia) => (
        <div key={dia.dia_entrega}>
          <div className="print-section-header">
            <span className="print-section-title-text">
              {DIAS_LABEL_GUIA[dia.dia_entrega]} · {formatarDataCurta(dia.data)}
              <span style={{ color: '#ddd', fontSize: '9pt', fontWeight: 400, textTransform: 'none' }}>
                {' '}— pão produzido {diaProduzidoLabel(dia.dia_producao)}
              </span>
            </span>
            <span className="print-section-total">Total: {dia.total_dia.toLocaleString('pt-BR')} {pfUnit}</span>
          </div>
          <table className="print-table">
            <thead>
              <tr>
                <th className="print-col-guia-escola">ESCOLA / UNIDADE</th>
                <th className="print-col-guia-qtd">QTD</th>
                <th className="print-col-guia-check">CONFERIDO</th>
              </tr>
            </thead>
            <tbody>
              <tr className="print-row-separator-black">
                <td colSpan={3}>MANHÃ — PÃO FRANCÊS COMUM ({dia.manha.total.toLocaleString('pt-BR')} {pfUnit})</td>
              </tr>
              {dia.manha.linhas.length === 0 && (
                <tr><td colSpan={3} className="print-guia-vazio">— nada a separar de manhã —</td></tr>
              )}
              {dia.manha.linhas.map((l) => (
                <tr key={`m-${dia.dia_entrega}-${l.id}`}>
                  <td className="print-col-guia-escola">
                    {l.nome_curto}
                    {l.busca_propria && <span className="print-guia-tag"> · busca própria</span>}
                    {l.extra && <span className="print-guia-tag"> · extra</span>}
                  </td>
                  <td className="print-col-guia-qtd">{l.quantidade.toLocaleString('pt-BR')}</td>
                  <td className="print-col-guia-check"><span className="print-check" /></td>
                </tr>
              ))}
              <tr className="print-row-separator">
                <td colSpan={3}>TARDE — PÃO COMPLEMENTO ({dia.tarde.total.toLocaleString('pt-BR')} {pfUnit})</td>
              </tr>
              {dia.tarde.linhas.length === 0 && (
                <tr><td colSpan={3} className="print-guia-vazio">— nada a separar à tarde —</td></tr>
              )}
              {dia.tarde.linhas.map((l) => (
                <tr key={`t-${dia.dia_entrega}-${l.id}`}>
                  <td className="print-col-guia-escola">
                    {l.nome_curto}
                    {l.busca_propria && <span className="print-guia-tag"> · busca própria</span>}
                    {l.extra && <span className="print-guia-tag"> · extra</span>}
                  </td>
                  <td className="print-col-guia-qtd">{l.quantidade.toLocaleString('pt-BR')}</td>
                  <td className="print-col-guia-check"><span className="print-check" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div className="print-footer">Sistema de Gestão da Padaria Escolar Municipal — Lucas do Rio Verde / MT</div>
    </div>
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ===== IMPRESSÃO — Tudo junto: Produção (PF×2 + PCQ/Lanche) + Romaneio ===== */}
      <div className="print-only">

        {/* ==================== PÁGINA 1: PÃO FRANCÊS (1ª via) ==================== */}
        {printPFPage('1ª via')}

        {/* ==================== PÁGINA 2: GUIA DE SEPARAÇÃO ====================
            v9.10.14: era a 2ª via da folha de PF (cópia da 1ª). Virou guia de
            separação: dia → escola → quantidade → período (manhã = pão comum,
            tarde = complemento), porque os padeiros mandavam tudo junto. */}
        <div className="print-page-break">
          {printGuiaSeparacao()}
        </div>

        {/* ==================== PÁGINA 3: PCQ ==================== */}
        {consolidado.total_pcq > 0 && (
          <div className="print-page-break">
            {/* Header */}
            <div className="print-doc-header">
              <div className="print-doc-header-left">
                <div className="print-doc-logo"><img src="/brasao.jpg" alt="Brasão" /></div>
                <div className="print-doc-title-block">
                  <div className="print-doc-title">PRODUÇÃO — PCQ</div>
                  <div className="print-doc-subtitle">Padaria Escolar Municipal — Prefeitura de Lucas do Rio Verde / MT</div>
                  <div className="print-doc-subtitle">Pão de Cachorro Quente</div>
                </div>
              </div>
              <div className="print-doc-header-right">
                <div className="print-doc-gerado">GERADO EM</div>
                <div className="print-doc-gerado-date">{geradoEm}</div>
              </div>
            </div>

            {/* Info block */}
            <div className="print-info-block">
              <div className="print-info-left">
                <div className="print-info-semana">SEMANA {data.semana} / {data.ano}</div>
                <div className="print-info-periodo">{formatarPeriodoSemana(inicioSemana(inicio), fimSemana(inicio))}</div>
              </div>
              <div className="print-info-right">
                <div className="print-info-inline">
                  <span className="print-info-item"><span className="print-info-label">PÃO:</span> {data.nomePao}</span>
                </div>
              </div>
            </div>

            {/* PCQ Section */}
            <div className="print-section-header">
              <span className="print-section-title-text">PCQ — PÃO DE CACHORRO QUENTE</span>
              <span className="print-section-total">Total: {consolidado.total_pcq.toLocaleString('pt-BR')} {pcqUnit}</span>
            </div>
            <table className="print-table">
              <thead>
                <tr>
                  <th className="print-col-escola">ESCOLA / UNIDADE</th>
                  {DIAS_PRODUCAO.map((d) => (
                    <th key={d} className="print-col-dia">{DIAS_LABEL_CURTO_PRODUCAO[d]}</th>
                  ))}
                  <th className="print-col-total">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {/* v9.9.1: unidades Busca Própria mostram a conversão em pães —
                    "1 (60)" = 1 forma = 60 pães de cachorro quente */}
                {escolasPCQ.map((escola, idx, arr) => {
                  const bp = ehBuscaPropria(escola)
                  // v9.10.5: separador antes do primeiro extra (categoria EXTRA =
                  // instituição avulsa do botão Inst. Extra) — mesmo padrão da
                  // página de Pão Francês
                  const mostraSeparador = escola.categoria === 'EXTRA' && (idx === 0 || arr[idx - 1].categoria !== 'EXTRA')
                  return (
                    <Fragment key={escola.id}>
                      {mostraSeparador && (
                        <tr className="print-row-separator-black">
                          <td colSpan={8}>Produção Extra</td>
                        </tr>
                      )}
                      <tr>
                        <td className="print-col-escola">{escola.nome_curto}</td>
                        {DIAS_PRODUCAO.map((d) => (
                          <td key={d} className="print-col-dia">
                            {escola.pcq[d] > 0 ? (
                              <>
                                {formatarFormas(escola.pcq[d])}
                                {bp && <span style={{ fontSize: '8pt', color: '#888', marginLeft: '1px' }}>{legendaPcqPaes(escola.pcq[d])}</span>}
                              </>
                            ) : '—'}
                          </td>
                        ))}
                        <td className="print-col-total">
                          {escola.total_pcq.toLocaleString('pt-BR')}
                          {bp && escola.total_pcq > 0 && <span style={{ fontSize: '8pt', color: '#888', marginLeft: '1px' }}>{legendaPcqPaes(escola.total_pcq)}</span>}
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
                <tr className="print-row-subtotal">
                  <td className="print-col-escola">TOTAL GERAL ({pcqUnit.toUpperCase()})</td>
                  {DIAS_PRODUCAO.map((d) => (
                    // v9.9.2: total do dia formatado em pt-BR — antes exibia o número
                    // cru (ex.: "50.20000000000001") por resíduo de ponto flutuante
                    <td key={d} className="print-col-dia">{consolidado.totais_por_dia.pcq[d] > 0 ? formatarFormas(consolidado.totais_por_dia.pcq[d]) : '—'}</td>
                  ))}
                  <td className="print-col-total">{consolidado.total_pcq.toLocaleString('pt-BR')}</td>
                </tr>
              </tbody>
            </table>

            {/* v9.9.1: nota de legenda — só quando há unidade Busca Própria com PCQ */}
            {temBuscaPropriaPCQ && (
              <div style={{ fontSize: '7.5pt', color: '#777', marginTop: '1mm', fontStyle: 'italic' }}>
                Legenda: (N) = pães de cachorro quente — 1 forma = {FORMA_PCQ_PAES} pães (unidades Busca Própria).
              </div>
            )}

            {/* v9.8.2: Aviso da Semana removido da impressão */}

            {/* Footer */}
            <div className="print-footer">Sistema de Gestão da Padaria Escolar Municipal — Lucas do Rio Verde / MT</div>
          </div>
        )}

        {/* ==================== PÁGINA 4: LANCHES (página separada) ==================== */}
        {/* v9.10.6: também imprime quando só há extras de lanche FORA da semana
            (preparação diferente) — tudo na MESMA folha, sem quebrar página */}
        {(consolidado.total_lanche > 0 || extrasLancheDiferente.length > 0) && (
          <div className="print-page-break">
            {/* Header */}
            <div className="print-doc-header">
              <div className="print-doc-header-left">
                <div className="print-doc-logo"><img src="/brasao.jpg" alt="Brasão" /></div>
                <div className="print-doc-title-block">
                  <div className="print-doc-title">PRODUÇÃO — LANCHES</div>
                  <div className="print-doc-subtitle">Padaria Escolar Municipal — Prefeitura de Lucas do Rio Verde / MT</div>
                  <div className="print-doc-subtitle">{lancheNome || 'Lanche'}</div>
                </div>
              </div>
              <div className="print-doc-header-right">
                <div className="print-doc-gerado">GERADO EM</div>
                <div className="print-doc-gerado-date">{geradoEm}</div>
              </div>
            </div>

            {/* Info block */}
            <div className="print-info-block">
              <div className="print-info-left">
                <div className="print-info-semana">SEMANA {data.semana} / {data.ano}</div>
                <div className="print-info-periodo">{formatarPeriodoSemana(inicioSemana(inicio), fimSemana(inicio))}</div>
              </div>
              <div className="print-info-right">
                <div className="print-info-inline">
                  {lancheNome && <span className="print-info-item"><span className="print-info-label">LANCHE:</span> {lancheNome}</span>}
                </div>
              </div>
            </div>

            {/* v9.10.6: seção do lanche da semana só quando há produção regular —
                os extras de lanche FORA da semana têm blocos próprios abaixo,
                "separadinhos" na MESMA folha (sem quebrar página) */}
            {consolidado.total_lanche > 0 && (
            <>
            {/* Lanche Section — tabela compacta com escolas agrupadas por dia */}
            <div className="print-section-header">
              <span className="print-section-title-text">{(lancheNome || 'Lanche').toUpperCase()} — ENTREGAS POR DIA</span>
              <span className="print-section-total">Total: {consolidado.total_lanche.toLocaleString('pt-BR')}</span>
            </div>
            <table className="print-table" style={{ tableLayout: 'fixed', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '65%', textAlign: 'left', padding: '1mm 1.5mm', fontSize: '9pt', textTransform: 'uppercase', borderBottom: '1.5pt solid #000' }}>DIA / ESCOLA</th>
                  <th style={{ width: '35%', textAlign: 'center', padding: '1mm 1.5mm', fontSize: '9pt', textTransform: 'uppercase', borderBottom: '1.5pt solid #000' }}>QUANTIDADE</th>
                </tr>
              </thead>
              <tbody>
                {DIAS_PRODUCAO.filter(d => consolidado.totais_por_dia.lanche[d] > 0).map((d) => (
                  <Fragment key={d}>
                    <tr style={{ borderTop: '1.5pt solid #000' }}>
                      <td style={{ fontWeight: '800', fontSize: '10.5pt', textTransform: 'uppercase', padding: '1.5mm 1.5mm', borderBottom: '0.5pt solid #000', letterSpacing: '0.3pt' }}>
                        ■ {DIAS_LABEL_CURTO_PRODUCAO[d].toUpperCase()}
                      </td>
                      <td style={{ fontWeight: '800', fontSize: '10.5pt', textAlign: 'center', padding: '1.5mm 1.5mm', borderBottom: '0.5pt solid #000' }}>
                        {consolidado.totais_por_dia.lanche[d]} unid.
                      </td>
                    </tr>
                    {escolasLanche.filter(e => e.lanche[d] > 0).map((escola) => (
                      <tr key={`${d}-${escola.id}`}>
                        <td style={{ padding: '0.8mm 1.5mm 0.8mm 6mm', fontSize: '10.5pt' }}>{escola.nome_curto}</td>
                        <td style={{ textAlign: 'center', padding: '0.8mm 1.5mm', fontSize: '10.5pt' }}>{escola.lanche[d]}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
            </>
            )}

            {/* v9.10.6: blocos "separadinhos" das preparações extras FORA da
                semana — mesma folha de produção de Lanches, mesma página,
                informação mínima: preparação, instituição, dia e quantidade. */}
            {gruposLancheExtra.map((g) => {
              const totalGrupo = g.extras.reduce((s, e) => s + (e.quantidade || 0), 0)
              return (
                <Fragment key={g.lanche}>
                  <div className="print-section-header print-section-spacer" style={{ paddingTop: '1.5mm' }}>
                    <span className="print-section-title-text" style={{ fontSize: '9.5pt' }}>
                      PREPARAÇÃO EXTRA — {g.lanche.toUpperCase()}
                    </span>
                    <span className="print-section-total">Total: {totalGrupo.toLocaleString('pt-BR')} unid.</span>
                  </div>
                  <table className="print-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '65%', textAlign: 'left', padding: '1mm 1.5mm', fontSize: '9pt', textTransform: 'uppercase', borderBottom: '1.5pt solid #000' }}>DIA / INSTITUIÇÃO</th>
                        <th style={{ width: '35%', textAlign: 'center', padding: '1mm 1.5mm', fontSize: '9pt', textTransform: 'uppercase', borderBottom: '1.5pt solid #000' }}>QUANTIDADE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.extras.map((e) => (
                        <tr key={e.id}>
                          <td style={{ padding: '0.8mm 1.5mm 0.8mm 6mm', fontSize: '10pt' }}>
                            {DIAS_LABEL_CURTO_PRODUCAO[e.dia_semana as DiaProducao] || e.dia_semana} · {e.nome_instituicao.length > 25 ? e.nome_instituicao.substring(0, 25) : e.nome_instituicao}
                          </td>
                          <td style={{ textAlign: 'center', padding: '0.8mm 1.5mm', fontSize: '10pt' }}>{e.quantidade}</td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: '1pt solid #000' }}>
                        <td style={{ fontWeight: 700, fontSize: '9.5pt', padding: '1mm 1.5mm' }}>TOTAL EXTRA</td>
                        <td style={{ fontWeight: 700, fontSize: '9.5pt', textAlign: 'center', padding: '1mm 1.5mm' }}>{totalGrupo.toLocaleString('pt-BR')}</td>
                      </tr>
                    </tbody>
                  </table>
                </Fragment>
              )
            })}

            {/* v9.8.2: Aviso da Semana removido da impressão */}

            {/* Footer */}
            <div className="print-footer">Sistema de Gestão da Padaria Escolar Municipal — Lucas do Rio Verde / MT</div>
          </div>
        )}

        {/* v9.5: Produções extras NÃO têm mais página separada — foram
            injetadas silenciosamente como ItemProducao nos dias de produção
            (ver useMemo diasComExtra acima). Aparecem como última instituição
            na rota OUTROS, junto com as demais. */}

        {/* ==================== ROMANEIO POR MOTORISTA ==================== */}
        {/* v9.6.6: Não imprimir romaneio da rota BUSCA_PROPRIA — essas escolas
            não têm motorista (retiram no balcão). A página não deve ser impressa. */}
        {romaneios.filter((r) => r.rota !== 'BUSCA_PROPRIA').map((romaneio) => (
          <div key={romaneio.rota}>
            {/* PF Romaneio */}
            {romaneio.total_pf > 0 && (
              <div className="print-page-break">
                {/* Header */}
                <div className="print-doc-header">
                  <div className="print-doc-header-left">
                    <div className="print-doc-logo"><img src="/brasao.jpg" alt="Brasão" /></div>
                    <div className="print-doc-title-block">
                      <div className="print-doc-title">ROTA {romaneio.rota_label.toUpperCase()} — PÃO FRANCÊS</div>
                      <div className="print-doc-subtitle">Padaria Escolar Municipal — Prefeitura de Lucas do Rio Verde / MT</div>
                      <div className="print-doc-subtitle">Entregas por dia da semana</div>
                    </div>
                  </div>
                  <div className="print-doc-header-right">
                    <div className="print-doc-gerado">GERADO EM</div>
                    <div className="print-doc-gerado-date">{geradoEm}</div>
                  </div>
                </div>

                {/* Info block */}
                <div className="print-info-block">
                  <div className="print-info-left">
                    <div className="print-info-semana">SEMANA {data.semana} / {data.ano}</div>
                    <div className="print-info-periodo">{formatarPeriodoSemana(inicioSemana(inicio), fimSemana(inicio))}</div>
                  </div>
                  <div className="print-info-right">
                    <div className="print-info-inline">
                      <span className="print-info-item"><span className="print-info-label">MOTORISTA:</span> {romaneio.rota_label}</span>
                      <span className="print-info-item print-info-divider"><span className="print-info-label">PÃO:</span> {data.nomePao}</span>
                    </div>
                  </div>
                </div>

                <div className="print-section-header">
                  <span className="print-section-title-text">PÃO FRANCÊS</span>
                  <span className="print-section-total">Total: {romaneio.total_pf.toLocaleString('pt-BR')} unid.</span>
                </div>
                <table className="print-table">
                  <thead><tr>
                    <th className="print-col-escola">ESCOLA / UNIDADE</th>
                    {DIAS_SEMANA.map((d) => (<th key={d} className="print-col-dia">{DIAS_LABEL_CURTO[d]}</th>))}
                    <th className="print-col-total">TOTAL</th>
                  </tr></thead>
                  <tbody>
                    {romaneio.escolas.filter((e) => e.total_pf > 0).map((escola, idx, arr) => {
                      // v9.8.4/v9.8.5: creches (têm pf_comp) — PF vai agrupado com PCQ,
                      // mostro "—" em todos os dias da tabela de PF do motorista.
                      // Bifásicas também têm pf_comp agrupado em PCQ, MAS continuam
                      // aparecendo na tabela de PF com seu PF regular do café da manhã.
                      const isCreche = escola.categoria === 'CRECHE'
                      // v9.10.5: separador antes do primeiro extra (categoria EXTRA =
                      // instituição avulsa do botão Inst. Extra com motorista definido)
                      const mostraSeparador = escola.categoria === 'EXTRA' && (idx === 0 || arr[idx - 1].categoria !== 'EXTRA')
                      return (
                        <Fragment key={escola.id}>
                          {mostraSeparador && (
                            <tr className="print-row-separator-black">
                              <td colSpan={7}>Produção Extra</td>
                            </tr>
                          )}
                          <tr>
                            <td className="print-col-escola">{escola.nome_curto}</td>
                            {DIAS_SEMANA.map((d) => (
                              <td key={d} className="print-col-dia">
                                {isCreche ? '—' : (escola.pf[d] > 0 ? escola.pf[d] : '—')}
                              </td>
                            ))}
                            <td className="print-col-total">{isCreche ? '—' : escola.total_pf.toLocaleString('pt-BR')}</td>
                          </tr>
                        </Fragment>
                      )
                    })}
                    <tr className="print-row-total">
                      <td className="print-col-escola">TOTAL GERAL (UNID.)</td>
                      {DIAS_SEMANA.map((d) => (<td key={d} className="print-col-dia">{romaneio.totais_pf[d] || '—'}</td>))}
                      <td className="print-col-total">{romaneio.total_pf.toLocaleString('pt-BR')}</td>
                    </tr>
                  </tbody>
                </table>
                {/* v9.8.2: Aviso da Semana removido da impressão */}
                <div className="print-footer">Sistema de Gestão da Padaria Escolar Municipal — Lucas do Rio Verde / MT</div>
              </div>
            )}

            {/* PCQ + Lanche Romaneio */}
            {/* v9.10.7: || extras_lanche_fora — rota que só tem lanche extra fora da
                semana também imprime a folha PCQ/Lanches do motorista */}
            {(romaneio.total_pcq > 0 || romaneio.total_lanche > 0 || (romaneio.extras_lanche_fora || []).length > 0) && (
              <div className="print-page-break">
                {/* Header */}
                <div className="print-doc-header">
                  <div className="print-doc-header-left">
                    <div className="print-doc-logo"><img src="/brasao.jpg" alt="Brasão" /></div>
                    <div className="print-doc-title-block">
                      <div className="print-doc-title">ROTA {romaneio.rota_label.toUpperCase()} — PCQ E LANCHES</div>
                      <div className="print-doc-subtitle">Padaria Escolar Municipal — Prefeitura de Lucas do Rio Verde / MT</div>
                      <div className="print-doc-subtitle">Entregas por dia da semana</div>
                    </div>
                  </div>
                  <div className="print-doc-header-right">
                    <div className="print-doc-gerado">GERADO EM</div>
                    <div className="print-doc-gerado-date">{geradoEm}</div>
                  </div>
                </div>

                {/* Info block */}
                <div className="print-info-block">
                  <div className="print-info-left">
                    <div className="print-info-semana">SEMANA {data.semana} / {data.ano}</div>
                    <div className="print-info-periodo">{formatarPeriodoSemana(inicioSemana(inicio), fimSemana(inicio))}</div>
                  </div>
                  <div className="print-info-right">
                    <div className="print-info-inline">
                      <span className="print-info-item"><span className="print-info-label">MOTORISTA:</span> {romaneio.rota_label}</span>
                      <span className="print-info-item print-info-divider"><span className="print-info-label">PÃO:</span> {data.nomePao}</span>
                      {lancheNome && <span className="print-info-item print-info-divider"><span className="print-info-label">LANCHE:</span> {lancheNome}</span>}
                    </div>
                  </div>
                </div>

                {romaneio.total_pcq > 0 && (
                  <>
                    <div className="print-section-header">
                      <span className="print-section-title-text">PCQ — PÃO DE CACHORRO QUENTE</span>
                      <span className="print-section-total">Total: {romaneio.total_pcq.toLocaleString('pt-BR')} formas</span>
                    </div>
                    <table className="print-table">
                      <thead><tr>
                        <th className="print-col-escola">ESCOLA / UNIDADE</th>
                        {DIAS_SEMANA.map((d) => (<th key={d} className="print-col-dia">{DIAS_LABEL_CURTO[d]}</th>))}
                        <th className="print-col-total">TOTAL</th>
                      </tr></thead>
                      <tbody>
                        {romaneio.escolas.filter((e) => e.total_pcq > 0).sort((a, b) => {
                          const oa = (a as any).ordem_pcq ?? 0
                          const ob = (b as any).ordem_pcq ?? 0
                          if (oa !== ob) return oa - ob
                          return (a.nome_curto || '').localeCompare(b.nome_curto || '')
                        }).map((escola, idx, arr) => {
                          // v9.8.4/v9.8.5: escolas com PF Complemento mostram
                          // "PCQ + PF XX" nos dias com PCQ (seg/qua/sex).
                          // v9.10.9: para TODAS as unidades com pcq + complemento
                          // cadastrados (antes: só creches e bifásicas — a API
                          // agora separa o pf_comp de qualquer categoria).
                          // Demais dias: "—" como sempre.
                          // v9.10.5: separador antes do primeiro extra (categoria EXTRA)
                          const mostraSeparador = escola.categoria === 'EXTRA' && (idx === 0 || arr[idx - 1].categoria !== 'EXTRA')
                          return (
                            <Fragment key={escola.id}>
                              {mostraSeparador && (
                                <tr className="print-row-separator-black">
                                  <td colSpan={7}>Produção Extra</td>
                                </tr>
                              )}
                              <tr>
                                <td className="print-col-escola">{escola.nome_curto}</td>
                                {DIAS_SEMANA.map((d) => {
                                  if (escola.pcq[d] > 0) {
                                    if ((escola as any).pf_comp?.[d] > 0) {
                                      // Escola com PCQ + PF Complemento: "40 + PF 25"
                                      // (v9.10.9: qualquer categoria, não só creche)
                                      return (
                                        <td key={d} className="print-col-dia">
                                          {escola.pcq[d]} + PF {(escola as any).pf_comp[d]}
                                        </td>
                                      )
                                    }
                                    return <td key={d} className="print-col-dia">{escola.pcq[d]}</td>
                                  }
                                  return <td key={d} className="print-col-dia">—</td>
                                })}
                                <td className="print-col-total">{escola.total_pcq.toLocaleString('pt-BR')}</td>
                              </tr>
                            </Fragment>
                          )
                        })}
                        <tr className="print-row-subtotal">
                          <td className="print-col-escola">TOTAL GERAL (FORMAS)</td>
                          {DIAS_SEMANA.map((d) => {
                            const totalPfCompDia = (romaneio as any).totais_pf_comp?.[d] || 0
                            if (romaneio.totais_pcq[d] > 0 && totalPfCompDia > 0) {
                              // v9.8.4: total do dia mostra "PCQ + PF XX" para indicar
                              // que o motorista leva PCQ + PF agrupado das escolas
                              // com complemento (v9.10.9: qualquer categoria)
                              return (
                                <td key={d} className="print-col-dia">
                                  {romaneio.totais_pcq[d]} + PF {totalPfCompDia}
                                </td>
                              )
                            }
                            return <td key={d} className="print-col-dia">{romaneio.totais_pcq[d] || '—'}</td>
                          })}
                          <td className="print-col-total">{romaneio.total_pcq.toLocaleString('pt-BR')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                )}

                {romaneio.total_lanche > 0 && (
                  <>
                    <div className="print-section-header print-section-spacer">
                      <span className="print-section-title-text">{lancheNome.toUpperCase()} — ENTREGAS POR DIA</span>
                      <span className="print-section-total">Total: {romaneio.total_lanche.toLocaleString('pt-BR')}</span>
                    </div>
                    <table className="print-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                      <thead><tr>
                        <th style={{ width: '65%', textAlign: 'left', padding: '1mm 1.5mm', fontSize: '9pt', textTransform: 'uppercase', borderBottom: '1.5pt solid #000' }}>DIA / ESCOLA</th>
                        <th style={{ width: '35%', textAlign: 'center', padding: '1mm 1.5mm', fontSize: '9pt', textTransform: 'uppercase', borderBottom: '1.5pt solid #000' }}>QUANTIDADE</th>
                      </tr></thead>
                      <tbody>
                        {DIAS_SEMANA.filter(d => romaneio.totais_lanche[d] > 0).map((d) => (
                          // v9.7.6: bugfix React key — <> não aceita key, trocado por Fragment
                          <Fragment key={d}>
                            <tr style={{ borderTop: '1.5pt solid #000' }}>
                              <td style={{ fontWeight: '800', fontSize: '10.5pt', textTransform: 'uppercase', padding: '1.5mm 1.5mm', borderBottom: '0.5pt solid #000', letterSpacing: '0.3pt' }}>
                                ■ {DIAS_LABEL_CURTO[d].toUpperCase()}
                              </td>
                              <td style={{ fontWeight: '800', fontSize: '10.5pt', textAlign: 'center', padding: '1.5mm 1.5mm', borderBottom: '0.5pt solid #000' }}>
                                {romaneio.totais_lanche[d]} unid.
                              </td>
                            </tr>
                            {romaneio.escolas.filter((e) => e.lanche[d] > 0 && !e.extra_lanche).map((escola) => (
                              <tr key={`${d}-${escola.id}`}>
                                <td style={{ padding: '0.8mm 1.5mm 0.8mm 6mm', fontSize: '10.5pt' }}>
                                  {escola.nome_curto}
                                  {/* v9.10.6: lanche fora da semana — anota a preparação
                                      ao lado da instituição (info mínima, mesma linha).
                                      v9.10.7: linhas com extra_lanche saíram daqui — ficam
                                      no bloco "PREPARAÇÃO EXTRA" logo abaixo; a anotação
                                      fica como fallback defensivo. */}
                                  {escola.extra_lanche && (
                                    <span style={{ fontSize: '8pt', color: '#777' }}> · {escola.extra_lanche}</span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'center', padding: '0.8mm 1.5mm', fontSize: '10.5pt' }}>{escola.lanche[d]}</td>
                              </tr>
                            ))}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {/* v9.10.7: blocos "separadinhos" dos lanches extras FORA da semana —
                    MESMA folha do motorista (mesma página), mesmo padrão da folha
                    de produção de Lanches (v9.10.6): preparação, instituição, dia e
                    quantidade, com total próprio FORA dos totais do lanche da semana. */}
                {(romaneio.extras_lanche_fora || []).length > 0 && agruparExtrasLancheFora(romaneio).map((g) => {
                  const totalGrupo = g.extras.reduce((s, x) => s + (x.quantidade || 0), 0)
                  return (
                    <Fragment key={g.lanche}>
                      <div className="print-section-header print-section-spacer" style={{ paddingTop: '1.5mm' }}>
                        <span className="print-section-title-text" style={{ fontSize: '9.5pt' }}>
                          PREPARAÇÃO EXTRA — {g.lanche.toUpperCase()}
                        </span>
                        <span className="print-section-total">Total: {totalGrupo.toLocaleString('pt-BR')} unid.</span>
                      </div>
                      <table className="print-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '65%', textAlign: 'left', padding: '1mm 1.5mm', fontSize: '9pt', textTransform: 'uppercase', borderBottom: '1.5pt solid #000' }}>DIA / INSTITUIÇÃO</th>
                            <th style={{ width: '35%', textAlign: 'center', padding: '1mm 1.5mm', fontSize: '9pt', textTransform: 'uppercase', borderBottom: '1.5pt solid #000' }}>QUANTIDADE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.extras.map((x) => (
                            <tr key={x.id}>
                              <td style={{ padding: '0.8mm 1.5mm 0.8mm 6mm', fontSize: '10pt' }}>
                                {DIAS_LABEL_CURTO[x.dia_semana]} · {x.nome_curto}
                              </td>
                              <td style={{ textAlign: 'center', padding: '0.8mm 1.5mm', fontSize: '10pt' }}>{x.quantidade}</td>
                            </tr>
                          ))}
                          <tr style={{ borderTop: '1pt solid #000' }}>
                            <td style={{ fontWeight: 700, fontSize: '9.5pt', padding: '1mm 1.5mm' }}>TOTAL EXTRA</td>
                            <td style={{ fontWeight: 700, fontSize: '9.5pt', textAlign: 'center', padding: '1mm 1.5mm' }}>{totalGrupo.toLocaleString('pt-BR')}</td>
                          </tr>
                        </tbody>
                      </table>
                    </Fragment>
                  )
                })}

                {/* v9.8.2: Aviso da Semana removido da impressão */}
                <div className="print-footer">Sistema de Gestão da Padaria Escolar Municipal — Lucas do Rio Verde / MT</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ===== TELA — Cabeçalho ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print-hidden">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3A5C]">Produção</h1>
          <p className="text-sm text-muted-foreground">
            Planejamento semanal · <Badge variant="secondary" className="text-[10px]">{data.nomePao}</Badge>
            {data.lancheRegular && <span className="ml-2 text-xs">Lanche: {data.lancheRegular}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SeletorSemana />
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            <Button size="sm" variant={viewMode === 'dia' ? 'default' : 'ghost'}
              onClick={() => setViewMode('dia')}
              className={`h-7 text-xs ${viewMode === 'dia' ? 'bg-[#1A3A5C] text-white' : ''}`}>
              <Calendar className="w-3 h-3 mr-1" /> Por Dia
            </Button>
            <Button size="sm" variant={viewMode === 'semana' ? 'default' : 'ghost'}
              onClick={() => setViewMode('semana')}
              className={`h-7 text-xs ${viewMode === 'semana' ? 'bg-[#1A3A5C] text-white' : ''}`}>
              <Table2 className="w-3 h-3 mr-1" /> Semanal
            </Button>
          </div>
          {/* v9.10.9: botão "Romaneio →" removido — a página /romaneio foi inativada;
              o romaneio do motorista sai na impressão da Produção (botão Imprimir) */}
          <Button variant="outline" size="sm" onClick={() => window.print()} className="border-amber-200">
            <Printer className="w-4 h-4 mr-1" /> Imprimir
          </Button>
          {/* v9.5: Botão adicionar instituição extra */}
          <Button variant="outline" size="sm" onClick={() => setExtraDialogOpen(true)} className="border-blue-200 text-blue-700 hover:bg-blue-50">
            <Plus className="w-4 h-4 mr-1" /> Inst. Extra
          </Button>
        </div>
      </div>

      {/* v9.7.5: Aviso da semana (vem do cardápio semestral) + alerta de feriados */}
      {/* v9.9.0: o banner agora também aparece quando NÃO há aviso (desde que a
          semana tenha cardápio cadastrado), com placeholder "Nenhum aviso" e
          botão para ADICIONAR direto daqui — antes o botão de edição só existia
          quando o aviso já tinha sido criado em /cardapio. */}
      {(data.cardapio_id || data.obs || (data.feriados_semana && data.feriados_semana.length > 0)) && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 print:hidden">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-2">
              {/* v9.9.0: placeholder quando não há aviso nem feriado na semana */}
              {!data.obs && !(data.feriados_semana && data.feriados_semana.length > 0) && (
                <div>
                  <p className="text-sm font-semibold text-amber-800">Aviso da Semana {data.semana}</p>
                  <p className="text-sm text-amber-600/80 italic">Nenhum aviso cadastrado para esta semana.</p>
                </div>
              )}
              {data.obs && (
                <div>
                  <p className="text-sm font-semibold text-amber-800">Aviso da Semana {data.semana}</p>
                  {/* v9.10.13: quadro de tarefas — linhas "[ ]" viram checklist clicável
                      (marca como feita e salva na hora); texto comum mantém as quebras */}
                  <AvisoConteudo
                    obs={data.obs}
                    onAlternarTarefa={alternarTarefaAviso}
                    className="text-sm text-amber-700 mt-0.5"
                  />
                </div>
              )}
              {/* v9.7.5: Alerta de feriados da semana */}
              {data.feriados_semana && data.feriados_semana.length > 0 && (
                <div className="border-t border-amber-200 pt-2">
                  <p className="text-xs font-semibold text-red-700 flex items-center gap-1 mb-1">
                    <CalendarOff className="w-3.5 h-3.5" />
                    {data.feriados_semana.length === 1
                      ? 'Feriado na semana:'
                      : `${data.feriados_semana.length} feriados na semana:`}
                  </p>
                  <ul className="text-xs text-red-700 space-y-0.5">
                    {data.feriados_semana.map((f, idx) => (
                      <li key={`${f.data}-${idx}`} className="flex items-start gap-1.5">
                        <span className="font-mono text-red-800">
                          {new Date(f.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </span>
                        <span className="font-medium">{f.nome}</span>
                        <span className="text-red-500/70">
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
              )}
            </div>
            {/* v9.7.5: botão editar aviso da semana */}
            {/* v9.9.0: título dinâmico — "Adicionar" quando não há aviso ainda */}
            <Button
              size="sm"
              variant="ghost"
              className="text-amber-700 hover:bg-amber-100 hover:text-amber-900 h-8"
              onClick={abrirEdicaoAviso}
              title={data.obs ? 'Editar aviso da semana' : 'Adicionar aviso da semana'}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ===== TELA — Por Dia ===== */}
      {viewMode === 'dia' && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="print-hidden">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-amber-50/50 p-1">
            {diasComExtra.map((dia) => (
              <TabsTrigger key={dia.data} value={dia.data}
                className="data-[state=active]:bg-[#1A3A5C] data-[state=active]:text-white text-xs px-3 py-1.5">
                <span>{dia.dia_curto}</span>
                <span className="ml-1 text-[10px] opacity-60">{formatarData(dia.data).split('/')[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {diasComExtra.map((dia) => (
            <TabsContent key={dia.data} value={dia.data}>
              {/* v9.10.12: passa as escolas com PCQ habilitado p/ linhas excepcionais */}
              <DiaProducaoCard dia={dia} onAjuste={openAjuste} escolasPcqHabilitadas={data?.escolas_pcq || []} />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* ===== TELA — Semanal ===== */}
      {viewMode === 'semana' && (
        <div className="space-y-4 print-hidden">
          {/* PF */}
          <Card className="border-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                <Wheat className="w-4 h-4" /> Pão Francês
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-amber-100">
                      <th className="text-left p-2 text-xs font-medium text-muted-foreground">Escola</th>
                      {DIAS_PRODUCAO.map((d) => (
                        <th key={d} className="text-center p-2 text-xs font-medium text-muted-foreground">{DIAS_LABEL_CURTO_PRODUCAO[d]}</th>
                      ))}
                      <th className="text-right p-2 text-xs font-medium text-muted-foreground bg-amber-50">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escolasPF.map((escola) => (
                      <tr key={escola.id} className="border-b border-muted/30 hover:bg-muted/20">
                        <td className="p-2 font-medium text-sm">{escola.nome_curto}</td>
                        {DIAS_PRODUCAO.map((d) => {
                          const diaValido = ehDiaProducaoDoProduto(d, 'PF')
                          const ajuste = getAjusteInfo(escola.id, d, 'PF')
                          // v9.10.6: extras (Inst. Extra) não são escolas — célula
                          // sem cursor de clique (ajuste daria P2003 no /api/ajustes)
                          const ehExtra = escola.categoria === 'EXTRA'
                          // v9.7.5: sexta não é dia de produção de PF — célula neutra e não-clicável
                          if (!diaValido) {
                            return (
                              <td key={d} className="p-2 text-center font-mono text-sm text-muted-foreground/30 bg-muted/10">
                                —
                              </td>
                            )
                          }
                          return (
                          <td key={d} className={`p-2 text-center font-mono text-sm ${ehExtra ? '' : 'cursor-pointer hover:bg-amber-50 rounded'} ${ajuste ? 'bg-amber-100 text-amber-700 font-semibold' : ''}`}
                            title={ehExtra
                              ? 'Produção extra — edite pelo botão "Inst. Extra"'
                              : ajuste ? `Original: ${ajuste.qtd_original} | Motivo: ${ajuste.motivo}` : 'Clique para ajustar'}
                            onClick={() => openAjusteFromWeekly(escola.id, escola.nome, d, 'PF', escola.pf[d])}>
                            {escola.pf[d] > 0 ? escola.pf[d] : ''}
                            {ajuste && <span className="ml-0.5 text-[8px] text-amber-600">●</span>}
                          </td>
                          )
                        })}
                        <td className="p-2 text-right font-mono font-semibold bg-amber-50 text-sm">{escola.total_pf.toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-amber-200 bg-amber-50/50">
                      <td className="p-2 font-bold text-amber-900">Total PF</td>
                      {DIAS_PRODUCAO.map((d) => (
                        <td key={d} className="p-2 text-center font-bold font-mono text-amber-900">{consolidado.totais_por_dia.pf[d] || ''}</td>
                      ))}
                      <td className="p-2 text-right font-bold font-mono text-amber-900 bg-amber-100">{consolidado.total_pf.toLocaleString('pt-BR')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* PCQ */}
          <Card className="border-orange-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-orange-900 flex items-center gap-2">
                <Package className="w-4 h-4" /> Pão de Cachorro Quente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-orange-100">
                      <th className="text-left p-2 text-xs font-medium text-muted-foreground">Escola</th>
                      {DIAS_PRODUCAO.map((d) => (
                        <th key={d} className="text-center p-2 text-xs font-medium text-muted-foreground">{DIAS_LABEL_CURTO_PRODUCAO[d]}</th>
                      ))}
                      <th className="text-right p-2 text-xs font-medium text-muted-foreground bg-orange-50">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* v9.9.1: unidades Busca Própria mostram a conversão em pães —
                        "1 (50)" = 1 forma = 50 pães de cachorro quente */}
                    {escolasPCQ.map((escola) => {
                      const bp = ehBuscaPropria(escola)
                      return (
                      <tr key={escola.id} className="border-b border-muted/30 hover:bg-muted/20">
                        <td className="p-2 font-medium text-sm">{escola.nome_curto}</td>
                        {DIAS_PRODUCAO.map((d) => {
                          const diaValido = ehDiaProducaoDoProduto(d, 'PCQ')
                          const ajuste = getAjusteInfo(escola.id, d, 'PCQ')
                          // v9.10.4: ter/qui são dias "extras" — só têm produção de PCQ
                          // via ajuste manual (situação excepcional); célula vazia mostra
                          // "+" para indicar que é clicável.
                          const ehDiaExtra = d === 'terca' || d === 'quinta'
                          // v9.10.6: extras (Inst. Extra) não são escolas — célula
                          // sem cursor de clique (ajuste daria P2003 no /api/ajustes)
                          const ehExtra = escola.categoria === 'EXTRA'
                          // v9.7.5/v9.10.4: domingo continua neutro (não existe PCQ no domingo)
                          if (!diaValido) {
                            return (
                              <td key={d} className="p-2 text-center font-mono text-sm text-muted-foreground/30 bg-muted/10">
                                —
                              </td>
                            )
                          }
                          return (
                          <td key={d} className={`p-2 text-center font-mono text-sm ${ehExtra ? '' : 'cursor-pointer hover:bg-orange-50 rounded'} ${ajuste ? 'bg-amber-100 text-amber-700 font-semibold' : ''}`}
                            title={ehExtra
                              ? 'Produção extra — edite pelo botão "Inst. Extra"'
                              : ajuste
                              ? `Original: ${ajuste.qtd_original} | Motivo: ${ajuste.motivo}`
                              : (ehDiaExtra && !escola.pcq[d] ? 'Clique para adicionar produção excepcional de PCQ neste dia' : 'Clique para ajustar')}
                            onClick={() => openAjusteFromWeekly(escola.id, escola.nome, d, 'PCQ', escola.pcq[d])}>
                            {escola.pcq[d] > 0 ? (
                              <>
                                {formatarFormas(escola.pcq[d])}
                                {bp && <span className="ml-0.5 text-[10px] text-muted-foreground font-normal">{legendaPcqPaes(escola.pcq[d])}</span>}
                              </>
                            ) : (ehDiaExtra ? <span className="text-muted-foreground/30">+</span> : '')}
                            {ajuste && <span className="ml-0.5 text-[8px] text-amber-600">●</span>}
                          </td>
                          )
                        })}
                        <td className="p-2 text-right font-mono font-semibold bg-orange-50 text-sm">
                          {escola.total_pcq.toLocaleString('pt-BR')}
                          {bp && escola.total_pcq > 0 && <span className="ml-0.5 text-[10px] text-muted-foreground font-normal">{legendaPcqPaes(escola.total_pcq)}</span>}
                        </td>
                      </tr>
                      )
                    })}
                    <tr className="border-t-2 border-orange-200 bg-orange-50/50">
                      <td className="p-2 font-bold text-orange-900">Total PCQ</td>
                      {DIAS_PRODUCAO.map((d) => (
                        // v9.9.2: total do dia formatado em pt-BR — antes exibia o número
                        // cru (ex.: "50.20000000000001") por resíduo de ponto flutuante
                        <td key={d} className="p-2 text-center font-bold font-mono text-orange-900">{consolidado.totais_por_dia.pcq[d] > 0 ? formatarFormas(consolidado.totais_por_dia.pcq[d]) : ''}</td>
                      ))}
                      <td className="p-2 text-right font-bold font-mono text-orange-900 bg-orange-100">{consolidado.total_pcq.toLocaleString('pt-BR')}</td>
                    </tr>
                  </tbody>
                </table>
                {/* v9.9.1: nota de legenda discreta — só quando há Busca Própria com PCQ */}
                {temBuscaPropriaPCQ && (
                  <p className="px-2 pb-2 text-[10px] text-muted-foreground">
                    (N) = pães de cachorro quente · 1 forma = {FORMA_PCQ_PAES} pães · unidades Busca Própria
                  </p>
                )}
                {/* v9.10.4: dica de produção excepcional — PCQ em ter/qui via ajuste */}
                <p className="px-2 pb-2 text-[10px] text-muted-foreground/70">
                  Situação excepcional? Clique em Ter ou Qui para adicionar produção de PCQ nesse dia (fica registrada como ajuste da semana, com motivo).
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Lanche */}
          <Card className="border-pink-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-pink-900 flex items-center gap-2">
                <Cookie className="w-4 h-4" /> Lanche
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-pink-100">
                      <th className="text-left p-2 text-xs font-medium text-muted-foreground">Escola</th>
                      {DIAS_PRODUCAO.map((d) => (
                        <th key={d} className="text-center p-2 text-xs font-medium text-muted-foreground">{DIAS_LABEL_CURTO_PRODUCAO[d]}</th>
                      ))}
                      <th className="text-right p-2 text-xs font-medium text-muted-foreground bg-pink-50">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escolasLanche.map((escola) => (
                      <tr key={escola.id} className="border-b border-muted/30 hover:bg-muted/20">
                        <td className="p-2 font-medium text-sm">{escola.nome_curto}</td>
                        {DIAS_PRODUCAO.map((d) => {
                          const diaValido = ehDiaProducaoDoProduto(d, 'LANCHE')
                          const ajuste = getAjusteInfo(escola.id, d, 'LANCHE')
                          // v9.10.6: extras (Inst. Extra) não são escolas — célula
                          // sem cursor de clique (ajuste daria P2003 no /api/ajustes)
                          const ehExtra = escola.categoria === 'EXTRA'
                          // v9.7.5: lanche só é produzido seg-sex (não no domingo)
                          if (!diaValido) {
                            return (
                              <td key={d} className="p-2 text-center font-mono text-sm text-muted-foreground/30 bg-muted/10">
                                —
                              </td>
                            )
                          }
                          return (
                          <td key={d} className={`p-2 text-center font-mono text-sm ${ehExtra ? '' : 'cursor-pointer hover:bg-pink-50 rounded'} ${ajuste ? 'bg-amber-100 text-amber-700 font-semibold' : ''}`}
                            title={ehExtra
                              ? 'Produção extra — edite pelo botão "Inst. Extra"'
                              : ajuste ? `Original: ${ajuste.qtd_original} | Motivo: ${ajuste.motivo}` : 'Clique para ajustar'}
                            onClick={() => openAjusteFromWeekly(escola.id, escola.nome, d, 'LANCHE', escola.lanche[d])}>
                            {escola.lanche[d] > 0 ? escola.lanche[d] : ''}
                            {ajuste && <span className="ml-0.5 text-[8px] text-amber-600">●</span>}
                          </td>
                          )
                        })}
                        <td className="p-2 text-right font-mono font-semibold bg-pink-50 text-sm">{escola.total_lanche.toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-pink-200 bg-pink-50/50">
                      <td className="p-2 font-bold text-pink-900">Total Lanche</td>
                      {DIAS_PRODUCAO.map((d) => (
                        <td key={d} className="p-2 text-center font-bold font-mono text-pink-900">{consolidado.totais_por_dia.lanche[d] || ''}</td>
                      ))}
                      <td className="p-2 text-right font-bold font-mono text-pink-900 bg-pink-100">{consolidado.total_lanche.toLocaleString('pt-BR')}</td>
                    </tr>
                  </tbody>
                </table>
                {/* v9.10.6: extras de lanche FORA da semana não entram nesta tabela
                    (são outra preparação) — aparecem separados na impressão de
                    Lanches e na lista "Produções Extras" */}
                {extrasLancheDiferente.length > 0 && (
                  <p className="px-2 pb-2 text-[10px] text-muted-foreground/70">
                    {extrasLancheDiferente.length === 1
                      ? '1 extra com preparação diferente do lanche da semana'
                      : `${extrasLancheDiferente.length} extras com preparação diferente do lanche da semana`}
                    {' '}— veja na lista "Produções Extras" (na impressão, aparecem separados na folha de Lanches).
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <AjusteDialog open={ajusteOpen} onOpenChange={setAjusteOpen}
        escolaId={ajusteTarget.escolaId} escolaNome={ajusteTarget.escolaNome}
        diaSemana={ajusteTarget.diaSemana} produto={ajusteTarget.produto}
        quantidadeOriginal={ajusteTarget.quantidadeOriginal}
        ano={data.ano} semana={data.semana} onSaved={loadData} />

      {/* v9.5: Lista de produções extras */}
      {producaoExtra.length > 0 && (
        <Card className="border-blue-200 print-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-blue-700 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Produções Extras ({producaoExtra.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {producaoExtra.map((extra) => (
                <div key={extra.id} className="flex items-center gap-3 p-2 bg-blue-50/50 rounded border border-blue-100 text-sm">
                  {/* v9.10.6: lanche escolhido aparece no badge; fora da semana ganha selo âmbar */}
                  <Badge variant="outline" className="text-[9px]">
                    {extra.lanche_nome ? `Lanche: ${extra.lanche_nome}` : extra.produto}
                  </Badge>
                  {extra.produto === 'LANCHE' && extraEhLancheDiferente(extra.lanche_nome) && (
                    <Badge
                      variant="outline"
                      className="text-[9px] border-amber-300 text-amber-700 bg-amber-50"
                      title="Preparação diferente do lanche da semana — aparece separada na folha de produção de Lanches"
                    >
                      Fora da semana
                    </Badge>
                  )}
                  <span className="font-medium flex-1 truncate">{extra.nome_instituicao}</span>
                  <span className="text-xs text-muted-foreground capitalize">{extra.dia_semana}</span>
                  {/* v9.10.5: motorista responsável pela entrega — registros antigos
                      (sem motorista) ficam em destaque âmbar e NÃO aparecem no romaneio */}
                  {extra.motorista ? (
                    <Badge variant="outline" className="text-[9px] bg-white">
                      {extra.motorista === 'JOSE' ? 'Motorista José' : extra.motorista === 'AROLDO' ? 'Motorista Aroldo' : 'Busca Própria'}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[9px] border-amber-300 text-amber-700 bg-amber-50"
                      title="Registro antigo sem motorista — não aparece no romaneio. Remova e cadastre de novo para escolher."
                    >
                      Sem motorista
                    </Badge>
                  )}
                  <span className="font-mono font-semibold">{extra.quantidade}</span>
                  <Button size="sm" variant="ghost" className="h-6 text-red-400 hover:text-red-600" onClick={() => handleDeleteExtra(extra.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* v9.5: Dialog adicionar produção extra */}
      <Dialog open={extraDialogOpen} onOpenChange={setExtraDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1A3A5C]">Adicionar Produção Extra</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome da Instituição</Label>
              <Input
                value={extraForm.nome_instituicao}
                onChange={(e) => setExtraForm({ ...extraForm, nome_instituicao: e.target.value })}
                placeholder="Ex: Secretaria de Educação"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Produto (pão ou lanche)</Label>
                <Select value={extraForm.produto} onValueChange={(v) => setExtraForm({ ...extraForm, produto: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PF">Pão Francês</SelectItem>
                    <SelectItem value="PCQ">Pão de Cachorro Quente</SelectItem>
                    {/* v9.10.6: lanches cadastrados (página Lanches) — cada um é uma
                        preparação própria; 'lanche:<nome>' identifica a escolha */}
                    {lanchesCadastrados.length > 0 ? (
                      lanchesCadastrados.map((l) => (
                        <SelectItem key={l.id} value={`lanche:${l.nome}`}>{l.nome}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="_sem_lanche" disabled>
                        Nenhum lanche cadastrado
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Dia de Entrega</Label>
                <Select value={extraForm.dia_semana} onValueChange={(v) => setExtraForm({ ...extraForm, dia_semana: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="segunda">Segunda</SelectItem>
                    <SelectItem value="terca">Terça</SelectItem>
                    <SelectItem value="quarta">Quarta</SelectItem>
                    <SelectItem value="quinta">Quinta</SelectItem>
                    <SelectItem value="sexta">Sexta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Motorista</Label>
                <Select value={extraForm.motorista} onValueChange={(v) => setExtraForm({ ...extraForm, motorista: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="JOSE">Motorista José</SelectItem>
                    <SelectItem value="AROLDO">Motorista Aroldo</SelectItem>
                    <SelectItem value="BUSCA_PROPRIA">Busca Própria (retira)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Quantidade</Label>
                {/* v9.10.12: input decimal (vírgula ou ponto) — aceita "0,5" no PCQ */}
                <Input
                  type="text"
                  inputMode="decimal"
                  value={extraQtdTexto}
                  onChange={(e) => setExtraQtdTexto(e.target.value)}
                  placeholder="Ex: 100 ou 0,5"
                />
              </div>
            </div>
            {/* v9.10.5: dica do papel do motorista no extra */}
            <p className="text-[10px] text-muted-foreground -mt-1">
              O extra entra no romaneio do motorista escolhido, no dia de entrega selecionado.
            </p>
            {/* v9.10.6: aviso quando o lanche escolhido é diferente da semana */}
            {extraForm.produto.startsWith('lanche:') && extraEhLancheDiferente(extraForm.produto.slice('lanche:'.length)) && (
              <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 -mt-1">
                Lanche diferente da semana — vai aparecer <strong>separadinho</strong> na folha de produção de Lanches.
              </p>
            )}
            <div>
              <Label className="text-xs">Observação (opcional)</Label>
              <Input
                value={extraForm.observacao}
                onChange={(e) => setExtraForm({ ...extraForm, observacao: e.target.value })}
                placeholder="Ex: Reunião na quarta"
              />
            </div>
            <Button onClick={handleSaveExtra} className="w-full bg-[#1A3A5C] hover:bg-[#1A3A5C]/90">
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* v9.7.5: Dialog editar aviso da semana (obs do cardápio) */}
      <Dialog open={avisoDialogOpen} onOpenChange={setAvisoDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#1A3A5C]">Aviso da Semana {data?.semana}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-700">
                Este aviso aparece como banner no <strong>Dashboard</strong> e na <strong>Produção</strong> apenas
                nesta semana (match exato da semana ISO). Deixe vazio para remover o banner.
              </p>
            </div>
            <div>
              <Label className="text-xs">Mensagem do aviso</Label>
              <textarea
                className="w-full min-h-[120px] p-2 text-sm rounded-md border border-input bg-background resize-y focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
                placeholder={'Ex: Semana com feriado na quinta — produção reduzida.\n[ ] Separar formas da creche na quinta\n[ ] Levar balança para a calibração'}
                value={avisoEditando}
                onChange={(e) => setAvisoEditando(e.target.value)}
                autoFocus
              />
              {/* v9.10.13: dica de checklist + conversão em 1 clique — cada linha
                  não-vazia ganha o prefixo "[ ] " e vira tarefa marcável no banner */}
              <div className="flex items-start justify-between gap-2 mt-1.5">
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Dica: comece uma linha com{' '}
                  <code className="font-mono bg-muted px-1 rounded">[ ]</code>{' '}
                  para criar uma tarefa — a equipe marca como feita direto no banner (fica riscada).
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 text-xs"
                  disabled={!avisoEditando.trim() || avisoSalvando}
                  onClick={() => setAvisoEditando(converterLinhasEmTarefas(avisoEditando))}
                  title="Prefixa cada linha com [ ] para virar tarefa marcável"
                >
                  <ListChecks className="w-3.5 h-3.5 mr-1" />
                  Virar tarefas
                </Button>
              </div>
            </div>
            {/* v9.7.5: mostrar feriados da semana como informação para o usuário */}
            {data?.feriados_semana && data.feriados_semana.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                <p className="text-xs font-semibold text-red-700 mb-1">Feriados nesta semana:</p>
                <ul className="text-xs text-red-700 space-y-0.5">
                  {data.feriados_semana.map((f, idx) => (
                    <li key={`prev-${f.data}-${idx}`}>
                      <span className="font-mono">
                        {new Date(f.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </span>
                      {' — '}
                      <span className="font-medium">{f.nome}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                onClick={handleSaveAviso}
                disabled={avisoSalvando}
                className="flex-1 bg-[#1A3A5C] hover:bg-[#1A3A5C]/90"
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                {avisoSalvando ? 'Salvando...' : 'Salvar Aviso'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setAvisoDialogOpen(false)}
                disabled={avisoSalvando}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DiaProducaoCard({ dia, onAjuste, escolasPcqHabilitadas }: { dia: ProducaoDia; onAjuste: (item: ItemProducao) => void; escolasPcqHabilitadas: EscolaPcqHabilitada[] }) {
  const temProducao = (dia.total_pf + dia.total_pcq + dia.total_lanche) > 0
  // v9.10.12: PCQ do dia com linhas excepcionais — escolas habilitadas
  // (recebe_pcq + config) sem item no dia (ter/qui sem ajuste) aparecem com
  // quantidade "—" para permitir criar produção excepcional com um clique.
  // Em seg/qua/sex a API já traz todas as elegíveis → nenhuma linha extra.
  const itensPcqDia = mesclarItensPcqExcepcionais(dia.itens_pcq, escolasPcqHabilitadas, dia.dia_key)
  const temFantasmaPcq = itensPcqDia.some((i) => i.excepcional === true)

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 bg-gradient-to-r from-[#1A3A5C] to-[#2C5282] text-white px-4 py-2 rounded-lg shadow-md">
          <span className="font-bold">{dia.dia_label}</span>
          <span className="text-sm text-blue-200">{formatarData(dia.data)}</span>
        </div>
        {temProducao ? (
          <div className="flex items-center gap-3">
            {dia.total_pf > 0 && <Badge className="bg-amber-100 text-amber-800"><Wheat className="w-3 h-3 mr-1" /> {dia.total_pf.toLocaleString('pt-BR')} PF</Badge>}
            {dia.total_pcq > 0 && <Badge className="bg-orange-100 text-orange-800"><Package className="w-3 h-3 mr-1" /> {dia.total_pcq.toLocaleString('pt-BR')} PCQ</Badge>}
            {dia.total_lanche > 0 && <Badge className="bg-pink-100 text-pink-800"><Cookie className="w-3 h-3 mr-1" /> {dia.total_lanche.toLocaleString('pt-BR')} Lanche</Badge>}
          </div>
        ) : <Badge variant="secondary">Sem produção</Badge>}
      </div>

      {/* PF */}
      {dia.itens_pf.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-amber-900 flex items-center gap-2"><Wheat className="w-4 h-4" /> Pão Francês</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-amber-100">
                <th className="text-left p-2 text-xs font-medium text-muted-foreground">Escola</th>
                <th className="text-center p-2 text-xs font-medium text-muted-foreground">Entrega</th>
                <th className="text-right p-2 text-xs font-medium text-muted-foreground">Qtd</th>
                <th className="text-center p-2 text-xs font-medium text-muted-foreground">Status</th>
                <th className="p-2"></th>
              </tr></thead>
              <tbody>
                {dia.itens_pf.map((item) => (<ItemRow key={`${item.escola_id}_${item.dia_entrega}`} item={item} onAjuste={onAjuste} />))}
                <tr className="border-t-2 border-amber-200 bg-amber-50/50">
                  <td colSpan={2} className="p-2 font-bold text-amber-900">Total PF</td>
                  <td className="p-2 text-right font-bold text-amber-900">{dia.total_pf.toLocaleString('pt-BR')}</td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* PCQ */}
      {itensPcqDia.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-orange-900 flex items-center gap-2"><Package className="w-4 h-4" /> Pão de Cachorro Quente</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-orange-100">
                <th className="text-left p-2 text-xs font-medium text-muted-foreground">Escola</th>
                <th className="text-right p-2 text-xs font-medium text-muted-foreground">Formas</th>
                <th className="text-center p-2 text-xs font-medium text-muted-foreground">Status</th>
                <th className="p-2"></th>
              </tr></thead>
              <tbody>
                {/* v9.9.1: unidades Busca Própria mostram a conversão em pães —
                    "1 (60)" = 1 forma = 60 pães de cachorro quente
                    v9.10.12: lista mesclada com linhas excepcionais (escolas
                    habilitadas sem produção no dia, quantidade "—") */}
                {itensPcqDia.map((item) => {
                  const bp = ehBuscaPropria(item)
                  return (
                  <tr key={item.escola_id} className={`border-b border-muted/30 hover:bg-muted/20 cursor-pointer ${item.excepcional ? 'opacity-70' : ''}`} onClick={() => onAjuste(item)}>
                    <td className="p-2 font-medium">{item.escola_curto}</td>
                    <td className="p-2 text-right font-mono">
                      {item.zerado ? (
                        <span className="line-through text-red-400">{item.quantidade}</span>
                      ) : item.excepcional ? (
                        // v9.10.12: linha excepcional — nada programado no dia
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <>
                          <span className={item.ajustado ? 'text-amber-600 font-semibold' : ''}>{item.quantidade.toLocaleString('pt-BR')}</span>
                          {bp && item.quantidade > 0 && (
                            <span className="ml-1 text-[10px] text-muted-foreground font-normal">{legendaPcqPaes(item.quantidade)}</span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      {item.zerado && <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="w-3 h-3 mr-0.5" /> Feriado</Badge>}
                      {item.ajustado && !item.zerado && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Ajustado</Badge>}
                      {/* v9.10.12: marca a linha excepcional (produção fora do padrão) */}
                      {item.excepcional && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-dashed" title="Escola com PCQ habilitado sem produção neste dia — clique em Ajustar para programar produção excepcional">
                          Excepcional
                        </Badge>
                      )}
                    </td>
                    <td className="p-2"><Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground">Ajustar</Button></td>
                  </tr>
                  )
                })}
                <tr className="border-t-2 border-orange-200 bg-orange-50/50">
                  <td className="p-2 font-bold text-orange-900">Total PCQ</td>
                  <td className="p-2 text-right font-bold text-orange-900">{dia.total_pcq.toLocaleString('pt-BR')}</td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
            {/* v9.9.1: nota de legenda discreta — só quando há Busca Própria com PCQ neste dia */}
            {dia.itens_pcq.some((i) => ehBuscaPropria(i) && !i.zerado && i.quantidade > 0) && (
              <p className="px-2 pb-2 text-[10px] text-muted-foreground">
                (N) = pães de cachorro quente · 1 forma = {FORMA_PCQ_PAES} pães · unidades Busca Própria
              </p>
            )}
            {/* v9.10.12: nota das linhas excepcionais — como criar produção fora do padrão */}
            {temFantasmaPcq && (
              <p className="px-2 pb-2 text-[10px] text-muted-foreground">
                Escolas com PCQ habilitado aparecem mesmo sem produção neste dia — clique em <strong>Ajustar</strong> para programar uma produção excepcional.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lanche */}
      {dia.itens_lanche.length > 0 && (
        <Card className="border-pink-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-pink-900 flex items-center gap-2"><Cookie className="w-4 h-4" /> Lanche</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-pink-100">
                <th className="text-left p-2 text-xs font-medium text-muted-foreground">Escola</th>
                <th className="text-right p-2 text-xs font-medium text-muted-foreground">Qtd</th>
                <th className="text-center p-2 text-xs font-medium text-muted-foreground">Status</th>
                <th className="p-2"></th>
              </tr></thead>
              <tbody>
                {dia.itens_lanche.map((item) => (
                  <tr key={item.escola_id} className="border-b border-muted/30 hover:bg-muted/20 cursor-pointer" onClick={() => onAjuste(item)}>
                    <td className="p-2 font-medium">{item.escola_curto}</td>
                    <td className="p-2 text-right font-mono">
                      {item.zerado ? <span className="line-through text-red-400">{item.quantidade}</span> : <span className={item.ajustado ? 'text-amber-600 font-semibold' : ''}>{item.quantidade.toLocaleString('pt-BR')}</span>}
                    </td>
                    <td className="p-2 text-center">
                      {item.zerado && <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="w-3 h-3 mr-0.5" /> Feriado</Badge>}
                      {item.ajustado && !item.zerado && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Ajustado</Badge>}
                    </td>
                    <td className="p-2"><Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground">Ajustar</Button></td>
                  </tr>
                ))}
                <tr className="border-t-2 border-pink-200 bg-pink-50/50">
                  <td className="p-2 font-bold text-pink-900">Total Lanche</td>
                  <td className="p-2 text-right font-bold text-pink-900">{dia.total_lanche.toLocaleString('pt-BR')}</td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}

function ItemRow({ item, onAjuste }: { item: ItemProducao; onAjuste: (item: ItemProducao) => void }) {
  const entregaLabel = item.dia_entrega ? DIAS_LABEL_CURTO[item.dia_entrega as DiaSemana] || item.dia_entrega : ''
  return (
    <tr className="border-b border-muted/30 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => onAjuste(item)}>
      <td className="p-2 font-medium">{item.escola_curto}</td>
      <td className="p-2 text-center">{entregaLabel}</td>
      <td className="p-2 text-right font-mono">
        {item.zerado ? <span className="line-through text-red-400">{item.quantidade}</span> : <span className={item.ajustado ? 'text-amber-600 font-semibold' : ''}>{item.quantidade.toLocaleString('pt-BR')}</span>}
      </td>
      <td className="p-2 text-center">
        {item.zerado && <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="w-3 h-3 mr-0.5" /> Feriado</Badge>}
        {item.ajustado && !item.zerado && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Ajustado</Badge>}
      </td>
      <td className="p-2"><Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground hover:text-[#1A3A5C]">Ajustar</Button></td>
    </tr>
  )
}
