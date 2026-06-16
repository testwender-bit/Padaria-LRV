'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { History, Archive, Eye } from 'lucide-react'
import { formatarData } from '@/lib/date-utils'
import { useAppStore } from '@/store/app-store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SeletorSemana } from '@/components/seletor-semana'
import { toast } from 'sonner'

interface HistoricoSemana {
  id: string
  ano: number
  semana: number
  data_inicio: string
  data_fim: string
  tipo_pao: string
  nome_pao: string
  lanche_regular: string | null
  lanche_bifasica: string | null
  total_pf: number
  total_pcq: number
  total_lanche: number
  ajustes_count: number
  gerado_por: string
  gerado_em: string
  snapshot_json: string
}

export default function HistoricoPage() {
  const [historico, setHistorico] = useState<HistoricoSemana[]>([])
  const [loading, setLoading] = useState(true)
  const [viewSnapshot, setViewSnapshot] = useState<string | null>(null)
  const { semanaReferencia } = useAppStore()

  useEffect(() => {
    fetch('/api/historico')
      .then((r) => r.json())
      .then((data) => {
        setHistorico(Array.isArray(data) ? data : [])
        setLoading(false)
      })
  }, [])

  async function gerarSnapshot() {
    try {
      const prodRes = await fetch(`/api/producao${semanaReferencia ? `?data=${semanaReferencia}` : ''}`)
      const prod = await prodRes.json()

      if (!prod.dias) {
        toast.error('Erro: dados de produção não encontrados')
        return
      }

      let totalPF = 0
      let totalPCQ = 0
      let totalLanche = 0
      for (const dia of prod.dias) {
        totalPF += dia.total_pf || 0
        totalPCQ += dia.total_pcq || 0
        totalLanche += dia.total_lanche || 0
      }

      const ajustesRes = await fetch(`/api/ajustes?ano=${prod.ano}&semana=${prod.semana}`)
      const ajustesData = await ajustesRes.json()
      const ajustesCount = Array.isArray(ajustesData) ? ajustesData.length : 0

      const body = {
        ano: prod.ano,
        semana: prod.semana,
        data_inicio: prod.dias[1]?.data || '',
        data_fim: prod.dias[5]?.data || '',
        tipo_pao: prod.tipoPao,
        nome_pao: prod.nomePao,
        lanche_regular: prod.lancheRegular,
        lanche_bifasica: prod.lancheBifasica,
        total_pf: totalPF,
        total_pcq: totalPCQ,
        total_lanche: totalLanche,
        ajustes_count: ajustesCount,
        gerado_por: 'Sistema',
        gerado_em: new Date().toISOString(),
        snapshot_json: JSON.stringify(prod),
      }

      const res = await fetch('/api/historico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success('Snapshot da semana salvo no histórico!')
        const updated = await fetch('/api/historico').then((r) => r.json())
        setHistorico(Array.isArray(updated) ? updated : [])
      }
    } catch {
      toast.error('Erro ao gerar snapshot')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-[#D4A017]/30 border-t-[#D4A017] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3A5C]">Histórico</h1>
          <p className="text-sm text-muted-foreground">Snapshots de semanas para auditoria</p>
        </div>
        <div className="flex items-center gap-2">
          <SeletorSemana />
          <Button onClick={gerarSnapshot} className="bg-gradient-to-r from-[#1A3A5C] to-[#2C5282]">
            <Archive className="w-4 h-4 mr-1" /> Salvar Semana Atual
          </Button>
        </div>
      </div>

      {historico.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <History className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhum snapshot salvo</p>
            <p className="text-sm text-muted-foreground/60">Salve a semana atual para manter um registro de auditoria</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {historico.map((h) => (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="border-teal-100 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-bold text-[#1A3A5C]">Semana {h.semana}</span>
                        <Badge variant="outline" className="text-[10px]">{h.ano}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatarData(h.data_inicio)} — {formatarData(h.data_fim)}
                      </p>
                      <div className="flex gap-3 mt-2">
                        <Badge className="bg-amber-100 text-amber-800 text-[10px]">
                          {h.total_pf.toLocaleString('pt-BR')} PF
                        </Badge>
                        <Badge className="bg-orange-100 text-orange-800 text-[10px]">
                          {h.total_pcq.toLocaleString('pt-BR')} PCQ
                        </Badge>
                        <Badge className="bg-pink-100 text-pink-800 text-[10px]">
                          {h.total_lanche.toLocaleString('pt-BR')} Lanche
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {h.nome_pao}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Gerado por {h.gerado_por} em {formatarData(h.gerado_em)}
                        {h.ajustes_count > 0 && ` · ${h.ajustes_count} ajustes`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setViewSnapshot(h.snapshot_json)}
                    >
                      <Eye className="w-3 h-3 mr-1" /> Ver
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={!!viewSnapshot} onOpenChange={() => setViewSnapshot(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Snapshot da Semana</DialogTitle>
          </DialogHeader>
          <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-[60vh] custom-scrollbar">
            {viewSnapshot ? JSON.stringify(JSON.parse(viewSnapshot), null, 2) : ''}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  )
}
