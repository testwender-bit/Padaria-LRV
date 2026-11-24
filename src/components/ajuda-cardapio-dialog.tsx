'use client'

// =============================================================================
// ajuda-cardapio-dialog.tsx — v9.10.17
// Botão "Ajuda" do editor de cardápio: popup com o manual completo de uso,
// visual e com pouco texto — cada card cobre um bloco da tela.
// =============================================================================

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  UtensilsCrossed, GripVertical, ArrowLeftRight, Calendar, BarChart3, Settings,
  HelpCircle, Lightbulb, MousePointerClick, Search, Star, Zap, Pencil, Trash2,
  Copy, Clock, Repeat, FileText, X,
} from 'lucide-react'

interface AjudaCardapioDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Linha de atalho: ícone + termo em negrito + descrição curta
function AjudaItem({ icon, termo, texto }: { icon: React.ReactNode; termo: string; texto: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex-shrink-0 text-muted-foreground">{icon}</span>
      <p className="text-[11px] leading-snug text-gray-700">
        <span className="font-bold text-[#1A3A5C]">{termo}</span>
        <span className="text-muted-foreground"> — </span>
        {texto}
      </p>
    </div>
  )
}

// Card de seção do manual
function AjudaCard({
  titulo, cor, icone, destaque, children,
}: {
  titulo: string
  cor: string
  icone: React.ReactNode
  destaque?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={`rounded-xl border p-2.5 space-y-1.5 ${
        destaque ? 'border-violet-300 bg-violet-50/40' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${cor}1A`, color: cor }}
        >
          {icone}
        </span>
        <p className="text-xs font-bold" style={{ color: cor }}>{titulo}</p>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

export function AjudaCardapioDialog({ open, onOpenChange }: AjudaCardapioDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col gap-3 p-5 overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-[#1A3A5C] text-sm flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-blue-600" />
            Como usar o editor de cardápio
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {/* 1 — Montar a refeição */}
            <AjudaCard titulo="1 · Montar a refeição" cor="#2563EB" icone={<UtensilsCrossed className="w-3.5 h-3.5" />}>
              <AjudaItem icon={<PlusIcon />} termo="+ Adicionar" texto="fica no fim de cada refeição — abre a biblioteca de preparações" />
              <AjudaItem icon={<Search className="w-3 h-3" />} termo="Busca" texto='digite ("pão") e escolha — a busca limpa e o cursor volta pronto para o próximo' />
              <AjudaItem icon={<Star className="w-3 h-3" />} termo="Filtros" texto="Favoritas · + Usadas · Categoria · Sem alérgeno" />
              <AjudaItem icon={<Zap className="w-3 h-3" />} termo="Nova preparação" texto="cria na hora, sem sair da tela — já entra selecionada" />
              <AjudaItem icon={<Pencil className="w-3 h-3" />} termo="Lápis" texto="edita a preparação (ingredientes e percapita)" />
            </AjudaCard>

            {/* 2 — Organizar */}
            <AjudaCard titulo="2 · Organizar" cor="#D97706" icone={<GripVertical className="w-3.5 h-3.5" />}>
              <AjudaItem icon={<GripVertical className="w-3 h-3" />} termo="Arrastar" texto="move para outro dia, refeição ou semana" />
              <AjudaItem icon={<Copy className="w-3 h-3" />} termo="Alt + arrastar" texto="copia em vez de mover" />
              <AjudaItem icon={<ChevronIcon />} termo="↑ ↓" texto="muda a ordem dentro da refeição (aparecem ao passar o mouse)" />
              <AjudaItem icon={<Trash2 className="w-3 h-3" />} termo="Lixeira" texto="remove a preparação · a lixeira no título limpa a refeição inteira" />
            </AjudaCard>

            {/* 3 — Trocar de lugar (atalhos de clique) */}
            <AjudaCard titulo="3 · Trocar de lugar (atalhos)" cor="#7C3AED" icone={<ArrowLeftRight className="w-3.5 h-3.5" />} destaque>
              <AjudaItem icon={<ArrowLeftRight className="w-3 h-3" />} termo="⇄ Trocar 2" texto="clique numa preparação e depois na outra — elas trocam de lugar" />
              <AjudaItem icon={<Calendar className="w-3 h-3" />} termo="📅⇄ Trocar dia" texto="clique no cabeçalho azul dos 2 dias — tudo troca de lugar" />
              <AjudaItem icon={<MousePointerClick className="w-3 h-3" />} termo="Mover várias" texto="marque quantas preparações quiser e clique no dia de destino — todas movem juntas" />
              <AjudaItem icon={<Copy className="w-3 h-3" />} termo="Copiar" texto="no cabeçalho do dia: escolhe origem → destino; 1 dia pode ir para vários" />
              <AjudaItem icon={<X className="w-3 h-3" />} termo="ESC" texto="cancela qualquer ferramenta de troca" />
            </AjudaCard>

            {/* 4 — Semanas */}
            <AjudaCard titulo="4 · Semanas" cor="#0D9488" icone={<Calendar className="w-3.5 h-3.5" />}>
              <AjudaItem icon={<ChevronIcon />} termo="‹ ›" texto="troca de semana · Alt+← → pula · Alt+1..5 vai direto" />
              <AjudaItem icon={<UnlockIcon />} termo="Modificada" texto="a semana divergiu do cardápio base" />
              <AjudaItem icon={<Repeat className="w-3 h-3" />} termo="Gerar Ciclo" texto="repete as semanas montadas até completar as 22" />
            </AjudaCard>

            {/* 5 — Conferir a qualidade */}
            <AjudaCard titulo="5 · Conferir a qualidade" cor="#4F46E5" icone={<BarChart3 className="w-3.5 h-3.5" />}>
              <AjudaItem icon={<BarChart3 className="w-3 h-3" />} termo="Resumo ao lado" texto="energia/dia, percentuais VET, ferro heme, Vitamina A e alertas PNAE" />
              <AjudaItem icon={<CircleIcon />} termo="Bolinha do dia" texto="semáforo da energia vs meta (verde = ok)" />
              <AjudaItem icon={<BarChart3 className="w-3 h-3" />} termo="Repetições" texto="botão aqui no resumo: aponta 2× no mesmo dia, dias seguidos e dia fixo" />
              <AjudaItem icon={<Search className="w-3 h-3" />} termo="Localizar / Substituir" texto="achar uma preparação em todo o cardápio e trocar em lote" />
            </AjudaCard>

            {/* 6 — Configurar */}
            <AjudaCard titulo="6 · Configurar" cor="#64748B" icone={<Settings className="w-3.5 h-3.5" />}>
              <AjudaItem icon={<Pencil className="w-3 h-3" />} termo="Nome" texto="clique no título do cardápio para renomear" />
              <AjudaItem icon={<CircleIcon />} termo="Fase escolar" texto="badge colorido — define a percapita usada nos cálculos" />
              <AjudaItem icon={<Calendar className="w-3 h-3" />} termo="Data de início" texto="recalcula as datas das semanas e mostra os feriados" />
              <AjudaItem icon={<Clock className="w-3 h-3" />} termo="🕐 horário" texto="clique no horário de cada refeição (ex.: 09h00 / 15h00)" />
              <AjudaItem icon={<FileText className="w-3 h-3" />} termo="PDF · Aprovar · Replicar" texto="imprimir, validar e copiar para as escolas" />
            </AjudaCard>
          </div>

          {/* Rodapé: por que não existe botão Salvar */}
          <div className="mt-2.5 p-2.5 rounded-xl border border-amber-200 bg-amber-50 flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] leading-snug text-amber-800">
              <span className="font-bold">Tudo é salvo na hora</span> — cada ação (adicionar, mover, trocar, copiar)
              vai direto para o banco. Por isso <span className="font-bold">não existe botão Salvar nesta tela</span>.
              Se precisar refazer, é só editar de novo.
            </p>
          </div>
        </div>

        <div className="flex-shrink-0 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Entendi</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Ícones pequenos sem import extra (desenhados inline)
function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
    </svg>
  )
}
function UnlockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  )
}
function CircleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
      <circle cx="12" cy="12" r="5" />
    </svg>
  )
}
