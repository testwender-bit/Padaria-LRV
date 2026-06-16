'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Wheat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { motion } from 'framer-motion'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Preencha todos os campos')
      return
    }

    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Email ou senha inválidos')
        setLoading(false)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Erro ao fazer login. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1A3A5C] via-[#2C5282] to-[#1A3A5C] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#D4A017] to-[#E8B84B] shadow-2xl shadow-amber-500/30 mb-4">
            <Wheat className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Padaria Municipal</h1>
          <p className="text-blue-200 text-sm mt-1">Lucas do Rio Verde - MT</p>
          <p className="text-blue-300/70 text-xs mt-1">Sistema de Planejamento de Produção Escolar</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@padaria.municipal"
                className="h-11"
                autoFocus
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="h-11"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2"
              >
                {error}
              </motion.div>
            )}

            <Button
              type="submit"
              disabled={loading || !email.trim() || !password.trim()}
              className="w-full h-11 bg-gradient-to-r from-[#1A3A5C] to-[#2C5282] hover:from-[#2C5282] hover:to-[#1A3A5C] text-white font-semibold shadow-lg transition-all duration-300"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Entrando...
                </div>
              ) : (
                'Entrar no Sistema'
              )}
            </Button>
          </div>

          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
              onClick={() => setError('Funcionalidade em desenvolvimento')}
            >
              Esqueceu a senha?
            </button>
          </div>

          <p className="text-center text-xs text-gray-400 mt-3">
            Acesso restrito — Sistema de produção escolar
          </p>
        </form>
      </motion.div>
    </div>
  )
}
