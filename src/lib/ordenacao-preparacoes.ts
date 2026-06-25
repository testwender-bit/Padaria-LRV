// ============================================================
// ordenacao-preparacoes.ts — Ordenação automática de preparações
// ============================================================
// Define a ordem de exibição das preparações dentro de cada
// refeição, baseada em:
//   1. CATEGORIA da preparação no banco (FRUTA, BEBIDA, ACOMPANHAMENTO, etc.)
//      — referência primária, configurada pela nutricionista no cadastro
//   2. Palavras-chave no nome (fallback quando categoria não informa)
//
// v6 — Nova arquitetura:
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
// A detecção do perfil é feita POR SLOT (dia + refeição).
//
// v6 — Fix do bug "item novo com ordem=0":
//   Se um slot tem alguns itens com ordem manual (1,2,3...) e outros
//   com ordem=0 (recém-adicionados), os ordem=0 recebem ordem sequencial
//   a partir do maior+1, baseado na prioridade canônica — em vez de
//   ir para o topo da lista.
//
// Botão "Reordenar semana": reseta ordem=0 de TODOS os slots da semana
// e re-aplica a ordenação canônica. Endpoint:
//   POST /api/nutricao/cardapios/[id]/reordenar-semana
//   body: { semana_numero }
// ============================================================

// ── Palavras-chave por categoria (usadas como FALLBACK) ──
// A referência primária é a categoria no banco (campo Preparacao.categoria).
// Estas listas só são usadas quando categoria não está disponível ou é 'PREPARACAO'.

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
  | 'SUCO' | 'BEBIDA' | 'FRUTA' | 'PAO' | 'LANCHE' | 'CUSCUZ' | 'SOBREMESA' | 'OUTRO'

// Normaliza nome removendo acentos, pontuação e espaços extras
function normalizarNome(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[,\-.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Detecta a categoria de uma preparação.
 *
 * v6 — Prioriza a categoria cadastrada no banco (campo Preparacao.categoria).
 * Se categoria for uma das categorias "fortes" (FRUTA, BEBIDA, ACOMPANHAMENTO,
 * PAO, LANCHE, SOBREMESA), usa ela diretamente.
 *
 * EXCEÇÃO: SALADA, ARROZ, FEIJAO, PROTEINA, CUSCUZ têm detecção por palavra-chave
 * que SEMPRE tem precedência sobre a categoria do banco. Isso porque uma salada
 * é uma salada (vai primeiro no cardápio), mesmo se a nutricionista marcou como
 * ACOMPANHAMENTO. O mesmo para arroz/feijão (têm posição fixa) e proteína
 * (sempre após feijão).
 *
 * Para categoria 'PREPARACAO' ou ausente, faz detecção por palavra-chave
 * no nome (fallback).
 */
function detectarCategoria(nome: string, categoriaBanco?: string): Categoria {
  const n = normalizarNome(nome)

  // 1. CUSCUZ sempre por nome (tem regra própria no perfil dele)
  if (KW_CUSCUZ.some(kw => n.includes(kw))) return 'CUSCUZ'

  // 2. SALADA sempre por nome (vai primeiro no cardápio, mesmo se marcada como ACOMPANHAMENTO)
  if (KW_SALADA.some(kw => n.includes(kw))) return 'SALADA'

  // 3. PROTEINA sempre por nome (sempre após feijão, mesmo se marcada como PREPARACAO)
  if (KW_PROTEINA.some(kw => n.includes(kw))) return 'PROTEINA'

  // 4. ARROZ sempre por nome (sempre após salada, mesmo se marcado como ACOMPANHAMENTO)
  if (KW_ARROZ.some(kw => n.includes(kw))) return 'ARROZ'

  // 5. FEIJAO sempre por nome
  if (KW_FEIJAO.some(kw => n.includes(kw))) return 'FEIJAO'

  // 6. v6: Se categoria do banco é uma das "fortes", usa ela
  //    (depois de checar SALADA/PROTEINA/ARROZ/FEIJAO/CUSCUZ que têm precedência)
  if (categoriaBanco) {
    switch (categoriaBanco) {
      case 'FRUTA': return 'FRUTA'
      case 'BEBIDA': return 'BEBIDA'
      case 'ACOMPANHAMENTO': return 'ACOMPANHAMENTO'
      case 'PAO': return 'PAO'
      case 'LANCHE': return 'LANCHE'
      case 'SOBREMESA': return 'SOBREMESA'
    }
  }

  // 7. LANCHE especial antes de PAO (para diferenciar "rosca" de "pão francês")
  if (KW_LANCHE_ESPECIAL.some(kw => n.includes(kw))) return 'LANCHE'

  // 8. PAO antes de BEBIDA/FRUTA (para pegar "Pão com doce de leite", "Pão com doce de fruta")
  if (KW_PAO.some(kw => n.includes(kw))) return 'PAO'

  // 9. BEBIDA antes de FRUTA (para pegar "Mingau de aveia com banana", "Vitamina de Goiaba")
  if (KW_BEBIDA.some(kw => n.includes(kw))) return 'BEBIDA'

  // 10. SUCO
  if (KW_SUCO.some(kw => n.includes(kw))) return 'SUCO'

  // 11. FRUTA (após BEBIDA, para não pegar "Mingau com banana")
  if (KW_FRUTA.some(kw => n.includes(kw))) return 'FRUTA'

  // 12. ACOMPANHAMENTO
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
  const categorias = nomesPreparacoes.map(n => detectarCategoria(n))
  if (categorias.includes('CUSCUZ')) return 'CUSCUZ'
  if (categorias.includes('PAO') || categorias.includes('LANCHE')) return 'PAO_LANCHE'
  return 'COMIDA'
}

/**
 * v6 — versão que aceita categoria do banco. Usada pelas funções que têm
 * acesso ao campo Preparacao.categoria.
 */
export function detectarPerfilSlotAvancado<
  T extends { preparacao: { nome: string; categoria?: string } }
>(itens: T[]): PerfilRefeicao {
  const categorias = itens.map(i => detectarCategoria(i.preparacao.nome, i.preparacao.categoria))
  if (categorias.includes('CUSCUZ')) return 'CUSCUZ'
  if (categorias.includes('PAO') || categorias.includes('LANCHE')) return 'PAO_LANCHE'
  return 'COMIDA'
}

/**
 * Retorna a prioridade de uma preparação dentro de uma refeição.
 * Menor número = aparece primeiro.
 *
 * Em refeições do tipo LANCHE/ALMOCO/JANTAR, a prioridade depende do PERFIL
 * do slot (PAO_LANCHE / COMIDA / CUSCUZ).
 *
 * v6 — aceita categoria do banco opcional. Se fornecida, tem precedência
 * sobre a detecção por nome.
 */
export function getPrioridadePrep(
  nome: string,
  tipoRefeicaoCodigo: string,
  categoriaBanco?: string
): number {
  return getPrioridadePorPerfil(nome, tipoRefeicaoCodigo, 'COMIDA', categoriaBanco)
}

/**
 * v8.9 — Detecta o perfil FORÇADO pelo tipo de refeição.
 * LANCHE / LANCHE_1 / LANCHE_2 são SEMPRE perfil PAO_LANCHE
 * (bebida primeiro), independente de ter pão ou não.
 * Só ALMOCO / JANTAR usam detecção por itens (COMIDA / CUSCUZ).
 */
function detectarPerfilForcado(tipoRefeicaoCodigo: string): PerfilRefeicao | null {
  switch (tipoRefeicaoCodigo) {
    case 'LANCHE':
    case 'LANCHE_1':
    case 'LANCHE_2':
    case 'CAFE_MANHA':
    case 'FRUTA_MANHA':
    case 'HIDRATACAO':
      return 'PAO_LANCHE'  // Bebida primeiro, sempre
    case 'ALMOCO':
    case 'JANTAR':
      return null  // Deixa detectar por itens (COMIDA ou CUSCUZ)
    default:
      return null
  }
}

/**
 * v8.9 — Wrapper que decide o perfil: forçado pelo tipo de refeição
 * OU detectado pelos itens (apenas para ALMOCO/JANTAR).
 */
function detectarPerfilFinal<T extends { preparacao: { nome: string; categoria?: string } }>(
  itens: T[],
  tipoRefeicaoCodigo: string
): PerfilRefeicao {
  const forçado = detectarPerfilForcado(tipoRefeicaoCodigo)
  if (forçado) return forçado
  return detectarPerfilSlotAvancado(itens)
}

/**
 * Retorna a prioridade de uma preparação dado o perfil do slot.
 * Menor número = aparece primeiro.
 */
function getPrioridadePorPerfil(
  nome: string,
  tipoRefeicaoCodigo: string,
  perfil: PerfilRefeicao,
  categoriaBanco?: string
): number {
  const categoria = detectarCategoria(nome, categoriaBanco)

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
        // (fruta sempre por último — v6.2)
        switch (categoria) {
          case 'BEBIDA': return 0
          case 'SUCO': return 0
          case 'PAO': return 1
          case 'LANCHE': return 1
          case 'CUSCUZ': return 1
          case 'OUTRO': return 2
          case 'FRUTA': return 3
          case 'SOBREMESA': return 3
          default: return 2 // proteína/acompanhamento no meio se aparecer junto
        }
      }
      if (perfil === 'CUSCUZ') {
        // Cuscuz → Acompanhamento (proteína ou legume) → Bebida → Fruta
        // (fruta sempre por último — v6.2)
        switch (categoria) {
          case 'CUSCUZ': return 0
          case 'PROTEINA': return 1
          case 'ACOMPANHAMENTO': return 1
          case 'ARROZ': return 1
          case 'FEIJAO': return 1
          case 'OUTRO': return 2
          case 'BEBIDA': return 2
          case 'SUCO': return 2
          case 'FRUTA': return 3
          case 'SOBREMESA': return 3
          default: return 2
        }
      }
      // perfil COMIDA
      // v6.2: Salada → Arroz → Feijão → Proteína → Acompanhamento → Bebida → Fruta
      // (fruta sempre por último, depois da bebida)
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
        case 'SUCO': return 5
        case 'BEBIDA': return 5
        case 'FRUTA': return 6
        case 'SOBREMESA': return 6
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
 * v6 — Fix do bug "item novo com ordem=0":
 *
 * Se um slot tem alguns itens com ordem manual (1,2,3...) e outros
 * com ordem=0 (recém-adicionados sem ordem definida), os ordem=0 recebem
 * ordem sequencial a partir do maior+1, baseado na prioridade canônica.
 *
 * Antes do v6: itens com ordem=0 iam para o TOPO da lista (porque 0 < 1),
 * empurrando os itens com ordem manual — dando impressão de "ordem não respeitada".
 *
 * Agora: itens com ordem=0 são ordenados pela prioridade canônica entre si,
 * e colocados DEPOIS do último item com ordem manual.
 */
function atribuirOrdemParaItensSemOrdem<
  T extends {
    preparacao: { nome: string; categoria?: string }
    tipo_refeicao_id?: string
    tipo_refeicao?: { id: string; codigo: string }
    ordem?: number
  }
>(itens: T[], tiposRefeicao: Array<{ id: string; codigo: string }>): T[] {
  const comOrdem = itens.filter(i => (i.ordem ?? 0) > 0)
  const semOrdem = itens.filter(i => (i.ordem ?? 0) === 0)

  if (semOrdem.length === 0) {
    // Todos têm ordem — só ordena por ordem
    return [...itens].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  }

  if (comOrdem.length === 0) {
    // Nenhum tem ordem — auto-sort canônico
    const primeiroItem = itens[0]
    const tipoRefeicaoId = primeiroItem.tipo_refeicao_id || primeiroItem.tipo_refeicao?.id
    const tipoRefeicao = tiposRefeicao.find(t => t.id === tipoRefeicaoId)
    const codigo = tipoRefeicao?.codigo || ''
    const perfil = detectarPerfilFinal(itens, codigo)

    return [...itens].sort((a, b) => {
      const prioA = getPrioridadePorPerfil(a.preparacao.nome, codigo, perfil, a.preparacao.categoria)
      const prioB = getPrioridadePorPerfil(b.preparacao.nome, codigo, perfil, b.preparacao.categoria)
      if (prioA !== prioB) return prioA - prioB
      return a.preparacao.nome.localeCompare(b.preparacao.nome)
    })
  }

  // Caso misto: itens com ordem manual + itens sem ordem
  // v6.4 — fix do bug "Suco de maracujá não obedece ordem":
  // Antes do v6.4: todos os itens sem ordem iam para o FIM da lista,
  // ignorando a prioridade canônica deles. Resultado: Suco (BEBIDA, prio 0)
  // ficava depois de Pão (PAO, prio 1) que tinha ordem manual.
  //
  // Agora: cada item sem ordem é INSERIDO na posição correta da lista
  // ordenada, baseada na prioridade canônica dele.
  // - Se prioridade do sem-ordem é MENOR que a do item com ordem na posição N
  //   → insere ANTES desse item
  // - Senão → insere DEPOIS
  //
  // Ex: Pão (ordem=1, prio 1), Banana (ordem=2, prio 6), Suco (sem ordem, prio 0)
  // Resultado v6.4: Suco → Pão → Banana ✅ (Suco entra ANTES do Pão porque prio 0 < 1)

  // 1. Ordena os com ordem manual pela ordem (já estão nas posições finais deles)
  const comOrdemSorted = [...comOrdem].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))

  // 2. Calcula prioridade de cada item com ordem (vamos precisar para comparar)
  const primeiroItem = itens[0]
  const tipoRefeicaoId = primeiroItem.tipo_refeicao_id || primeiroItem.tipo_refeicao?.id
  const tipoRefeicao = tiposRefeicao.find(t => t.id === tipoRefeicaoId)
  const codigo = tipoRefeicao?.codigo || ''
  const perfil = detectarPerfilFinal(itens, codigo)

  const comOrdemComPrio = comOrdemSorted.map(i => ({
    item: i,
    prio: getPrioridadePorPerfil(i.preparacao.nome, codigo, perfil, i.preparacao.categoria),
  }))

  // 3. Ordena os sem ordem pela prioridade canônica (preserva ordem alfabética dentro da mesma prio)
  const semOrdemSorted = [...semOrdem].sort((a, b) => {
    const prioA = getPrioridadePorPerfil(a.preparacao.nome, codigo, perfil, a.preparacao.categoria)
    const prioB = getPrioridadePorPerfil(b.preparacao.nome, codigo, perfil, b.preparacao.categoria)
    if (prioA !== prioB) return prioA - prioB
    return a.preparacao.nome.localeCompare(b.preparacao.nome)
  })

  // 4. Insere cada item sem ordem na posição correta da lista de com-ordem
  //    Estratégia: para cada sem-ordem, encontra o PRIMEIRO item com-ordem
  //    cuja prioridade seja MAIOR que a do sem-ordem, e insere antes dele.
  //    Se nenhum tem prioridade maior, insere no fim.
  const resultado = [...comOrdemComPrio.map(x => x.item)]

  for (const itemSemOrdem of semOrdemSorted) {
    const prioSemOrdem = getPrioridadePorPerfil(
      itemSemOrdem.preparacao.nome,
      codigo,
      perfil,
      itemSemOrdem.preparacao.categoria
    )

    // Encontra posição de inserção: primeiro índice onde a prioridade do item com-ordem
    // é MAIOR que a do sem-ordem
    let posicaoInsercao = resultado.length  // default: fim da lista
    for (let i = 0; i < resultado.length; i++) {
      const prioItemComOrdem = getPrioridadePorPerfil(
        resultado[i].preparacao.nome,
        codigo,
        perfil,
        resultado[i].preparacao.categoria
      )
      if (prioSemOrdem < prioItemComOrdem) {
        posicaoInsercao = i
        break
      }
    }

    resultado.splice(posicaoInsercao, 0, itemSemOrdem)
  }

  return resultado
}

/**
 * Ordena itens de uma refeição baseado nas regras de prioridade.
 *
 * v6 — agora usa categoria do banco (Preparacao.categoria) como referência
 * primária. Palavras-chave no nome são fallback.
 *
 * v6 — fix bug "item novo com ordem=0": itens sem ordem manual são colocados
 * DEPOIS dos itens com ordem manual (em vez de ir para o topo).
 */
export function sortItensByRefeicao<
  T extends {
    preparacao: { nome: string; categoria?: string }
    tipo_refeicao_id?: string
    tipo_refeicao?: { id: string; codigo: string }
    ordem?: number
  }
>(itens: T[], tiposRefeicao: Array<{ id: string; codigo: string }>): T[] {
  if (itens.length <= 1) return itens

  return atribuirOrdemParaItensSemOrdem(itens, tiposRefeicao)
}

/**
 * Calcula a ordem canônica de itens de um slot, SEM respeitar ordem manual.
 * Usado pelo endpoint "reordenar-semana" (botão "Reordenar semana") —
 * reseta toda a ordenação manual e re-aplica a canônica.
 *
 * Retorna array com a NOVA ordem de cada item (não muta o input).
 * Item na posição 0 deve ficar primeiro.
 *
 * v6 — aceita categoria do banco.
 */
export function calcularOrdemCanonicaSlot<
  T extends {
    preparacao: { nome: string; categoria?: string }
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

  const perfil = detectarPerfilFinal(itens, codigo)

  return [...itens].sort((a, b) => {
    const prioA = getPrioridadePorPerfil(a.preparacao.nome, codigo, perfil, a.preparacao.categoria)
    const prioB = getPrioridadePorPerfil(b.preparacao.nome, codigo, perfil, b.preparacao.categoria)
    if (prioA !== prioB) return prioA - prioB
    return a.preparacao.nome.localeCompare(b.preparacao.nome)
  })
}
