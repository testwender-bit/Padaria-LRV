'use client'

import { useEffect, useState, useCallback, useRef, useMemo, memo } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChefHat, Plus, Search, Pencil, Trash2, ChevronDown, ChevronUp, RefreshCw, X, Minus, Unlock, Check, Star, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { calcularNutrientesPreparacao, FASES_ESCOLARES, calcularPercapitaPorFase, type FaseEscolar } from '@/lib/nutricao-utils'
import { PREPARACAO_CATEGORIAS, getCategoriaInfo, getCategoriaCor, isCategoriaEspecial, type PreparacaoCategoria } from '@/lib/preparacao-categorias'
import { normalizeText } from '@/lib/busca-utils'

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

interface Preparacao {
  id: string
  nome: string
  descricao: string | null
  modo_preparo: string | null
  ativo: boolean
  favorita: boolean
  vezes_usada: number
  categoria?: string  // v8: PREPARACAO | PAO | LANCHE | BEBIDA | SOBREMESA
  ingredientes: IngredienteDB[]
}

interface FormState {
  nome: string
  descricao: string
  modo_preparo: string
  categoria: PreparacaoCategoria  // v8
  ingredientes: IngredienteForm[]
}

const emptyForm: FormState = {
  nome: '',
  descricao: '',
  modo_preparo: '',
  categoria: 'PREPARACAO',
  ingredientes: [],
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
}

function gerarPercapitasAuto(gramasBase: number): PercapitaForm[] {
  return FASES_ESCOLARES.map((fase) => ({
    fase_escolar: fase.value,
    quantidade_gramas: calcularPercapitaPorFase(gramasBase, fase.value as FaseEscolar),
    auto_calculado: true,
  }))
}

// ── v8: Componente card memoizado ──
// Antes: cada card era renderizado inline no map, re-renderizando TODOS os 173 cards
// a cada keystroke (cada um com cálculo nutricional + alérgenos + percapitas = 1+ segundo).
// Agora: memoizado com React.memo — só re-renderiza quando suas props mudam.
// Como as props são estáveis (callbacks via useCallback), o React pula re-render
// dos cards que não mudaram, fazendo a busca ficar instantânea.

interface PreparacaoCardProps {
  prep: Preparacao
  isExpanded: boolean
  onToggleExpand: () => void
  onToggleFavorita: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
}

function formatarMedidaCaseira(gramas: number, alimento: Alimento): string {
  if (!alimento.gramas_por_medida || alimento.gramas_por_medida === 0) return ''
  const medidas = gramas / alimento.gramas_por_medida
  if (medidas < 0.1) return ''
  if (Math.abs(medidas - Math.round(medidas)) < 0.05) {
    return `${Math.round(medidas)}x ${alimento.medida_caseira}`
  }
  if (Math.abs(medidas - 0.5) < 0.05) return `½x ${alimento.medida_caseira}`
  if (Math.abs(medidas - 0.25) < 0.05) return `¼x ${alimento.medida_caseira}`
  return `${medidas.toFixed(1)}x ${alimento.medida_caseira}`
}

const PreparacaoCard = memo(function PreparacaoCard({
  prep,
  isExpanded,
  onToggleExpand,
  onToggleFavorita,
  onEdit,
  onDelete,
  onDuplicate,
}: PreparacaoCardProps) {
  // Cálculos memoizados — só recalcula quando `prep` muda
  const nutricionais = useMemo(() => calcularNutricaoPrepStandalone(prep.ingredientes), [prep])
  const hasPercapitas = useMemo(
    () => prep.ingredientes.some((ing) => !ing.mesma_percapita && ing.percapitas && ing.percapitas.length > 0),
    [prep]
  )

  return (
    <div>
      <Card className="border-[#1A3A5C]/10 hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {prep.favorita && (
                  <Star className="w-3.5 h-3.5 text-[#D4A017] flex-shrink-0 fill-[#D4A017]" />
                )}
                <CardTitle className="text-sm font-semibold text-[#1A3A5C] truncate">{prep.nome}</CardTitle>
                {prep.categoria && prep.categoria !== 'PREPARACAO' && (
                  <Badge
                    variant="outline"
                    className="text-[9px] h-4 px-1 flex items-center gap-0.5"
                    style={{
                      borderColor: getCategoriaCor(prep.categoria),
                      color: getCategoriaCor(prep.categoria),
                    }}
                    title={getCategoriaInfo(prep.categoria).descricao}
                  >
                    {getCategoriaInfo(prep.categoria).label}
                  </Badge>
                )}
              </div>
              {prep.descricao && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{prep.descricao}</p>
              )}
            </div>
            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title={prep.favorita ? 'Desfavoritar' : 'Marcar como favorita'}
                onClick={onToggleFavorita}
              >
                <Star
                  className={`w-3 h-3 ${prep.favorita ? 'text-[#D4A017] fill-[#D4A017]' : 'text-gray-400'}`}
                />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEdit} title="Editar">
                <Pencil className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50" onClick={onDuplicate} title="Duplicar preparação">
                <Copy className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={onDelete} title="Excluir">
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]">
              {prep.ingredientes.length} ingrediente{prep.ingredientes.length !== 1 ? 's' : ''}
            </Badge>
            <Badge className="bg-amber-100 text-amber-700 text-[10px] hover:bg-amber-100">
              {nutricionais.energia_kcal.toFixed(0)} kcal
            </Badge>
            <Badge className="bg-blue-100 text-blue-700 text-[10px] hover:bg-blue-100">
              P {nutricionais.proteinas_g.toFixed(1)}g
            </Badge>
            {hasPercapitas && (
              <Badge className="bg-purple-100 text-purple-700 text-[10px] hover:bg-purple-100">
                Percapita
              </Badge>
            )}
          </div>

          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-[#1A3A5C] transition-colors w-full"
            onClick={onToggleExpand}
          >
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {isExpanded ? 'Ocultar' : 'Ver'} ingredientes
          </button>

          {isExpanded && (
            <div className="space-y-1 border-t pt-2">
              {prep.ingredientes.map((ing) => (
                <div key={ing.id} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1">{ing.alimento.nome}</span>
                  <span className="text-muted-foreground ml-2 flex-shrink-0">
                    {ing.quantidade_gramas.toFixed(0)}g — {formatarMedidaCaseira(ing.quantidade_gramas, ing.alimento)}
                    {ing.mesma_percapita && <span className="ml-1 text-green-600">✓</span>}
                  </span>
                </div>
              ))}
              {hasPercapitas && (
                <div className="border-t pt-2 mt-2">
                  <p className="text-[10px] font-semibold text-purple-700 mb-1">Percapitas por Fase Escolar</p>
                  <div className="space-y-0.5">
                    {prep.ingredientes
                      .filter((ing) => !ing.mesma_percapita && ing.percapitas && ing.percapitas.length > 0)
                      .map((ing) => (
                        <div key={ing.id} className="text-[10px]">
                          <span className="font-medium">{ing.alimento.nome}:</span>{' '}
                          {ing.percapitas.map((pc) => {
                            const faseLabel = FASES_ESCOLARES.find(f => f.value === pc.fase_escolar)?.label ?? pc.fase_escolar
                            return (
                              <span key={pc.fase_escolar} className="text-muted-foreground mr-2">
                                {faseLabel}={pc.quantidade_gramas.toFixed(0)}g
                                {!pc.auto_calculado && <span className="text-orange-500">*</span>}
                              </span>
                            )
                          })}
                        </div>
                      ))}
                  </div>
                </div>
              )}
              <div className="border-t pt-2 mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Energia:</span><span className="font-medium">{nutricionais.energia_kcal.toFixed(0)} kcal</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Carboidratos:</span><span className="font-medium">{nutricionais.carboidratos_g.toFixed(1)} g</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Proteínas:</span><span className="font-medium">{nutricionais.proteinas_g.toFixed(1)} g</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Lipídios:</span><span className="font-medium">{nutricionais.lipidios_g.toFixed(1)} g</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Fibra:</span><span className="font-medium">{nutricionais.fibra_alimentar_g.toFixed(1)} g</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Sódio:</span><span className="font-medium">{nutricionais.sodio_mg.toFixed(0)} mg</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Ferro:</span><span className="font-medium">{nutricionais.ferro_mg.toFixed(1)} mg</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Vit A:</span><span className="font-medium">{nutricionais.vitamina_a_mcg.toFixed(0)} mcg</span></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
})

// v8: versão standalone de calcularNutricaoPrep (não depende do componente)
function calcularNutricaoPrepStandalone(ingredientes: IngredienteDB[]) {
  return calcularNutrientesPreparacao(
    ingredientes.map((ing) => ({
      quantidade_gramas: ing.quantidade_gramas,
      alimento: ing.alimento,
    }))
  )
}

export default function PreparacoesPage() {
  const [preparacoes, setPreparacoes] = useState<Preparacao[]>([])
  const [alimentos, setAlimentos] = useState<Alimento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  // Per-ingredient search state: map of ingredient index to search string
  const [ingSearches, setIngSearches] = useState<Record<number, string>>({})
  // Per-ingredient popover open state
  const [ingPopoverOpen, setIngPopoverOpen] = useState<Record<number, boolean>>({})

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const searchInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  // ── v8: Busca SERVER-SIDE com debounce ──
  // Arquitetura: debounce de 300ms → busca na API → mostra apenas resultados
  // Importante: NÃO mostra loading durante a busca (só mostra "Buscando..." sutil)
  // para evitar refresh visual.
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)

  const loadData = useCallback(async (busca?: string) => {
    setLoading(true)
    setError(null)
    try {
      const url = busca
        ? `/api/nutricao/preparacoes?light=true&busca=${encodeURIComponent(busca)}`
        : '/api/nutricao/preparacoes?light=true'
      const [prepRes, alRes] = await Promise.all([
        fetch(url),
        fetch('/api/nutricao/alimentos'),
      ])
      if (!prepRes.ok) throw new Error('Erro ao carregar preparações')
      const prepData = await prepRes.json()
      const alData = await alRes.json()
      setPreparacoes(Array.isArray(prepData) ? prepData : [])
      setAlimentos(Array.isArray(alData) ? alData : [])
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar os dados.')
    } finally {
      setLoading(false)
      setSearching(false)
    }
  }, [])

  // Carrega tudo na primeira vez (sem busca)
  useEffect(() => {
    loadData()
  }, [loadData])

  // Busca com debounce: 300ms após parar de digitar → busca na API
  // NÃO causa refresh visual — mantém a lista atual até a resposta chegar
  useEffect(() => {
    if (search === '') return  // não busca se vazio (lista já está completa)
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const url = `/api/nutricao/preparacoes?light=true&busca=${encodeURIComponent(search)}`
        const prepRes = await fetch(url)
        if (!prepRes.ok) throw new Error('Erro ao buscar')
        const prepData = await prepRes.json()
        setPreparacoes(Array.isArray(prepData) ? prepData : [])
      } catch (err) {
        console.error(err)
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  // Quando limpa a busca (clica no X), recarrega tudo
  async function handleClearSearch() {
    setSearch('')
    try {
      const prepRes = await fetch('/api/nutricao/preparacoes?light=true')
      if (!prepRes.ok) return
      const prepData = await prepRes.json()
      setPreparacoes(Array.isArray(prepData) ? prepData : [])
    } catch (err) {
      console.error(err)
    }
  }

  // Sem filtro no cliente — a API já retorna apenas resultados filtrados
  const filtered = preparacoes

  function getAlimentoById(id: string): Alimento | undefined {
    return alimentos.find((a) => a.id === id)
  }

  function calcularNutricaoPrep(ingredientes: IngredienteDB[]) {
    return calcularNutrientesPreparacao(
      ingredientes.map((ing) => ({
        quantidade_gramas: ing.quantidade_gramas,
        alimento: ing.alimento,
      }))
    )
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

  function openNewDialog() {
    setEditingId(null)
    setForm(emptyForm)
    setIngSearches({})
    setIngPopoverOpen({})
    setDialogOpen(true)
  }

  // v8: Duplicar preparação — abre dialog de novo preenchido com dados da prep original
  async function openDuplicateDialog(prep: Preparacao) {
    setEditingId(null)  // null = modo criação (POST)
    // Busca ingredientes completos (a listagem vem sem percapitas)
    let ingredientesCompletos = prep.ingredientes || []
    const hasPercapitas = ingredientesCompletos.some(
      (ing) => !ing.mesma_percapita && ing.percapitas && ing.percapitas.length > 0
    )
    if (!hasPercapitas && ingredientesCompletos.length > 0) {
      try {
        const res = await fetch(`/api/nutricao/preparacoes/${prep.id}`)
        if (res.ok) {
          const full = await res.json()
          ingredientesCompletos = full.ingredientes || []
        }
      } catch (err) {
        console.error('Erro ao carregar ingredientes:', err)
      }
    }

    setForm({
      nome: `${prep.nome} (cópia)`,
      descricao: prep.descricao || '',
      modo_preparo: prep.modo_preparo || '',
      categoria: (prep.categoria as PreparacaoCategoria) || 'PREPARACAO',
      ingredientes: ingredientesCompletos.map((ing) => ({
        alimento_id: ing.alimento_id,
        quantidade_gramas: ing.quantidade_gramas,
        mesma_percapita: ing.mesma_percapita,
        percapitas: ing.percapitas?.map((pc) => ({
          fase_escolar: pc.fase_escolar,
          quantidade_gramas: pc.quantidade_gramas,
          auto_calculado: pc.auto_calculado,
        })) || [],
      })),
    })
    setIngSearches({})
    setIngPopoverOpen({})
    setDialogOpen(true)
    toast.info(`Duplicando "${prep.nome}" — ajuste o nome e salve`)
  }

  async function openEditDialog(prep: Preparacao) {
    setEditingId(prep.id)
    // ── Sempre busca a preparação COMPLETA (com percapitas) ao editar ──
    // A listagem vem sem percapitas (light mode) — precisamos delas para editar.
    let ingredientesCompletos = prep.ingredientes || []
    const hasPercapitas = ingredientesCompletos.some(
      (ing) => !ing.mesma_percapita && ing.percapitas && ing.percapitas.length > 0
    )
    if (!hasPercapitas && ingredientesCompletos.length > 0) {
      // Provavelmente veio do light mode (sem percapitas) — busca versão completa
      try {
        const res = await fetch(`/api/nutricao/preparacoes/${prep.id}`)
        if (res.ok) {
          const full = await res.json()
          ingredientesCompletos = full.ingredientes || []
        }
      } catch (err) {
        console.error('Erro ao carregar ingredientes:', err)
      }
    }

    setForm({
      nome: prep.nome,
      descricao: prep.descricao || '',
      modo_preparo: prep.modo_preparo || '',
      categoria: (prep.categoria as PreparacaoCategoria) || 'PREPARACAO',
      ingredientes: ingredientesCompletos.map((ing) => ({
        alimento_id: ing.alimento_id,
        quantidade_gramas: ing.quantidade_gramas,
        mesma_percapita: ing.mesma_percapita,
        percapitas: ing.percapitas?.map((pc) => ({
          fase_escolar: pc.fase_escolar,
          quantidade_gramas: pc.quantidade_gramas,
          auto_calculado: pc.auto_calculado,
        })) || [],
      })),
    })
    setIngSearches({})
    setIngPopoverOpen({})
    setDialogOpen(true)
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
    // Close popover
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
        categoria: form.categoria,  // v8
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
      const url = editingId ? `/api/nutricao/preparacoes/${editingId}` : '/api/nutricao/preparacoes'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Erro ao salvar preparação')
      }
      toast.success(editingId ? 'Preparação atualizada' : 'Preparação criada')
      setDialogOpen(false)
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function toggleFavorita(prepId: string, atual: boolean) {
    try {
      const res = await fetch(`/api/nutricao/preparacoes/${prepId}/favorita`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorita: !atual }),
      })
      if (!res.ok) throw new Error('Erro ao alternar favorita')
      // Atualiza estado local
      setPreparacoes((prev) =>
        prev.map((p) => (p.id === prepId ? { ...p, favorita: !atual } : p))
      )
      toast.success(atual ? 'Desfavoritada' : 'Marcada como favorita')
    } catch {
      toast.error('Erro ao alternar favorita')
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/nutricao/preparacoes/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao excluir')
      toast.success('Preparação excluída')
      setDeleteId(null)
      loadData()
    } catch {
      toast.error('Erro ao excluir preparação')
    } finally {
      setDeleting(false)
    }
  }

  /** Converte gramas para medida caseira formatada */
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

  function getFilteredAlimentosForIng(ingIdx: number): Alimento[] {
    // v8: busca sem acento (normalizeText)
    const searchTerm = normalizeText(ingSearches[ingIdx] || '')
    return alimentos.filter((a) => {
      if (!normalizeText(a.nome).includes(searchTerm)) return false
      if (form.ingredientes.some((fi, fiIdx) => fiIdx !== ingIdx && fi.alimento_id === a.id)) return false
      return true
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
          <span className="text-muted-foreground">Carregando preparações...</span>
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
            <ChefHat className="w-6 h-6 text-amber-600" />
            Preparações
          </h1>
          <p className="text-sm text-muted-foreground">
            Receitas e preparações para os cardápios — {preparacoes.length} cadastradas
          </p>
        </div>
        <Button onClick={openNewDialog} className="bg-[#1A3A5C] hover:bg-[#1A3A5C]/90">
          <Plus className="w-4 h-4 mr-1" /> Nova Preparação
        </Button>
      </motion.div>

      {/* Search */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar preparação..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 max-w-md" />
          {search && (
            <button onClick={handleClearSearch} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
      </motion.div>

      {/* Error */}
      {error && (
        <div className="text-center py-8">
          <p className="text-sm text-red-500 mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={() => loadData()}>
            <RefreshCw className="w-3 h-3 mr-1" /> Tentar novamente
          </Button>
        </div>
      )}

      {/* Cards */}
      {!error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              {search ? 'Nenhuma preparação encontrada.' : 'Nenhuma preparação cadastrada.'}
            </div>
          ) : (
            <>
              {/* v8: Busca server-side — API retorna apenas resultados filtrados */}
              {/* Sem paginação necessária: a API já filtra, cliente só exibe */}
              {searching && (
                <div className="col-span-full text-center py-4 text-muted-foreground">
                  <RefreshCw className="w-4 h-4 inline animate-spin mr-1" />
                  Buscando...
                </div>
              )}
              {!searching && filtered.map((prep) => (
                <PreparacaoCard
                  key={prep.id}
                  prep={prep}
                  isExpanded={expandedId === prep.id}
                  onToggleExpand={() => setExpandedId(expandedId === prep.id ? null : prep.id)}
                  onToggleFavorita={() => toggleFavorita(prep.id, prep.favorita)}
                  onEdit={() => openEditDialog(prep)}
                  onDelete={() => setDeleteId(prep.id)}
                  onDuplicate={() => openDuplicateDialog(prep)}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          CREATE / EDIT DIALOG — Full-screen approach
          ═══════════════════════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] lg:max-w-[1100px] h-[95vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <DialogTitle className="text-[#1A3A5C] text-lg">
              {editingId ? 'Editar Preparação' : 'Nova Preparação'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
            {/* Nome, Descrição, Modo Preparo, Categoria (v8) */}
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
              {/* v8: Select de Categoria */}
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
                        {/* Alimento com Popover search */}
                        <div className="flex-1 min-w-[200px] space-y-1.5">
                          <Label className="text-[11px] font-medium">Alimento</Label>
                          <Popover
                            open={ingPopoverOpen[idx] || false}
                            onOpenChange={(open) => {
                              setIngPopoverOpen({ ...ingPopoverOpen, [idx]: open })
                              if (open) {
                                // Focus search input when opening
                                setTimeout(() => searchInputRefs.current[idx]?.focus(), 50)
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-xs h-9 font-normal"
                              >
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
                              <div className="max-h-[200px] overflow-y-auto">
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

                        {/* Percapita (gramas) */}
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

                        {/* Medida caseira (auto) */}
                        <div className="w-44 space-y-1.5">
                          <Label className="text-[11px] font-medium">Medida Caseira</Label>
                          <div className="h-9 px-3 flex items-center text-xs text-muted-foreground bg-gray-100 rounded-md border truncate">
                            {al ? formatarMedidaCaseira(ing.quantidade_gramas, al) : '—'}
                          </div>
                        </div>

                        {/* Mesma percapita checkbox */}
                        <div className="flex items-center gap-1.5 pb-0.5 flex-shrink-0">
                          <Checkbox
                            id={`mesma-${idx}`}
                            checked={ing.mesma_percapita}
                            onCheckedChange={(checked) => updateIngrediente(idx, 'mesma_percapita', !!checked)}
                            className="h-4 w-4"
                          />
                          <Label htmlFor={`mesma-${idx}`} className="text-[10px] text-muted-foreground whitespace-nowrap cursor-pointer leading-tight">
                            Mesma p/c<br/>todas fases
                          </Label>
                        </div>

                        {/* Remove */}
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

          <div className="flex justify-end gap-2 px-6 py-3 border-t flex-shrink-0 bg-gray-50/50">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#1A3A5C] hover:bg-[#1A3A5C]/90">
              {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar Preparação'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir preparação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A preparação será removida permanentemente.
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
