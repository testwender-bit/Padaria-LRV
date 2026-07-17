# Fix — Lanche compacto + alinhamento + destaque P&B

## 3 correções

### 1. Alinhamento da coluna TOTAL (todas as tabelas)

**Problema:** Coluna TOTAL estava alinhada à direita enquanto as colunas
dos dias estavam centralizadas — ficava descentralizado.

**Fix:** Mudado `text-align: right` para `text-align: center` na classe
`.print-col-total` do print.css. Agora todas as colunas (dias + total)
estão centralizadas.

### 2. Lanche em tabela única compacta

**Problema:** Lanche tinha tabelas separadas por dia — ocupava muito espaço.

**Fix:** Agora é UMA tabela com 2 colunas (65% / 35%):
- Coluna 1: "DIA / ESCOLA" (65% da largura)
- Coluna 2: "QUANTIDADE" (35% da largura, centralizada)
- `tableLayout: fixed` para garantir larguras consistentes

### 3. Sub-headers de dia com destaque P&B

**Problema:** Sub-headers de dia (SEGUNDA, TERÇA, etc.) tinham fundo cinza
claro que sumia em P&B — ficavam iguais às linhas de escolas.

**Fix:** Agora os sub-headers de dia têm:
- `■` (marcador preto) antes do nome do dia
- `font-weight: 800` (extra bold)
- `text-transform: uppercase`
- `border-top: 1.5pt solid #000` (linha preta forte acima)
- `border-bottom: 0.5pt solid #000` (linha preta fina abaixo)
- `letter-spacing: 0.3pt` (espaçamento entre letras)

As linhas de escolas ficam com:
- `padding-left: 6mm` (indentadas sob o dia)
- `font-weight: normal`
- Sem bordas extras

Resultado em P&B:
```
┌──────────────────────────┬────────────┐
│ DIA / ESCOLA             │ QUANTIDADE │ ← header com linha preta
├──────────────────────────┼────────────┤
████████████████████████████████████████████ ← linha preta forte
│ ■ SEGUNDA                │ 150 unid.  │ ← bold + ■ + uppercase
├──────────────────────────┼────────────┤
│   Anjo da Guarda         │ 50         │ ← indentado, normal
│   Chico Mendes           │ 60         │
│   São Cristóvão          │ 40         │
████████████████████████████████████████████ ← linha preta forte
│ ■ TERÇA                  │ 120 unid.  │
│   Anjo da Guarda         │ 50         │
│   Fredolino              │ 70         │
└──────────────────────────┴────────────┘
```

Aplicado tanto na produção quanto nos romaneios.

## Como aplicar

```bash
unzip patch-lanche-bw-alinhado.zip -d .
git add -A
git commit -m "fix: lanche compacto + alinhamento centralizado + destaque P&B nos sub-headers"
git push
```
