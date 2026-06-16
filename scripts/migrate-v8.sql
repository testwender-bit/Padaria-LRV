-- ============================================================
-- v8 — Migração: Replicar Cardápio (renomeia conceito Ciclo PNAE)
-- ============================================================
-- Roda APENAS UMA VEZ. Aplica as alterações de schema necessárias
-- para suportar:
--   1. Campo "categoria" em Preparacao (PREPARACAO | PAO | LANCHE | BEBIDA | SOBREMESA)
--   2. Campos "dia_pao_frances" e "dia_lanche" em CardapioNutricional (override por cardápio)
--   3. Campo "diferenciada" em CardapioSemanaNutri (badge "Modificada" no editor)
--
-- Como usar:
--   sqlite3 db/custom.db < scripts/migrate-v8.sql
--
-- OU (recomendado): rodar `npx prisma db push` que aplica o schema.prisma
-- automaticamente. Este SQL é fallback para quando não dá para usar Prisma.
-- ============================================================

-- 1. Adiciona coluna categoria em Preparacao (default PREPARACAO)
ALTER TABLE Preparacao ADD COLUMN categoria TEXT NOT NULL DEFAULT 'PREPARACAO';

-- 2. Adiciona colunas dia_pao_frances e dia_lanche em CardapioNutricional
ALTER TABLE CardapioNutricional ADD COLUMN dia_pao_frances TEXT;
ALTER TABLE CardapioNutricional ADD COLUMN dia_lanche TEXT;

-- 3. Adiciona coluna diferenciada em CardapioSemanaNutri
ALTER TABLE CardapioSemanaNutri ADD COLUMN diferenciada BOOLEAN NOT NULL DEFAULT 0;

-- 4. Heurística: marca preparações existentes com base no nome
--    Pão francês / Pão / PF → categoria = 'PAO'
UPDATE Preparacao
SET categoria = 'PAO'
WHERE categoria = 'PREPARACAO'
  AND (LOWER(nome) LIKE '%pão francês%'
    OR LOWER(nome) LIKE '%pao frances%'
    OR LOWER(nome) LIKE '%pão de forma%'
    OR LOWER(nome) LIKE '%pao de forma%'
    OR LOWER(nome) = 'pf'
    OR LOWER(nome) LIKE '%pão francs%'
  );

--    Lanche / Lanche especial → categoria = 'LANCHE'
UPDATE Preparacao
SET categoria = 'LANCHE'
WHERE categoria = 'PREPARACAO'
  AND (LOWER(nome) LIKE '%lanche%'
    OR LOWER(nome) LIKE '%salgado%'
    OR LOWER(nome) LIKE '%pão de queijo%'
    OR LOWER(nome) LIKE '%pao de queijo%'
  );

--    Suco / Leite / Chá / Vitamina → categoria = 'BEBIDA'
UPDATE Preparacao
SET categoria = 'BEBIDA'
WHERE categoria = 'PREPARACAO'
  AND (LOWER(nome) LIKE '%suco%'
    OR LOWER(nome) LIKE '%leite%'
    OR LOWER(nome) LIKE '%chá%'
    OR LOWER(nome) LIKE '%cha %'
    OR LOWER(nome) LIKE '%vitamina%'
    OR LOWER(nome) LIKE '%iogurte%'
  );

--    Sobremesa / Doce / Gelatina → categoria = 'SOBREMESA'
UPDATE Preparacao
SET categoria = 'SOBREMESA'
WHERE categoria = 'PREPARACAO'
  AND (LOWER(nome) LIKE '%sobremesa%'
    OR LOWER(nome) LIKE '%doce%'
    OR LOWER(nome) LIKE '%gelatina%'
    OR LOWER(nome) LIKE '%pudim%'
  );

-- 5. Copia dia_pao_frances e dia_lanche da Escola para os CardapiosNutricionais
--    existentes (apenas para cardápios já associados a uma escola)
UPDATE CardapioNutricional
SET dia_pao_frances = (
  SELECT e.dia_pao_frances FROM Escola e
  WHERE e.id = CardapioNutricional.escola_id
)
WHERE escola_id IS NOT NULL
  AND dia_pao_frances IS NULL;

UPDATE CardapioNutricional
SET dia_lanche = (
  SELECT e.dia_lanche FROM Escola e
  WHERE e.id = CardapioNutricional.escola_id
)
WHERE escola_id IS NOT NULL
  AND dia_lanche IS NULL;

-- 6. Verificação final (rodar opcionalmente para conferir)
-- SELECT categoria, COUNT(*) FROM Preparacao GROUP BY categoria;
-- SELECT COUNT(*) FROM CardapioNutricional WHERE dia_pao_frances IS NOT NULL;
-- SELECT COUNT(*) FROM CardapioSemanaNutri WHERE diferenciada = 1;
