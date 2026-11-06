# Patch v9.10.13 — Quadro de Tarefas no Aviso da Semana (checklist marcável + parágrafos preservados)

> **Arquivo:** `patch-v9.10.13.zip` · **Requisito:** aplicar por cima da
> **v9.10.12** · ✅ **SEM mudança de schema** — não precisa `prisma db push`.

**O que resolve (2 melhorias no quadro de avisos da Produção):**

1. **Aviso vira QUADRO DE TAREFAS (checklist).** No diálogo de edição do
   aviso, qualquer linha que começar com **`[ ]`** aparece no banner como uma
   **caixinha clicável** — a equipe clica e a tarefa fica **marcada como feita**
   (riscada, caixinha verde) na hora, sem recarregar a página. Um selo
   **"Tarefas: x/y concluídas"** resume o progresso (fica verde quando tudo
   está feito). Exemplo de aviso:

   ```
   Semana com feriado na quinta — produção reduzida.
   [ ] Separar formas da creche na quinta
   [x] Levar balança para a calibração
   ```

   Para facilitar, o diálogo ganhou o botão **"Virar tarefas"**: converte
   todas as linhas do texto em tarefas de uma vez. Marcar/desmarcar salva
   direto no mesmo campo de sempre (obs do cardápio da semana) — se a conexão
   falhar, a marcação volta atrás com aviso.

2. **Parágrafos não somem mais.** Antes o banner juntava tudo numa linha só,
   mesmo digitando parágrafo de baixo na edição. Agora **cada linha digitada
   aparece como um parágrafo próprio**, tanto no banner da **Produção** quanto
   no do **Dashboard**.

**Preservado:** avisos de texto puro continuam funcionando exatamente como
estão (o checklist é opcional — só vira tarefa quem tiver `[ ]`); no
**Dashboard** o quadro é só leitura (a marcação é feita na Produção); o banner
continua **fora da impressão** (v9.8.2); placeholder "Nenhum aviso" (v9.9.0);
edição via diálogo (v9.7.5); nada muda em produção/romaneio/impressões.

## Ordem de aplicação (GitHub Codespace)

Com o terminal aberto **na raiz do projeto** (pasta que contém `package.json`),
envie o arquivo `patch-v9.10.13.zip` para dentro dela e rode:

```bash
# 1) Extrai por cima, sobrescrevendo os arquivos:
unzip -o patch-v9.10.13.zip

# 2) Gere o build e reinicie:
npm run build
npm run start   # ou o supervisor de sempre

# 3) Versiona:
git add .
git commit -m "v9.10.13: quadro de tarefas no aviso da semana (checklist + parágrafos)"
git push
```

## Como conferir

1. **Produção** → no banner "Aviso da Semana", clique no lápis ✏️ para editar.
2. Escreva um aviso com linhas começando em `[ ]` (ou cole um texto e clique
   **"Virar tarefas"**) → **Salvar Aviso**.
3. No banner: cada linha `[ ]` virou uma **caixinha**. Clique nela → fica
   **riscada/verde** e o selo sobe para "1/2 concluídas". Recarregue a página —
   a marcação continua salva.
4. **Dashboard**: o mesmo aviso mostra as caixinhas (só leitura, sem clique).
5. Texto sem `[ ]` continua aparecendo normal — agora respeitando os
   parágrafos que você digitou.
