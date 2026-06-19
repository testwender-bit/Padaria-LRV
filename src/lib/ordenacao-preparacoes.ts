// ============================================================
// ordenacao-preparacoes.ts — Ordenação automática de preparações
// ============================================================
// Define a ordem de exibição das preparações dentro de cada
// refeição, baseada em palavras-chave no nome da preparação.
//
// Regras:
//   Café da manhã: Bebidas primeiro, depois sólidos
//   Fruta da manhã: Frutas primeiro, depois acompanhamento
//   Almoço/Lanche/Jantar: Salada → Arroz → Feijão → Proteína → Acompanhamento → Suco
//   Hidratação: Frutas primeiro, depois acompanhamento
// ============================================================

// ── Palavras-chave por categoria ──
// ORDEM DE CHECAGEM IMPORTA! Ver função detectarCategoria() abaixo.

const KW_SALADA = [
  'salada', 'vinagrete', 'alface', 'acelga', 'rúcula', 'rucula',
]

const KW_PROTEINA = [
  'carne', 'frango', 'peixe', 'tilápia', 'tilapia', 'fígado', 'figado',
  'moela', 'ovo', 'salsicha', 'linguiça', 'linguica', 'calabresa',
  'soja', 'proteína', 'proteina', 'patinho', 'coxão', 'acém', 'acem',
  'suína', 'suina', 'carreteiro', 'ragu', 'isca', 'risoto',
  'panqueca', 'escondidinho', 'vaca atolada', 'vacas atoladas',
  'galinha atolada', 'carne moída', 'carne moida', 'carne bovina',
  'frango ao molho', 'frango com', 'carne suína', 'carne suina',
  'dueto', 'isca de fígado', 'isca de figado', 'strogonoff',
  'sopa de frango', 'sopa de carne', 'molho de salsicha',
  'molho de calabresa',
  'falso feijão tropeiro', 'farofa de carne', 'farofa de fígado',
  'farofa de figado', 'farofa de proteína', 'polenta recheada',
  'omelete', 'arroz de carreteiro', 'peito de frango',
  'file de peito de frango', 'filé de peito de frango',
  'file de tilápia', 'filé de tilápia', 'file de frango', 'filé de frango',
  'carne bovina em pedaço', 'carne bovina em pedacos',
  'carne bovina moída', 'carne bovina moida',
  'carne suína de panela', 'carne suína com', 'ragu de carne',
  'molho de carne', 'bobó', 'bobo', 'mojica', 'escaldado',
  'patê', 'pate', 'moqueca', 'vatapá', 'vatapa',
  'arroz caipira', 'arroz com frango', 'arroz com banana e linguiça',
  'arroz nutritivo', 'arroz com carne',
  'pão com carne', 'pão com ovo', 'pão com pasta', 'pão com salsicha',
  'pao com carne', 'pao com ovo', 'pao com pasta', 'pao com salsicha',
  'feijoada',
]

const KW_PAO = [
  'pão', 'pao ', 'pão ', 'pãozinho', 'paozinho',
  'pão francês', 'pao frances', 'pão de forma', 'pao de forma',
  'pão qc', 'pao qc', 'pão cq', 'pao cq',
  'pão com', 'pao com',
  'pão com doce', 'pao com doce',
  'pão com manteiga', 'pao com manteiga',
  'pão com nata', 'pao com nata',
  'pão com requeijão', 'pao com requeijao',
  'cuscuz',
]

const KW_BEBIDA = [
  'leite', 'café', 'cafe', 'vitamina', 'chá', 'cha ', 'chá ', 'achocolatado',
  'água', 'agua', 'iogurte', 'leite com cacau', 'leite puro',
  'leite integral', 'leite desnatado', 'leite semidesnatado',
  'mingau', 'chá mate', 'cha mate',
  'creme de chocolate',
]

const KW_ARROZ = ['arroz']

const KW_FEIJAO = [
  'feijão', 'feijao', 'virado de feijão', 'virado de feijao',
  'sopa de feijão', 'sopa de feijao',
]

const KW_SUCO = ['suco']

const KW_FRUTA = [
  'banana', 'maçã', 'mamão', 'mamao', 'laranja', 'abacaxi',
  'melancia', 'melão', 'melao', 'manga', 'uva', 'pera', 'pêssego',
  'pessego', 'goiaba', 'acerola', 'caju', 'cajá', 'caja', 'maracujá',
  'maracuja', 'fruta', 'salada de fruta', 'sorvete de frutas',
  'sorvete', 'frozen de', 'poncã', 'poncan', 'mexerica', 'caqui', 'seriguela',
  'pitaya',
]

const KW_ACOMPANHAMENTO = [
  'purê', 'pure', 'batata', 'legumes', 'legume', 'abóbora', 'abobora',
  'couve', 'repolho', 'quiabo', 'maxixe', 'chuchu', 'cuscu',
  'farofa', 'polenta', 'mandioca', 'macarrão', 'macarrao', 'espaguete',
  'nhoque', 'lasanha', 'canjica', 'angu', 'creme de milho', 'creme de ervilha',
  'sopa de', 'caldo', 'curau', 'bolinho', 'fubá', 'fuba',
  'farinha de mandioca', 'virado', 'minestra', 'abobrinha', 'ervilha',
  'milho', 'flocos de milho', 'batata doce', 'batata-doce', 'batata sauté',
  'batata inglesa', 'legumes ao molho', 'legumes refogados',
  'abóbora refogada', 'abobora refogada', 'couve refogada',
  'repolho refogado', 'quiabo refogado',
  'arroz com feijão', 'arroz com feijao', 'arroz com cenoura',
  'arroz com abobrinha', 'arroz com lentilha', 'arroz alegria',
  'arroz colorido', 'arroz branco', 'arroz integral',
  'feijão tropeiro', 'feijao tropeiro', 'falso feijão',
  'creme de frango', 'misto quente', 'molho de tomate',
  'brócolis', 'brocolis', 'cenoura', 'vagem', 'lentilha',
  'macarrão de sopa', 'macarrao de sopa',
]

type Categoria = 'SALADA' | 'ARROZ' | 'FEIJAO' | 'PROTEINA' | 'ACOMPANHAMENTO' | 'SUCO' | 'BEBIDA' | 'FRUTA' | 'PAO' | 'OUTRO'

function detectarCategoria(nome: string): Categoria {
  const n = nome.toLowerCase().trim()

  // 1. SALADA primeiro (sempre)
  if (KW_SALADA.some(kw => n.includes(kw))) return 'SALADA'

  // 2. PROTEINA antes de ARROZ/PAO/FEIJAO (para pegar "Arroz com frango", "Pão com salsicha", "Feijoada")
  if (KW_PROTEINA.some(kw => n.includes(kw))) return 'PROTEINA'

  // 3. PAO antes de BEBIDA/FRUTA (para pegar "Pão com doce de leite", "Pão com doce de fruta")
  if (KW_PAO.some(kw => n.includes(kw))) return 'PAO'

  // 4. BEBIDA antes de FRUTA (para pegar "Mingau de aveia com banana", "Vitamina de Goiaba")
  if (KW_BEBIDA.some(kw => n.includes(kw))) return 'BEBIDA'

  // 5. ARROZ (após PROTEINA, para não pegar "Arroz com frango")
  if (KW_ARROZ.some(kw => n.includes(kw))) return 'ARROZ'

  // 6. FEIJAO
  if (KW_FEIJAO.some(kw => n.includes(kw))) return 'FEIJAO'

  // 7. SUCO
  if (KW_SUCO.some(kw => n.includes(kw))) return 'SUCO'

  // 8. FRUTA (após BEBIDA, para não pegar "Mingau com banana")
  if (KW_FRUTA.some(kw => n.includes(kw))) return 'FRUTA'

  // 9. ACOMPANHAMENTO
  if (KW_ACOMPANHAMENTO.some(kw => n.includes(kw))) return 'ACOMPANHAMENTO'

  return 'OUTRO'
}

/**
 * Retorna a prioridade de uma preparação dentro de uma refeição.
 * Menor número = aparece primeiro.
 */
export function getPrioridadePrep(nome: string, tipoRefeicaoCodigo: string): number {
  const categoria = detectarCategoria(nome)

  switch (tipoRefeicaoCodigo) {
    case 'CAFE_MANHA':
      // Bebidas primeiro, depois sólidos
      if (categoria === 'BEBIDA' || categoria === 'SUCO' || categoria === 'FRUTA') return 0
      return 1

    case 'FRUTA_MANHA':
      // Frutas primeiro, depois acompanhamento
      if (categoria === 'FRUTA') return 0
      return 1

    case 'ALMOCO':
    case 'LANCHE':
    case 'JANTAR':
    case 'LANCHE_1':
    case 'LANCHE_2':
      // salada → arroz → feijão → proteína → pão/acompanhamento → fruta/outro → suco/bebida
      switch (categoria) {
        case 'SALADA': return 0
        case 'ARROZ': return 1
        case 'FEIJAO': return 2
        case 'PROTEINA': return 3
        case 'PAO': return 4
        case 'ACOMPANHAMENTO': return 4
        case 'OUTRO': return 5
        case 'FRUTA': return 5
        case 'SUCO': return 6
        case 'BEBIDA': return 6
        default: return 5
      }

    case 'HIDRATACAO':
      // Frutas primeiro, depois acompanhamento
      if (categoria === 'FRUTA') return 0
      return 1

    default:
      return 0
  }
}

/**
 * Ordena itens de uma refeição baseado nas regras de prioridade.
 * Se ALGUM item tem `ordem` > 0 (definida manualmente), respeita a ordem manual.
 * Caso contrário, aplica auto-sort.
 */
export function sortItensByRefeicao<
  T extends {
    preparacao: { nome: string }
    tipo_refeicao_id?: string
    tipo_refeicao?: { id: string; codigo: string }
    ordem?: number
  }
>(itens: T[], tiposRefeicao: Array<{ id: string; codigo: string }>): T[] {
  if (itens.length <= 1) return itens

  // Se ALGUM tem ordem > 0, respeita ordem manual para TODOS
  const temOrdemManual = itens.some(i => (i.ordem ?? 0) > 0)

  if (temOrdemManual) {
    return [...itens].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  }

  // Auto-sort baseado nas regras
  const primeiroItem = itens[0]
  const tipoRefeicaoId = primeiroItem.tipo_refeicao_id || primeiroItem.tipo_refeicao?.id
  const tipoRefeicao = tiposRefeicao.find(t => t.id === tipoRefeicaoId)
  const codigo = tipoRefeicao?.codigo || ''

  return [...itens].sort((a, b) => {
    const prioA = getPrioridadePrep(a.preparacao.nome, codigo)
    const prioB = getPrioridadePrep(b.preparacao.nome, codigo)
    if (prioA !== prioB) return prioA - prioB
    // Mesma prioridade → ordem alfabética
    return a.preparacao.nome.localeCompare(b.preparacao.nome)
  })
}
