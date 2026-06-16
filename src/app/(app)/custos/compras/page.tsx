'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ShoppingCart,
  Plus,
  Package,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
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

interface ItemPedido {
  id: string
  pedido_id: string
  insumo_id: string
  quantidade: number
  preco_unitario: number
  preco_total: number
  recebido: boolean
  insumo: { id: string; nome: string; unidade: string; preco_unitario: number; estoque_atual: number; estoque_minimo: number }
}

interface PedidoCompra {
  id: string
  fornecedor: string
  data_pedido: string
  data_prevista: string | null
  status: string
  obs: string | null
  criado_em: string
  itens: ItemPedido[]
}

// ── Helpers ────────────────────────────────────────────────

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const formatDate = (d: string) => {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  PENDENTE: {
    label: 'Pendente',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    icon: <Clock className="w-3 h-3" />,
  },
  EM_ANDAMENTO: {
    label: 'Em Andamento',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    icon: <Truck className="w-3 h-3" />,
  },
  RECEBIDO: {
    label: 'Recebido',
    color: 'text-green-700',
    bg: 'bg-green-50 border-green-200',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  CANCELADO: {
    label: 'Cancelado',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
    icon: <XCircle className="w-3 h-3" />,
  },
}

interface FormItem {
  insumo_id: string
  quantidade: number
  preco_unitario: number
}

// ── Component ──────────────────────────────────────────────

export default function ComprasPage() {
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([])
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [lowStock, setLowStock] = useState<Insumo[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedPedido, setSelectedPedido] = useState<PedidoCompra | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Form states
  const [formFornecedor, setFormFornecedor] = useState('')
  const [formDataPrevista, setFormDataPrevista] = useState('')
  const [formObs, setFormObs] = useState('')
  const [formItens, setFormItens] = useState<FormItem[]>([{ insumo_id: '', quantidade: 0, preco_unitario: 0 }])
  const [saving, setSaving] = useState(false)

  // ── Data fetching ───────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [comprasRes, insumosRes] = await Promise.all([
        fetch('/api/compras').then((r) => r.json()),
        fetch('/api/insumos').then((r) => r.json()),
      ])

      const pedidosData = Array.isArray(comprasRes.pedidos) ? comprasRes.pedidos : []
      const lowStockData = Array.isArray(comprasRes.lowStock) ? comprasRes.lowStock : []
      const insumosData = Array.isArray(insumosRes) ? insumosRes : []

      setPedidos(pedidosData)
      setLowStock(lowStockData)
      setInsumos(insumosData)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Form helpers ────────────────────────────────────────

  const addItem = () => {
    setFormItens([...formItens, { insumo_id: '', quantidade: 0, preco_unitario: 0 }])
  }

  const removeItem = (index: number) => {
    if (formItens.length <= 1) return
    setFormItens(formItens.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof FormItem, value: string | number) => {
    const updated = [...formItens]
    updated[index] = { ...updated[index], [field]: value }

    if (field === 'insumo_id' && typeof value === 'string') {
      const insumo = insumos.find((i) => i.id === value)
      if (insumo) {
        updated[index].preco_unitario = insumo.preco_unitario
      }
    }

    if (field === 'quantidade' || field === 'preco_unitario') {
      // recalc nothing here, the total is computed on the fly
    }

    setFormItens(updated)
  }

  const resetForm = () => {
    setFormFornecedor('')
    setFormDataPrevista('')
    setFormObs('')
    setFormItens([{ insumo_id: '', quantidade: 0, preco_unitario: 0 }])
  }

  const handleCreate = async () => {
    if (!formFornecedor.trim()) {
      toast.error('Informe o fornecedor')
      return
    }
    const validItens = formItens.filter((i) => i.insumo_id && i.quantidade > 0)
    if (validItens.length === 0) {
      toast.error('Adicione ao menos um item com quantidade')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fornecedor: formFornecedor.trim(),
          data_prevista: formDataPrevista || null,
          obs: formObs.trim() || null,
          itens: validItens.map((i) => ({
            insumo_id: i.insumo_id,
            quantidade: i.quantidade,
            preco_unitario: i.preco_unitario,
          })),
        }),
      })

      if (res.ok) {
        toast.success('Pedido de compra criado!')
        setCreateOpen(false)
        resetForm()
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erro ao criar pedido')
      }
    } catch {
      toast.error('Erro ao criar pedido')
    } finally {
      setSaving(false)
    }
  }

  // ── Actions ─────────────────────────────────────────────

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch('/api/compras', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      })
      if (res.ok) {
        toast.success(`Status atualizado para ${STATUS_CONFIG[newStatus]?.label || newStatus}`)
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erro ao atualizar status')
      }
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  const handleReceber = async (id: string) => {
    try {
      const res = await fetch('/api/compras', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'receber' }),
      })
      if (res.ok) {
        toast.success('Pedido recebido! Estoque atualizado.')
        setDetailOpen(false)
        setSelectedPedido(null)
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erro ao receber pedido')
      }
    } catch {
      toast.error('Erro ao receber pedido')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/compras?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Pedido excluído')
        setDetailOpen(false)
        setSelectedPedido(null)
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erro ao excluir pedido')
      }
    } catch {
      toast.error('Erro ao excluir pedido')
    }
  }

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openDetail = (pedido: PedidoCompra) => {
    setSelectedPedido(pedido)
    setDetailOpen(true)
  }

  const quickCreateFromLowStock = (insumo: Insumo) => {
    setFormFornecedor(insumo.fornecedor || '')
    setFormItens([{ insumo_id: insumo.id, quantidade: insumo.estoque_minimo - insumo.estoque_atual, preco_unitario: insumo.preco_unitario }])
    setCreateOpen(true)
  }

  // ── KPIs ────────────────────────────────────────────────

  const pedidosPendentes = pedidos.filter((p) => p.status === 'PENDENTE' || p.status === 'EM_ANDAMENTO')
  const valorTotalPedidos = pedidos.reduce((s, p) => s + p.itens.reduce((si, i) => si + i.preco_total, 0), 0)
  const totalPendentes = pedidosPendentes.length
  const totalAbaixoMinimo = lowStock.length

  // ── Loading ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3A5C]">Compras</h1>
          <p className="text-sm text-muted-foreground">Gestão de pedidos de compra de insumos</p>
        </div>
        <Button
          onClick={() => {
            resetForm()
            setCreateOpen(true)
          }}
          className="bg-gradient-to-r from-[#1A3A5C] to-[#2C5282]"
        >
          <Plus className="w-4 h-4 mr-1" /> Novo Pedido
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-amber-600">Pedidos Pendentes</p>
                <p className="text-xl font-bold text-amber-900">{totalPendentes}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-emerald-600">Valor Total em Pedidos</p>
                <p className="text-xl font-bold text-emerald-900">{formatBRL(valorTotalPedidos)}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className={totalAbaixoMinimo > 0 ? 'border-red-200 bg-gradient-to-br from-red-50 to-white' : 'border-green-200 bg-gradient-to-br from-green-50 to-white'}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={totalAbaixoMinimo > 0 ? 'w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center' : 'w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center'}>
                <AlertTriangle className={totalAbaixoMinimo > 0 ? 'w-5 h-5 text-red-600' : 'w-5 h-5 text-green-600'} />
              </div>
              <div>
                <p className={totalAbaixoMinimo > 0 ? 'text-xs text-red-600' : 'text-xs text-green-600'}>Abaixo do Mínimo</p>
                <p className={totalAbaixoMinimo > 0 ? 'text-xl font-bold text-red-900' : 'text-xl font-bold text-green-900'}>{totalAbaixoMinimo}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Low Stock Alerts */}
      <AnimatePresence>
        {lowStock.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-red-200 bg-gradient-to-br from-red-50/80 to-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-red-800">
                  <AlertTriangle className="w-4 h-4" /> Alertas de Estoque Baixo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto custom-scrollbar">
                  {lowStock.map((insumo) => (
                    <motion.div
                      key={insumo.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white border border-red-100 shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#1A3A5C] truncate">{insumo.nome}</p>
                        <p className="text-xs text-red-600">
                          {insumo.estoque_atual} / {insumo.estoque_minimo} {insumo.unidade}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 h-7"
                        onClick={() => quickCreateFromLowStock(insumo)}
                      >
                        <ShoppingCart className="w-3 h-3 mr-1" /> Pedir
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchase Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#1A3A5C]" /> Pedidos de Compra
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pedidos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <ShoppingCart className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">Nenhum pedido de compra cadastrado</p>
              <p className="text-sm text-muted-foreground/60">Clique em &quot;Novo Pedido&quot; para começar</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[55vh] overflow-y-auto custom-scrollbar">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background z-10">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Data</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Fornecedor</th>
                    <th className="text-center p-3 text-xs font-medium text-muted-foreground">Itens</th>
                    <th className="text-right p-3 text-xs font-medium text-muted-foreground">Valor Total</th>
                    <th className="text-center p-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-center p-3 text-xs font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map((pedido) => {
                    const valorTotal = pedido.itens.reduce((s, i) => s + i.preco_total, 0)
                    const isExpanded = expandedRows.has(pedido.id)
                    const statusCfg = STATUS_CONFIG[pedido.status] || STATUS_CONFIG.PENDENTE

                    return (
                      <motion.tr
                        key={pedido.id}
                        className="border-b border-muted/30 hover:bg-muted/20 cursor-pointer"
                        onClick={() => toggleRow(pedido.id)}
                        layout
                      >
                        <td className="p-3">{formatDate(pedido.data_pedido)}</td>
                        <td className="p-3 font-medium">{pedido.fornecedor}</td>
                        <td className="p-3 text-center">{pedido.itens.length}</td>
                        <td className="p-3 text-right font-mono font-semibold">{formatBRL(valorTotal)}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${statusCfg.bg} ${statusCfg.color}`}>
                            {statusCfg.icon} {statusCfg.label}
                          </span>
                        </td>
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {pedido.status === 'PENDENTE' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                                onClick={() => handleStatusChange(pedido.id, 'EM_ANDAMENTO')}
                              >
                                <Truck className="w-3 h-3 mr-1" /> Andamento
                              </Button>
                            )}
                            {(pedido.status === 'PENDENTE' || pedido.status === 'EM_ANDAMENTO') && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50"
                                onClick={() => handleReceber(pedido.id)}
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" /> Receber
                              </Button>
                            )}
                            {(pedido.status === 'PENDENTE' || pedido.status === 'EM_ANDAMENTO') && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50"
                                onClick={() => handleStatusChange(pedido.id, 'CANCELADO')}
                              >
                                <XCircle className="w-3 h-3" />
                              </Button>
                            )}
                            {pedido.status !== 'RECEBIDO' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-muted-foreground hover:text-red-600"
                                onClick={() => handleDelete(pedido.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => toggleRow(pedido.id)}
                            >
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Expanded details */}
              <AnimatePresence>
                {expandedRows.size > 0 && (
                  <div className="border-t">
                    {pedidos
                      .filter((p) => expandedRows.has(p.id))
                      .map((pedido) => (
                        <motion.div
                          key={`detail-${pedido.id}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-muted/10 px-4 py-3"
                        >
                          <div className="flex flex-wrap gap-4 mb-3 text-xs text-muted-foreground">
                            <span>Pedido: <strong className="text-[#1A3A5C]">{pedido.id.slice(-8).toUpperCase()}</strong></span>
                            {pedido.data_prevista && <span>Previsão: <strong>{formatDate(pedido.data_prevista)}</strong></span>}
                            {pedido.obs && <span>Obs: <strong>{pedido.obs}</strong></span>}
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr>
                                <th className="text-left p-2 text-xs font-medium text-muted-foreground">Insumo</th>
                                <th className="text-center p-2 text-xs font-medium text-muted-foreground">Qtd</th>
                                <th className="text-right p-2 text-xs font-medium text-muted-foreground">Preço Unit.</th>
                                <th className="text-right p-2 text-xs font-medium text-muted-foreground">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pedido.itens.map((item) => (
                                <tr key={item.id} className="border-b border-muted/20">
                                  <td className="p-2">{item.insumo.nome} ({item.insumo.unidade})</td>
                                  <td className="p-2 text-center font-mono">{item.quantidade}</td>
                                  <td className="p-2 text-right font-mono">{formatBRL(item.preco_unitario)}</td>
                                  <td className="p-2 text-right font-mono font-semibold">{formatBRL(item.preco_total)}</td>
                                </tr>
                              ))}
                              <tr className="font-bold">
                                <td className="p-2" colSpan={3}>Total do Pedido</td>
                                <td className="p-2 text-right font-mono">
                                  {formatBRL(pedido.itens.reduce((s, i) => s + i.preco_total, 0))}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </motion.div>
                      ))}
                  </div>
                )}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Pedido Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#1A3A5C]">Novo Pedido de Compra</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Fornecedor *</Label>
                <Input
                  value={formFornecedor}
                  onChange={(e) => setFormFornecedor(e.target.value)}
                  placeholder="Nome do fornecedor"
                />
              </div>
              <div>
                <Label>Data Prevista</Label>
                <Input
                  type="date"
                  value={formDataPrevista}
                  onChange={(e) => setFormDataPrevista(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Observação</Label>
              <Input
                value={formObs}
                onChange={(e) => setFormObs(e.target.value)}
                placeholder="Observações do pedido"
              />
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Itens do Pedido</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addItem}
                  className="h-7 text-xs border-[#1A3A5C] text-[#1A3A5C]"
                >
                  <Plus className="w-3 h-3 mr-1" /> Adicionar Item
                </Button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {formItens.map((item, index) => {
                  const selectedInsumo = insumos.find((i) => i.id === item.insumo_id)
                  const itemTotal = item.quantidade * item.preco_unitario

                  return (
                    <div key={index} className="flex items-end gap-2 p-3 rounded-lg bg-muted/30 border border-muted/50">
                      <div className="flex-1 min-w-0">
                        <Label className="text-xs text-muted-foreground">Insumo</Label>
                        <Select
                          value={item.insumo_id}
                          onValueChange={(v) => updateItem(index, 'insumo_id', v)}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {insumos.map((i) => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.nome} ({i.unidade})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-20">
                        <Label className="text-xs text-muted-foreground">Qtd</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          value={item.quantidade || ''}
                          onChange={(e) => updateItem(index, 'quantidade', parseFloat(e.target.value) || 0)}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="w-28">
                        <Label className="text-xs text-muted-foreground">Preço Unit.</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.preco_unitario || ''}
                          onChange={(e) => updateItem(index, 'preco_unitario', parseFloat(e.target.value) || 0)}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="w-24 text-right">
                        <Label className="text-xs text-muted-foreground">Total</Label>
                        <p className="h-9 flex items-center justify-end text-sm font-mono font-semibold text-[#1A3A5C]">
                          {formatBRL(itemTotal)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-red-600"
                        onClick={() => removeItem(index)}
                        disabled={formItens.length <= 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )
                })}
              </div>

              {/* Form total */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#1A3A5C] text-white">
                <span className="font-semibold text-sm">Total do Pedido</span>
                <span className="font-mono font-bold text-lg">
                  {formatBRL(formItens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0))}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-[#1A3A5C] to-[#2C5282]"
                onClick={handleCreate}
                disabled={saving}
              >
                {saving ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin mr-2" />
                ) : (
                  <ShoppingCart className="w-4 h-4 mr-1" />
                )}
                Criar Pedido
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#1A3A5C]">Detalhes do Pedido</DialogTitle>
          </DialogHeader>
          {selectedPedido && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Fornecedor</span>
                  <p className="font-medium">{selectedPedido.fornecedor}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Data do Pedido</span>
                  <p className="font-medium">{formatDate(selectedPedido.data_pedido)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Data Prevista</span>
                  <p className="font-medium">{selectedPedido.data_prevista ? formatDate(selectedPedido.data_prevista) : '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Status</span>
                  <p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${STATUS_CONFIG[selectedPedido.status]?.bg || ''} ${STATUS_CONFIG[selectedPedido.status]?.color || ''}`}>
                      {STATUS_CONFIG[selectedPedido.status]?.icon} {STATUS_CONFIG[selectedPedido.status]?.label}
                    </span>
                  </p>
                </div>
              </div>

              {selectedPedido.obs && (
                <div className="text-sm">
                  <span className="text-muted-foreground text-xs">Observação</span>
                  <p>{selectedPedido.obs}</p>
                </div>
              )}

              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Insumo</th>
                    <th className="text-center p-2 text-xs font-medium text-muted-foreground">Qtd</th>
                    <th className="text-right p-2 text-xs font-medium text-muted-foreground">Unit.</th>
                    <th className="text-right p-2 text-xs font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPedido.itens.map((item) => (
                    <tr key={item.id} className="border-b border-muted/20">
                      <td className="p-2">{item.insumo.nome} ({item.insumo.unidade})</td>
                      <td className="p-2 text-center font-mono">{item.quantidade}</td>
                      <td className="p-2 text-right font-mono">{formatBRL(item.preco_unitario)}</td>
                      <td className="p-2 text-right font-mono font-semibold">{formatBRL(item.preco_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex items-center justify-between p-3 rounded-lg bg-[#1A3A5C] text-white">
                <span className="font-bold text-sm">Total</span>
                <span className="font-mono font-bold">
                  {formatBRL(selectedPedido.itens.reduce((s, i) => s + i.preco_total, 0))}
                </span>
              </div>

              <div className="flex gap-2">
                {(selectedPedido.status === 'PENDENTE' || selectedPedido.status === 'EM_ANDAMENTO') && (
                  <Button
                    className="flex-1 bg-gradient-to-r from-green-600 to-green-700"
                    onClick={() => handleReceber(selectedPedido.id)}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Receber Pedido
                  </Button>
                )}
                {selectedPedido.status !== 'RECEBIDO' && selectedPedido.status !== 'CANCELADO' && (
                  <Button
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => handleStatusChange(selectedPedido.id, 'CANCELADO')}
                  >
                    <XCircle className="w-4 h-4 mr-1" /> Cancelar
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
