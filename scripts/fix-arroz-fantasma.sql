-- ============================================================
-- fix-arroz-fantasma.sql
-- ============================================================
-- Corrige o bug da preparação "Arroz Branco" fantasma nos cardápios,
-- rodando DIRETO no SQL Editor do Supabase.
--
-- CONTEXTO:
--   - Existe "Arroz branco" (ativo=true, ingredientes corretos) — A CERTA
--   - Existe "Arroz Branco" (ativo=false OU com "arroz integral") — A FANTASMA
--   - Vários CardapioItem apontam para o ID do fantasma
--   - Fantasma aparece nos cardápios mas não conta kcal
--
-- COMO USAR:
--   1. Abra Supabase Dashboard → SQL Editor → New query
--   2. Cole TODO este arquivo
--   3. Rode a SEÇÃO 1 (diagnóstico) — copie os IDs do fantasma e do correto
--   4. Edite as variáveis :fantasma_id e :correto_id no topo da SEÇÃO 2
--   5. Rode a SEÇÃO 2 (aplica a correção em transaction)
--
-- SEGURANÇA:
--   - Tudo dentro de BEGIN/COMMIT — se algo falhar, rollback automático
--   - Verifica se ainda há referências antes do hard-delete
--   - Não toca em CardapioItem de outras preparações
-- ============================================================


-- ════════════════════════════════════════════════════════════════
-- SEÇÃO 1 — DIAGNÓSTICO (rodar primeiro, sem modificar nada)
-- ════════════════════════════════════════════════════════════════

-- 1a) Lista TODAS as preparações "Arroz branco" (case-insensitive)
--     com contadores de ingredientes e usos em cardápios
SELECT
  p.id,
  p.nome,
  p.ativo,
  (SELECT COUNT(*) FROM "PreparacaoIngrediente" pi WHERE pi.preparacao_id = p.id) AS num_ingredientes,
  (SELECT COUNT(*) FROM "CardapioItem" ci WHERE ci.preparacao_id = p.id) AS num_usos_cardapios,
  (
    SELECT STRING_AGG(a.nome, ', ')
    FROM "PreparacaoIngrediente" pi
    JOIN "Alimento" a ON a.id = pi.alimento_id
    WHERE pi.preparacao_id = p.id
  ) AS ingredientes_lista
FROM "Preparacao" p
WHERE LOWER(p.nome) LIKE '%arroz branco%'
ORDER BY p.ativo DESC, p.nome;


-- 1b) Lista TODAS as preparações fantasma do banco (genérico)
--     (ativo=false E tem usos) OU (ativo=true E sem ingredientes E tem usos)
SELECT
  p.id,
  p.nome,
  p.ativo,
  (SELECT COUNT(*) FROM "PreparacaoIngrediente" pi WHERE pi.preparacao_id = p.id) AS num_ingredientes,
  (SELECT COUNT(*) FROM "CardapioItem" ci WHERE ci.preparacao_id = p.id) AS num_usos_cardapios
FROM "Preparacao" p
WHERE (
  (p.ativo = false AND EXISTS (SELECT 1 FROM "CardapioItem" ci WHERE ci.preparacao_id = p.id))
  OR
  (
    p.ativo = true
    AND NOT EXISTS (SELECT 1 FROM "PreparacaoIngrediente" pi WHERE pi.preparacao_id = p.id)
    AND EXISTS (SELECT 1 FROM "CardapioItem" ci WHERE ci.preparacao_id = p.id)
  )
)
ORDER BY p.nome;


-- 1c) Preview: para cada CardapioItem do fantasma, mostra onde está e se vai dar MERGE ou UPDATE
--     Substitua 'FANTASMA_ID_AQUI' pelo ID do fantasma e 'CORRETO_ID_AQUI' pelo ID do correto
SELECT
  ci.id AS item_id,
  cn.nome AS cardapio,
  e.nome AS escola,
  csn.numero AS semana,
  cdn.dia_semana,
  tr.nome AS refeicao,
  ci.porcoes,
  ci.preparacao_id AS prep_atual,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM "CardapioItem" ci2
      WHERE ci2.dia_id = ci.dia_id
        AND ci2.tipo_refeicao_id = ci.tipo_refeicao_id
        AND ci2.preparacao_id = 'CORRETO_ID_AQUI'
    ) THEN 'MERGE (soma porções)'
    ELSE 'UPDATE (troca prep_id)'
  END AS acao
FROM "CardapioItem" ci
JOIN "CardapioDiaNutri" cdn ON cdn.id = ci.dia_id
JOIN "CardapioSemanaNutri" csn ON csn.id = cdn.semana_id
JOIN "CardapioNutricional" cn ON cn.id = csn.cardapio_id
LEFT JOIN "Escola" e ON e.id = cn.escola_id
JOIN "TipoRefeicao" tr ON tr.id = ci.tipo_refeicao_id
WHERE ci.preparacao_id = 'FANTASMA_ID_AQUI'
ORDER BY cn.nome, csn.numero, cdn.dia_semana;


-- ════════════════════════════════════════════════════════════════
-- SEÇÃO 2 — APLICAR CORREÇÃO (edit os IDs abaixo, depois rode)
-- ════════════════════════════════════════════════════════════════

-- 👇 EDITAR ESTES DOIS VALORES com os IDs copiados da SEÇÃO 1
--     fantasma_id = o ID da preparação "Arroz Branco" (que tem arroz integral ou ativo=false)
--     correto_id  = o ID da preparação "Arroz branco" (a certa, ativa, com arroz branco)

DO $$
DECLARE
  fantasma_id TEXT := 'COLE_O_ID_DO_FANTASMA_AQUI';
  correto_id  TEXT := 'COLE_O_ID_DO_CORRETO_AQUI';
  merges_count INTEGER := 0;
  updates_count INTEGER := 0;
  restantes INTEGER := 0;
  sobrescritas_count INTEGER := 0;
  subst_count INTEGER := 0;
BEGIN
  -- Sanity check
  IF fantasma_id = 'COLE_O_ID_DO_FANTASMA_AQUI' OR correto_id = 'COLE_O_ID_DO_CORRETO_AQUI' THEN
    RAISE EXCEPTION 'Edite as variáveis fantasma_id e correto_id no topo do bloco DO $$';
  END IF;
  IF fantasma_id = correto_id THEN
    RAISE EXCEPTION 'IDs iguais — verifique a SEÇÃO 1';
  END IF;

  RAISE NOTICE '🚀 Iniciando correção do arroz fantasma...';
  RAISE NOTICE '   Fantasma: %', fantasma_id;
  RAISE NOTICE '   Correto:  %', correto_id;

  -- ── PASSO 1: MERGE — itens do fantasma onde o correto já existe no mesmo slot ──
  -- Para esses casos, somar porções no item do correto e deletar o do fantasma
  WITH itens_para_merge AS (
    SELECT ci.id AS fantasma_item_id, ci.porcoes AS fantasma_porcoes,
           ci2.id AS correto_item_id
    FROM "CardapioItem" ci
    JOIN "CardapioItem" ci2
      ON ci2.dia_id = ci.dia_id
     AND ci2.tipo_refeicao_id = ci.tipo_refeicao_id
     AND ci2.preparacao_id = correto_id
    WHERE ci.preparacao_id = fantasma_id
  ),
  soma_porcoes AS (
    UPDATE "CardapioItem"
    SET porcoes = porcoes + m.fantasma_porcoes
    FROM itens_para_merge m
    WHERE "CardapioItem".id = m.correto_item_id
    RETURNING m.fantasma_item_id
  )
  DELETE FROM "CardapioItem"
  WHERE id IN (SELECT fantasma_item_id FROM itens_para_merge)
  RETURNING id INTO merges_count;
  GET DIAGNOSTICS merges_count = ROW_COUNT;

  RAISE NOTICE '   ✓ Merges (soma + delete): %', merges_count;

  -- ── PASSO 2: UPDATE — itens do fantasma onde o correto NÃO existe no slot ──
  -- Simplesmente trocar preparacao_id do fantasma para o correto
  UPDATE "CardapioItem"
  SET preparacao_id = correto_id
  WHERE preparacao_id = fantasma_id;
  GET DIAGNOSTICS updates_count = ROW_COUNT;

  RAISE NOTICE '   ✓ Updates (troca prep_id): %', updates_count;

  -- ── PASSO 3: Incrementar vezes_usada no correto ──
  IF (merges_count + updates_count) > 0 THEN
    UPDATE "Preparacao"
    SET vezes_usada = vezes_usada + (merges_count + updates_count)
    WHERE id = correto_id;
    RAISE NOTICE '   ✓ vezes_usada incrementada no correto: +%', merges_count + updates_count;
  END IF;

  -- ── PASSO 4: Limpeza de referências remanescentes ──

  -- SobrescritaCardapio (preparacao_substituta_id)
  SELECT COUNT(*) INTO sobrescritas_count
  FROM "SobrescritaCardapio"
  WHERE preparacao_substituta_id = fantasma_id;
  IF sobrescritas_count > 0 THEN
    DELETE FROM "SobrescritaCardapio"
    WHERE preparacao_substituta_id = fantasma_id;
    RAISE NOTICE '   ✓ Removidas % sobrescrita(s) que usavam o fantasma como substituta', sobrescritas_count;
  END IF;

  -- PreparacaoSubstituicao (origem ou destino)
  SELECT COUNT(*) INTO subst_count
  FROM "PreparacaoSubstituicao"
  WHERE preparacao_origem_id = fantasma_id OR preparacao_destino_id = fantasma_id;
  IF subst_count > 0 THEN
    DELETE FROM "PreparacaoSubstituicao"
    WHERE preparacao_origem_id = fantasma_id OR preparacao_destino_id = fantasma_id;
    RAISE NOTICE '   ✓ Removidas % substituição(ões) equivalentes', subst_count;
  END IF;

  -- ── PASSO 5: Sanity check final ──
  SELECT COUNT(*) INTO restantes
  FROM "CardapioItem"
  WHERE preparacao_id = fantasma_id;
  IF restantes > 0 THEN
    RAISE EXCEPTION 'Ainda há % CardapioItem referenciando o fantasma. ABORTANDO hard-delete.', restantes;
  END IF;

  -- ── PASSO 6: Hard-delete do fantasma ──
  -- (cascade em PreparacaoIngrediente + PreparacaoPercapita)
  DELETE FROM "Preparacao" WHERE id = fantasma_id;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ CORREÇÃO CONCLUÍDA COM SUCESSO!';
  RAISE NOTICE '   Merges:    %', merges_count;
  RAISE NOTICE '   Updates:   %', updates_count;
  RAISE NOTICE '   Sobrescritas removidas: %', sobrescritas_count;
  RAISE NOTICE '   Substituições removidas: %', subst_count;
  RAISE NOTICE '   Fantasma hard-deletado: SIM';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Próximos passos:';
  RAISE NOTICE '  1. Abra /nutricao/cardapios no navegador';
  RAISE NOTICE '  2. Abra um cardápio que tinha o fantasma';
  RAISE NOTICE '  3. Confirme que só aparece "Arroz branco" (correto)';
  RAISE NOTICE '  4. Confirme que o kcal está sendo calculado';
END $$;


-- ════════════════════════════════════════════════════════════════
-- SEÇÃO 3 — VERIFICAÇÃO PÓS-CORREÇÃO (rodar depois da SEÇÃO 2)
-- ════════════════════════════════════════════════════════════════

-- Deve retornar ZERO fantasmas:
SELECT
  p.id, p.nome, p.ativo,
  (SELECT COUNT(*) FROM "PreparacaoIngrediente" pi WHERE pi.preparacao_id = p.id) AS num_ingredientes,
  (SELECT COUNT(*) FROM "CardapioItem" ci WHERE ci.preparacao_id = p.id) AS num_usos
FROM "Preparacao" p
WHERE LOWER(p.nome) LIKE '%arroz branco%'
ORDER BY p.nome;

-- Deve retornar apenas 1 linha (a preparação correta):
SELECT id, nome, ativo, vezes_usada FROM "Preparacao"
WHERE LOWER(nome) LIKE '%arroz branco%';
