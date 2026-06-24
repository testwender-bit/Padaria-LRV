// ============================================================
// scripts/diagnostic-paes-fantasma.ts
// ============================================================
// Lista TODOS os pães do banco e identifica quais são FANTASMAS.
//
// REGRA (acordada com o usuário):
//   - FANTASMA  = "Pão X" onde X não contém "francês" nem "QC" nem "cachorro-quente"
//                 (não especifica o tipo — fica ambíguo)
//   - CORRETO   = "Pão francês X" (mesma terminação X do fantasma)
//   - QC        = "Pão QC X" ou "Pão de cachorro-quente X" — É UM PRODUTO DIFERENTE,
//                 não deve ser tocado. Se existe "Pão QC com manteiga" e
//                 "Pão francês com manteiga", são duas preparações válidas.
//
// Para cada FANTASMA, o script verifica:
//   • Tem "Pão francês X" correspondente? → se sim, par válido para o fix
//   • Tem "Pão QC X" correspondente? → apenas informativo (não vamos usar)
//
// USO:
//   npx tsx scripts/diagnostic-paes-fantasma.ts
//
// Não modifica nada — somente leitura.
// ============================================================

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// Detecta se um nome normalizado contém indicação de tipo de pão
function temFrances(nomeNorm: string): boolean {
  return (
    nomeNorm.includes('frances') ||
    nomeNorm.includes('francez') ||
    // "pao frances" ou "pao frances ..."
    /^pao\s+franc/.test(nomeNorm)
  )
}

function temQC(nomeNorm: string): boolean {
  return (
    nomeNorm.includes('qc') ||
    nomeNorm.includes('cachorro') ||
    nomeNorm.includes('hot dog') ||
    nomeNorm.includes('hotdog')
  )
}

// Extrai a "terminação X" do nome do pão para casar pares
// Ex: "pao com doce de fruta" → "com doce de fruta"
//     "pao frances com doce de fruta" → "com doce de fruta"
//     "pao qc com manteiga" → "com manteiga"
function extrairTerminacao(nomeNorm: string): string {
  return nomeNorm
    .replace(/^pao\s+frances\s+/, '')
    .replace(/^pao\s+francez\s+/, '')
    .replace(/^pao\s+franc\s+/, '')
    .replace(/^pao\s+qc\s+/, '')
    .replace(/^pao\s+cachorro\s*-?\s*quente\s+/, '')
    .replace(/^pao\s+/, '')
    .trim()
}

async function main() {
  console.log('\n' + '═'.repeat(80))
  console.log('🍞 DIAGNÓSTICO DE PÃES FANTASMA')
  console.log('═'.repeat(80) + '\n')

  // 1) Buscar todas as preparações cujo nome contém "pão"
  const todas = await prisma.preparacao.findMany({
    where: {
      OR: [
        { nome: { contains: 'pão', mode: 'insensitive' } },
        { nome: { contains: 'pao', mode: 'insensitive' } },
        { nome: { contains: 'Pão', mode: 'insensitive' } },
        { nome: { contains: 'Pao', mode: 'insensitive' } },
      ],
    },
    include: {
      ingredientes: {
        include: { alimento: { select: { nome: true } } },
      },
      _count: { select: { cardapio_itens: true } },
    },
    orderBy: { nome: 'asc' },
  })

  if (todas.length === 0) {
    console.log('Nenhuma preparação com "pão" no nome encontrada.\n')
    return
  }

  // 2) Classificar
  type Classificacao = 'FANTASMA' | 'FRANCES' | 'QC' | 'OUTRO'
  interface PaoComClassificacao {
    id: string
    nome: string
    nomeNorm: string
    ativo: boolean
    numIngredientes: number
    numUsos: number
    classificacao: Classificacao
    terminacao: string
  }

  const classificados: PaoComClassificacao[] = todas.map((p) => {
    const nomeNorm = normalize(p.nome)
    let classificacao: Classificacao = 'OUTRO'
    if (temFrances(nomeNorm)) {
      classificacao = 'FRANCES'
    } else if (temQC(nomeNorm)) {
      classificacao = 'QC'
    } else if (/^pao\b/.test(nomeNorm)) {
      // Começa com "pao" mas não tem "frances" nem "QC" → FANTASMA
      classificacao = 'FANTASMA'
    }
    return {
      id: p.id,
      nome: p.nome,
      nomeNorm,
      ativo: p.ativo,
      numIngredientes: p.ingredientes.length,
      numUsos: p._count.cardapio_itens,
      classificacao,
      terminacao: extrairTerminacao(nomeNorm),
    }
  })

  const fantasmas = classificados.filter((p) => p.classificacao === 'FANTASMA')
  const frances = classificados.filter((p) => p.classificacao === 'FRANCES')
  const qcs = classificados.filter((p) => p.classificacao === 'QC')

  console.log('📊 RESUMO:\n')
  console.log(`   Total de preparações com "pão" no nome: ${todas.length}`)
  console.log(`   ${fantasmas.length} FANTASMA(s)  (sem "francês" nem "QC" no nome)`)
  console.log(`   ${frances.length} FRANCÊS       (candidatos a "correto")`)
  console.log(`   ${qcs.length} QC            (produto diferente, NÃO tocar)\n`)

  // 3) Listar QC (apenas informativo, para confirmação do usuário)
  if (qcs.length > 0) {
    console.log('─'.repeat(80))
    console.log('🟡 PÃES QC (válidos, não serão tocados):')
    console.log('─'.repeat(80))
    for (const p of qcs) {
      console.log(
        `   • id=${p.id}  nome="${p.nome}"  ativo=${p.ativo}  ` +
          `ingr=${p.numIngredientes}  usos=${p.numUsos}`
      )
    }
    console.log()
  }

  // 4) Listar FRANCÊS (candidatos a correto)
  if (frances.length > 0) {
    console.log('─'.repeat(80))
    console.log('🟢 PÃES FRANCÊS (candidatos a "correto"):')
    console.log('─'.repeat(80))
    for (const p of frances) {
      console.log(
        `   • id=${p.id}  nome="${p.nome}"  ativo=${p.ativo}  ` +
          `ingr=${p.numIngredientes}  usos=${p.numUsos}  terminacao="${p.terminacao}"`
      )
    }
    console.log()
  }

  // 5) Listar FANTASMAS e casar com FRANCÊS
  console.log('─'.repeat(80))
  console.log('🔴 PÃES FANTASMA (sem especificar francês/QC):')
  console.log('─'.repeat(80))

  if (fantasmas.length === 0) {
    console.log('   ✅ Nenhum fantasma encontrado.\n')
    return
  }

  // Indexar frances por terminacao para casamento rápido
  const francesPorTerminacao = new Map<string, typeof frances>()
  for (const f of frances) {
    const t = f.terminacao
    if (!francesPorTerminacao.has(t)) francesPorTerminacao.set(t, [])
    francesPorTerminacao.get(t)!.push(f)
  }

  const paresValidos: { fantasma: PaoComClassificacao; correto: PaoComClassificacao }[] = []
  const semPar: PaoComClassificacao[] = []

  for (const f of fantasmas) {
    const candidatos = francesPorTerminacao.get(f.terminacao) || []

    // Preferir o ativo com mais ingredientes e mais usos (mais "estabelecido")
    let melhor: PaoComClassificacao | undefined
    if (candidatos.length > 0) {
      melhor = candidatos.slice().sort((a, b) => {
        // ativo true primeiro
        if (a.ativo !== b.ativo) return a.ativo ? -1 : 1
        // mais ingredientes primeiro
        if (a.numIngredientes !== b.numIngredientes) {
          return b.numIngredientes - a.numIngredientes
        }
        // mais usos primeiro
        return b.numUsos - a.numUsos
      })[0]
    }

    const status = melhor ? '✅ par válido' : '⚠️  sem "Pão francês" correspondente'
    console.log(
      `\n   • id=${f.id}\n     nome="${f.nome}" (ativo=${f.ativo}, ingr=${f.numIngredientes}, usos=${f.numUsos})\n` +
        `     terminacao="${f.terminacao}"  →  ${status}`
    )

    if (melhor) {
      console.log(`     correto: "${melhor.nome}" (id=${melhor.id}, ativo=${melhor.ativo}, usos=${melhor.numUsos})`)
      paresValidos.push({ fantasma: f, correto: melhor })
    } else {
      semPar.push(f)
      // Mostrar candidatos QC (apenas informativo)
      const qcsComMesmaTerminacao = qcs.filter((q) => q.terminacao === f.terminacao)
      if (qcsComMesmaTerminacao.length > 0) {
        console.log(
          `     ⚠️  Existe QC com mesma terminação (mas é produto diferente, NÃO usar):`
        )
        for (const q of qcsComMesmaTerminacao) {
          console.log(`        - "${q.nome}" (id=${q.id})`)
        }
      }
    }
  }

  // 6) Resumo final
  console.log('\n' + '═'.repeat(80))
  console.log('🎯 RESUMO PARA O FIX:')
  console.log('═'.repeat(80))
  console.log(`   ${paresValidos.length} par(es) válido(s) para correção automática:`)
  for (const par of paresValidos) {
    console.log(
      `   • "${par.fantasma.nome}" (${par.fantasma.numUsos} usos) → "${par.correto.nome}" (${par.correto.numUsos} usos)`
    )
  }
  if (semPar.length > 0) {
    console.log(`\n   ${semPar.length} fantasma(s) SEM par válido (precisa atenção manual):`)
    for (const f of semPar) {
      console.log(`   • "${f.nome}" (id=${f.id}, ${f.numUsos} usos)`)
    }
  }
  console.log('\n' + '═'.repeat(80))
  console.log('💡 PRÓXIMO PASSO:')
  console.log('   Rode: npx tsx scripts/fix-paes-fantasma.ts            (dry-run)')
  console.log('   Depois: npx tsx scripts/fix-paes-fantasma.ts --apply   (aplica)')
  console.log('═'.repeat(80) + '\n')
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
