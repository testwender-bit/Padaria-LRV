'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
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
import { Plus, TrendingUp, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'

interface Movimentacao {
  id: string
  insumo_id: string
  tipo: string
  quantidade: number
  preco_unitario: number
  preco_total: number
  data: string
  obs: string | null
  insumo: { id: string; nome: string; unidade: string }
}

interface Insumo {
  id: string
  nome: string
  unidade: string
  preco_unitario: number
}

export default function MovimentacoesPage() {
  const [movs, setMovs] = useState<Movimentacao[]>([])
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editMov, setEditMov] = useState<Partial<Movimentacao> & { insumo_id?: string }>({})

  useEffect(() => {
    Promise.all([
      fetch('/api/movimentacoes').then((r) => r.json()),
      fetch('/api/insumos').then((r) => r.json()),
    ]).then(([m, i]) => {
      setMovs(Array.isArray(m) ? m : [])
      setInsumos(Array.isArray(i) ? i : [])
      setLoading(false)
    })
  }, [])

  async function handleCreate() {
    if (!editMov.insumo_id || !editMov.tipo) return
    try {
      const quantidade = editMov.quantidade || 0
      const precoUnit = editMov.preco_unitario || 0
      const res = await fetch('/api/movimentacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editMov,
          preco_total: quantidade * precoUnit,
          data: editMov.data || new Date().toISOString().split('T')[0],
        }),
      })
      if (res.ok) {
        toast.success('Movimentação registrada!')
        setDialogOpen(false)
        setEditMov({})
        const updated = await fetch('/api/movimentacoes').then((r) => r.json())
        setMovs(Array.isArray(updated) ? updated : [])
      }
    } catch {
      toast.error('Erro ao registrar movimentação')
    }
  }

  const formatBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

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
          <h1 className="text-2xl font-bold text-[#1A3A5C]">Movimentações</h1>
          <p className="text-sm text-muted-foreground">Registro de entradas e saídas de estoque</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-[#1A3A5C] to-[#2C5282]">
              <Plus className="w-4 h-4 mr-1" /> Nova Movimentação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Movimentação</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tipo</Label>
                <Select value={editMov.tipo || 'ENTRADA'} onValueChange={(v) => setEditMov((p) => ({ ...p, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENTRADA">Entrada</SelectItem>
                    <SelectItem value="SAIDA">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Insumo</Label>
                <Select value={editMov.insumo_id || ''} onValueChange={(v) => {
                  const insumo = insumos.find((i) => i.id === v)
                  setEditMov((p) => ({ ...p, insumo_id: v, preco_unitario: insumo?.preco_unitario || 0 }))
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {insumos.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantidade</Label>
                  <Input type="number" step="0.1" value={editMov.quantidade || 0} onChange={(e) => setEditMov((p) => ({ ...p, quantidade: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label>Preço Unitário</Label>
                  <Input type="number" step="0.01" value={editMov.preco_unitario || 0} onChange={(e) => setEditMov((p) => ({ ...p, preco_unitario: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={editMov.data || new Date().toISOString().split('T')[0]} onChange={(e) => setEditMov((p) => ({ ...p, data: e.target.value }))} />
              </div>
              <div>
                <Label>Observação</Label>
                <Input value={editMov.obs || ''} onChange={(e) => setEditMov((p) => ({ ...p, obs: e.target.value }))} />
              </div>
              <Button onClick={handleCreate} className="w-full bg-[#1A3A5C]">Registrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto custom-scrollbar">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr>
                  <th className="text-left p-2 text-xs font-medium text-muted-foreground">Data</th>
                  <th className="text-center p-2 text-xs font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left p-2 text-xs font-medium text-muted-foreground">Insumo</th>
                  <th className="text-right p-2 text-xs font-medium text-muted-foreground">Qtd</th>
                  <th className="text-right p-2 text-xs font-medium text-muted-foreground">Preço Unit.</th>
                  <th className="text-right p-2 text-xs font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {movs.map((mov) => (
                  <tr key={mov.id} className="border-b border-muted/30 hover:bg-muted/20">
                    <td className="p-2">{new Date(mov.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="p-2 text-center">
                      {mov.tipo === 'ENTRADA' ? (
                        <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs">
                          <TrendingUp className="w-3 h-3" /> Entrada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded text-xs">
                          <TrendingDown className="w-3 h-3" /> Saída
                        </span>
                      )}
                    </td>
                    <td className="p-2 font-medium">{mov.insumo.nome}</td>
                    <td className="p-2 text-right font-mono">{mov.quantidade} {mov.insumo.unidade}</td>
                    <td className="p-2 text-right font-mono">{formatBRL(mov.preco_unitario)}</td>
                    <td className="p-2 text-right font-mono font-semibold">{formatBRL(mov.preco_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
