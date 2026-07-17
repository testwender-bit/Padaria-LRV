'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { SeletorSemana } from '@/components/seletor-semana'
import { AjusteDialog } from '@/components/ajuste-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Wheat,
  Package,
  Cookie,
  Printer,
  AlertTriangle,
  AlertCircle,
  Table2,
  Calendar,
} from 'lucide-react'
import Link from 'next/link'
import { formatarData, numeroSemana, anoSemana, inicioSemana, fimSemana, formatarPeriodoSemana, dataISO, DIAS_SEMANA, DIAS_LABEL_CURTO, DIAS_PRODUCAO, DIAS_LABEL_CURTO_PRODUCAO, type DiaSemana, type DiaProducao } from '@/lib/date-utils'
import type { ProducaoDia, ItemProducao } from '@/lib/producao-utils'
import { PF_PRODUCAO_PARA_ENTREGA } from '@/lib/producao-utils'
import { consolidarProducaoSemana } from '@/lib/producao-semana-utils'
import type { RomaneioMotorista } from '@/lib/romaneio-utils'
import { useAppStore } from '@/store/app-store'
import { addDays, format } from 'date-fns'

// Mapeia dia de PRODUÇÃO → dia de ENTREGA para PCQ/Lanche (mesmo dia)
function entregaFromProducao(diaProd: DiaProducao, produto: string): string {
  if (produto === 'PF') {
    return PF_PRODUCAO_PARA_ENTREGA[diaProd] || diaProd
  }
  return diaProd
}

export default function ProducaoPage() {
  const [data, setData] = useState<{
    semana: number
    ano: number
    tipoPao: string
    nomePao: string
    lancheRegular: string | null
    lancheBifasica: string | null
    obs: string | null
    dias: ProducaoDia[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'dia' | 'semana'>('semana')
  const [activeTab, setActiveTab] = useState<string>('')
  const { semanaReferencia } = useAppStore()

  const [romaneios, setRomaneios] = useState<RomaneioMotorista[]>([])
  const [ajusteOpen, setAjusteOpen] = useState(false)
  const [ajusteTarget, setAjusteTarget] = useState({
    escolaId: '', escolaNome: '', diaSemana: '', produto: '', quantidadeOriginal: 0,
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = semanaReferencia ? `?data=${semanaReferencia}` : ''
      const [prodRes, romRes] = await Promise.all([
        fetch(`/api/producao${params}`),
        fetch(`/api/romaneio${params}`),
      ])
      const prodJson = await prodRes.json()
      const romJson = await romRes.json()

      if (prodJson && Array.isArray(prodJson.dias)) {
        setData(prodJson)
        setActiveTab(prodJson.dias[0]?.data || '')
      } else if (prodJson && !prodJson.error) {
        setData({ ...prodJson, dias: [] })
      } else {
        setData(null)
      }

      if (romJson && Array.isArray(romJson.romaneios)) {
        setRomaneios(romJson.romaneios)
      }
    } catch { setData(null) }
    finally { setLoading(false) }
  }, [semanaReferencia])

  useEffect(() => { loadData() }, [loadData])

  function openAjuste(item: ItemProducao) {
    setAjusteTarget({
      escolaId: item.escola_id, escolaNome: item.escola_nome,
      diaSemana: item.dia_entrega || '', produto: item.produto,
      quantidadeOriginal: item.zerado ? 0 : item.quantidade,
    })
    setAjusteOpen(true)
  }

  function openAjusteFromWeekly(escolaId: string, escolaNome: string, diaProd: DiaProducao, produto: 'PF' | 'PCQ' | 'LANCHE', quantidade: number) {
    // v9.4: permite ajustar mesmo se quantidade for 0 (célula vazia)
    const diaEntrega = entregaFromProducao(diaProd, produto)
    setAjusteTarget({
      escolaId,
      escolaNome,
      diaSemana: diaEntrega,
      produto,
      quantidadeOriginal: quantidade,
    })
    setAjusteOpen(true)
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
          <span className="text-muted-foreground">Calculando produção...</span>
        </div>
      </div>
    )
  }

  const inicio = semanaReferencia ? new Date(semanaReferencia + 'T12:00:00') : new Date()
  const domingo = addDays(inicio, -1) // domingo antes da segunda
  const semanaLabel = `Semana ${data.semana} — ${formatarPeriodoSemana(inicioSemana(inicio), fimSemana(inicio))}`
  const consolidado = consolidarProducaoSemana(data.dias)

  // PF unit label
  const pfUnit = 'unid.'
  const pcqUnit = 'formas'

  // Lanche name
  const lancheNome = data.lancheRegular || data.lancheBifasica || 'Lanche'

  // Data/hora de geração
  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm")

  // v9.5: ordenação alfabética como critério secundário (depois da rota/ordem)
  const escolasPF = consolidado.escolas.filter(e => e.total_pf > 0).sort((a, b) => (a.nome_curto || '').localeCompare(b.nome_curto || ''))
  const escolasRegularesPF = escolasPF.filter(e => !['OUTROS', 'INTERIOR'].includes(e.rota?.toUpperCase()))
  const escolasOutrasPF = escolasPF.filter(e => ['OUTROS', 'INTERIOR'].includes(e.rota?.toUpperCase()))

  // Agrupa escolas PCQ e Lanche (também ordenados alfabeticamente)
  const escolasPCQ = consolidado.escolas.filter(e => e.total_pcq > 0).sort((a, b) => (a.nome_curto || '').localeCompare(b.nome_curto || ''))
  const escolasLanche = consolidado.escolas.filter(e => e.total_lanche > 0).sort((a, b) => (a.nome_curto || '').localeCompare(b.nome_curto || ''))

  // Datas para o romaneio (entrega: segunda-sexta)
  const datasEntrega: Record<DiaSemana, string> = {
    segunda: dataISO(inicio),
    terca: dataISO(addDays(inicio, 1)),
    quarta: dataISO(addDays(inicio, 2)),
    quinta: dataISO(addDays(inicio, 3)),
    sexta: dataISO(addDays(inicio, 4)),
  }

  // ---------- Componente de impressão da página PF ----------
  const printPFPage = (copyLabel?: string) => (
    <div>
      {/* Header */}
      <div className="print-doc-header">
        <div className="print-doc-header-left">
          <div className="print-doc-logo"><img src="/brasao.jpg" alt="Brasão" /></div>
          <div className="print-doc-title-block">
            <div className="print-doc-title">PRODUÇÃO — PÃO FRANCÊS{copyLabel ? ` (${copyLabel})` : ''}</div>
            <div className="print-doc-subtitle">Padaria Escolar Municipal — Prefeitura de Lucas do Rio Verde / MT</div>
            <div className="print-doc-subtitle">Quantidades a produzir por dia da semana</div>
          </div>
        </div>
        <div className="print-doc-header-right">
          <div className="print-doc-gerado">GERADO EM</div>
          <div className="print-doc-gerado-date">{geradoEm}</div>
        </div>
      </div>

      {/* Info block — PÃO e LANCHE lado a lado */}
      <div className="print-info-block">
        <div className="print-info-left">
          <div className="print-info-semana">SEMANA {data.semana} / {data.ano}</div>
          <div className="print-info-periodo">{formatarPeriodoSemana(inicioSemana(inicio), fimSemana(inicio))}</div>
        </div>
        <div className="print-info-right">
          <div className="print-info-inline">
            <span className="print-info-item"><span className="print-info-label">PÃO:</span> {data.nomePao}</span>
            {lancheNome && <span className="print-info-item print-info-divider"><span className="print-info-label">LANCHE:</span> {lancheNome}</span>}
          </div>
        </div>
      </div>

      {/* PF Section */}
      <div className="print-section-header">
        <span className="print-section-title-text">PÃO FRANCÊS</span>
        <span className="print-section-total">Total: {consolidado.total_pf.toLocaleString('pt-BR')} {pfUnit}</span>
      </div>
      <table className="print-table">
        <thead>
          <tr>
            <th className="print-col-escola">ESCOLA / UNIDADE</th>
            {DIAS_PRODUCAO.map((d) => (
              <th key={d} className="print-col-dia">{DIAS_LABEL_CURTO_PRODUCAO[d]}</th>
            ))}
            <th className="print-col-total">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {escolasRegularesPF.map((escola) => (
            <tr key={escola.id}>
              <td className="print-col-escola">{escola.nome_curto}</td>
              {DIAS_PRODUCAO.map((d) => (
                <td key={d} className="print-col-dia">{escola.pf[d] > 0 ? escola.pf[d] : '—'}</td>
              ))}
              <td className="print-col-total">{escola.total_pf.toLocaleString('pt-BR')}</td>
            </tr>
          ))}
          {escolasOutrasPF.length > 0 && (
            <tr className="print-row-separator">
              <td colSpan={8}>OUTRAS INSTITUIÇÕES</td>
            </tr>
          )}
          {escolasOutrasPF.map((escola) => (
            <tr key={`outros-${escola.id}`}>
              <td className="print-col-escola">{escola.nome_curto}</td>
              {DIAS_PRODUCAO.map((d) => (
                <td key={d} className="print-col-dia">{escola.pf[d] > 0 ? escola.pf[d] : '—'}</td>
              ))}
              <td className="print-col-total">{escola.total_pf.toLocaleString('pt-BR')}</td>
            </tr>
          ))}
          <tr className="print-row-total">
            <td className="print-col-escola">TOTAL GERAL ({pfUnit.toUpperCase()})</td>
            {DIAS_PRODUCAO.map((d) => (
              <td key={d} className="print-col-dia">{consolidado.totais_por_dia.pf[d] || '—'}</td>
            ))}
            <td className="print-col-total">{consolidado.total_pf.toLocaleString('pt-BR')}</td>
          </tr>
        </tbody>
      </table>
      {/* v9.4: Aviso da semana na impressão (sutil, antes do footer) */}
      {data.obs && (
        <div style={{ marginTop: '3mm', padding: '2mm 3mm', border: '0.5pt solid #999', background: '#fffff0', fontSize: '7.5pt', fontStyle: 'italic' }}>
          <strong>⚠️ AVISO DA SEMANA:</strong> {data.obs}
        </div>
      )}

      {/* Footer */}
      <div className="print-footer">Sistema de Gestão da Padaria Escolar Municipal — Lucas do Rio Verde / MT</div>
    </div>
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ===== IMPRESSÃO — Tudo junto: Produção (PF×2 + PCQ/Lanche) + Romaneio ===== */}
      <div className="print-only">

        {/* ==================== PÁGINA 1: PÃO FRANCÊS (1ª via) ==================== */}
        {printPFPage('1ª via')}

        {/* ==================== PÁGINA 2: PÃO FRANCÊS (2ª via) ==================== */}
        <div className="print-page-break">
          {printPFPage('2ª via')}
        </div>

        {/* ==================== PÁGINA 3: PCQ E LANCHES ==================== */}
        {(consolidado.total_pcq > 0 || consolidado.total_lanche > 0) && (
          <div className="print-page-break">
            {/* Header */}
            <div className="print-doc-header">
              <div className="print-doc-header-left">
                <div className="print-doc-logo"><img src="/brasao.jpg" alt="Brasão" /></div>
                <div className="print-doc-title-block">
                  <div className="print-doc-title">PRODUÇÃO — PCQ E LANCHES</div>
                  <div className="print-doc-subtitle">Padaria Escolar Municipal — Prefeitura de Lucas do Rio Verde / MT</div>
                  <div className="print-doc-subtitle">Pão de Cachorro Quente + Lanches</div>
                </div>
              </div>
              <div className="print-doc-header-right">
                <div className="print-doc-gerado">GERADO EM</div>
                <div className="print-doc-gerado-date">{geradoEm}</div>
              </div>
            </div>

            {/* Info block — PÃO e LANCHE lado a lado */}
            <div className="print-info-block">
              <div className="print-info-left">
                <div className="print-info-semana">SEMANA {data.semana} / {data.ano}</div>
                <div className="print-info-periodo">{formatarPeriodoSemana(inicioSemana(inicio), fimSemana(inicio))}</div>
              </div>
              <div className="print-info-right">
                <div className="print-info-inline">
                  <span className="print-info-item"><span className="print-info-label">PÃO:</span> {data.nomePao}</span>
                  {lancheNome && <span className="print-info-item print-info-divider"><span className="print-info-label">LANCHE:</span> {lancheNome}</span>}
                </div>
              </div>
            </div>

            {/* PCQ Section */}
            {consolidado.total_pcq > 0 && (
              <>
                <div className="print-section-header">
                  <span className="print-section-title-text">PCQ — PÃO DE CACHORRO QUENTE</span>
                  <span className="print-section-total">Total: {consolidado.total_pcq.toLocaleString('pt-BR')} {pcqUnit}</span>
                </div>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th className="print-col-escola">ESCOLA / UNIDADE</th>
                      {DIAS_PRODUCAO.map((d) => (
                        <th key={d} className="print-col-dia">{DIAS_LABEL_CURTO_PRODUCAO[d]}</th>
                      ))}
                      <th className="print-col-total">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escolasPCQ.map((escola) => (
                      <tr key={escola.id}>
                        <td className="print-col-escola">{escola.nome_curto}</td>
                        {DIAS_PRODUCAO.map((d) => (
                          <td key={d} className="print-col-dia">{escola.pcq[d] > 0 ? escola.pcq[d] : '—'}</td>
                        ))}
                        <td className="print-col-total">{escola.total_pcq.toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                    <tr className="print-row-subtotal">
                      <td className="print-col-escola">TOTAL GERAL ({pcqUnit.toUpperCase()})</td>
                      {DIAS_PRODUCAO.map((d) => (
                        <td key={d} className="print-col-dia">{consolidado.totais_por_dia.pcq[d] || '—'}</td>
                      ))}
                      <td className="print-col-total">{consolidado.total_pcq.toLocaleString('pt-BR')}</td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}

            {/* v9.4: Lanche Section — tabela compacta com escolas agrupadas por dia */}
            {consolidado.total_lanche > 0 && (
              <>
                <div className="print-section-header print-section-spacer">
                  <span className="print-section-title-text">{lancheNome.toUpperCase()} — ENTREGAS POR DIA</span>
                  <span className="print-section-total">Total: {consolidado.total_lanche.toLocaleString('pt-BR')}</span>
                </div>
                <table className="print-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '65%', textAlign: 'left', padding: '1mm 1.5mm', fontSize: '7pt', textTransform: 'uppercase', borderBottom: '1.5pt solid #000' }}>DIA / ESCOLA</th>
                      <th style={{ width: '35%', textAlign: 'center', padding: '1mm 1.5mm', fontSize: '7pt', textTransform: 'uppercase', borderBottom: '1.5pt solid #000' }}>QUANTIDADE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DIAS_PRODUCAO.filter(d => consolidado.totais_por_dia.lanche[d] > 0).map((d) => (
                      <>
                        <tr key={d} style={{ borderTop: '1.5pt solid #000' }}>
                          <td style={{ fontWeight: '800', fontSize: '8pt', textTransform: 'uppercase', padding: '1.5mm 1.5mm', borderBottom: '0.5pt solid #000', letterSpacing: '0.3pt' }}>
                            ■ {DIAS_LABEL_CURTO_PRODUCAO[d].toUpperCase()}
                          </td>
                          <td style={{ fontWeight: '800', fontSize: '8pt', textAlign: 'center', padding: '1.5mm 1.5mm', borderBottom: '0.5pt solid #000' }}>
                            {consolidado.totais_por_dia.lanche[d]} unid.
                          </td>
                        </tr>
                        {escolasLanche.filter(e => e.lanche[d] > 0).map((escola) => (
                          <tr key={`${d}-${escola.id}`}>
                            <td style={{ padding: '0.8mm 1.5mm 0.8mm 6mm', fontSize: '8pt' }}>{escola.nome_curto}</td>
                            <td style={{ textAlign: 'center', padding: '0.8mm 1.5mm', fontSize: '8pt' }}>{escola.lanche[d]}</td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* v9.4: Aviso da semana na impressão */}
            {data.obs && (
              <div style={{ marginTop: '3mm', padding: '2mm 3mm', border: '0.5pt solid #999', background: '#fffff0', fontSize: '7.5pt', fontStyle: 'italic' }}>
                <strong>⚠️ AVISO DA SEMANA:</strong> {data.obs}
              </div>
            )}

            {/* Footer */}
            <div className="print-footer">Sistema de Gestão da Padaria Escolar Municipal — Lucas do Rio Verde / MT</div>
          </div>
        )}

        {/* ==================== ROMANEIO POR MOTORISTA ==================== */}
        {romaneios.map((romaneio) => (
          <div key={romaneio.rota}>
            {/* PF Romaneio */}
            {romaneio.total_pf > 0 && (
              <div className="print-page-break">
                {/* Header */}
                <div className="print-doc-header">
                  <div className="print-doc-header-left">
                    <div className="print-doc-logo"><img src="/brasao.jpg" alt="Brasão" /></div>
                    <div className="print-doc-title-block">
                      <div className="print-doc-title">ROTA {romaneio.rota_label.toUpperCase()} — PÃO FRANCÊS</div>
                      <div className="print-doc-subtitle">Padaria Escolar Municipal — Prefeitura de Lucas do Rio Verde / MT</div>
                      <div className="print-doc-subtitle">Entregas por dia da semana</div>
                    </div>
                  </div>
                  <div className="print-doc-header-right">
                    <div className="print-doc-gerado">GERADO EM</div>
                    <div className="print-doc-gerado-date">{geradoEm}</div>
                  </div>
                </div>

                {/* Info block */}
                <div className="print-info-block">
                  <div className="print-info-left">
                    <div className="print-info-semana">SEMANA {data.semana} / {data.ano}</div>
                    <div className="print-info-periodo">{formatarPeriodoSemana(inicioSemana(inicio), fimSemana(inicio))}</div>
                  </div>
                  <div className="print-info-right">
                    <div className="print-info-inline">
                      <span className="print-info-item"><span className="print-info-label">MOTORISTA:</span> {romaneio.rota_label}</span>
                      <span className="print-info-item print-info-divider"><span className="print-info-label">PÃO:</span> {data.nomePao}</span>
                    </div>
                  </div>
                </div>

                <div className="print-section-header">
                  <span className="print-section-title-text">PÃO FRANCÊS</span>
                  <span className="print-section-total">Total: {romaneio.total_pf.toLocaleString('pt-BR')} unid.</span>
                </div>
                <table className="print-table">
                  <thead><tr>
                    <th className="print-col-escola">ESCOLA / UNIDADE</th>
                    {DIAS_SEMANA.map((d) => (<th key={d} className="print-col-dia">{DIAS_LABEL_CURTO[d]}</th>))}
                    <th className="print-col-total">TOTAL</th>
                  </tr></thead>
                  <tbody>
                    {romaneio.escolas.filter((e) => e.total_pf > 0).map((escola) => (
                      <tr key={escola.id}>
                        <td className="print-col-escola">{escola.nome_curto}</td>
                        {DIAS_SEMANA.map((d) => (<td key={d} className="print-col-dia">{escola.pf[d] > 0 ? escola.pf[d] : '—'}</td>))}
                        <td className="print-col-total">{escola.total_pf.toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                    <tr className="print-row-total">
                      <td className="print-col-escola">TOTAL GERAL (UNID.)</td>
                      {DIAS_SEMANA.map((d) => (<td key={d} className="print-col-dia">{romaneio.totais_pf[d] || '—'}</td>))}
                      <td className="print-col-total">{romaneio.total_pf.toLocaleString('pt-BR')}</td>
                    </tr>
                  </tbody>
                </table>
                {/* v9.4: Aviso da semana no romaneio PF */}
                {data.obs && (
                  <div style={{ marginTop: '2mm', padding: '1.5mm 3mm', border: '0.5pt solid #999', background: '#fffff0', fontSize: '7pt', fontStyle: 'italic' }}>
                    <strong>⚠️ AVISO:</strong> {data.obs}
                  </div>
                )}
                <div className="print-footer">Sistema de Gestão da Padaria Escolar Municipal — Lucas do Rio Verde / MT</div>
              </div>
            )}

            {/* PCQ + Lanche Romaneio */}
            {(romaneio.total_pcq > 0 || romaneio.total_lanche > 0) && (
              <div className="print-page-break">
                {/* Header */}
                <div className="print-doc-header">
                  <div className="print-doc-header-left">
                    <div className="print-doc-logo"><img src="/brasao.jpg" alt="Brasão" /></div>
                    <div className="print-doc-title-block">
                      <div className="print-doc-title">ROTA {romaneio.rota_label.toUpperCase()} — PCQ E LANCHES</div>
                      <div className="print-doc-subtitle">Padaria Escolar Municipal — Prefeitura de Lucas do Rio Verde / MT</div>
                      <div className="print-doc-subtitle">Entregas por dia da semana</div>
                    </div>
                  </div>
                  <div className="print-doc-header-right">
                    <div className="print-doc-gerado">GERADO EM</div>
                    <div className="print-doc-gerado-date">{geradoEm}</div>
                  </div>
                </div>

                {/* Info block */}
                <div className="print-info-block">
                  <div className="print-info-left">
                    <div className="print-info-semana">SEMANA {data.semana} / {data.ano}</div>
                    <div className="print-info-periodo">{formatarPeriodoSemana(inicioSemana(inicio), fimSemana(inicio))}</div>
                  </div>
                  <div className="print-info-right">
                    <div className="print-info-inline">
                      <span className="print-info-item"><span className="print-info-label">MOTORISTA:</span> {romaneio.rota_label}</span>
                      <span className="print-info-item print-info-divider"><span className="print-info-label">PÃO:</span> {data.nomePao}</span>
                      {lancheNome && <span className="print-info-item print-info-divider"><span className="print-info-label">LANCHE:</span> {lancheNome}</span>}
                    </div>
                  </div>
                </div>

                {romaneio.total_pcq > 0 && (
                  <>
                    <div className="print-section-header">
                      <span className="print-section-title-text">PCQ — PÃO DE CACHORRO QUENTE</span>
                      <span className="print-section-total">Total: {romaneio.total_pcq.toLocaleString('pt-BR')} formas</span>
                    </div>
                    <table className="print-table">
                      <thead><tr>
                        <th className="print-col-escola">ESCOLA / UNIDADE</th>
                        {DIAS_SEMANA.map((d) => (<th key={d} className="print-col-dia">{DIAS_LABEL_CURTO[d]}</th>))}
                        <th className="print-col-total">TOTAL</th>
                      </tr></thead>
                      <tbody>
                        {romaneio.escolas.filter((e) => e.total_pcq > 0).map((escola) => (
                          <tr key={escola.id}>
                            <td className="print-col-escola">{escola.nome_curto}</td>
                            {DIAS_SEMANA.map((d) => (<td key={d} className="print-col-dia">{escola.pcq[d] > 0 ? escola.pcq[d] : '—'}</td>))}
                            <td className="print-col-total">{escola.total_pcq.toLocaleString('pt-BR')}</td>
                          </tr>
                        ))}
                        <tr className="print-row-subtotal">
                          <td className="print-col-escola">TOTAL GERAL (FORMAS)</td>
                          {DIAS_SEMANA.map((d) => (<td key={d} className="print-col-dia">{romaneio.totais_pcq[d] || '—'}</td>))}
                          <td className="print-col-total">{romaneio.total_pcq.toLocaleString('pt-BR')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                )}

                {romaneio.total_lanche > 0 && (
                  <>
                    <div className="print-section-header print-section-spacer">
                      <span className="print-section-title-text">{lancheNome.toUpperCase()} — ENTREGAS POR DIA</span>
                      <span className="print-section-total">Total: {romaneio.total_lanche.toLocaleString('pt-BR')}</span>
                    </div>
                    <table className="print-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                      <thead><tr>
                        <th style={{ width: '65%', textAlign: 'left', padding: '1mm 1.5mm', fontSize: '7pt', textTransform: 'uppercase', borderBottom: '1.5pt solid #000' }}>DIA / ESCOLA</th>
                        <th style={{ width: '35%', textAlign: 'center', padding: '1mm 1.5mm', fontSize: '7pt', textTransform: 'uppercase', borderBottom: '1.5pt solid #000' }}>QUANTIDADE</th>
                      </tr></thead>
                      <tbody>
                        {DIAS_SEMANA.filter(d => romaneio.totais_lanche[d] > 0).map((d) => (
                          <>
                            <tr key={d} style={{ borderTop: '1.5pt solid #000' }}>
                              <td style={{ fontWeight: '800', fontSize: '8pt', textTransform: 'uppercase', padding: '1.5mm 1.5mm', borderBottom: '0.5pt solid #000', letterSpacing: '0.3pt' }}>
                                ■ {DIAS_LABEL_CURTO[d].toUpperCase()}
                              </td>
                              <td style={{ fontWeight: '800', fontSize: '8pt', textAlign: 'center', padding: '1.5mm 1.5mm', borderBottom: '0.5pt solid #000' }}>
                                {romaneio.totais_lanche[d]} unid.
                              </td>
                            </tr>
                            {romaneio.escolas.filter((e) => e.lanche[d] > 0).map((escola) => (
                              <tr key={`${d}-${escola.id}`}>
                                <td style={{ padding: '0.8mm 1.5mm 0.8mm 6mm', fontSize: '8pt' }}>{escola.nome_curto}</td>
                                <td style={{ textAlign: 'center', padding: '0.8mm 1.5mm', fontSize: '8pt' }}>{escola.lanche[d]}</td>
                              </tr>
                            ))}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {/* v9.4: Aviso da semana no romaneio PCQ/Lanche */}
                {data.obs && (
                  <div style={{ marginTop: '2mm', padding: '1.5mm 3mm', border: '0.5pt solid #999', background: '#fffff0', fontSize: '7pt', fontStyle: 'italic' }}>
                    <strong>⚠️ AVISO:</strong> {data.obs}
                  </div>
                )}
                <div className="print-footer">Sistema de Gestão da Padaria Escolar Municipal — Lucas do Rio Verde / MT</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ===== TELA — Cabeçalho ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print-hidden">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3A5C]">Produção</h1>
          <p className="text-sm text-muted-foreground">
            Planejamento semanal · <Badge variant="secondary" className="text-[10px]">{data.nomePao}</Badge>
            {data.lancheRegular && <span className="ml-2 text-xs">Lanche: {data.lancheRegular}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SeletorSemana />
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            <Button size="sm" variant={viewMode === 'dia' ? 'default' : 'ghost'}
              onClick={() => setViewMode('dia')}
              className={`h-7 text-xs ${viewMode === 'dia' ? 'bg-[#1A3A5C] text-white' : ''}`}>
              <Calendar className="w-3 h-3 mr-1" /> Por Dia
            </Button>
            <Button size="sm" variant={viewMode === 'semana' ? 'default' : 'ghost'}
              onClick={() => setViewMode('semana')}
              className={`h-7 text-xs ${viewMode === 'semana' ? 'bg-[#1A3A5C] text-white' : ''}`}>
              <Table2 className="w-3 h-3 mr-1" /> Semanal
            </Button>
          </div>
          <Link href="/romaneio">
            <Button variant="outline" size="sm" className="border-green-200 text-green-700 hover:bg-green-50">Romaneio →</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="border-amber-200">
            <Printer className="w-4 h-4 mr-1" /> Imprimir
          </Button>
        </div>
      </div>

      {/* v9.4: Aviso da semana (vem do cardápio semestral) */}
      {data.obs && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-3 print:hidden">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Aviso da Semana {data.semana}</p>
            <p className="text-sm text-amber-700">{data.obs}</p>
          </div>
        </div>
      )}

      {/* ===== TELA — Por Dia ===== */}
      {viewMode === 'dia' && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="print-hidden">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-amber-50/50 p-1">
            {data.dias.map((dia) => (
              <TabsTrigger key={dia.data} value={dia.data}
                className="data-[state=active]:bg-[#1A3A5C] data-[state=active]:text-white text-xs px-3 py-1.5">
                <span>{dia.dia_curto}</span>
                <span className="ml-1 text-[10px] opacity-60">{formatarData(dia.data).split('/')[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {data.dias.map((dia) => (
            <TabsContent key={dia.data} value={dia.data}>
              <DiaProducaoCard dia={dia} onAjuste={openAjuste} />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* ===== TELA — Semanal ===== */}
      {viewMode === 'semana' && (
        <div className="space-y-4 print-hidden">
          {/* PF */}
          <Card className="border-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                <Wheat className="w-4 h-4" /> Pão Francês
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-amber-100">
                      <th className="text-left p-2 text-xs font-medium text-muted-foreground">Escola</th>
                      {DIAS_PRODUCAO.map((d) => (
                        <th key={d} className="text-center p-2 text-xs font-medium text-muted-foreground">{DIAS_LABEL_CURTO_PRODUCAO[d]}</th>
                      ))}
                      <th className="text-right p-2 text-xs font-medium text-muted-foreground bg-amber-50">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidado.escolas.filter(e => e.total_pf > 0).map((escola) => (
                      <tr key={escola.id} className="border-b border-muted/30 hover:bg-muted/20">
                        <td className="p-2 font-medium text-sm">{escola.nome_curto}</td>
                        {DIAS_PRODUCAO.map((d) => (
                          <td key={d} className="p-2 text-center font-mono text-sm cursor-pointer hover:bg-amber-50 rounded"
                            onClick={() => openAjusteFromWeekly(escola.id, escola.nome, d, 'PF', escola.pf[d])}>
                            {escola.pf[d] > 0 ? escola.pf[d] : ''}
                          </td>
                        ))}
                        <td className="p-2 text-right font-mono font-semibold bg-amber-50 text-sm">{escola.total_pf.toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-amber-200 bg-amber-50/50">
                      <td className="p-2 font-bold text-amber-900">Total PF</td>
                      {DIAS_PRODUCAO.map((d) => (
                        <td key={d} className="p-2 text-center font-bold font-mono text-amber-900">{consolidado.totais_por_dia.pf[d] || ''}</td>
                      ))}
                      <td className="p-2 text-right font-bold font-mono text-amber-900 bg-amber-100">{consolidado.total_pf.toLocaleString('pt-BR')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* PCQ */}
          <Card className="border-orange-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-orange-900 flex items-center gap-2">
                <Package className="w-4 h-4" /> Pão de Cachorro Quente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-orange-100">
                      <th className="text-left p-2 text-xs font-medium text-muted-foreground">Escola</th>
                      {DIAS_PRODUCAO.map((d) => (
                        <th key={d} className="text-center p-2 text-xs font-medium text-muted-foreground">{DIAS_LABEL_CURTO_PRODUCAO[d]}</th>
                      ))}
                      <th className="text-right p-2 text-xs font-medium text-muted-foreground bg-orange-50">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidado.escolas.filter(e => e.total_pcq > 0).map((escola) => (
                      <tr key={escola.id} className="border-b border-muted/30 hover:bg-muted/20">
                        <td className="p-2 font-medium text-sm">{escola.nome_curto}</td>
                        {DIAS_PRODUCAO.map((d) => (
                          <td key={d} className="p-2 text-center font-mono text-sm cursor-pointer hover:bg-orange-50 rounded"
                            onClick={() => openAjusteFromWeekly(escola.id, escola.nome, d, 'PCQ', escola.pcq[d])}>
                            {escola.pcq[d] > 0 ? escola.pcq[d] : ''}
                          </td>
                        ))}
                        <td className="p-2 text-right font-mono font-semibold bg-orange-50 text-sm">{escola.total_pcq.toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-orange-200 bg-orange-50/50">
                      <td className="p-2 font-bold text-orange-900">Total PCQ</td>
                      {DIAS_PRODUCAO.map((d) => (
                        <td key={d} className="p-2 text-center font-bold font-mono text-orange-900">{consolidado.totais_por_dia.pcq[d] || ''}</td>
                      ))}
                      <td className="p-2 text-right font-bold font-mono text-orange-900 bg-orange-100">{consolidado.total_pcq.toLocaleString('pt-BR')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Lanche */}
          <Card className="border-pink-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-pink-900 flex items-center gap-2">
                <Cookie className="w-4 h-4" /> Lanche
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-pink-100">
                      <th className="text-left p-2 text-xs font-medium text-muted-foreground">Escola</th>
                      {DIAS_PRODUCAO.map((d) => (
                        <th key={d} className="text-center p-2 text-xs font-medium text-muted-foreground">{DIAS_LABEL_CURTO_PRODUCAO[d]}</th>
                      ))}
                      <th className="text-right p-2 text-xs font-medium text-muted-foreground bg-pink-50">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidado.escolas.filter(e => e.total_lanche > 0).map((escola) => (
                      <tr key={escola.id} className="border-b border-muted/30 hover:bg-muted/20">
                        <td className="p-2 font-medium text-sm">{escola.nome_curto}</td>
                        {DIAS_PRODUCAO.map((d) => (
                          <td key={d} className="p-2 text-center font-mono text-sm cursor-pointer hover:bg-pink-50 rounded"
                            onClick={() => openAjusteFromWeekly(escola.id, escola.nome, d, 'LANCHE', escola.lanche[d])}>
                            {escola.lanche[d] > 0 ? escola.lanche[d] : ''}
                          </td>
                        ))}
                        <td className="p-2 text-right font-mono font-semibold bg-pink-50 text-sm">{escola.total_lanche.toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-pink-200 bg-pink-50/50">
                      <td className="p-2 font-bold text-pink-900">Total Lanche</td>
                      {DIAS_PRODUCAO.map((d) => (
                        <td key={d} className="p-2 text-center font-bold font-mono text-pink-900">{consolidado.totais_por_dia.lanche[d] || ''}</td>
                      ))}
                      <td className="p-2 text-right font-bold font-mono text-pink-900 bg-pink-100">{consolidado.total_lanche.toLocaleString('pt-BR')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <AjusteDialog open={ajusteOpen} onOpenChange={setAjusteOpen}
        escolaId={ajusteTarget.escolaId} escolaNome={ajusteTarget.escolaNome}
        diaSemana={ajusteTarget.diaSemana} produto={ajusteTarget.produto}
        quantidadeOriginal={ajusteTarget.quantidadeOriginal}
        ano={data.ano} semana={data.semana} onSaved={loadData} />
    </div>
  )
}

function DiaProducaoCard({ dia, onAjuste }: { dia: ProducaoDia; onAjuste: (item: ItemProducao) => void }) {
  const temProducao = (dia.total_pf + dia.total_pcq + dia.total_lanche) > 0

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 bg-gradient-to-r from-[#1A3A5C] to-[#2C5282] text-white px-4 py-2 rounded-lg shadow-md">
          <span className="font-bold">{dia.dia_label}</span>
          <span className="text-sm text-blue-200">{formatarData(dia.data)}</span>
        </div>
        {temProducao ? (
          <div className="flex items-center gap-3">
            {dia.total_pf > 0 && <Badge className="bg-amber-100 text-amber-800"><Wheat className="w-3 h-3 mr-1" /> {dia.total_pf.toLocaleString('pt-BR')} PF</Badge>}
            {dia.total_pcq > 0 && <Badge className="bg-orange-100 text-orange-800"><Package className="w-3 h-3 mr-1" /> {dia.total_pcq.toLocaleString('pt-BR')} PCQ</Badge>}
            {dia.total_lanche > 0 && <Badge className="bg-pink-100 text-pink-800"><Cookie className="w-3 h-3 mr-1" /> {dia.total_lanche.toLocaleString('pt-BR')} Lanche</Badge>}
          </div>
        ) : <Badge variant="secondary">Sem produção</Badge>}
      </div>

      {/* PF */}
      {dia.itens_pf.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-amber-900 flex items-center gap-2"><Wheat className="w-4 h-4" /> Pão Francês</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-amber-100">
                <th className="text-left p-2 text-xs font-medium text-muted-foreground">Escola</th>
                <th className="text-center p-2 text-xs font-medium text-muted-foreground">Entrega</th>
                <th className="text-right p-2 text-xs font-medium text-muted-foreground">Qtd</th>
                <th className="text-center p-2 text-xs font-medium text-muted-foreground">Status</th>
                <th className="p-2"></th>
              </tr></thead>
              <tbody>
                {dia.itens_pf.map((item) => (<ItemRow key={`${item.escola_id}_${item.dia_entrega}`} item={item} onAjuste={onAjuste} />))}
                <tr className="border-t-2 border-amber-200 bg-amber-50/50">
                  <td colSpan={2} className="p-2 font-bold text-amber-900">Total PF</td>
                  <td className="p-2 text-right font-bold text-amber-900">{dia.total_pf.toLocaleString('pt-BR')}</td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* PCQ */}
      {dia.itens_pcq.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-orange-900 flex items-center gap-2"><Package className="w-4 h-4" /> Pão de Cachorro Quente</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-orange-100">
                <th className="text-left p-2 text-xs font-medium text-muted-foreground">Escola</th>
                <th className="text-right p-2 text-xs font-medium text-muted-foreground">Formas</th>
                <th className="text-center p-2 text-xs font-medium text-muted-foreground">Status</th>
                <th className="p-2"></th>
              </tr></thead>
              <tbody>
                {dia.itens_pcq.map((item) => (
                  <tr key={item.escola_id} className="border-b border-muted/30 hover:bg-muted/20 cursor-pointer" onClick={() => onAjuste(item)}>
                    <td className="p-2 font-medium">{item.escola_curto}</td>
                    <td className="p-2 text-right font-mono">
                      {item.zerado ? <span className="line-through text-red-400">{item.quantidade}</span> : <span className={item.ajustado ? 'text-amber-600 font-semibold' : ''}>{item.quantidade.toLocaleString('pt-BR')}</span>}
                    </td>
                    <td className="p-2 text-center">
                      {item.zerado && <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="w-3 h-3 mr-0.5" /> Feriado</Badge>}
                      {item.ajustado && !item.zerado && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Ajustado</Badge>}
                    </td>
                    <td className="p-2"><Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground">Ajustar</Button></td>
                  </tr>
                ))}
                <tr className="border-t-2 border-orange-200 bg-orange-50/50">
                  <td className="p-2 font-bold text-orange-900">Total PCQ</td>
                  <td className="p-2 text-right font-bold text-orange-900">{dia.total_pcq.toLocaleString('pt-BR')}</td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Lanche */}
      {dia.itens_lanche.length > 0 && (
        <Card className="border-pink-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-pink-900 flex items-center gap-2"><Cookie className="w-4 h-4" /> Lanche</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-pink-100">
                <th className="text-left p-2 text-xs font-medium text-muted-foreground">Escola</th>
                <th className="text-right p-2 text-xs font-medium text-muted-foreground">Qtd</th>
                <th className="text-center p-2 text-xs font-medium text-muted-foreground">Status</th>
                <th className="p-2"></th>
              </tr></thead>
              <tbody>
                {dia.itens_lanche.map((item) => (
                  <tr key={item.escola_id} className="border-b border-muted/30 hover:bg-muted/20 cursor-pointer" onClick={() => onAjuste(item)}>
                    <td className="p-2 font-medium">{item.escola_curto}</td>
                    <td className="p-2 text-right font-mono">
                      {item.zerado ? <span className="line-through text-red-400">{item.quantidade}</span> : <span className={item.ajustado ? 'text-amber-600 font-semibold' : ''}>{item.quantidade.toLocaleString('pt-BR')}</span>}
                    </td>
                    <td className="p-2 text-center">
                      {item.zerado && <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="w-3 h-3 mr-0.5" /> Feriado</Badge>}
                      {item.ajustado && !item.zerado && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Ajustado</Badge>}
                    </td>
                    <td className="p-2"><Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground">Ajustar</Button></td>
                  </tr>
                ))}
                <tr className="border-t-2 border-pink-200 bg-pink-50/50">
                  <td className="p-2 font-bold text-pink-900">Total Lanche</td>
                  <td className="p-2 text-right font-bold text-pink-900">{dia.total_lanche.toLocaleString('pt-BR')}</td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}

function ItemRow({ item, onAjuste }: { item: ItemProducao; onAjuste: (item: ItemProducao) => void }) {
  const entregaLabel = item.dia_entrega ? DIAS_LABEL_CURTO[item.dia_entrega as DiaSemana] || item.dia_entrega : ''
  return (
    <tr className="border-b border-muted/30 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => onAjuste(item)}>
      <td className="p-2 font-medium">{item.escola_curto}</td>
      <td className="p-2 text-center">{entregaLabel}</td>
      <td className="p-2 text-right font-mono">
        {item.zerado ? <span className="line-through text-red-400">{item.quantidade}</span> : <span className={item.ajustado ? 'text-amber-600 font-semibold' : ''}>{item.quantidade.toLocaleString('pt-BR')}</span>}
      </td>
      <td className="p-2 text-center">
        {item.zerado && <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="w-3 h-3 mr-0.5" /> Feriado</Badge>}
        {item.ajustado && !item.zerado && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Ajustado</Badge>}
      </td>
      <td className="p-2"><Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground hover:text-[#1A3A5C]">Ajustar</Button></td>
    </tr>
  )
}
