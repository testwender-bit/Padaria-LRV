// ============================================================
// cardapio-ciclo-utils.ts — v9.10.0
// Detecção do ciclo REAL de semanas de um cardápio (por conteúdo)
// ============================================================
//
// CONTEXTO (bug v9.10.0):
//   O POST /api/nutricao/cardapios cria SEMPRE 22 linhas de semanas
//   (vazias) e NUNCA define ciclo_semanas — o campo fica no default 5.
//   Quando a nutricionista monta o cardápio com 5, 6 ou N semanas no
//   editor, as linhas 1..N recebem itens e o campo ciclo_semanas
//   continua 5. Isso quebrava:
//     - /replicar (expandir_para_semestre): baseCompleto contava LINHAS
//       (semanas.length >= 22 = true) e a expansão do ciclo NUNCA
//       rodava — o cardápio clonado ficava só com as semanas
//       preenchidas da origem e o resto vazio;
//     - /gerar-ciclo: usava ciclo_semanas (=5) e podia DELETAR semanas
//       preenchidas além da 5ª (ex.: a semana 6 de um cardápio de 6).
//
// SOLUÇÃO:
//   O ciclo real é a MAIOR semana que tem ao menos 1 item — o
//   conteúdo manda, não o campo salvo. Com o ciclo real em mãos:
//     Semana X do semestre → semana base ((X - 1) % ciclo) + 1
//     (ciclo 6: S7=S1, S8=S2 ... S12=S6, S13=S1 ... S22=S4)
//
// Usado por: /api/.../replicar, /api/.../gerar-ciclo, editor do cardápio
// (dialog "Gerar Ciclo") e página /replicar (exibição do ciclo detectado).

/** Total de semanas do semestre letivo (fallback local para uso no client) */
export const SEMANAS_SEMESTRE_CICLO = 22

/**
 * Detecta o ciclo REAL do cardápio: o maior número de semana que tem
 * ao menos 1 item lançado em qualquer dia.
 *
 * @param semanas  as semanas do cardápio (com dias e itens)
 * @returns o ciclo real (0 se nenhuma semana tem conteúdo)
 */
export function detectarCicloReal(
  semanas: { numero: number; dias?: { itens?: unknown[] }[] }[] | null | undefined
): number {
  let max = 0
  for (const s of semanas || []) {
    const temItem = (s.dias || []).some((d) => (d.itens?.length || 0) > 0)
    if (temItem && s.numero > max) max = s.numero
  }
  return max
}

/**
 * Lista os números das semanas que têm ao menos 1 item.
 */
export function semanasComConteudo(
  semanas: { numero: number; dias?: { itens?: unknown[] }[] }[] | null | undefined
): number[] {
  return (semanas || [])
    .filter((s) => (s.dias || []).some((d) => (d.itens?.length || 0) > 0))
    .map((s) => s.numero)
    .sort((a, b) => a - b)
}

export interface MapeamentoCiclo {
  semana: number      // semana do semestre (1..22)
  base: number        // semana do ciclo que a originou
  is_replica: boolean // true se é cópia gerada pelo ciclo
}

/**
 * Mapeia cada semana do semestre para a semana do ciclo que a origina.
 * Semana 7 com ciclo 6 → base 1 (réplica). Semana 3 com ciclo 6 → base 3.
 */
export function mapearCicloSemestre(
  ciclo: number,
  totalSemanas: number = SEMANAS_SEMESTRE_CICLO
): MapeamentoCiclo[] {
  const mapa: MapeamentoCiclo[] = []
  const c = ciclo > 0 ? ciclo : totalSemanas
  for (let num = 1; num <= totalSemanas; num++) {
    mapa.push({
      semana: num,
      base: c > 0 ? ((num - 1) % c) + 1 : num,
      is_replica: num > c,
    })
  }
  return mapa
}
