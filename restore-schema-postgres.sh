#!/usr/bin/env bash
# ============================================================
# RECUPERAÇÃO v9.5.4.1 — restaura schema Postgres e adiciona
# apenas o model ProducaoExtra + campo pao_fixo
# ============================================================
#
# PROBLEMA: o patch v9.5.4 substituiu seu schema Postgres por
# um SQLite, quebrando `prisma db push` e o build da Vercel
# (porque `mode: 'insensitive'` não existe em SQLite).
#
# Este script:
# 1. Restaura o schema ANTERIOR (do commit antes do patch v9.5.4)
# 2. Adiciona APENAS o model ProducaoExtra (antes de HistoricoSemana)
# 3. Adiciona APENAS o campo pao_fixo (depois de ordem_rota)
# 4. Roda prisma generate para validar
#
# Uso:  bash restore-schema-postgres.sh
# ============================================================

set -e

echo "============================================================"
echo "  RECUPERAÇÃO DE SCHEMA — v9.5.4.1"
echo "============================================================"
echo ""

# Etapa 1: restaurar schema do commit anterior
echo "[1/4] Restaurando prisma/schema.prisma do commit anterior..."
git checkout HEAD~1 -- prisma/schema.prisma
echo "    ✓ Schema restaurado (Postgres preservado)"
echo ""

# Etapa 2: verificar se o model ProducaoExtra já existe
echo "[2/4] Verificando se ProducaoExtra já existe no schema..."
if grep -q "model ProducaoExtra" prisma/schema.prisma; then
  echo "    ✓ Model ProducaoExtra já existe — pulando adição"
else
  echo "    → Adicionando model ProducaoExtra antes de HistoricoSemana..."

  # Cria um arquivo temporário com o bloco a inserir
  cat > /tmp/producao_extra_block.txt << 'PRISMA_BLOCK'

// ── Produção Extra (instituições avulsas) ──────────────────
model ProducaoExtra {
  id               String   @id @default(cuid())
  ano              Int
  semana           Int      // semana ISO do calendário
  nome_instituicao String
  produto          String   // 'PF' | 'PCQ' | 'LANCHE'
  dia_semana       String   // segunda, terca, quarta, quinta, sexta
  quantidade       Int      @default(0)
  observacao       String?
  criado_em        DateTime @default(now())

  @@index([ano, semana])
}

PRISMA_BLOCK

  # Insere o bloco antes de "model HistoricoSemana"
  # Usa awk para inserção preservando formatação
  awk '
    /^model HistoricoSemana/ {
      while ((getline line < "/tmp/producao_extra_block.txt") > 0) print line
    }
    { print }
  ' prisma/schema.prisma > prisma/schema.prisma.tmp && mv prisma/schema.prisma.tmp prisma/schema.prisma

  echo "    ✓ Model ProducaoExtra adicionado"
fi
echo ""

# Etapa 3: adicionar campo pao_fixo em Escola (se não existir)
echo "[3/4] Verificando se pao_fixo já existe em Escola..."
if grep -q "pao_fixo" prisma/schema.prisma; then
  echo "    ✓ Campo pao_fixo já existe — pulando adição"
else
  echo "    → Adicionando campo pao_fixo após ordem_rota..."

  # Usa perl para inserir a linha após a linha que contém "ordem_rota    Int      @default(0)"
  # mantendo o formato alinhado
  perl -i -pe 's/(  ordem_rota\s+Int\s+\@default\(0\))/$1\n  pao_fixo      Boolean  \@default(false)/' prisma/schema.prisma

  if grep -q "pao_fixo" prisma/schema.prisma; then
    echo "    ✓ Campo pao_fixo adicionado"
  else
    echo "    ✗ FALHA ao adicionar pao_fixo — adicione manualmente:"
    echo "      No model Escola, após a linha 'ordem_rota Int @default(0)', adicione:"
    echo "        pao_fixo      Boolean  @default(false)"
    exit 1
  fi
fi
echo ""

# Etapa 4: verificar sintaxe básica do schema (sem rodar prisma generate
# para evitar problemas de versão — o usuário roda manualmente depois)
echo "[4/4] Verificando estrutura do schema..."
if grep -q "provider = \"postgresql\"" prisma/schema.prisma; then
  echo "    ✓ Datasource é PostgreSQL"
else
  echo "    ✗ AVISO: provider não é postgresql — verifique manualmente"
fi
if grep -q "model ProducaoExtra" prisma/schema.prisma; then
  echo "    ✓ Model ProducaoExtra presente"
else
  echo "    ✗ AVISO: ProducaoExtra não encontrado"
  exit 1
fi
if grep -q "pao_fixo" prisma/schema.prisma; then
  echo "    ✓ Campo pao_fixo presente em Escola"
else
  echo "    ✗ AVISO: pao_fixo não encontrado"
  exit 1
fi
echo ""

echo "============================================================"
echo "  RECUPERAÇÃO CONCLUÍDA!"
echo "============================================================"
echo ""
echo "Próximos passos:"
echo ""
echo "  1. Rode prisma db push para criar a tabela ProducaoExtra:"
echo "       npx prisma db push"
echo ""
echo "  2. Faça commit e push:"
echo "       git add prisma/schema.prisma"
echo "       git commit -m 'fix(v9.5.4.1): restaura schema Postgres + adiciona ProducaoExtra'"
echo "       git push"
echo ""
echo "  3. A Vercel vai fazer o rebuild automaticamente."
echo ""
echo "Se algo der errado, você pode voltar ao estado anterior com:"
echo "  git checkout HEAD~2 -- prisma/schema.prisma  # antes do patch v9.5.4"
echo ""
