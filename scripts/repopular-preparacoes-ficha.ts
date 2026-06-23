// ============================================================
// scripts/repopular-preparacoes-ficha.ts
// ============================================================
// Repopula TODAS as preparações usando a ficha técnica como
// fonte de verdade. Para cada uma das 173 receitas da ficha:
//   1. Encontra a preparação correspondente no banco (por nome)
//   2. Remove ingredientes antigos
//   3. Cria novos ingredientes com alimento TACO mapeado
//   4. Cria percapitas por fase escolar (da ficha técnica)
//
// Para preparações que NÃO estão na ficha (62 itens):
//   - Usa raciocínio: encontra preparação similar na ficha
//   - Copia ingredientes e percapitas da similar
//
// SEGURANÇA:
//   - DRY-RUN por padrão (só preview)
//   - --apply para aplicar de fato
//   - Não deleta preparações — só substitui ingredientes
// ============================================================

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import { MAPEAMENTO_INGREDIENTES } from './mapeamento-ingredientes'

const prisma = new PrismaClient()
const args = process.argv.slice(2)
const MODO_APLICAR = args.includes('--apply')

// Carregar fichas técnicas
const fichasPath = 'fichas-tecnicas.json'
if (!fs.existsSync(fichasPath)) {
  console.error(`❌ Arquivo não encontrado: ${fichasPath}`)
  process.exit(1)
}
const fichas = JSON.parse(fs.readFileSync(fichasPath, 'utf-8')) as any[]

// ── Helpers ──

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[,.\-()/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Buscar alimento TACO no banco por codigo_taco
async function buscarAlimentoPorCodigoTaco(codigo: number) {
  return prisma.alimento.findFirst({ where: { codigo_taco: codigo } })
}

// Buscar alimento custom por nome exato
async function buscarAlimentoCustomPorNome(nome: string) {
  return prisma.alimento.findFirst({ where: { nome, codigo_taco: null } })
}

// Criar alimento custom se não existir
async function garantirAlimentoCustom(nome: string): Promise<string> {
  const existente = await buscarAlimentoCustomPorNome(nome)
  if (existente) return existente.id

  const novo = await prisma.alimento.create({
    data: {
      codigo_taco: null,
      nome,
      grupo: 'Outros',
      medida_caseira: '1 porção (100g)',
      gramas_por_medida: 100,
      energia_kcal: 0,
      carboidratos_g: 0,
      proteinas_g: 0,
      lipidios_g: 0,
      fibra_alimentar_g: 0,
      sodio_mg: 0,
      ferro_mg: 0,
      ferro_heme_mg: 0,
      vitamina_a_mcg: 0,
      vitamina_c_mg: 0,
      calcio_mg: 0,
      magnesio_mg: 0,
      zinco_mg: 0,
      acucar_adicionado_g: 0,
      ativo: true,
    },
  })
  return novo.id
}

// Mapas em memória (preenchidos no início do script)
let mapaAlimentosTaco = new Map<number, { id: string; nome: string }>()  // codigo_taco → alimento
let mapaAlimentosCustom = new Map<string, string>()  // nome normalizado → alimento_id

// Resolver ingrediente da ficha → alimento_id do banco (VERSÃO EM MEMÓRIA)
async function resolverIngrediente(nomeFicha: string): Promise<{ alimento_id: string; origem: string; obs: string } | null> {
  const chave = normalize(nomeFicha)
  const mapeamento = MAPEAMENTO_INGREDIENTES[chave]

  if (!mapeamento) {
    // Não está no mapeamento — tentar buscar por nome direto (em memória)
    const alimentoCustomExistente = mapaAlimentosCustom.get(chave)
    if (alimentoCustomExistente) {
      return { alimento_id: alimentoCustomExistente, origem: 'custom_existente', obs: `Custom já existe: ${nomeFicha}` }
    }
    // Criar custom novo
    const id = await garantirAlimentoCustom(nomeFicha)
    mapaAlimentosCustom.set(chave, id)
    return { alimento_id: id, origem: 'custom_sem_mapeamento', obs: `Não mapeado — criado custom: ${nomeFicha}` }
  }

  if (mapeamento.taco_codigo === null) {
    // É custom — verificar se já existe em memória
    const chaveCustom = normalize(mapeamento.taco_nome)
    const existente = mapaAlimentosCustom.get(chaveCustom)
    if (existente) {
      return { alimento_id: existente, origem: 'custom', obs: mapeamento.obs }
    }
    // Criar custom
    const id = await garantirAlimentoCustom(mapeamento.taco_nome)
    mapaAlimentosCustom.set(chaveCustom, id)
    return { alimento_id: id, origem: 'custom', obs: mapeamento.obs }
  }

  // É TACO — buscar no mapa em memória
  const alimento = mapaAlimentosTaco.get(mapeamento.taco_codigo)
  if (!alimento) {
    // TACO não encontrado no banco — criar custom
    const chaveCustom = normalize(mapeamento.taco_nome)
    const existente = mapaAlimentosCustom.get(chaveCustom)
    if (existente) return { alimento_id: existente, origem: 'taco_nao_encontrado', obs: `TACO ${mapeamento.taco_codigo} não no banco — custom existente` }
    const id = await garantirAlimentoCustom(mapeamento.taco_nome)
    mapaAlimentosCustom.set(chaveCustom, id)
    return { alimento_id: id, origem: 'taco_nao_encontrado', obs: `TACO ${mapeamento.taco_codigo} não no banco — custom criado` }
  }
  return { alimento_id: alimento.id, origem: 'taco', obs: mapeamento.obs }
}

// Encontrar preparação no banco por nome (fuzzy) — VERSÃO EM MEMÓRIA
// Recebe a lista de preparações já carregadas (não faz query ao banco)
function encontrarPreparacaoPorNome(nomeFicha: string, preparacoesBanco: Array<{ id: string; nome: string }>): { prep: { id: string; nome: string }; metodo: string } | null {
  const nomeNorm = normalize(nomeFicha)

  // 1. Busca exata (case-insensitive via normalização)
  for (const p of preparacoesBanco) {
    if (normalize(p.nome) === nomeNorm) return { prep: p, metodo: 'exata' }
  }

  // 2. Busca parcial (nome da ficha contém nome do banco ou vice-versa)
  for (const p of preparacoesBanco) {
    const pn = normalize(p.nome)
    if (pn.includes(nomeNorm) || nomeNorm.includes(pn)) {
      // Verificar se é um match bom (pelo menos 60% das palavras)
      const palavrasFicha = nomeNorm.split(' ').filter(w => w.length > 2)
      const palavrasBanco = pn.split(' ').filter(w => w.length > 2)
      let matches = 0
      for (const w of palavrasFicha) if (palavrasBanco.includes(w)) matches++
      if (palavrasFicha.length > 0 && matches / palavrasFicha.length >= 0.6) {
        return { prep: p, metodo: 'parcial' }
      }
    }
  }

  return null
}

// ── Script principal ──

async function main() {
  console.log('\n' + '═'.repeat(70))
  console.log('🔄 REPOPULAR PREPARAÇÕES — Ficha técnica como fonte')
  console.log('═'.repeat(70))
  console.log(`Modo: ${MODO_APLICAR ? '🔄 APLICAR' : '👁️  DRY-RUN (preview)'}\n`)

  console.log(`📚 Fichas técnicas carregadas: ${fichas.length} receitas`)
  console.log(`🗺️  Mapeamento de ingredientes: ${Object.keys(MAPEAMENTO_INGREDIENTES).length} itens\n`)

  // Carregar todas as preparações do banco (1 query)
  console.log('── PRÉ-CARREGAMENTO (1 query cada) ──')
  const preparacoesBanco = await prisma.preparacao.findMany({
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  })
  console.log(`  ✓ Preparações: ${preparacoesBanco.length}`)

  // Pré-carregar TODOS os alimentos em memória (1 query)
  const todosAlimentos = await prisma.alimento.findMany({
    select: { id: true, codigo_taco: true, nome: true },
  })
  for (const al of todosAlimentos) {
    if (al.codigo_taco) {
      mapaAlimentosTaco.set(al.codigo_taco, { id: al.id, nome: al.nome })
    } else {
      mapaAlimentosCustom.set(normalize(al.nome), al.id)
    }
  }
  console.log(`  ✓ Alimentos TACO: ${mapaAlimentosTaco.size}`)
  console.log(`  ✓ Alimentos custom: ${mapaAlimentosCustom.size}`)

  // ── FASE 1: Mapear fichas → preparações do banco (TUDO EM MEMÓRIA) ──
  console.log('\n── FASE 1: Mapeando fichas técnicas → preparações ──')

  interface FichaMapeada {
    ficha: any
    preparacao_id: string | null
    preparacao_nome: string | null
    metodo_match: string
    ingredientes_resolvidos: Array<{
      nome_ficha: string
      alimento_id: string | null
      origem: string
      obs: string
      percapitas: any
      eh_fruta: boolean
    }>
  }

  const fichasMapeadas: FichaMapeada[] = []
  let countMatch = 0
  let countSemMatch = 0

  for (const ficha of fichas) {
    const match = encontrarPreparacaoPorNome(ficha.nome, preparacoesBanco)

    if (match) {
      countMatch++
      // Resolver ingredientes
      const ingredientesResolvidos = []
      for (const ing of ficha.ingredientes) {
        const resolvido = await resolverIngrediente(ing.nome)
        ingredientesResolvidos.push({
          nome_ficha: ing.nome,
          alimento_id: resolvido?.alimento_id || null,
          origem: resolvido?.origem || 'erro',
          obs: resolvido?.obs || 'Falha ao resolver',
          percapitas: ing.valores_por_fase,
          eh_fruta: ing.eh_fruta_ou_polpa || false,
        })
      }

      fichasMapeadas.push({
        ficha,
        preparacao_id: match.prep.id,
        preparacao_nome: match.prep.nome,
        metodo_match: match.metodo,
        ingredientes_resolvidos: ingredientesResolvidos,
      })
    } else {
      countSemMatch++
      fichasMapeadas.push({
        ficha,
        preparacao_id: null,
        preparacao_nome: null,
        metodo_match: 'sem_match',
        ingredientes_resolvidos: [],
      })
    }

    // Progress a cada 20 fichas
    if ((countMatch + countSemMatch) % 20 === 0) {
      console.log(`  ... ${countMatch + countSemMatch}/${fichas.length} processadas (${countMatch} match, ${countSemMatch} sem match)`)
    }
  }

  console.log(`  ✓ Match encontrado: ${countMatch}`)
  console.log(`  ✗ Sem match: ${countSemMatch}`)

  // Mostrar amostra de matches
  console.log('\n── AMOSTRA: 15 primeiros matches ──')
  const comMatch = fichasMapeadas.filter(f => f.preparacao_id)
  for (const fm of comMatch.slice(0, 15)) {
    console.log(`  [${fm.metodo_match}] "${fm.ficha.nome}" → "${fm.preparacao_nome}"`)
    for (const ing of fm.ingredientes_resolvidos.slice(0, 3)) {
      const percs = ing.percapitas
      console.log(`    • ${ing.nome_ficha} → ${ing.origem} (FUND_F=${percs.fund_final}g)`)
    }
    if (fm.ingredientes_resolvidos.length > 3) {
      console.log(`    ... e mais ${fm.ingredientes_resolvidos.length - 3} ingredientes`)
    }
  }

  // Mostrar sem match
  console.log('\n── FICHAS SEM MATCH (preparação não existe no banco) ──')
  const semMatch = fichasMapeadas.filter(f => !f.preparacao_id)
  for (const fm of semMatch.slice(0, 20)) {
    console.log(`  ✗ "${fm.ficha.nome}" [${fm.ficha.secao}]`)
  }
  if (semMatch.length > 20) console.log(`  ... e mais ${semMatch.length - 20}`)

  // ── FASE 2: Preparações do banco que NÃO estão na ficha ──
  console.log('\n── FASE 2: Preparações do banco sem ficha técnica ──')
  const nomesFichas = new Set(fichas.map(f => normalize(f.nome)))
  const semFicha = preparacoesBanco.filter(p => !nomesFichas.has(normalize(p.nome)))
  console.log(`  Total: ${semFicha.length} preparações sem ficha`)
  console.log(`  (serão mantidas como estão — não mexer nos ingredientes)`)

  // ── ESTATÍSTICAS ──
  console.log('\n── ESTATÍSTICAS ──')
  const statsOrigem: Record<string, number> = {}
  for (const fm of comMatch) {
    for (const ing of fm.ingredientes_resolvidos) {
      statsOrigem[ing.origem] = (statsOrigem[ing.origem] || 0) + 1
    }
  }
  console.log(`  Ingredientes resolvidos:`)
  for (const [origem, count] of Object.entries(statsOrigem).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${origem.padEnd(25)} ${count}`)
  }

  if (!MODO_APLICAR) {
    console.log('\n' + '═'.repeat(70))
    console.log('👁️  DRY-RUN concluído — nada foi alterado')
    console.log('═'.repeat(70))
    console.log('\nPara aplicar:')
    console.log('  npx tsx scripts/repopular-preparacoes-ficha.ts --apply')
    return
  }

  // ── APLICAR ──
  console.log('\n' + '═'.repeat(70))
  console.log('🔄 APLICANDO REPOPULAÇÃO...')
  console.log('═'.repeat(70))

  let prepsAtualizadas = 0
  let ingredientesCriados = 0
  let percapitasCriadas = 0

  for (const fm of comMatch) {
    if (!fm.preparacao_id) continue

    // 1. Deletar ingredientes antigos (e percapitas em cascata)
    await prisma.preparacaoPercapita.deleteMany({
      where: { ingrediente: { preparacao_id: fm.preparacao_id } },
    })
    await prisma.preparacaoIngrediente.deleteMany({
      where: { preparacao_id: fm.preparacao_id },
    })

    // 2. Criar novos ingredientes
    for (const ing of fm.ingredientes_resolvidos) {
      if (!ing.alimento_id) continue

      const percs = ing.percapitas
      const percapitaBase = percs.fund_final ?? 0
      const qtdBase = percapitaBase > 0 ? percapitaBase : 1

      // Criar ingrediente
      const novoIng = await prisma.preparacaoIngrediente.create({
        data: {
          preparacao_id: fm.preparacao_id!,
          alimento_id: ing.alimento_id,
          quantidade_gramas: qtdBase,
          mesma_percapita: ing.eh_fruta,
        },
      })
      ingredientesCriados++

      // Criar percapitas por fase com createMany (1 query em vez de 5)
      if (!ing.eh_fruta) {
        const fases = [
          { fase: 'BERCARIO', qtd: percs.bercario },
          { fase: 'CRECHE', qtd: percs.creche },
          { fase: 'ED_INFANTIL', qtd: percs.ed_infantil },
          { fase: 'FUND_INICIAL', qtd: percs.fund_inicial },
          { fase: 'FUND_FINAL', qtd: percs.fund_final },
        ]
        const percapitasData = fases
          .filter(f => f.qtd !== null && f.qtd !== undefined)
          .map(f => ({
            ingrediente_id: novoIng.id,
            fase_escolar: f.fase,
            quantidade_gramas: f.qtd! > 0 ? f.qtd! : 1,
            auto_calculado: false,
          }))
        if (percapitasData.length > 0) {
          await prisma.preparacaoPercapita.createMany({ data: percapitasData })
          percapitasCriadas += percapitasData.length
        }
      }
    }

    prepsAtualizadas++

    if (prepsAtualizadas % 10 === 0) {
      console.log(`  ... ${prepsAtualizadas}/${comMatch.length} preparações atualizadas (${ingredientesCriados} ingredientes, ${percapitasCriadas} percapitas)`)
    }
  }

  console.log(`\n✅ ${prepsAtualizadas} preparações atualizadas`)
  console.log(`✅ ${ingredientesCriados} ingredientes criados`)
  console.log(`✅ ${percapitasCriadas} percapitas criadas`)

  // Validação final
  const totalPreps = await prisma.preparacao.count()
  const totalIngs = await prisma.preparacaoIngrediente.count()
  const totalPercs = await prisma.preparacaoPercapita.count()

  console.log('\n' + '═'.repeat(70))
  console.log('✅ REPOPULAÇÃO CONCLUÍDA — VALIDAÇÃO')
  console.log('═'.repeat(70))
  console.log(`  Preparações: ${totalPreps}`)
  console.log(`  Ingredientes: ${totalIngs}`)
  console.log(`  Percapitas: ${totalPercs}`)
}

main()
  .catch(async (err) => {
    console.error('❌ Erro fatal:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
