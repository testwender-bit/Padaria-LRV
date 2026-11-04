// ============================================================
// LÓGICA DE PRODUÇÃO — calcula o que produzir em cada dia
// ============================================================

import { addDays, format } from 'date-fns'
import type { DiaSemana } from './date-utils'

// Mapeia dia de PRODUÇÃO -> dia de ENTREGA (defasagem D-1)
export const PF_PRODUCAO_PARA_ENTREGA: Record<string, DiaSemana> = {
  domingo: 'segunda',
  segunda: 'terca',
  terca: 'quarta',
  quarta: 'quinta',
  quinta: 'sexta',
}

// Os ciclos do PCQ — PCQ é produzido e entregue no MESMO DIA (sem deslocamento)
export const PCQ_PRODUCAO = {
  segunda: { entregas: ['segunda'] as DiaSemana[], campo: 'prod_segunda', pf_comp: 'pf_comp_segunda' },
  quarta: { entregas: ['quarta'] as DiaSemana[], campo: 'prod_quarta', pf_comp: 'pf_comp_quarta' },
  sexta: { entregas: ['sexta'] as DiaSemana[], campo: 'prod_sexta', pf_comp: 'pf_comp_sexta' },
} as const

// v9.9.1: Conversão do PCQ (pão de cachorro quente).
// 1 forma inteira = 50 pães de cachorro quente. Usado na legenda discreta
// "(N)" exibida ao lado da quantidade das unidades Busca Própria
// (ex.: "Bombeiro 1 (50)" = 1 forma = 50 pães).
// v9.9.2: ajustado de 60 para 50 pães por forma.
export const FORMA_PCQ_PAES = 50

// v9.9.1: true quando a unidade é "Busca Própria" (retira no balcão).
// Considera os dois sinais que existem no sistema:
//  - rota === 'BUSCA_PROPRIA' (seletor "Rota" em Configurações → Escolas)
//  - flag booleana busca_propria do cadastro (mantida por compatibilidade)
export function ehBuscaPropria(escola: { rota?: string | null; busca_propria?: boolean | null }): boolean {
  if (escola.busca_propria === true) return true
  return (escola.rota || '').toUpperCase() === 'BUSCA_PROPRIA'
}

// v9.9.1: Formata a conversão formas → pães para a legenda discreta.
// Ex.: 1 → "(50)", 0.5 → "(25)", 1.5 → "(75)", 2 → "(100)"
// v9.9.2: normaliza a entrada antes de multiplicar — se a quantidade vier
// carregando resíduo binário (ex.: 0.30000000000000004), a conversão também
// sairia com resíduo e cairia no caminho decimal da formatação. Arredondando
// para 2 casas, o resultado volta a ser inteiro exato (0.3 × 50 = 15).
export function legendaPcqPaes(qtdFormas: number): string {
  const paes = arredondarFormas(qtdFormas * FORMA_PCQ_PAES)
  const texto = Number.isInteger(paes)
    ? paes.toLocaleString('pt-BR')
    : paes.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  return `(${texto})`
}

// v9.9.2: Elimina resíduos de ponto flutuante em somas de quantidades
// fracionárias (formas de PCQ). Em JavaScript, 0.1 + 0.2 = 0.30000000000000004
// e a soma de muitas formas quebradas produzia totais como
// "50.20000000000001" na linha "Total PCQ" da produção.
// Estratégia: acumular em centésimos inteiros (0.1 → 10) e voltar para
// decimal no final — inteiro é exato em ponto flutuante.
export function arredondarFormas(valor: number): number {
  return Math.round(valor * 100) / 100
}

// v9.9.2: Formata quantidade em formas para exibição pt-BR (vírgula decimal,
// até 2 casas, sem zeros à direita). Usado nas células do PCQ da produção
// (tela Semanal e impressão P3) para manter o padrão visual da coluna Total
// (que já usava toLocaleString) e nunca mostrar resíduos binários.
// Ex.: 18 → "18", 2.5 → "2,5", 0.1 → "0,1", 50.2 → "50,2"
export function formatarFormas(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

// v9.10.10 · v9.10.11: Formata uma quantidade de Pão Francês que pode conter
// Pão Complemento para a impressão da folha de produção (ambas as vias).
// O total impresso continua o MESMO (soma base + complemento), mas quando a
// célula contém complemento ele aparece SEPARADO: "150 + 10" (= 160).
// Regras:
//  - total <= 0 → "—" (célula vazia, como sempre).
//  - complemento > 0 → "base + complemento" SEMPRE — v9.10.11: mesmo com
//    base = 0 (ex.: creche cujo pão vem só do complemento) mostra "0 + 10",
//    para manter o padrão claro em todas as células com complemento.
//  - defensivo: se a base desse negativa (dados inconsistentes), cai no
//    número puro (nunca imprime valor negativo).
//  - sem complemento → número puro, exatamente como antes.
// O formatador é injetado para manter o estilo de cada posição da tabela.
// NOTA v9.10.11: na folha impressa, o helper agora é usado SOMENTE nas
// células de dia — coluna TOTAL da escola e linha TOTAL GERAL voltaram à
// somatória pura (toLocaleString), sem o "+ x", para não poluir os totais.
export function formatarPfComComplemento(
  total: number,
  complemento: number,
  formatar: (n: number) => string = (n) => String(n)
): string {
  if (!(total > 0)) return '—'
  const base = total - complemento
  if (complemento > 0 && base >= 0) return `${formatar(base)} + ${formatar(complemento)}`
  return formatar(total)
}

// v9.10.12: Parse tolerante de quantidade digitada — aceita vírgula OU ponto
// decimal ("0,5" / "0.5" → 0.5), clampa em >= 0 e cai em 0 se inválido.
// Usado pelo diálogo de Ajuste e pelo Inst. Extra: PCQ é medido em FORMAS e
// precisa aceitar decimais (0,5 forma = 25 pães), que antes eram cortados
// pelo parseInt ("0,5" virava 0).
export function parseQuantidadeDecimal(texto: string): number {
  const normalizado = String(texto ?? '').trim().replace(',', '.')
  const n = parseFloat(normalizado)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

// v9.10.12: Formata número para EXIBIÇÃO no input decimal pt-BR (vírgula).
// Inteiros saem sem casa decimal ("2"); 0.5 → "0,5".
export function formatarValorDecimal(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return String(n).replace('.', ',')
}

// v9.10.12: Mini-descritor da escola com PCQ habilitado — vem da API
// /api/producao no campo `escolas_pcq` (escolas ATIVAS com recebe_pcq = true
// e configuração de PCQ existente). A view Por Dia usa para listar unidades
// elegíveis mesmo em dias sem produção padrão (ter/qui), permitindo criar
// produção excepcional com um clique, sem poluir a API de itens.
export interface EscolaPcqHabilitada {
  id: string
  nome: string
  nome_curto: string
  categoria: string
  rota: string
  ordem_rota: number
  ordem_pcq: number
  busca_propria: boolean
}

// v9.10.12: Mescla os itens de PCQ do dia com linhas "excepcionais" das escolas
// habilitadas que ficaram sem item no dia. Casos:
//  - seg/qua/sex (dias padrão): a API já gera item para TODAS as elegíveis
//    (v9.7.3, inclusive zeradas) → nenhum fantasma é criado, lista intocada.
//  - ter/qui (dias excepcionais, v9.10.4): a API só gera item p/ escola COM
//    ajuste → as demais elegíveis ganham linha fantasma (quantidade 0 + flag
//    `excepcional`), clicável para criar o ajuste que materializa a produção.
//  - domingo: PCQ não tem produção nem excepcional → lista intocada.
// A lista final é ordenada por ordem_pcq → nome_curto (mesmo critério da view
// Semanal e da impressão), com extras (ordem_pcq 9999) por último.
export function mesclarItensPcqExcepcionais(
  itens: ItemProducao[],
  escolasHabilitadas: EscolaPcqHabilitada[],
  diaKey: string
): ItemProducao[] {
  const lista = [...(itens || [])]
  if (diaKey === 'domingo') return lista
  const presentes = new Set(lista.map((i) => i.escola_id))
  for (const e of escolasHabilitadas || []) {
    if (!e || !e.id || presentes.has(e.id)) continue
    lista.push({
      escola_id: e.id,
      escola_nome: e.nome,
      escola_curto: e.nome_curto,
      categoria: e.categoria,
      rota: e.rota,
      ordem_rota: e.ordem_rota ?? 0,
      ordem_pcq: e.ordem_pcq ?? 0,
      busca_propria: e.busca_propria === true,
      produto: 'PCQ',
      quantidade: 0,
      unidade: 'formas',
      dia_entrega: diaKey,  // PCQ é D-0: produção = entrega
      excepcional: true,
    })
  }
  return lista.sort((a, b) => {
    const oa = (a as any).ordem_pcq ?? 0
    const ob = (b as any).ordem_pcq ?? 0
    if (oa !== ob) return oa - ob
    return (a.escola_curto || '').localeCompare(b.escola_curto || '')
  })
}

// Dia de produção do LANCHE = MESMO DIA de entrega (D-0)
export const LANCHE_PRODUCAO_PARA_ENTREGA: Record<string, DiaSemana> = {
  segunda: 'segunda',
  terca: 'terca',
  quarta: 'quarta',
  quinta: 'quinta',
  sexta: 'sexta',
}

// v9.7.5: Dias de PRODUÇÃO válidos por produto.
// Usado pela view semanal para saber quais células são "clicáveis"
// (ou seja, em quais dias o produto é efetivamente produzido).
//
// PF: dom→seg, seg→ter, ter→qua, qua→qui, qui→sex (D-1). Não tem sexta
//     porque sábado não tem entrega.
// PCQ: v9.10.4 — seg/qua/sex são os dias PADRÃO (produção regular), mas
//     terça e quinta também são clicáveis para produção EXCEPCIONAL via
//     ajuste manual (a API /api/producao só gera item nesses dias quando
//     existe ajuste `${escola_id}_${dia}_PCQ` para a semana). Domingo
//     continua neutro (não existe produção de PCQ no domingo).
// LANCHE: seg→sex (D-0, mesmo dia).
// PF_COMP: dom (entrega seg), ter (entrega qua), qui (entrega sex) — D-1.
// Nota v9.10.4: para PCQ produção = entrega (D-0), portanto NÃO há o risco
// de "vazamento" v9.7.5 (que era do PF, onde dia de produção ≠ dia de entrega).
export const DIAS_PRODUCAO_POR_PRODUTO: Record<string, string[]> = {
  PF: ['domingo', 'segunda', 'terca', 'quarta', 'quinta'],
  PCQ: ['segunda', 'terca', 'quarta', 'quinta', 'sexta'],
  LANCHE: ['segunda', 'terca', 'quarta', 'quinta', 'sexta'],
  PF_COMP: ['domingo', 'terca', 'quinta'],
}

// v9.7.5: Retorna true se o dia é um dia válido de produção para o produto.
// Previne bug visual onde ajuste de quinta (entrega sexta) "vazava" para
// a coluna sexta na tabela de PF (que não tem produção de PF na sexta).
export function ehDiaProducaoDoProduto(diaProd: string, produto: string): boolean {
  const dias = DIAS_PRODUCAO_POR_PRODUTO[produto]
  return !!dias && dias.includes(diaProd)
}

// v9.8.1: Determina o tipo_pao EFETIVO de uma escola na semana.
// Regras:
// - pao_fixo=true (Bombeiros, CRAS, etc): SEMPRE usa PADRAO, ignorando tudo.
// - BIFASICA: usa lanche_bifasica_modo da semana:
//     LANCHE       → SEMPAO (bifásica só recebe pão do café da manhã;
//                  o lanche da tarde é outro tipo, vai na planilha Lanche)
//     PAO_PADRAO   → PADRAO (café da manhã + lanche da tarde com pão padrão)
//     PAO_PROTEINA → PROTEINA (café da manhã + lanche da tarde com pão proteína)
//     NENHUM       → SEMPAO (bifásica faz preparação na escola — só café da manhã)
// - v9.9.0: escola INTERIOR marcada como "especial" (interior_especial=true
//   na escola) segue a MESMA lógica da bifásica, mas usando o
//   lanche_interior_modo da semana. Demais escolas do Interior seguem o
//   tipo_pao da semana normalmente.
// - Demais escolas: usa o tipo_pao da semana (PADRAO/PROTEINA/SEMPAO).
// Nota: os novos parâmetros são OPCIONAIS para manter compatibilidade com
// chamadas antigas que passam apenas 4 argumentos.
export function tipoPaoEfetivoEscola(
  categoria: string,
  paoFixo: boolean | undefined,
  tipoPaoSemana: string,
  lancheBifasicaModo: string,
  // v9.9.0: flag da escola (interior_especial) + modo da semana
  interiorEspecial?: boolean,
  lancheInteriorModo?: string
): string {
  // pao_fixo sempre vence (Bombeiros, CRAS, etc)
  if (paoFixo === true) return 'PADRAO'

  const isBifasica = categoria === 'BIFASICA'
  // v9.9.0: interior especial — só se NÃO for bifásica (bifásica tem prioridade
  // e usa o próprio modo; uma escola não deve ter as duas flags ao mesmo tempo)
  const isInteriorEspecial = !isBifasica && interiorEspecial === true

  // BIFASICA ou INTERIOR ESPECIAL: tipo de pão depende do modo lanche da semana
  if (isBifasica || isInteriorEspecial) {
    const modo = isInteriorEspecial ? (lancheInteriorModo || 'LANCHE') : lancheBifasicaModo
    if (modo === 'PAO_PADRAO') return 'PADRAO'
    if (modo === 'PAO_PROTEINA') return 'PROTEINA'
    // LANCHE ou NENHUM: escola só recebe pão do café da manhã,
    // então usa SEMPAO (a quantidade cadastrada em SEMPAO é só café da manhã).
    return 'SEMPAO'
  }

  // Demais escolas: usa o tipo_pao da semana
  return tipoPaoSemana
}

// v9.9.0: Modo de lanche EFETIVO de uma escola na semana.
// - BIFASICA: usa lanche_bifasica_modo da semana
// - INTERIOR especial (interior_especial=true): usa lanche_interior_modo da semana
// - Demais escolas: 'LANCHE' (mesmo lanche de todo mundo)
export function modoLancheEfetivoEscola(
  categoria: string,
  interiorEspecial: boolean | undefined,
  lancheBifasicaModo: string,
  lancheInteriorModo: string
): string {
  if (categoria === 'BIFASICA') return lancheBifasicaModo || 'LANCHE'
  if (interiorEspecial === true) return lancheInteriorModo || 'LANCHE'
  return 'LANCHE'
}

// v9.9.0: true quando a escola NÃO deve receber item na planilha de Lanche
// (está em modo PAO_PADRAO, PAO_PROTEINA ou NENHUM — o lanche dela é pão
// francês já embutido no PfQuantidade do tipo correspondente, ou preparação
// na escola). Aplica à bifásica E à escola do Interior especial.
export function escolaPulaLanche(
  categoria: string,
  interiorEspecial: boolean | undefined,
  lancheBifasicaModo: string,
  lancheInteriorModo: string
): boolean {
  const modo = modoLancheEfetivoEscola(categoria, interiorEspecial, lancheBifasicaModo, lancheInteriorModo)
  return modo === 'PAO_PADRAO' || modo === 'PAO_PROTEINA' || modo === 'NENHUM'
}

export interface ItemProducao {
  escola_id: string
  escola_nome: string
  escola_curto: string
  categoria: string
  rota: string
  ordem_rota: number  // v9.5.2: OBRIGATÓRIO — usado para ordenação do PF
  ordem_pcq: number  // v9.6.3: ordenação ESPECÍFICA para PCQ (pão de cachorro quente)
  busca_propria: boolean
  produto: 'PF' | 'PCQ' | 'LANCHE' | 'PF_COMP'
  // v9.10.10: true quando o item de PF é Pão Complemento (pf_comp — unidades
  // com PCQ). Continua somando no PF normalmente; o flag existe para a
  // impressão da produção mostrar "base + complemento" separados ("150 + 10").
  complemento?: boolean
  quantidade: number
  unidade: string
  obs?: string
  dia_entrega?: string
  ajustado?: boolean
  ajuste_motivo?: string  // v9.7.4: motivo do ajuste (para exibir na UI)
  ajuste_qtd_original?: number  // v9.7.4: qtd original antes do ajuste
  // v9.10.12: linha EXCEPCIONAL da view Por Dia — escola habilitada p/ PCQ
  // sem produção no dia (ter/qui), quantidade 0, clicável p/ criar ajuste.
  // NÃO é item de produção real: some quando o ajuste/produção existir.
  excepcional?: boolean
  zerado?: boolean
  feriado_nome?: string
}

export interface ProducaoDia {
  data: string // YYYY-MM-DD
  dia_label: string // "Domingo", "Segunda"
  dia_curto: string // "Dom", "Seg"
  dia_key: string // "domingo", "segunda"
  itens_pf: ItemProducao[]
  itens_pcq: ItemProducao[]
  itens_lanche: ItemProducao[]
  total_pf: number
  total_pcq: number
  total_lanche: number
}

// Retorna o dia da semana em texto pt-BR
export function diaSemanaTexto(data: Date): string {
  const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
  return dias[data.getDay()]
}

// Calcula data de produção para PF (D-1)
export function calcularDataProducaoPF(dataEntrega: Date): Date {
  return addDays(dataEntrega, -1)
}

// Formata data como ISO YYYY-MM-DD
export function dataISO(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}
