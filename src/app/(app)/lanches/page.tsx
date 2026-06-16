'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Cookie, Plus, Edit2, Save } from 'lucide-react'
// BUG FIX 5: Import UNIDADES_LANCHE from unit-options, DIAS_SEMANA from date-utils
import { UNIDADES_LANCHE } from '@/lib/unit-options'
import { DIAS_SEMANA, DIAS_LABEL_CURTO } from '@/lib/date-utils'
import { toast } from 'sonner'

interface Lanche {
  id: string
  nome: string
  unidade: string
  ativo: boolean
  obs: string | null
  distribuicao: {
    id: string
    escola_id: string
    lanche_id: string
    dia_semana: string
    quantidade: number
    escola: { id: string; nome: string; nome_curto: string; categoria: string }
  }[]
}

interface Escola {
  id: string
  nome: string
  nome_curto: string
  categoria: string
  recebe_lanche: boolean
}

export default function LanchesPage() {
  const [lanches, setLanches] = useState<Lanche[]>([])
  const [escolas, setEscolas] = useState<Escola[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editLanche, setEditLanche] = useState<Partial<Lanche> | null>(null)
  const [editingLanche, setEditingLanche] = useState<Lanche | null>(null)
  const [editDistLanche, setEditDistLanche] = useState<string | null>(null)
  const [distData, setDistData] = useState<Record<string, Record<string, number>>>({})

  useEffect(() => {
    Promise.all([
      fetch('/api/lanches').then((r) => r.json()),
      fetch('/api/escolas').then((r) => r.json()),
    ]).then(([l, e]) => {
      setLanches(Array.isArray(l) ? l : [])
      setEscolas(Array.isArray(e) ? e.filter((es: Escola) => es.recebe_lanche) : [])
      setLoading(false)
    })
  }, [])

  async function handleCreate() {
    if (!editLanche?.nome) return
    try {
      const res = await fetch('/api/lanches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editLanche),
      })
      if (res.ok) {
        toast.success('Lanche criado!')
        setDialogOpen(false)
        setEditLanche(null)
        const updated = await fetch('/api/lanches').then((r) => r.json())
        setLanches(Array.isArray(updated) ? updated : [])
      }
    } catch {
      toast.error('Erro ao criar lanche')
    }
  }

  async function handleEdit() {
    if (!editingLanche || !editLanche?.nome) return
    try {
      const res = await fetch('/api/lanches', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingLanche.id,
          nome: editLanche.nome,
          unidade: editLanche.unidade,
          ativo: editLanche.ativo,
          obs: editLanche.obs,
        }),
      })
      if (res.ok) {
        toast.success('Lanche atualizado!')
        setEditingLanche(null)
        setEditLanche(null)
        const updated = await fetch('/api/lanches').then((r) => r.json())
        setLanches(Array.isArray(updated) ? updated : [])
      }
    } catch {
      toast.error('Erro ao atualizar lanche')
    }
  }

  async function handleSaveDistribuicao() {
    if (!editDistLanche) return
    try {
      const lancheId = editDistLanche
      const currentLanche = lanches.find(l => l.id === lancheId)
      const items: { lanche_id: string; escola_id: string; dia_semana: string; quantidade: number }[] = []

      for (const [escolaId, dias] of Object.entries(distData)) {
        for (const [diaSemana, quantidade] of Object.entries(dias)) {
          const existing = currentLanche?.distribuicao.find(
            d => d.escola_id === escolaId && d.dia_semana === diaSemana
          )
          // Only include if changed or new
          if (!existing || existing.quantidade !== quantidade) {
            items.push({
              lanche_id: lancheId,
              escola_id: escolaId,
              dia_semana: diaSemana,
              quantidade,
            })
          }
        }
      }

      if (items.length === 0) {
        toast.info('Nenhuma alteração para salvar')
        setEditDistLanche(null)
        setDistData({})
        return
      }

      const res = await fetch('/api/lanches/distribuicao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items),
      })

      if (res.ok) {
        toast.success(`${items.length} alteração${items.length > 1 ? 'ões' : ''} salva${items.length > 1 ? 's' : ''}!`)
        setEditDistLanche(null)
        setDistData({})
        const updated = await fetch('/api/lanches').then((r) => r.json())
        setLanches(Array.isArray(updated) ? updated : [])
      } else {
        toast.error('Erro ao salvar distribuição')
      }
    } catch {
      toast.error('Erro ao salvar distribuição')
    }
  }

  function startEditDist(lanche: Lanche) {
    setEditDistLanche(lanche.id)
    const distMap: Record<string, Record<string, number>> = {}
    for (const escola of escolas) {
      distMap[escola.id] = {}
      for (const dia of DIAS_SEMANA) {
        const existing = lanche.distribuicao.find(
          (d) => d.escola_id === escola.id && d.dia_semana === dia
        )
        distMap[escola.id][dia] = existing?.quantidade || 0
      }
    }
    setDistData(distMap)
  }

  function startEditLanche(lanche: Lanche) {
    setEditingLanche(lanche)
    setEditLanche({
      nome: lanche.nome,
      unidade: lanche.unidade,
      ativo: lanche.ativo,
      obs: lanche.obs,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3A5C]">Lanches</h1>
          <p className="text-sm text-muted-foreground">Cadastro de lanches e distribuição por escola/dia</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-[#1A3A5C] to-[#2C5282]">
              <Plus className="w-4 h-4 mr-1" /> Novo Lanche
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Lanche</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input
                  value={editLanche?.nome || ''}
                  onChange={(e) => setEditLanche((prev) => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Biscoito Maizena"
                />
              </div>
              <div>
                <Label>Unidade</Label>
                <Select
                  value={editLanche?.unidade || 'un'}
                  onValueChange={(v) => setEditLanche((prev) => ({ ...prev, unidade: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES_LANCHE.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} className="w-full bg-[#1A3A5C]">Criar Lanche</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Lanche Dialog */}
      <Dialog open={!!editingLanche} onOpenChange={() => { setEditingLanche(null); setEditLanche(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Lanche</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={editLanche?.nome || ''}
                onChange={(e) => setEditLanche((prev) => ({ ...prev, nome: e.target.value }))}
              />
            </div>
            <div>
              <Label>Unidade</Label>
              <Select
                value={editLanche?.unidade || 'un'}
                onValueChange={(v) => setEditLanche((prev) => ({ ...prev, unidade: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDADES_LANCHE.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editLanche?.ativo !== false}
                onChange={(e) => setEditLanche((prev) => ({ ...prev, ativo: e.target.checked }))}
                className="rounded"
              />
              <Label>Ativo</Label>
            </div>
            <Button onClick={handleEdit} className="w-full bg-[#1A3A5C]">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {editDistLanche && (
        <Card className="border-pink-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-pink-900">
              Editar Distribuição
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveDistribuicao} className="bg-[#1A3A5C]">
                <Save className="w-4 h-4 mr-1" /> Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditDistLanche(null); setDistData({}) }}>
                Cancelar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Escola</th>
                    {DIAS_SEMANA.map((d) => (
                      <th key={d} className="text-center p-2 text-xs font-medium text-muted-foreground">{DIAS_LABEL_CURTO[d]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {escolas.map((escola) => (
                    <tr key={escola.id} className="border-b border-muted/30">
                      <td className="p-2 font-medium text-sm">{escola.nome_curto}</td>
                      {DIAS_SEMANA.map((dia) => (
                        <td key={dia} className="p-1 text-center">
                          <Input
                            type="number"
                            min={0}
                            value={distData[escola.id]?.[dia] || 0}
                            onChange={(e) =>
                              setDistData((prev) => ({
                                ...prev,
                                [escola.id]: {
                                  ...prev[escola.id],
                                  [dia]: parseInt(e.target.value) || 0,
                                },
                              }))
                            }
                            className="h-7 w-16 text-center text-sm mx-auto"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lanches.map((lanche) => (
          <motion.div
            key={lanche.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-pink-100 hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-pink-900 flex items-center gap-2">
                    <Cookie className="w-4 h-4" /> {lanche.nome}
                  </CardTitle>
                  <Badge variant={lanche.ativo ? 'default' : 'secondary'} className="text-[10px]">
                    {lanche.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Unidade: {lanche.unidade}</p>
                {lanche.distribuicao.length > 0 && (
                  <div className="text-xs text-muted-foreground mb-3">
                    {lanche.distribuicao.length} entradas de distribuição
                  </div>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEditDist(lanche)} className="text-xs">
                    <Edit2 className="w-3 h-3 mr-1" /> Distribuição
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => startEditLanche(lanche)} className="text-xs">
                    <Edit2 className="w-3 h-3 mr-1" /> Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
