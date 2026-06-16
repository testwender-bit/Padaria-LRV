'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { PRODUTOS_AJUSTE } from '@/lib/unit-options'
import { DIAS_SEMANA, DIAS_LABEL } from '@/lib/date-utils'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'

interface AjusteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  escolaId: string
  escolaNome: string
  diaSemana: string
  produto: string
  quantidadeOriginal: number
  ano: number
  semana: number
  onSaved: () => void
}

export function AjusteDialog({
  open,
  onOpenChange,
  escolaId,
  escolaNome,
  diaSemana,
  produto,
  quantidadeOriginal,
  ano,
  semana,
  onSaved,
}: AjusteDialogProps) {
  const [qtdFinal, setQtdFinal] = useState(quantidadeOriginal)
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setQtdFinal(quantidadeOriginal)
    setMotivo('')
  }, [quantidadeOriginal, open])

  const ajuste = qtdFinal - quantidadeOriginal

  async function handleSave() {
    if (!motivo.trim()) {
      toast.error('Informe o motivo do ajuste')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ano,
          semana,
          escola_id: escolaId,
          dia_semana: diaSemana,
          produto,
          qtd_original: quantidadeOriginal,
          ajuste,
          qtd_final: qtdFinal,
          motivo,
        }),
      })
      if (res.ok) {
        toast.success('Ajuste salvo com sucesso!')
        onSaved()
        onOpenChange(false)
      } else {
        toast.error('Erro ao salvar ajuste')
      }
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      const res = await fetch(`/api/ajustes?ano=${ano}&semana=${semana}&escola_id=${escolaId}&dia_semana=${diaSemana}&produto=${produto}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Ajuste removido!')
        onSaved()
        onOpenChange(false)
      } else {
        toast.error('Erro ao remover ajuste')
      }
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setSaving(false)
    }
  }

  const produtoLabel = PRODUTOS_AJUSTE.find((p) => p.value === produto)?.label || produto
  const diaLabel = DIAS_LABEL[diaSemana as keyof typeof DIAS_LABEL] || diaSemana

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#1A3A5C]">Ajustar Quantidade</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm font-medium text-amber-900">{escolaNome}</p>
            <p className="text-xs text-amber-700">
              {diaLabel} · {produtoLabel}
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Quantidade original: <span className="font-mono font-bold">{quantidadeOriginal.toLocaleString('pt-BR')}</span>
            </p>
          </div>

          <div>
            <Label>Quantidade Final</Label>
            <Input
              type="number"
              min={0}
              value={qtdFinal}
              onChange={(e) => setQtdFinal(parseInt(e.target.value) || 0)}
              className="h-10"
            />
            {ajuste !== 0 && (
              <p className={`text-xs mt-1 ${ajuste > 0 ? 'text-green-600' : 'text-red-600'}`}>
                Delta: {ajuste > 0 ? '+' : ''}{ajuste} ({ajuste > 0 ? 'acréscimo' : 'redução'})
              </p>
            )}
          </div>

          <div>
            <Label>Motivo do Ajuste <span className="text-red-500">*</span></Label>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Feriado escolar, demanda reduzida..."
              className="h-10"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-gradient-to-r from-[#1A3A5C] to-[#2C5282]"
            >
              Salvar Ajuste
            </Button>
            {qtdFinal !== quantidadeOriginal && (
              <Button
                variant="outline"
                onClick={() => setQtdFinal(quantidadeOriginal)}
                className="border-amber-200"
              >
                Resetar
              </Button>
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={saving}
              className="text-xs"
            >
              <Trash2 className="w-3 h-3 mr-1" /> Remover Ajuste
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
