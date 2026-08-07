'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Package, Plus, Pencil, Trash2, AlertTriangle, Search, RefreshCw, Power,
} from 'lucide-react'
import { toast } from 'sonner'
import { UNIDADES_INSUMO } from '@/lib/unit-options'

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

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const formatQty = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)

export default function GerenciarInsumosPage() {
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showInativos, setShowInativos] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<Insumo>>({})
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/insumos?inativos=true')
      const data = await res.json()
      setInsumos(Array.isArray(data) ? data : [])
    } catch {
      setInsumos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function openCreate() {
    setEditingId(null)
    setForm({ unidade: 'kg', ativo: true, preco_unitario: 0, estoque_atual: 0, estoque_minimo: 0 })
    setDialogOpen(true)
  }

  function openEdit(insumo: Insumo) {
    setEditingId(insumo.id)
    setForm({ ...insumo })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.nome || !form.nome.trim()) {
      toast.error('Nome é obrigatório')
      return
    }
    setSaving(true)
    try {
      const url = editingId ? `/api/insumos/${editingId}` : '/api/insumos'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        toast.success(editingId ? 'Insumo atualizado!' : 'Insumo criado!')
        setDialogOpen(false)
        setForm({})
        setEditingId(null)
        loadData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erro ao salvar')
      }
    } catch {
      toast.error('Erro ao salvar insumo')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleAtivo(insumo: Insumo) {
    try {
      const res = await fetch(`/api/insumos/${insumo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !insumo.ativo }),
      })
      if (res.ok) {
        toast.success(insumo.ativo ? 'Insumo desativado' : 'Insumo reativado')
        loadData()
      }
    } catch {
      toast.error('Erro ao alterar status')
    }
  }

  async function handleDelete(force: boolean) {
    if (!deleteId) return
    setDeleting(true)
    try {
      const url = `/api/insumos/${deleteId}${force ? '?force=true' : ''}`
      const res = await fetch(url, { method: 'DELETE' })
      if (res.ok) {
        toast.success(force ? 'Insumo excluído permanentemente' : 'Insumo desativado')
        setDeleteId(null)
        loadData()
      }
    } catch {
      toast.error('Erro ao excluir')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = insumos
    .filter((i) => showInativos || i.ativo)
    .filter((i) => !search || i.nome.toLowerCase().includes(search.toLowerCase()))

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3A5C]">Gerenciar Insumos</h1>
          <p className="text-sm text-muted-foreground">
            Cadastro de insumos — {insumos.filter(i => i.ativo).length} ativos · {insumos.filter(i => !i.ativo).length} inativos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-3 h-3 mr-1" /> Atualizar
          </Button>
          <Button onClick={openCreate} className="bg-gradient-to-r from-[#1A3A5C] to-[#2C5282]">
            <Plus className="w-4 h-4 mr-1" /> Novo Insumo
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar insumo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs pl-7"
          />
        </div>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={showInativos}
            onChange={(e) => setShowInativos(e.target.checked)}
          />
          Mostrar inativos
        </label>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-[#1A3A5C]" />
              Insumos Cadastrados ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Package className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">
                  {search ? 'Nenhum insumo encontrado' : 'Nenhum insumo cadastrado'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[55vh] overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background z-10 border-b">
                    <tr>
                      <th className="text-left p-2 text-xs font-medium text-muted-foreground">Nome</th>
                      <th className="text-center p-2 text-xs font-medium text-muted-foreground">Un.</th>
                      <th className="text-right p-2 text-xs font-medium text-muted-foreground">Preço Unit.</th>
                      <th className="text-right p-2 text-xs font-medium text-muted-foreground">Estoque</th>
                      <th className="text-right p-2 text-xs font-medium text-muted-foreground">Mínimo</th>
                      <th className="text-left p-2 text-xs font-medium text-muted-foreground">Fornecedor</th>
                      <th className="text-center p-2 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="text-center p-2 text-xs font-medium text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((insumo) => (
                      <tr key={insumo.id} className={`border-b border-muted/30 hover:bg-muted/20 ${!insumo.ativo ? 'opacity-50' : ''}`}>
                        <td className="p-2 font-medium">{insumo.nome}</td>
                        <td className="p-2 text-center text-xs">{insumo.unidade}</td>
                        <td className="p-2 text-right font-mono">{formatBRL(insumo.preco_unitario)}</td>
                        <td className="p-2 text-right font-mono">
                          {formatQty(insumo.estoque_atual)}
                          {insumo.estoque_atual < insumo.estoque_minimo && insumo.ativo && (
                            <AlertTriangle className="w-3 h-3 text-amber-500 inline ml-1" />
                          )}
                        </td>
                        <td className="p-2 text-right font-mono text-muted-foreground">{formatQty(insumo.estoque_minimo)}</td>
                        <td className="p-2 text-xs text-muted-foreground">{insumo.fornecedor || '—'}</td>
                        <td className="p-2 text-center">
                          {insumo.ativo ? (
                            <Badge className="text-[10px] bg-green-100 text-green-800">Ativo</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">Inativo</Badge>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(insumo)} className="h-7 w-7 p-0">
                              <Pencil className="w-3 h-3 text-amber-500" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleToggleAtivo(insumo)} className="h-7 w-7 p-0" title={insumo.ativo ? 'Desativar' : 'Reativar'}>
                              <Power className={`w-3 h-3 ${insumo.ativo ? 'text-red-400' : 'text-green-500'}`} />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleteId(insumo.id)} className="h-7 w-7 p-0">
                              <Trash2 className="w-3 h-3 text-red-400" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Dialog: Create/Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Insumo' : 'Novo Insumo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={form.nome || ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Farinha de Trigo" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Unidade</Label>
                <Select value={form.unidade || 'kg'} onValueChange={(v) => setForm({ ...form, unidade: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES_INSUMO.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Preço Unitário (R$)</Label>
                <Input type="number" step="0.01" value={form.preco_unitario || 0} onChange={(e) => setForm({ ...form, preco_unitario: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Estoque Atual</Label>
                <Input type="number" step="0.1" value={form.estoque_atual || 0} onChange={(e) => setForm({ ...form, estoque_atual: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label className="text-xs">Estoque Mínimo</Label>
                <Input type="number" step="0.1" value={form.estoque_minimo || 0} onChange={(e) => setForm({ ...form, estoque_minimo: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Fornecedor</Label>
              <Input value={form.fornecedor || ''} onChange={(e) => setForm({ ...form, fornecedor: e.target.value || null })} placeholder="Ex: Moinho Central" />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.ativo !== false}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              />
              <Label className="text-xs cursor-pointer">Ativo</Label>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full bg-[#1A3A5C]">
              {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar Insumo'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Insumo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Escolha como excluir este insumo:
            </p>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled={deleting}
                onClick={() => handleDelete(false)}
              >
                <Power className="w-4 h-4 mr-2 text-amber-500" />
                <div className="text-left">
                  <div className="font-medium">Desativar (recomendado)</div>
                  <div className="text-xs text-muted-foreground">Marca como inativo. Preserva histórico de movimentações e contagens.</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start border-red-200 text-red-700 hover:bg-red-50"
                disabled={deleting}
                onClick={() => handleDelete(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                <div className="text-left">
                  <div className="font-medium">Excluir permanentemente</div>
                  <div className="text-xs text-muted-foreground">Remove o insumo e TODAS as movimentações/contagens associadas. Irreversível.</div>
                </div>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
