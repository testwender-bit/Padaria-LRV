# Patch v8.16.1 — Refinamentos visuais

## 1. PDF: texto da Secretaria agora é branco e centralizado

**Problema:** O texto "SECRETARIA MUNICIPAL DE EDUCAÇÃO DE LUCAS DO RIO VERDE - MT"
estava com cor preta (#1e293b) sobre o fundo escuro do header — quase invisível.

**Fix:**
- Cor: `#ffffff` (branco) — tela e impressão
- Fonte: Carlito (mesma do título do cardápio)
- Tamanho: 11px (tela) / 9pt (impressão)
- `text-align: center` + `width: 100%` + `display: block` — centralizado no meio do header
- `justify-content: center` no `.sp-header-meta` — garante centralização vertical e horizontal
- `print-color-adjust: exact` — garante que o branco aparece na impressão P&B

Arquivos: `src/app/print.css`

## 2. Localizar e Substituir: ocorrências clicáveis + substituição unitária

### Melhoria A: Ocorrências são clicáveis (hiperlink)

Cada ocorrência (ex: "S3 · quarta · Café da Manhã") agora é um **botão clicável**:
- Clique → navega até a semana/dia da ocorrência no editor
- Fecha o diálogo automaticamente
- Mostra toast confirmando o destino

Visual:
- Hover: fundo azul claro, texto azul
- Badge "S3" muda de cinza-claro para azul-escuro no hover
- Ícone `ExternalLink` aparece no hover (canto direito)

### Melhoria B: Substituição unitária (uma por uma)

Quando clica em "Substituir" numa preparação, além do botão "Substituir TODAS",
agora aparece uma lista com **cada ocorrência individual** com botão "Substituir"
do lado. Útil quando você quer trocar só algumas ocorrências específicas.

Visual do painel de substituição:
- Fundo âmbar claro
- Dropdown para escolher a substituta
- Seção "Substituir TODAS" (botão grande)
- Seção "Ou substitua uma por uma" (lista com botões individuais)

Arquivos: `src/app/(app)/nutricao/cardapios/[id]/page.tsx`

## Como aplicar

1. Descompacte na raiz do projeto:
   ```bash
   unzip patch-v816-1.zip -d .
   ```
2. Commit + push:
   ```bash
   git add -A
   git commit -m "fix(v8.16.1): PDF secretaria branco centralizado + localizar-substituir com links e substituição unitária"
   git push
   ```

## Após aplicar — teste

### Teste 1: PDF
1. Gere o PDF de qualquer cardápio
2. ✅ Header mostra "SECRETARIA MUNICIPAL DE EDUCAÇÃO..." em **branco**, **centralizado**, **legível**
3. ✅ Mesma fonte do título do cardápio (Carlito)

### Teste 2: Localizar e Substituir
1. Abra o editor → clique em "Substituir"
2. Busque "Suco" → mostra ocorrências
3. ✅ Clique numa ocorrência (ex: "S3 · quarta · Café da Manhã")
4. ✅ Navega até a semana 3 e fecha o diálogo
5. Volte para "Substituir" → clique em "Substituir" numa preparação
6. Selecione a substituta
7. ✅ Aparece botão "Substituir TODAS" + lista com "Substituir" individual por ocorrência
8. ✅ Clique em "Substituir" numa ocorrência individual → troca só ela
