// ============================================================
// prisma/seed-users.ts
// ============================================================
// Cria os 5 usuários do sistema a partir do arquivo users.env
// (não commitado — apenas no ambiente de deploy).
//
// Formato do users.env (uma linha por usuário):
//   USER_1=Ana Nutricionista|ana@padaria.lrv.gov.br|senhaForte1
//   USER_2=João Coordenador|joao@padaria.lrv.gov.br|senhaForte2
//   USER_3=Maria Auxiliar|maria@padaria.lrv.gov.br|senhaForte3
//   USER_4=Pedro Diretor|pedro@padaria.lrv.gov.br|senhaForte4
//   USER_5=Sofia Merendeira|sofia@padaria.lrv.gov.br|senhaForte5
//
// Campos separados por |: nome|email|senha
// Opcionalmente um 4º campo: role (admin | user | nutricionista)
//   USER_1=Ana Admin|ana@x.com|senha1|admin
//
// Uso:
//   1. Crie o arquivo users.env na raiz do projeto
//   2. npm run seed:users   (ou: npx tsx prisma/seed-users.ts)
//
// Idempotente: se o email já existe, ATUALIZA a senha (útil para
// redefinir senha de um usuário sem precisar excluir).
// ============================================================

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { config as loadEnv } from 'dotenv'

// Carrega .env (para DATABASE_URL)
loadEnv()

const prisma = new PrismaClient()

interface ParsedUser {
  name: string
  email: string
  password: string
  role: string
}

function parseUsersEnv(): ParsedUser[] {
  const envPath = path.resolve(process.cwd(), 'users.env')
  if (!fs.existsSync(envPath)) {
    console.error(`❌ Arquivo não encontrado: ${envPath}`)
    console.error('')
    console.error('Crie o arquivo users.env na raiz do projeto com o formato:')
    console.error('  USER_1=Nome Sobrenome|email@exemplo.com|senhaForte')
    console.error('  USER_2=Outro Nome|outro@exemplo.com|senhaForte')
    console.error('  ...até USER_5')
    console.error('')
    console.error('Campos separados por pipe |: nome|email|senha')
    console.error('Opcional: 4º campo = role (admin | user | nutricionista)')
    process.exit(1)
  }

  const content = fs.readFileSync(envPath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'))
  const users: ParsedUser[] = []

  for (const line of lines) {
    const match = line.match(/^USER_\d+\s*=\s*(.+)$/)
    if (!match) continue
    const parts = match[1].split('|').map(s => s.trim())
    if (parts.length < 3) {
      console.warn(`  ⚠️  Linha inválida (precisa de pelo menos nome|email|senha): ${line}`)
      continue
    }
    users.push({
      name: parts[0],
      email: parts[1].toLowerCase(),
      password: parts[2],
      role: parts[3] || 'user',
    })
  }

  if (users.length === 0) {
    console.error('❌ Nenhum usuário encontrado no users.env')
    process.exit(1)
  }

  if (users.length > 5) {
    console.warn(`⚠️  Encontrados ${users.length} usuários (recomendado: máximo 5).`)
  }

  return users
}

async function main() {
  console.log('\n👥 Seed de Usuários — Padaria Municipal LRV\n')

  const users = parseUsersEnv()
  console.log(`📋 ${users.length} usuário(s) encontrado(s) no users.env:\n`)
  users.forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.name.padEnd(30)} ${u.email.padEnd(40)} [${u.role}]`)
  })
  console.log('')

  let created = 0
  let updated = 0

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } })
    const hashedPassword = await bcrypt.hash(u.password, 10)
    const now = new Date().toISOString()

    if (existing) {
      // Atualiza senha e role (preserva id e ativo)
      await prisma.user.update({
        where: { email: u.email },
        data: {
          name: u.name,
          password: hashedPassword,
          role: u.role,
        },
      })
      updated++
      console.log(`  ↻ Atualizado: ${u.email}`)
    } else {
      await prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          password: hashedPassword,
          role: u.role,
          ativo: true,
          createdAt: now,
        },
      })
      created++
      console.log(`  ✓ Criado:     ${u.email}`)
    }
  }

  // Relatório final
  console.log('\n' + '═'.repeat(60))
  console.log(`✅ Concluído: ${created} criado(s), ${updated} atualizado(s)`)
  console.log(`📊 Total de usuários no banco: ${await prisma.user.count()}`)
  console.log('═'.repeat(60))

  if (created > 0) {
    console.log('\n⚠️  IMPORTANTE:')
    console.log('   • Apague o arquivo users.env após rodar este script:')
    console.log('     rm users.env')
    console.log('   • Verifique se users.env está no .gitignore')
  }
}

main()
  .catch((err) => {
    console.error('❌ Erro fatal:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
