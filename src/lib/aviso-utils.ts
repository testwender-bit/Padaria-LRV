// v9.10.13: Quadro de Tarefas do "Aviso da Semana" (obs do cardápio semestral)
//
// O aviso passa a aceitar uma sintaxe leve de checklist: qualquer linha no
// formato "[ ] tarefa" (com "- ", "* " ou "• " opcional antes) vira uma
// TAREFA marcável no banner — a equipe clica, o "[ ]" vira "[x]", a linha
// aparece riscada e o obs é salvo de volta via PATCH /api/cardapio (mesmo
// campo de sempre). Linhas comuns continuam sendo texto puro — agora com as
// quebras de linha preservadas na renderização (antes saía tudo corrido).
//
// Por que sintaxe no texto (e não tabela nova no banco): o aviso já é
// editável num textarea livre; marcar uma tarefa é só trocar 1 caractere na
// linha certa e regravar o obs — sem schema novo, sem migração, e o texto
// continua 100% legível/editável em qualquer lugar que mostre o obs.

export interface LinhaAviso {
  /** 'tarefa' = linha com marcador [ ]/[x]; 'texto' = linha comum ou vazia */
  tipo: 'texto' | 'tarefa'
  /** índice da linha no obs original (mesma numeração do split('\n')) */
  indice: number
  /** linha crua normalizada (sem \r final) — texto comum renderiza isto */
  bruto: string
  /** tarefas: conteúdo depois do "] "; texto: igual ao bruto */
  texto: string
  /** só faz sentido para tarefas (marcador era x/X) */
  feita: boolean
}

// Captura: (1) prefixo até o "[", incluindo indentação e bullet opcional;
// (2) o caractere do marcador (' ', 'x' ou 'X'); (3) tudo a partir do "]".
// O índice da linha no array original mapeia 1:1 com o que alternarTarefa
// usa para regravar — nunca reordenar/filtrar antes de contar linhas.
const RE_TAREFA = /^(\s*(?:[-*•][ \t]*)?\[)([ xX])(\].*)$/

/** Quebra o obs em linhas tipadas (linhas vazias vêm como 'texto' com bruto ''). */
export function analisarAviso(obs: string | null | undefined): LinhaAviso[] {
  if (!obs) return []
  return obs.split('\n').map((crua, indice) => {
    const linha = crua.replace(/\r$/, '')
    const m = RE_TAREFA.exec(linha)
    if (m) {
      // conteúdo depois do "]": tira espaços iniciais; "[ ]" sozinho = tarefa sem descrição
      const texto = m[3].slice(1).replace(/^[ \t]+/, '')
      return { tipo: 'tarefa' as const, indice, bruto: linha, texto, feita: m[2] !== ' ' }
    }
    return { tipo: 'texto' as const, indice, bruto: linha, texto: linha, feita: false }
  })
}

/** Conta tarefas do aviso (para o selo "x/y concluídas" do banner). */
export function resumoTarefas(linhas: LinhaAviso[]): { total: number; feitas: number } {
  const tarefas = linhas.filter((l) => l.tipo === 'tarefa')
  return { total: tarefas.length, feitas: tarefas.filter((t) => t.feita).length }
}

/**
 * Marca/desmarca a tarefa da linha `indice` ("[ ]" ↔ "[x]", "[X]" vira "[ ]").
 * Devolve o obs com APENAS aquele caractere trocado — todas as outras linhas
 * saem byte-idênticas (indentação, bullets e quebras preservados). Se a linha
 * não existe ou não é tarefa, devolve o obs inalterado.
 */
export function alternarTarefa(obs: string, indice: number): string {
  const linhas = obs.split('\n')
  if (!Number.isInteger(indice) || indice < 0 || indice >= linhas.length) return obs
  const linha = linhas[indice].replace(/\r$/, '')
  const sufixoCR = linha.length !== linhas[indice].length ? '\r' : ''
  const m = RE_TAREFA.exec(linha)
  if (!m) return obs
  const novoMarcador = m[2] === ' ' ? 'x' : ' '
  linhas[indice] = m[1] + novoMarcador + m[3] + sufixoCR
  return linhas.join('\n')
}

/**
 * Converte todas as linhas de texto não-vazias em tarefas ("[ ] ") — botão
 * "Virar tarefas" do diálogo de edição. Linhas que JÁ são tarefa, linhas
 * vazias e a indentação original são preservadas.
 */
export function converterLinhasEmTarefas(obs: string): string {
  return obs
    .split('\n')
    .map((linha) => {
      if (linha.trim() === '') return linha
      if (RE_TAREFA.test(linha.replace(/\r$/, ''))) return linha
      // prefixo DEPOIS da indentação/bullet: "- tarefa" vira "- [ ] tarefa"
      return linha.replace(/^(\s*(?:[-*•][ \t]*)?)/, '$1[ ] ')
    })
    .join('\n')
}
