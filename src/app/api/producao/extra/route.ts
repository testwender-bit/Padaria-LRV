import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { numeroSemana, anoSemana } from '@/lib/date-utils'

// ============================================================
// GET /api/producao/extra?ano=2026&semana=30
// Lista produções extras de uma semana
// ============================================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ano = Number(searchParams.get('ano')) || anoSemana(new Date())
    const semana = Number(searchParams.get('semana')) || numeroSemana(new Date())

    const extras = await db.producaoExtra.findMany({
      where: { ano, semana },
      orderBy: [{ produto: 'asc' }, { dia_semana: 'asc' }],
    })
    return NextResponse.json(extras)
  } catch (error) {
    // v9.10.5/v9.10.6: colunas motorista/lanche_nome podem não existir ainda
    // (db push pendente) — devolve lista vazia em vez de derrubar a rota.
    console.error('Erro ao buscar produção extra:', error)
    return NextResponse.json([])
  }
}

// ============================================================
// POST /api/producao/extra
// Cria uma ou várias produções extras
// Body: { items: [{ nome_instituicao, produto, dia_semana, motorista, lanche_nome, quantidade, observacao }] }
//   ou item único: { nome_instituicao, produto, dia_semana, motorista, lanche_nome, quantidade, observacao }
// v9.10.5: aceita `motorista` ('JOSE' | 'AROLDO' | 'BUSCA_PROPRIA') — define
// em qual romaneio de motorista o extra aparece. Obrigatório (400 se ausente
// ou inválido).
// v9.10.6: aceita `lanche_nome` — quando produto = 'LANCHE', é o nome do lanche
// cadastrado escolhido no dialog (Pão Francês, PCQ ou lanche da página Lanches).
// Snapshot desnormalizado (sem FK). Obrigatório quando produto = 'LANCHE'
// (400 se ausente) — se for diferente do lanche da semana, o extra aparece
// "separadinho" na folha de produção de Lanches.
// ============================================================
const MOTORISTAS_VALIDOS = ['JOSE', 'AROLDO', 'BUSCA_PROPRIA']

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const ano = body.ano || anoSemana(new Date())
    const semana = body.semana || numeroSemana(new Date())

    const items = Array.isArray(body.items) ? body.items : [body]

    // v9.10.5: valida o motorista de cada item
    for (const item of items) {
      if (!MOTORISTAS_VALIDOS.includes(item.motorista)) {
        return NextResponse.json(
          { error: 'Selecione o motorista que vai levar o extra (José, Aroldo ou Busca Própria)' },
          { status: 400 }
        )
      }
    }

    // v9.10.6: valida o lanche escolhido quando o produto é LANCHE
    for (const item of items) {
      if (item.produto === 'LANCHE' && !(typeof item.lanche_nome === 'string' && item.lanche_nome.trim())) {
        return NextResponse.json(
          { error: 'Selecione qual lanche será produzido (Pão Francês, PCQ ou um lanche cadastrado)' },
          { status: 400 }
        )
      }
    }

    const created = await db.producaoExtra.createMany({
      data: items.map((item: any) => ({
        ano,
        semana,
        nome_instituicao: item.nome_instituicao,
        produto: item.produto,
        // v9.10.6: snapshot do nome do lanche escolhido (só quando LANCHE)
        lanche_nome: item.produto === 'LANCHE'
          ? String(item.lanche_nome).trim().substring(0, 80)
          : null,
        dia_semana: item.dia_semana,
        motorista: item.motorista,
        quantidade: item.quantidade || 0,
        observacao: item.observacao || null,
      })),
    })

    return NextResponse.json({ success: true, created: created.count }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar produção extra:', error)
    return NextResponse.json({ error: 'Erro ao criar produção extra' }, { status: 500 })
  }
}

// ============================================================
// DELETE /api/producao/extra?id=xxx
// ============================================================
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    await db.producaoExtra.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar produção extra:', error)
    return NextResponse.json({ error: 'Erro ao deletar' }, { status: 500 })
  }
}
