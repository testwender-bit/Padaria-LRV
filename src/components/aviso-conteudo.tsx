'use client'

// v9.10.13: conteúdo do banner "Aviso da Semana" com suporte a CHECKLIST.
//
// - Linhas comuns: cada linha vira um parágrafo próprio com whitespace-pre-wrap
//   (quebras de linha digitadas na edição aparecem na tela — antes o texto
//   saía tudo corrido num <p> só).
// - Linhas "[ ] tarefa": checklist com caixinha. Com onAlternarTarefa
//   (Produção) o clique marca/desmarca e salva; sem ele (Dashboard) o quadro
//   aparece em modo LEITURA — mesmo visual, sem interação.
// - Selo "x/y concluídas" aparece automaticamente quando há ao menos uma
//   tarefa (verde quando todas feitas).

import { Check } from 'lucide-react'
import { analisarAviso, resumoTarefas } from '@/lib/aviso-utils'
import { cn } from '@/lib/utils'

// Caixinha do checklist — mesmo desenho nos modos interativo e leitura
// (a versão disabled do Checkbox do shadcn ficaria acinzentada no Dashboard).
function CaixinhaAviso({ feita }: { feita: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
        feita
          ? 'bg-emerald-500 border-emerald-500 text-white'
          : 'bg-transparent border-amber-400/80 group-hover/aviso:border-amber-600 group-hover/aviso:bg-amber-100/60'
      )}
    >
      {feita && <Check className="w-3 h-3" strokeWidth={3} />}
    </span>
  )
}

export function AvisoConteudo({ obs, onAlternarTarefa, className }: {
  obs: string
  /** presente = modo interativo (Produção); ausente = somente leitura (Dashboard) */
  onAlternarTarefa?: (indice: number) => void
  className?: string
}) {
  const linhas = analisarAviso(obs)
  const { total, feitas } = resumoTarefas(linhas)
  const interativo = typeof onAlternarTarefa === 'function'
  const tudoFeito = total > 0 && feitas === total

  return (
    <div className={cn('min-w-0', className)}>
      {total > 0 && (
        <div className="mb-1">
          <span
            className={cn(
              'inline-block text-[11px] font-semibold px-1.5 py-0.5 rounded-full',
              tudoFeito ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
            )}
          >
            {tudoFeito ? `Tarefas: ${total}/${total} — tudo concluído!` : `Tarefas: ${feitas}/${total} concluídas`}
          </span>
        </div>
      )}
      <div className="space-y-0.5">
        {linhas.map((linha) => {
          // linha vazia → respiro entre parágrafos (sem <p> fantasma)
          if (linha.bruto.trim() === '') {
            return <div key={linha.indice} aria-hidden className="h-1.5" />
          }
          if (linha.tipo === 'tarefa') {
            const descricao = (
              <span
                className={cn(
                  'flex-1 min-w-0 break-words',
                  linha.feita && 'line-through opacity-60'
                )}
              >
                {linha.texto || 'Tarefa sem descrição'}
              </span>
            )
            if (interativo) {
              return (
                <button
                  key={linha.indice}
                  type="button"
                  role="checkbox"
                  aria-checked={linha.feita}
                  title={linha.feita ? 'Marcar como não feita' : 'Marcar como feita'}
                  onClick={() => onAlternarTarefa(linha.indice)}
                  className="group/aviso w-full text-left flex items-start gap-2 rounded px-1 -mx-1 py-0.5 cursor-pointer hover:bg-amber-100/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                >
                  <CaixinhaAviso feita={linha.feita} />
                  {descricao}
                </button>
              )
            }
            return (
              <div key={linha.indice} className="flex items-start gap-2 rounded px-1 -mx-1 py-0.5">
                <CaixinhaAviso feita={linha.feita} />
                {descricao}
              </div>
            )
          }
          // linha de texto comum — quebras preservadas (motivo do whitespace-pre-wrap)
          return (
            <p key={linha.indice} className="whitespace-pre-wrap break-words">
              {linha.bruto}
            </p>
          )
        })}
      </div>
    </div>
  )
}
