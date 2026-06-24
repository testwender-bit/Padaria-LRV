// ============================================================
// alergenos-utils.ts — Detecção automática de alérgenos alimentares
// em preparações com base nos ingredientes (alimento.nome + grupo).
//
// Alérgenos rastreados (sigla 1 letra, com cor):
//   L = Leite (lactose / APLV)    — amarelo  #f59e0b
//   O = Ovo                        — laranja  #f97316
//   T = Trigo / Glúten             — vermelho #dc2626
//   S = Soja                       — verde    #16a34a
//
// Critério de detecção: palavra-chave no nome OU grupo específico.
// Para "Trigo / Glúten" também verificamos cereais que contêm glúten
// (cevada, centeio, aveia — esta última por contaminação cruzada).
// ============================================================

export type AlergenoSigla = 'L' | 'O' | 'T' | 'S'

export interface AlergenoInfo {
  sigla: AlergenoSigla
  nome: string
  descricao: string
  // Cores mantidas para uso opcional em telas coloridas (UI),
  // mas os badges do PDF usam P&B (borda preta + letra preta)
  cor: string // hex (legacy — não usado no PDF impresso)
  corTexto: string // hex
}

export const ALERGENOS: Record<AlergenoSigla, AlergenoInfo> = {
  L: {
    sigla: 'L',
    nome: 'Leite',
    descricao: 'Lactose / APLV (proteína do leite)',
    cor: '#f59e0b',
    corTexto: '#ffffff',
  },
  O: {
    sigla: 'O',
    nome: 'Ovo',
    descricao: 'Proteína do ovo (ovalbumina)',
    cor: '#f97316',
    corTexto: '#ffffff',
  },
  T: {
    sigla: 'T',
    nome: 'Trigo / Glúten',
    descricao: 'Cereais com glúten (trigo, cevada, centeio, aveia)',
    cor: '#dc2626',
    corTexto: '#ffffff',
  },
  S: {
    sigla: 'S',
    nome: 'Soja',
    descricao: 'Soja e derivados (shoyu, proteína texturizada)',
    cor: '#16a34a',
    corTexto: '#ffffff',
  },
}

export const ALERGENOS_LIST: AlergenoInfo[] = [
  ALERGENOS.L,
  ALERGENOS.O,
  ALERGENOS.T,
  ALERGENOS.S,
]

// ── Palavras-chave ────────────────────────────────────────────────
// Cada lista é testada com `nome.toLowerCase().includes(palavra)`.
// Importante: usar palavras específicas para evitar falsos positivos
// (ex.: "ovo" pode aparecer em "novolume" — usamos padrões word-boundary
// via regex quando necessário).
const PADROES_LEITE = [
  'leite', 'leitecondensado', 'queijo', 'manteiga', 'iogurte', 'iogurte',
  'requeijao', 'requeijão', 'creme de leite', 'cremedeleite',
  'leite desnatado', 'leite integral', 'leite semidesnatado',
  'ricota', 'mussarela', 'prato', 'parmesao', 'parmesão',
  'minas', 'coalho', 'catupiry', 'petit suisse', 'flan',
  'pingado', 'meia-lua', 'pao de queijo', 'pão de queijo',
  'bolo de queijo', 'empadao de queijo', 'empadão de queijo',
]

// ── Exceções: alimentos que contêm a palavra "manteiga"/"leite"/"queijo"
//    mas NÃO são alérgenos (são nomes de plantas / variedades) ──
// Importante: testar com nome normalizado (lowercase, sem acentos, sem pontuação).
// Se o nome do alimento bate com algum destes padrões, NÃO marcamos 'L'.
//
// Os nomes TACO costumam ter vírgulas e estado físico
// (ex.: "Couve, manteiga, crua"). Por isso, a comparação é feita sobre o nome
// normalizado removendo vírgulas e espaços extras, e cada exceção é testada
// como substring nesse nome limpo.
const EXCECOES_LEITE = [
  // Verduras cuja variedade se chama "manteiga" (não contêm leite)
  // Exemplos TACO: "Couve, manteiga, crua" → normalizado: "couve manteiga crua"
  'couve manteiga',
  // Outras variedades de plantas com nome "manteiga":
  'ervilha manteiga',
  // "Banana maçã" / "Banana prata" etc não entram aqui, mas se algum dia
  // houver "banana manteiga" como variedade, adicionar aqui.
]

const PADROES_OVO = [
  // Ovos diretos
  'ovo cozido', 'ovo frito', 'ovo mexido', 'ovo poch',
  'ovo inteiro', 'ovo cru', 'ovo de galinha',
  'claras', 'clara de ovo', 'gema', 'gema de ovo',
  'omelete', 'omelete', 'omelete',
  // Preparações com ovo
  'merengue', 'suspiro', 'pavê', 'pave',
  'pudim', 'flan de ovo', 'creme de ovo',
  // Massas/panados
  'empanado', 'empanar', 'a milanesa', 'à milanesa',
  // Especial: palavra "ovo" sozinha como ingrediente
]

// Detectar "ovo" como palavra isolada (ex.: "Ovo", "Ovo cozido")
// Regex: início/fim ou cercado por não-letra
const REGEX_OVO = /(^|[^a-z])ovo(s)?([^a-z]|$)/i

const PADROES_TRIGO = [
  // Farinhas e cereais com glúten
  'trigo', 'farinha de trigo', 'farinha de gluten',
  'farinha de cevada', 'farinha de centeio', 'farinha de aveia',
  'semolina', 'semolinha',
  // Massas
  'macarrao', 'macarrão', 'macarronete', 'espaguete', 'talharim', 'talharim',
  'lasanha', 'lasanha', 'ravioli', 'nhoque', 'nhoque',
  'cuscuz', 'cuscuz paulista',
  // Pães
  'pao ', 'pão ', 'pao.', 'pão.', 'pao,', 'pão,', 'pao;', 'pão;',
  'paozinho', 'pãozinho', 'pao frances', 'pão francês',
  'pao de forma', 'pão de forma', 'pao integral', 'pão integral',
  'torrada', 'biscoto', 'biscoito', 'bolacha', 'wafer',
  // Bolos
  'bolo de fuba', 'bolo de fubá', 'bolo de milho', 'bolo de laranja',
  'bolo simples', 'bolo de cenoura', 'massa de bolo',
  // Outros
  'cuscoz', 'seitan', 'gluten', 'glúten',
  'cevada', 'centeio', 'aveia', // por contaminação cruzada / presença
  // Preparações que tipicamente usam farinha de trigo
  'panqueca', 'crepe', 'pizza', 'empada', 'empadao', 'empadão',
  'pastel', 'pastel', 'risole', 'risoles', 'croquete', 'coxinhas',
  'coxinha', 'bolinho de', 'bolinha de',
]

const PADROES_SOJA = [
  'soja', 'shoyu', 'shoyo', 'molho de soja',
  'molho shoyu', 'molho shoyo', 'tamari',
  'proteina texturizada', 'proteína texturizada',
  'proteina vegetal texturizada', 'pvt',
  'leite de soja', 'tofu', 'missô', 'miso',
  'edamame', 'natto', 'tempeh',
  'farinha de soja',
  // NOTA: óleo de soja NÃO é incluído aqui.
  // Óleos vegetais refinados (soja, milho, girassol) são isentos de
  // proteínas responsáveis pela alergia conforme RDC 26/2015 (ANVISA).
  // Logo, óleo de soja NÃO deve ser flagado como alérgeno.
  // Idem para margarina (que pode ter óleo de soja mas é isenta).
]

// ── Exceções: alimentos que contêm a palavra "soja" mas NÃO são alérgenos ──
// Esta lista é usada para evitar falsos positivos. Se o nome do alimento
// bate com algum destes padrões, NÃO marcamos como alérgeno 'S'.
const EXCECOES_SOJA = [
  'oleo de soja', 'óleo de soja',
  'oleo vegetal', 'óleo vegetal',
  'margarina', // geralmente feita com óleo de soja, mas isenta
  'margarina sem sal', 'margarina com sal',
]

// ── Detecção ────────────────────────────────────────────────────

export interface AlimentoBasco {
  nome: string
  grupo?: string
}

/**
 * Detecta alérgenos presentes em um alimento (ingrediente).
 * Retorna array com as siglas encontradas (sem duplicatas).
 */
export function detectarAlergenosAlimento(alimento: AlimentoBasco): AlergenoSigla[] {
  const nome = (alimento?.nome || '').toLowerCase()
  const grupo = (alimento?.grupo || '').toLowerCase()
  const encontrado = new Set<AlergenoSigla>()

  if (!nome && !grupo) return []

  // ── LEITE ──
  // Primeiro verifica exceções (couve manteiga etc — não são alérgenos).
  // Importante: nomes TACO costumam ter vírgulas e estado físico
  // (ex.: "Couve, manteiga, crua"). Normalizamos removendo vírgulas e
  // espaços extras para que 'couve manteiga' case com "couve, manteiga, crua".
  const nomeSemPontuacao = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[,\-.]/g, ' ')         // vírgulas, pontos e hífens viram espaço
    .replace(/\s+/g, ' ')            // colapsa espaços múltiplos
    .trim()
  const ehExcecaoLeite = EXCECOES_LEITE.some((p) => nomeSemPontuacao.includes(p))
  if (ehExcecaoLeite) {
    // Não marca como leite — é uma variedade de planta com "manteiga" no nome
  } else if (grupo === 'leite e derivados') {
    encontrado.add('L')
  } else {
    for (const p of PADROES_LEITE) {
      if (nome.includes(p)) {
        encontrado.add('L')
        break
      }
    }
  }

  // ── OVO ──
  // Grupo "Carnes e ovos" NÃO significa necessariamente que tem ovo
  // (a maioria é carne). Usar apenas detecção por nome.
  if (REGEX_OVO.test(nome)) {
    encontrado.add('O')
  } else {
    for (const p of PADROES_OVO) {
      if (nome.includes(p)) {
        encontrado.add('O')
        break
      }
    }
  }

  // ── TRIGO / GLÚTEN ──
  if (grupo === 'cereais e derivados') {
    // Nem todo cereal tem glúten (arroz, milho não têm).
    // Mas se o nome indica trigo/aveia/cevada/centeio, marca.
    const cereaisComGluten = ['trigo', 'aveia', 'cevada', 'centeio',
      'farinha de trigo', 'macarrao', 'macarrão', 'pao', 'pão',
      'biscoito', 'bolacha', 'massa', 'lasanha', 'pizza']
    if (cereaisComGluten.some((c) => nome.includes(c))) {
      encontrado.add('T')
    }
  }
  // Padrões por nome (independente de grupo)
  for (const p of PADROES_TRIGO) {
    if (nome.includes(p)) {
      encontrado.add('T')
      break
    }
  }

  // ── SOJA ──
  // Primeiro verifica exceções (óleo de soja, margarina, etc — isentos)
  const ehExcecaoSoja = EXCECOES_SOJA.some((p) => nome.includes(p))
  if (!ehExcecaoSoja) {
    for (const p of PADROES_SOJA) {
      if (nome.includes(p)) {
        encontrado.add('S')
        break
      }
    }
  }

  return Array.from(encontrado)
}

/**
 * Detecta alérgenos de uma preparação, baseado em TODOS os ingredientes.
 * Retorna array ordenado: L, O, T, S (quando presentes).
 */
export function detectarAlergenosPreparacao(
  ingredientes: AlimentoBasco[]
): AlergenoSigla[] {
  const encontrado = new Set<AlergenoSigla>()
  for (const ing of ingredientes) {
    const alergenos = detectarAlergenosAlimento(ing)
    for (const a of alergenos) encontrado.add(a)
  }
  // Ordenar pela ordem canônica: L, O, T, S
  const ordem: AlergenoSigla[] = ['L', 'O', 'T', 'S']
  return ordem.filter((s) => encontrado.has(s))
}
