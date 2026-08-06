#!/usr/bin/env bash
# ============================================================
# v9.6.3 — Adiciona APENAS o campo ordem_pcq em Escola.
# NÃO substitui o schema (preserva Postgres).
# ============================================================
set -e

SCHEMA="prisma/schema.prisma"

if [ ! -f "$SCHEMA" ]; then
  echo "✗ Arquivo $SCHEMA não encontrado"
  echo "  Rode este script na raiz do projeto (onde está o package.json)."
  exit 1
fi

echo "============================================================"
echo "  v9.6.3 — Adicionar campo ordem_pcq em Escola"
echo "============================================================"
echo ""

# Verifica se já existe
if grep -q "ordem_pcq" "$SCHEMA"; then
  echo "✓ Campo ordem_pcq já existe em $SCHEMA — nada a fazer."
  exit 0
fi

# Verifica se o model Escola existe
if ! grep -q "model Escola" "$SCHEMA"; then
  echo "✗ Model Escola não encontrado em $SCHEMA"
  exit 1
fi

echo "[1/2] Adicionando campo ordem_pcq após ordem_rota..."

# Usa perl para inserir a linha após a linha que contém "ordem_rota    Int"
# NOTA: o @ no Prisma precisa ser escapado no Perl (\@)
perl -i -pe '
  if (/^\s*ordem_rota\s+Int\s+\@default\(0\)/) {
    $_ .= "  // v9.6.3: ordenação específica para PCQ (pão de cachorro quente) na produção\n" .
           "  ordem_pcq      Int      \@default(0)\n";
  }
' "$SCHEMA"

if grep -q "ordem_pcq" "$SCHEMA"; then
  echo "    ✓ Campo ordem_pcq adicionado"
else
  echo "    ✗ FALHA ao adicionar ordem_pcq"
  echo "      Adicione manualmente no model Escola, após a linha:"
  echo "        ordem_rota    Int      @default(0)"
  echo "      a seguinte linha:"
  echo "        ordem_pcq      Int      @default(0)"
  exit 1
fi

echo ""
echo "[2/2] Verificando estrutura..."
if grep -q "provider = \"postgresql\"" "$SCHEMA"; then
  echo "    ✓ Datasource é PostgreSQL (preservado)"
elif grep -q "provider = \"sqlite\"" "$SCHEMA"; then
  echo "    ⚠ Datasource é SQLite (pode ser ambiente de teste)"
else
  echo "    ? Datasource não identificado"
fi
echo ""

echo "============================================================"
echo "  CAMPO ADICIONADO COM SUCESSO!"
echo "============================================================"
echo ""
echo "Próximos passos:"
echo ""
echo "  1. Rode prisma db push para criar a coluna no banco:"
echo "       npx prisma db push"
echo ""
echo "  2. Faça commit e push:"
echo "       git add prisma/schema.prisma src/."
echo "       git commit -m 'feat(v9.6.3): ordem específica para PCQ na produção'"
echo "       git push"
echo ""
