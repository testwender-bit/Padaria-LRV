# Importar Cardápio de ODT

## Como usar

### 1. Aplicar patch
```bash
unzip -o patch-importar-cardapio.zip
```

### 2. DRY-RUN (preview — ver o que será importado)
```bash
npx tsx scripts/importar-cardapio-odt.ts
```

O script vai:
- Extrair 6 tabelas do ODT (Julho a Dezembro)
- Identificar 22 semanas (20 com preparações, 2 de férias)
- Mapear cada preparação do ODT para uma preparação do banco
- Mostrar matches exatos, parciais e sem match
- Mostrar preview das 3 primeiras semanas

### 3. Aplicar
```bash
npx tsx scripts/importar-cardapio-odt.ts --apply
```

### Se houver múltiplos cardápios Regular
```bash
npx tsx scripts/importar-cardapio-odt.ts --apply --cardapio-id=XXXX
```

## O que o script faz

1. **Extrai tabelas do ODT** (6 tabelas = 6 meses: Jul-Dez)
2. **Parseia semanas** (22 semanas, cada uma com 5 dias: Seg-Sex)
3. **Mapeia preparações** do ODT → banco (fuzzy match por nome)
4. **Insere no cardápio** Regular base:
   - Para cada semana do cardápio (1-22), pega a semana correspondente do ODT
   - Para cada dia (segunta a sexta), adiciona as preparações no slot "Lanche"
   - Remove itens antigos antes de adicionar (idempotente)

## Estrutura do ODT

| Mês | Semanas | Férias |
|---|---|---|
| Julho | 2 | 1 (semana 3 = férias) |
| Agosto | 4 | 0 |
| Setembro | 5 | 0 |
| Outubro | 4 | 1 (feriado) |
| Novembro | 4 | 0 |
| Dezembro | 3 | 0 |
| **Total** | **22** | **2** |

Cada dia tem de 2 a 8 preparações que vão todas para o slot "Lanche" da categoria Regular.
