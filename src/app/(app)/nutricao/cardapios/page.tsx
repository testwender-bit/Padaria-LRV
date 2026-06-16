'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { BookOpen, Plus, Pencil, Copy, FileText, CheckCircle, Search, RefreshCw, X, Users, Layers, Repeat, ShoppingCart, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { CATEGORIAS_ESCOLA_NUTRI, FASES_ESCOLARES } from '@/lib/nutricao-utils'

interface Escola {
  id: string
  nome: string
  categoria: string
}

interface Nutricionista {
  id: string
  nome: string
  crn: string
}

interface CardapioResumo {
  id: string
  nome: string
  escola_id: string | null
  categoria_escola: string
  fase_escolar: string
  status: string
  ano: number
  semestre: number
  is_base?: boolean
  cardapio_base_id?: string | null
  ciclo_semanas?: number
  repetir_ciclo?: boolean
  escola?: { id: string; nome: string } | null
  nutricionista?: { id: string; nome: string; crn: string } | null
  semanas?: { id: string }[]
  criado_em: string
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'APROVADO':
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px]">Aprovado</Badge>
    case 'RASCUNHO':
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px]">Rascunho</Badge>
    default:
      return <Badge variant="outline" className="text-[10px]">{status}</Badge>
  }
}

function getCategoriaBadge(categoria: string) {
  const map: Record<string, { label: string; className: string }> = {
    REGULAR: { label: 'Regular', className: 'bg-blue-100 text-blue-700' },
    INTEGRAL: { label: 'Integral', className: 'bg-teal-100 text-teal-700' },
    BIFASICA: { label: 'Bifásica', className: 'bg-cyan-100 text-cyan-700' },
    CRECHE: { label: 'Creche', className: 'bg-pink-100 text-pink-700' },
    INTERIOR: { label: 'Interior', className: 'bg-orange-100 text-orange-700' },
  }
  const info = map[categoria] || { label: categoria, className: 'bg-gray-100 text-gray-700' }
  return <Badge className={`${info.className} text-[10px] hover:${info.className}`}>{info.label}</Badge>
}

function getFaseBadge(fase: string) {
  const f = FASES_ESCOLARES.find(fs => fs.value === fase)
  if (!f) return null
  return (
    <Badge
      variant="outline"
      className="text-[10px] py-0.5"
      style={{ borderColor: f.cor, color: f.cor }}
    >
      {f.label}
    </Badge>
  )
}

interface FormState {
  nome: string
  escola_id: string
  categoria_escola: string
  fase_escolar: string
  nutricionista_id: string
  ano: number
  semestre: number
}

const emptyForm: FormState = {
  nome: '',
  escola_id: '',
  categoria_escola: 'REGULAR',
  fase_escolar: 'FUND_FINAL',
  nutricionista_id: '',
  ano: new Date().getFullYear(),
  semestre: 1,
}

export default function CardapiosPage() {
  const [cardapios, setCardapios] = useState<CardapioResumo[]>([])
  const [escolas, setEscolas] = useState<Escola[]>([])
  const [nutricionistas, setNutricionistas] = useState<Nutricionista[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filterCategoria, setFilterCategoria] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [cloneDialogOpen, setCloneDialogOpen] = useState(false)
  const [cloneCardapioId, setCloneCardapioId] = useState<string | null>(null)
  const [cloneEscolaId, setCloneEscolaId] = useState('')
  const [cloning, setCloning] = useState(false)

  const [approveId, setApproveId] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)

  // v8: exclusão de cardápio
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteCardNome, setDeleteCardNome] = useState<string>('')
  const [deleting, setDeleting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cardRes, escRes, nutRes] = await Promise.all([
        fetch('/api/nutricao/cardapios'),
        fetch('/api/escolas'),
        fetch('/api/nutricao/nutricionistas'),
      ])
      if (!cardRes.ok) throw new Error('Erro ao carregar cardápios')
      const cardData = await cardRes.json()
      const escData = await escRes.json()
      const nutData = await nutRes.json()
      setCardapios(Array.isArray(cardData) ? cardData : [])
      setEscolas(Array.isArray(escData) ? escData : [])
      setNutricionistas(Array.isArray(nutData) ? nutData : [])
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar os dados.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filtered = cardapios.filter((c) => {
    const matchSearch = c.nome.toLowerCase().includes(search.toLowerCase()) ||
      (c.escola?.nome || '').toLowerCase().includes(search.toLowerCase())
    const matchCategoria = filterCategoria === 'all' || c.categoria_escola === filterCategoria
    const matchStatus = filterStatus === 'all' || c.status === filterStatus
    return matchSearch && matchCategoria && matchStatus
  })

  function openNewDialog() {
    setForm(emptyForm)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      toast.error('Nome é obrigatório')
      return
    }
    if (!form.nutricionista_id) {
      toast.error('Selecione um nutricionista')
      return
    }
    setSaving(true)
    try {
      const payload = {
        nome: form.nome,
        escola_id: form.escola_id || null,
        categoria_escola: form.categoria_escola,
        fase_escolar: form.fase_escolar,
        nutricionista_id: form.nutricionista_id,
        ano: form.ano,
        semestre: form.semestre,
      }
      const res = await fetch('/api/nutricao/cardapios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Erro ao criar cardápio')
      }
      const newCardapio = await res.json()
      toast.success('Cardápio criado com sucesso')
      setDialogOpen(false)
      loadData()
      // Navigate to editor
      window.location.href = `/nutricao/cardapios/${newCardapio.id}`
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar cardápio')
    } finally {
      setSaving(false)
    }
  }

  function openCloneDialog(cardapioId: string) {
    setCloneCardapioId(cardapioId)
    setCloneEscolaId('')
    setCloneDialogOpen(true)
  }

  async function handleClone() {
    if (!cloneCardapioId || !cloneEscolaId) {
      toast.error('Selecione uma escola de destino')
      return
    }
    setCloning(true)
    try {
      const res = await fetch(`/api/nutricao/cardapios/${cloneCardapioId}/clonar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escola_id: cloneEscolaId }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Erro ao clonar cardápio')
      }
      toast.success('Cardápio clonado com sucesso')
      setCloneDialogOpen(false)
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao clonar')
    } finally {
      setCloning(false)
    }
  }

  async function handleApprove() {
    if (!approveId) return
    setApproving(true)
    try {
      const res = await fetch(`/api/nutricao/cardapios/${approveId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APROVADO' }),
      })
      if (!res.ok) throw new Error('Erro ao aprovar cardápio')
      toast.success('Cardápio aprovado com sucesso')
      setApproveId(null)
      loadData()
    } catch {
      toast.error('Erro ao aprovar cardápio')
    } finally {
      setApproving(false)
    }
  }

  // v8: Excluir cardápio (chama DELETE na API)
  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/nutricao/cardapios/${deleteId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao excluir cardápio')
      }
      toast.success('Cardápio excluído com sucesso')
      setDeleteId(null)
      setDeleteCardNome('')
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir cardápio')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
          <span className="text-muted-foreground">Carregando cardápios...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#1A3A5C] flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            Cardápios
          </h1>
          <p className="text-sm text-muted-foreground">
            Cardápios nutricionais escolares — {cardapios.length} cadastrados
          </p>
        </div>
        <Button onClick={openNewDialog} className="bg-[#1A3A5C] hover:bg-[#1A3A5C]/90">
          <Plus className="w-4 h-4 mr-1" /> Novo Cardápio
        </Button>
      </motion.div>

      {/* Atalhos v6 */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="flex flex-wrap gap-2">
        <Link href="/nutricao/lista-compras">
          <Button variant="outline" size="sm" className="text-xs h-8 border-[#1A3A5C]/20 text-[#1A3A5C] hover:bg-[#1A3A5C]/5">
            <ShoppingCart className="w-3 h-3 mr-1" /> Lista de Compras
          </Button>
        </Link>
        <div className="text-[10px] text-muted-foreground self-center px-2">
          💡 Dica: crie cardápios-base (sem escola) e use "Replicar p/ Escolas" para instanciar nas 24 escolas
        </div>
      </motion.div>

      {/* Nutricionistas Ativos */}
      {nutricionistas.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nutricionistas:</span>
            {nutricionistas.map((n) => (
              <Badge key={n.id} variant="outline" className="text-[10px] py-0.5 border-purple-200 bg-purple-50 text-purple-700">
                {n.nome} <span className="text-purple-400 ml-1">({n.crn})</span>
              </Badge>
            ))}
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar cardápio..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CATEGORIAS_ESCOLA_NUTRI.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="RASCUNHO">Rascunho</SelectItem>
            <SelectItem value="APROVADO">Aprovado</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Error */}
      {error && (
        <div className="text-center py-8">
          <p className="text-sm text-red-500 mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-3 h-3 mr-1" /> Tentar novamente
          </Button>
        </div>
      )}

      {/* Cards */}
      {!error && (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              {search || filterCategoria !== 'all' || filterStatus !== 'all'
                ? 'Nenhum cardápio encontrado com esse filtro.'
                : 'Nenhum cardápio cadastrado.'}
            </div>
          ) : (
            filtered.map((c) => (
              <motion.div key={c.id} variants={item}>
                <Card className="border-[#1A3A5C]/10 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm font-semibold text-[#1A3A5C] truncate flex-1">
                        {c.is_base && <span className="text-[#D4A017] mr-1" title="Modelo Base">⭐</span>}
                        {c.nome}
                      </CardTitle>
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        {getStatusBadge(c.status)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getCategoriaBadge(c.categoria_escola)}
                      {getFaseBadge(c.fase_escolar)}
                      <Badge variant="outline" className="text-[10px]">
                        {c.escola?.nome || 'Modelo base'}
                      </Badge>
                      {c.ciclo_semanas && c.ciclo_semanas !== 5 && (
                        <Badge variant="outline" className="text-[10px] border-purple-200 bg-purple-50 text-purple-700">
                          Ciclo {c.ciclo_semanas}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>Nutricionista: {c.nutricionista?.nome || '—'}</p>
                      <p>Ano/Semestre: {c.ano}/{c.semestre}</p>
                      <p>Semanas: {c.semanas?.length || 0}{c.repetir_ciclo ? ' (com ciclo)' : ''}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                      <Link href={`/nutricao/cardapios/${c.id}`}>
                        <Button variant="outline" size="sm" className="h-7 text-[11px]">
                          <Pencil className="w-3 h-3 mr-1" /> Editar
                        </Button>
                      </Link>
                      {/* v8: Replicar p/ Escolas (somente bases) — substitui "Clonar em Lote" + "Ciclo PNAE" */}
                      {c.is_base && (
                        <Link href={`/nutricao/cardapios/${c.id}/replicar`}>
                          <Button variant="outline" size="sm" className="h-7 text-[11px] border-purple-200 text-purple-700 hover:bg-purple-50">
                            <Layers className="w-3 h-3 mr-1" /> Replicar p/ Escolas
                          </Button>
                        </Link>
                      )}
                      {/* v8: Comparar c/ Base (somente instâncias de escola) */}
                      {!c.is_base && c.cardapio_base_id && (
                        <Link href={`/nutricao/cardapios/${c.id}/comparar`}>
                          <Button variant="outline" size="sm" className="h-7 text-[11px] border-blue-200 text-blue-700 hover:bg-blue-50">
                            <Copy className="w-3 h-3 mr-1" /> Comparar c/ Base
                          </Button>
                        </Link>
                      )}
                      <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => openCloneDialog(c.id)}>
                        <Copy className="w-3 h-3 mr-1" /> Clonar
                      </Button>
                      <Link href={`/nutricao/cardapios/${c.id}/pdf`}>
                        <Button variant="outline" size="sm" className="h-7 text-[11px]">
                          <FileText className="w-3 h-3 mr-1" /> PDF
                        </Button>
                      </Link>
                      {c.status === 'RASCUNHO' && (
                        <Button variant="outline" size="sm" className="h-7 text-[11px] text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => setApproveId(c.id)}>
                          <CheckCircle className="w-3 h-3 mr-1" /> Aprovar
                        </Button>
                      )}
                      {/* v8: Excluir cardápio */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => {
                          setDeleteId(c.id)
                          setDeleteCardNome(c.nome)
                        }}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </motion.div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#1A3A5C]">Novo Cardápio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Cardápio Regular 2025/1" />
            </div>
            <div className="space-y-2">
              <Label>Escola (deixe vazio para modelo base)</Label>
              <Select value={form.escola_id} onValueChange={(v) => setForm({ ...form, escola_id: v === '_none_' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Modelo base (todas as escolas)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">Modelo base (todas as escolas)</SelectItem>
                  {escolas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.categoria_escola} onValueChange={(v) => setForm({ ...form, categoria_escola: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_ESCOLA_NUTRI.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fase Escolar</Label>
                <Select value={form.fase_escolar} onValueChange={(v) => setForm({ ...form, fase_escolar: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FASES_ESCOLARES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label} ({f.faixa})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nutricionista *</Label>
              <Select value={form.nutricionista_id} onValueChange={(v) => setForm({ ...form, nutricionista_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar nutricionista" /></SelectTrigger>
                <SelectContent>
                  {nutricionistas.map((n) => (
                    <SelectItem key={n.id} value={n.id}>{n.nome} — {n.crn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ano</Label>
                <Input type="number" value={form.ano} onChange={(e) => setForm({ ...form, ano: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Semestre</Label>
                <Select value={String(form.semestre)} onValueChange={(v) => setForm({ ...form, semestre: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1º Semestre</SelectItem>
                    <SelectItem value="2">2º Semestre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-[#1A3A5C] hover:bg-[#1A3A5C]/90">
                {saving ? 'Criando...' : 'Criar Cardápio'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clone Dialog */}
      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1A3A5C]">Clonar Cardápio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Selecione a escola de destino para clonar este cardápio.
            </p>
            <div className="space-y-2">
              <Label>Escola de Destino</Label>
              <Select value={cloneEscolaId} onValueChange={setCloneEscolaId}>
                <SelectTrigger><SelectValue placeholder="Selecionar escola" /></SelectTrigger>
                <SelectContent>
                  {escolas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCloneDialogOpen(false)} disabled={cloning}>Cancelar</Button>
              <Button onClick={handleClone} disabled={cloning || !cloneEscolaId} className="bg-[#1A3A5C] hover:bg-[#1A3A5C]/90">
                {cloning ? 'Clonando...' : 'Clonar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation */}
      <AlertDialog open={!!approveId} onOpenChange={() => setApproveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar cardápio?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao aprovar, o cardápio será marcado como APROVADO. Esta ação pode ser revertida posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={approving} className="bg-emerald-600 hover:bg-emerald-700">
              {approving ? 'Aprovando...' : 'Aprovar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* v8: AlertDialog de Exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={() => {
        if (!deleting) {
          setDeleteId(null)
          setDeleteCardNome('')
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              Excluir cardápio?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteCardNome}</strong>?
              <br />
              <span className="text-red-600 font-medium">
                Esta ação é irreversível e removerá TODAS as semanas, dias e itens associados a este cardápio.
              </span>
              <br /><br />
              Se for um cardápio de escola, o cardápio base permanece intacto. Se for um base, as instâncias já criadas nas escolas também permanecem (mas perdem o vínculo de origem).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Excluindo...' : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
