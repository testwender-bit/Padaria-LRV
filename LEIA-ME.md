# Patch v9.2 — Lista de Compras Funcional

## O que foi implementado

### 1. Editar alunos por escola (BLOQUEADOR RESOLVIDO)

**Arquivo:** `src/app/(app)/configuracoes/page.tsx`

Adicionado bloco "Alunos (para Lista de Compras)" no diálogo de editar escola:
- **Alunos Parcial** (turno único) — campo numérico
- **Alunos Integral** (permanece o dia) — campo numérico
- **Segmento** — dropdown (Creche, Pré-Escola, Fundamental Inicial/Final, Regular, Integral)
- **Mescla parcial + integral** — checkbox (comem juntos na refeição principal)
- Badge informativo com total de alunos e indicação de mescla

**Como usar:**
1. Vá em `/configuracoes` → aba "Escolas"
2. Clique no ícone de editar (lápis) numa escola
3. Preencha os campos de alunos
4. Salvar

Agora o cálculo da lista de compras vai multiplicar percapita × alunos corretamente.

### 2. Snapshots salvos — listar e reabrir

**Arquivo:** `src/app/(app)/nutricao/lista-compras/page.tsx`

Antes: o endpoint `GET /api/nutricao/lista-compras-snapshots` existia mas não era consumido.

Agora:
- Lista snapshots salvos no rodapé da página (card "Snapshots Salvos")
- Cada snapshot mostra: nome, data de geração, status (GERADA/ENVIADA/RECEBIDA)
- Clique num snapshot → carrega os itens dele no resultado
- Botão "Salvar Snapshot" continua funcionando (salva novo)

### 3. Botão Imprimir / PDF

**Arquivo:** `src/app/(app)/nutricao/lista-compras/page.tsx`

Adicionado botão "Imprimir / PDF" ao lado dos botões CSV e Excel.
- Usa `window.print()` — abre o diálogo de impressão do navegador
- Usuário pode escolher "Salvar como PDF" no diálogo
- Imprime a lista de itens com a tabela visível

### 4. Filtrar cardápios por status APROVADO

**Arquivo:** `src/app/(app)/nutricao/lista-compras/page.tsx`

Antes: dropdown mostrava TODOS os cardápios (incluindo rascunhos e instâncias).

Agora:
- Por padrão: só mostra cardápios APROVADO + bases (sem escola)
- Checkbox "Mostrar rascunhos" para ver todos
- Rascunhos aparecem com marca "⚠️ Rascunho"

Isso evita gerar lista de compras de um cardápio ainda não aprovado.

## Como aplicar

```bash
unzip patch-lista-compras-v9.2.zip -d .
git add -A
git commit -m "feat(v9.2): lista de compras funcional — editar alunos + snapshots + PDF + filtro status"
git push
```

## Fluxo de uso completo

1. **Configurar alunos das escolas:**
   - `/configuracoes` → Escolas → Editar → preencher alunos parcial/integral + segmento + mescla
   - Fazer isso para TODAS as escolas ativas

2. **Gerar lista de compras:**
   - `/nutricao/lista-compras`
   - Selecionar cardápio (só APROVADO aparecem por padrão)
   - Selecionar semanas (1-5 ou ciclo base)
   - Selecionar escolas (ou "Todas")
   - Clicar "Gerar Lista"

3. **Exportar:**
   - **CSV** — para planilhas simples
   - **Excel (5 abas)** — para análise detalhada (Resumo, Itens, Por Escola, Escolas, Seção)
   - **Imprimir / PDF** — para imprimir ou salvar como PDF
   - **Salvar Snapshot** — para guardar no banco e reabrir depois

4. **Reabrir snapshot:**
   - Card "Snapshots Salvos" no rodapé
   - Clique num snapshot → carrega os itens

## Observações

- A API já calculava corretamente (percapita × alunos × semanas)
- O problema era que não havia UI para preencher `alunos_parcial` e `alunos_integral`
- Agora a nutricionista pode preencher esses campos na tela de configurações
- O cálculo respeita: parcial puro, integral puro, mescla (comem juntos), sem mescla
- O segmento define a fase escolar para o percentual de percapita (Creche=50%, Ed. Infantil=75%, etc.)
