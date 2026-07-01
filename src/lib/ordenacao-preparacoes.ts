// ============================================================
// ordenacao-preparacoes.ts — Ordenação automática de preparações
// ============================================================
// v9.0 — REESCRITA COMPLETA (Junho 2026)
//
// PRINCÍPIOS DA v9.0:
//   1. CATEGORIA DO BANCO É A VERDADE ABSOLUTA
//      A nutricionista cadastra a categoria da preparação (SALADA, ARROZ, FEIJAO,
//      PROTEINA, ACOMPANHAMENTO, BEBIDA, SUCO, PAO, LANCHE, CUSCUZ, DOCE, FRUTA,
//      SOBREMESA). O sistema respeita 100% essa categoria.
//      Palavra-chave só é usada quando categoria='PREPARACAO' (default) ou vazia.
//
//   2. LOCK MANUAL
//      Uma vez que o usuário mexe manualmente num item (up/down, drag), a ordem
//      fica fixa até ele clicar "Reordenar semana".
//      - ordem=0   → NUNCA foi mexido (auto-sort canônico)
//      - ordem>0   → já foi mexido (LOCK — respeita posição)
//
//   3. SEM REINSERÇÃO NO MEIO
//      Itens novos (ordem=0) ficam SEMPRE no FINAL do slot, ordenados por
//      prioridade canônica entre si. NÃO são inseridos no meio dos itens
//      com ordem manual. Isso garante que a ordem manual nunca é quebrada.
//
//   4. PERFIS DE REFEIÇÃO (4 perfis):
//      COMIDA:      Salada → Arroz → Feijão → Proteína → Acompanhamento → Fruta
//      PAO_LANCHE:  Bebida → Pão/Lanche → Fruta
//      DOCE:        Bebida → Doce → Fruta  ← NOVO v9.0
//      CUSCUZ:      Bebida → Salada → Cuscuz → Acompanhamento (proteína) → Fruta
//
// PERFIL é detectado POR SLOT (dia + refeição), baseado nas categorias dos itens.
// ============================================================

// ── Palavras-chave (SÓ fallback quando categoria='PREPARACAO') ──

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

const KW_DOCE = [
  'canjica', 'curau', 'creme de milho', 'pamonha', 'bolo de',
  'bolo ', 'pudim', 'mousse', 'musse', 'gelatina', 'doce de',
  'goiabada', 'doce de leite', 'merengue', 'brigadeiro',
  'paçoca', 'pacoca', 'doce', 'pipoca doce', 'rapadura',
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
  'nhoque', 'lasanha', 'angu', 'creme de ervilha',
  'sopa de', 'caldo', 'bolinho', 'fubá', 'fuba',
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
  | 'SUCO' | 'BEBIDA' | 'FRUTA' | 'PAO' | 'LANCHE' | 'CUSCUZ' | 'DOCE' | 'SOBREMESA' | 'OUTRO'

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
 * v9.0 — Detecta a categoria de uma preparação.
 *
 * REGRA DEFINITIVA: A CATEGORIA DO BANCO É A VERDADE ABSOLUTA.
 *
 * - Se categoriaBanco é uma categoria conhecida (não 'PREPARACAO' nem vazia),
 *   usa ela DIRETAMENTE. A nutricionista definiu, o sistema respeita.
 *
 * - Só usa palavra-chave (fallback) quando categoria='PREPARACAO' ou vazia.
 *
 * Isso resolve o bug onde "Arroz com carne" era detectado como PROTEINA
 * pela palavra-chave 'carne', mesmo se a nutricionista marcou como
 * ACOMPANHAMENTO no banco.
 */
function detectarCategoria(nome: string, categoriaBanco?: string): Categoria {
  // 1. Se categoria do banco é conhecida, USA ELA (verdade absoluta)
  if (categoriaBanco) {
    const cat = categoriaBanco.toUpperCase()
    switch (cat) {
      case 'SALADA': return 'SALADA'
      case 'ARROZ': return 'ARROZ'
      case 'FEIJAO': return 'FEIJAO'
      case 'PROTEINA': return 'PROTEINA'
      case 'ACOMPANHAMENTO': return 'ACOMPANHAMENTO'
      case 'BEBIDA': return 'BEBIDA'
      case 'SUCO': return 'SUCO'
      case 'FRUTA': return 'FRUTA'
      case 'PAO': return 'PAO'
      case 'LANCHE': return 'LANCHE'
      case 'CUSCUZ': return 'CUSCUZ'
      case 'DOCE': return 'DOCE'
      case 'SOBREMESA': return 'SOBREMESA'
    }
    // 'PREPARACAO' ou desconhecida → cai no fallback por palavra-chave
  }

  // 2. Fallback por palavra-chave (só quando categoria='PREPARACAO' ou vazia)
  const n = normalizarNome(nome)

  if (KW_CUSCUZ.some(kw => n.includes(kw))) return 'CUSCUZ'
  if (KW_DOCE.some(kw => n.includes(kw))) return 'DOCE'
  if (KW_SALADA.some(kw => n.includes(kw))) return 'SALADA'
  if (KW_PROTEINA.some(kw => n.includes(kw))) return 'PROTEINA'
  if (KW_ARROZ.some(kw => n.includes(kw))) return 'ARROZ'
  if (KW_FEIJAO.some(kw => n.includes(kw))) return 'FEIJAO'

  if (KW_LANCHE_ESPECIAL.some(kw => n.includes(kw))) return 'LANCHE'
  if (KW_PAO.some(kw => n.includes(kw))) return 'PAO'
  if (KW_BEBIDA.some(kw => n.includes(kw))) return 'BEBIDA'
  if (KW_SUCO.some(kw => n.includes(kw))) return 'SUCO'
  if (KW_FRUTA.some(kw => n.includes(kw))) return 'FRUTA'
  if (KW_ACOMPANHAMENTO.some(kw => n.includes(kw))) return 'ACOMPANHAMENTO'

  return 'OUTRO'
}

// ── Perfis de refeição ──
type PerfilRefeicao = 'PAO_LANCHE' | 'COMIDA' | 'CUSCUZ' | 'DOCE'

/**
 * v9.0 — Detecta o perfil de um slot (dia + refeição) baseado nas categorias
 * dos itens.
 *
 * Ordem de detecção (PRIORIDADE):
 *   1. Se tem CUSCUZ → CUSCUZ
 *   2. Se tem DOCE → DOCE
 *   3. Se tem arroz, feijão, proteína OU salada → COMIDA (refeição completa)
 *   4. Se tem pão ou lanche especial → PAO_LANCHE
 *   5. Caso contrário → PAO_LANCHE (default — bebida primeiro)
 *
 * Isso garante que:
 *   - Dia com "Arroz + Feijão + Carne + Salada" → COMIDA → Salada→Arroz→Feijão→Carne ✅
 *   - Dia com "Pão + Suco + Banana" → PAO_LANCHE → Suco→Pão→Banana ✅
 *   - Dia com "Canjica + Melão" → DOCE → Canjica→Melão ✅
 *   - Dia com "Cuscuz + Suco + Ovo" → CUSCUZ → Suco→Cuscuz→Ovo ✅
 */
function detectarPerfilFinal<T extends { preparacao: { nome: string; categoria?: string } }>(
  itens: T[]
): PerfilRefeicao {
  if (itens.length === 0) return 'PAO_LANCHE'

  const categorias = itens.map(i => detectarCategoria(i.preparacao.nome, i.preparacao.categoria))

  // 1. Cuscuz tem perfil próprio (prioridade máxima)
  if (categorias.includes('CUSCUZ')) return 'CUSCUZ'

  // 2. Doce tem perfil próprio (NOVO v9.0)
  if (categorias.includes('DOCE')) return 'DOCE'

  // 3. Se tem arroz, feijão, proteína ou salada → é COMIDA (refeição completa)
  const temComida = categorias.some(c =>
    c === 'ARROZ' || c === 'FEIJAO' || c === 'PROTEINA' || c === 'SALADA'
  )
  if (temComida) return 'COMIDA'

  // 4. Se tem pão ou lanche → PAO_LANCHE
  if (categorias.includes('PAO') || categorias.includes('LANCHE')) return 'PAO_LANCHE'

  // 5. Caso contrário (bebida/suco/fruta/acompanhamento) → PAO_LANCHE (bebida primeiro)
  return 'PAO_LANCHE'
}

/**
 * Retorna a prioridade de uma preparação dado o perfil do slot.
 * Menor número = aparece primeiro.
 *
 * PERFIS (v9.0):
 *   COMIDA:      Salada(0) → Arroz(1) → Feijão(2) → Proteína(3) → Acompanhamento(4) → Bebida(5) → Fruta(6)
 *   PAO_LANCHE:  Bebida(0) → Pão/Lanche(1) → Outro(2) → Fruta(3)
 *   DOCE:        Bebida(0) → Doce(1) → Outro(2) → Fruta(3)
 *   CUSCUZ:      Bebida(0) → Salada(1) → Cuscuz(2) → Proteína/Acompanhamento(3) → Outro(4) → Fruta(5)
 */
function getPrioridadePorPerfil(
  nome: string,
  perfil: PerfilRefeicao,
  categoriaBanco?: string
): number {
  const categoria = detectarCategoria(nome, categoriaBanco)

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
      case 'SOBREMESA': return 3
      default: return 2
    }
  }

  if (perfil === 'DOCE') {
    // v9.0: Bebida → Doce → Fruta
    switch (categoria) {
      case 'BEBIDA': return 0
      case 'SUCO': return 0
      case 'DOCE': return 1
      case 'SOBREMESA': return 1
      case 'OUTRO': return 2
      case 'FRUTA': return 3
      default: return 2
    }
  }

  if (perfil === 'CUSCUZ') {
    // v9.0: Bebida → Salada → Cuscuz → Acompanhamento (proteína) → Fruta
    switch (categoria) {
      case 'BEBIDA': return 0
      case 'SUCO': return 0
      case 'SALADA': return 1
      case 'CUSCUZ': return 2
      case 'PROTEINA': return 3
      case 'ACOMPANHAMENTO': return 3
      case 'ARROZ': return 3
      case 'FEIJAO': return 3
      case 'OUTRO': return 4
      case 'FRUTA': return 5
      case 'SOBREMESA': return 5
      default: return 4
    }
  }

  // perfil COMIDA
  // Salada → Arroz → Feijão → Proteína → Acompanhamento → Bebida → Fruta
  switch (categoria) {
    case 'SALADA': return 0
    case 'ARROZ': return 1
    case 'FEIJAO': return 2
    case 'PROTEINA': return 3
    case 'ACOMPANHAMENTO': return 4
    case 'PAO': return 4
    case 'LANCHE': return 4
    case 'CUSCUZ': return 4
    case 'DOCE': return 4
    case 'OUTRO': return 5
    case 'SUCO': return 5
    case 'BEBIDA': return 5
    case 'FRUTA': return 6
    case 'SOBREMESA': return 6
    default: return 5
  }
}

// ── API pública ──

/**
 * v9.0 — Ordena itens de uma refeição.
 *
 * REGRA DO LOCK MANUAL:
 *   - Itens com ordem>0 ficam PRIMEIRO, ordenados por ordem ASC (manual é respeitado)
 *   - Itens com ordem=0 ficam DEPOIS, ordenados por prioridade canônica entre si
 *   - NÃO reinsere itens sem ordem no meio dos itens com ordem
 *
 * Isso garante que:
 *   - Uma vez que o usuário mexe manualmente, novos itens não quebram a ordem
 *   - Novos itens (ordem=0) vão para o final do slot
 *   - Só "Reordenar semana" reorganiza tudo
 */
export function sortItensByRefeicao<
  T extends {
    preparacao: { nome: string; categoria?: string }
    tipo_refeicao_id?: string
    tipo_refeicao?: { id: string; codigo: string }
    ordem?: number
  }
>(itens: T[], _tiposRefeicao: Array<{ id: string; codigo: string }>): T[] {
  if (itens.length <= 1) return itens

  const comOrdem = itens.filter(i => (i.ordem ?? 0) > 0)
  const semOrdem = itens.filter(i => (i.ordem ?? 0) === 0)

  // 1. COM ordem: ordena por ordem ASC (LOCK MANUAL — respeita posição)
  const comOrdemSorted = [...comOrdem].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))

  // 2. SEM ordem: ordena por prioridade canônica entre si
  const perfil = detectarPerfilFinal(itens)
  const semOrdemSorted = [...semOrdem].sort((a, b) => {
    const prioA = getPrioridadePorPerfil(a.preparacao.nome, perfil, a.preparacao.categoria)
    const prioB = getPrioridadePorPerfil(b.preparacao.nome, perfil, b.preparacao.categoria)
    if (prioA !== prioB) return prioA - prioB
    return a.preparacao.nome.localeCompare(b.preparacao.nome)
  })

  // 3. Concatena: com-ordem primeiro, sem-ordem depois
  // NÃO insere sem-ordem no meio — preserva LOCK MANUAL
  return [...comOrdemSorted, ...semOrdemSorted]
}

/**
 * Calcula a ordem canônica de itens de um slot, IGNORANDO ordem manual.
 * Usado pelo botão "Reordenar semana" — reseta toda a ordenação manual
 * e re-aplica a canônica.
 *
 * Retorna array com a NOVA ordem de cada item (não muta o input).
 * Item na posição 0 deve ficar primeiro.
 */
export function calcularOrdemCanonicaSlot<
  T extends {
    preparacao: { nome: string; categoria?: string }
    tipo_refeicao_id?: string
    tipo_refeicao?: { id: string; codigo: string }
    id: string
  }
>(itens: T[], _tiposRefeicao: Array<{ id: string; codigo: string }>): T[] {
  if (itens.length <= 1) return [...itens]

  const perfil = detectarPerfilFinal(itens)

  return [...itens].sort((a, b) => {
    const prioA = getPrioridadePorPerfil(a.preparacao.nome, perfil, a.preparacao.categoria)
    const prioB = getPrioridadePorPerfil(b.preparacao.nome, perfil, b.preparacao.categoria)
    if (prioA !== prioB) return prioA - prioB
    return a.preparacao.nome.localeCompare(b.preparacao.nome)
  })
}

// ── Funções mantidas para compatibilidade (não usadas em v9.0, mas exportadas) ──

export function detectarPerfilSlot(nomesPreparacoes: string[]): PerfilRefeicao {
  const itens = nomesPreparacoes.map(nome => ({ preparacao: { nome } }))
  return detectarPerfilFinal(itens)
}

export function detectarPerfilSlotAvancado<
  T extends { preparacao: { nome: string; categoria?: string } }
>(itens: T[]): PerfilRefeicao {
  return detectarPerfilFinal(itens)
}

export function getPrioridadePrep(
  nome: string,
  _tipoRefeicaoCodigo: string,
  categoriaBanco?: string
): number {
  // Mantém assinatura antiga — perfil é detectado por slot, não por tipo
  const perfil = detectarPerfilFinal([{ preparacao: { nome, categoria: categoriaBanco } }])
  return getPrioridadePorPerfil(nome, perfil, categoriaBanco)
}
