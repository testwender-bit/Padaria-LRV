# Fix v9.6.4 — Override manual de alérgenos + corrige falso positivo de cuscuz

## O que mudou

1. **Corrigido falso positivo**: "Flocos de milho (cuscuz)" não é mais
   marcado como Trigo/Glúten
2. **Override manual**: agora você pode marcar/desmarcar alérgenos
   manualmente em cada preparação, quando a detecção automática erra

## Bug 1: Cuscuz marcado como Trigo (falso positivo)

### Causa

A lista `PADROES_TRIGO` em `alergenos-utils.ts` continha `'cuscuz'` e
`'cuscuz paulista'`. Como a detecção usa `nome.includes(palavra)`, qualquer
ingrediente com "cuscuz" no nome (ex.: "Flocos de milho (cuscuz)") era
marcado como Trigo.

Mas **cuscuz de milho NÃO tem trigo/glúten** — é feito de flocos de milho.
O cuscuz paulista pode levar farinha de milho com trigo, mas a detecção
automática gera mais falsos positivos do que verdadeiros.

### Fix

Removidos `'cuscuz'`, `'cuscuz paulista'` e `'cuscoz'` (typo) da lista de
padrões de Trigo. Agora o cuscuz não é mais detectado automaticamente como
Trigo — se uma preparação de cuscuz realmente tiver trigo (ex.: cuscuz
paulista com farinha mista), o nutricionista pode marcar manualmente.

## Bug 2: Override manual de alérgenos

### Novos campos no schema

Adicionados ao model `Preparacao`:

```prisma
alergenos_bloqueados  String  @default("[]")  // JSON: siglas REMOVIDAS da detecção
alergenos_forcados    String  @default("[]")  // JSON: siglas ADICIONADAS à detecção
```

### Nova função

`detectarAlergenosPreparacaoComOverride(ingredientes, bloqueados, forcados)`:

```
Resultado = (detecção automática ∪ alergenos_forcados) − alergenos_bloqueados
```

- **alergenos_bloqueados**: siglas que o usuário DESMARCOU (removidas da
  detecção automática — ex.: desmarcar "T" de um cuscuz de milho que foi
  falsamente detectado).
- **alergenos_forcados**: siglas que o usuário MARCOU manualmente
  (adicionadas além da detecção automática — ex.: um ingrediente que a
  detecção não pegou mas que o nutricionista sabe conter alérgeno).

### UI na página de Preparações

Ao criar/editar uma preparação, agora há uma seção **"Identificação de
Alérgenos"** no rodapé do formulário com:

- **Badges dos alérgenos atuais** (resultado final após override)
- **Coluna "Desmarcar"** (amarela): lista os alérgenos detectados
  automaticamente com checkbox. Marcar = remover da lista (bloquear).
- **Coluna "Marcar manualmente"** (azul): lista os 4 alérgenos com
  checkbox. Marcar = adicionar à lista (forçar).

A detecção é **ao vivo** — conforme você adiciona/remove ingredientes,
os alérgenos detectados se atualizam, e os overrides (bloqueados/forçados)
são preservados.

### Propagação

A função `detectarAlergenosPreparacaoComOverride` agora é usada em:
- **API `/api/nutricao/preparacoes`** (GET — filtro por alérgenos)
- **Página de Cardápio** (filtro "sem alérgenos" ao adicionar preparação)
- **Página de Cardápio** (badges exibidos na lista de preparações)
- **PDF do Cardápio** (badges no documento impresso)

A função `detectarAlergenosPreparacao` original foi mantida para
compatibilidade, mas as chamadas acima agora usam a versão com override.

## Como usar

### Aplicar o patch

```bash
# Cria branch para teste
git checkout -b fix/alergenos-manual-v9.6.4

# Extrai o patch
unzip -o alergenos-manual-v964.zip -d .

# Adiciona APENAS os campos ao schema (preserva Postgres)
bash add-alergenos-manual.sh

# Gera o Prisma Client (IMPORTANTE!)
npx prisma generate

# Cria as colunas no banco
npx prisma db push

# Commit e push
git add -A
git commit -m "feat(v9.6.4): override manual de alergenos + corrige falso positivo de cuscuz"
git push -u origin fix/alergenos-manual-v9.6.4
```

### Desmarcar um alérgeno incorreto

1. Acesse **Nutrição → Preparações**.
2. Edite a preparação que tem o alérgeno errado (ex.: cuscuz marcado
   como Trigo).
3. Role até a seção **"Identificação de Alérgenos"**.
4. Na coluna **"Desmarcar"**, marque o checkbox do alérgeno que foi
   detectado incorretamente (ex.: "T — Trigo / Glúten").
   - O nome fica com **tachado** e o badge some da lista "Alérgenos atuais".
5. Salve.
6. Agora essa preparação não mostra mais o alérgeno T em nenhum lugar
   (cardápio, PDF, filtro).

### Marcar um alérgeno manualmente

1. Edite a preparação.
2. Na coluna **"Marcar manualmente"**, marque o checkbox do alérgeno
   que você sabe estar presente mas não foi detectado automaticamente.
3. Salve.
4. O alérgeno aparece em todos os lugares (cardápio, PDF, filtro).

## Arquivos incluídos

```
add-alergenos-manual.sh                                         # script que adiciona os campos (preserva Postgres)
src/lib/alergenos-utils.ts                                      # remove cuscuz + nova função detectarAlergenosPreparacaoComOverride
src/app/api/nutricao/preparacoes/route.ts                       # GET usa override no filtro
src/app/api/nutricao/preparacoes/[id]/route.ts                  # PUT aceita alergenos_bloqueados/forcados
src/app/(app)/nutricao/preparacoes/page.tsx                     # UI de override no formulário
src/app/(app)/nutricao/cardapios/[id]/page.tsx                  # usa override no filtro e badges
src/app/(app)/nutricao/cardapios/[id]/pdf/page.tsx              # usa override nos badges do PDF
```

## Verificação

1. **Falso positivo corrigido**:
   - Edite uma preparação que tem "Flocos de milho (cuscuz)" como
     ingrediente.
   - A seção "Alérgenos atuais" NÃO deve mostrar "T — Trigo / Glúten"
     (antes mostrava).

2. **Desmarcar alérgeno**:
   - Edite uma preparação que tem Leite detectado.
   - Marque o checkbox "L — Leite" na coluna "Desmarcar".
   - O badge "L" some da lista "Alérgenos atuais".
   - Salve.
   - No cardápio e no PDF, essa preparação não mostra mais o alérgeno L.

3. **Marcar alérgeno manualmente**:
   - Edite uma preparação sem alérgenos detectados.
   - Marque "S — Soja" na coluna "Marcar manualmente".
   - O badge "S" aparece na lista "Alérgenos atuais".
   - Salve.
   - No cardápio e no PDF, essa preparação mostra o alérgeno S.

## Notas

- Os overrides são **por preparação** (não por ingrediente).
- Os overrides são **persistidos no banco** — sobrevivem entre sessões.
- Se você mudar os ingredientes, a detecção automática recalcula, mas os
  overrides (bloqueados/forçados) são preservados.
- O botão "Renumerar" não afeta os alérgenos.
