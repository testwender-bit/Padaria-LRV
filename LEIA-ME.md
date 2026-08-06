# Fix v9.6.3 — Ordenação específica para PCQ (Pão de Cachorro Quente)

## O que mudou

Adicionei um campo **`ordem_pcq`** separado de `ordem_rota` para permitir
que você defina uma ordem **específica** para o PCQ na produção e nos
documentos impressos — independente da ordem do Pão Francês.

### Antes

- Tudo (PF, PCQ, Lanche) usava `ordem_rota` para ordenação
- Não era possível ter uma ordem diferente só para PCQ

### Depois

- **PF** continua usando `ordem_rota` (inalterado)
- **PCQ** agora usa `ordem_pcq` (campo novo, separado)
- **Lanche** continua usando `ordem_rota` (inalterado)

## Como usar

### 1. Aplicar o patch

```bash
# Na RAIZ do projeto:
unzip -o patch-ordem-pcq-v9.6.3.zip -d .

# Adicionar o campo ordem_pcq ao schema (preserva Postgres):
bash add-ordem-pcq.sh

# Criar a coluna no banco:
npx prisma db push

# Commit e push:
git add -A
git commit -m "feat(v9.6.3): ordem específica para PCQ na produção"
git push
```

### 2. Configurar a ordem PCQ por escola

1. Acesse **Configurações → Escolas**.
2. Edite uma escola.
3. No formulário, agora há **dois campos de ordem**:
   - **Ordem na Rota** (para Pão Francês) — como antes
   - **Ordem PCQ** (para Pão de Cachorro Quente) — **NOVO**
4. Defina o número de ordem PCQ para cada escola.
5. Salve.

### 3. Ver na produção

1. Acesse **Produção** (visão semana).
2. Na tabela de **PCQ — PÃO DE CACHORRO QUENTE**, as escolas agora
   aparecem na ordem definida por `ordem_pcq`.
3. A tabela de **PÃO FRANCÊS** continua usando `ordem_rota` (inalterada).
4. Na **impressão** (Ctrl+P), o documento de PCQ também segue `ordem_pcq`.

## Detalhes técnicos

### Novo campo no schema

```prisma
model Escola {
  ...
  ordem_rota    Int      @default(0)   // ordenação do PF
  ordem_pcq     Int      @default(0)   // v9.6.3: ordenação do PCQ
  ...
}
```

### Propagação na API de produção

A API `/api/producao` agora passa `ordem_pcq` em todos os 6 lugares onde
monta `ItemProducao`:

```ts
itensPfDomingo.push({
  ...
  ordem_rota: escola.ordem_rota ?? 0,
  ordem_pcq: escola.ordem_pcq ?? 0,  // v9.6.3
  ...
})
```

### Consolidação

A função `consolidarProducaoSemana` agora preenche `ordem_pcq` no
`EscolaConsolidada`:

```ts
ordem_pcq: typeof item.ordem_pcq === 'number' ? item.ordem_pcq : 0,
```

### Ordenação na página de produção

Nova função `sortEscolasPCQ` (separada de `sortEscolas`):

```ts
function sortEscolasPCQ(a, b) {
  const oa = a.ordem_pcq ?? 0
  const ob = b.ordem_pcq ?? 0
  if (oa !== ob) return oa - ob
  return (a.nome_curto || '').localeCompare(b.nome_curto || '')
}

const escolasPCQ = consolidado.escolas
  .filter(e => e.total_pcq > 0)
  .sort(sortEscolasPCQ)  // v9.6.3: usa ordem_pcq
```

### Configurações

- Interface `Escola` local agora tem `ordem_pcq: number`.
- Formulário de **Criar** e **Editar** escola tem o input "Ordem PCQ".
- Ao editar, o `ordem_pcq` da escola é carregado no formulário.
- O botão **Renumerar** (que só renumera `ordem_rota`) agora preserva
  o `ordem_pcq` existente de cada escola.

## Arquivos incluídos

```
add-ordem-pcq.sh                                              # script que adiciona APENAS o campo (preserva Postgres)
src/lib/producao-utils.ts                                     # ItemProducao.ordem_pcq
src/lib/producao-semana-utils.ts                              # EscolaConsolidada.ordem_pcq + preenche
src/app/api/escolas/route.ts                                  # POST/PUT aceitam ordem_pcq
src/app/api/producao/route.ts                                 # 6× ordem_pcq: escola.ordem_pcq
src/app/(app)/configuracoes/page.tsx                          # input "Ordem PCQ" + carrega/preserva
src/app/(app)/producao/page.tsx                               # sortEscolasPCQ + escolasPCQ usa
```

## Verificação

1. **Configurações → Escolas** → editar uma escola → deve aparecer o
   campo **"Ordem PCQ (pão de cachorro quente)"** abaixo de "Ordem na Rota".
2. Defina ordens PCQ diferentes para algumas escolas (ex.: escola A = 1,
   escola B = 2, escola C = 3).
3. Salve.
4. **Produção → PCQ**: as escolas devem aparecer na ordem definida por
   `ordem_pcq` — NÃO necessariamente a mesma ordem do PF.
5. **Imprimir (Ctrl+P)**: o documento de PCQ segue a mesma ordem `ordem_pcq`.
6. **PF** continua na ordem `ordem_rota` (inalterada).

## Notas

- Se `ordem_pcq` for 0 para todas as escolas, a ordenação cai no
  desempate alfabético por `nome_curto` (mesmo comportamento do PF
  quando todas têm `ordem_rota = 0`).
- O **Lanche** continua usando `ordem_rota` — se no futuro precisar de
  ordem específica para Lanche também, o mesmo padrão pode ser aplicado.
- O **Romaneio** não foi alterado — continua agrupado por motorista e
  ordenado por `ordem_rota` dentro de cada motorista.
