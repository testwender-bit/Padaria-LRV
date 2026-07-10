# Patch v9.4 — Data de início do semestre customizável

## O que mudou

Adicionado campo **"Início do semestre"** na página `/cardapio` que aparece
quando o semestre selecionado não tem semanas cadastradas.

### Como funciona

1. Selecione o ano e semestre (ex: 2026 / 2º Semestre)
2. Se o semestre está vazio, aparece o campo de data:
   ```
   Início do semestre: [____/____/____]  (ajustado para a próxima segunda-feira)
   ```
3. A data vem pré-preenchida com o padrão:
   - 1º semestre: 1ª segunda-feira de fevereiro
   - 2º semestre: 1ª segunda-feira de agosto
4. **Você pode alterar a data** para qualquer dia — o sistema ajusta para a
   próxima segunda-feira automaticamente
5. Clique em "Criar Semana 1" — a primeira semana começa nessa data
6. As semanas seguintes são calculadas automaticamente (+7 dias)

### Exemplo de uso

- Ano letivo começa em 4 de agosto de 2026 (em vez de 1º de agosto)
- Selecione: 2026 / 2º Semestre
- Campo aparece: "Início do semestre: 2026-08-03" (1ª segunda de agosto)
- Altere para: 2026-08-04
- Clique "Criar Semana 1" → semana 1 começa em 04/08 (terça)
  - O sistema ajusta para a próxima segunda: 10/08
- Ou se quiser começar numa segunda específica, digite a data dessa segunda

## Como aplicar

```bash
unzip patch-cardapio-data-inicio.zip -d .
git add -A
git commit -m "feat: data de início do semestre customizável"
git push
```
