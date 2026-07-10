'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { CalendarDays, Plus, Edit2, Save, Calendar } from 'lucide-react'
import { TIPOS_PAO } from '@/lib/unit-options'
import { getISOWeek } from 'date-fns'
import { toast } from 'sonner'

interface CardapioEntry {
  id: string
  ano: number
  semana: number
  numero_semana_iso: number
  data_inicio: string
  data_fim: string
  tipo_pao: string
  nome_pao: string
  lanche_regular_id: string | null
  lanche_bifasica_id: string | null
  obs: string | null
  lanche_regular: { id: string; nome: string } | null
  lanche_bifasica: { id: string; nome: string } | null
}

interface Lanche {
  id: string
  nome: string
  unidade: string
  ativo: boolean
}

export default function CardapioPage() {
  const [cardapio, setCardapio] = useState<CardapioEntry[]>([])
  const [lanches, setLanches] = useState<Lanche[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<CardapioEntry>>({})

  // v9.3: seletor de ano e semestre
  const anoAtual = new Date().getFullYear()
  const mesAtual = new Date().getMonth() + 1
  const [anoSel, setAnoSel] = useState<number>(anoAtual)
  const [semestreSel, setSemestreSel] = useState<number>(mesAtual >= 7 ? 2 : 1)

  // Dialog para criar novo semestre
  const [novoSemestreOpen, setNovoSemestreOpen] = useState(false)
  const [novoSemestreAno, setNovoSemestreAno] = useState<number>(anoAtual)
  const [novoSemestreNum, setNovoSemestreNum] = useState<number>(mesAtual >= 7 ? 2 : 1)
  const [novoSemestreDataInicio, setNovoSemestreDataInicio] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/cardapio').then((r) => r.json()),
      fetch('/api/lanches').then((r) => r.json()),
    ]).then(([c, l]) => {
      setCardapio(Array.isArray(c) ? c : [])
      setLanches(Array.isArray(l) ? l : [])
      setLoading(false)
    })
  }, [])

  // Anos disponíveis no banco + ano atual
  const anosDisponiveis = useMemo(() => {
    const anos = new Set(cardapio.map((c) => c.ano))
    anos.add(anoAtual)
    return Array.from(anos).sort((a, b) => b - a)
  }, [cardapio, anoAtual])

  // v9.3: filtra por ano e semestre selecionados
  // Semestre 1 = semanas 1-22 começando em fevereiro
  // Semestre 2 = semanas 1-22 começando em agosto
  // Como o banco usa semana 1-22 por ano, distinguimos por data_inicio
  const cardapioFiltrado = useMemo(() => {
    return cardapio
      .filter((c) => c.ano === anoSel)
      .filter((c) => {
        if (semestreSel === 1) {
          // 1º semestre: janeiro a junho
          const mes = new Date(c.data_inicio + 'T12:00:00').getMonth() + 1
          return mes >= 1 && mes <= 6
        } else {
          // 2º semestre: julho a dezembro
          const mes = new Date(c.data_inicio + 'T12:00:00').getMonth() + 1
          return mes >= 7 && mes <= 12
        }
      })
      .sort((a, b) => a.semana - b.semana)
  }, [cardapio, anoSel, semestreSel])

  const maxSemana = cardapioFiltrado.length > 0 ? Math.max(...cardapioFiltrado.map((c) => c.semana)) : 0
  const proximaSemana = maxSemana + 1

  async function handleSave() {
    if (!editingId) return
    try {
      const res = await fetch('/api/cardapio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      })
      if (res.ok) {
        toast.success('Cardápio atualizado!')
        setEditingId(null)
        setEditData({})
        const updated = await fetch('/api/cardapio').then((r) => r.json())
        setCardapio(Array.isArray(updated) ? updated : [])
      } else {
        toast.error('Erro ao salvar cardápio')
      }
    } catch {
      toast.error('Erro de conexão')
    }
  }

  async function handleCreateSemana() {
    if (proximaSemana > 22) {
      toast.error('Máximo de 22 semanas por semestre atingido')
      return
    }
    try {
      // Calcula a data da próxima semana baseada na última semana do semestre selecionado
      const ultima = cardapioFiltrado[cardapioFiltrado.length - 1]
      let segundaProxima: Date

      if (ultima) {
        // Continua da última semana
        const fimAnterior = new Date(ultima.data_fim + 'T12:00:00')
        segundaProxima = new Date(fimAnterior)
        segundaProxima.setDate(segundaProxima.getDate() + 3) // pula o fim de semana
        // Ajusta para segunda-feira
        const dia = segundaProxima.getDay()
        if (dia !== 1) {
          segundaProxima.setDate(segundaProxima.getDate() + (8 - dia) % 7)
        }
      } else {
        // Primeira semana do semestre
        if (semestreSel === 1) {
          // 1º semestre: começa em fevereiro
          segundaProxima = new Date(anoSel, 1, 1) // 1 de fevereiro
          const dia = segundaProxima.getDay()
          if (dia !== 1) {
            segundaProxima.setDate(segundaProxima.getDate() + (8 - dia) % 7)
          }
        } else {
          // 2º semestre: começa em agosto
          segundaProxima = new Date(anoSel, 7, 1) // 1 de agosto
          const dia = segundaProxima.getDay()
          if (dia !== 1) {
            segundaProxima.setDate(segundaProxima.getDate() + (8 - dia) % 7)
          }
        }
      }

      const sextaProxima = new Date(segundaProxima)
      sextaProxima.setDate(sextaProxima.getDate() + 4)
      const isoWeek = getISOWeek(segundaProxima)

      const res = await fetch('/api/cardapio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ano: anoSel,
          semana: proximaSemana,
          numero_semana_iso: isoWeek,
          data_inicio: segundaProxima.toISOString().split('T')[0],
          data_fim: sextaProxima.toISOString().split('T')[0],
          tipo_pao: 'PADRAO',
          nome_pao: 'Pão Francês',
        }),
      })
      if (res.ok) {
        toast.success(`Semana ${proximaSemana} criada!`)
        const updated = await fetch('/api/cardapio').then((r) => r.json())
        setCardapio(Array.isArray(updated) ? updated : [])
      }
    } catch {
      toast.error('Erro ao criar semana')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
      </div>
    )
  }

  const lanchesAtivos = lanches.filter((l) => l.ativo)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3A5C]">Cardápio Semestral</h1>
          <p className="text-sm text-muted-foreground">22 semanas letivas — define tipo de pão e lanche por semana</p>
        </div>
        {proximaSemana <= 22 && (
          <Button onClick={handleCreateSemana} className="bg-gradient-to-r from-[#1A3A5C] to-[#2C5282]">
            <Plus className="w-4 h-4 mr-1" /> Nova Semana {proximaSemana}
          </Button>
        )}
      </div>

      {/* v9.3: Seletor de Ano + Semestre */}
      <Card className="border-[#1A3A5C]/10">
        <CardContent className="p-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#1A3A5C]" />
            <Label className="text-xs font-semibold text-[#1A3A5C]">Ano:</Label>
            <Select value={String(anoSel)} onValueChange={(v) => setAnoSel(Number(v))}>
              <SelectTrigger className="w-24 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {anosDisponiveis.map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs font-semibold text-[#1A3A5C]">Semestre:</Label>
            <div className="flex gap-1 bg-muted rounded-lg p-0.5">
              <Button
                size="sm"
                variant={semestreSel === 1 ? 'default' : 'ghost'}
                onClick={() => setSemestreSel(1)}
                className={`h-7 text-xs ${semestreSel === 1 ? 'bg-[#1A3A5C] text-white' : ''}`}
              >
                1º Semestre
              </Button>
              <Button
                size="sm"
                variant={semestreSel === 2 ? 'default' : 'ghost'}
                onClick={() => setSemestreSel(2)}
                className={`h-7 text-xs ${semestreSel === 2 ? 'bg-[#1A3A5C] text-white' : ''}`}
              >
                2º Semestre
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground ml-auto">
            {cardapioFiltrado.length} semana(s) cadastrada(s)
          </div>
        </CardContent>
      </Card>

      {cardapioFiltrado.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CalendarDays className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground mb-2">
              Nenhuma semana cadastrada para {anoSel} — {semestreSel}º semestre
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Clique em "Nova Semana 1" para começar a cadastrar
            </p>
            <Button onClick={handleCreateSemana} className="bg-gradient-to-r from-[#1A3A5C] to-[#2C5282]">
              <Plus className="w-4 h-4 mr-1" /> Criar Semana 1
            </Button>
          </CardContent>
        </Card>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          {cardapioFiltrado.map((entry) => (
            <Card
              key={entry.id}
              className="border-amber-100 hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4">
                {editingId === entry.id ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 items-end">
                    <div>
                      <Label className="text-xs">Semana</Label>
                      <Input value={editData.semana || ''} disabled className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Tipo Pão</Label>
                      <Select
                        value={editData.tipo_pao || 'PADRAO'}
                        onValueChange={(v) => setEditData((prev) => ({ ...prev, tipo_pao: v }))}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TIPOS_PAO.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Nome Pão</Label>
                      <Input
                        value={editData.nome_pao || ''}
                        onChange={(e) => setEditData((prev) => ({ ...prev, nome_pao: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Lanche Regular</Label>
                      <Select
                        value={editData.lanche_regular_id || '_none'}
                        onValueChange={(v) => setEditData((prev) => ({ ...prev, lanche_regular_id: v === '_none' ? null : v }))}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Nenhum</SelectItem>
                          {lanchesAtivos.map((l) => (
                            <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Lanche Bifásica</Label>
                      <Select
                        value={editData.lanche_bifasica_id || '_none'}
                        onValueChange={(v) => setEditData((prev) => ({ ...prev, lanche_bifasica_id: v === '_none' ? null : v }))}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Nenhum</SelectItem>
                          {lanchesAtivos.map((l) => (
                            <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" onClick={handleSave} className="h-8 bg-[#1A3A5C]">
                        <Save className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditData({}) }} className="h-8">
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-[#1A3A5C]">S{entry.semana}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          {' — '}
                          {new Date(entry.data_fim + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {TIPOS_PAO.find((t) => t.value === entry.tipo_pao)?.label || entry.tipo_pao}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{entry.nome_pao}</span>
                      {entry.lanche_regular && (
                        <Badge className="bg-pink-100 text-pink-700 text-[10px]">
                          {entry.lanche_regular.nome}
                        </Badge>
                      )}
                      {entry.lanche_bifasica && (
                        <Badge className="bg-purple-100 text-purple-700 text-[10px]">
                          B: {entry.lanche_bifasica.nome}
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(entry.id)
                        setEditData(entry)
                      }}
                      className="h-8"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}
    </div>
  )
}
