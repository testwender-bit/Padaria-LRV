# Patch v9.10.17 — Pacote de UX dos Cardápios: filtro por ANO (2026/2027), "Mover várias", Ajuda com manual visual, botões limpos e cópia 1→N

> **Arquivo:** `patch-v9.10.17.zip` · **Requisito:** aplicar por cima da
> **v9.10.16** · ✅ **SEM mudança de schema** — não precisa `prisma db push`.
> **Sem API nova e sem API alterada** — tudo aproveita rotinas que já existiam
> (`item`, `mover-item`, `copiar-dia`).

**O pedido:** a lista de cardápios misturava 2026 com 2027 e ficou bagunçada;
os atalhos de copiar/trocar na edição estavam "um pouco engessados"; o botão
de Repetições ocupava espaço no topo; o "Comparar c/ Base" e o "Salvar" do
topo não serviam para nada ali; a busca de preparações podia ser mais ágil;
e faltava um manual de como usar a tela.

**As 7 mudanças (2 arquivos novos + 2 páginas):**

1. **Filtro por ano na lista** (`nutricao/cardapios`) — abas
   **Todos · 2026 · 2027** com contagem. A aba do **ano corrente é sempre a
   inicial** e "acompanha o ano": hoje abre em 2026; quando virar 2027, a
   aba 2027 passa a ser a main automaticamente, sem ninguém mexer em nada.
   Se o ano aberto estiver vazio, aparece o atalho "Ver todos os anos".
2. **Modo "Mover várias" no editor** (botão verde na barra da semana) —
   clique em quantas preparações quiser (ficam com anel verde), depois no
   **cabeçalho do dia de destino** (barra azul): todas movem de uma vez, cada
   uma mantendo a sua refeição. Se a preparação já existir na refeição de
   destino, as porções são **somadas** (mesclada), como no arrastar. ESC ou
   ✕ cancela. Banner mostra o estado: quantas marcadas, esperando o destino.
3. **Dialog "Copiar Refeições" mais flexível** — além do mapeamento
   antigo (N dias origem → N dias destino, 1º→1º), agora **1 dia de origem
   pode ser copiado para TODOS os destinos marcados** (ex.: copiar a
   segunda para ter, qua e qui de uma vez). Botão novo **"Semana inteira"**
   marca os 5 dias nas duas pontas (se a semana destino for a mesma, usa a
   seguinte sozinho). O preview "Mapeamento" mostra as linhas origem →
   destino do modo que estiver ativo.
4. **Busca de preparações ágil** — no dialog de adicionar/editar preparações
   da refeição: digitou "pão", escolheu → **a busca limpa e o cursor volta
   automaticamente** para o campo, pronto para digitar o próximo
   (desmarcar não limpa, para não perder o filtro).
5. **Botões do topo do editor arrumados** — o **"Repetições"** foi para
   **junto do Resumo Nutricional** (botão pequeno no cabeçalho do resumo,
   mesmo visual indigo — análise completa continua idêntica). O
   **"Comparar c/ Base" saiu do editor** (a comparação continua na lista de
   cardápios → página Comparar). O **"Salvar" foi removido**: ele só
   reenviava a fase escolar que a própria janela de fase já salva — toda
   ação da tela salva na hora, não existe estado pendente. No lugar entra o
   botão **"Ajuda"**.
6. **Manual de Ajuda (botão "?" no topo do editor)** — popup visual com 6
   cards (Montar a refeição · Organizar · Trocar de lugar · Semanas ·
   Conferir a qualidade · Configurar), pouco texto e ícones, cobrindo
   adicionar, arrastar, Alt+arrastar, ↑↓, ⇄, 📅⇄, Mover várias, Copiar,
   Gerar Ciclo, Localizar/Substituir, resumo/semáforo/PNAE, fase escolar,
   horários clicáveis e mais — incluindo a explicação de por que **não
   existe botão Salvar** nesta tela.
7. **Regressão sincronizada** — Modo Troca (⇄) e Modo Trocar Dia (📅⇄)
   continuam funcionando exatamente como antes; agora dividem a tela com o
   modo mover (ativar um desliga o outro; ESC cancela os três).

**Arquivos:** `src/lib/cardapio-ux-utils.ts` (NOVO — abas de ano,
mapeamento de cópia e lote de movimento, 100% testados),
`src/components/ajuda-cardapio-dialog.tsx` (NOVO — manual visual),
`src/app/(app)/nutricao/cardapios/page.tsx` (filtro por ano),
`src/app/(app)/nutricao/cardapios/[id]/page.tsx` (editor: mover várias,
cópia 1→N, busca ágil, botões, ajuda).

**O que não muda:** schema do banco, todas as APIs (item, mover-item,
copiar-dia, trocar-itens, trocar-dia, localizar-substituir, horários…),
regras de feriado/PCQ/complemento da produção, romaneio, guia de separação,
PDF e listas de compras.

## Ordem de aplicação (GitHub Codespace)

Com o terminal aberto na pasta do projeto:

```bash
unzip -o patch-v9.10.17.zip
npm run build
npm run start
```

Confirmação rápida:
1. Em **Nutrição > Cardápios** aparecem as abas Todos/2026/2027 — a do ano
   atual vem aberta; clique em 2027 e veja só os cardápios de 2027.
2. Dentro de um cardápio, clique **"Mover várias"** (barra da semana),
   marque 2–3 preparações e clique no cabeçalho de outro dia — todas movem
   juntas, com toast de resumo.
3. Botão **"Ajuda"** no topo abre o manual em cards.
4. No dialog de preparações de uma refeição: busque "pão", escolha — a
   busca limpa e o cursor volta para o campo.
5. No topo do editor não existem mais "Comparar c/ Base" nem "Salvar";
   "Repetições" está no cabeçalho do Resumo Nutricional.

Para registrar no git:

```bash
git add . && git commit -m "v9.10.17" && git push
```
