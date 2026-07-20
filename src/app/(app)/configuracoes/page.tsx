'use client'

import React, { useEffect, useState } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings, Plus, Edit2, Save, Trash2, School, Wheat, Package, X, ListOrdered } from 'lucide-react'
import { CATEGORIAS_ESCOLA, ROTAS, TIPOS_PAO } from '@/lib/unit-options'
import { DIAS_SEMANA, DIAS_LABEL_CURTO } from '@/lib/date-utils'
import { toast } from 'sonner'

interface Escola {
  id: string
  nome: string
  nome_curto: string
  categoria: string
  rota: string
  busca_propria: boolean
  recebe_pf: boolean
  recebe_pcq: boolean
  recebe_lanche: boolean
  ativo: boolean
  ordem_rota: number
  obs: string | null
  // v9.5.7: marca escolas que sempre usam a quantidade PADRÃO de pão francês
  // independente do cardápio da semana (útil para Outras Instituições como
  // Bombeiros, Ambulância, etc. que recebem PF toda semana).
  pao_fixo: boolean
  pf_quantidades: {
    id: string
    tipo_pao: string
    segunda: number
    terca: number
    quarta: number
    quinta: number
    sexta: number
  }[]
  pcq_quantidades: {
    id: string
    prod_segunda: number
    prod_quarta: number
    prod_sexta: number
    pf_comp_segunda: number
    pf_comp_quarta: number
    pf_comp_sexta: number
  }[]
}

export default function ConfiguracoesPage() {
  const [escolas, setEscolas] = useState<Escola[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editEscola, setEditEscola] = useState<Partial<Escola>>({})
  const [editPfId, setEditPfId] = useState<string | null>(null)
  const [editPfData, setEditPfData] = useState<Record<string, number>>({})
  const [editPcqId, setEditPcqId] = useState<string | null>(null)
  const [editPcqData, setEditPcqData] = useState<Record<string, number>>({})
  const [addTipoEscolaId, setAddTipoEscolaId] = useState<string | null>(null)
  const [addTipoPao, setAddTipoPao] = useState<string>('PROTEINA')
  const [editEscolaDialogOpen, setEditEscolaDialogOpen] = useState(false)
  const [editEscolaId, setEditEscolaId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/escolas')
      .then((r) => r.json())
      .then((data) => {
        setEscolas(Array.isArray(data) ? data : [])
        setLoading(false)
      })
  }, [])

  async function handleCreateEscola() {
    if (!editEscola.nome) return
    try {
      const res = await fetch('/api/escolas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editEscola),
      })
      if (res.ok) {
        toast.success('Escola criada!')
        setDialogOpen(false)
        setEditEscola({})
        const updated = await fetch('/api/escolas').then((r) => r.json())
        setEscolas(Array.isArray(updated) ? updated : [])
      }
    } catch {
      toast.error('Erro ao criar escola')
    }
  }

  async function handleSavePf() {
    if (!editPfId) return
    try {
      await fetch(`/api/escolas/pf/${editPfId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editPfData),
      })
      toast.success('Quantidades PF atualizadas!')
      setEditPfId(null)
      setEditPfData({})
      const updated = await fetch('/api/escolas').then((r) => r.json())
      setEscolas(Array.isArray(updated) ? updated : [])
    } catch {
      toast.error('Erro ao salvar')
    }
  }

  async function handleSavePcq() {
    if (!editPcqId) return
    try {
      await fetch(`/api/escolas/pcq/${editPcqId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editPcqData),
      })
      toast.success('Quantidades PCQ atualizadas!')
      setEditPcqId(null)
      setEditPcqData({})
      const updated = await fetch('/api/escolas').then((r) => r.json())
      setEscolas(Array.isArray(updated) ? updated : [])
    } catch {
      toast.error('Erro ao salvar')
    }
  }

  async function handleCreatePf(escolaId: string, tipoPao: string) {
    try {
      const res = await fetch('/api/escolas/pf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escola_id: escolaId, tipo_pao: tipoPao }),
      })
      if (res.ok) {
        toast.success(`Tipo ${TIPOS_PAO.find((t) => t.value === tipoPao)?.label || tipoPao} adicionado!`)
        setAddTipoEscolaId(null)
        const updated = await fetch('/api/escolas').then((r) => r.json())
        setEscolas(Array.isArray(updated) ? updated : [])
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erro ao adicionar tipo')
      }
    } catch {
      toast.error('Erro ao adicionar tipo de pão')
    }
  }

  async function handleDeletePf(id: string) {
    try {
      const res = await fetch(`/api/escolas/pf?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Tipo de pão removido!')
        const updated = await fetch('/api/escolas').then((r) => r.json())
        setEscolas(Array.isArray(updated) ? updated : [])
      }
    } catch {
      toast.error('Erro ao remover tipo de pão')
    }
  }

  async function handleUpdateEscola() {
    if (!editEscolaId || !editEscola.nome) return
    try {
      const res = await fetch('/api/escolas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editEscolaId, ...editEscola }),
      })
      if (res.ok) {
        toast.success('Escola atualizada!')
        setEditEscolaDialogOpen(false)
        setEditEscolaId(null)
        setEditEscola({})
        const updated = await fetch('/api/escolas').then((r) => r.json())
        setEscolas(Array.isArray(updated) ? updated : [])
      }
    } catch {
      toast.error('Erro ao atualizar escola')
    }
  }

  // v9.5.7: Renumerar TODAS as escolas com sequência GLOBAL.
  // Ordena APENAS por nome_curto (alfabético) — sem agrupar por rota.
  async function handleRenumerar() {
    const confirmado = window.confirm(
      'Renumerar TODAS as escolas automaticamente?\n\n' +
      'Cada escola receberá um número SEQUENCIAL GLOBAL (1, 2, 3, 4...) ' +
      'em ordem alfabética por nome curto. Você pode trocar os números ' +
      'livremente depois.\n\n' +
      'Isso substitui todos os números de Ordem atuais. Deseja continuar?'
    )
    if (!confirmado) return
    try {
      toast.loading('Renumerando escolas...', { id: 'renum' })
      // v9.5.7: ordena APENAS por nome_curto (sem agrupar por rota)
      const ordenada = [...escolas].sort((a, b) =>
        (a.nome_curto || '').localeCompare(b.nome_curto || '')
      )
      const updates = ordenada.map((e, idx) => ({
        id: e.id,
        ordem_rota: idx + 1,
        nome: e.nome,
        nome_curto: e.nome_curto,
        categoria: e.categoria,
        rota: e.rota,
        busca_propria: e.busca_propria,
        recebe_pf: e.recebe_pf,
        recebe_pcq: e.recebe_pcq,
        recebe_lanche: e.recebe_lanche,
        ativo: e.ativo,
        obs: e.obs,
        // v9.5.7: preserva pao_fixo ao renumerar
        pao_fixo: (e as any).pao_fixo === true,
      }))
      // Envia todas as atualizações em paralelo
      const results = await Promise.all(
        updates.map((u) =>
          fetch('/api/escolas', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(u),
          })
        )
      )
      const ok = results.every((r) => r.ok)
      if (ok) {
        toast.success(`${updates.length} escolas renumeradas!`, { id: 'renum' })
        const updated = await fetch('/api/escolas').then((r) => r.json())
        setEscolas(Array.isArray(updated) ? updated : [])
      } else {
        toast.error('Erro ao renumerar (algumas escolas falharam)', { id: 'renum' })
      }
    } catch {
      toast.error('Erro ao renumerar', { id: 'renum' })
    }
  }

  async function handleDeleteEscola(id: string) {
    const escola = escolas.find((e) => e.id === id)
    if (!escola) return
    const confirmado = window.confirm(
      `Tem certeza que deseja remover a escola "${escola.nome}"?\n\nEsta ação também removerá todas as quantidades de PF, PCQ e distribuições de lanche associadas.`
    )
    if (!confirmado) return
    try {
      const res = await fetch(`/api/escolas?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Escola removida!')
        setEscolas((prev) => prev.filter((e) => e.id !== id))
      }
    } catch {
      toast.error('Erro ao remover escola')
    }
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
          <h1 className="text-2xl font-bold text-[#1A3A5C]">Configurações</h1>
          <p className="text-sm text-muted-foreground">Gerenciar escolas e quantidades de PF/PCQ</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-[#1A3A5C] to-[#2C5282]">
              <Plus className="w-4 h-4 mr-1" /> Nova Escola
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Escola</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome Completo</Label>
                <Input value={editEscola.nome || ''} onChange={(e) => setEditEscola((prev) => ({ ...prev, nome: e.target.value }))} />
              </div>
              <div>
                <Label>Nome Curto</Label>
                <Input value={editEscola.nome_curto || ''} onChange={(e) => setEditEscola((prev) => ({ ...prev, nome_curto: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Select value={editEscola.categoria || 'REGULAR'} onValueChange={(v) => setEditEscola((prev) => ({ ...prev, categoria: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_ESCOLA.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Rota</Label>
                  <Select value={editEscola.rota || 'JOSE'} onValueChange={(v) => setEditEscola((prev) => ({ ...prev, rota: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROTAS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Ordem na Rota</Label>
                <Input type="number" value={editEscola.ordem_rota || 0} onChange={(e) => setEditEscola((prev) => ({ ...prev, ordem_rota: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editEscola.recebe_pf !== false} onChange={(e) => setEditEscola((prev) => ({ ...prev, recebe_pf: e.target.checked }))} />
                  Recebe PF
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editEscola.recebe_pcq !== false} onChange={(e) => setEditEscola((prev) => ({ ...prev, recebe_pcq: e.target.checked }))} />
                  Recebe PCQ
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editEscola.recebe_lanche !== false} onChange={(e) => setEditEscola((prev) => ({ ...prev, recebe_lanche: e.target.checked }))} />
                  Recebe Lanche
                </label>
              </div>
              {/* v9.5.7: Pão fixo — sempre usar quantidade padrão, independente do cardápio da semana */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editEscola.pao_fixo === true}
                    onChange={(e) => setEditEscola((prev) => ({ ...prev, pao_fixo: e.target.checked }))}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium text-amber-900">Sempre usar quantidade padrão de Pão Francês</div>
                    <div className="text-xs text-amber-700 mt-0.5">
                      Marque para Outras Instituições (Bombeiros, Ambulância, etc.) que recebem PF toda semana,
                      mesmo quando o cardápio escolar da semana não tem pão. A produção sempre puxará a quantidade
                      cadastrada como PADRÃO.
                    </div>
                  </div>
                </label>
              </div>
              <Button onClick={handleCreateEscola} className="w-full bg-[#1A3A5C]">Criar Escola</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={editEscolaDialogOpen} onOpenChange={(open) => { setEditEscolaDialogOpen(open); if (!open) { setEditEscolaId(null); setEditEscola({}) } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Escola</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome Completo</Label>
                <Input value={editEscola.nome || ''} onChange={(e) => setEditEscola((prev) => ({ ...prev, nome: e.target.value }))} />
              </div>
              <div>
                <Label>Nome Curto</Label>
                <Input value={editEscola.nome_curto || ''} onChange={(e) => setEditEscola((prev) => ({ ...prev, nome_curto: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Select value={editEscola.categoria || 'REGULAR'} onValueChange={(v) => setEditEscola((prev) => ({ ...prev, categoria: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_ESCOLA.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Rota</Label>
                  <Select value={editEscola.rota || 'JOSE'} onValueChange={(v) => setEditEscola((prev) => ({ ...prev, rota: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROTAS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Ordem na Rota</Label>
                <Input type="number" value={editEscola.ordem_rota || 0} onChange={(e) => setEditEscola((prev) => ({ ...prev, ordem_rota: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editEscola.recebe_pf !== false} onChange={(e) => setEditEscola((prev) => ({ ...prev, recebe_pf: e.target.checked }))} />
                  Recebe PF
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editEscola.recebe_pcq !== false} onChange={(e) => setEditEscola((prev) => ({ ...prev, recebe_pcq: e.target.checked }))} />
                  Recebe PCQ
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editEscola.recebe_lanche !== false} onChange={(e) => setEditEscola((prev) => ({ ...prev, recebe_lanche: e.target.checked }))} />
                  Recebe Lanche
                </label>
              </div>
              {/* v9.5.7: Pão fixo — sempre usar quantidade padrão, independente do cardápio da semana */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editEscola.pao_fixo === true}
                    onChange={(e) => setEditEscola((prev) => ({ ...prev, pao_fixo: e.target.checked }))}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium text-amber-900">Sempre usar quantidade padrão de Pão Francês</div>
                    <div className="text-xs text-amber-700 mt-0.5">
                      Marque para Outras Instituições (Bombeiros, Ambulância, etc.) que recebem PF toda semana,
                      mesmo quando o cardápio escolar da semana não tem pão. A produção sempre puxará a quantidade
                      cadastrada como PADRÃO.
                    </div>
                  </div>
                </label>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editEscola.ativo !== false} onChange={(e) => setEditEscola((prev) => ({ ...prev, ativo: e.target.checked }))} />
                  Escola ativa
                </label>
              </div>
              <Button onClick={handleUpdateEscola} className="w-full bg-[#1A3A5C]">Salvar Alterações</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="escolas">
        <TabsList className="bg-amber-50/50">
          <TabsTrigger value="escolas" className="data-[state=active]:bg-[#1A3A5C] data-[state=active]:text-white">
            <School className="w-3 h-3 mr-1" /> Escolas
          </TabsTrigger>
          <TabsTrigger value="pf" className="data-[state=active]:bg-[#1A3A5C] data-[state=active]:text-white">
            <Wheat className="w-3 h-3 mr-1" /> PF
          </TabsTrigger>
          <TabsTrigger value="pcq" className="data-[state=active]:bg-[#1A3A5C] data-[state=active]:text-white">
            <Package className="w-3 h-3 mr-1" /> PCQ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="escolas" className="mt-4">
          {/* v9.5.4: Botão para renumerar todas as escolas automaticamente */}
          <div className="flex items-center justify-between mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm">
              <p className="font-medium text-blue-900">Ordenação Sequencial Global</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Cada escola recebe um número único (1, 2, 3, 4...) <strong>independente do motorista</strong>.
                A produção respeita a sequência dos números — não agrupa por rota.
              </p>
            </div>
            <Button onClick={handleRenumerar} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100">
              <ListOrdered className="w-4 h-4 mr-1" /> Renumerar
            </Button>
          </div>
          <div className="space-y-2">
            {escolas.map((escola) => (
              <motion.div key={escola.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1A3A5C] to-[#2C5282] flex items-center justify-center">
                      <School className="w-5 h-5 text-[#D4A017]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[#1A3A5C]">{escola.nome}</span>
                        <Badge variant="outline" className="text-[10px]">{escola.categoria}</Badge>
                        <Badge variant="outline" className="text-[10px]">{ROTAS.find((r) => r.value === escola.rota)?.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {escola.nome_curto} · Ordem: {escola.ordem_rota}
                        {escola.recebe_pf ? ' · PF' : ''}
                        {escola.recebe_pcq ? ' · PCQ' : ''}
                        {escola.recebe_lanche ? ' · Lanche' : ''}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditEscolaId(escola.id)
                        setEditEscola({
                          nome: escola.nome,
                          nome_curto: escola.nome_curto,
                          categoria: escola.categoria,
                          rota: escola.rota,
                          busca_propria: escola.busca_propria,
                          recebe_pf: escola.recebe_pf,
                          recebe_pcq: escola.recebe_pcq,
                          recebe_lanche: escola.recebe_lanche,
                          ativo: escola.ativo,
                          ordem_rota: escola.ordem_rota,
                          obs: escola.obs,
                          // v9.5.7: carrega pao_fixo para o checkbox
                          pao_fixo: (escola as any).pao_fixo === true,
                        })
                        setEditEscolaDialogOpen(true)
                      }}
                      className="text-amber-500 hover:bg-amber-50"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteEscola(escola.id)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pf" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wheat className="w-5 h-5 text-amber-500" /> Quantidades PF por Escola
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left p-2 text-xs font-medium text-muted-foreground">Escola</th>
                      <th className="text-center p-2 text-xs font-medium text-muted-foreground">Tipo</th>
                      {DIAS_SEMANA.map((d) => (
                        <th key={d} className="text-center p-2 text-xs font-medium text-muted-foreground">{DIAS_LABEL_CURTO[d]}</th>
                      ))}
                      <th className="text-center p-2 text-xs font-medium text-muted-foreground">Total</th>
                      <th className="p-2"></th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {escolas.filter((e) => e.recebe_pf).map((escola) => {
                      const existingTipos = new Set(escola.pf_quantidades.map((q) => q.tipo_pao))
                      const missingTipos = TIPOS_PAO.filter((t) => !existingTipos.has(t.value))

                      return (
                        <React.Fragment key={escola.id}>
                          {escola.pf_quantidades.map((pfQ, idx) => {
                            const isEditing = editPfId === pfQ.id
                            const total = DIAS_SEMANA.reduce(
                              (s, d) => s + (isEditing ? (editPfData[d] || 0) : pfQ[d as keyof typeof pfQ] as number),
                              0
                            )

                            return (
                              <tr key={pfQ.id} className="border-b border-muted/30">
                                <td className="p-2 font-medium">{idx === 0 ? escola.nome_curto : ''}</td>
                                <td className="p-2 text-center">
                                  <Badge variant="outline" className="text-[10px]">
                                    {TIPOS_PAO.find((t) => t.value === pfQ.tipo_pao)?.label || pfQ.tipo_pao}
                                  </Badge>
                                </td>
                                {DIAS_SEMANA.map((dia) => (
                                  <td key={dia} className="p-1 text-center">
                                    {isEditing ? (
                                      <Input
                                        type="number"
                                        min={0}
                                        value={editPfData[dia] || 0}
                                        onChange={(e) =>
                                          setEditPfData((prev) => ({
                                            ...prev,
                                            [dia]: parseInt(e.target.value) || 0,
                                          }))
                                        }
                                        className="h-7 w-16 text-center text-sm mx-auto"
                                      />
                                    ) : (
                                      <span className="font-mono">{pfQ[dia as keyof typeof pfQ] as number}</span>
                                    )}
                                  </td>
                                ))}
                                <td className="p-2 text-center font-bold font-mono">{total.toLocaleString('pt-BR')}</td>
                                <td className="p-2">
                                  {isEditing ? (
                                    <div className="flex gap-1">
                                      <Button size="sm" onClick={handleSavePf} className="h-7 bg-[#1A3A5C]">
                                        <Save className="w-3 h-3" />
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => { setEditPfId(null); setEditPfData({}) }} className="h-7">
                                        <X className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button size="sm" variant="ghost" onClick={() => {
                                      setEditPfId(pfQ.id)
                                      setEditPfData({
                                        segunda: pfQ.segunda,
                                        terca: pfQ.terca,
                                        quarta: pfQ.quarta,
                                        quinta: pfQ.quinta,
                                        sexta: pfQ.sexta,
                                      })
                                    }} className="h-7">
                                      <Edit2 className="w-3 h-3" />
                                    </Button>
                                  )}
                                </td>
                                <td className="p-2">
                                  {pfQ.tipo_pao !== 'PADRAO' && !isEditing && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeletePf(pfQ.id)}
                                      className="h-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                          {addTipoEscolaId === escola.id ? (
                            <tr className="border-b border-dashed border-amber-300 bg-amber-50/50">
                              <td className="p-2" />
                              <td className="p-2 text-center">
                                <Select value={addTipoPao} onValueChange={setAddTipoPao}>
                                  <SelectTrigger className="h-7 w-28 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {missingTipos.map((t) => (
                                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              {DIAS_SEMANA.map((d) => (
                                <td key={d} className="p-1 text-center text-muted-foreground">0</td>
                              ))}
                              <td className="p-2 text-center font-mono text-muted-foreground">0</td>
                              <td className="p-2">
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    onClick={() => handleCreatePf(escola.id, addTipoPao)}
                                    className="h-7 bg-[#1A3A5C]"
                                  >
                                    <Save className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setAddTipoEscolaId(null)}
                                    className="h-7"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              </td>
                              <td className="p-2" />
                            </tr>
                          ) : missingTipos.length > 0 ? (
                            <tr className="border-b border-dashed border-muted/20">
                              <td colSpan={DIAS_SEMANA.length + 5} className="p-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setAddTipoEscolaId(escola.id)
                                    setAddTipoPao(missingTipos[0].value)
                                  }}
                                  className="h-6 text-xs text-amber-600 hover:text-amber-700"
                                >
                                  <Plus className="w-3 h-3 mr-1" /> Novo Tipo de Pão
                                </Button>
                              </td>
                            </tr>
                          ) : null}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pcq" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5 text-orange-500" /> Quantidades PCQ por Escola
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left p-2 text-xs font-medium text-muted-foreground">Escola</th>
                      <th className="text-center p-2 text-xs font-medium text-muted-foreground">Prod Seg</th>
                      <th className="text-center p-2 text-xs font-medium text-muted-foreground">Prod Qua</th>
                      <th className="text-center p-2 text-xs font-medium text-muted-foreground">Prod Sex</th>
                      <th className="text-center p-2 text-xs font-medium text-muted-foreground">Comp Seg</th>
                      <th className="text-center p-2 text-xs font-medium text-muted-foreground">Comp Qua</th>
                      <th className="text-center p-2 text-xs font-medium text-muted-foreground">Comp Sex</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {escolas.filter((e) => e.recebe_pcq).map((escola) => {
                      const pcqQ = escola.pcq_quantidades[0]
                      if (!pcqQ) return null

                      const isEditing = editPcqId === pcqQ.id
                      const fields = ['prod_segunda', 'prod_quarta', 'prod_sexta', 'pf_comp_segunda', 'pf_comp_quarta', 'pf_comp_sexta']

                      return (
                        <tr key={pcqQ.id} className="border-b border-muted/30">
                          <td className="p-2 font-medium">{escola.nome_curto}</td>
                          {fields.map((field) => (
                            <td key={field} className="p-1 text-center">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  min={0}
                                  value={editPcqData[field] || 0}
                                  onChange={(e) =>
                                    setEditPcqData((prev) => ({
                                      ...prev,
                                      [field]: parseInt(e.target.value) || 0,
                                    }))
                                  }
                                  className="h-7 w-16 text-center text-sm mx-auto"
                                />
                              ) : (
                                <span className="font-mono">{pcqQ[field as keyof typeof pcqQ] as number}</span>
                              )}
                            </td>
                          ))}
                          <td className="p-2">
                            {isEditing ? (
                              <div className="flex gap-1">
                                <Button size="sm" onClick={handleSavePcq} className="h-7 bg-[#1A3A5C]">
                                  <Save className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => { setEditPcqId(null); setEditPcqData({}) }} className="h-7">
                                  ✕
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => {
                                setEditPcqId(pcqQ.id)
                                setEditPcqData({
                                  prod_segunda: pcqQ.prod_segunda,
                                  prod_quarta: pcqQ.prod_quarta,
                                  prod_sexta: pcqQ.prod_sexta,
                                  pf_comp_segunda: pcqQ.pf_comp_segunda,
                                  pf_comp_quarta: pcqQ.pf_comp_quarta,
                                  pf_comp_sexta: pcqQ.pf_comp_sexta,
                                })
                              }} className="h-7">
                                <Edit2 className="w-3 h-3" />
                              </Button>
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
