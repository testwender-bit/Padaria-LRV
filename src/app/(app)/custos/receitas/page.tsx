'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'

interface Receita {
  id: string
  produto_tipo: string
  insumo_id: string
  quantidade_por_unidade: number
  insumo: { id: string; nome: string; unidade: string; preco_unitario: number }
}

interface Insumo {
  id: string
  nome: string
  unidade: string
  preco_unitario: number
}

export default function ReceitasPage() {
  const [receitas, setReceitas] = useState<Receita[]>([])
  const [insumos, setInsumos] = useState<Insumo[]>([])
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
    ]).then(([r, i]) => {
      setReceitas(Array.isArray(r) ? r : [])
      setInsumos(Array.isArray(i) ? i : [])
      setLoading(false)
    })
  }, [])

  async function handleCreate() {
    if (!editReceita.produto_tipo || !editReceita.insumo_id) return
    try {
      const res = await fetch('/api/receitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editReceita),
      })
      if (res.ok) {
        toast.success('Receita criada!')
        setDialogOpen(false)
        setEditReceita({})
        const updated = await fetch('/api/receitas').then((r) => r.json())
        setReceitas(Array.isArray(updated) ? updated : [])
      }
    } catch {
      toast.error('Erro ao criar receita')
    }
  }

  const formatBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  const grouped = receitas.reduce((acc, r) => {
    if (!acc[r.produto_tipo]) acc[r.produto_tipo] = []
    acc[r.produto_tipo].push(r)
    return acc
  }, {} as Record<string, Receita[]>)

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
                <Select value={editReceita.produto_tipo || ''} onValueChange={(v) => setEditReceita((p) => ({ ...p, produto_tipo: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                  <SelectContent>
                    {PRODUTOS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              <Button onClick={handleCreate} className="w-full bg-[#1A3A5C]">Criar Receita</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhuma receita cadastrada</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([tipo, items]) => (
          <Card key={tipo}>
            <CardHeader>
              <CardTitle className="text-lg">
                {PRODUTOS.find((p) => p.value === tipo)?.label || tipo}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Insumo</th>
                    <th className="text-center p-2 text-xs font-medium text-muted-foreground">Qtd/Unidade</th>
                    <th className="text-right p-2 text-xs font-medium text-muted-foreground">Custo/Unidade</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} className="border-b border-muted/30">
                      <td className="p-2 font-medium">{r.insumo.nome} ({r.insumo.unidade})</td>
                      <td className="p-2 text-center font-mono">{r.quantidade_por_unidade}</td>
                      <td className="p-2 text-right font-mono">
                        {formatBRL(r.quantidade_por_unidade * r.insumo.preco_unitario)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 font-bold">
                    <td className="p-2">Custo Total por Unidade</td>
                    <td></td>
                    <td className="p-2 text-right font-mono">
                      {formatBRL(items.reduce((s, r) => s + r.quantidade_por_unidade * r.insumo.preco_unitario, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
