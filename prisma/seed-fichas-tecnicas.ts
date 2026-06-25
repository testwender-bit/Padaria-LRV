// ============================================================
// seed-fichas-tecnicas.ts
// ============================================================
// Importa as 173 receitas das Fichas Técicas 2026 (LRV) para o banco.
//
// Fonte: /home/z/my-project/upload/fichas-tecnicas.json
//   (extraído de "FICHA TÉCNICA para as escolas e creches 2026.docx")
//
// Lógica:
//   - Para cada receita: cria Preparacao + PreparacaoIngrediente + Percapitas
//   - Percapitas:
//     • Frutas/Polpas (mesma_percapita=true): valor único da Fund. Final
//     • Demais (mesma_percapita=false): valor Fund. Final como base (100%),
//       sistema calcula outras fases automaticamente
//   - Se ingrediente não existe no banco → cadastra novo (categoria alimento genérico)
//   - Categoria: PREPARACAO para todas (você ajusta PAO/LANCHE/BEBIDA/SOBREMESA depois)
//   - Tag: seção do documento (Saladas, Acompanhamentos, Bebidas, etc)
//
// Rodar: npx tsx prisma/seed-fichas-tecnicas.ts
// ============================================================
import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'
import { FASES_ESCOLARES, calcularPercapitaPorFase, type FaseEscolar } from '../src/lib/nutricao-utils'

// Usa DATABASE_URL do .env (não calcula path manualmente)
const prisma = new PrismaClient()

// ── Tipos ──
interface IngredienteFicha {
  nome: string
  valores_por_fase: {
    bercario: number | null
    creche: number | null
    ed_infantil: number | null
    fund_inicial: number | null
    fund_final: number | null
  }
  eh_fruta_ou_polpa: boolean
}

interface ReceitaFicha {
  nome: string
  secao: string | null
  ingredientes: IngredienteFicha[]
  modo_preparo: string
}

// ── Mapeamento manual de nomes da ficha → nomes no banco ──
const MAPEAMENTO_NOMES: Record<string, string> = {
  'Cheiro Verde': 'Salsinha (cheiro-verde) fresca',
  'Cheiro verde': 'Salsinha (cheiro-verde) fresca',
  'Sal refinado': 'Sal',
  'Vinagre branco': 'Vinagre',
  'Vinagre de álcool': 'Vinagre',
  'Azeite': 'Azeite de oliva extra virgem',
  'Azeite de oliva': 'Azeite de oliva extra virgem',
  'Óleo': 'Óleo de soja',
  'Óleo de soja': 'Óleo de soja',
  'Manteiga': 'Manteiga',
  'Cebola': 'Cebola crua',
  'Alho': 'Alho cru',
  'Tomate': 'Tomate vermelho cru',
  'Pimentão': 'Pimentão verde cru',
  'Colorau': 'Páprica doce em pó',
  'Colorífico': 'Páprica doce em pó',
  'Açafrão': 'Açafrão da terra (cúrcuma) em pó',
  'Cúrcuma': 'Açafrão da terra (cúrcuma) em pó',
  'Canela': 'Canela em pó',
  'Canela em pau': 'Canela em pó',
  'Louro': 'Louro seco',
  'Folha de louro': 'Louro seco',
  'Pimenta-do-reino': 'Pimenta-do-reino preta moída',
  'Pimenta do reino': 'Pimenta-do-reino preta moída',
  'Batata Inglesa': 'Batata inglesa cozida',
  'Batata inglesa': 'Batata inglesa cozida',
  'Batata Doce': 'Batata-doce crua',
  'Batata doce': 'Batata-doce crua',
  'Batata doce/inglesa': 'Batata-doce crua',
  'Abobora Moranga/cabotiá': 'Moranga (abóbora cabotiá) cozida',
  'Abobora cabotiá': 'Moranga (abóbora cabotiá) cozida',
  'Abóbora Cabotiá': 'Moranga (abóbora cabotiá) cozida',
  'Abóbora cabotiá': 'Moranga (abóbora cabotiá) cozida',
  'Abóbora moranga': 'Moranga (abóbora cabotiá) cozida',
  'Cenoura': 'Cenoura crua',
  'Chuchu': 'Chuchu cru',
  'Pepino': 'Pepino cru',
  'Beterraba': 'Beterraba crua',
  'Brócolis': 'Brócolis cozido',
  'Couve Manteiga': 'Couve manteiga crua',
  'Couve manteiga': 'Couve manteiga crua',
  'Couve': 'Couve manteiga crua',
  'Repolho': 'Repolho cru',
  'Alface': 'Alface',
  'Rúcula': 'Rúcula',
  'Milho verde': 'Milho verde cru',
  'Milho': 'Milho verde cru',
  'Ervilha': 'Ervilha fresca crua',
  'Ervilha seca': 'Ervilha seca crua',
  'Abobrinha': 'Abobrinha verde crua',
  'Abobrinha verde': 'Abobrinha verde crua',
  'Arroz': 'Arroz branco cozido',
  'Arroz cru': 'Arroz branco cozido',
  'Feijão': 'Feijão carioca cozido',
  'Feijão carioca': 'Feijão carioca cozido',
  'Feijão preto': 'Feijão preto cozido',
  'Feijão de corda': 'Feijão fradinho cozido',
  'Macarrão': 'Macarrão cozido',
  'Macarrão parafuso': 'Macarrão cozido',
  'Macarrão espaguete': 'Macarrão cozido',
  'Coxa e Sobrecoxa': 'Frango coxa',
  'Coxa e sobrecoxa': 'Frango coxa',
  'Filé de Peito de Frango': 'Filé de peito de frango',
  'Filé de peito de frango': 'Filé de peito de frango',
  'Filé de Tilápia': 'Tilápia grelhada',
  'Figado Bovino': 'Fígado bovino cru',
  'Fígado Bovino': 'Fígado bovino cru',
  'Carne bovina em pedaço': 'Coxão duro cru',
  'Carne bovina moída': 'Carne moída crua',
  'Carne moída': 'Carne moída crua',
  'Carne Suína': 'Carne suína crua',
  'Carne suína': 'Carne suína crua',
  'Carne suína em cubos': 'Carne suína crua',
  'Carne suína em pedaço': 'Carne suína crua',
  'Salsicha': 'Salsicha',
  'Linguiça calabresa': 'Linguiça calabresa',
  'Calabresa': 'Linguiça calabresa',
  'Ovo': 'Ovo de galinha cru',
  'Leite': 'Leite integral UHT',
  'Leite de Vaca integral UHT': 'Leite integral UHT',
  'Mandioca': 'Mandioca crua',
  'Mandioca descascada': 'Mandioca crua',
  'Polenta': 'Farinha de milho fubá',
  'Fubá': 'Farinha de milho fubá',
  'Fubá de milho': 'Farinha de milho fubá',
  'Farinha de mandioca': 'Farinha de mandioca',
  'Amido de milho': 'Amido de milho',
  'Maisena': 'Amido de milho',
  'Extrato de tomate': 'Extrato de tomate',
  'Extrato tomate': 'Extrato de tomate',
  'Aveia': 'Aveia em flocos',
  'Cacau': 'Cacau em pó 100%',
  'Chocolate em pó 50%': 'Cacau em pó 100%',
  'Chocolate 50%': 'Cacau em pó 100%',
  'Café': 'Café coado sem açúcar',
  'Chá mate': 'Chá mate',
  'Chá de erva-doce': 'Chá de erva-doce',
  'Chá de erva doce': 'Chá de erva-doce',
  'Açúcar': 'Açúcar cristal',
  'Banana': 'Banana prata',
  'Banana da terra': 'Banana da terra',
  'Banana maçã': 'Banana maçã',
  'Banana nanica': 'Banana nanica',
  'Mamão': 'Mamão formosa',
  'Maçã': 'Maçã',
  'Laranja': 'Laranja',
  'Abacaxi': 'Abacaxi',
  'Melancia': 'Melancia',
  'Melão': 'Melão',
  'Manga': 'Mamão formosa', // ajustar
  'Pokan': 'Poncã',
  'Poncã': 'Poncã',
  'Caqui': 'Caqui',
  'Coco ralado': 'Coco ralado',
  'Leite de coco': 'Leite de coco',
  'Azeite de dendê': 'Azeite de dendê',
  'Proteína texturizada de soja': 'Proteína texturizada de soja',
  'Proteína de soja': 'Proteína texturizada de soja',
  'Ervilha Congelada': 'Ervilha fresca congelada',
  'Cheiro Verde\nLouro': 'Salsinha (cheiro-verde) fresca', // simplificado
}

// ── Carrega JSON das fichas ──
const fichasPath = path.resolve(process.cwd(), 'fichas-tecnicas.json')
if (!fs.existsSync(fichasPath)) {
  console.error(`❌ Arquivo não encontrado: ${fichasPath}`)
  console.error('   Coloque fichas-tecnicas.json na raiz do projeto.')
  process.exit(1)
}

const fichas: ReceitaFicha[] = JSON.parse(fs.readFileSync(fichasPath, 'utf-8'))
console.log(`📚 Carregadas ${fichas.length} receitas das fichas técnicas`)

// ── Cache de alimentos ──
let alimentosCache: { id: string; nome: string; grupo: string; ferro_mg: number }[] = []
async function carregarAlimentos() {
  alimentosCache = await prisma.alimento.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, grupo: true, ferro_mg: true },
  })
  console.log(`  Cache: ${alimentosCache.length} alimentos`)
}

// ── Limpa alimentos criados com dados zerados em execuções anteriores ──
async function limparAlimentosZerados() {
  const zerados = await prisma.alimento.findMany({
    where: {
      energia_kcal: 0,
      proteinas_g: 0,
      lipidios_g: 0,
      sodio_mg: 0,
      ferro_mg: 0,
      ativo: true,
      codigo_taco: null, // não remover os da TACO que podem ter valores 0
    },
    select: { id: true, nome: true },
  })
  if (zerados.length > 0) {
    console.log(`  🧹 Removendo ${zerados.length} alimentos criados com dados zerados em execuções anteriores...`)
    for (const z of zerados) {
      // Remove ingredientes que apontam para esse alimento (cascade não funciona em SQLite sem chave)
      await prisma.preparacaoIngrediente.deleteMany({ where: { alimento_id: z.id } })
      await prisma.alimento.delete({ where: { id: z.id } })
    }
  }
}

function normalize(s: string): string {
  if (!s) return ''
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function buscarAlimento(nome: string) {
  // 1. Mapeamento manual
  const mapped = MAPEAMENTO_NOMES[nome] || MAPEAMENTO_NOMES[nome.trim()]
  if (mapped) {
    const found = alimentosCache.find((a) => a.nome === mapped)
    if (found) return found
  }

  // 2. Nome exato
  const exato = alimentosCache.find((a) => a.nome === nome)
  if (exato) return exato

  // 3. Normalizado
  const nomeNorm = normalize(nome)
  const found = alimentosCache.find((a) => normalize(a.nome) === nomeNorm)
  if (found) return found

  // 4. Contains
  const contains = alimentosCache.find(
    (a) => normalize(a.nome).includes(nomeNorm) || nomeNorm.includes(normalize(a.nome))
  )
  if (contains) return contains

  return null
}

async function criarAlimentoNovo(nome: string) {
  const alimento = await prisma.alimento.create({
    data: {
      nome,
      grupo: 'Outros',
      medida_caseira: '1 porção (100 g)',
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
  alimentosCache.push(alimento)
  return alimento
}

async function main() {
  console.log('🌱 Iniciando importação das fichas técnicas...')
  await limparAlimentosZerados()
  await carregarAlimentos()
  console.log('')

  let criadas = 0
  let atualizadas = 0
  let erros = 0
  const ingredientesNaoEncontrados = new Set<string>()
  const naoEncontradosLista: { receita: string; ingrediente: string }[] = []

  for (const ficha of fichas) {
    try {
      const existing = await prisma.preparacao.findFirst({
        where: { nome: ficha.nome },
      })

      if (existing) {
        await prisma.preparacaoIngrediente.deleteMany({
          where: { preparacao_id: existing.id },
        })
      }

      const prep = existing
        ? await prisma.preparacao.update({
            where: { id: existing.id },
            data: {
              descricao: `Seção: ${ficha.secao || '—'}`,
              modo_preparo: ficha.modo_preparo || null,
              tags: ficha.secao || '',
              categoria: 'PREPARACAO',
            },
          })
        : await prisma.preparacao.create({
            data: {
              nome: ficha.nome,
              descricao: `Seção: ${ficha.secao || '—'}`,
              modo_preparo: ficha.modo_preparo || null,
              tags: ficha.secao || '',
              categoria: 'PREPARACAO',
              ativo: true,
            },
          })

      for (const ing of ficha.ingredientes) {
        let alimento = buscarAlimento(ing.nome)

        if (!alimento) {
          ingredientesNaoEncontrados.add(ing.nome)
          naoEncontradosLista.push({ receita: ficha.nome, ingrediente: ing.nome })
          alimento = await criarAlimentoNovo(ing.nome)
          console.log(`  [NOVO ALIMENTO] ${ing.nome}`)
        }

        const valorFundFinal = ing.valores_por_fase.fund_final
        if (!valorFundFinal || valorFundFinal <= 0) {
          const fallback =
            ing.valores_por_fase.fund_inicial ||
            ing.valores_por_fase.ed_infantil ||
            ing.valores_por_fase.creche ||
            ing.valores_por_fase.bercario ||
            0
          if (fallback === 0) continue

          const ingrediente = await prisma.preparacaoIngrediente.create({
            data: {
              preparacao_id: prep.id,
              alimento_id: alimento.id,
              quantidade_gramas: fallback,
              mesma_percapita: ing.eh_fruta_ou_polpa,
            },
          })
          if (!ing.eh_fruta_ou_polpa) {
            for (const fase of FASES_ESCOLARES) {
              // v8.12: honra o null do JSON — se a fase está null, criar percapita=0
              // (em vez de calcular via percentual automático)
              const valorFase = ing.valores_por_fase[
                fase.value.toLowerCase() as keyof typeof ing.valores_por_fase
              ]
              if (valorFase === null) {
                await prisma.preparacaoPercapita.create({
                  data: {
                    ingrediente_id: ingrediente.id,
                    fase_escolar: fase.value,
                    quantidade_gramas: 0,
                    auto_calculado: false, // false = override manual (não recalcular)
                  },
                })
              } else {
                const gramas = valorFase ?? calcularPercapitaPorFase(fallback, fase.value as FaseEscolar)
                await prisma.preparacaoPercapita.create({
                  data: {
                    ingrediente_id: ingrediente.id,
                    fase_escolar: fase.value,
                    quantidade_gramas: gramas,
                    auto_calculado: true,
                  },
                })
              }
            }
          }
          continue
        }

        const ingrediente = await prisma.preparacaoIngrediente.create({
          data: {
            preparacao_id: prep.id,
            alimento_id: alimento.id,
            quantidade_gramas: valorFundFinal,
            mesma_percapita: ing.eh_fruta_ou_polpa,
          },
        })

        if (!ing.eh_fruta_ou_polpa) {
          for (const fase of FASES_ESCOLARES) {
            // v8.12: honra o null do JSON — se a fase está null, criar percapita=0
            // (em vez de calcular via percentual automático)
            const valorFase = ing.valores_por_fase[
              fase.value.toLowerCase() as keyof typeof ing.valores_por_fase
            ]
            if (valorFase === null) {
              await prisma.preparacaoPercapita.create({
                data: {
                  ingrediente_id: ingrediente.id,
                  fase_escolar: fase.value,
                  quantidade_gramas: 0,
                  auto_calculado: false, // false = override manual (não recalcular)
                },
              })
            } else {
              const gramas = valorFase ?? calcularPercapitaPorFase(valorFundFinal, fase.value as FaseEscolar)
              await prisma.preparacaoPercapita.create({
                data: {
                  ingrediente_id: ingrediente.id,
                  fase_escolar: fase.value,
                  quantidade_gramas: gramas,
                  auto_calculado: true,
                },
              })
            }
          }
        }
      }

      if (existing) {
        atualizadas++
        console.log(`  [↻] ${ficha.nome} (${ficha.ingredientes.length} ings)`)
      } else {
        criadas++
        console.log(`  [+] ${ficha.nome} (${ficha.ingredientes.length} ings)`)
      }
    } catch (err: any) {
      erros++
      console.error(`  [✗] ${ficha.nome}: ${err.message}`)
    }
  }

  console.log('')
  console.log('═══════════════════════════════════════════════════')
  console.log(`  ✓ ${criadas} preparações criadas`)
  console.log(`  ↻ ${atualizadas} preparações atualizadas`)
  console.log(`  ✗ ${erros} erros`)
  console.log('═══════════════════════════════════════════════════')

  if (ingredientesNaoEncontrados.size > 0) {
    console.log('')
    console.log(`⚠️  ${ingredientesNaoEncontrados.size} ingredientes NÃO encontrados no banco:`)
    console.log('   Foram criados com dados nutricionais ZERADOS — revise no cadastro:')
    console.log('')
    for (const ing of ingredientesNaoEncontrados) {
      const receitas = naoEncontradosLista.filter((n) => n.ingrediente === ing).map((n) => n.receita)
      console.log(`  • ${ing} (em ${receitas.length} receitas)`)
    }

    const relatorioPath = path.resolve(process.cwd(), 'prisma', 'ingredientes-revisar.txt')
    const conteudo = `# Ingredientes a revisar — criados com dados zerados\n\n${Array.from(ingredientesNaoEncontrados).map((ing) => {
      const receitas = naoEncontradosLista.filter((n) => n.ingrediente === ing).map((n) => n.receita)
      return `• ${ing} (em ${receitas.length} receitas)\n  - ${receitas.slice(0, 5).join('\n  - ')}${receitas.length > 5 ? `\n  - ... e mais ${receitas.length - 5}` : ''}\n`
    }).join('\n')}`
    fs.writeFileSync(relatorioPath, conteudo, 'utf-8')
    console.log(`\n📄 Relatório salvo: ${relatorioPath}`)
  }

  const totalPreparacoes = await prisma.preparacao.count()
  console.log(`\n📊 Total de preparações no banco: ${totalPreparacoes}`)
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
