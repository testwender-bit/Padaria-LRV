import { redirect } from 'next/navigation'

// v9.9.0: A gestão de Lanches mudou para a aba "Lanches" dentro de
// /configuracoes (junto com Escolas, PF e PCQ). Esta página é mantida
// apenas como redirecionamento para não quebrar links antigos/favoritos.
export default function LanchesPage() {
  redirect('/configuracoes?tab=lanches')
}
