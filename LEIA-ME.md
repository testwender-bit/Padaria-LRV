# Fix v9.5.8 — PF Complemento (Comp Seg/Qua/Sex) agora aparece D-1 na produção

## O problema

> "Na configuração 'Quantidades PCQ por Escola' o 'Comp Seg' 'Comp Qua'
> 'Comp Sex' esse é o pão de complemento, é pão francês, ele está
> configurado quase correto. O problema é que o dia que coloco ele ali
> é o dia de entrega e ele está aparecendo da mesma forma no dia de
> produção. O dia de produção desse pão francês (só do pão francês) na
> produção deve aparecer 1 dia antes logo esse 'Comp Seg' 'Comp Qua'
> 'Comp Sex' aparecem nessa data para os motoristas e assim está. Mas
> para a produção deve aparecer um dia antes. Seguindo a lógica
> domingo terça e quinta."

## Causa

O PF Complemento (pão francês complementar das creches) era processado
**dentro do loop do PCQ** (seg/qua/sex = dia de entrega). Ele era
adicionado a `itensPf` com `dia_entrega = diaKey` (seg/qua/sex) — o mesmo
dia de produção que o PCQ.

Mas como o PF Complemento é **pão francês**, deveria seguir a regra
**D-1** (produzido 1 dia antes da entrega), igual ao PF regular:
- Entrega segunda → produção **domingo**
- Entrega quarta → produção **terça**
- Entrega sexta → produção **quinta**

O romaneio (motoristas) já estava correto, pois mostrava no dia de
**entrega** (seg/qua/sex).

## Fix

Refatorado o processamento do PF Complemento em `/api/producao/route.ts`:

### Antes

```ts
// Dentro do if (diaTexto === 'segunda' || 'quarta' || 'sexta'):
if (qtdComp > 0) {
  itensPf.push({ ..., dia_entrega: diaKey })  // seg/qua/sex = dia de produção errado
}
```

### Depois

#### PF Complemento com entrega na SEGUNDA → produção DOMINGO

Adicionado um bloco **antes do loop `for i`**, no mesmo lugar onde
`itensPfDomingo` é construído (linhas 130-176). Para cada escola com
`pf_comp_segunda > 0`, injeta um item PF em `itensPfDomingo` com
`dia_entrega: 'segunda'`.

#### PF Complemento com entrega na QUARTA → produção TERÇA
#### PF Complemento com entrega na SEXTA → produção QUINTA

Adicionado um bloco **dentro do loop `for i`** (depois do bloco PCQ),
que mapeia:

```ts
const pfCompEntregaParaProducao = {
  segunda: 'domingo',  // processado no bloco domingo separado
  quarta: 'terca',     // i=1
  sexta: 'quinta',     // i=3
}
```

Para cada dia de entrega (seg/qua/sex), só processa se `diaKey` (dia de
produção corrente) bate com `pfCompEntregaParaProducao[entregaDia]`. Assim:
- Quando o loop chega em `i=1` (terça), processa PF Comp de entrega quarta
- Quando o loop chega em `i=3` (quinta), processa PF Comp de entrega sexta

O item é injetado em `itensPf` (do dia de produção correto) com
`dia_entrega` indicando o dia real de entrega (seg/qua/sex), mas
**fisicamente** aparece na coluna de produção D-1 (dom/ter/qui).

### Romaneio não foi alterado

Conforme o usuário esclareceu, o romaneio (motoristas) já está correto,
mostrando o PF Complemento no dia de **entrega** (seg/qua/sex). Não foi
necessário mexer em `/api/romaneio/route.ts`.

## Mapeamento final

| Configuração (entrega) | Dia no Romaneio | Dia na Produção (D-1) |
|------------------------|----------------|------------------------|
| Comp Seg               | Segunda        | **Domingo**            |
| Comp Qua               | Quarta         | **Terça**              |
| Comp Sex               | Sexta          | **Quinta**             |

## Arquivos incluídos

```
src/app/api/producao/route.ts    # PF Complemento injetado no dia D-1 (dom/ter/qui)
```

## Como aplicar

```bash
# Na RAIZ do projeto:
unzip -o patch-pf-comp-d1-v9.5.8.zip -d .

git add -A
git commit -m "fix(v9.5.8): PF Complemento (Comp Seg/Qua/Sex) aparece D-1 na produção"
git push
```

## Verificação

1. Vá em **Configurações → PCQ → Editar uma creche**.
2. Configure `Comp Seg = 30`, `Comp Qua = 30`, `Comp Sex = 30` (por exemplo).
3. Salve.
4. Vá para a página de **Produção → PF**:
   - A creche deve aparecer com PF na coluna **Domingo** (correspondente
     ao Comp Seg).
   - A creche deve aparecer com PF na coluna **Terça** (correspondente
     ao Comp Qua).
   - A creche deve aparecer com PF na coluna **Quinta** (correspondente
     ao Comp Sex).
5. Vá para o **Romaneio por motorista**:
   - A creche deve aparecer com PF nos dias de **entrega** (Segunda,
     Quarta, Sexta) — como já estava antes.
6. A quantidade total de PF na produção deve bater com a soma de
   Comp Seg + Comp Qua + Comp Sex (somando com o PF regular).

## Nota técnica

A checagem de feriados continua dupla: verifica o dia de **produção**
(D-1) E o dia de **entrega**. Se qualquer um dos dois for feriado
aplicável à categoria da escola, o PF Complemento é zerado
(com o nome do feriado aparecendo no item).
