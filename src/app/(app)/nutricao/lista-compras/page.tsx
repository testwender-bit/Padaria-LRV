'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ShoppingCart, RefreshCw, FileDown, Filter, Save, Search,
  Users, Package, AlertCircle, CheckCircle2, Plus, FileSpreadsheet, Printer, History
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'

interface Escola {
  id: string
  nome: string
  nome_curto: string
  categoria: string
  segmento: string
  alunos_parcial: number
  alunos_integral: number
  mescla_parcial_integral: boolean
  dia_pao_frances: string | null
  dia_lanche: string | null
  ativo: boolean
}

interface CardapioResumo {
  id: string
  nome: string
  escola?: { id: string; nome: string } | null
  escola_id?: string | null
  fase_escolar: string
  ano: number
  semestre: number
  semanas_count: number
  is_base?: boolean
  status?: string  // v9.2: para filtrar APROVADO
}

interface ItemLista {
  alimento_id: string
  alimento_nome: string
  alimento_grupo: string
  unidade: string
  medida_caseira: string
  gramas_por_medida: number
  qtd_total_gramas: number
  qtd_total_kg: number
  qtd_total_medidas: number
  por_escola: { escola_id: string; escola_nome: string; gramas: number; kg: number }[]
}

interface ListaResponse {
  cardapio: { id: string; nome: string; fase_escolar: string; ano: number; semestre: number }
  semanas_consideradas: number[]
  escolas: any[]
  total_alunos_parcial: number
  total_alunos_integral: number
  total_itens: number
  total_gramas: number
  total_kg: number
  por_grupo: Record<string, number>
  itens: ItemLista[]
}

export default function ListaComprasPage() {
  const [cardapios, setCardapios] = useState<CardapioResumo[]>([])
  const [escolas, setEscolas] = useState<Escola[]>([])
  const [loading, setLoading] = useState(true)

  const [cardapioId, setCardapioId] = useState('')
  // v9.2: seleção múltipla de cardápios
  const [cardapiosSel, setCardapiosSel] = useState<Set<string>>(new Set())
  const [semanasSel, setSemanasSel] = useState<Set<number>>(new Set())
  const [escolasSel, setEscolasSel] = useState<Set<string>>(new Set())
  const [resultado, setResultado] = useState<ListaResponse | null>(null)
  const [gerando, setGerando] = useState(false)

  const [searchItem, setSearchItem] = useState('')
  const [filtroGrupo, setFiltroGrupo] = useState('all')
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveNome, setSaveNome] = useState('')

  // v9.2: snapshots salvos + filtro de status
  const [snapshots, setSnapshots] = useState<Array<{ id: string; nome: string; gerada_em: string; status: string }>>([])
  const [mostrarRascunhos, setMostrarRascunhos] = useState(false)

  // v9.3: só mostra cardápios com escola vinculada (não bases sem escola)
  // + filtra por status APROVADO por padrão
  const cardapiosFiltrados = (mostrarRascunhos
    ? cardapios
    : cardapios.filter((c) => c.status === 'APROVADO')
  ).filter((c) => c.escola_id || c.escola)  // só com escola vinculada

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [cardRes, escRes, snapRes] = await Promise.all([
        fetch('/api/nutricao/cardapios'),
        fetch('/api/escolas'),
        fetch('/api/nutricao/lista-compras-snapshots'),
      ])
      const cardData = await cardRes.json()
      const escData = await escRes.json()
      const snapData = snapRes.ok ? await snapRes.json() : []
      setCardapios(Array.isArray(cardData) ? cardData : [])
      setEscolas(Array.isArray(escData) ? escData : [])
      setSnapshots(Array.isArray(snapData) ? snapData : [])
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // v9.2: carregar snapshot salvo
  async function handleAbrirSnapshot(snapId: string) {
    try {
      const res = await fetch(`/api/nutricao/lista-compras/${snapId}`)
      if (!res.ok) throw new Error('Erro ao carregar snapshot')
      const data = await res.json()
      // v9.2: preenche todos os campos do ListaResponse (snapshot só tem itens_json)
      const itens = data.itens_json || []
      const totalGramas = itens.reduce((s: number, i: ItemLista) => s + (i.qtd_total_gramas || 0), 0)
      const porGrupo: Record<string, number> = {}
      for (const i of itens) {
        porGrupo[i.alimento_grupo] = (porGrupo[i.alimento_grupo] || 0) + (i.qtd_total_gramas || 0)
      }
      setResultado({
        cardapio: { id: '', nome: data.nome || 'Snapshot', fase_escolar: '', ano: 0, semestre: 0 },
        semanas_consideradas: [],
        escolas: data.escolas_snapshot ? (typeof data.escolas_snapshot === 'string' ? JSON.parse(data.escolas_snapshot) : data.escolas_snapshot) : [],
        total_alunos_parcial: 0,
        total_alunos_integral: 0,
        total_itens: itens.length,
        total_gramas: totalGramas,
        total_kg: totalGramas / 1000,
        por_grupo: porGrupo,
        itens: itens,
      })
      toast.success(`Snapshot "${data.nome}" carregado`)
    } catch {
      toast.error('Erro ao abrir snapshot')
    }
  }

  // v9.2: auto-seleciona o primeiro cardápio APROVADO ao carregar
  useEffect(() => {
    if (cardapiosSel.size === 0 && cardapiosFiltrados.length > 0) {
      const primeiro = cardapiosFiltrados[0]
      setCardapiosSel(new Set([primeiro.id]))
    }
  }, [cardapiosFiltrados, cardapiosSel.size])

  // v9.2: Gera lista de semanas — SEMPRE 22 (semestre completo)
  // Antes: usava cardapioSel?.semanas_count que podia ser 5 (ciclo base)
  // Agora: sempre mostra 22 semanas para o usuário selecionar
  const semanasOptions = useMemo(() => {
    return Array.from({ length: 22 }, (_, i) => i + 1)
  }, [])

  function toggleSemana(n: number) {
    setSemanasSel((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }
  function toggleAllSemanas(select: boolean) {
    setSemanasSel(select ? new Set(semanasOptions) : new Set())
  }

  function toggleEscola(id: string) {
    setEscolasSel((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleAllEscolas(select: boolean) {
    setEscolasSel(select ? new Set(escolas.filter(e => e.ativo).map(e => e.id)) : new Set())
  }

  async function gerarLista() {
    if (cardapiosSel.size === 0) {
      toast.error('Selecione ao menos um cardápio')
      return
    }
    setGerando(true)
    try {
      const params = new URLSearchParams({
        cardapio_ids: Array.from(cardapiosSel).join(','),
      })
      if (semanasSel.size > 0 && semanasSel.size < semanasOptions.length) {
        params.set('semanas', Array.from(semanasSel).sort((a, b) => a - b).join(','))
      } else {
        params.set('semanas', 'all')
      }
      const res = await fetch(`/api/nutricao/lista-compras?${params.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao gerar lista')
      }
      const data = await res.json()
      setResultado(data)
      toast.success(`Lista gerada: ${data.total_itens} itens, ${data.total_kg} kg total`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar lista')
    } finally {
      setGerando(false)
    }
  }

  async function salvarSnapshot() {
    if (!resultado || !saveNome) {
      toast.error('Informe um nome para a lista')
      return
    }
    try {
      const res = await fetch('/api/nutricao/lista-compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: saveNome,
          cardapio_id: Array.from(cardapiosSel)[0] || '',  // v9.2: primeiro cardápio selecionado
          escolas_snapshot: resultado.escolas,
          itens_json: resultado.itens,
        }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      toast.success('Snapshot salvo com sucesso')
      setSaveDialogOpen(false)
      setSaveNome('')
    } catch {
      toast.error('Erro ao salvar snapshot')
    }
  }

  function exportarCSV() {
    if (!resultado) return
    const linhas: string[] = []
    // Cabeçalho: alimento + colunas por escola
    const escolasCols = resultado.escolas.map((e: any) => e.nome)
    linhas.push(['Alimento', 'Grupo', 'Medida Caseira', 'Total (g)', 'Total (kg)', 'Total (medidas)', ...escolasCols].join(';'))

    for (const item of resultado.itens) {
      const row = [
        `"${item.alimento_nome}"`,
        `"${item.alimento_grupo}"`,
        `"${item.medida_caseira || ''}"`,
        item.qtd_total_gramas,
        item.qtd_total_kg,
        item.qtd_total_medidas,
        ...resultado.escolas.map((e: any) => {
          const v = item.por_escola.find((p) => p.escola_id === e.id)
          return v ? v.gramas : 0
        }),
      ]
      linhas.push(row.join(';'))
    }

    // BOM + CSV
    const csv = '\uFEFF' + linhas.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lista-compras-${resultado?.cardapio?.nome || 'cardapio'}-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('CSV exportado')
  }

  // ── NOVO v7: Exportação XLSX com múltiplas abas ──
  function exportarXLSX() {
    if (!resultado) return
    const wb = XLSX.utils.book_new()
    const dataHora = new Date().toLocaleString('pt-BR')
    const cardapioNome = resultado?.cardapio?.nome || 'Cardápio'
    const fileName = `lista-compras-${cardapioNome}-${new Date().toISOString().split('T')[0]}.xlsx`

    // ── Aba 1: Resumo geral ──
    const resumoRows = [
      ['LISTA DE COMPRAS — PADARIA MUNICIPAL'],
      [''],
      ['Cardápio:', cardapioNome],
      ['Fase escolar:', resultado.cardapio.fase_escolar],
      ['Ano/Semestre:', `${resultado.cardapio.ano}/${resultado.cardapio.semestre}`],
      ['Semanas consideradas:', resultado.semanas_consideradas.join(', ')],
      ['Escolas:', resultado.escolas.length],
      ['Total alunos (parcial):', resultado.total_alunos_parcial],
      ['Total alunos (integral):', resultado.total_alunos_integral],
      ['Total itens:', resultado.total_itens],
      ['Total geral (kg):', resultado.total_kg.toFixed(2)],
      ['Gerado em:', dataHora],
      [''],
      ['DISTRIBUIÇÃO POR GRUPO DE ALIMENTO'],
      ['Grupo', 'Total (kg)'],
      ...Object.entries(resultado.por_grupo).map(([g, kg]) => [g, (kg as number).toFixed(2)]),
    ]
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows)
    wsResumo['!cols'] = [{ wch: 35 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo')

    // ── Aba 2: Itens consolidados ──
    const itensRows: any[][] = [
      ['Alimento', 'Grupo', 'Medida Caseira', 'Total (g)', 'Total (kg)', 'Total (medidas)'],
      ...resultado.itens.map((it) => [
        it.alimento_nome,
        it.alimento_grupo,
        it.medida_caseira || '',
        it.qtd_total_gramas,
        it.qtd_total_kg,
        it.qtd_total_medidas,
      ]),
    ]
    const wsItens = XLSX.utils.aoa_to_sheet(itensRows)
    wsItens['!cols'] = [
      { wch: 32 }, { wch: 28 }, { wch: 18 },
      { wch: 12 }, { wch: 12 }, { wch: 14 },
    ]
    XLSX.utils.book_append_sheet(wb, wsItens, 'Itens Consolidados')

    // ── Aba 3: Por escola (matriz cruzada) ──
    const escolaHeader = resultado.escolas.map((e: any) => e.nome)
    const porEscolaRows: any[][] = [
      ['ALIMENTO', 'GRUPO', 'TOTAL (kg)', ...escolaHeader.map((n: string) => `${n} (g)`)],
      ...resultado.itens.map((it) => [
        it.alimento_nome,
        it.alimento_grupo,
        it.qtd_total_kg.toFixed(2),
        ...resultado.escolas.map((e: any) => {
          const v = it.por_escola.find((p) => p.escola_id === e.id)
          return v ? v.gramas : 0
        }),
      ]),
    ]
    const wsPorEscola = XLSX.utils.aoa_to_sheet(porEscolaRows)
    const colsPorEscola = [{ wch: 32 }, { wch: 28 }, { wch: 12 }]
    for (let i = 0; i < escolaHeader.length; i++) colsPorEscola.push({ wch: 16 })
    wsPorEscola['!cols'] = colsPorEscola
    XLSX.utils.book_append_sheet(wb, wsPorEscola, 'Por Escola')

    // ── Aba 4: Escolas (alunos + segmento) ──
    const escolasRows: any[][] = [
      ['ESCOLA', 'SEGMENTO', 'ALUNOS PARCIAL', 'ALUNOS INTEGRAL', 'MESCLA P/I', 'DIA PÃO', 'DIA LANCHE'],
      ...resultado.escolas.map((e: any) => [
        e.nome,
        e.segmento || '—',
        e.alunos_parcial || 0,
        e.alunos_integral || 0,
        e.mescla_parcial_integral ? 'Sim' : 'Não',
        e.dia_pao_frances || '—',
        e.dia_lanche || '—',
      ]),
    ]
    const wsEscolas = XLSX.utils.aoa_to_sheet(escolasRows)
    wsEscolas['!cols'] = [
      { wch: 32 }, { wch: 18 }, { wch: 14 },
      { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
    ]
    XLSX.utils.book_append_sheet(wb, wsEscolas, 'Escolas')

    // ── Aba 5: Por grupo (separado para facilitar compras por seção de mercado) ──
    const gruposOrdenados = Object.keys(resultado.por_grupo).sort()
    const porGrupoRows: any[][] = [
      ['LISTA DE COMPRAS AGRUPADA POR SEÇÃO'],
      [''],
    ]
    for (const grupo of gruposOrdenados) {
      const itensGrupo = resultado.itens.filter((it) => it.alimento_grupo === grupo)
      if (itensGrupo.length === 0) continue
      porGrupoRows.push([`■ ${grupo.toUpperCase()}`, '', 'Total kg:', (resultado.por_grupo as any)[grupo].toFixed(2)])
      porGrupoRows.push(['Alimento', 'Medida Caseira', 'Total (g)', 'Total (kg)', 'Total (medidas)'])
      for (const it of itensGrupo) {
        porGrupoRows.push([
          it.alimento_nome,
          it.medida_caseira || '',
          it.qtd_total_gramas,
          it.qtd_total_kg.toFixed(2),
          it.qtd_total_medidas,
        ])
      }
      porGrupoRows.push([''])
    }
    const wsPorGrupo = XLSX.utils.aoa_to_sheet(porGrupoRows)
    wsPorGrupo['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, wsPorGrupo, 'Por Seção')

    // Escreve o arquivo
    XLSX.writeFile(wb, fileName)
    toast.success('XLSX exportado com 5 abas')
  }

  const itensFiltrados = useMemo(() => {
    if (!resultado) return []
    return resultado.itens.filter((i) => {
      const matchSearch = i.alimento_nome.toLowerCase().includes(searchItem.toLowerCase())
      const matchGrupo = filtroGrupo === 'all' || i.alimento_grupo === filtroGrupo
      return matchSearch && matchGrupo
    })
  }, [resultado, searchItem, filtroGrupo])

  const gruposDisponiveis = useMemo(() => {
    if (!resultado) return []
    return Object.keys(resultado.por_grupo).sort()
  }, [resultado])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#1A3A5C] flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-[#D4A017]" />
            Lista de Compras
          </h1>
          <p className="text-sm text-muted-foreground">
            Consolidado de ingredientes por escola — calculado a partir do cardápio × nº de alunos
          </p>
        </div>
        {resultado && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(true)}>
              <Save className="w-4 h-4 mr-1" /> Salvar Snapshot
            </Button>
            <Button variant="outline" size="sm" onClick={exportarCSV}>
              <FileDown className="w-4 h-4 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportarXLSX} className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
              <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel (5 abas)
            </Button>
            {/* v9.2: Botão Imprimir/PDF */}
            <Button variant="outline" size="sm" onClick={() => window.print()} className="border-blue-200 text-blue-700 hover:bg-blue-50">
              <Printer className="w-4 h-4 mr-1" /> Imprimir / PDF
            </Button>
          </div>
        )}
      </motion.div>

      {/* Filtros */}
      <Card className="border-[#1A3A5C]/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-[#1A3A5C] flex items-center gap-2">
            <Filter className="w-4 h-4" /> Parâmetros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cardápios — v9.2: seleção múltipla */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Cardápios ({cardapiosSel.size} selecionados)</Label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCardapiosSel(new Set(cardapiosFiltrados.map(c => c.id)))}
                    className="text-[10px] text-[#1A3A5C] hover:underline"
                  >
                    Todos
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => setCardapiosSel(new Set())}
                    className="text-[10px] text-gray-500 hover:underline"
                  >
                    Limpar
                  </button>
                </div>
              </div>
              <ScrollArea className="h-[200px] border rounded-md p-2">
                <div className="space-y-1">
                  {cardapiosFiltrados.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-4">
                      Nenhum cardápio de escola encontrado.
                      <br />Crie cardápios vinculados a escolas em /nutricao/cardapios
                    </p>
                  ) : cardapiosFiltrados.map((c) => {
                    const sel = cardapiosSel.has(c.id)
                    // v9.3: busca alunos da escola vinculada
                    const escolaId = c.escola_id || c.escola?.id
                    const escolaData = escolas.find(e => e.id === escolaId)
                    const alunosP = escolaData?.alunos_parcial || 0
                    const alunosI = escolaData?.alunos_integral || 0
                    const totalAlunos = alunosP + alunosI
                    return (
                      <label
                        key={c.id}
                        className={`flex items-start gap-2 p-2 rounded cursor-pointer text-xs ${
                          sel ? 'bg-[#1A3A5C]/5 border border-[#1A3A5C]/20' : 'hover:bg-gray-50 border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={sel}
                          onChange={() => {
                            setCardapiosSel(prev => {
                              const next = new Set(prev)
                              if (next.has(c.id)) next.delete(c.id)
                              else next.add(c.id)
                              return next
                            })
                          }}
                          className="h-3 w-3 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="truncate font-medium">{c.nome}</span>
                            {c.status === 'RASCUNHO' && <span className="text-amber-500 text-[9px]">⚠️ Rascunho</span>}
                          </div>
                          <div className="flex items-center gap-2 text-[9px] text-muted-foreground mt-0.5">
                            <span className="truncate">🏫 {c.escola?.nome || 'Sem escola'}</span>
                            {totalAlunos > 0 ? (
                              <Badge variant="outline" className="text-[8px] h-3.5 px-1">
                                {alunosP}P + {alunosI}I
                              </Badge>
                            ) : (
                              <span className="text-red-500 text-[8px]">⚠️ Sem alunos cadastrados</span>
                            )}
                            <span className="text-[8px]">· {c.fase_escolar}</span>
                          </div>
                        </div>
                        <span className="text-[9px] text-muted-foreground flex-shrink-0">
                          {c.ano}/{c.semestre}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </ScrollArea>
              {cardapiosFiltrados.length > 0 && (
                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={mostrarRascunhos}
                    onChange={(e) => setMostrarRascunhos(e.target.checked)}
                    className="h-3 w-3"
                  />
                  Mostrar rascunhos
                </label>
              )}
            </div>
          </div>

          {/* Semanas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">
                Semanas ({semanasSel.size} de {semanasOptions.length} selecionadas — vazio = todas)
                </Label>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleAllSemanas(true)}
                    className="text-[10px] text-[#1A3A5C] hover:underline"
                  >
                    Todas
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => toggleAllSemanas(false)}
                    className="text-[10px] text-muted-foreground hover:underline"
                  >
                    Nenhuma
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => setSemanasSel(new Set([1, 2, 3, 4, 5]))}
                    className="text-[10px] text-[#1A3A5C] hover:underline"
                  >
                    Ciclo base (1-5)
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {semanasOptions.map((n) => {
                  // Indicar se é "réplica" do ciclo
                  const isReplica = n > 5
                  const baseNum = ((n - 1) % 5) + 1
                  return (
                    <button
                      key={n}
                      onClick={() => toggleSemana(n)}
                      className={`px-2 py-1 rounded border text-[10px] font-medium transition-colors ${
                        semanasSel.has(n)
                          ? 'bg-[#1A3A5C] text-white border-[#1A3A5C]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#1A3A5C]/30'
                      }`}
                      title={isReplica ? `Cópia da semana ${baseNum}` : `Semana ${n}`}
                    >
                      {n}
                      {isReplica && <span className="opacity-60 ml-0.5">→{baseNum}</span>}
                    </button>
                  )
                })}
              </div>
            </div>

          <Button
            onClick={gerarLista}
            disabled={gerando || cardapiosSel.size === 0}
            className="w-full bg-[#1A3A5C] hover:bg-[#1A3A5C]/90"
          >
            {gerando ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Calculando...
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4 mr-2" />
                Gerar Lista de Compras
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Resultado */}
      {resultado && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          {/* Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-[#1A3A5C]/10">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#D4A017]" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Itens</p>
                    <p className="text-lg font-bold text-[#1A3A5C]">{resultado.total_itens}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-[#1A3A5C]/10">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-[#1A3A5C]" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                    <p className="text-lg font-bold text-[#1A3A5C]">{resultado.total_kg} kg</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-[#1A3A5C]/10">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Alunos Parcial</p>
                    <p className="text-lg font-bold text-[#1A3A5C]">{resultado.total_alunos_parcial}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-[#1A3A5C]/10">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-500" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Alunos Integral</p>
                    <p className="text-lg font-bold text-[#1A3A5C]">{resultado.total_alunos_integral}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resumo por grupo */}
          <Card className="border-[#1A3A5C]/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#1A3A5C]">Resumo por Grupo Alimentar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(resultado.por_grupo)
                  .sort(([, a], [, b]) => b - a)
                  .map(([grupo, gramas]) => (
                    <div key={grupo} className="flex items-center justify-between p-2 rounded-md bg-gray-50 border border-gray-100">
                      <span className="text-[10px] text-muted-foreground truncate flex-1">{grupo}</span>
                      <span className="text-xs font-bold text-[#1A3A5C] ml-2">{(gramas / 1000).toFixed(1)} kg</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Filtros de itens */}
          <Card className="border-[#1A3A5C]/10">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <CardTitle className="text-sm font-semibold text-[#1A3A5C] flex-1">
                  Itens Consolidados ({itensFiltrados.length})
                </CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                    <Input
                      placeholder="Buscar item..."
                      value={searchItem}
                      onChange={(e) => setSearchItem(e.target.value)}
                      className="pl-7 h-8 text-xs w-48"
                    />
                  </div>
                  <Select value={filtroGrupo} onValueChange={setFiltroGrupo}>
                    <SelectTrigger className="h-8 text-xs w-44">
                      <SelectValue placeholder="Grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os grupos</SelectItem>
                      {gruposDisponiveis.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b">
                      <th className="text-left p-2 font-semibold text-[#1A3A5C]">Alimento</th>
                      <th className="text-left p-2 font-semibold text-[#1A3A5C]">Grupo</th>
                      <th className="text-right p-2 font-semibold text-[#1A3A5C]">Medida Caseira</th>
                      <th className="text-right p-2 font-semibold text-[#1A3A5C]">Total (g)</th>
                      <th className="text-right p-2 font-semibold text-[#1A3A5C]">Total (kg)</th>
                      <th className="text-right p-2 font-semibold text-[#1A3A5C]">Medidas</th>
                      <th className="text-right p-2 font-semibold text-[#1A3A5C]">Escolas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensFiltrados.map((item) => (
                      <tr key={item.alimento_id} className="border-b hover:bg-gray-50">
                        <td className="p-2 font-medium text-[#1A3A5C]">{item.alimento_nome}</td>
                        <td className="p-2 text-muted-foreground">{item.alimento_grupo}</td>
                        <td className="p-2 text-right text-muted-foreground text-[10px]">{item.medida_caseira || '—'}</td>
                        <td className="p-2 text-right font-mono">{item.qtd_total_gramas.toLocaleString('pt-BR')}</td>
                        <td className="p-2 text-right font-mono font-bold">{item.qtd_total_kg.toLocaleString('pt-BR')} kg</td>
                        <td className="p-2 text-right font-mono text-muted-foreground">{item.qtd_total_medidas.toLocaleString('pt-BR')}</td>
                        <td className="p-2 text-right">
                          <Badge variant="outline" className="text-[9px]">
                            {item.por_escola.length}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {itensFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-muted-foreground">
                          Nenhum item encontrado com esse filtro.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Detalhe por escola (expansível) */}
          <Card className="border-[#1A3A5C]/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#1A3A5C]">
                Detalhamento por Escola
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b">
                      <th className="text-left p-2 font-semibold text-[#1A3A5C]">Escola</th>
                      <th className="text-right p-2 font-semibold text-[#1A3A5C]">Parcial</th>
                      <th className="text-right p-2 font-semibold text-[#1A3A5C]">Integral</th>
                      <th className="text-center p-2 font-semibold text-[#1A3A5C]">Mescla</th>
                      <th className="text-right p-2 font-semibold text-[#1A3A5C]">Itens</th>
                      <th className="text-right p-2 font-semibold text-[#1A3A5C]">Total (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.escolas.map((esc: any) => {
                      const itensEscola = resultado.itens
                        .map((i) => i.por_escola.find((p) => p.escola_id === esc.id)?.gramas || 0)
                      const totalEscola = itensEscola.reduce((a, b) => a + b, 0)
                      const itensCount = itensEscola.filter((g) => g > 0).length
                      return (
                        <tr key={esc.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 font-medium">{esc.nome}</td>
                          <td className="p-2 text-right text-blue-600">{esc.alunos_parcial}</td>
                          <td className="p-2 text-right text-emerald-600">{esc.alunos_integral}</td>
                          <td className="p-2 text-center">
                            {esc.mescla ? <CheckCircle2 className="w-3 h-3 text-emerald-500 inline" /> : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="p-2 text-right">{itensCount}</td>
                          <td className="p-2 text-right font-mono font-bold">
                            {(totalEscola / 1000).toFixed(2)} kg
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* v9.2: Lista de snapshots salvos */}
      {snapshots.length > 0 && (
        <Card className="border-[#1A3A5C]/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#1A3A5C] flex items-center gap-2">
              <History className="w-4 h-4" />
              Snapshots Salvos ({snapshots.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[120px]">
              <div className="space-y-1">
                {snapshots.map((snap) => (
                  <button
                    key={snap.id}
                    onClick={() => handleAbrirSnapshot(snap.id)}
                    className="w-full text-left p-2 rounded border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{snap.nome}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(snap.gerada_em).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[9px] flex-shrink-0">
                      {snap.status}
                    </Badge>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1A3A5C]">Salvar Snapshot da Lista</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Será salvo um snapshot com os itens, escolas e quantidades calculadas.
              Útil para arquivar uma versão oficial enviada ao fornecedor.
            </p>
            <div className="space-y-2">
              <Label>Nome da Lista</Label>
              <Input
                value={saveNome}
                onChange={(e) => setSaveNome(e.target.value)}
                placeholder={`Lista Compras — ${new Date().toLocaleDateString('pt-BR')}`}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancelar</Button>
              <Button onClick={salvarSnapshot} disabled={!saveNome} className="bg-[#1A3A5C] hover:bg-[#1A3A5C]/90">
                <Save className="w-4 h-4 mr-1" /> Salvar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
