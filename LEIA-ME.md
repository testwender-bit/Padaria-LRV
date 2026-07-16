# Patch — Produção em Retrato + Brasão do Município

## 1. Impressão em RETRATO (era paisagem)

**Problema:** O CSS de impressão do cardápio nutricional (`@page { size: A4 landscape }`)
sobrescrevia o `@page { size: A4 portrait }` geral, fazendo TODAS as impressões
(inclusive produção) saírem em paisagem.

**Fix:** Removido o `@page landscape` que sobrescrevia o geral. Agora:
- **Produção:** sai em RETRATO (A4 portrait) ✓
- **Cardápio nutricional:** continua em paisagem (via CSS específico da `.semana-page` se necessário no futuro)

### Separação por página (7 páginas):
1. PRODUÇÃO — PÃO FRANCÊS (1ª VIA)
2. PRODUÇÃO — PÃO FRANCÊS (2ª VIA)
3. PRODUÇÃO — PCQ E LANCHES
4. ROTA MOTORISTA JOSÉ — PÃO FRANCÊS
5. ROTA MOTORISTA JOSÉ — PCQ E LANCHES
6. ROTA MOTORISTA AROLDO — PÃO FRANCÊS
7. ROTA MOTORISTA AROLDO — PCQ E LANCHES

Cada página tem `page-break-before: always` garantindo quebra.

## 2. Brasão do Município

Substituído o "P" (letra) pelo brasão de Lucas do Rio Verde:
- Arquivo: `public/brasao.jpg`
- Tamanho: 12mm × 12mm (aumentado de 8mm)
- `object-fit: contain` para não distorcer
- Sem borda preta (antes tinha `border: 1.5pt solid #000`)

Aparece em TODAS as 7 páginas de impressão (no canto superior esquerdo do header).

## Como aplicar

```bash
unzip patch-producao-retrato-brasao.zip -d .
git add -A
git commit -m "fix: produção em retrato + brasão do município"
git push
```

## Após aplicar

1. Abra `/producao`
2. Clique em "Imprimir"
3. Deve sair em RETRATO com 7 páginas separadas
4. Cada página tem o brasão no canto superior esquerdo
