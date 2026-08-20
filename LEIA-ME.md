# Patch v9.7.5 — Aviso da Semana editável + Alerta de Feriados + Bugfix

## ⚠️ Antes de aplicar

1. Faça commit do estado atual: `git add -A && git commit -m "checkpoint pré-v9.7.5"`
2. Crie branch: `git checkout -b fix/v9.7.5-aviso-feriados-bugfix`
3. **NÃO precisa rodar `prisma db push`** (não há mudança no schema).
4. **NÃO precisa rodar seed** (não há mudança em dados).

## 📋 O que mudou (3 alterações)

### 1. ✏️ Edição do "Aviso da Semana" direto na página de Produção

**Antes**: o aviso só podia ser editado em `/cardapio` (Cardápio Semestral). Aparecia como banner somente-leitura em `/producao` e `/dashboard`.

**Agora**: o banner de aviso na página de Produção tem um botão **Editar** (ícone lápis). Clica → abre um diálogo com textarea → salva → atualiza imediatamente. Não precisa mais ir até `/cardapio` para mexer no aviso.

- Se a semana não tem cardápio cadastrado, mostra erro explicando.
- Deixar vazio remove o banner (salva `null`).
- O diálogo também mostra os feriados da semana como referência.

### 2. 🚨 Alerta de feriados da semana junto ao aviso

**Antes**: o sistema já sabia dos feriados (zerava células automaticamente), mas não exibia um aviso visual consolidado.

**Agora**: sempre que há feriado na semana (seg-sex + domingo de produção D-1), aparece um bloco vermelho junto ao "Aviso da Semana" em:
- **Dashboard** — banner com lista de feriados (data + nome + ação)
- **Produção** — mesmo banner, dentro do bloco amarelo do aviso

Exemplo de exibição:
```
⚠️ Aviso da Semana 12
   Semana com feriado na quinta — produção reduzida.

🚨 2 feriados na semana:
   15/05  Independência do Brasil  (zerar tudo)
   18/05  Feriado Municipal         (sem PF)
```

### 3. 🐛 Bugfix: ajuste de quinta "vazava" para sexta na tabela de PF

**Sintoma relatado**: ao ajustar a produção de quinta-feira no quadro de Pão Francês, a célula de quinta ficava destacada (amarelo) E a de sexta também — mas sexta não tem produção de PF.

**Causa raiz** (encontrada e corrigida):
- PF é produzido D-1 (domingo produz para segunda, segunda para terça, ..., quinta para sexta).
- Ao clicar em quinta, o sistema salva o ajuste com `dia_semana = 'sexta'` (dia de entrega).
- Na renderização da coluna sexta, a função `entregaFromProducao('sexta', 'PF')` retornava `'sexta'` como fallback (porque `sexta` não está no mapa `PF_PRODUCAO_PARA_ENTREGA` — PF não é produzido na sexta).
- Aí ele procurava `${escolaId}_sexta_PF` no mapa de ajustes — e encontrava o ajuste salvo na quinta!

**Correção**: adicionada função `ehDiaProducaoDoProduto(dia, produto)` em `producao-utils.ts`. Agora:
- A função `getAjusteInfo` retorna `undefined` para dias que não são de produção daquele produto.
- As células de dias inválidos aparecem como `—` em cinza claro e **não são clicáveis**.

**Resultado visual na tabela de PF**:
| Escola | Dom | Seg | Ter | Qua | Qui | Sex | Total |
|---|---|---|---|---|---|---|---|
| Escola A | 100 | 100 | 100 | 100 | 100● | — | 500 |

Para PCQ (só seg/qua/sex) e Lanche (só seg-sex, sem domingo), mesmo tratamento.

## 📦 Arquivos incluídos no patch

| Arquivo | Mudança |
|---|---|
| `src/lib/producao-utils.ts` | + `DIAS_PRODUCAO_POR_PRODUTO` (mapa) e `ehDiaProducaoDoProduto()` (helper) |
| `src/app/api/producao/route.ts` | + retorna `cardapio_id`, `feriados_semana` na resposta |
| `src/app/api/cardapio/route.ts` | + método `PATCH` para atualizar apenas `obs` |
| `src/app/(app)/producao/page.tsx` | + banner com edição inline + alerta de feriados + bugfix das células |
| `src/app/(app)/dashboard/page.tsx` | + alerta de feriados da semana no banner do aviso |

**5 arquivos modificados. Nenhum arquivo novo. Nenhuma mudança no banco de dados.**

## 🚀 Como aplicar

### Opção A: aplicar via zip (recomendado)

No Codespace, na raiz do projeto:

```bash
# 1. Backup de segurança (opcional, mas recomendado)
git stash || true

# 2. Extrair o zip sobre o projeto
unzip -o patch-v9.7.5-aviso-feriados-bugfix.zip -d .

# 3. Verificar que os 5 arquivos foram atualizados
git status
# Você deve ver:
#   modified:   src/app/(app)/dashboard/page.tsx
#   modified:   src/app/(app)/producao/page.tsx
#   modified:   src/app/api/cardapio/route.ts
#   modified:   src/app/api/producao/route.ts
#   modified:   src/lib/producao-utils.ts

# 4. Testar build
npm run build
# Deve compilar sem erros

# 5. Rodar dev server e testar manualmente
npm run dev
```

### Opção B: aplicar manualmente

Se preferir, copie os 5 arquivos da pasta do patch para os mesmos caminhos no projeto.

## 🧪 Como testar (smoke test)

Após aplicar, faça estes testes no navegador:

### Teste 1 — Edição do aviso na Produção
1. Vá em **Produção** (semana atual).
2. Se houver aviso da semana, deve aparecer o botão **Editar** (lápis) no canto direito do banner.
3. Clique → abre diálogo com textarea preenchido com o aviso atual.
4. Edite → clique em **Salvar Aviso** → deve aparecer toast "Aviso da semana atualizado!".
5. O banner deve refletir o novo texto imediatamente.
6. Vá no Dashboard — deve mostrar o mesmo aviso atualizado.

### Teste 2 — Alerta de feriados
1. Verifique se há feriados cadastrados para a semana atual em **Feriados**.
2. Se houver, o banner no Dashboard e na Produção deve mostrar a seção "Feriados na semana:" com a lista.
3. Se não houver feriados na semana, a seção não deve aparecer.

### Teste 3 — Bugfix do ajuste
1. Vá em **Produção** → view Semanal → tabela Pão Francês.
2. A coluna **Sex** deve aparecer como `—` (cinza claro) e **não ser clicável**.
3. A coluna **Dom** deve ser clicável (é dia de produção de PF para segunda).
4. Clique em uma célula de quinta → ajuste a quantidade → salve.
5. **Apenas** a célula de quinta deve ficar amarela com ● — a de sexta não.
6. Na tabela de **PCQ**, apenas Seg/Qua/Sex devem ser clicáveis. Demais colunas como `—`.
7. Na tabela de **Lanche**, apenas Seg-Sex devem ser clicáveis. Dom como `—`.

## 🔄 Como reverter

Se algo quebrar:

```bash
git checkout -- src/app/\(app\)/dashboard/page.tsx \
                 src/app/\(app\)/producao/page.tsx \
                 src/app/api/cardapio/route.ts \
                 src/app/api/producao/route.ts \
                 src/lib/producao-utils.ts
```

## 📝 Notas técnicas

- **Compatibilidade**: 100% compatível com o estado atual do banco. Não requer migração.
- **API PATCH /api/cardapio**: aceita `{ ano, semana, obs? }` e atualiza apenas os campos fornecidos. Retorna 404 se o cardápio da semana não existir, 400 se faltar campo obrigatório.
- **API GET /api/producao**: agora retorna 2 campos extras na resposta: `cardapio_id` (string|null) e `feriados_semana` (array). O front antigo ignora esses campos sem quebrar.
- **A função `ehDiaProducaoDoProduto`** é exportada de `producao-utils.ts` e pode ser reusada em outras views (ex: romaneio, se desejar no futuro).
