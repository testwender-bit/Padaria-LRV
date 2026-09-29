# Patch v9.9.8 — Nutrição > Cardápios: "Replicar p/ Escolas" disponível para TODOS os cardápios

## 📦 Conteúdo do patch

| Arquivo | Mudança |
|---|---|
| `src/app/(app)/nutricao/cardapios/[id]/page.tsx` | Editor: botão Replicar sem restrição a base |
| `src/app/(app)/nutricao/cardapios/page.tsx` | Lista de cardápios: botão Replicar sem restrição a base |

Sem mudança de schema (não precisa `prisma db push`). Sem mudança de API.

## 🎯 O que mudou

Você notou que a ferramenta **"Replicar p/ Escolas"** (replicar o cardápio e suas semanas para
outras escolas, escolhendo o **dia de pão e o dia de lanche** de cada uma) só aparecia para os
**cardápios base** — o botão estava escondido nos cardápios de escola.

### Investigação (boa notícia)
- A **API** `POST /api/nutricao/cardapios/[id]/replicar` **já suportava origem-escola desde a v8.10**:
  - Exclui automaticamente a **escola de origem** da lista de destinos (não replica para ela mesma);
  - **Preserva o vínculo** `cardapio_base_id` original nas cópias;
  - Realoca pão/lanche pelo **deslocamento para o dia útil mais próximo** (não é swap cego);
  - Opções "expandir para semestre (22 semanas)" e "manter pão/lanche" (v8.16) intactas.
- A **página** de replicar também já estava pronta: mostra banner azul informativo quando o cardápio
  origem é de escola, valida dia de pão/lanche por escola e lista escolas candidatas da mesma categoria.
- **O único bloqueio eram os dois botões** no front (condições `!cardapio.escola_id` no editor e
  `c.is_base` na lista). Este patch apenas os libera.

### O que NÃO mudou
- "Comparar c/ Base" continua **somente** para instâncias de escola (faz sentido só nelas);
- "Clonar em Lote" continua somente para base;
- Nenhuma regra de negócio, cálculo, PCQ, produção ou romaneio foi tocada.

## 🚀 Como aplicar no Codespace

```bash
# 1. Extraia o zip na RAIZ do projeto (mesmo nível de package.json):
unzip -o patch-v9.9.8-replicar-todos-cardapios.zip

# 2. Não há migração de banco nem rota nova. Confira:
git status

# 3. Validação local (opcional, recomendado):
npx tsc --noEmit
npm run build
```

## ✅ Roteiro de teste

1. Vá em **Nutrição > Cardápios** e abra um **cardápio de escola** (instância).
2. Na barra superior do editor, confirme que agora aparece o botão roxo **"Replicar p/ Escolas"**
   (antes só aparecia em cardápios base).
3. Clique nele → a página de replicar mostra o **banner azul** "Replicando a partir de um cardápio
   de escola" com o nome da escola de origem.
4. Selecione outras escolas, defina **dia de pão** e **dia de lanche** de cada uma, escolha
   expandir (22 semanas) ou não, e replique.
5. Confirme que a **escola de origem não aparece** na lista de destinos.
6. Volte à **lista de cardápios** → o botão "Replicar p/ Escolas" agora aparece em TODAS as linhas
   (base e escola).
7. Em um cardápio base, confirme que "Comparar c/ Base" continua sumido e em instância continua lá.
