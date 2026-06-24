// ============================================================
// ordenacao-preparacoes.ts — Ordenação automática de preparações
// ============================================================
// Define a ordem de exibição das preparações dentro de cada
// refeição, baseada em palavras-chave no nome da preparação.
//
// v5 — Nova arquitetura baseada em PERFIS de refeição:
//
//   PERFIL_PAO_LANCHE (quando o slot tem pão ou lanche especial)
//     → Bebida/Vitamina → Pão/Lanche → Fruta
//
//   PERFIL_COMIDA (refeições com arroz/proteína/salada — default)
//     → Salada → Arroz → Feijão → Proteína → Acompanhamento → Fruta → Suco
//
//   PERFIL_CUSCUZ (quando tem cuscuz — precede pão)
//     → Cuscuz → Acompanhamento (proteína/legume) → Fruta
//
// A detecção do perfil é feita POR SLOT (dia + refeição):
//   varre os itens, se tem cuscuz → CUSCUZ
//   senão se tem PAO ou LANCHE especial → PAO_LANCHE
//   senão → COMIDA
//
// Cafe da manhã / fruta da manhã / hidratação continuam com lógica própria.
//
// Botão "Reordenar dia": reseta ordem=0 de todos os itens do slot e
// re-aplica a ordenação canônica. Endpoints:
//   - POST /api/nutricao/cardapios/[id]/reordenar-dia
//     body: { semana_numero, dia_semana, tipo_refeicao_id? }
//     se tipo_refeicao_id omitido, reordena todos os slots do dia
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
]

const KW_LANCHE_ESPECIAL = [
  // Lanches especiais (categoria LANCHE em Preparacao.categoria)
  // Detectados via palavra-chave para a ordenação (não tem acesso ao campo
  // categoria do banco aqui — só ao nome da preparação).
  // Lista mantida curta porque a maioria dos "lanches especiais" usa nome
  // específico como "rosca", "bolinho", "pão doce", etc.
  'rosca', 'pão doce', 'pao doce', 'brioche',
  'croissant', 'pão de leite', 'pao de leite',
  'pão de batata', 'pao de batata',
]

const KW_CUSCUZ = [
  'cuscuz', 'cuscu',
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
  'couve', 'repolho', 'quiabo', 'maxixe', 'chuchu',
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

type Categoria =
  | 'SALADA' | 'ARROZ' | 'FEIJAO' | 'PROTEINA' | 'ACOMPANHAMENTO'
  | 'SUCO' | 'BEBIDA' | 'FRUTA' | 'PAO' | 'LANCHE' | 'CUSCUZ' | 'OUTRO'

// Normaliza nome removendo acentos, pontuação e espaços extras
// (mesma lógica aplicada em alergenos-utils.ts para casar com nomes TACO)
function normalizarNome(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[,\-.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function detectarCategoria(nome: string): Categoria {
  const n = normalizarNome(nome)

  // 1. CUSCUZ primeiro (tem regra própria no perfil dele)
  if (KW_CUSCUZ.some(kw => n.includes(kw))) return 'CUSCUZ'

  // 2. SALADA (sempre)
  if (KW_SALADA.some(kw => n.includes(kw))) return 'SALADA'

  // 3. PROTEINA antes de ARROZ/PAO/FEIJAO (para pegar "Arroz com frango", "Pão com salsicha", "Feijoada")
  if (KW_PROTEINA.some(kw => n.includes(kw))) return 'PROTEINA'

  // 4. LANCHE especial antes de PAO (para diferenciar "rosca" de "pão francês")
  if (KW_LANCHE_ESPECIAL.some(kw => n.includes(kw))) return 'LANCHE'

  // 5. PAO antes de BEBIDA/FRUTA (para pegar "Pão com doce de leite", "Pão com doce de fruta")
  if (KW_PAO.some(kw => n.includes(kw))) return 'PAO'

  // 6. BEBIDA antes de FRUTA (para pegar "Mingau de aveia com banana", "Vitamina de Goiaba")
  if (KW_BEBIDA.some(kw => n.includes(kw))) return 'BEBIDA'

  // 7. ARROZ (após PROTEINA, para não pegar "Arroz com frango")
  if (KW_ARROZ.some(kw => n.includes(kw))) return 'ARROZ'

  // 8. FEIJAO
  if (KW_FEIJAO.some(kw => n.includes(kw))) return 'FEIJAO'

  // 9. SUCO
  if (KW_SUCO.some(kw => n.includes(kw))) return 'SUCO'

  // 10. FRUTA (após BEBIDA, para não pegar "Mingau com banana")
  if (KW_FRUTA.some(kw => n.includes(kw))) return 'FRUTA'

  // 11. ACOMPANHAMENTO
  if (KW_ACOMPANHAMENTO.some(kw => n.includes(kw))) return 'ACOMPANHAMENTO'

  return 'OUTRO'
}

// ── Perfis de refeição ──
type PerfilRefeicao = 'PAO_LANCHE' | 'COMIDA' | 'CUSCUZ'

/**
 * Detecta o perfil de uma refeição (slot = dia + tipo_refeicao) baseado
 * nos itens que ela contém.
 *
 * - Se tem cuscuz → CUSCUZ (precede tudo)
 * - Senão, se tem pão (PAO) ou lanche especial (LANCHE) → PAO_LANCHE
 * - Senão → COMIDA
 */
export function detectarPerfilSlot(nomesPreparacoes: string[]): PerfilRefeicao {
  const categorias = nomesPreparacoes.map(detectarCategoria)
  if (categorias.includes('CUSCUZ')) return 'CUSCUZ'
  if (categorias.includes('PAO') || categorias.includes('LANCHE')) return 'PAO_LANCHE'
  return 'COMIDA'
}

/**
 * Retorna a prioridade de uma preparação dentro de uma refeição.
 * Menor número = aparece primeiro.
 *
 * Em refeições do tipo LANCHE/ALMOCO/JANTAR, a prioridade depende do PERFIL
 * do slot (PAO_LANCHE / COMIDA / CUSCUZ). Por isso, ao ordenar um slot,
 * prefira usar sortItensByRefeicao() que detecta o perfil automaticamente.
 *
 * Esta função mantém compatibilidade com chamadas antigas que passam só o
 * codigo do tipo de refeição (assume COMIDA se não consegue detectar perfil).
 */
export function getPrioridadePrep(nome: string, tipoRefeicaoCodigo: string): number {
  return getPrioridadePorPerfil(nome, tipoRefeicaoCodigo, 'COMIDA')
}

/**
 * Retorna a prioridade de uma preparação dado o perfil do slot.
 * Menor número = aparece primeiro.
 */
function getPrioridadePorPerfil(
  nome: string,
  tipoRefeicaoCodigo: string,
  perfil: PerfilRefeicao
): number {
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
      if (perfil === 'PAO_LANCHE') {
        // Bebida/Vitamina → Pão/Lanche → Fruta
        switch (categoria) {
          case 'BEBIDA': return 0
          case 'SUCO': return 0
          case 'PAO': return 1
          case 'LANCHE': return 1
          case 'CUSCUZ': return 1
          case 'OUTRO': return 2
          case 'FRUTA': return 3
          default: return 2 // proteína/acompanhamento no meio se aparecer junto
        }
      }
      if (perfil === 'CUSCUZ') {
        // Cuscuz → Acompanhamento (proteína ou legume) → Fruta
        switch (categoria) {
          case 'CUSCUZ': return 0
          case 'PROTEINA': return 1
          case 'ACOMPANHAMENTO': return 1
          case 'ARROZ': return 1
          case 'FEIJAO': return 1
          case 'OUTRO': return 2
          case 'FRUTA': return 3
          case 'BEBIDA': return 4
          case 'SUCO': return 4
          default: return 2
        }
      }
      // perfil COMIDA
      // Salada → Arroz → Feijão → Proteína → Acompanhamento → Fruta → Suco
      switch (categoria) {
        case 'SALADA': return 0
        case 'ARROZ': return 1
        case 'FEIJAO': return 2
        case 'PROTEINA': return 3
        case 'ACOMPANHAMENTO': return 4
        case 'PAO': return 4 // pão entra como acompanhamento em refeição COMIDA
        case 'LANCHE': return 4
        case 'CUSCUZ': return 4
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
 *
 * v5 — agora detecta o PERFIL do slot (PAO_LANCHE / COMIDA / CUSCUZ)
 * automaticamente, baseado nos itens presentes.
 *
 * Se ALGUM item tem `ordem` > 0 (definida manualmente), respeita a ordem
 * manual para TODOS. Caso contrário, aplica auto-sort.
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

  // Detecta perfil do slot baseado nos itens
  const perfil = detectarPerfilSlot(itens.map(i => i.preparacao.nome))

  return [...itens].sort((a, b) => {
    const prioA = getPrioridadePorPerfil(a.preparacao.nome, codigo, perfil)
    const prioB = getPrioridadePorPerfil(b.preparacao.nome, codigo, perfil)
    if (prioA !== prioB) return prioA - prioB
    // Mesma prioridade → ordem alfabética
    return a.preparacao.nome.localeCompare(b.preparacao.nome)
  })
}

/**
 * Calcula a ordem canônica de itens de um slot, SEM respeitar ordem manual.
 * Usado pelo endpoint "reordenar-dia" (botão "Reordenar") — reseta toda a
 * ordenação manual e re-aplica a canônica.
 *
 * Retorna array com a NOVA ordem de cada item (não muta o input).
 * Item na posição 0 deve ficar primeiro.
 */
export function calcularOrdemCanonicaSlot<
  T extends {
    preparacao: { nome: string }
    tipo_refeicao_id?: string
    tipo_refeicao?: { id: string; codigo: string }
    id: string
  }
>(itens: T[], tiposRefeicao: Array<{ id: string; codigo: string }>): T[] {
  if (itens.length <= 1) return [...itens]

  const primeiroItem = itens[0]
  const tipoRefeicaoId = primeiroItem.tipo_refeicao_id || primeiroItem.tipo_refeicao?.id
  const tipoRefeicao = tiposRefeicao.find(t => t.id === tipoRefeicaoId)
  const codigo = tipoRefeicao?.codigo || ''

  const perfil = detectarPerfilSlot(itens.map(i => i.preparacao.nome))

  return [...itens].sort((a, b) => {
    const prioA = getPrioridadePorPerfil(a.preparacao.nome, codigo, perfil)
    const prioB = getPrioridadePorPerfil(b.preparacao.nome, codigo, perfil)
    if (prioA !== prioB) return prioA - prioB
    return a.preparacao.nome.localeCompare(b.preparacao.nome)
  })
}
