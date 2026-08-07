'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, BarChart3, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface Receita {
  id: string
  produto_tipo: string
  insumo_id: string
  quantidade_por_unidade: number
  lanche_id: string | null
  insumo: { id: string; nome: string; unidade: string; preco_unitario: number }
  lanche?: { id: string; nome: string } | null
}

interface Insumo {
  id: string
  nome: string
  unidade: string
  preco_unitario: number
}

interface Lanche {
  id: string
  nome: string
  unidade: string
  ativo: boolean
}

export default function ReceitasPage() {
  const [receitas, setReceitas] = useState<Receita[]>([])
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [lanches, setLanches] = useState<Lanche[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editReceita, setEditReceita] = useState<Partial<Receita>>({})

  const PRODUTOS = [
    { value: 'PF', label: 'Pão Francês' },
    { value: 'PCQ', label: 'Pão de Cachorro Quente' },
    { value: 'LANCHE', label: 'Lanche' },
  ]

  useEffect(() => {
    Promise.all([
      fetch('/api/receitas').then((r) => r.json()),
      fetch('/api/insumos').then((r) => r.json()),
      fetch('/api/lanches').then((r) => r.json()),
    ]).then(([r, i, l]) => {
      setReceitas(Array.isArray(r) ? r : [])
      setInsumos(Array.isArray(i) ? i : [])
      setLanches(Array.isArray(l) ? l : [])
      setLoading(false)
    })
  }, [])

  async function handleCreate() {
    if (!editReceita.produto_tipo || !editReceita.insumo_id) return
    try {
      const res = await fetch('/api/receitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editReceita,
          lanche_id: editReceita.produto_tipo === 'LANCHE' ? (editReceita.lanche_id || null) : null,
        }),
      })
      if (res.ok) {
        toast.success('Receita salva!')
        setDialogOpen(false)
        setEditReceita({})
        const updated = await fetch('/api/receitas').then((r) => r.json())
        setReceitas(Array.isArray(updated) ? updated : [])
      }
    } catch {
      toast.error('Erro ao salvar receita')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta receita?')) return
    try {
      const res = await fetch(`/api/receitas?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Receita excluída')
        const updated = await fetch('/api/receitas').then((r) => r.json())
        setReceitas(Array.isArray(updated) ? updated : [])
      }
    } catch {
      toast.error('Erro ao excluir')
    }
  }

  const formatBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  // v9.7: agrupar por produto_tipo + lanche
  const grouped = receitas.reduce((acc, r) => {
    const key = r.lanche_id ? `${r.produto_tipo}__${r.lanche_id}` : r.produto_tipo
    if (!acc[key]) acc[key] = { tipo: r.produto_tipo, lanche: r.lanche, items: [] }
    acc[key].items.push(r)
    return acc
  }, {} as Record<string, { tipo: string; lanche?: { id: string; nome: string } | null; items: Receita[] }>)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3A5C]">Receitas</h1>
          <p className="text-sm text-muted-foreground">Composição de insumos por unidade de produto</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-[#1A3A5C] to-[#2C5282]">
              <Plus className="w-4 h-4 mr-1" /> Nova Receita
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Receita</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Produto</Label>
                <Select value={editReceita.produto_tipo || ''} onValueChange={(v) => setEditReceita((p) => ({ ...p, produto_tipo: v, lanche_id: undefined }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                  <SelectContent>
                    {PRODUTOS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* v9.7: Seletor de lanche específico quando produto = LANCHE */}
              {editReceita.produto_tipo === 'LANCHE' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Label className="text-xs">Lanche Específico (opcional)</Label>
                  <Select
                    value={editReceita.lanche_id || '_generic'}
                    onValueChange={(v) => setEditReceita((p) => ({ ...p, lanche_id: v === '_generic' ? null : v }))}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_generic">Genérico (todos os lanches — fallback)</SelectItem>
                      {lanches.filter(l => l.ativo).map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Selecione um lanche específico para ter uma receita com ingredientes diferentes.
                    &quot;Genérico&quot; é usado como fallback quando não há receita específica.
                  </p>
                </div>
              )}

              <div>
                <Label>Insumo</Label>
                <Select value={editReceita.insumo_id || ''} onValueChange={(v) => setEditReceita((p) => ({ ...p, insumo_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione o insumo" /></SelectTrigger>
                  <SelectContent>
                    {insumos.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.nome} ({i.unidade})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantidade por Unidade</Label>
                <Input type="number" step="0.001" value={editReceita.quantidade_por_unidade || 0} onChange={(e) => setEditReceita((p) => ({ ...p, quantidade_por_unidade: parseFloat(e.target.value) || 0 }))} />
              </div>
              <Button onClick={handleCreate} className="w-full bg-[#1A3A5C]">Salvar Receita</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info banner */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
        💡 <strong>Receitas de Lanche:</strong> você pode cadastrar uma receita &quot;Genérica&quot; (fallback para todos os lanches)
        e/ou receitas específicas por lanche. O sistema usa a receita específica quando disponível, e cai na genérica como fallback.
      </div>

      {Object.keys(grouped).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhuma receita cadastrada</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([key, group]) => {
          const tipoLabel = PRODUTOS.find((p) => p.value === group.tipo)?.label || group.tipo
          const titulo = group.lanche ? `${tipoLabel} — ${group.lanche.nome}` : (group.tipo === 'LANCHE' ? `${tipoLabel} — Genérica` : tipoLabel)
          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{titulo}</span>
                  {group.lanche && <Badge className="text-[10px] bg-blue-100 text-blue-800">Específica</Badge>}
                  {group.tipo === 'LANCHE' && !group.lanche && <Badge variant="outline" className="text-[10px]">Fallback</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left p-2 text-xs font-medium text-muted-foreground">Insumo</th>
                      <th className="text-center p-2 text-xs font-medium text-muted-foreground">Qtd/Unidade</th>
                      <th className="text-right p-2 text-xs font-medium text-muted-foreground">Custo/Unidade</th>
                      <th className="text-center p-2 text-xs font-medium text-muted-foreground"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((r) => (
                      <tr key={r.id} className="border-b border-muted/30">
                        <td className="p-2 font-medium">{r.insumo.nome} ({r.insumo.unidade})</td>
                        <td className="p-2 text-center font-mono">{r.quantidade_por_unidade}</td>
                        <td className="p-2 text-right font-mono">
                          {formatBRL(r.quantidade_por_unidade * r.insumo.preco_unitario)}
                        </td>
                        <td className="p-2 text-center">
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)} className="h-7 w-7 p-0">
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 font-bold">
                      <td className="p-2">Custo Total por Unidade</td>
                      <td></td>
                      <td className="p-2 text-right font-mono">
                        {formatBRL(group.items.reduce((s, r) => s + r.quantidade_por_unidade * r.insumo.preco_unitario, 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
