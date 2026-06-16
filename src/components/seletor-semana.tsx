'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { inicioSemana, fimSemana, numeroSemana, anoSemana, formatarPeriodoSemana, semanaAdjacente, dataISO } from '@/lib/date-utils'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { useAppStore } from '@/store/app-store'

interface SeletorSemanaProps {
  onChange?: (inicio: Date, fim: Date, semana: number, ano: number) => void
}

export function SeletorSemana({ onChange }: SeletorSemanaProps) {
  const { semanaReferencia, setSemanaReferencia } = useAppStore()
  const [refDate, setRefDate] = useState<Date>(() => {
    if (semanaReferencia) return new Date(semanaReferencia + 'T12:00:00')
    return new Date()
  })

  useEffect(() => {
    const inicio = inicioSemana(refDate)
    setSemanaReferencia(dataISO(inicio))
    onChange?.(inicio, fimSemana(refDate), numeroSemana(refDate), anoSemana(refDate))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refDate, setSemanaReferencia])

  const irPara = useCallback((offset: number) => {
    setRefDate((prev) => semanaAdjacente(prev, offset))
  }, [])

  const irParaHoje = useCallback(() => {
    setRefDate(new Date())
  }, [])

  const inicio = inicioSemana(refDate)
  const fim = fimSemana(refDate)
  const semana = numeroSemana(refDate)
  const ano = anoSemana(refDate)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button variant="outline" size="icon" onClick={() => irPara(-1)} className="h-8 w-8 border-amber-200 hover:bg-amber-50">
        <ChevronLeft className="w-4 h-4" />
      </Button>

      <div className="flex items-center gap-2 bg-gradient-to-r from-[#1A3A5C] to-[#2C5282] text-white px-4 py-2 rounded-lg shadow-md">
        <Calendar className="w-4 h-4 text-[#D4A017]" />
        <span className="text-sm font-semibold">Semana {semana}</span>
        <span className="text-xs text-blue-200">— {formatarPeriodoSemana(inicio, fim)}</span>
      </div>

      <Button variant="outline" size="icon" onClick={() => irPara(1)} className="h-8 w-8 border-amber-200 hover:bg-amber-50">
        <ChevronRight className="w-4 h-4" />
      </Button>

      <Button variant="ghost" size="sm" onClick={irParaHoje} className="text-xs text-muted-foreground hover:text-[#1A3A5C]">
        Hoje
      </Button>
    </div>
  )
}
