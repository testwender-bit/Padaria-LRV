# Patch — Fix TypeScript + Clonar Lanche

## 1. Fix erro de TypeScript no dashboard

Erro: `'data' is possibly 'null'` na linha 152.
Fix: trocado `data.obs` por `data?.obs` (optional chaining).

## 2. Botão "Clonar" nos lanches da padaria

Adicionado botão roxo **"Clonar"** ao lado de "Distribuição" e "Editar".

### O que faz:
1. Cria um novo lanche com nome `"[nome original] (cópia)"`
2. Copia a unidade, status ativo e observação
3. Copia TODA a distribuição (quantidades por escola por dia)
4. Toast de sucesso confirando

### Como usar:
1. Vá em `/lanches`
2. Configure um lanche com distribuição completa (quantidades por escola)
3. Clique em **"Clonar"**
4. Um novo lanche é criado com `(cópia)` no nome e TODAS as distribuições copiadas
5. Clique em "Editar" e mude o nome para o lanche novo
6. Pronto — mesmo padrão de distribuição, só com nome diferente

## Como aplicar

```bash
unzip patch-fix-aviso-clone.zip -d .
git add -A
git commit -m "fix: TypeScript dashboard + botão clonar lanche"
git push
```
