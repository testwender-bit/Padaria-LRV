-- ============================================================
-- categorizar-preparacoes-v9.sql
-- ============================================================
-- Categoriza TODAS as preparações que estão como 'PREPARACAO'
-- (default) baseado no nome. A categoria do banco é a VERDADE
-- ABSOLUTA no v9.0 — define a ordem de exibição.
--
-- COMO RODAR:
--   No painel do Supabase → SQL Editor → cole este script → Run
--
-- Categorias atribuídas:
--   SALADA         — saladas, vinagrete, alface, acelga, rúcula
--   ARROZ          — arroz (qualquer tipo)
--   FEIJAO         — feijão (qualquer tipo)
--   PROTEINA       — carnes, frango, peixe, ovo, soja, feijoada
--   ACOMPANHAMENTO — purê, batata, legumes, farofa, polenta, macarrão
--   BEBIDA         — leite, café, chá, vitamina, achocolatado, iogurte
--   SUCO           — sucos
--   PAO            — pães (francês, de forma, com manteiga, etc.)
--   LANCHE         — rosca, brioche, croissant (lanches especiais)
--   CUSCUZ         — cuscuz
--   DOCE           — canjica, curau, pamonha, bolo doce, pudim, doce
--   FRUTA          — frutas (banana, maçã, mamão, melancia, etc.)
--   SOBREMESA      — sobremesas (mantém se já for)
--
-- PREPARACOES NÃO CATEGORIZADAS (continuam como 'PREPARACAO'):
--   - Preparações que não batem com nenhuma palavra-chave
--   - Essas usam fallback por palavra-chave na hora da ordenação
-- ============================================================

BEGIN;

-- SALADAS
UPDATE "Preparacao" SET categoria = 'SALADA'
WHERE categoria = 'PREPARACAO'
  AND (LOWER(nome) LIKE '%salada%'
    OR LOWER(nome) LIKE '%vinagrete%'
    OR LOWER(nome) LIKE '%alface%'
    OR LOWER(nome) LIKE '%acelga%'
    OR LOWER(nome) LIKE '%rúcula%'
    OR LOWER(nome) LIKE '%rucula%');

-- ARROZ
UPDATE "Preparacao" SET categoria = 'ARROZ'
WHERE categoria = 'PREPARACAO'
  AND LOWER(nome) LIKE '%arroz%';

-- FEIJÃO
UPDATE "Preparacao" SET categoria = 'FEIJAO'
WHERE categoria = 'PREPARACAO'
  AND (LOWER(nome) LIKE '%feijão%'
    OR LOWER(nome) LIKE '%feijao%'
    OR LOWER(nome) LIKE '%virado de feijão%'
    OR LOWER(nome) LIKE '%virado de feijao%');

-- PROTEÍNAS (carne, frango, peixe, ovo, soja, feijoada)
UPDATE "Preparacao" SET categoria = 'PROTEINA'
WHERE categoria = 'PREPARACAO'
  AND (LOWER(nome) LIKE '%carne%'
    OR LOWER(nome) LIKE '%frango%'
    OR LOWER(nome) LIKE '%peixe%'
    OR LOWER(nome) LIKE '%tilápia%'
    OR LOWER(nome) LIKE '%tilapia%'
    OR LOWER(nome) LIKE '%fígado%'
    OR LOWER(nome) LIKE '%figado%'
    OR LOWER(nome) LIKE '%moela%'
    OR LOWER(nome) LIKE '%ovo mexido%'
    OR LOWER(nome) LIKE '%omelete%'
    OR LOWER(nome) LIKE '%salsicha%'
    OR LOWER(nome) LIKE '%linguiça%'
    OR LOWER(nome) LIKE '%linguica%'
    OR LOWER(nome) LIKE '%calabresa%'
    OR LOWER(nome) LIKE '%soja%'
    OR LOWER(nome) LIKE '%proteína%'
    OR LOWER(nome) LIKE '%proteina%'
    OR LOWER(nome) LIKE '%patinho%'
    OR LOWER(nome) LIKE '%coxão%'
    OR LOWER(nome) LIKE '%acém%'
    OR LOWER(nome) LIKE '%acem%'
    OR LOWER(nome) LIKE '%suína%'
    OR LOWER(nome) LIKE '%suina%'
    OR LOWER(nome) LIKE '%carreteiro%'
    OR LOWER(nome) LIKE '%ragu%'
    OR LOWER(nome) LIKE '%isca%'
    OR LOWER(nome) LIKE '%risoto%'
    OR LOWER(nome) LIKE '%panqueca%'
    OR LOWER(nome) LIKE '%escondidinho%'
    OR LOWER(nome) LIKE '%vaca atolada%'
    OR LOWER(nome) LIKE '%galinha atolada%'
    OR LOWER(nome) LIKE '%dueto%'
    OR LOWER(nome) LIKE '%strogonoff%'
    OR LOWER(nome) LIKE '%feijoada%'
    OR LOWER(nome) LIKE '%bobó%'
    OR LOWER(nome) LIKE '%bobo%'
    OR LOWER(nome) LIKE '%mojica%'
    OR LOWER(nome) LIKE '%escaldado%'
    OR LOWER(nome) LIKE '%patê%'
    OR LOWER(nome) LIKE '%pate%'
    OR LOWER(nome) LIKE '%moqueca%'
    OR LOWER(nome) LIKE '%vatapá%'
    OR LOWER(nome) LIKE '%vatapa%');

-- ACOMPANHAMENTOS (purê, batata, legumes, farofa, polenta, macarrão)
UPDATE "Preparacao" SET categoria = 'ACOMPANHAMENTO'
WHERE categoria = 'PREPARACAO'
  AND (LOWER(nome) LIKE '%purê%'
    OR LOWER(nome) LIKE '%pure%'
    OR LOWER(nome) LIKE '%batata%'
    OR LOWER(nome) LIKE '%legumes%'
    OR LOWER(nome) LIKE '%legume%'
    OR LOWER(nome) LIKE '%abóbora%'
    OR LOWER(nome) LIKE '%abobora%'
    OR LOWER(nome) LIKE '%couve refogada%'
    OR LOWER(nome) LIKE '%repolho refogado%'
    OR LOWER(nome) LIKE '%quiabo refogado%'
    OR LOWER(nome) LIKE '%couve%'
    OR LOWER(nome) LIKE '%repolho%'
    OR LOWER(nome) LIKE '%quiabo%'
    OR LOWER(nome) LIKE '%maxixe%'
    OR LOWER(nome) LIKE '%chuchu%'
    OR LOWER(nome) LIKE '%farofa%'
    OR LOWER(nome) LIKE '%polenta%'
    OR LOWER(nome) LIKE '%mandioca%'
    OR LOWER(nome) LIKE '%macarrão%'
    OR LOWER(nome) LIKE '%macarrao%'
    OR LOWER(nome) LIKE '%espaguete%'
    OR LOWER(nome) LIKE '%nhoque%'
    OR LOWER(nome) LIKE '%lasanha%'
    OR LOWER(nome) LIKE '%angu%'
    OR LOWER(nome) LIKE '%creme de ervilha%'
    OR LOWER(nome) LIKE '%sopa de%'
    OR LOWER(nome) LIKE '%caldo%'
    OR LOWER(nome) LIKE '%bolinho%'
    OR LOWER(nome) LIKE '%fubá%'
    OR LOWER(nome) LIKE '%fuba%'
    OR LOWER(nome) LIKE '%farinha de mandioca%'
    OR LOWER(nome) LIKE '%virado%'
    OR LOWER(nome) LIKE '%minestra%'
    OR LOWER(nome) LIKE '%abobrinha%'
    OR LOWER(nome) LIKE '%ervilha%'
    OR LOWER(nome) LIKE '%milho%'
    OR LOWER(nome) LIKE '%flocos de milho%'
    OR LOWER(nome) LIKE '%batata doce%'
    OR LOWER(nome) LIKE '%batata-doce%'
    OR LOWER(nome) LIKE '%batata sauté%'
    OR LOWER(nome) LIKE '%batata inglesa%'
    OR LOWER(nome) LIKE '%legumes ao molho%'
    OR LOWER(nome) LIKE '%legumes refogados%'
    OR LOWER(nome) LIKE '%abóbora refogada%'
    OR LOWER(nome) LIKE '%abobora refogada%'
    OR LOWER(nome) LIKE '%arroz com feijão%'
    OR LOWER(nome) LIKE '%arroz com feijao%'
    OR LOWER(nome) LIKE '%arroz com cenoura%'
    OR LOWER(nome) LIKE '%arroz com abobrinha%'
    OR LOWER(nome) LIKE '%arroz com lentilha%'
    OR LOWER(nome) LIKE '%arroz alegria%'
    OR LOWER(nome) LIKE '%arroz colorido%'
    OR LOWER(nome) LIKE '%arroz branco%'
    OR LOWER(nome) LIKE '%arroz integral%'
    OR LOWER(nome) LIKE '%feijão tropeiro%'
    OR LOWER(nome) LIKE '%feijao tropeiro%'
    OR LOWER(nome) LIKE '%falso feijão%'
    OR LOWER(nome) LIKE '%creme de frango%'
    OR LOWER(nome) LIKE '%misto quente%'
    OR LOWER(nome) LIKE '%molho de tomate%'
    OR LOWER(nome) LIKE '%brócolis%'
    OR LOWER(nome) LIKE '%brocolis%'
    OR LOWER(nome) LIKE '%cenoura%'
    OR LOWER(nome) LIKE '%vagem%'
    OR LOWER(nome) LIKE '%lentilha%'
    OR LOWER(nome) LIKE '%macarrão de sopa%'
    OR LOWER(nome) LIKE '%macarrao de sopa%');

-- BEBIDAS (leite, café, chá, vitamina, achocolatado, iogurte)
UPDATE "Preparacao" SET categoria = 'BEBIDA'
WHERE categoria = 'PREPARACAO'
  AND (LOWER(nome) LIKE '%leite%'
    OR LOWER(nome) LIKE '%café%'
    OR LOWER(nome) LIKE '%cafe%'
    OR LOWER(nome) LIKE '%vitamina%'
    OR LOWER(nome) LIKE '%chá%'
    OR LOWER(nome) LIKE '%cha %'
    OR LOWER(nome) LIKE '%achocolatado%'
    OR LOWER(nome) LIKE '%água%'
    OR LOWER(nome) LIKE '%agua%'
    OR LOWER(nome) LIKE '%iogurte%'
    OR LOWER(nome) LIKE '%mingau%'
    OR LOWER(nome) LIKE '%chá mate%'
    OR LOWER(nome) LIKE '%cha mate%'
    OR LOWER(nome) LIKE '%creme de chocolate%');

-- SUCOS
UPDATE "Preparacao" SET categoria = 'SUCO'
WHERE categoria = 'PREPARACAO'
  AND LOWER(nome) LIKE '%suco%';

-- PÃES
UPDATE "Preparacao" SET categoria = 'PAO'
WHERE categoria = 'PREPARACAO'
  AND (LOWER(nome) LIKE '%pão%'
    OR LOWER(nome) LIKE '%pao %'
    OR LOWER(nome) LIKE '%pãozinho%'
    OR LOWER(nome) LIKE '%paozinho%'
    OR LOWER(nome) LIKE '%pão francês%'
    OR LOWER(nome) LIKE '%pao frances%'
    OR LOWER(nome) LIKE '%pão de forma%'
    OR LOWER(nome) LIKE '%pao de forma%'
    OR LOWER(nome) LIKE '%pão qc%'
    OR LOWER(nome) LIKE '%pao qc%'
    OR LOWER(nome) LIKE '%pão cq%'
    OR LOWER(nome) LIKE '%pao cq%'
    OR LOWER(nome) LIKE '%pão com%'
    OR LOWER(nome) LIKE '%pao com%'
    OR LOWER(nome) LIKE '%pão com doce%'
    OR LOWER(nome) LIKE '%pao com doce%'
    OR LOWER(nome) LIKE '%pão com manteiga%'
    OR LOWER(nome) LIKE '%pao com manteiga%'
    OR LOWER(nome) LIKE '%pão com nata%'
    OR LOWER(nome) LIKE '%pao com nata%'
    OR LOWER(nome) LIKE '%pão com requeijão%'
    OR LOWER(nome) LIKE '%pao com requeijao%');

-- LANCHES ESPECIAIS (rosca, brioche, croissant)
UPDATE "Preparacao" SET categoria = 'LANCHE'
WHERE categoria = 'PREPARACAO'
  AND (LOWER(nome) LIKE '%rosca%'
    OR LOWER(nome) LIKE '%pão doce%'
    OR LOWER(nome) LIKE '%pao doce%'
    OR LOWER(nome) LIKE '%brioche%'
    OR LOWER(nome) LIKE '%croissant%'
    OR LOWER(nome) LIKE '%pão de leite%'
    OR LOWER(nome) LIKE '%pao de leite%'
    OR LOWER(nome) LIKE '%pão de batata%'
    OR LOWER(nome) LIKE '%pao de batata%'
    OR LOWER(nome) LIKE '%bisnaguinha%'
    OR LOWER(nome) LIKE '%bisnaguinha%');

-- CUSCUZ
UPDATE "Preparacao" SET categoria = 'CUSCUZ'
WHERE categoria = 'PREPARACAO'
  AND (LOWER(nome) LIKE '%cuscuz%'
    OR LOWER(nome) LIKE '%cuscu%');

-- DOCES (canjica, curau, pamonha, bolo doce, pudim, doce)
UPDATE "Preparacao" SET categoria = 'DOCE'
WHERE categoria = 'PREPARACAO'
  AND (LOWER(nome) LIKE '%canjica%'
    OR LOWER(nome) LIKE '%curau%'
    OR LOWER(nome) LIKE '%creme de milho%'
    OR LOWER(nome) LIKE '%pamonha%'
    OR LOWER(nome) LIKE '%bolo de%'
    OR LOWER(nome) LIKE '%bolo %'
    OR LOWER(nome) LIKE '%pudim%'
    OR LOWER(nome) LIKE '%mousse%'
    OR LOWER(nome) LIKE '%musse%'
    OR LOWER(nome) LIKE '%gelatina%'
    OR LOWER(nome) LIKE '%doce de%'
    OR LOWER(nome) LIKE '%goiabada%'
    OR LOWER(nome) LIKE '%doce de leite%'
    OR LOWER(nome) LIKE '%merengue%'
    OR LOWER(nome) LIKE '%brigadeiro%'
    OR LOWER(nome) LIKE '%paçoca%'
    OR LOWER(nome) LIKE '%pacoca%'
    OR LOWER(nome) LIKE '%pipoca doce%'
    OR LOWER(nome) LIKE '%rapadura%'
    OR LOWER(nome) LIKE '%creme de chocolate%');

-- FRUTAS
UPDATE "Preparacao" SET categoria = 'FRUTA'
WHERE categoria = 'PREPARACAO'
  AND (LOWER(nome) LIKE '%banana%'
    OR LOWER(nome) LIKE '%maçã%'
    OR LOWER(nome) LIKE '%mamão%'
    OR LOWER(nome) LIKE '%mamao%'
    OR LOWER(nome) LIKE '%laranja%'
    OR LOWER(nome) LIKE '%abacaxi%'
    OR LOWER(nome) LIKE '%melancia%'
    OR LOWER(nome) LIKE '%melão%'
    OR LOWER(nome) LIKE '%melao%'
    OR LOWER(nome) LIKE '%manga%'
    OR LOWER(nome) LIKE '%uva%'
    OR LOWER(nome) LIKE '%pera%'
    OR LOWER(nome) LIKE '%pêssego%'
    OR LOWER(nome) LIKE '%pessego%'
    OR LOWER(nome) LIKE '%goiaba%'
    OR LOWER(nome) LIKE '%acerola%'
    OR LOWER(nome) LIKE '%caju%'
    OR LOWER(nome) LIKE '%cajá%'
    OR LOWER(nome) LIKE '%caja%'
    OR LOWER(nome) LIKE '%maracujá%'
    OR LOWER(nome) LIKE '%maracuja%'
    OR LOWER(nome) LIKE '%salada de fruta%'
    OR LOWER(nome) LIKE '%sorvete%'
    OR LOWER(nome) LIKE '%frozen de%'
    OR LOWER(nome) LIKE '%poncã%'
    OR LOWER(nome) LIKE '%poncan%'
    OR LOWER(nome) LIKE '%mexerica%'
    OR LOWER(nome) LIKE '%caqui%'
    OR LOWER(nome) LIKE '%seriguela%'
    OR LOWER(nome) LIKE '%pitaya%');

COMMIT;

-- ============================================================
-- RELATÓRIO: contagem por categoria após atualização
-- ============================================================
SELECT categoria, COUNT(*) as total
FROM "Preparacao"
GROUP BY categoria
ORDER BY total DESC;

-- ============================================================
-- LISTA: preparações que continuam como 'PREPARACAO' (sem categoria)
-- ============================================================
-- SELECT id, nome, categoria FROM "Preparacao" WHERE categoria = 'PREPARACAO' ORDER BY nome;
