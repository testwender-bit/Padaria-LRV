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
import { CalendarOff, Plus, Trash2, AlertTriangle, Edit2, Save } from 'lucide-react'
import { TIPOS_FERIADO, ACOES_FERIADO, ESCOLAS_AFETADAS } from '@/lib/unit-options'
import { toast } from 'sonner'

interface Feriado {
  id: string
  data: string
  nome: string
  tipo: string
  escolas_afetadas: string
  acao: string
  obs: string | null
}

export default function FeriadosPage() {
  const [feriados, setFeriados] = useState<Feriado[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editFeriado, setEditFeriado] = useState<Partial<Feriado>>({})
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/feriados')
      .then((r) => r.json())
      .then((data) => {
        setFeriados(Array.isArray(data) ? data : [])
        setLoading(false)
      })
  }, [])

  async function handleCreate() {
    if (!editFeriado.data || !editFeriado.nome) return
    try {
      const res = await fetch('/api/feriados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFeriado),
      })
      if (res.ok) {
        toast.success('Feriado cadastrado!')
        setDialogOpen(false)
        setEditFeriado({})
        const updated = await fetch('/api/feriados').then((r) => r.json())
        setFeriados(Array.isArray(updated) ? updated : [])
      } else {
        toast.error('Erro ao cadastrar feriado')
      }
    } catch {
      toast.error('Erro de conexão')
    }
  }

  async function handleUpdate() {
    if (!editingId || !editFeriado.data || !editFeriado.nome) return
    try {
      const res = await fetch(`/api/feriados/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFeriado),
      })
      if (res.ok) {
        toast.success('Feriado atualizado!')
        setEditingId(null)
        setEditFeriado({})
        const updated = await fetch('/api/feriados').then((r) => r.json())
        setFeriados(Array.isArray(updated) ? updated : [])
      } else {
        toast.error('Erro ao atualizar feriado')
      }
    } catch {
      toast.error('Erro de conexão')
    }
  }

  async function handleDelete(id: string, nome: string) {
    const confirmado = window.confirm(`Tem certeza que deseja remover o feriado "${nome}"?`)
    if (!confirmado) return
    try {
      const res = await fetch(`/api/feriados/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Feriado removido!')
        setFeriados((prev) => prev.filter((f) => f.id !== id))
      }
    } catch {
      toast.error('Erro ao remover')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
      </div>
    )
  }

  const acaoLabel = (acao: string) =>
    ACOES_FERIADO.find((a) => a.value === acao)?.label || acao

  const afetadasLabel = (afetadas: string) =>
    ESCOLAS_AFETADAS.find((a) => a.value === afetadas)?.label || afetadas

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3A5C]">Feriados</h1>
          <p className="text-sm text-muted-foreground">Gerenciar feriados que afetam a produção e entregas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-[#1A3A5C] to-[#2C5282]">
              <Plus className="w-4 h-4 mr-1" /> Novo Feriado
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Feriado</DialogTitle>
            </DialogHeader>
            <FeriadoForm feriado={editFeriado} setFeriado={setEditFeriado} onSubmit={handleCreate} submitLabel="Cadastrar Feriado" />
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingId} onOpenChange={() => { setEditingId(null); setEditFeriado({}) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Feriado</DialogTitle>
          </DialogHeader>
          <FeriadoForm feriado={editFeriado} setFeriado={setEditFeriado} onSubmit={handleUpdate} submitLabel="Salvar Alterações" />
        </DialogContent>
      </Dialog>

      {feriados.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CalendarOff className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhum feriado cadastrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {feriados.map((feriado) => (
            <motion.div
              key={feriado.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Card className="border-red-100 hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-red-900">{feriado.nome}</span>
                      <Badge variant="outline" className="text-[10px] border-red-200 text-red-700">
                        {feriado.tipo}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(feriado.data + 'T12:00:00').toLocaleDateString('pt-BR', {
                        weekday: 'long',
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                    <div className="flex gap-2 mt-1">
                      <Badge className="bg-red-50 text-red-700 text-[10px] border border-red-200">
                        {acaoLabel(feriado.acao)}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {afetadasLabel(feriado.escolas_afetadas)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(feriado.id)
                        setEditFeriado(feriado)
                      }}
                      className="text-amber-500 hover:bg-amber-50"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(feriado.id, feriado.nome)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

function FeriadoForm({
  feriado,
  setFeriado,
  onSubmit,
  submitLabel,
}: {
  feriado: Partial<Feriado>
  setFeriado: React.Dispatch<React.SetStateAction<Partial<Feriado>>>
  onSubmit: () => void
  submitLabel: string
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Data</Label>
        <Input
          type="date"
          value={feriado.data || ''}
          onChange={(e) => setFeriado((prev) => ({ ...prev, data: e.target.value }))}
        />
      </div>
      <div>
        <Label>Nome do Feriado</Label>
        <Input
          value={feriado.nome || ''}
          onChange={(e) => setFeriado((prev) => ({ ...prev, nome: e.target.value }))}
          placeholder="Ex: Carnaval"
        />
      </div>
      <div>
        <Label>Tipo</Label>
        <Select
          value={feriado.tipo || 'NACIONAL'}
          onValueChange={(v) => setFeriado((prev) => ({ ...prev, tipo: v }))}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {TIPOS_FERIADO.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Escolas Afetadas</Label>
        <Select
          value={feriado.escolas_afetadas || 'TODAS'}
          onValueChange={(v) => setFeriado((prev) => ({ ...prev, escolas_afetadas: v }))}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ESCOLAS_AFETADAS.map((e) => (
              <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Ação</Label>
        <Select
          value={feriado.acao || 'zerar_dia'}
          onValueChange={(v) => setFeriado((prev) => ({ ...prev, acao: v }))}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ACOES_FERIADO.map((a) => (
              <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Observação</Label>
        <Input
          value={feriado.obs || ''}
          onChange={(e) => setFeriado((prev) => ({ ...prev, obs: e.target.value }))}
          placeholder="Observação opcional"
        />
      </div>
      <Button onClick={onSubmit} className="w-full bg-[#1A3A5C]">{submitLabel}</Button>
    </div>
  )
}
