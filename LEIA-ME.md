# Patch — Seletor de Ano + Semestre no Cardápio da Padaria

## Problema

A página `/cardapio` mostrava TODAS as semanas de TODOS os anos sem filtro.
Não dava para selecionar 2º semestre nem criar semanas novas para o 2º semestre.

## Solução

Adicionado seletor de **Ano** + **Semestre** (1º ou 2º) no topo da página:

- **Ano:** dropdown com anos disponíveis no banco + ano atual
- **Semestre:** botões toggle "1º Semestre" / "2º Semestre"
- **Filtro:** mostra só as semanas do ano + semestre selecionados
  - 1º semestre = semanas com data_inicio entre janeiro e junho
  - 2º semestre = semanas com data_inicio entre julho e dezembro

### Botão "Nova Semana"

- Calcula `proximaSemana` baseado APENAS nas semanas do semestre selecionado
- Se 1º semestre não tem semanas: começa na 1ª segunda de fevereiro
- Se 2º semestre não tem semanas: começa na 1ª segunda de agosto
- Se já tem semanas: continua da última + 1

### Auto-detecção

Ao abrir a página, detecta o semestre atual automaticamente:
- Janeiro a Junho → 1º semestre
- Julho a Dezembro → 2º semestre

## Como aplicar

```bash
unzip patch-cardapio-semestre.zip -d .
git add -A
git commit -m "feat: seletor de ano + semestre no cardápio da padaria"
git push
```

## Após aplicar

1. Abra `/cardapio`
2. Selecione o ano (ex: 2026)
3. Selecione o semestre (ex: 2º Semestre)
4. Vai mostrar "Nenhuma semana cadastrada"
5. Clique em "Criar Semana 1" — cria a primeira semana do 2º semestre
6. Continue clicando "Nova Semana" até completar as 22 semanas
