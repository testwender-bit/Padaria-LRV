'use client'

import { Wheat } from 'lucide-react'

interface PrintHeaderProps {
  titulo: string
  subtitulo?: string
  semana?: string
  periodo?: string
}

export function PrintHeader({ titulo, subtitulo, semana, periodo }: PrintHeaderProps) {
  return (
    <div className="print-header print-only">
      <div className="print-header__brand">
        <div className="print-header__logo">
          <Wheat className="w-5 h-5" />
        </div>
        <div className="print-header__text">
          <h1>Padaria Municipal — Lucas do Rio Verde</h1>
          <p>Programa Nacional de Alimentação Escolar — PNAE</p>
        </div>
      </div>
      <div className="print-header__meta">
        <strong>{titulo}</strong>
        {subtitulo && (
          <>
            <br />
            {subtitulo}
          </>
        )}
        {semana && (
          <>
            <br />
            Semana: {semana}
          </>
        )}
        {periodo && (
          <>
            <br />
            {periodo}
          </>
        )}
      </div>
    </div>
  )
}
