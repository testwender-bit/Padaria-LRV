# Patch — Fix PCQQ + Produção Extra (Instituições Avulsas)

## 1. Fix erro de TypeScript

`produto: 'PCQQ'` → `produto: 'PCQ'` (typo do replace_all anterior).

## 2. Nova funcionalidade: Produção Extra

Permite adicionar instituições avulsas diretamente na produção semanal,
para situações extraordinárias (ex: pão para a Secretaria de Educação).

### Como usar:
1. Abra `/producao` → vista semanal
2. Clique em **"Inst. Extra"** (botão azul ao lado de Imprimir)
3. Preencha:
   - Nome da Instituição (ex: "Secretaria de Educação")
   - Produto (PF / PCQ / Lanche)
   - Dia de entrega (seg-sex)
   - Quantidade
   - Observação (opcional)
4. Clique "Adicionar"

A produção extra aparece:
- Na lista "Produções Extras" abaixo da tabela semanal (com botão de remover)
- É salva no banco vinculada à semana (ano + semana ISO)
- Cada semana tem suas próprias produções extras

### Nova API: `/api/producao/extra`
- `GET ?ano=2026&semana=30` → lista extras da semana
- `POST { nome_instituicao, produto, dia_semana, quantidade, observacao, ano, semana }`
- `DELETE ?id=xxx`

### Novo modelo no schema: `ProducaoExtra`
```prisma
model ProducaoExtra {
  id, ano, semana, nome_instituicao, produto, dia_semana, quantidade, observacao, criado_em
}
```

## Como aplicar

```bash
unzip patch-pcqq-fix-extra.zip -d .
npx prisma generate
npx prisma db push --accept-data-loss
git add -A
git commit -m "fix: PCQQ typo + feat: produção extra (instituições avulsas)"
git push
```

⚠️ Rode `npx prisma db push` para criar a tabela `ProducaoExtra`.
