import { redirect } from 'next/navigation'

// v9.10.9: A página de Romaneio foi INATIVADA. O romaneio do motorista já sai
// na impressão da Produção (seção "Romaneio" no fim da impressão — botão
// Imprimir), que é o único fluxo usado pela equipe. Esta página é mantida
// apenas como redirecionamento para não quebrar links antigos/favoritos
// (mesmo padrão da /lanches na v9.9.0).
// IMPORTANTE:
//  - A API /api/romaneio continua ATIVA — é a fonte de dados da folha do
//    motorista impressa pela página de Produção.
//  - O código original desta página está no histórico do git (última versão
//    ativa: patch v9.10.8) e pode ser restaurado se o fluxo voltar a ser
//    necessário.
export default function RomaneioPage() {
  redirect('/producao')
}
