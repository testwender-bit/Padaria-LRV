# Fix — Produção extra silenciosa + remover Busca Própria do romaneio

## 1. Produção extra agregada silenciosamente

**Antes:** Produções extras apareciam em página separada na impressão.
**Agora:** São injetadas como `ItemProducao` nos dias de produção, aparecendo
junto com as escolas na tabela de PF/PCQ/Lanche — como última entrada
(rota BUSCA_PROPRIA, ordem_rota=999).

### Como funciona:
- PF extra → injetado no dia de produção (D-1 da entrega)
- PCQ/Lanche extra → injetado no próprio dia
- Aparece na tabela de produção, na impressão, e nos totais
- Não aparece em romaneio (não tem motorista)

## 2. Removido romaneio "Busca Própria"

A rota BUSCA_PROPRIA foi removida do romaneio. Só aparecem:
- Motorista José
- Motorista Aroldo

## Como aplicar

```bash
unzip -o patch-extra-silencioso.zip -d .
git add -A
git commit -m "fix: produção extra silenciosa + remover busca própria do romaneio"
git push
```
