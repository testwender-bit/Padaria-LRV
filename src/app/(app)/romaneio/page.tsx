'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { SeletorSemana } from '@/components/seletor-semana'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Truck, Printer, Wheat, Package, Cookie, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { formatarPeriodoSemana, inicioSemana, fimSemana, DIAS_SEMANA, DIAS_LABEL_CURTO } from '@/lib/date-utils'
import type { RomaneioMotorista } from '@/lib/romaneio-utils'
import { useAppStore } from '@/store/app-store'
import { format } from 'date-fns'

export default function RomaneioPage() {
  const [data, setData] = useState<{
    semana: number; ano: number; tipoPao: string; nomePao: string
    lancheRegular: string | null; lancheBifasica: string | null; romaneios: RomaneioMotorista[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const { semanaReferencia } = useAppStore()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = semanaReferencia ? `?data=${semanaReferencia}` : ''
      const res = await fetch(`/api/romaneio${params}`)
      const json = await res.json()
      setData(json)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [semanaReferencia])

  useEffect(() => { loadData() }, [loadData])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
          <span className="text-muted-foreground">Gerando romaneio...</span>
        </div>
      </div>
    )
  }

  const inicio = semanaReferencia ? new Date(semanaReferencia + 'T12:00:00') : new Date()
  const lancheNome = data.lancheRegular || data.lancheBifasica || 'Lanche'

  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm")

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ===== IMPRESSÃO — Romaneio por motorista ===== */}
      <div className="print-only">
        {data.romaneios.map((romaneio, rIdx) => (
          <div key={romaneio.rota}>
            {/* PF */}
            {romaneio.total_pf > 0 && (
              <div className={rIdx === 0 ? '' : 'print-page-break'}>
                {/* Header */}
                <div className="print-doc-header">
                  <div className="print-doc-header-left">
                    <div className="print-doc-logo">P</div>
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
                    <div className="print-info-item"><span className="print-info-label">MOTORISTA:</span> {romaneio.rota_label}</div>
                    <div className="print-info-item"><span className="print-info-label">PÃO:</span> {data.nomePao}</div>
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
                <div className="print-footer">Sistema de Gestão da Padaria Escolar Municipal — Lucas do Rio Verde / MT</div>
              </div>
            )}

            {/* PCQ + Lanche */}
            {(romaneio.total_pcq > 0 || romaneio.total_lanche > 0) && (
              <div className="print-page-break">
                {/* Header */}
                <div className="print-doc-header">
                  <div className="print-doc-header-left">
                    <div className="print-doc-logo">P</div>
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
                    <div className="print-info-item"><span className="print-info-label">MOTORISTA:</span> {romaneio.rota_label}</div>
                    <div className="print-info-item"><span className="print-info-label">PÃO:</span> {data.nomePao}</div>
                    <div className="print-info-item"><span className="print-info-label">LANCHE:</span> {lancheNome}</div>
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
                      <span className="print-section-title-text">{lancheNome.toUpperCase()}</span>
                      <span className="print-section-total">Total: {romaneio.total_lanche.toLocaleString('pt-BR')}</span>
                    </div>
                    <table className="print-table">
                      <thead><tr>
                        <th className="print-col-escola">ESCOLA / UNIDADE</th>
                        {DIAS_SEMANA.map((d) => (<th key={d} className="print-col-dia">{DIAS_LABEL_CURTO[d]}</th>))}
                        <th className="print-col-total">TOTAL</th>
                      </tr></thead>
                      <tbody>
                        {romaneio.escolas.filter((e) => e.total_lanche > 0).map((escola) => (
                          <tr key={escola.id}>
                            <td className="print-col-escola">{escola.nome_curto}</td>
                            {DIAS_SEMANA.map((d) => (<td key={d} className="print-col-dia">{escola.lanche[d] > 0 ? escola.lanche[d] : '—'}</td>))}
                            <td className="print-col-total">{escola.total_lanche.toLocaleString('pt-BR')}</td>
                          </tr>
                        ))}
                        <tr className="print-row-subtotal">
                          <td className="print-col-escola">TOTAL GERAL</td>
                          {DIAS_SEMANA.map((d) => (<td key={d} className="print-col-dia">{romaneio.totais_lanche[d] || '—'}</td>))}
                          <td className="print-col-total">{romaneio.total_lanche.toLocaleString('pt-BR')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </>
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
          <h1 className="text-2xl font-bold text-[#1A3A5C]">Romaneio</h1>
          <p className="text-sm text-muted-foreground">
            Manifesto de entregas por motorista
            <Badge variant="secondary" className="ml-2 text-[10px]">{data.nomePao}</Badge>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SeletorSemana />
          <Link href="/producao"><Button variant="outline" size="sm" className="border-amber-200 text-amber-700">← Produção</Button></Link>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="border-amber-200">
            <Printer className="w-4 h-4 mr-1" /> Imprimir
          </Button>
        </div>
      </div>

      {/* Tabs por rota */}
      <Tabs defaultValue={data.romaneios[0]?.rota || 'JOSE'} className="print-hidden">
        <TabsList className="bg-amber-50/50 p-1">
          {data.romaneios.map((r) => (
            <TabsTrigger key={r.rota} value={r.rota}
              className="data-[state=active]:bg-[#1A3A5C] data-[state=active]:text-white text-xs">
              <Truck className="w-3 h-3 mr-1" /> {r.rota_label}
            </TabsTrigger>
          ))}
        </TabsList>
        {data.romaneios.map((romaneio) => (
          <TabsContent key={romaneio.rota} value={romaneio.rota}>
            <RomaneioRotaCard romaneio={romaneio} lancheRegular={data.lancheRegular} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

function RomaneioRotaCard({ romaneio, lancheRegular }: { romaneio: RomaneioMotorista; lancheRegular: string | null }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1A3A5C] to-[#2C5282] flex items-center justify-center shadow-md">
          <Truck className="w-5 h-5 text-[#D4A017]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#1A3A5C]">{romaneio.rota_label}</h2>
          <p className="text-sm text-muted-foreground">{romaneio.escolas.length} escolas</p>
        </div>
      </div>

      {/* PF */}
      {romaneio.escolas.some((e) => e.total_pf > 0) && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-amber-900 flex items-center gap-2"><Wheat className="w-4 h-4" /> Pão Francês</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-amber-100">
                  <th className="text-left p-2 text-xs font-medium text-muted-foreground">Escola</th>
                  {DIAS_SEMANA.map((d) => (<th key={d} className="text-center p-2 text-xs font-medium text-muted-foreground">{DIAS_LABEL_CURTO[d]}</th>))}
                  <th className="text-right p-2 text-xs font-medium text-muted-foreground bg-amber-50">Total</th>
                </tr></thead>
                <tbody>
                  {romaneio.escolas.filter((e) => e.total_pf > 0).map((escola) => (
                    <tr key={escola.id} className="border-b border-muted/30 hover:bg-muted/20">
                      <td className="p-2 font-medium text-sm">{escola.nome_curto}</td>
                      {DIAS_SEMANA.map((d) => (
                        <td key={d} className="p-2 text-center font-mono text-sm relative">
                          {escola.pf[d] || ''}
                          {escola.feriado_pf[d] && <span className="absolute -top-0.5 -right-0.5" title={escola.feriado_pf[d]}><AlertTriangle className="w-2.5 h-2.5 text-red-500" /></span>}
                        </td>
                      ))}
                      <td className="p-2 text-right font-mono font-semibold bg-amber-50">{escola.total_pf.toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-amber-200 bg-amber-50/50">
                    <td className="p-2 font-bold text-amber-900">Total</td>
                    {DIAS_SEMANA.map((d) => (<td key={d} className="p-2 text-center font-bold font-mono text-amber-900">{romaneio.totais_pf[d] || ''}</td>))}
                    <td className="p-2 text-right font-bold font-mono text-amber-900 bg-amber-100">{romaneio.total_pf.toLocaleString('pt-BR')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PCQ */}
      {romaneio.escolas.some((e) => e.total_pcq > 0) && (
        <Card className="border-orange-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-orange-900 flex items-center gap-2"><Package className="w-4 h-4" /> Pão de Cachorro Quente</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-orange-100">
                  <th className="text-left p-2 text-xs font-medium text-muted-foreground">Escola</th>
                  {DIAS_SEMANA.map((d) => (<th key={d} className="text-center p-2 text-xs font-medium text-muted-foreground">{DIAS_LABEL_CURTO[d]}</th>))}
                  <th className="text-right p-2 text-xs font-medium text-muted-foreground bg-orange-50">Total</th>
                </tr></thead>
                <tbody>
                  {romaneio.escolas.filter((e) => e.total_pcq > 0).map((escola) => (
                    <tr key={escola.id} className="border-b border-muted/30 hover:bg-muted/20">
                      <td className="p-2 font-medium text-sm">{escola.nome_curto}</td>
                      {DIAS_SEMANA.map((d) => (<td key={d} className="p-2 text-center font-mono text-sm">{escola.pcq[d] || ''}</td>))}
                      <td className="p-2 text-right font-mono font-semibold bg-orange-50">{escola.total_pcq.toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-orange-200 bg-orange-50/50">
                    <td className="p-2 font-bold text-orange-900">Total</td>
                    {DIAS_SEMANA.map((d) => (<td key={d} className="p-2 text-center font-bold font-mono text-orange-900">{romaneio.totais_pcq[d] || ''}</td>))}
                    <td className="p-2 text-right font-bold font-mono text-orange-900 bg-orange-100">{romaneio.total_pcq.toLocaleString('pt-BR')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lanche */}
      {romaneio.escolas.some((e) => e.total_lanche > 0) && (
        <Card className="border-pink-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-pink-900 flex items-center gap-2"><Cookie className="w-4 h-4" /> Lanche — {lancheRegular || 'Não definido'}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-pink-100">
                  <th className="text-left p-2 text-xs font-medium text-muted-foreground">Escola</th>
                  {DIAS_SEMANA.map((d) => (<th key={d} className="text-center p-2 text-xs font-medium text-muted-foreground">{DIAS_LABEL_CURTO[d]}</th>))}
                  <th className="text-right p-2 text-xs font-medium text-muted-foreground bg-pink-50">Total</th>
                </tr></thead>
                <tbody>
                  {romaneio.escolas.filter((e) => e.total_lanche > 0).map((escola) => (
                    <tr key={escola.id} className="border-b border-muted/30 hover:bg-muted/20">
                      <td className="p-2 font-medium text-sm">{escola.nome_curto}</td>
                      {DIAS_SEMANA.map((d) => (<td key={d} className="p-2 text-center font-mono text-sm">{escola.lanche[d] || ''}</td>))}
                      <td className="p-2 text-right font-mono font-semibold bg-pink-50">{escola.total_lanche.toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-pink-200 bg-pink-50/50">
                    <td className="p-2 font-bold text-pink-900">Total</td>
                    {DIAS_SEMANA.map((d) => (<td key={d} className="p-2 text-center font-bold font-mono text-pink-900">{romaneio.totais_lanche[d] || ''}</td>))}
                    <td className="p-2 text-right font-bold font-mono text-pink-900 bg-pink-100">{romaneio.total_lanche.toLocaleString('pt-BR')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}
