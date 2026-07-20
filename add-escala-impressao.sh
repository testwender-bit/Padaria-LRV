#!/usr/bin/env bash
# ============================================================
# v9.5.5 — Adiciona APENAS o campo escala_impressao em
# CardapioNutricional. NÃO substitui o schema (preserva Postgres).
# ============================================================
#
# Problema: o patch v9.5.5 precisa do campo `escala_impressao Int
# @default(100)` no model CardapioNutricional. Mas o schema do
# usuário é Postgres (não SQLite) — não podemos substituir o
# arquivo inteiro.
#
# Este script adiciona APENAS o campo, sem tocar em mais nada.
#
# Uso:  bash add-escala-impressao.sh
# ============================================================

set -e

SCHEMA="prisma/schema.prisma"

if [ ! -f "$SCHEMA" ]; then
  echo "✗ Arquivo $SCHEMA não encontrado"
  echo "  Rode este script na raiz do projeto (onde está o package.json)."
  exit 1
fi

echo "============================================================"
echo "  v9.5.5 — Adicionar campo escala_impressao"
echo "============================================================"
echo ""

# Verifica se já existe
if grep -q "escala_impressao" "$SCHEMA"; then
  echo "✓ Campo escala_impressao já existe em $SCHEMA — nada a fazer."
  exit 0
fi

# Verifica se o model CardapioNutricional existe
if ! grep -q "model CardapioNutricional" "$SCHEMA"; then
  echo "✗ Model CardapioNutricional não encontrado em $SCHEMA"
  echo "  Verifique se o schema está correto."
  exit 1
fi

echo "[1/2] Adicionando campo escala_impressao após dia_lanche..."

# Usa perl para inserir a linha após a linha que contém "dia_lanche"
# (que é o último campo antes das relações no model CardapioNutricional)
perl -i -pe '
  if (/^\s*dia_lanche\s+String\?/) {
    $_ .= "  // v9.5.5: escala de impressão (zoom) por cardápio (70-150, default 100)\n" .
           "  // Permite ao usuário ajustar o zoom da impressão sem usar Microsoft Print to PDF.\n" .
           "  escala_impressao  Int     \@default(100)\n";
  }
' "$SCHEMA"

if grep -q "escala_impressao" "$SCHEMA"; then
  echo "    ✓ Campo escala_impressao adicionado"
else
  echo "    ✗ FALHA ao adicionar escala_impressao"
  echo "      Adicione manualmente no model CardapioNutricional, após a linha:"
  echo "        dia_lanche        String?  // SEG | TER | QUA | QUI | SEX | null"
  echo "      a seguinte linha:"
  echo "        escala_impressao  Int     @default(100)"
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
echo "       git commit -m 'fix(v9.5.5): cardápio título centralizado + escala configurável'"
echo "       git push"
echo ""
