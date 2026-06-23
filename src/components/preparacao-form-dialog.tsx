'use client'

// ============================================================
// PreparacaoFormDialog
// ============================================================
// Componente compartilhado (reutilizável) para criar ou editar
// uma preparação diretamente de qualquer página — sem precisar
// navegar para /nutricao/preparacoes.
//
// Uso típico dentro de um Dialog pai (ex.: "Adicionar Preparações"
// no editor de cardápio):
//
//   <PreparacaoFormDialog
//     open={prepDialogOpen}
//     onOpenChange={setPrepDialogOpen}
//     editingPrepId={prepToEdit?.id ?? null}   // null = nova
//     onSaved={(prep) => {
//       // recarregar lista de preparações no pai
//       refreshPreparacoes()
//     }}
//   />
// ============================================================

import { useEffect, useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Search, Minus, Unlock, Copy as CopyIcon, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  calcularNutrientesPreparacao,
  FASES_ESCOLARES,
  calcularPercapitaPorFase,
  type FaseEscolar,
} from '@/lib/nutricao-utils'
import {
  PREPARACAO_CATEGORIAS,
  getCategoriaInfo,
  getCategoriaCor,
  isCategoriaEspecial,
  type PreparacaoCategoria,
} from '@/lib/preparacao-categorias'
import { normalizeText } from '@/lib/busca-utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ── Types ──────────────────────────────────────────────────────

interface Alimento {
  id: string
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
}

interface PercapitaDB {
  id: string
  ingrediente_id: string
  fase_escolar: string
  quantidade_gramas: number
  auto_calculado: boolean
}

interface IngredienteForm {
  alimento_id: string
  quantidade_gramas: number
  mesma_percapita: boolean
  percapitas: PercapitaForm[]
}

interface PercapitaForm {
  fase_escolar: string
  quantidade_gramas: number
  auto_calculado: boolean
}

interface IngredienteDB {
  id: string
  alimento_id: string
  quantidade_gramas: number
  mesma_percapita: boolean
  alimento: Alimento
  percapitas: PercapitaDB[]
}

// Forma "leve" da preparação — apenas os campos que este componente precisa
export interface PreparacaoLite {
  id: string
  nome: string
  descricao: string | null
  modo_preparo: string | null
  favorita: boolean
  vezes_usada: number
  categoria?: string
  ingredientes: IngredienteDB[]
}

interface FormState {
  nome: string
  descricao: string
  modo_preparo: string
  categoria: PreparacaoCategoria
  ingredientes: IngredienteForm[]
}

const emptyForm: FormState = {
  nome: '',
  descricao: '',
  modo_preparo: '',
  categoria: 'PREPARACAO',
  ingredientes: [],
}

// ── Helpers ───────────────────────────────────────────────────

function gerarPercapitasAuto(gramasBase: number): PercapitaForm[] {
  return FASES_ESCOLARES.map((fase) => ({
    fase_escolar: fase.value,
    quantidade_gramas: calcularPercapitaPorFase(gramasBase, fase.value as FaseEscolar),
    auto_calculado: true,
  }))
}

function formatarMedidaCaseira(gramas: number, alimento: Alimento | undefined): string {
  if (!alimento || alimento.gramas_por_medida <= 0 || gramas <= 0) return '—'
  const medidas = gramas / alimento.gramas_por_medida
  if (medidas === 0) return '—'
  if (medidas >= 1) {
    const fracao = medidas % 1
    const inteiro = Math.floor(medidas)
    if (fracao === 0) return `${inteiro}x ${alimento.medida_caseira}`
    if (Math.abs(fracao - 0.5) < 0.05) return `${inteiro > 0 ? inteiro + '½' : '½'}x ${alimento.medida_caseira}`
    if (Math.abs(fracao - 0.25) < 0.05) return `${inteiro > 0 ? inteiro + '¼' : '¼'}x ${alimento.medida_caseira}`
    if (Math.abs(fracao - 0.75) < 0.05) return `${inteiro > 0 ? inteiro + '¾' : '¾'}x ${alimento.medida_caseira}`
    return `${medidas.toFixed(1)}x ${alimento.medida_caseira}`
  }
  if (Math.abs(medidas - 0.5) < 0.05) return `½x ${alimento.medida_caseira}`
  if (Math.abs(medidas - 0.25) < 0.05) return `¼x ${alimento.medida_caseira}`
  return `${medidas.toFixed(1)}x ${alimento.medida_caseira}`
}

// ── Component ─────────────────────────────────────────────────

interface PreparacaoFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** ID da preparação a editar; null = criar nova */
  editingPrepId: string | null
  /** Objeto completo da preparação sendo editada (carregado pelo pai). Obrigatório se editingPrepId != null. */
  editingPrep?: PreparacaoLite | null
  /** Callback após salvar (criar ou atualizar) com sucesso */
  onSaved?: (prep: { id: string; nome: string; isNew: boolean }) => void
  /** Callback após clonar — pai deve mudar editingPrepId para newId e manter dialog aberto */
  onCloned?: (newId: string, clonedPrep: PreparacaoLite) => void
  /** Callback após excluir preparação */
  onDeleted?: (id: string) => void
}

export function PreparacaoFormDialog({
  open,
  onOpenChange,
  editingPrepId,
  editingPrep,
  onSaved,
  onCloned,
  onDeleted,
}: PreparacaoFormDialogProps) {
  const [alimentos, setAlimentos] = useState<Alimento[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [ingSearches, setIngSearches] = useState<Record<number, string>>({})
  const [ingPopoverOpen, setIngPopoverOpen] = useState<Record<number, boolean>>({})
  const searchInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  // Carrega alimentos uma única vez quando o dialog abre
  useEffect(() => {
    if (!open) return
    if (alimentos.length > 0) return
    fetch('/api/nutricao/alimentos')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAlimentos(Array.isArray(data) ? data : []))
      .catch(() => setAlimentos([]))
  }, [open, alimentos.length])

  // Resetar/inicializar o formulário quando o dialog abre ou muda o alvo
  useEffect(() => {
    if (!open) return
    if (editingPrepId && editingPrep) {
      // Modo edição: inicializa do objeto carregado
      setForm({
        nome: editingPrep.nome,
        descricao: editingPrep.descricao || '',
        modo_preparo: editingPrep.modo_preparo || '',
        categoria: (editingPrep.categoria as PreparacaoCategoria) || 'PREPARACAO',
        ingredientes: editingPrep.ingredientes.map((ing) => ({
          alimento_id: ing.alimento_id,
          quantidade_gramas: ing.quantidade_gramas,
          mesma_percapita: ing.mesma_percapita,
          percapitas: ing.percapitas.map((pc) => ({
            fase_escolar: pc.fase_escolar,
            quantidade_gramas: pc.quantidade_gramas,
            auto_calculado: pc.auto_calculado,
          })),
        })),
      })
    } else if (!editingPrepId) {
      // Modo criação: só reseta se NÃO há editingPrepId
      // (se há editingPrepId mas editingPrep ainda não carregou, NÃO reseta — evita flash)
      setForm(emptyForm)
    }
    setIngSearches({})
    setIngPopoverOpen({})
  }, [open, editingPrepId, editingPrep])

  function getAlimentoById(id: string): Alimento | undefined {
    return alimentos.find((a) => a.id === id)
  }

  function calcularNutricaoForm(formIngredientes: IngredienteForm[]) {
    return calcularNutrientesPreparacao(
      formIngredientes
        .filter((ing) => ing.alimento_id && ing.quantidade_gramas > 0)
        .map((ing) => {
          const al = getAlimentoById(ing.alimento_id)
          return {
            quantidade_gramas: ing.quantidade_gramas,
            alimento: al || {
              energia_kcal: 0, carboidratos_g: 0, proteinas_g: 0, lipidios_g: 0,
              fibra_alimentar_g: 0, sodio_mg: 0, ferro_mg: 0, ferro_heme_mg: 0,
              vitamina_a_mcg: 0, vitamina_c_mg: 0, calcio_mg: 0, magnesio_mg: 0,
              zinco_mg: 0, acucar_adicionado_g: 0,
            },
          }
        })
    )
  }

  function addIngrediente() {
    const newIngs = [
      ...form.ingredientes,
      { alimento_id: '', quantidade_gramas: 0, mesma_percapita: false, percapitas: [] },
    ]
    setForm({ ...form, ingredientes: newIngs })
  }

  function removeIngrediente(index: number) {
    setForm({ ...form, ingredientes: form.ingredientes.filter((_, i) => i !== index) })
  }

  function updateIngrediente(index: number, field: keyof IngredienteForm, value: string | number | boolean) {
    const newIngs = [...form.ingredientes]
    const ing = { ...newIngs[index], [field]: value }

    if (field === 'quantidade_gramas' && !ing.mesma_percapita) {
      const gramasBase = Number(value) || 0
      ing.percapitas = gerarPercapitasAuto(gramasBase)
    }

    if (field === 'mesma_percapita' && value === false) {
      ing.percapitas = gerarPercapitasAuto(ing.quantidade_gramas)
    }

    if (field === 'mesma_percapita' && value === true) {
      ing.percapitas = []
    }

    newIngs[index] = ing
    setForm({ ...form, ingredientes: newIngs })
  }

  function selectAlimento(ingIdx: number, alimentoId: string) {
    updateIngrediente(ingIdx, 'alimento_id', alimentoId)
    setIngPopoverOpen({ ...ingPopoverOpen, [ingIdx]: false })
    setIngSearches({ ...ingSearches, [ingIdx]: '' })
  }

  function updatePercapitaGramas(ingIdx: number, faseEscolar: string, gramas: number) {
    const newIngs = [...form.ingredientes]
    const ing = { ...newIngs[ingIdx] }
    const pcIdx = ing.percapitas.findIndex((pc) => pc.fase_escolar === faseEscolar)

    if (pcIdx >= 0) {
      ing.percapitas = ing.percapitas.map((pc, i) =>
        i === pcIdx ? { ...pc, quantidade_gramas: gramas, auto_calculado: false } : pc
      )
    } else {
      ing.percapitas = [
        ...ing.percapitas,
        { fase_escolar: faseEscolar, quantidade_gramas: gramas, auto_calculado: false },
      ]
    }

    newIngs[ingIdx] = ing
    setForm({ ...form, ingredientes: newIngs })
  }

  function resetPercapitaAuto(ingIdx: number, faseEscolar: string) {
    const ing = form.ingredientes[ingIdx]
    const autoGramas = calcularPercapitaPorFase(ing.quantidade_gramas, faseEscolar as FaseEscolar)
    const newIngs = [...form.ingredientes]
    const newIng = { ...newIngs[ingIdx] }
    newIng.percapitas = newIng.percapitas.map((pc) =>
      pc.fase_escolar === faseEscolar ? { ...pc, quantidade_gramas: autoGramas, auto_calculado: true } : pc
    )
    newIngs[ingIdx] = newIng
    setForm({ ...form, ingredientes: newIngs })
  }

  function getPercapitaGramas(ingIdx: number, faseEscolar: string): number {
    const pc = form.ingredientes[ingIdx]?.percapitas.find((p) => p.fase_escolar === faseEscolar)
    if (pc) return pc.quantidade_gramas
    if (form.ingredientes[ingIdx]?.mesma_percapita) {
      return form.ingredientes[ingIdx]?.quantidade_gramas ?? 0
    }
    return calcularPercapitaPorFase(form.ingredientes[ingIdx]?.quantidade_gramas ?? 0, faseEscolar as FaseEscolar)
  }

  function isPercapitaAuto(ingIdx: number, faseEscolar: string): boolean {
    const pc = form.ingredientes[ingIdx]?.percapitas.find((p) => p.fase_escolar === faseEscolar)
    return pc?.auto_calculado ?? true
  }

  function getFilteredAlimentosForIng(ingIdx: number): Alimento[] {
    const searchTerm = normalizeText(ingSearches[ingIdx] || '')
    return alimentos.filter((a) => {
      if (!normalizeText(a.nome).includes(searchTerm)) return false
      if (form.ingredientes.some((fi, fiIdx) => fiIdx !== ingIdx && fi.alimento_id === a.id)) return false
      return true
    })
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      toast.error('Nome é obrigatório')
      return
    }
    if (form.ingredientes.length === 0) {
      toast.error('Adicione pelo menos um ingrediente')
      return
    }
    const hasEmpty = form.ingredientes.some((ing) => !ing.alimento_id)
    if (hasEmpty) {
      toast.error('Selecione um alimento para cada ingrediente')
      return
    }

    setSaving(true)
    try {
      const payload = {
        nome: form.nome,
        descricao: form.descricao || null,
        modo_preparo: form.modo_preparo || null,
        categoria: form.categoria,
        ingredientes: form.ingredientes.map((ing) => ({
          alimento_id: ing.alimento_id,
          quantidade_gramas: ing.quantidade_gramas,
          mesma_percapita: ing.mesma_percapita,
          percapitas: ing.mesma_percapita
            ? []
            : ing.percapitas.map((pc) => ({
                fase_escolar: pc.fase_escolar,
                quantidade_gramas: pc.quantidade_gramas,
                auto_calculado: pc.auto_calculado,
              })),
        })),
      }
      const isEditing = !!editingPrepId
      const url = isEditing ? `/api/nutricao/preparacoes/${editingPrepId}` : '/api/nutricao/preparacoes'
      const method = isEditing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Erro ao salvar preparação')
      }
      const saved = await res.json()
      toast.success(isEditing ? 'Preparação atualizada' : 'Preparação criada')
      onOpenChange(false)
      onSaved?.({ id: saved.id, nome: saved.nome, isNew: !isEditing })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  // ── Clonar preparação: cria uma NOVA preparação com os mesmos dados ──
  // Após clonar, TRANSICIONA para o modo de edição da nova prep (não fecha o dialog).
  // O nome recebe sufixo " (cópia)" — o usuário pode editar em seguida.
  // A preparação original NÃO é modificada.
  async function handleClonePrep() {
    if (!editingPrep) {
      toast.error('Nada para clonar')
      return
    }
    if (form.ingredientes.length === 0) {
      toast.error('Adicione pelo menos um ingrediente antes de clonar')
      return
    }
    const hasEmpty = form.ingredientes.some((ing) => !ing.alimento_id)
    if (hasEmpty) {
      toast.error('Selecione um alimento para cada ingrediente antes de clonar')
      return
    }

    setSaving(true)
    try {
      const payload = {
        // Sufixo " (cópia)" para o usuário identificar a cópia — editável depois
        nome: `${form.nome} (cópia)`,
        descricao: form.descricao || null,
        modo_preparo: form.modo_preparo || null,
        categoria: form.categoria,
        ingredientes: form.ingredientes.map((ing) => ({
          alimento_id: ing.alimento_id,
          quantidade_gramas: ing.quantidade_gramas,
          mesma_percapita: ing.mesma_percapita,
          percapitas: ing.mesma_percapita
            ? []
            : ing.percapitas.map((pc) => ({
                fase_escolar: pc.fase_escolar,
                quantidade_gramas: pc.quantidade_gramas,
                auto_calculado: pc.auto_calculado,
              })),
        })),
      }
      const res = await fetch('/api/nutricao/preparacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Erro ao clonar preparação')
      }
      const created = await res.json()
      // Converte resposta da API para PreparacaoLite (tipos compatíveis)
      const clonedPrepLite: PreparacaoLite = {
        id: created.id,
        nome: created.nome,
        descricao: created.descricao,
        modo_preparo: created.modo_preparo,
        favorita: created.favorita ?? false,
        vezes_usada: created.vezes_usada ?? 0,
        categoria: created.categoria,
        ingredientes: (created.ingredientes || []).map((ing: IngredienteDB) => ({
          id: ing.id,
          alimento_id: ing.alimento_id,
          quantidade_gramas: ing.quantidade_gramas,
          mesma_percapita: ing.mesma_percapita,
          alimento: ing.alimento,
          percapitas: ing.percapitas || [],
        })),
      }

      // Re-inicializa o form com a prep recém-criada (garante consistência com o que foi salvo)
      setForm({
        nome: clonedPrepLite.nome,
        descricao: clonedPrepLite.descricao || '',
        modo_preparo: clonedPrepLite.modo_preparo || '',
        categoria: (clonedPrepLite.categoria as PreparacaoCategoria) || 'PREPARACAO',
        ingredientes: clonedPrepLite.ingredientes.map((ing) => ({
          alimento_id: ing.alimento_id,
          quantidade_gramas: ing.quantidade_gramas,
          mesma_percapita: ing.mesma_percapita,
          percapitas: ing.percapitas.map((pc) => ({
            fase_escolar: pc.fase_escolar,
            quantidade_gramas: pc.quantidade_gramas,
            auto_calculado: pc.auto_calculado,
          })),
        })),
      })
      setIngSearches({})
      setIngPopoverOpen({})

      // NÃO fecha o dialog — apenas notifica o pai para:
      // 1) Atualizar editingPrepId (dialog passa a mostrar "Editar Preparação" + botões Clonar/Excluir)
      // 2) Recarregar a lista de preparações no dialog pai (para a nova cópia aparecer)
      onCloned?.(created.id, clonedPrepLite)

      toast.success(`Preparação clonada! Agora editando "${created.nome}".`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao clonar')
    } finally {
      setSaving(false)
    }
  }

  // ── Excluir preparação (apenas quando editando) ──
  async function handleDeletePrep() {
    if (!editingPrepId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/nutricao/preparacoes/${editingPrepId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Erro ao excluir preparação')
      }
      toast.success('Preparação excluída')
      setDeleteConfirmOpen(false)
      onOpenChange(false)
      onDeleted?.(editingPrepId)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir')
    } finally {
      setDeleting(false)
    }
  }

  const isEditing = !!editingPrepId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* NOTA: NÃO usar zIndex inline aqui.
          O Dialog pai ("Adicionar Preparações") usa z-50 default.
          Este sub-dialog, sendo aberto depois, aparece por cima pela ordem do DOM.
          Se tivéssemos um zIndex inline aqui (ex: 100), o AlertDialog de exclusão
          (z-50 default) ficaria ATRÁS deste dialog e o usuário não conseguiria clicar. */}
      <DialogContent className="max-w-[98vw] lg:max-w-[1280px] h-[96vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="text-[#1A3A5C] text-lg">
            {isEditing ? 'Editar Preparação' : 'Nova Preparação'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5 custom-scrollbar">
          {/* Nome, Descrição, Modo Preparo, Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Arroz com frango" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Descrição</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Opcional" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Modo de Preparo</Label>
              <Input value={form.modo_preparo} onChange={(e) => setForm({ ...form, modo_preparo: e.target.value })} placeholder="Opcional" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1">
                Categoria
                {isCategoriaEspecial(form.categoria) && (
                  <span className="text-[10px] text-[#D4A017] font-normal" title="Esta categoria recebe dia fixo na replicação para escolas">
                    (especial)
                  </span>
                )}
              </Label>
              <Select
                value={form.categoria}
                onValueChange={(v) => setForm({ ...form, categoria: v as PreparacaoCategoria })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PREPARACAO_CATEGORIAS.map((c) => (
                    <SelectItem key={c.value} value={c.value} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: c.cor }}
                        />
                        <span className="font-medium">{c.label}</span>
                        <span className="text-[10px] text-muted-foreground">— {c.descricao}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Ingredientes */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <Label className="text-sm font-semibold">Ingredientes</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Percapita base = Ens. Fund. Final (11-15 anos). Demais fases calculadas automaticamente.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={addIngrediente}>
                <Plus className="w-3 h-3 mr-1" /> Adicionar
              </Button>
            </div>

            {form.ingredientes.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum ingrediente adicionado. Clique &quot;Adicionar&quot; para começar.</p>
            ) : (
              <div className="space-y-2">
                {form.ingredientes.map((ing, idx) => {
                  const al = getAlimentoById(ing.alimento_id)
                  return (
                    <div key={idx} className="flex items-end gap-3 p-3 rounded-lg border bg-gray-50/50">
                      <div className="flex-1 min-w-[200px] space-y-1.5">
                        <Label className="text-[11px] font-medium">Alimento</Label>
                        <Popover
                          open={ingPopoverOpen[idx] || false}
                          onOpenChange={(openVal) => {
                            setIngPopoverOpen({ ...ingPopoverOpen, [idx]: openVal })
                            if (openVal) {
                              setTimeout(() => searchInputRefs.current[idx]?.focus(), 50)
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-xs h-9 font-normal">
                              {al ? (
                                <span className="truncate">{al.nome} <span className="text-muted-foreground">({al.medida_caseira})</span></span>
                              ) : (
                                <span className="text-muted-foreground">Selecionar alimento...</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[320px] p-0" align="start">
                            <div className="p-2 border-b">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                <Input
                                  ref={(el) => { searchInputRefs.current[idx] = el }}
                                  placeholder="Buscar alimento..."
                                  value={ingSearches[idx] || ''}
                                  onChange={(e) => setIngSearches({ ...ingSearches, [idx]: e.target.value })}
                                  className="h-8 text-xs pl-8"
                                />
                              </div>
                            </div>
                            <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                              {getFilteredAlimentosForIng(idx).length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-3">Nenhum alimento encontrado</p>
                              ) : (
                                getFilteredAlimentosForIng(idx).map((a) => (
                                  <button
                                    key={a.id}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-[#1A3A5C]/5 transition-colors flex items-center justify-between"
                                    onClick={() => selectAlimento(idx, a.id)}
                                  >
                                    <span className="truncate">{a.nome}</span>
                                    <span className="text-muted-foreground flex-shrink-0 ml-2 text-[10px]">
                                      {a.medida_caseira} = {a.gramas_por_medida}g
                                    </span>
                                  </button>
                                ))
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="w-32 space-y-1.5">
                        <Label className="text-[11px] font-medium">Percapita (g) *</Label>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          value={ing.quantidade_gramas || ''}
                          onChange={(e) => updateIngrediente(idx, 'quantidade_gramas', Number(e.target.value))}
                          className="h-9 text-xs"
                          placeholder="0"
                        />
                      </div>

                      <div className="w-44 space-y-1.5">
                        <Label className="text-[11px] font-medium">Medida Caseira</Label>
                        <div className="h-9 px-3 flex items-center text-xs text-muted-foreground bg-gray-100 rounded-md border truncate">
                          {al ? formatarMedidaCaseira(ing.quantidade_gramas, al) : '—'}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pb-0.5 flex-shrink-0">
                        <Checkbox
                          id={`mesma-${idx}-sub`}
                          checked={ing.mesma_percapita}
                          onCheckedChange={(checked) => updateIngrediente(idx, 'mesma_percapita', !!checked)}
                          className="h-4 w-4"
                        />
                        <Label htmlFor={`mesma-${idx}-sub`} className="text-[10px] text-muted-foreground whitespace-nowrap cursor-pointer leading-tight">
                          Mesma p/c<br/>todas fases
                        </Label>
                      </div>

                      <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-500 flex-shrink-0" onClick={() => removeIngrediente(idx)}>
                        <Minus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Percapita por Fase Escolar */}
          {form.ingredientes.length > 0 && form.ingredientes.some((ing) => ing.alimento_id) && (
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Label className="text-sm font-semibold">Percapita por Fase Escolar</Label>
                <span className="text-[11px] text-muted-foreground">(base = Ens. Fund. Final 100%)</span>
              </div>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#1A3A5C]/5">
                      <th className="text-left px-3 py-2 font-semibold text-[#1A3A5C] whitespace-nowrap min-w-[140px]">
                        Ingrediente
                      </th>
                      <th className="text-center px-3 py-2 font-semibold text-[#1A3A5C] whitespace-nowrap min-w-[80px]">
                        Base (g)
                      </th>
                      {FASES_ESCOLARES.map((fase) => (
                        <th key={fase.value} className="text-center px-2 py-2 whitespace-nowrap min-w-[100px]" style={{ color: fase.cor }}>
                          <div className="font-semibold text-[11px]">{fase.label}</div>
                          <div className="font-normal text-[9px] opacity-70">{fase.faixa} ({fase.percentual}%)</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {form.ingredientes.map((ing, idx) => {
                      const al = getAlimentoById(ing.alimento_id)
                      if (!al) return null
                      return (
                        <tr key={idx} className="border-t hover:bg-gray-50/50">
                          <td className="px-3 py-2 text-[11px]">
                            <div className="truncate max-w-[160px]" title={al.nome}>{al.nome}</div>
                            {ing.mesma_percapita && (
                              <Badge className="bg-green-100 text-green-700 text-[8px] py-0 px-1 mt-0.5">
                                Mesma p/c todas
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center font-semibold text-[#1A3A5C] text-[12px]">
                            {ing.quantidade_gramas.toFixed(0)}g
                          </td>
                          {FASES_ESCOLARES.map((fase) => {
                            if (ing.mesma_percapita) {
                              return (
                                <td key={fase.value} className="px-2 py-2 text-center">
                                  <div className="flex flex-col items-center">
                                    <span className="text-[11px] font-medium">{ing.quantidade_gramas.toFixed(0)}g</span>
                                    <span className="text-[9px] text-muted-foreground">
                                      {formatarMedidaCaseira(ing.quantidade_gramas, al)}
                                    </span>
                                  </div>
                                </td>
                              )
                            }

                            const gramas = getPercapitaGramas(idx, fase.value)
                            const isAuto = isPercapitaAuto(idx, fase.value)

                            return (
                              <td key={fase.value} className="px-2 py-2 text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  <Input
                                    type="number"
                                    step="1"
                                    min="0"
                                    value={gramas || ''}
                                    onChange={(e) => updatePercapitaGramas(idx, fase.value, Number(e.target.value))}
                                    className={`h-7 w-[72px] text-[10px] text-center px-1 ${!isAuto ? 'border-orange-400 bg-orange-50' : ''}`}
                                    placeholder="—"
                                  />
                                  <span className="text-[9px] text-muted-foreground">
                                    {formatarMedidaCaseira(gramas, al)}
                                  </span>
                                  {!isAuto && (
                                    <button
                                      className="text-[8px] text-orange-500 hover:text-orange-700 flex items-center gap-0.5"
                                      onClick={() => resetPercapitaAuto(idx, fase.value)}
                                      title="Restaurar cálculo automático"
                                    >
                                      <Unlock className="w-2.5 h-2.5" /> auto
                                    </button>
                                  )}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Células em <span className="text-orange-500 font-medium">laranja</span> = valor editado manualmente. Clique &quot;auto&quot; para restaurar.
                Itens como fruta: marque &quot;Mesma p/c todas fases&quot;.
              </p>
            </div>
          )}

          {/* Nutritional Preview */}
          {form.ingredientes.some((ing) => ing.alimento_id && ing.quantidade_gramas > 0) && (
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Preview Nutricional (Fund. Final)</p>
              {(() => {
                const nut = calcularNutricaoForm(form.ingredientes)
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded bg-amber-50 border border-amber-100">
                      <p className="text-muted-foreground text-[11px]">Energia</p>
                      <p className="font-semibold text-amber-800">{nut.energia_kcal.toFixed(0)} kcal</p>
                    </div>
                    <div className="p-2.5 rounded bg-blue-50 border border-blue-100">
                      <p className="text-muted-foreground text-[11px]">Carboidratos</p>
                      <p className="font-semibold text-blue-800">{nut.carboidratos_g.toFixed(1)} g</p>
                    </div>
                    <div className="p-2.5 rounded bg-red-50 border border-red-100">
                      <p className="text-muted-foreground text-[11px]">Proteínas</p>
                      <p className="font-semibold text-red-800">{nut.proteinas_g.toFixed(1)} g</p>
                    </div>
                    <div className="p-2.5 rounded bg-yellow-50 border border-yellow-100">
                      <p className="text-muted-foreground text-[11px]">Lipídios</p>
                      <p className="font-semibold text-yellow-800">{nut.lipidios_g.toFixed(1)} g</p>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 px-6 py-3 border-t flex-shrink-0 bg-gray-50/50">
          {/* Lado esquerdo: botões Clonar + Excluir (apenas quando editando) */}
          <div className="flex gap-2">
            {isEditing && (
              <>
                <Button
                  variant="outline"
                  onClick={handleClonePrep}
                  disabled={saving || deleting}
                  className="text-amber-700 border-amber-300 hover:bg-amber-50 hover:text-amber-800"
                  title="Cria uma cópia desta preparação com sufixo ' (cópia)' no nome e abre para edição. A original não é modificada."
                >
                  <CopyIcon className="w-3.5 h-3.5 mr-1.5" />
                  {saving ? 'Clonando...' : 'Clonar'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={saving || deleting}
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  title="Exclui permanentemente esta preparação"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Excluir
                </Button>
              </>
            )}
          </div>
          {/* Lado direito: Cancelar + Salvar */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || deleting}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || deleting} className="bg-[#1A3A5C] hover:bg-[#1A3A5C]/90">
              {saving ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar Preparação'}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Confirmação de exclusão — AlertDialog separado para não conflitar com o Dialog principal */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir preparação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A preparação
              {' '}
              <span className="font-semibold text-foreground">&quot;{form.nome}&quot;</span>
              {' '}
              será removida permanentemente do banco de dados.
              {' '}
              {editingPrep?.vezes_usada && editingPrep.vezes_usada > 0 && (
                <span className="block mt-1 text-amber-600">
                  ⚠️ Esta preparação já foi usada {editingPrep.vezes_usada}× em cardápios — excluindo, ela deixará de aparecer para novas adições (itens já adicionados em cardápios não são afetados).
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePrep}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Excluindo...' : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

// Tipos auxiliares já exportados acima (PreparacaoLite, Alimento via 'export interface')
// e funções getCategoriaInfo / getCategoriaCor podem ser importadas diretamente de
// '@/lib/preparacao-categorias' pelo consumidor.
