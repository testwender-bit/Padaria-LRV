'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ShoppingCart, RefreshCw, FileDown, Save, Search,
  Users, Package, AlertCircle, Calendar, School, Truck,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import {
  CATEGORIAS_LISTA, CATEGORIA_LABELS,
  type CategoriaLista,
  type ListaComprasResultado,
  type ItemListaComprasConsolidado,
} from '@/lib/lista-compras-utils'

interface Escola {
  id: string
  nome: string
  nome_curto: string
  categoria: string
  segmento: string
  rota: string
  alunos_parcial: number
  alunos_integral: number
  ativo: boolean
}

type Modo = 'PREVISAO' | 'PEDIDO'

export default function ListaComprasPage() {
  const [escolas, setEscolas] = useState<Escola[]>([])
  const [loading, setLoading] = useState(true)

  const [modo, setModo] = useState<Modo>('PREVISAO')

  // ── Estado do modo PREVISAO ──
  const [escolasSelPrevisao, setEscolasSelPrevisao] = useState<Set<string>>(new Set())
  const [dataInicioPrev, setDataInicioPrev] = useState('')
  const [dataFimPrev, setDataFimPrev] = useState('')

  // ── Estado do modo PEDIDO ──
  const [escolaSelPedido, setEscolaSelPedido] = useState('')
  const [dataReferenciaPedido, setDataReferenciaPedido] = useState('')

  // ── Resultado ──
  const [resultado, setResultado] = useState<ListaComprasResultado | null>(null)
  const [gerando, setGerando] = useState(false)

  // ── Filtros de visualização ──
  const [searchItem, setSearchItem] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('all')

  // ── Save snapshot dialog ──
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveNome, setSaveNome] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/escolas')
      const data = await res.json()
      setEscolas(Array.isArray(data) ? data : [])
    } catch {
      setEscolas([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Inicializa datas (semana atual: segunda a sexta)
  useEffect(() => {
    if (!dataInicioPrev && !dataFimPrev) {
      const hoje = new Date()
      const dia = hoje.getDay()
      // Voltar para segunda-feira
      const segunda = new Date(hoje)
      segunda.setDate(hoje.getDate() - (dia === 0 ? 6 : dia - 1))
      const sexta = new Date(segunda)
      sexta.setDate(segunda.getDate() + 4)
      const toISO = (d: Date) => d.toISOString().slice(0, 10)
      setDataInicioPrev(toISO(segunda))
      setDataFimPrev(toISO(sexta))
    }
    if (!dataReferenciaPedido) {
      const hoje = new Date()
      const toISO = (d: Date) => d.toISOString().slice(0, 10)
      setDataReferenciaPedido(toISO(hoje))
    }
  }, [])

  // ── Seleção rápida de escolas ──
  function selecionarTodas() {
    setEscolasSelPrevisao(new Set(escolas.filter(e => e.ativo).map(e => e.id)))
  }
  function limparSelecao() {
    setEscolasSelPrevisao(new Set())
  }
  function selecionarPorRota(rota: string) {
    setEscolasSelPrevisao(new Set(escolas.filter(e => e.ativo && e.rota === rota).map(e => e.id)))
  }
  function selecionarPorCategoria(cat: string) {
    setEscolasSelPrevisao(new Set(escolas.filter(e => e.ativo && e.categoria === cat).map(e => e.id)))
  }
  function toggleEscola(id: string) {
    setEscolasSelPrevisao((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Gerar lista ──
  async function handleGerar() {
    setGerando(true)
    setResultado(null)
    try {
      let url = ''
      if (modo === 'PREVISAO') {
        if (!dataInicioPrev || !dataFimPrev) {
          toast.error('Selecione o período (data início e fim)')
          setGerando(false)
          return
        }
        const params = new URLSearchParams({
          modo: 'PREVISAO',
          data_inicio: dataInicioPrev,
          data_fim: dataFimPrev,
        })
        if (escolasSelPrevisao.size > 0) {
          params.set('escolas_ids', Array.from(escolasSelPrevisao).join(','))
        }
        url = `/api/nutricao/lista-compras?${params.toString()}`
      } else {
        if (!escolaSelPedido) {
          toast.error('Selecione uma escola')
          setGerando(false)
          return
        }
        const params = new URLSearchParams({
          modo: 'PEDIDO',
          escola_id: escolaSelPedido,
        })
        if (dataReferenciaPedido) {
          params.set('data_referencia', dataReferenciaPedido)
        }
        url = `/api/nutricao/lista-compras?${params.toString()}`
      }

      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error || 'Erro ao gerar lista')
        setGerando(false)
        return
      }
      setResultado(data)
      toast.success(`Lista gerada: ${data.totais?.total_itens || 0} itens`)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao gerar lista de compras')
    } finally {
      setGerando(false)
    }
  }

  // ── Salvar snapshot ──
  async function handleSalvar() {
    if (!resultado) return
    if (!saveNome.trim()) {
      toast.error('Digite um nome para a lista')
      return
    }
    try {
      // Para o snapshot, usamos o primeiro cardápio utilizado (ou vazio)
      const cardapioId = resultado.cardapios_utilizados?.[0]?.id || ''
      if (!cardapioId) {
        toast.error('Nenhum cardápio associado — não é possível salvar snapshot')
        return
      }
      const res = await fetch('/api/nutricao/lista-compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: saveNome,
          cardapio_id: cardapioId,
          escolas_snapshot: resultado.escolas,
          itens_json: resultado.itens,
        }),
      })
      if (res.ok) {
        toast.success('Snapshot salvo com sucesso!')
        setSaveDialogOpen(false)
        setSaveNome('')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erro ao salvar')
      }
    } catch {
      toast.error('Erro ao salvar snapshot')
    }
  }

  // ── Exportar CSV ──
  function exportarCSV() {
    if (!resultado) return
    const linhas: string[] = []
    linhas.push('Categoria;Item;Quantidade (kg);Quantidade (g);Unidade Compra;Qtd Unidade')
    for (const item of resultado.itens) {
      linhas.push([
        item.categoria,
        `"${item.nome_canonico.replace(/"/g, '""')}"`,
        item.qtd_total_kg.toFixed(2),
        item.qtd_total_gramas,
        item.unidade,
        item.qtd_total_unidade.toFixed(2),
      ].join(';'))
    }
    const csv = '\uFEFF' + linhas.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lista-compras-${resultado.modo.toLowerCase()}-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Exportar XLSX ──
  function exportarXLSX() {
    if (!resultado) return
    const wb = XLSX.utils.book_new()

    // Aba 1: Itens consolidados
    const itensData = resultado.itens.map((it) => ({
      'Categoria': it.categoria,
      'Item': it.nome_canonico,
      'Nome Original': it.nome_original,
      'Qtd (kg)': it.qtd_total_kg,
      'Qtd (g)': it.qtd_total_gramas,
      'Unidade': it.unidade,
      'Qtd Unidade': it.qtd_total_unidade,
    }))
    const ws1 = XLSX.utils.json_to_sheet(itensData)
    XLSX.utils.book_append_sheet(wb, ws1, 'Itens Consolidados')

    // Aba 2: Resumo por categoria
    const resumoData = resultado.por_categoria.map((c) => ({
      'Categoria': c.label,
      'Itens': c.itens,
      'Total (kg)': c.kg,
    }))
    const ws2 = XLSX.utils.json_to_sheet(resumoData)
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumo por Categoria')

    // Aba 3: Detalhamento por escola (somente modo PREVISAO)
    if (resultado.modo === 'PREVISAO') {
      const porEscola: any[] = []
      for (const item of resultado.itens) {
        for (const pe of item.por_escola) {
          porEscola.push({
            'Escola': pe.escola_nome,
            'Escola Curto': pe.escola_curto,
            'Item': item.nome_canonico,
            'Categoria': item.categoria,
            'Qtd (g)': pe.qtd_gramas,
            'Qtd (kg)': Math.round(pe.qtd_gramas / 10) / 100,
          })
        }
      }
      const ws3 = XLSX.utils.json_to_sheet(porEscola)
      XLSX.utils.book_append_sheet(wb, ws3, 'Por Escola')
    }

    // Aba 4: Escolas consideradas
    const escolasData = resultado.escolas.map((e) => ({
      'Escola': e.nome,
      'Categoria': e.categoria,
      'Rota': e.rota,
      'Alunos Parcial': e.alunos_parcial,
      'Alunos Integral': e.alunos_integral,
    }))
    const ws4 = XLSX.utils.json_to_sheet(escolasData)
    XLSX.utils.book_append_sheet(wb, ws4, 'Escolas')

    XLSX.writeFile(wb, `lista-compras-${resultado.modo.toLowerCase()}-${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  // ── Filtragem de itens (visualização) ──
  const itensFiltrados = useMemo(() => {
    if (!resultado) return []
    return resultado.itens.filter((it) => {
      if (filtroCategoria !== 'all' && it.categoria !== filtroCategoria) return false
      if (searchItem && !it.nome_canonico.toLowerCase().includes(searchItem.toLowerCase())) return false
      return true
    })
  }, [resultado, filtroCategoria, searchItem])

  // ── Agrupar itens por categoria ──
  const itensPorCategoria = useMemo(() => {
    const map = new Map<string, ItemListaComprasConsolidado[]>()
    for (const it of itensFiltrados) {
      if (!map.has(it.categoria)) map.set(it.categoria, [])
      map.get(it.categoria)!.push(it)
    }
    return map
  }, [itensFiltrados])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
          <span className="text-muted-foreground">Carregando...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3A5C] flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-[#D4A017]" />
            Lista de Compras
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Previsão de demanda para a rede ou pedido semanal por escola
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="w-3 h-3 mr-1" /> Recarregar
        </Button>
      </div>

      {/* ── Seletor de Modo ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Modo de Operação</Label>
          </div>
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 w-fit">
            <button
              onClick={() => setModo('PREVISAO')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                modo === 'PREVISAO' ? 'bg-white text-[#1A3A5C] shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Package className="w-4 h-4" /> Previsão de Rede
            </button>
            <button
              onClick={() => setModo('PEDIDO')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                modo === 'PEDIDO' ? 'bg-white text-[#1A3A5C] shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <School className="w-4 h-4" /> Pedido Semanal
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {modo === 'PREVISAO'
              ? 'Selecione um período (data início/fim) e as escolas para prever a demanda total de ingredientes.'
              : 'Selecione UMA escola e uma data de referência — o sistema calcula o pedido semanal automaticamente (Ter→Seg para regulares; Qua→Ter para interior).'}
          </p>
        </CardContent>
      </Card>

      {/* ── Formulário PREVISAO ── */}
      {modo === 'PREVISAO' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Período e Escolas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Período */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Data Início</Label>
                  <Input type="date" value={dataInicioPrev} onChange={(e) => setDataInicioPrev(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Data Fim</Label>
                  <Input type="date" value={dataFimPrev} onChange={(e) => setDataFimPrev(e.target.value)} />
                </div>
              </div>

              {/* Seleção rápida */}
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Seleção Rápida de Escolas</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Button size="sm" variant="outline" onClick={selecionarTodas} className="h-7 text-xs">Todas</Button>
                  <Button size="sm" variant="outline" onClick={limparSelecao} className="h-7 text-xs">Limpar</Button>
                  <span className="text-xs text-muted-foreground self-center mx-1">|</span>
                  <Button size="sm" variant="outline" onClick={() => selecionarPorRota('JOSE')} className="h-7 text-xs">
                    <Truck className="w-3 h-3 mr-1" /> Motorista José
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => selecionarPorRota('AROLDO')} className="h-7 text-xs">
                    <Truck className="w-3 h-3 mr-1" /> Motorista Aroldo
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => selecionarPorRota('BUSCA_PROPRIA')} className="h-7 text-xs">
                    Busca Própria
                  </Button>
                  <span className="text-xs text-muted-foreground self-center mx-1">|</span>
                  <Button size="sm" variant="outline" onClick={() => selecionarPorCategoria('REGULAR')} className="h-7 text-xs">Regulares</Button>
                  <Button size="sm" variant="outline" onClick={() => selecionarPorCategoria('INTEGRAL')} className="h-7 text-xs">Integrais</Button>
                  <Button size="sm" variant="outline" onClick={() => selecionarPorCategoria('CRECHE')} className="h-7 text-xs">Creches</Button>
                  <Button size="sm" variant="outline" onClick={() => selecionarPorCategoria('BIFASICA')} className="h-7 text-xs">Bifásicas</Button>
                  <Button size="sm" variant="outline" onClick={() => selecionarPorCategoria('INTERIOR')} className="h-7 text-xs">Interior</Button>
                </div>
              </div>

              {/* Lista de escolas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">
                    Escolas Selecionadas: {escolasSelPrevisao.size} / {escolas.filter(e => e.ativo).length}
                  </Label>
                </div>
                <div className="max-h-64 overflow-y-auto border rounded-lg p-2 space-y-1 bg-gray-50/50">
                  {escolas.filter(e => e.ativo).map((e) => (
                    <label key={e.id} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={escolasSelPrevisao.has(e.id)}
                        onChange={() => toggleEscola(e.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{e.nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {e.nome_curto} · {e.categoria} · {e.rota} · {e.alunos_parcial} parc / {e.alunos_integral} int
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <Button onClick={handleGerar} disabled={gerando} className="w-full bg-[#1A3A5C]">
                {gerando ? (
                  <><div className="w-3 h-3 rounded-full border border-white/30 border-t-white animate-spin mr-2" /> Gerando...</>
                ) : (
                  <><Package className="w-4 h-4 mr-1" /> Gerar Lista de Previsão</>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Formulário PEDIDO ── */}
      {modo === 'PEDIDO' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <School className="w-4 h-4" /> Escola e Semana
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Escola</Label>
                  <Select value={escolaSelPedido} onValueChange={setEscolaSelPedido}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione a escola..." /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {escolas.filter(e => e.ativo).map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nome_curto} — {e.categoria} · {e.rota}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Data de Referência (qualquer dia da semana desejada)</Label>
                  <Input
                    type="date"
                    value={dataReferenciaPedido}
                    onChange={(e) => setDataReferenciaPedido(e.target.value)}
                  />
                </div>
              </div>

              {/* Aviso sobre regra de período */}
              {escolaSelPedido && (() => {
                const esc = escolas.find(e => e.id === escolaSelPedido)
                if (!esc) return null
                const isInterior = (esc.categoria || '').toUpperCase() === 'INTERIOR'
                return (
                  <div className={`p-3 rounded-lg border text-xs ${isInterior ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-blue-50 border-blue-200 text-blue-900'}`}>
                    <strong>Regra de período:</strong>{' '}
                    {isInterior
                      ? 'Escola do INTERIOR — pedido cobre de QUARTA da semana atual até TERÇA da semana seguinte (7 dias).'
                      : 'Escola REGULAR/URBANA — pedido cobre de TERÇA da semana atual até SEGUNDA da semana seguinte (7 dias).'}
                  </div>
                )
              })()}

              <Button onClick={handleGerar} disabled={gerando} className="w-full bg-[#1A3A5C]">
                {gerando ? (
                  <><div className="w-3 h-3 rounded-full border border-white/30 border-t-white animate-spin mr-2" /> Gerando...</>
                ) : (
                  <><School className="w-4 h-4 mr-1" /> Gerar Pedido Semanal</>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Resultado ── */}
      {resultado && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* v9.6: Aviso quando não encontrou cardápio */}
          {(resultado as any).aviso && (
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-2 text-sm text-amber-900">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold mb-1">Aviso</div>
                    <div className="text-xs">{(resultado as any).aviso}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="border-amber-200">
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Modo</div>
                <div className="text-base font-bold text-[#1A3A5C]">{resultado.modo === 'PREVISAO' ? 'Previsão' : 'Pedido'}</div>
              </CardContent>
            </Card>
            <Card className="border-amber-200">
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Escolas</div>
                <div className="text-base font-bold text-[#1A3A5C]">{resultado.totais.total_escolas}</div>
              </CardContent>
            </Card>
            <Card className="border-amber-200">
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Itens</div>
                <div className="text-base font-bold text-[#1A3A5C]">{resultado.totais.total_itens}</div>
              </CardContent>
            </Card>
            <Card className="border-amber-200">
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Total (kg)</div>
                <div className="text-base font-bold text-[#1A3A5C]">{resultado.totais.total_kg.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className="border-amber-200">
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Período</div>
                <div className="text-xs font-semibold text-[#1A3A5C]">
                  {resultado.periodo.data_inicio.split('-').reverse().join('/')} → {resultado.periodo.data_fim.split('-').reverse().join('/')}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resumo por categoria */}
          {resultado.por_categoria.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumo por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {resultado.por_categoria.map((c) => (
                    <div key={c.categoria} className="p-2 bg-gray-50 rounded text-center">
                      <div className="text-xs text-muted-foreground">{c.label.split(' ')[0]}</div>
                      <div className="text-sm font-bold">{c.itens} itens</div>
                      <div className="text-xs text-muted-foreground">{c.kg.toFixed(1)} kg</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ações */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar item..."
                value={searchItem}
                onChange={(e) => setSearchItem(e.target.value)}
                className="h-8 text-xs pl-7"
              />
            </div>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="h-8 text-xs w-[200px]"><SelectValue placeholder="Todas categorias" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {CATEGORIAS_LISTA.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORIA_LABELS[c]}</SelectItem>
                ))}
                <SelectItem value="OUTROS">Outros (não mapeados)</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportarCSV} className="h-8">
              <FileDown className="w-3 h-3 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportarXLSX} className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
              <FileDown className="w-3 h-3 mr-1" /> XLSX
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(true)} className="h-8 border-blue-200 text-blue-700 hover:bg-blue-50">
              <Save className="w-3 h-3 mr-1" /> Salvar
            </Button>
          </div>

          {/* Lista de itens agrupados por categoria */}
          {itensFiltrados.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Nenhum item encontrado para os filtros selecionados.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {CATEGORIAS_LISTA.map((cat) => {
                const itens = itensPorCategoria.get(cat)
                if (!itens || itens.length === 0) return null
                return (
                  <Card key={cat}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>{CATEGORIA_LABELS[cat]}</span>
                        <Badge variant="outline" className="text-[10px]">{itens.length} itens · {itens.reduce((s, i) => s + i.qtd_total_kg, 0).toFixed(1)} kg</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-muted-foreground border-b">
                              <th className="text-left p-2">Item</th>
                              <th className="text-right p-2 w-24">Qtd (kg)</th>
                              <th className="text-right p-2 w-24">Qtd (g)</th>
                              <th className="text-right p-2 w-28">Unidade Compra</th>
                              {resultado.modo === 'PREVISAO' && (
                                <th className="text-right p-2 w-32">Escolas</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {itens.map((it) => (
                              <tr key={`${cat}-${it.nome_canonico}`} className="border-b border-muted/30 hover:bg-muted/20">
                                <td className="p-2">
                                  <div className="font-medium">{it.nome_canonico}</div>
                                  {it.nome_canonico !== it.nome_original && (
                                    <div className="text-[10px] text-muted-foreground italic">orig: {it.nome_original}</div>
                                  )}
                                </td>
                                <td className="p-2 text-right font-mono">{it.qtd_total_kg.toFixed(2)}</td>
                                <td className="p-2 text-right font-mono text-muted-foreground">{it.qtd_total_gramas.toLocaleString('pt-BR')}</td>
                                <td className="p-2 text-right font-mono">
                                  {it.qtd_total_unidade.toFixed(2)} <span className="text-muted-foreground">{it.unidade}</span>
                                </td>
                                {resultado.modo === 'PREVISAO' && (
                                  <td className="p-2 text-right text-xs text-muted-foreground">
                                    {it.por_escola.length} escola{it.por_escola.length !== 1 ? 's' : ''}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              {/* Categoria OUTROS (não mapeados) */}
              {itensPorCategoria.has('OUTROS') && (
                <Card className="border-amber-300">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between text-amber-700">
                      <span>Outros (ingredientes não mapeados na lista canônica)</span>
                      <Badge variant="outline" className="text-[10px]">{itensPorCategoria.get('OUTROS')!.length} itens</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-muted-foreground mb-2">
                      Estes ingredientes não foram reconhecidos na lista canônica. Considere adicionar mapeamentos em <code>src/lib/lista-compras-utils.ts</code>.
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-muted-foreground border-b">
                            <th className="text-left p-2">Item (nome limpo)</th>
                            <th className="text-right p-2 w-24">Qtd (kg)</th>
                            <th className="text-right p-2 w-24">Qtd (g)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itensPorCategoria.get('OUTROS')!.map((it) => (
                            <tr key={`outros-${it.nome_canonico}`} className="border-b border-muted/30">
                              <td className="p-2">{it.nome_canonico}</td>
                              <td className="p-2 text-right font-mono">{it.qtd_total_kg.toFixed(2)}</td>
                              <td className="p-2 text-right font-mono text-muted-foreground">{it.qtd_total_gramas.toLocaleString('pt-BR')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Detalhamento por escola (somente modo PREVISAO) */}
          {resultado.modo === 'PREVISAO' && resultado.escolas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" /> Escolas Consideradas ({resultado.escolas.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {resultado.escolas.map((e) => (
                    <div key={e.id} className="p-2 bg-gray-50 rounded text-xs">
                      <div className="font-medium text-sm">{e.nome_curto}</div>
                      <div className="text-muted-foreground">
                        {e.categoria} · {e.rota} · {e.alunos_parcial} parc / {e.alunos_integral} int
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* ── Save Dialog ── */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Snapshot da Lista</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome da lista</Label>
              <Input
                value={saveNome}
                onChange={(e) => setSaveNome(e.target.value)}
                placeholder="Ex: Previsão Agosto 2026 - Todas as escolas"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              O snapshot será salvo com os itens e escolas atuais. Você poderá consultá-lo posteriormente.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} className="bg-[#1A3A5C]">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
