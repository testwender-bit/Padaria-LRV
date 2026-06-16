# Padaria Municipal de Lucas do Rio Verde - MT

Sistema de gestão e programação da produção da padaria escolar municipal.

## Funcionalidades

- **Planejamento de Produção**: Cálculo automático de quantidades diárias (PF D-1, PCQ com deslocamento, Lanche D-0)
- **Romaneios**: Manifestos de entrega por motorista (José, Aroldo, Busca Própria)
- **Cardápio Semestral**: Planejamento das 22 semanas do semestre letivo
- **Lanches**: Cadastro e distribuição de lanches por escola/dia
- **Feriados**: Gerenciamento com ações automáticas (zerar dia, zerar PF, etc.)
- **Ajustes**: Ajustes pontuais por escola/dia/produto
- **Histórico**: Arquivamento de snapshots para auditoria
- **Custos e Estoque**: Insumos, receitas, movimentações, compras
- **Configurações**: Escolas, quantidades PF/PCQ
- **Impressão A4**: Layout otimizado para impressão

## Deploy no GitHub Codespaces

### Opção 1: Com Supabase (Recomendado para Produção)

1. Crie um projeto no [Supabase](https://supabase.com)
2. Execute o SQL do arquivo `supabase-schema.sql` no SQL Editor do Supabase
3. No Codespaces, crie o arquivo `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-aqui
   ```
4. Instale e rode:
   ```bash
   npm install
   npm run db:push
   npm run seed
   npm run dev
   ```

### Opção 2: Com SQLite (Desenvolvimento/Demo)

1. No Codespaces, simplesmente:
   ```bash
   npm install
   npm run db:push
   npm run seed
   npm run dev
   ```
2. O sistema usa SQLite por padrão com dados de demonstração

## Comando SQL para Supabase

O arquivo `supabase-schema.sql` contém todos os CREATE TABLE necessários, incluindo:
- Row Level Security (RLS) habilitado
- Policies para usuários autenticados
- Índices para performance

## Lógica de Negócio

### Pão Francês (PF)
- Produzido **D-1** (um dia antes da entrega)
- PF de segunda é produzido no domingo

### Pão de Cachorro Quente (PCQ)
- Produzido seg/qua/sex com deslocamento:
  - Produção segunda → entrega terça + quarta
  - Produção quarta → entrega quinta + sexta
  - Produção sexta → entrega segunda (semana seguinte)

### Lanches
- Produzidos **D-0** (mesmo dia da entrega)

### Feriados
- Ações: zerar_dia, zerar_pf, zerar_pcq, zerar_lanche, apenas_observacao
- Podem afetar categorias específicas de escolas

## Tech Stack

- Next.js 16 + App Router
- TypeScript
- Tailwind CSS + shadcn/ui
- Prisma ORM
- Framer Motion (animações)
- date-fns (manipulação de datas)
