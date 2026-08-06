# Fix v9.6.6 — PCQ do romaneio na produção respeita ordem_pcq + remove Busca Própria

## O que estava acontecendo

1. **PCQ não respeitava `ordem_pcq` na impressão da produção**: quando a
   produção é impressa, ela inclui o romaneio por motorista (PF + PCQ +
   Lanche). A tabela de PCQ dentro do romaneio usava a ordem padrão
   (ordem_rota), não a ordem_pcq específica.

2. **Página "ROTA BUSCA PRÓPRIA" era impressa**: escolas com rota
   BUSCA_PROPRIA (que retiram no balcão, sem motorista) tinham uma
   página de romaneio impressa — desnecessário.

## O que foi corrigido

### 1. PCQ do romaneio respeita `ordem_pcq`

Na página de produção, a tabela de PCQ dentro de cada romaneio de
motorista agora faz `.sort()` por `ordem_pcq` antes de renderizar:

```tsx
{romaneio.escolas.filter((e) => e.total_pcq > 0).sort((a, b) => {
  const oa = (a as any).ordem_pcq ?? 0
  const ob = (b as any).ordem_pcq ?? 0
  if (oa !== ob) return oa - ob
  return (a.nome_curto || '').localeCompare(b.nome_curto || '')
}).map((escola) => ...)}
```

A API de romaneio já passa `ordem_pcq` (corrigido no v9.6.5), então
o campo está disponível. Agora a tabela de PCQ no romaneio segue a
mesma ordem que a tabela de PCQ na produção.

### 2. Página "BUSCA PRÓPRIA" removida da impressão

O `romaneios.map()` agora filtra a rota BUSCA_PROPRIA antes de iterar:

```tsx
{romaneios.filter((r) => r.rota !== 'BUSCA_PROPRIA').map((romaneio) => ...)}
```

Resultado: apenas os romaneios de **Motorista José** e **Motorista Aroldo**
são impressos. As escolas de Busca Própria continuam aparecendo na tabela
de Produção (PF, PCQ, Lanche) normalmente — apenas o romaneio separado
delas não é impresso.

## Arquivos incluídos

```
src/app/(app)/producao/page.tsx       # PCQ do romaneio ordena por ordem_pcq + filtra BUSCA_PROPRIA
src/app/api/romaneio/route.ts         # passa ordem_pcq (do v9.6.5 — incluído para garantir)
src/lib/romaneio-utils.ts             # EscolaRomaneio.ordem_pcq (do v9.6.5 — incluído para garantir)
```

## Como aplicar

```bash
git checkout -b fix/prod-pcq-busca

unzip -o prod-pcq-busca-v966.zip -d .

git add -A
git commit -m "fix(v9.6.6): PCQ do romaneio respeita ordem_pcq + remove página Busca Própria"
git push -u origin fix/prod-pcq-busca
```

Sem migração de banco — todos os campos já existem.

## Verificação

1. Acesse **Produção** e clique em **Imprimir** (Ctrl+P).
2. Na seção de **romaneio por motorista**, a tabela de PCQ deve seguir
   a ordem `ordem_pcq` (mesma ordem da tabela de PCQ na produção).
3. **Não deve aparecer** nenhuma página com "ROTA BUSCA PRÓPRIA" —
   apenas Motorista José e Motorista Aroldo.
4. As escolas de Busca Própria continuam aparecendo nas tabelas de
   Produção (PF, PCQ, Lanche) — apenas o romaneio separado delas foi
   removido.
