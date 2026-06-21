// ============================================================
// scripts/export-sqlite-to-json.ts
// ============================================================
// Lê TODOS os dados do banco SQLite local (db/custom.db) e
// salva em migration-data.json — estruturado por tabela.
//
// ⚠️ USA node:sqlite (Node 22+ nativo) — NÃO usa Prisma.
//    Isso é importante porque o Prisma Client gerado para Postgres
//    não consegue ler SQLite (dá erro "URL must start with postgresql://").
//
// Uso:
//   npx tsx scripts/export-sqlite-to-json.ts
//
// O banco SQLite é APENAS LIDO — nunca modificado.
// ============================================================

import { DatabaseSync } from 'node:sqlite'
import fs from 'fs'
import path from 'path'

// Caminho do SQLite local (fonte)
const SQLITE_PATH = path.resolve(process.cwd(), 'db/custom.db')

if (!fs.existsSync(SQLITE_PATH)) {
  console.error(`❌ Arquivo SQLite não encontrado: ${SQLITE_PATH}`)
  console.error('   Verifique se o arquivo db/custom.db existe no projeto.')
  process.exit(1)
}

console.log(`📂 Lendo SQLite local: ${SQLITE_PATH}`)
console.log(`   Tamanho: ${(fs.statSync(SQLITE_PATH).size / 1024 / 1024).toFixed(2)} MB\n`)

// Abre o SQLite em modo READ-ONLY (segurança extra — nunca modifica)
const db = new DatabaseSync(SQLITE_PATH, { readOnly: true })

// Lista de todas as tabelas do schema em ORDEM DE DEPENDÊNCIA (FKs primeiro).
// Esta ordem é usada tanto no export quanto no import — garante que o JSON
// possa ser importado sem violar FKs.
//
// Os nomes aqui são os NOMES DAS TABELAS NO BANCO (não os nomes dos modelos Prisma).
// Por exemplo, "PedidoCompra" no Prisma mapeia para "pedidos_compra" no banco
// (devido ao @@map).
const TABLE_ORDER: Array<{ table: string; prismaModel: string; label: string }> = [
  // 1) Autenticação (sem FK)
  { table: 'User', prismaModel: 'user', label: 'Usuários (NextAuth)' },
  { table: 'Nutricionista', prismaModel: 'nutricionista', label: 'Nutricionistas' },

  // 2) Configurações base (sem FK)
  { table: 'Escola', prismaModel: 'escola', label: 'Escolas' },
  { table: 'TipoRefeicao', prismaModel: 'tipoRefeicao', label: 'Tipos de Refeição' },
  { table: 'Alimento', prismaModel: 'alimento', label: 'Alimentos (TACO)' },
  { table: 'Insumo', prismaModel: 'insumo', label: 'Insumos de Estoque' },
  { table: 'Lanche', prismaModel: 'lanche', label: 'Lanches' },
  { table: 'Feriado', prismaModel: 'feriado', label: 'Feriados' },
  { table: 'MetaNutricional', prismaModel: 'metaNutricional', label: 'Metas Nutricionais PNAE' },

  // 3) Depende de Escola
  { table: 'PfQuantidade', prismaModel: 'pfQuantidade', label: 'PF Quantidades por escola' },
  { table: 'PcqQuantidade', prismaModel: 'pcqQuantidade', label: 'PCQ Quantidades por escola' },

  // 4) Depende de Lanche + Escola
  { table: 'LancheDistribuicao', prismaModel: 'lancheDistribuicao', label: 'Distribuição de Lanches' },

  // 5) Depende de Lanche
  { table: 'CardapioSemestral', prismaModel: 'cardapioSemestral', label: 'Cardápios Semestrais (PF/PCQ)' },

  // 6) Depende de Escola
  { table: 'Ajuste', prismaModel: 'ajuste', label: 'Ajustes Semanais' },

  // 7) Snapshots (sem FK direta)
  { table: 'HistoricoSemana', prismaModel: 'historicoSemana', label: 'Histórico de Semanas (snapshots)' },

  // 8) Estoque — depende de Insumo
  { table: 'Receita', prismaModel: 'receita', label: 'Receitas (composição)' },
  { table: 'MovimentacaoEstoque', prismaModel: 'movimentacaoEstoque', label: 'Movimentações de Estoque' },
  // Tabela com @@map:
  { table: 'pedidos_compra', prismaModel: 'pedidoCompra', label: 'Pedidos de Compra' },
  { table: 'itens_pedido_compra', prismaModel: 'itemPedidoCompra', label: 'Itens de Pedidos de Compra' },
  { table: 'ContagemEstoque', prismaModel: 'contagemEstoque', label: 'Contagens Físicas de Estoque' },

  // 9) Nutrição — Preparações
  { table: 'Preparacao', prismaModel: 'preparacao', label: 'Preparações (receitas nutricionais)' },
  { table: 'PreparacaoIngrediente', prismaModel: 'preparacaoIngrediente', label: 'Ingredientes de Preparações' },
  { table: 'PreparacaoPercapita', prismaModel: 'preparacaoPercapita', label: 'Percapitas por Fase Escolar' },
  { table: 'PreparacaoSubstituicao', prismaModel: 'preparacaoSubstituicao', label: 'Substituições Equivalentes' },

  // 10) Nutrição — Categorias × Refeições (depende de TipoRefeicao)
  { table: 'CategoriaRefeicao', prismaModel: 'categoriaRefeicao', label: 'Categoria × Refeição' },

  // 11) Nutrição — Cardápios (depende de Escola + Nutricionista)
  { table: 'CardapioNutricional', prismaModel: 'cardapioNutricional', label: 'Cardápios Nutricionais' },
  { table: 'CardapioSemanaNutri', prismaModel: 'cardapioSemanaNutri', label: 'Semanas dos Cardápios' },
  { table: 'CardapioDiaNutri', prismaModel: 'cardapioDiaNutri', label: 'Dias dos Cardápios' },
  { table: 'CardapioItem', prismaModel: 'cardapioItem', label: 'Itens dos Cardápios' },
  { table: 'SobrescritaCardapio', prismaModel: 'sobrescritaCardapio', label: 'Sobrescritas de Cardápio' },
  { table: 'ListaCompras', prismaModel: 'listaCompras', label: 'Listas de Compras (snapshots)' },

  // 12) NextAuth auxiliares (geralmente vazios em produção com Credentials)
  { table: 'Account', prismaModel: 'account', label: 'Accounts (NextAuth OAuth — vazio)' },
  { table: 'Session', prismaModel: 'session', label: 'Sessions (NextAuth — vazio)' },
  { table: 'VerificationToken', prismaModel: 'verificationToken', label: 'Verification Tokens (vazio)' },
]

// Helper: converte valor do SQLite para JSON-friendly
// (BigInt vira string, undefined vira null, etc.)
function normalizeValue(val: unknown): unknown {
  if (val === undefined) return null
  if (typeof val === 'bigint') return Number(val)  // SQLite Int64 → number (com cuidado para não estourar)
  if (val instanceof Uint8Array) return Buffer.from(val).toString('base64')  // blobs
  return val
}

// Cache de colunas booleanas por tabela — evita reconsultar PRAGMA toda iteração
const booleanColumnsCache = new Map<string, Set<string>>()

// Retorna os nomes das colunas que são booleanas (tipo BOOLEAN no SQLite).
// Prisma com SQLite armazena Boolean como INTEGER com valores 0/1,
// mas a declaração de tipo da coluna é "BOOLEAN".
function getBooleanColumns(tableName: string): Set<string> {
  if (booleanColumnsCache.has(tableName)) {
    return booleanColumnsCache.get(tableName)!
  }
  const stmt = db.prepare(`PRAGMA table_info("${tableName}")`)
  const cols = stmt.all() as Array<{ name: string; type: string }>
  const boolCols = new Set<string>()
  for (const c of cols) {
    // Compara case-insensitive e aceita BOOLEAN, BOOL
    if (c.type && c.type.toUpperCase().includes('BOOL')) {
      boolCols.add(c.name)
    }
  }
  booleanColumnsCache.set(tableName, boolCols)
  return boolCols
}

// Lê todos os registros de uma tabela usando SQL puro
function readAllFromTable(tableName: string): unknown[] {
  // Primeiro verifica se a tabela existe
  const checkTable = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`
  )
  const exists = checkTable.get(tableName) as { name: string } | undefined
  if (!exists) {
    return []
  }

  // Descobre quais colunas são booleanas nesta tabela
  const boolCols = getBooleanColumns(tableName)

  // Lê tudo
  const stmt = db.prepare(`SELECT * FROM "${tableName}"`)
  const rows = stmt.all() as Record<string, unknown>[]

  // Normaliza valores para JSON:
  // - BigInt → number
  // - Uint8Array → base64 string
  // - 0/1 em colunas booleanas → false/true (CRÍTICO para Postgres)
  return rows.map(row => {
    const normalized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row)) {
      let v = normalizeValue(value)
      // Conversão booleana: SQLite INTEGER 0/1 → JS boolean
      // (Postgres via Prisma exige true/false, não aceita 0/1)
      if (boolCols.has(key) && (v === 0 || v === 1)) {
        v = v === 1
      }
      normalized[key] = v
    }
    return normalized
  })
}

async function main() {
  console.log('🚀 Iniciando export SQLite → JSON\n')

  const exportData: Record<string, unknown[]> = {}
  const summary: Array<{ table: string; count: number; label: string }> = []
  let totalRecords = 0

  for (const { table, prismaModel, label } of TABLE_ORDER) {
    try {
      const records = readAllFromTable(table)
      exportData[prismaModel] = records
      totalRecords += records.length
      summary.push({ table: prismaModel, count: records.length, label })
      const marker = records.length === 0 ? '  ' : '✓'
      console.log(`  ${marker} ${prismaModel.padEnd(28)} ${String(records.length).padStart(6)}   ${label}`)
    } catch (err) {
      console.error(`  ✗ Erro ao ler ${table}:`, err instanceof Error ? err.message : err)
      exportData[prismaModel] = []
      summary.push({ table: prismaModel, count: 0, label })
    }
  }

  // Salva o JSON
  const outputPath = path.resolve(process.cwd(), 'migration-data.json')
  fs.writeFileSync(outputPath, JSON.stringify({
    _meta: {
      exportedAt: new Date().toISOString(),
      source: 'sqlite:' + SQLITE_PATH,
      totalRecords,
      tablesWith: summary.filter(s => s.count > 0).length,
      tablesTotal: summary.length,
    },
    summary,
    data: exportData,
  }, null, 2))

  console.log(`\n📦 Total: ${totalRecords} registros em ${summary.filter(s => s.count > 0).length} tabelas (de ${summary.length})`)
  console.log(`💾 Arquivo salvo: ${outputPath}`)
  console.log(`   Tamanho: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`)
  console.log('\n✅ Export concluído. Próximo passo: rodar import-json-to-supabase.ts')
}

main()
  .catch((err) => {
    console.error('❌ Erro fatal:', err)
    process.exit(1)
  })
  .finally(() => {
    db.close()
  })
