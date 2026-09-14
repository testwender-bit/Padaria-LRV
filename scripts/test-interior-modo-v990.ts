// Teste rápido da lógica v9.9.0 (tipoPaoEfetivoEscola + escolaPulaLanche)
import { tipoPaoEfetivoEscola, escolaPulaLanche } from '../src/lib/producao-utils'

let falhas = 0
function check(nome: string, got: unknown, expected: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(expected)
  if (!ok) falhas++
  console.log(`${ok ? '✅' : '❌'} ${nome} → ${JSON.stringify(got)}${ok ? '' : ` (esperado: ${JSON.stringify(expected)})`}`)
}

// ── Bifásica (comportamento preservado) ──
check('BIFASICA modo LANCHE → SEMPAO', tipoPaoEfetivoEscola('BIFASICA', false, 'PADRAO', 'LANCHE'), 'SEMPAO')
check('BIFASICA modo LANCHE NÃO pula lanche', escolaPulaLanche('BIFASICA', false, 'LANCHE', 'LANCHE'), false)
check('BIFASICA modo PAO_PADRAO → PADRAO', tipoPaoEfetivoEscola('BIFASICA', false, 'PADRAO', 'PAO_PADRAO'), 'PADRAO')
check('BIFASICA modo PAO_PROTEINA → PROTEINA', tipoPaoEfetivoEscola('BIFASICA', false, 'PADRAO', 'PAO_PROTEINA'), 'PROTEINA')
check('BIFASICA modo PAO_PROTEINA pula lanche', escolaPulaLanche('BIFASICA', false, 'PAO_PROTEINA', 'LANCHE'), true)
check('BIFASICA modo NENHUM → SEMPAO + pula', [tipoPaoEfetivoEscola('BIFASICA', false, 'PADRAO', 'NENHUM'), escolaPulaLanche('BIFASICA', false, 'NENHUM', 'LANCHE')], ['SEMPAO', true])

// ── Interior especial (NOVO v9.9.0) ──
check('INTERIOR flag modo LANCHE → SEMPAO', tipoPaoEfetivoEscola('INTERIOR', false, 'PADRAO', 'LANCHE', true, 'LANCHE'), 'SEMPAO')
check('INTERIOR flag modo LANCHE NÃO pula lanche', escolaPulaLanche('INTERIOR', true, 'LANCHE', 'LANCHE'), false)
check('INTERIOR flag modo PAO_PADRAO → PADRAO', tipoPaoEfetivoEscola('INTERIOR', false, 'PADRAO', 'LANCHE', true, 'PAO_PADRAO'), 'PADRAO')
check('INTERIOR flag modo PAO_PROTEINA → PROTEINA + pula', [tipoPaoEfetivoEscola('INTERIOR', false, 'PADRAO', 'LANCHE', true, 'PAO_PROTEINA'), escolaPulaLanche('INTERIOR', true, 'LANCHE', 'PAO_PROTEINA')], ['PROTEINA', true])
check('INTERIOR flag modo NENHUM → SEMPAO + pula', [tipoPaoEfetivoEscola('INTERIOR', false, 'PADRAO', 'LANCHE', true, 'NENHUM'), escolaPulaLanche('INTERIOR', true, 'LANCHE', 'NENHUM')], ['SEMPAO', true])

// ── Interior SEM flag (comportamento normal preservado) ──
check('INTERIOR sem flag segue tipo da semana (PROTEINA)', tipoPaoEfetivoEscola('INTERIOR', false, 'PROTEINA', 'LANCHE', false, 'PAO_PADRAO'), 'PROTEINA')
check('INTERIOR sem flag NÃO pula lanche mesmo com modo PAO', escolaPulaLanche('INTERIOR', false, 'LANCHE', 'PAO_PADRAO'), false)
check('INTERIOR flag=false (undefined) ignora modo interior', tipoPaoEfetivoEscola('INTERIOR', undefined, 'PADRAO', 'LANCHE', undefined, 'NENHUM'), 'PADRAO')

// ── pao_fixo vence tudo (inclusive flags) ──
check('pao_fixo vence interior_especial', tipoPaoEfetivoEscola('INTERIOR', true, 'PROTEINA', 'LANCHE', true, 'PAO_PROTEINA'), 'PADRAO')
check('pao_fixo vence BIFASICA', tipoPaoEfetivoEscola('BIFASICA', true, 'PROTEINA', 'PAO_PROTEINA'), 'PADRAO')

// ── Demais categorias (inalterado) ──
check('REGULAR segue tipo da semana', tipoPaoEfetivoEscola('REGULAR', false, 'PROTEINA', 'LANCHE', false, 'NENHUM'), 'PROTEINA')
check('CRECHE pula? NÃO (nunca pula lanche)', escolaPulaLanche('CRECHE', false, 'NENHUM', 'NENHUM'), false)

// ── Chamadas antigas com 4 args continuam funcionando ──
check('Call antiga 4 args — REGULAR', tipoPaoEfetivoEscola('REGULAR', false, 'PADRAO', 'LANCHE'), 'PADRAO')
check('Call antiga 4 args — BIFASICA PAO_PADRAO', tipoPaoEfetivoEscola('BIFASICA', false, 'PADRAO', 'PAO_PADRAO'), 'PADRAO')

console.log(falhas === 0 ? '\n🎉 TODOS OS TESTES PASSARAM' : `\n💥 ${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
