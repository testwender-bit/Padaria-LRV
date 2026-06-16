'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ClipboardCheck,
  Save,
  Eraser,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Calendar,
  History,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────

interface Insumo {
  id: string
  nome: string
  unidade: string
  preco_unitario: number
  estoque_atual: number
  estoque_minimo: number
  fornecedor: string | null
  ativo: boolean
}

interface ContagemItem {
  insumo_id: string
  insumo_nome: string
  insumo_unidade: string
  estoque_sistema: number
  quantidade: number
  diferenca: number
}

interface HistoricoItem {
  data: string
  total_itens: number
  total_diferenca: number
  itens_com_desvio: number
  itens: {
    insumo_nome: string
    insumo_unidade: string
    quantidade: number
    estoque_sistema: number
    diferenca: number
  }[]
}

interface ContagemResponse {
  data: string | null
  contagens: {
    id: string
    insumo_id: string
    insumo_nome: string
    insumo_unidade: string
    estoque_sistema: number
    quantidade: number
    diferenca: number
    obs: string | null
    criado_em: string
  }[]
  historico: HistoricoItem[]
}

// ── Helpers ────────────────────────────────────────────────

const formatQty = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)

const formatDate = (d: string) => {
  if (!d) return '—'
  return d.split('-').reverse().join('/')
}

// ── Component ──────────────────────────────────────────────

export default function ContagemPage() {
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [historico, setHistorico] = useState<HistoricoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dataContagem, setDataContagem] = useState(() => new Date().toISOString().split('T')[0])
  const [expandedHistorico, setExpandedHistorico] = useState<string | null>(null)

  // Editable counts: insumo_id → quantidade informada
  const [contagens, setContagens] = useState<Map<string, number>>(new Map())

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [insumosRes, contagemRes] = await Promise.all([
        fetch('/api/insumos').then((r) => r.json()),
        fetch('/api/contagem').then((r) => r.json()),
      ])

      const insumosData = Array.isArray(insumosRes) ? insumosRes : []
      setInsumos(insumosData)

      if (contagemRes && !contagemRes.error) {
        setHistorico(contagemRes.historico || [])
      }
    } catch (err) {
      console.error('Erro:', err)
      setError('Erro ao carregar dados. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleContagemChange = (insumoId: string, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value) || 0
    setContagens((prev) => {
      const next = new Map(prev)
      next.set(insumoId, numValue)
      return next
    })
  }

  const handleSave = async () => {
    const itens = insumos
      .filter((i) => contagens.has(i.id) && contagens.get(i.id)! > 0)
      .map((i) => ({
        insumo_id: i.id,
        quantidade: contagens.get(i.id)!,
      }))

    if (itens.length === 0) {
      toast.error('Preencha ao menos uma contagem antes de salvar.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/contagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_contagem: dataContagem,
          itens,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(`Contagem salva! ${data.count} itens registrados.`)
        // Reload data
        loadData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erro ao salvar contagem')
      }
    } catch {
      toast.error('Erro ao salvar contagem')
    } finally {
      setSaving(false)
    }
  }

  const handleLimpar = () => {
    setContagens(new Map())
  }

  // ── Loading ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
          <span className="text-muted-foreground">Carregando insumos...</span>
        </div>
      </div>
    )
  }

  // ── Error ───────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
          <p className="text-red-600 font-medium">{error}</p>
          <Button variant="outline" onClick={loadData}>
            Tentar Novamente
          </Button>
        </div>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3A5C]">Contagem Física de Estoque</h1>
          <p className="text-sm text-muted-foreground">Registre a contagem física e compare com o estoque do sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Data</Label>
          <Input
            type="date"
            value={dataContagem}
            onChange={(e) => setDataContagem(e.target.value)}
            className="w-40 h-9 text-sm"
          />
        </div>
      </div>

      {/* Main Counting Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-[#1A3A5C]" />
              Inserir Contagem
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[55vh] overflow-y-auto custom-scrollbar">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background z-10 border-b">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground min-w-[150px]">Insumo</th>
                    <th className="text-center p-3 text-xs font-medium text-muted-foreground w-16">Un.</th>
                    <th className="text-right p-3 text-xs font-medium text-muted-foreground w-28">Estoque Sistema</th>
                    <th className="text-center p-3 text-xs font-medium text-muted-foreground w-32">Contagem Física</th>
                    <th className="text-right p-3 text-xs font-medium text-muted-foreground w-24">Diferença</th>
                    <th className="text-right p-3 text-xs font-medium text-muted-foreground w-24">% Desvio</th>
                  </tr>
                </thead>
                <tbody>
                  {insumos.map((insumo) => {
                    const qtdFisica = contagens.get(insumo.id) || 0
                    const diferenca = insumo.estoque_atual - qtdFisica
                    const desvioPct = insumo.estoque_atual > 0
                      ? (diferenca / insumo.estoque_atual) * 100
                      : qtdFisica > 0 ? -100 : 0
                    const hasContagem = contagens.has(insumo.id) && qtdFisica > 0

                    return (
                      <tr key={insumo.id} className="border-b border-muted/30 hover:bg-muted/10">
                        <td className="p-3 font-medium text-[#1A3A5C]">{insumo.nome}</td>
                        <td className="p-3 text-center text-muted-foreground text-xs">{insumo.unidade}</td>
                        <td className="p-3 text-right font-mono">{formatQty(insumo.estoque_atual)}</td>
                        <td className="p-3 text-center">
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="—"
                            value={contagens.has(insumo.id) ? qtdFisica : ''}
                            onChange={(e) => handleContagemChange(insumo.id, e.target.value)}
                            className="h-8 text-sm text-center font-mono w-28 mx-auto"
                          />
                        </td>
                        <td className="p-3 text-right font-mono">
                          {hasContagem ? (
                            <span className={diferenca === 0 ? 'text-green-700' : diferenca > 0 ? 'text-blue-700' : 'text-red-700'}>
                              {diferenca > 0 ? '+' : ''}{formatQty(diferenca)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {hasContagem && insumo.estoque_atual > 0 ? (
                            <span className={
                              Math.abs(desvioPct) > 10 ? 'text-red-700 font-semibold' :
                              Math.abs(desvioPct) > 5 ? 'text-amber-700' :
                              'text-green-700'
                            }>
                              {desvioPct > 0 ? '+' : ''}{desvioPct.toFixed(1)}%
                            </span>
                          ) : hasContagem && qtdFisica > 0 && insumo.estoque_atual === 0 ? (
                            <span className="text-red-700 font-semibold">-100%</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button
          className="bg-gradient-to-r from-[#1A3A5C] to-[#2C5282]"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-1" />
          )}
          Salvar Contagem
        </Button>
        <Button variant="outline" onClick={handleLimpar}>
          <Eraser className="w-4 h-4 mr-1" />
          Limpar
        </Button>
      </div>

      {/* Historical section */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="w-5 h-5 text-[#1A3A5C]" />
              Histórico de Contagens
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historico.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <ClipboardCheck className="w-10 h-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma contagem registrada</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                {historico.map((h) => {
                  const isExpanded = expandedHistorico === h.data
                  return (
                    <div key={h.data} className="border rounded-lg overflow-hidden">
                      <div
                        className="flex items-center justify-between p-3 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => setExpandedHistorico(isExpanded ? null : h.data)}
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-[#1A3A5C]">{formatDate(h.data)}</span>
                          <Badge variant="outline" className="text-[10px]">{h.total_itens} itens</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          {h.itens_com_desvio > 0 && (
                            <span className="text-amber-600">
                              <AlertTriangle className="w-3 h-3 inline mr-0.5" />
                              {h.itens_com_desvio} desvios
                            </span>
                          )}
                          <span className={h.total_diferenca < 0 ? 'text-red-600' : h.total_diferenca > 0 ? 'text-green-600' : 'text-muted-foreground'}>
                            Diferença: {h.total_diferenca > 0 ? '+' : ''}{formatQty(h.total_diferenca)}
                          </span>
                        </div>
                      </div>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="p-3 border-t">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr>
                                    <th className="text-left p-2 text-[10px] font-medium text-muted-foreground">Insumo</th>
                                    <th className="text-right p-2 text-[10px] font-medium text-muted-foreground">Sistema</th>
                                    <th className="text-right p-2 text-[10px] font-medium text-muted-foreground">Físico</th>
                                    <th className="text-right p-2 text-[10px] font-medium text-muted-foreground">Diferença</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {h.itens.map((item, idx) => (
                                    <tr key={idx} className="border-b border-muted/20">
                                      <td className="p-2">{item.insumo_nome} ({item.insumo_unidade})</td>
                                      <td className="p-2 text-right font-mono">{formatQty(item.estoque_sistema)}</td>
                                      <td className="p-2 text-right font-mono">{formatQty(item.quantidade)}</td>
                                      <td className={`p-2 text-right font-mono ${item.diferenca < 0 ? 'text-red-600' : item.diferenca > 0 ? 'text-green-600' : ''}`}>
                                        {item.diferenca > 0 ? '+' : ''}{formatQty(item.diferenca)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
