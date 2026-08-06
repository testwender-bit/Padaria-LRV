#!/usr/bin/env bash
# ============================================================
# v9.6.4 — Adiciona campos alergenos_bloqueados e alergenos_forcados
# ao model Preparacao. NÃO substitui o schema (preserva Postgres).
# ============================================================
set -e

SCHEMA="prisma/schema.prisma"

if [ ! -f "$SCHEMA" ]; then
  echo "✗ Arquivo $SCHEMA não encontrado"
  exit 1
fi

echo "============================================================"
echo "  v9.6.4 — Adicionar campos de alérgenos manual em Preparacao"
echo "============================================================"
echo ""

# Verifica se já existe
if grep -q "alergenos_bloqueados" "$SCHEMA"; then
  echo "✓ Campo alergenos_bloqueados já existe — nada a fazer."
  exit 0
fi

# Verifica se o model Preparacao existe
if ! grep -q "model Preparacao" "$SCHEMA"; then
  echo "✗ Model Preparacao não encontrado em $SCHEMA"
  exit 1
fi

echo "[1/2] Adicionando campos após 'categoria'..."

# Usa perl para inserir após a linha "categoria    String  @default(\"PREPARACAO\")"
# NOTA: o \@ é necessário no Perl para escapar o @ do Prisma
perl -i -pe '
  if (/^\s*categoria\s+String\s+\@default\("PREPARACAO"\)/) {
    $_ .= "  // v9.6.4: override manual de alérgenos (JSON string com siglas: L,O,T,S)\n" .
           "  // alergenos_bloqueados: siglas REMOVIDAS da detecção automática (ex.: \"T\" num cuscuz de milho)\n" .
           "  // alergenos_forcados: siglas ADICIONADAS além da detecção automática\n" .
           "  alergenos_bloqueados  String  \@default(\"[]\")\n" .
           "  alergenos_forcados    String  \@default(\"[]\")\n";
  }
' "$SCHEMA"

if grep -q "alergenos_bloqueados" "$SCHEMA"; then
  echo "    ✓ Campos adicionados"
else
  echo "    ✗ FALHA ao adicionar campos"
  echo "      Adicione manualmente no model Preparacao, após a linha:"
  echo '        categoria    String  @default("PREPARACAO")'
  echo "      as seguintes linhas:"
  echo '        alergenos_bloqueados  String  @default("[]")'
  echo '        alergenos_forcados    String  @default("[]")'
  exit 1
fi

echo ""
echo "[2/2] Verificando estrutura..."
if grep -q "provider = \"postgresql\"" "$SCHEMA"; then
  echo "    ✓ Datasource é PostgreSQL (preservado)"
fi
echo ""

echo "============================================================"
echo "  CAMPOS ADICIONADOS COM SUCESSO!"
echo "============================================================"
echo ""
echo "Próximos passos:"
echo ""
echo "  1. Gere o Prisma Client:"
echo "       npx prisma generate"
echo ""
echo "  2. Crie as colunas no banco:"
echo "       npx prisma db push"
echo ""
echo "  3. Commit e push:"
echo "       git add -A"
echo "       git commit -m 'feat(v9.6.4): override manual de alergenos + corrige falso positivo de cuscuz'"
echo "       git push"
echo ""
