'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Apple, Plus, Search, Pencil, Trash2, ChevronDown, ChevronUp, RefreshCw, X, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { GRUPOS_ALIMENTOS } from '@/lib/nutricao-utils'
import { normalizeText } from '@/lib/busca-utils'

interface Alimento {
  id: string
  codigo_taco: number | null
  nome: string
  grupo: string
  medida_caseira: string
  gramas_por_medida: number
  energia_kcal: number
  carboidratos_g: number
  proteinas_g: number
  lipidios_g: number
  fibra_alimentar_g: number
  sodio_mg: number
  ferro_mg: number
  ferro_heme_mg: number
  vitamina_a_mcg: number
  vitamina_c_mg: number
  calcio_mg: number
  magnesio_mg: number
  zinco_mg: number
  acucar_adicionado_g: number
  ativo: boolean
}

const grupoColors: Record<string, string> = {
  'Cereais e derivados': 'bg-amber-100 text-amber-700',
  'Leguminosas e derivados': 'bg-green-100 text-green-700',
  'Verduras e hortaliças': 'bg-emerald-100 text-emerald-700',
  'Frutas': 'bg-pink-100 text-pink-700',
  'Frutas e derivados': 'bg-rose-100 text-rose-700',
  'Carnes e ovos': 'bg-red-100 text-red-700',
  'Pescados e frutos do mar': 'bg-sky-100 text-sky-700',
  'Leite e derivados': 'bg-blue-100 text-blue-700',
  'Óleos e gorduras': 'bg-yellow-100 text-yellow-700',
  'Açúcares e doces': 'bg-orange-100 text-orange-700',
  'Bebidas': 'bg-cyan-100 text-cyan-700',
  'Preparações': 'bg-violet-100 text-violet-700',
  'Outros': 'bg-gray-100 text-gray-700',
}

function getGrupoBadge(grupo: string) {
  const cls = grupoColors[grupo] || 'bg-gray-100 text-gray-700'
  return <Badge className={`${cls} text-[10px] hover:${cls}`}>{grupo}</Badge>
}

const emptyAlimento: Omit<Alimento, 'id' | 'ativo'> = {
  codigo_taco: null,
  nome: '',
  grupo: 'Cereais e derivados',
  medida_caseira: '',
  gramas_por_medida: 0,
  energia_kcal: 0,
  carboidratos_g: 0,
  proteinas_g: 0,
  lipidios_g: 0,
  fibra_alimentar_g: 0,
  sodio_mg: 0,
  ferro_mg: 0,
  ferro_heme_mg: 0,
  vitamina_a_mcg: 0,
  vitamina_c_mg: 0,
  calcio_mg: 0,
  magnesio_mg: 0,
  zinco_mg: 0,
  acucar_adicionado_g: 0,
}

export default function AlimentosPage() {
  const [alimentos, setAlimentos] = useState<Alimento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [grupoFilter, setGrupoFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyAlimento)
  const [saving, setSaving] = useState(false)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadAlimentos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/nutricao/alimentos')
      if (!res.ok) throw new Error('Erro ao carregar alimentos')
      const data = await res.json()
      setAlimentos(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar os alimentos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAlimentos()
  }, [loadAlimentos])

  const filtered = alimentos.filter((a) => {
    // v8: busca sem acento (normalizeText)
    const matchSearch = normalizeText(a.nome).includes(normalizeText(search))
    const matchGrupo = grupoFilter === 'all' || a.grupo === grupoFilter
    return matchSearch && matchGrupo
  })

  function openNewDialog() {
    setEditingId(null)
    setForm(emptyAlimento)
    setDialogOpen(true)
  }

  function openEditDialog(alimento: Alimento) {
    setEditingId(alimento.id)
    setForm({
      codigo_taco: alimento.codigo_taco,
      nome: alimento.nome,
      grupo: alimento.grupo,
      medida_caseira: alimento.medida_caseira,
      gramas_por_medida: alimento.gramas_por_medida,
      energia_kcal: alimento.energia_kcal,
      carboidratos_g: alimento.carboidratos_g,
      proteinas_g: alimento.proteinas_g,
      lipidios_g: alimento.lipidios_g,
      fibra_alimentar_g: alimento.fibra_alimentar_g,
      sodio_mg: alimento.sodio_mg,
      ferro_mg: alimento.ferro_mg,
      ferro_heme_mg: alimento.ferro_heme_mg,
      vitamina_a_mcg: alimento.vitamina_a_mcg,
      vitamina_c_mg: alimento.vitamina_c_mg,
      calcio_mg: alimento.calcio_mg,
      magnesio_mg: alimento.magnesio_mg,
      zinco_mg: alimento.zinco_mg,
      acucar_adicionado_g: alimento.acucar_adicionado_g,
    })
    setDialogOpen(true)
  }

  // v8: Duplicar alimento — abre o dialog de novo já preenchido com os dados do alimento original
  // (codigo_taco fica null porque é uma cópia, e nome fica com sufixo " (cópia)" para evitar duplicata)
  function openDuplicateDialog(alimento: Alimento) {
    setEditingId(null)  // null = modo criação
    setForm({
      codigo_taco: null,  // cópia não tem código TACO
      nome: `${alimento.nome} (cópia)`,
      grupo: alimento.grupo,
      medida_caseira: alimento.medida_caseira,
      gramas_por_medida: alimento.gramas_por_medida,
      energia_kcal: alimento.energia_kcal,
      carboidratos_g: alimento.carboidratos_g,
      proteinas_g: alimento.proteinas_g,
      lipidios_g: alimento.lipidios_g,
      fibra_alimentar_g: alimento.fibra_alimentar_g,
      sodio_mg: alimento.sodio_mg,
      ferro_mg: alimento.ferro_mg,
      ferro_heme_mg: alimento.ferro_heme_mg,
      vitamina_a_mcg: alimento.vitamina_a_mcg,
      vitamina_c_mg: alimento.vitamina_c_mg,
      calcio_mg: alimento.calcio_mg,
      magnesio_mg: alimento.magnesio_mg,
      zinco_mg: alimento.zinco_mg,
      acucar_adicionado_g: alimento.acucar_adicionado_g,
    })
    setDialogOpen(true)
    toast.info(`Duplicando "${alimento.nome}" — ajuste o nome e salve`)
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      toast.error('Nome é obrigatório')
      return
    }
    setSaving(true)
    try {
      const url = editingId
        ? `/api/nutricao/alimentos/${editingId}`
        : '/api/nutricao/alimentos'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Erro ao salvar alimento')
      }
      toast.success(editingId ? 'Alimento atualizado com sucesso' : 'Alimento criado com sucesso')
      setDialogOpen(false)
      loadAlimentos()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/nutricao/alimentos/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao excluir alimento')
      toast.success('Alimento excluído com sucesso')
      setDeleteId(null)
      loadAlimentos()
    } catch (err) {
      toast.error('Erro ao excluir alimento')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
          <span className="text-muted-foreground">Carregando alimentos...</span>
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
            <Apple className="w-6 h-6 text-emerald-600" />
            Alimentos (TACO)
          </h1>
          <p className="text-sm text-muted-foreground">
            Base de dados nutricionais TACO — {alimentos.length} alimentos cadastrados
          </p>
        </div>
        <Button onClick={openNewDialog} className="bg-[#1A3A5C] hover:bg-[#1A3A5C]/90">
          <Plus className="w-4 h-4 mr-1" /> Novo Alimento
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar alimento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <Select value={grupoFilter} onValueChange={setGrupoFilter}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Filtrar por grupo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os grupos</SelectItem>
            {GRUPOS_ALIMENTOS.map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Error */}
      {error && (
        <div className="text-center py-8">
          <p className="text-sm text-red-500 mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={loadAlimentos}>
            <RefreshCw className="w-3 h-3 mr-1" /> Tentar novamente
          </Button>
        </div>
      )}

      {/* Table */}
      {!error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-[#1A3A5C]/10">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#1A3A5C]/5">
                      <TableHead className="text-[#1A3A5C] font-semibold">Nome</TableHead>
                      <TableHead className="text-[#1A3A5C] font-semibold hidden md:table-cell">Grupo</TableHead>
                      <TableHead className="text-[#1A3A5C] font-semibold hidden lg:table-cell">Medida Caseira</TableHead>
                      <TableHead className="text-[#1A3A5C] font-semibold text-right hidden lg:table-cell">g/Med</TableHead>
                      <TableHead className="text-[#1A3A5C] font-semibold text-right hidden xl:table-cell">Energia</TableHead>
                      <TableHead className="text-[#1A3A5C] font-semibold text-right hidden xl:table-cell">Carb</TableHead>
                      <TableHead className="text-[#1A3A5C] font-semibold text-right hidden 2xl:table-cell">Prot</TableHead>
                      <TableHead className="text-[#1A3A5C] font-semibold text-right hidden 2xl:table-cell">Lip</TableHead>
                      <TableHead className="text-[#1A3A5C] font-semibold text-right hidden 2xl:table-cell">Sódio</TableHead>
                      <TableHead className="text-[#1A3A5C] font-semibold text-right hidden 2xl:table-cell">Açúcar</TableHead>
                      <TableHead className="text-right w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          {search || grupoFilter !== 'all' ? 'Nenhum alimento encontrado com esse filtro.' : 'Nenhum alimento cadastrado.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((a) => (
                        <Fragment key={a.id}>
                          <TableRow
                            className="cursor-pointer hover:bg-gray-50/50"
                            onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                          >
                            <TableCell className="font-medium text-[#1A3A5C]">
                              <div className="flex items-center gap-2">
                                {expandedId === a.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                {a.nome}
                                {a.codigo_taco && (
                                  <Badge variant="outline" className="text-[9px] ml-1">TACO {a.codigo_taco}</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">{getGrupoBadge(a.grupo)}</TableCell>
                            <TableCell className="text-xs hidden lg:table-cell">{a.medida_caseira}</TableCell>
                            <TableCell className="text-right text-xs hidden lg:table-cell">{a.gramas_por_medida}g</TableCell>
                            <TableCell className="text-right text-xs hidden xl:table-cell">{a.energia_kcal.toFixed(0)}</TableCell>
                            <TableCell className="text-right text-xs hidden xl:table-cell">{a.carboidratos_g.toFixed(1)}</TableCell>
                            <TableCell className="text-right text-xs hidden 2xl:table-cell">{a.proteinas_g.toFixed(1)}</TableCell>
                            <TableCell className="text-right text-xs hidden 2xl:table-cell">{a.lipidios_g.toFixed(1)}</TableCell>
                            <TableCell className="text-right text-xs hidden 2xl:table-cell">{a.sodio_mg.toFixed(0)}</TableCell>
                            <TableCell className="text-right text-xs hidden 2xl:table-cell">
                              {a.acucar_adicionado_g > 0 ? (
                                <span className="text-orange-600 font-medium">{a.acucar_adicionado_g.toFixed(1)}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditDialog(a)} title="Editar">
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                {/* v8: Duplicar — abre dialog de novo preenchido com dados do alimento */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => openDuplicateDialog(a)}
                                  title="Duplicar alimento"
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => setDeleteId(a.id)} title="Excluir">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {expandedId === a.id && (
                            <TableRow key={`${a.id}-detail`} className="bg-gray-50/30">
                              <TableCell colSpan={10} className="p-4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
                                  {[
                                    { label: 'Energia', value: `${a.energia_kcal.toFixed(0)} kcal` },
                                    { label: 'Carboidratos', value: `${a.carboidratos_g.toFixed(1)} g` },
                                    { label: 'Proteínas', value: `${a.proteinas_g.toFixed(1)} g` },
                                    { label: 'Lipídios', value: `${a.lipidios_g.toFixed(1)} g` },
                                    { label: 'Fibra Alimentar', value: `${a.fibra_alimentar_g.toFixed(1)} g` },
                                    { label: 'Sódio', value: `${a.sodio_mg.toFixed(0)} mg` },
                                    { label: 'Ferro', value: `${a.ferro_mg.toFixed(1)} mg` },
                                    { label: 'Ferro Heme', value: `${a.ferro_heme_mg.toFixed(2)} mg` },
                                    { label: 'Vitamina A', value: `${a.vitamina_a_mcg.toFixed(0)} mcg` },
                                    { label: 'Vitamina C', value: `${a.vitamina_c_mg.toFixed(1)} mg` },
                                    { label: 'Cálcio', value: `${a.calcio_mg.toFixed(0)} mg` },
                                    { label: 'Magnésio', value: `${a.magnesio_mg.toFixed(0)} mg` },
                                    { label: 'Zinco', value: `${a.zinco_mg.toFixed(1)} mg` },
                                    { label: 'Açúcar Adic.', value: `${a.acucar_adicionado_g.toFixed(1)} g` },
                                  ].map((n) => (
                                    <div key={n.label} className="space-y-0.5">
                                      <p className="text-muted-foreground">{n.label}</p>
                                      <p className="font-medium text-[#1A3A5C]">{n.value}</p>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-3 text-xs text-muted-foreground md:hidden">
                                  Grupo: {getGrupoBadge(a.grupo)} · Medida: {a.medida_caseira} ({a.gramas_por_medida}g)
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-[#1A3A5C]">
              {editingId ? 'Editar Alimento' : 'Novo Alimento'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Arroz branco cozido" />
              </div>
              <div className="space-y-2">
                <Label>Grupo</Label>
                <Select value={form.grupo} onValueChange={(v) => setForm({ ...form, grupo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRUPOS_ALIMENTOS.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Código TACO</Label>
                <Input type="number" value={form.codigo_taco ?? ''} onChange={(e) => setForm({ ...form, codigo_taco: e.target.value ? Number(e.target.value) : null })} placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label>Medida Caseira</Label>
                <Input value={form.medida_caseira} onChange={(e) => setForm({ ...form, medida_caseira: e.target.value })} placeholder="Ex: 1 colher de sopa" />
              </div>
              <div className="space-y-2">
                <Label>Gramas por Medida</Label>
                <Input type="number" step="0.1" value={form.gramas_por_medida} onChange={(e) => setForm({ ...form, gramas_por_medida: Number(e.target.value) })} />
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Valores Nutricionais (por 100g)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-52 overflow-y-auto pr-1">
                {[
                  { key: 'energia_kcal', label: 'Energia (kcal)' },
                  { key: 'carboidratos_g', label: 'Carboidratos (g)' },
                  { key: 'proteinas_g', label: 'Proteínas (g)' },
                  { key: 'lipidios_g', label: 'Lipídios (g)' },
                  { key: 'fibra_alimentar_g', label: 'Fibra Alimentar (g)' },
                  { key: 'sodio_mg', label: 'Sódio (mg)' },
                  { key: 'ferro_mg', label: 'Ferro (mg)' },
                  { key: 'ferro_heme_mg', label: 'Ferro Heme (mg)' },
                  { key: 'vitamina_a_mcg', label: 'Vitamina A (mcg)' },
                  { key: 'vitamina_c_mg', label: 'Vitamina C (mg)' },
                  { key: 'calcio_mg', label: 'Cálcio (mg)' },
                  { key: 'magnesio_mg', label: 'Magnésio (mg)' },
                  { key: 'zinco_mg', label: 'Zinco (mg)' },
                  { key: 'acucar_adicionado_g', label: 'Açúcar Adic. (g)' },
                ].map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Label className="text-xs">{field.label}</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={(form as Record<string, number | string | null>)[field.key] ?? 0}
                      onChange={(e) => setForm({ ...form, [field.key]: Number(e.target.value) })}
                      className="text-sm h-8"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-[#1A3A5C] hover:bg-[#1A3A5C]/90">
                {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar Alimento'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir alimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O alimento será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
