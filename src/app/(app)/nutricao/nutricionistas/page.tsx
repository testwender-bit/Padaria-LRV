'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { UserCheck, Plus, Pencil, Trash2, RefreshCw, Search, X } from 'lucide-react'
import { toast } from 'sonner'

interface User {
  id: string
  name: string
  email: string
  role: string
}

interface Nutricionista {
  id: string
  user_id: string | null
  nome: string
  crn: string
  ativo: boolean
  user: User | null
}

interface FormState {
  user_id: string
  nome: string
  crn: string
}

const emptyForm: FormState = {
  user_id: '',
  nome: '',
  crn: '',
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
}

export default function NutricionistasPage() {
  const [nutricionistas, setNutricionistas] = useState<Nutricionista[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nutRes, usersRes] = await Promise.all([
        fetch('/api/nutricao/nutricionistas'),
        fetch('/api/users'),
      ])
      if (!nutRes.ok) throw new Error('Erro ao carregar nutricionistas')
      const nutData = await nutRes.json()
      setNutricionistas(Array.isArray(nutData) ? nutData : [])

      // Users API is optional — gracefully handle failure
      if (usersRes.ok) {
        try {
          const usersData = await usersRes.json()
          setUsers(Array.isArray(usersData) ? usersData : [])
        } catch {
          setUsers([])
        }
      } else {
        setUsers([])
      }
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

  const filtered = nutricionistas.filter((n) =>
    n.nome.toLowerCase().includes(search.toLowerCase()) ||
    n.crn.toLowerCase().includes(search.toLowerCase()) ||
    (n.user?.email || '').toLowerCase().includes(search.toLowerCase())
  )

  const linkedUserIds = new Set(
    nutricionistas.filter((n) => n.user_id).map((n) => n.user_id as string)
  )
  const availableUsers = users.filter(
    (u) => !linkedUserIds.has(u.id) || (editingId && nutricionistas.find((n) => n.id === editingId)?.user_id === u.id)
  )

  function openNewDialog() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEditDialog(nut: Nutricionista) {
    setEditingId(nut.id)
    setForm({
      user_id: nut.user_id || '',
      nome: nut.nome,
      crn: nut.crn,
    })
    setDialogOpen(true)
  }

  function handleUserSelect(userId: string) {
    const user = users.find((u) => u.id === userId)
    setForm({
      ...form,
      user_id: userId,
      nome: user?.name || '',
    })
  }

  async function handleSave() {
    // user_id é OPCIONAL — só nome + CRN são obrigatórios
    if (!form.nome.trim()) {
      toast.error('Nome é obrigatório')
      return
    }
    if (!form.crn.trim()) {
      toast.error('CRN é obrigatório')
      return
    }
    setSaving(true)
    try {
      const url = editingId
        ? `/api/nutricao/nutricionistas/${editingId}`
        : '/api/nutricao/nutricionistas'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Erro ao salvar nutricionista')
      }
      toast.success(editingId ? 'Nutricionista atualizado' : 'Nutricionista criado')
      setDialogOpen(false)
      loadData()
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
      const res = await fetch(`/api/nutricao/nutricionistas/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao excluir')
      toast.success('Nutricionista excluído')
      setDeleteId(null)
      loadData()
    } catch {
      toast.error('Erro ao excluir nutricionista')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
          <span className="text-muted-foreground">Carregando nutricionistas...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#1A3A5C] flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-purple-600" />
            Nutricionistas
          </h1>
          <p className="text-sm text-muted-foreground">
            Equipe de nutrição responsável pelos cardápios — {nutricionistas.length} cadastrados
          </p>
        </div>
        <Button onClick={openNewDialog} className="bg-[#1A3A5C] hover:bg-[#1A3A5C]/90">
          <Plus className="w-4 h-4 mr-1" /> Novo Nutricionista
        </Button>
      </motion.div>

      {/* Search */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, CRN ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
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

      {/* Table */}
      {!error && (
        <motion.div variants={container} initial="hidden" animate="show">
          <Card className="border-[#1A3A5C]/10">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#1A3A5C]/5">
                    <TableHead className="text-[#1A3A5C] font-semibold">Nome</TableHead>
                    <TableHead className="text-[#1A3A5C] font-semibold">CRN</TableHead>
                    <TableHead className="text-[#1A3A5C] font-semibold hidden sm:table-cell">Email</TableHead>
                    <TableHead className="text-right w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        {search ? 'Nenhum nutricionista encontrado.' : 'Nenhum nutricionista cadastrado.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((nut) => (
                      <TableRow key={nut.id} className="hover:bg-gray-50/50">
                        <TableCell className="font-medium text-[#1A3A5C]">{nut.nome}</TableCell>
                        <TableCell>
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{nut.crn}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                          {nut.user?.email || <span className="italic text-muted-foreground/70">— sem login vinculado</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditDialog(nut)}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => setDeleteId(nut.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1A3A5C]">
              {editingId ? 'Editar Nutricionista' : 'Novo Nutricionista'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Nome completo do nutricionista"
              />
            </div>
            <div className="space-y-2">
              <Label>CRN *</Label>
              <Input
                value={form.crn}
                onChange={(e) => setForm({ ...form, crn: e.target.value })}
                placeholder="Ex: CRN-3 12345"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Vincular Usuário (opcional)</Label>
              <div className="flex gap-2">
                <Select
                  value={form.user_id || undefined}
                  onValueChange={handleUserSelect}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="— sem vínculo de login —" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.length === 0 ? (
                      <SelectItem value="_empty" disabled>
                        Nenhum usuário disponível
                      </SelectItem>
                    ) : (
                      availableUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} — {u.email}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {form.user_id && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setForm({ ...form, user_id: '' })}
                    title="Remover vínculo"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Vincular é opcional. Útil apenas se o nutricionista também acessa o sistema.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-[#1A3A5C] hover:bg-[#1A3A5C]/90">
                {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar Nutricionista'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nutricionista?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O nutricionista será removido permanentemente.
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
