# Patch v9.10.14 — Guia de Separação no lugar da 2ª via do Pão Francês

> **Arquivo:** `patch-v9.10.14.zip` · **Requisito:** aplicar por cima da
> **v9.10.13** · ✅ **SEM mudança de schema** — não precisa `prisma db push`.

**O que resolve:** os padeiros estavam misturando o **pão francês comum** (que
sai nas entregas da **manhã**) com o **pão complemento** (que sai à **tarde**,
junto com a entrega do PCQ). Na folha de produção o complemento já aparece
separado ("150 + 10"), mas na correria do despacho tudo acabava indo junto
na caixa da manhã.

**A mudança:** a 2ª via da folha de Pão Francês (que era só uma cópia da 1ª)
virou uma **GUIA DE SEPARAÇÃO** — uma lista de conferência para pendurar na
bancada, organizada por **dia de entrega**:

1. **Um bloco por dia** (SEGUNDA · 09/11 — pão produzido na madrugada de
   segunda; QUARTA · 11/11 — produzido na terça; SEXTA · 13/11 — produzido
   na quinta), com o total do dia no cabeçalho.
2. Dentro de cada dia, **dois períodos bem separados**:
   - **MANHÃ — PÃO FRANCÊS COMUM**: escolas da entrega da manhã, na mesma
     ordem da rota (as instituições do Inst. Extra ficam por último com o
     rótulo "extra", e unidades de busca própria com o rótulo "busca própria").
   - **TARDE — PÃO COMPLEMENTO**: só as escolas com complemento, **na mesma
     ordem da folha do motorista do PCQ** (o complemento viaja com o PCQ),
     para carregar a caixa na sequência certa.
3. Cada linha tem **escola + quantidade + quadrinho para marcar** quando
   terminar de separar — e o aviso no topo da folha: manhã e tarde **não se
   misturam**; separe em caixas diferentes.
4. Escola zerada por feriado/ajuste **não aparece na lista** (a guia é lista
   de separação, não tabela de conferência) e dias sem pão viram bloco.

**Intocadas:** 1ª via da folha de PF (com o "150 + 10" das células), folha de
PCQ, romaneio dos motoristas, tela Semanal/Por Dia — nada mudou nelas. A guia
é derivada do MESMO consolidador da produção: qualquer ajuste/feriado já
reflete nela automaticamente.

## Ordem de aplicação (GitHub Codespace)

Com o terminal aberto na pasta do projeto:

```bash
unzip -o patch-v9.10.14.zip
npm run build
npm run start
```

Depois confirme em **Produção → Imprimir**: a página 2 agora sai com o título
"GUIA DE SEPARAÇÃO — PÃO FRANCÊS". Sem `db push`, sem migração.

Para registrar no git:

```bash
git add . && git commit -m "v9.10.14" && git push
```
