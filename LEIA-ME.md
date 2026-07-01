# Fix — Alunos não salvavam ao editar escola

## Bug

Ao editar uma escola e preencher o número de alunos, ao salvar e reabrir
o diálogo de edição, os campos apareciam zerados novamente.

## Causa

O botão "Editar escola" carregava os dados da escola no estado `editEscola`,
mas **não incluía** os campos `alunos_parcial`, `alunos_integral`,
`mescla_parcial_integral`, `segmento`, `dia_pao_frances`, `dia_lanche`.

Resultado: o diálogo abria com esses campos como `undefined` (mostrava 0),
o usuário digitava o valor, salvava (a API gravava corretamente), mas ao
reabrir o diálogo os campos voltavam a aparecer como 0 porque não eram
carregados do banco.

## Fix

Adicionados os campos faltantes no `setEditEscola()` do botão de editar:
```typescript
alunos_parcial: escola.alunos_parcial ?? 0,
alunos_integral: escola.alunos_integral ?? 0,
mescla_parcial_integral: escola.mescla_parcial_integral ?? false,
segmento: escola.segmento ?? 'REGULAR',
dia_pao_frances: escola.dia_pao_frances ?? null,
dia_lanche: escola.dia_lanche ?? null,
```

## Como aplicar
```bash
unzip patch-fix-alunos-save.zip -d .
git add -A
git commit -m "fix: carregar campos de alunos ao editar escola"
git push
```
