'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft, Printer, RefreshCw, FileText, Calendar, BookOpen
} from 'lucide-react'
import {
  DIAS_SEMANA_NUTRI,
  FASES_ESCOLARES,
  calcularNutrientesRefeicao,
  calcularPercentualEnergia,
  dividirNutrientes,
  emptyNutrienteDia,
  somarNutrientes,
  limparNomeIngrediente,
  type NutrienteDia,
  type FaseEscolar,
  calcularPercapitaPorFase,
} from '@/lib/nutricao-utils'
import {
  detectarAlergenosPreparacao,
  ALERGENOS,
  ALERGENOS_LIST,
  type AlergenoSigla,
} from '@/lib/alergenos-utils'
import { sortItensByRefeicao } from '@/lib/ordenacao-preparacoes'
import { parseHorarioToMinutes } from '@/lib/horario-utils'

// ── Types ──────────────────────────────────────────────────────

interface TipoRefeicao {
  id: string
  codigo: string
  nome: string
  horario: string
  ordem: number
  sub_de_codigo?: string | null  // v8.13: se preenchido, este slot é sub de outro
}

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

interface PercapitaData {
  id: string
  ingrediente_id: string
  fase_escolar: string
  quantidade_gramas: number
  auto_calculado: boolean
}

interface IngredienteComAlimento {
  id: string
  quantidade_gramas: number
  mesma_percapita: boolean
  alimento: Alimento
  percapitas: PercapitaData[]
}

interface Preparacao {
  id: string
  nome: string
  descricao: string | null
  ingredientes: IngredienteComAlimento[]
}

interface CardapioItem {
  id: string
  tipo_refeicao_id: string
  preparacao_id: string
  porcoes: number
  tipo_refeicao: TipoRefeicao
  preparacao: Preparacao
}

interface CardapioDia {
  id: string
  dia_semana: string
  itens: CardapioItem[]
  feriado?: { nome: string; tipo: string } | null  // v8: null se não for feriado
}

interface CardapioSemana {
  id: string
  numero: number
  data_inicio: string
  data_fim: string
  dias: CardapioDia[]
}

interface CardapioFull {
  id: string
  nome: string
  escola_id: string | null
  categoria_escola: string
  fase_escolar: string
  status: string
  ano: number
  semestre: number
  escola?: { id: string; nome: string; categoria: string } | null
  nutricionista?: { id: string; nome: string; crn: string } | null
  equipe_nutricionistas?: { id: string; nome: string; crn: string }[]
  semanas: CardapioSemana[]
  // v8.7: horários customizados por refeição (override do default)
  horarios_refeicoes?: Array<{
    id: string
    tipo_refeicao_id: string
    horario: string
    multiplicador: number
  }>
}

interface ResumoSemana {
  media_dia: NutrienteDia
  percentuais: {
    carboidratos_pct: number
    proteinas_pct: number
    lipidios_pct: number
    acucar_pct: number
  }
  dias_com_ferro_heme: number
  dias_com_vitamina_a: number
}

// ── Helpers ────────────────────────────────────────────────────

function formatDateShort(dateStr: string) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function getFaseLabel(fase: string) {
  const f = FASES_ESCOLARES.find(fs => fs.value === fase)
  return f ? `${f.label} (${f.faixa})` : fase
}

function getGramasForFase(ing: IngredienteComAlimento, faseEscolar: string): number {
  if (ing.mesma_percapita) return ing.quantidade_gramas
  const percapita = ing.percapitas?.find(p => p.fase_escolar === faseEscolar)
  if (percapita) return percapita.quantidade_gramas
  return calcularPercapitaPorFase(ing.quantidade_gramas, faseEscolar as FaseEscolar)
}

function calcularResumoSemanaPDF(
  semana: CardapioSemana,
  faseEscolar: string
): ResumoSemana {
  let totalSemana = emptyNutrienteDia()
  let diasComDados = 0
  let diasComFerroHeme = 0
  let diasComVitA = 0

  for (const dia of semana.dias) {
    if (dia.itens.length === 0) continue  // dia vazio (feriado) — pula
    const diaNutri = dia.itens.reduce<NutrienteDia>((acc, item) => {
      const refeicaoNutri = calcularNutrientesRefeicao([{
        preparacao: {
          ingredientes: item.preparacao.ingredientes.map((ing) => ({
            quantidade_gramas: getGramasForFase(ing, faseEscolar),
            alimento: ing.alimento,
          })),
        },
        porcoes: item.porcoes,
      }])
      return somarNutrientes(acc, refeicaoNutri)
    }, emptyNutrienteDia())

    // v8.7: também pula dias onde a soma dos nutrientes é zero
    // (caso raro de itens com ingredientes todos zerados)
    if (diaNutri.energia_kcal === 0 && diaNutri.proteinas_g === 0) continue

    totalSemana = somarNutrientes(totalSemana, diaNutri)
    diasComDados++
    if (diaNutri.ferro_heme_mg > 0) diasComFerroHeme++
    if (diaNutri.vitamina_a_mcg > 0) diasComVitA++
  }

  const mediaDia = diasComDados > 0 ? dividirNutrientes(totalSemana, diasComDados) : emptyNutrienteDia()
  const percentuais = calcularPercentualEnergia(mediaDia)

  return { media_dia: mediaDia, percentuais, dias_com_ferro_heme: diasComFerroHeme, dias_com_vitamina_a: diasComVitA }
}

// ── Week Page Component (LANDSCAPE A4 — B&W Optimized) ────────

interface FeriadoInfo {
  data: string
  nome: string
  tipo: string
  escolas_afetadas: string
}

function getFeriadoDoDiaCalc(
  dataInicio: string,
  diaSemanaPt: string,
  feriados: FeriadoInfo[],
  categoriaEscola: string
): { nome: string; tipo: string } | null {
  const diaToIdx: Record<string, number> = {
    'domingo': 0, 'segunda': 1, 'terca': 2, 'quarta': 3,
    'quinta': 4, 'sexta': 5, 'sabado': 6,
  }
  const idxAlvo = diaToIdx[diaSemanaPt]
  if (idxAlvo === undefined) return null
  const offsetDias = idxAlvo - 1
  if (offsetDias < 0 || offsetDias > 4) return null
  if (!dataInicio) return null

  const inicio = new Date(dataInicio + 'T12:00:00')
  const dataDia = new Date(inicio)
  dataDia.setDate(inicio.getDate() + offsetDias)
  const dataIso = dataDia.toISOString().split('T')[0]

  const feriado = feriados.find((f) => f.data === dataIso)
  if (!feriado) return null
  const afetadas = feriado.escolas_afetadas || 'TODAS'
  if (afetadas === 'TODAS') return { nome: feriado.nome, tipo: feriado.tipo }
  const map: Record<string, string[]> = {
    'REGULARES': ['REGULAR'], 'INTEGRAIS': ['INTEGRAL'], 'CRECHES': ['CRECHE'],
    'BIFASICA': ['BIFASICA'], 'INTERIOR': ['INTERIOR'], 'OUTROS': ['OUTROS'],
  }
  if (!(map[afetadas] || [afetadas]).includes(categoriaEscola)) return null
  return { nome: feriado.nome, tipo: feriado.tipo }
}

function SemanaPrintPage({
  semana,
  cardapio,
  feriados = [],
}: {
  semana: CardapioSemana
  cardapio: CardapioFull
  feriados?: FeriadoInfo[]
}) {
  // v8.7: tipos de refeição que aparecem nesta semana, ordenados por HORÁRIO
  // cronológico (não mais por tipo_refeicao.ordem).
  // Usa horário customizado do cardápio se existir; senão usa default.
  const horariosOverride = (cardapio.horarios_refeicoes || []) as Array<{
    tipo_refeicao_id: string
    horario: string
  }>
  const tiposRefeicao = semana.dias
    .flatMap((d) => d.itens.map((i) => i.tipo_refeicao))
    .filter((tr, idx, arr) => arr.findIndex((t) => t.id === tr.id) === idx)
    .map((tr) => {
      const override = horariosOverride.find(h => h.tipo_refeicao_id === tr.id)
      return {
        ...tr,
        // horário efetivo = override se existir, senão default
        horario_efetivo: override?.horario ?? tr.horario,
      }
    })
    .sort((a, b) => parseHorarioToMinutes(a.horario_efetivo) - parseHorarioToMinutes(b.horario_efetivo))

  // v8.13: filtra slots sub (serão renderizados DENTRO do slot pai)
  // e busca o slot sub de cada tipo pai (se existir)
  const tiposRefeicaoPrincipais = tiposRefeicao.filter(
    tr => !tr.sub_de_codigo
  )

  // Para cada tipo pai, encontra seu sub (se houver)
  function getSubDoTipo(tipoPaiCodigo: string) {
    return tiposRefeicao.find(tr => tr.sub_de_codigo === tipoPaiCodigo) || null
  }

  // v8.13: helper para verificar se é slot "Lanche Pré-Escola" vazio
  // (deve mostrar "Igual creche" em vez de "—")
  function ehLanchePreEscolaVazio(tr: { codigo: string; sub_de_codigo?: string | null }): boolean {
    return tr.codigo === 'LANCHE_PRE_ESCOLA' && !tr.sub_de_codigo
  }

  const resumo = calcularResumoSemanaPDF(semana, cardapio.fase_escolar)

  // Compute actual date for each weekday based on data_inicio
  function getDiaDate(diaSemana: string): string {
    const diaData = semana.dias.find((d) => d.dia_semana === diaSemana)
    if (!diaData) return ''
    const idx = DIAS_SEMANA_NUTRI.findIndex(d => d.value === diaSemana)
    if (idx >= 0 && semana.data_inicio) {
      const base = new Date(semana.data_inicio + 'T12:00:00')
      base.setDate(base.getDate() + idx)
      return base.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    }
    return ''
  }

  return (
    <div className="semana-page">
      {/* ── HEADER ── Premium compact strip */}
      <div className="sp-header">
        <div className="sp-header-brand">
          <span className="sp-title">{cardapio.nome}</span>
        </div>
        <div className="sp-header-meta">
          <span className="sp-meta-item"><strong>Escola:</strong> {cardapio.escola?.nome || 'Modelo base'}</span>
          <span className="sp-meta-divider">&#x2022;</span>
          <span className="sp-meta-item"><strong>Categoria:</strong> {cardapio.categoria_escola}</span>
          <span className="sp-meta-divider">&#x2022;</span>
          <span className="sp-meta-item"><strong>Fase:</strong> {getFaseLabel(cardapio.fase_escolar)}</span>
        </div>
        <div className="sp-header-week">
          <span className="sp-week-label">Semana {semana.numero}</span>
          <span className="sp-week-dates">{formatDateShort(semana.data_inicio)} — {formatDateShort(semana.data_fim)}</span>
        </div>
      </div>

      {/* ── LEGENDA DE ALÉRGENOS + NUTRICIONISTAS ── faixa horizontal compacta (P&B) */}
      <div className="sp-legend-alergenos">
        <span className="sp-legend-label">Alérgenos:</span>
        {ALERGENOS_LIST.map((a) => (
          <span key={a.sigla} className="sp-legend-item">
            <span className="sp-alergeno-badge sp-alergeno-badge-sm">
              {a.sigla}
            </span>
            <span className="sp-legend-nome">
              {a.sigla === 'L' ? 'Leite/Lactose' : a.nome}
            </span>
          </span>
        ))}
        {/* v8: Nutricionistas na mesma linha da legenda */}
        {(cardapio.equipe_nutricionistas?.length ?? 0) > 0 && (
          <span className="sp-legend-nutricionistas">
            <span className="sp-legend-label" style={{ marginLeft: '3mm' }}>Nutricionistas:</span>{' '}
            {cardapio.equipe_nutricionistas!.map((n, i) => (
              <span key={n.id} className="sp-legend-nutri-nome">
                {n.nome} <span style={{ fontSize: '4.5pt', fontStyle: 'italic', color: '#000' }}>CRN {n.crn}</span>
                {i < cardapio.equipe_nutricionistas!.length - 1 ? ', ' : ''}
              </span>
            ))}
          </span>
        )}
      </div>

      {/* ── MENU TABLE — Main content ── */}
      <table className="sp-table">
        <thead>
          <tr>
            <th className="sp-th-ref">Refeição</th>
            {DIAS_SEMANA_NUTRI.map((dia) => {
              const diaData = semana.dias.find((d) => d.dia_semana === dia.value)
              const feriado = getFeriadoDoDiaCalc(semana.data_inicio, dia.value, feriados, cardapio.categoria_escola)
              return (
                <th
                  key={dia.value}
                  className="sp-th-dia"
                >
                  <span className="sp-dia-nome">{dia.label}</span>
                  <span className="sp-dia-data">{getDiaDate(dia.value)}</span>
                  {feriado && (
                    <span className="sp-dia-feriado" title={`Feriado: ${feriado.nome}`}>
                      🚫 {feriado.nome}
                    </span>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {tiposRefeicaoPrincipais.map((tr) => {
            // v8.13: busca o slot sub deste tipo pai (ex: FRUTA_MANHA é sub de CAFE_MANHA)
            const trSub = getSubDoTipo(tr.codigo)

            return (
            <tr key={tr.id} className="sp-row">
              <td className="sp-td-ref">
                <span className="sp-ref-nome">{tr.nome}</span>
                {/* v8.7: usa horário efetivo (override se existir) */}
                <span className="sp-ref-hora">{(tr as { horario_efetivo?: string }).horario_efetivo ?? tr.horario}</span>
                {/* v8.13: se tem sub, mostra nome do sub abaixo */}
                {trSub && (
                  <span className="sp-ref-sub">
                    ↳ {trSub.nome} ({(trSub as { horario_efetivo?: string }).horario_efetivo ?? trSub.horario})
                  </span>
                )}
              </td>
              {DIAS_SEMANA_NUTRI.map((dia) => {
                const diaData = semana.dias.find((d) => d.dia_semana === dia.value)
                const itensRaw = diaData?.itens.filter((i) => i.tipo_refeicao_id === tr.id) || []
                // v8: aplica mesma ordenação do editor (auto-sort + ordem manual)
                const itens = sortItensByRefeicao(itensRaw, tiposRefeicao)
                // v8.13: itens do sub (se houver)
                const itensSubRaw = trSub
                  ? (diaData?.itens.filter((i) => i.tipo_refeicao_id === trSub.id) || [])
                  : []
                const itensSub = trSub ? sortItensByRefeicao(itensSubRaw, tiposRefeicao) : []

                const feriado = getFeriadoDoDiaCalc(semana.data_inicio, dia.value, feriados, cardapio.categoria_escola)

                // v8.13: placeholder "Igual creche" para LANCHE_PRE_ESCOLA vazio
                const mostrarIgualCreche = !feriado && ehLanchePreEscolaVazio(tr) && itens.length === 0

                return (
                  <td
                    key={dia.value}
                    className="sp-td-dia"
                  >
                    {feriado ? (
                      <span className="sp-prep-vazio">—</span>
                    ) : itens.length > 0 ? (
                      <ul className="sp-prep-list">
                        {itens.map((item) => {
                          const alergenos = detectarAlergenosPreparacao(
                            item.preparacao.ingredientes.map((ing) => ({
                              nome: ing.alimento.nome,
                              grupo: ing.alimento.grupo,
                            }))
                          )
                          return (
                            <li key={item.id} className="sp-prep-item">
                              <div className="sp-prep-nome">
                                <span className="sp-prep-nome-text">{item.preparacao.nome}</span>
                                {alergenos.length > 0 && (
                                  <span className="sp-prep-alergenos">
                                    {alergenos.map((sigla: AlergenoSigla) => (
                                      <span
                                        key={sigla}
                                        className="sp-alergeno-badge sp-alergeno-badge-xs"
                                        title={`${ALERGENOS[sigla].nome}: ${ALERGENOS[sigla].descricao}`}
                                      >
                                        {sigla}
                                      </span>
                                    ))}
                                  </span>
                                )}
                              </div>
                              {(() => {
                                // v8.12: Filtra ingredientes com percapita=0 para a fase do cardápio
                                // (ex: açúcar em creche/berçário — não mostra no PDF impresso)
                                const ingsVisiveis = item.preparacao.ingredientes.filter((ing) => {
                                  if (ing.mesma_percapita) return ing.quantidade_gramas > 0
                                  const gramas = getGramasForFase(ing, cardapio.fase_escolar)
                                  return gramas > 0
                                })
                                if (ingsVisiveis.length === 0) return null
                                return (
                                  <div className="sp-prep-ing">
                                    {ingsVisiveis.map((ing) => limparNomeIngrediente(ing.alimento.nome)).join(', ')}
                                  </div>
                                )
                              })()}
                            </li>
                          )
                        })}
                      </ul>
                    ) : mostrarIgualCreche ? (
                      <span className="sp-prep-igual-creche">igual creche</span>
                    ) : (
                      <span className="sp-prep-vazio">—</span>
                    )}

                    {/* v8.13: renderiza itens do SUB dentro da mesma célula */}
                    {trSub && !feriado && itensSub.length > 0 && (
                      <ul className="sp-prep-list sp-prep-list-sub">
                        {itensSub.map((item) => {
                          const alergenos = detectarAlergenosPreparacao(
                            item.preparacao.ingredientes.map((ing) => ({
                              nome: ing.alimento.nome,
                              grupo: ing.alimento.grupo,
                            }))
                          )
                          return (
                            <li key={item.id} className="sp-prep-item sp-prep-item-sub">
                              <div className="sp-prep-nome">
                                <span className="sp-prep-nome-text">↳ {item.preparacao.nome}</span>
                                {alergenos.length > 0 && (
                                  <span className="sp-prep-alergenos">
                                    {alergenos.map((sigla: AlergenoSigla) => (
                                      <span
                                        key={sigla}
                                        className="sp-alergeno-badge sp-alergeno-badge-xs"
                                        title={`${ALERGENOS[sigla].nome}: ${ALERGENOS[sigla].descricao}`}
                                      >
                                        {sigla}
                                      </span>
                                    ))}
                                  </span>
                                )}
                              </div>
                              {(() => {
                                const ingsVisiveis = item.preparacao.ingredientes.filter((ing) => {
                                  if (ing.mesma_percapita) return ing.quantidade_gramas > 0
                                  const gramas = getGramasForFase(ing, cardapio.fase_escolar)
                                  return gramas > 0
                                })
                                if (ingsVisiveis.length === 0) return null
                                return (
                                  <div className="sp-prep-ing">
                                    {ingsVisiveis.map((ing) => limparNomeIngrediente(ing.alimento.nome)).join(', ')}
                                  </div>
                                )
                              })()}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </td>
                )
              })}
            </tr>
            )
          })}
        </tbody>
      </table>

      {/* ── NUTRITIONAL SUMMARY — Compact horizontal strip ── */}
      <div className="sp-resumo">
        <div className="sp-resumo-title">
          Resumo Nutricional — Média Diária | {getFaseLabel(cardapio.fase_escolar)}
          <span className="sp-resumo-aviso">* Cardápio sujeito a alterações sem aviso prévio.</span>
        </div>
        <div className="sp-resumo-grid">
          {/* Col 1: Macronutrientes */}
          <div className="sp-resumo-section">
            <div className="sp-section-head">Macronutrientes</div>
            <div className="sp-kv"><span>Energia</span><strong>{resumo.media_dia.energia_kcal.toFixed(0)} kcal</strong></div>
            <div className="sp-kv"><span>Carboidratos</span><strong>{resumo.media_dia.carboidratos_g.toFixed(1)} g</strong></div>
            <div className="sp-kv"><span>Proteínas</span><strong>{resumo.media_dia.proteinas_g.toFixed(1)} g</strong></div>
            <div className="sp-kv"><span>Lipídios</span><strong>{resumo.media_dia.lipidios_g.toFixed(1)} g</strong></div>
            <div className="sp-kv"><span>Fibra Alimentar</span><strong>{resumo.media_dia.fibra_alimentar_g.toFixed(1)} g</strong></div>
          </div>
          {/* Col 2: Micronutrientes */}
          <div className="sp-resumo-section">
            <div className="sp-section-head">Micronutrientes</div>
            <div className="sp-kv"><span>Ferro</span><strong>{resumo.media_dia.ferro_mg.toFixed(1)} mg</strong></div>
            <div className="sp-kv"><span>Vit. A</span><strong>{resumo.media_dia.vitamina_a_mcg.toFixed(0)} mcg</strong></div>
            <div className="sp-kv"><span>Vit. C</span><strong>{resumo.media_dia.vitamina_c_mg.toFixed(1)} mg</strong></div>
            <div className="sp-kv"><span>Cálcio</span><strong>{resumo.media_dia.calcio_mg.toFixed(0)} mg</strong></div>
          </div>
          {/* Col 3: Distribuição VET */}
          <div className="sp-resumo-section">
            <div className="sp-section-head">Distribuição VET</div>
            <div className="sp-kv"><span>Carboidratos</span><strong>{resumo.percentuais.carboidratos_pct.toFixed(1)}%</strong></div>
            <div className="sp-kv"><span>Proteínas</span><strong>{resumo.percentuais.proteinas_pct.toFixed(1)}%</strong></div>
            <div className="sp-kv"><span>Lipídios</span><strong>{resumo.percentuais.lipidios_pct.toFixed(1)}%</strong></div>
            <div className="sp-kv"><span>Açúcar Adic.</span><strong>{resumo.percentuais.acucar_pct.toFixed(1)}%</strong></div>
            <div className="sp-kv sp-kv-total"><span>Energia Total</span><strong>{resumo.media_dia.energia_kcal.toFixed(0)} kcal</strong></div>
          </div>
        </div>
      </div>

      {/* v8: Aviso movido para dentro do resumo nutricional */}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────

export default function CardapioPdfPage() {
  const params = useParams()
  const cardapioId = params.id as string

  const [cardapio, setCardapio] = useState<CardapioFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSemana, setSelectedSemana] = useState('1')
  const [printMode, setPrintMode] = useState<'semana' | 'semestral'>('semana')
  // v8: feriados para mostrar no PDF
  const [feriados, setFeriados] = useState<FeriadoInfo[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cardRes, ferRes] = await Promise.all([
        fetch(`/api/nutricao/cardapios/${cardapioId}`),
        fetch('/api/feriados'),
      ])
      if (!cardRes.ok) throw new Error('Erro ao carregar cardápio')
      const data = await cardRes.json()
      const ferData = ferRes.ok ? await ferRes.json() : []
      setCardapio(data)
      setFeriados(Array.isArray(ferData) ? ferData : [])
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar o cardápio.')
    } finally {
      setLoading(false)
    }
  }, [cardapioId])

  useEffect(() => { loadData() }, [loadData])

  function handlePrint() {
    // v8: Define o título da página = nome do cardápio para o navegador usar como nome do arquivo
    if (cardapio) {
      const semanasLabel = printMode === 'semestral'
        ? 'Completo'
        : `Semana ${selectedSemana}`
      document.title = `${cardapio.nome} — ${semanasLabel}`
    }
    window.print()
    // Restaura o título original após imprimir
    setTimeout(() => { document.title = 'Padaria Escolar' }, 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
          <span className="text-muted-foreground">Carregando cardápio...</span>
        </div>
      </div>
    )
  }

  if (error || !cardapio) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-red-500 mb-3">{error || 'Cardápio não encontrado.'}</p>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="w-3 h-3 mr-1" /> Tentar novamente
        </Button>
      </div>
    )
  }

  const semanasToPrint = printMode === 'semana'
    ? [cardapio.semanas.find((s) => s.numero === Number(selectedSemana))].filter(Boolean) as CardapioSemana[]
    : cardapio.semanas

  return (
    <div className="space-y-4 max-w-[1200px] mx-auto">
      {/* Top Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-xl border border-[#1A3A5C]/10 shadow-sm print:hidden"
      >
        <div className="flex items-center gap-3">
          <Link href={`/nutricao/cardapios/${cardapioId}`}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[#1A3A5C] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#D4A017]" />
              PDF — {cardapio.nome}
            </h1>
            <p className="text-xs text-muted-foreground">
              {cardapio.escola?.nome || 'Modelo base'} · {cardapio.ano}/{cardapio.semestre}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setPrintMode('semana')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                printMode === 'semana' ? 'bg-white text-[#1A3A5C] shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="w-3 h-3" /> Semana
            </button>
            <button
              onClick={() => setPrintMode('semestral')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                printMode === 'semestral' ? 'bg-white text-[#1A3A5C] shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BookOpen className="w-3 h-3" /> Semestral
            </button>
          </div>
          <Button variant="outline" size="sm" className="text-xs" onClick={handlePrint}>
            <Printer className="w-3 h-3 mr-1" /> Imprimir / Salvar PDF
          </Button>
        </div>
      </motion.div>

      {/* Week Selection */}
      {printMode === 'semana' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="print:hidden">
          <Tabs value={selectedSemana} onValueChange={setSelectedSemana}>
            <TabsList className="h-8 flex-wrap">
              {cardapio.semanas.map((s) => (
                <TabsTrigger key={s.id} value={String(s.numero)} className="text-[10px] h-6 px-2">
                  Sem {s.numero}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </motion.div>
      )}

      {/* Print Pages */}
      <div className="print-container">
        {semanasToPrint.map((semana) => (
          <SemanaPrintPage key={semana.id} semana={semana} cardapio={cardapio} feriados={feriados} />
        ))}
      </div>
    </div>
  )
}
