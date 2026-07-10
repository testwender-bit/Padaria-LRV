# Patch v9.4 — Aviso/Observação por Semana

## O que mudou

### 1. Cardápio Semestral (`/cardapio`) — campo de aviso

Ao editar uma semana, agora tem um campo **"Aviso / Observação da Semana"**:
- Aparece abaixo dos campos de pão/lanche
- Placeholder: "Ex: Semana com feriado na quinta — ajustar produção"
- Salva no campo `obs` do `CardapioSemestral`

Na lista de semanas, se tem aviso, mostra um badge âmbar:
```
⚠️ Semana com feriado na quinta — ajustar produção
```

### 2. Página de Produção (`/producao`) — banner de aviso

Se a semana atual tem observação, aparece um banner âmbar no topo:
```
┌──────────────────────────────────────────────┐
│ ⚠️ Aviso da Semana 15                        │
│ Semana com feriado na quinta — ajustar...    │
└──────────────────────────────────────────────┘
```

### 3. Dashboard (`/dashboard`) — banner de aviso

Mesmo banner âmbar aparece no dashboard, entre o seletor de semana e os KPIs:
```
┌──────────────────────────────────────────────┐
│ 📌 Aviso da Semana                           │
│ Semana com feriado na quinta — ajustar...    │
└──────────────────────────────────────────────┘
```

## Como aplicar

```bash
unzip patch-aviso-semana.zip -d .
git add -A
git commit -m "feat: aviso/observação por semana no cardápio, produção e dashboard"
git push
```

## Fluxo de uso

1. Vá em `/cardapio`
2. Clique no lápis (editar) da semana que quer adicionar aviso
3. Digite o aviso no campo "Aviso / Observação da Semana"
4. Salve
5. O aviso aparece:
   - Como badge âmbar na lista do cardápio
   - Como banner no dashboard (se for a semana atual)
   - Como banner na página de produção (se for a semana atual)
