// Opções de unidade para lanches e insumos

export const UNIDADES_LANCHE = [
  { value: 'un', label: 'Unidade' },
  { value: 'kg', label: 'Quilograma' },
  { value: 'pacote', label: 'Pacote' },
  { value: 'caixa', label: 'Caixa' },
  { value: 'bandeja', label: 'Bandeja' },
  { value: 'litro', label: 'Litro' },
  { value: 'fatia', label: 'Fatia' },
]

export const UNIDADES_INSUMO = [
  { value: 'kg', label: 'Quilograma' },
  { value: 'g', label: 'Grama' },
  { value: 'L', label: 'Litro' },
  { value: 'ml', label: 'Mililitro' },
  { value: 'un', label: 'Unidade' },
  { value: 'saco', label: 'Saco' },
  { value: 'pacote', label: 'Pacote' },
  { value: 'cx', label: 'Caixa' },
]

export const CATEGORIAS_ESCOLA = [
  { value: 'REGULAR', label: 'Regular' },
  { value: 'INTEGRAL', label: 'Integral' },
  { value: 'BIFASICA', label: 'Bifásica' },
  { value: 'CRECHE', label: 'Creche' },
  { value: 'INTERIOR', label: 'Interior' },
  { value: 'APAE', label: 'APAE' },
  { value: 'OUTROS', label: 'Outros' },
]

export const ROTAS = [
  { value: 'JOSE', label: 'Motorista José' },
  { value: 'AROLDO', label: 'Motorista Aroldo' },
  { value: 'BUSCA_PROPRIA', label: 'Busca Própria' },
]

export const TIPOS_PAO = [
  { value: 'PADRAO', label: 'Padrão' },
  { value: 'PROTEINA', label: 'Proteína' },
  { value: 'SEMPAO', label: 'Sem Pão' },
]

// v9.8: Modos de lanche da BIFASICA.
// Define O QUE a bifásica recebe no slot de "lanche da tarde" da semana:
// - LANCHE: mesmo lanche das outras escolas (ex: bolacha caseira). Usa o
//   lanche_regular_id definido no cardápio da semana.
// - PAO_PADRAO: pão francês PADRÃO (mesmo do café da manhã, mas como lanche).
// - PAO_PROTEINA: pão francês PROTEÍNA (lanche com pão de proteína).
// - NENHUM: bifásica faz preparação na escola nesse dia — não recebe pão
//   nem lanche da padaria. Planilha PF usa SEMPAO; planilha Lanche não
//   recebe item para a bifásica.
// O pão francês para o café da manhã continua sendo entregue TODOS OS DIAS
// independentemente deste modo (é o PF da semana, controlado pelo tipo_pao).
export const LANCHE_BIFASICA_MODOS = [
  { value: 'LANCHE', label: 'Mesmo lanche das outras escolas' },
  { value: 'PAO_PADRAO', label: 'Pão Francês Padrão' },
  { value: 'PAO_PROTEINA', label: 'Pão Francês Proteína' },
  { value: 'NENHUM', label: 'Nenhum (preparação na escola)' },
]

// v9.9.0: Modos de lanche da escola INTERIOR marcada como "Interior Especial"
// (flag interior_especial na escola, em /configuracoes). Espelha EXATAMENTE
// o comportamento do LANCHE_BIFASICA_MODOS — mesma semântica, mesma tabela
// de valores, mas aplicado APENAS à escola do Interior que tiver a flag
// ligada. Demais escolas do Interior seguem o cardápio normal.
export const LANCHE_INTERIOR_MODOS = [
  { value: 'LANCHE', label: 'Mesmo lanche das outras escolas' },
  { value: 'PAO_PADRAO', label: 'Pão Francês Padrão' },
  { value: 'PAO_PROTEINA', label: 'Pão Francês Proteína' },
  { value: 'NENHUM', label: 'Nenhum (preparação na escola)' },
]

export const TIPOS_FERIADO = [
  { value: 'NACIONAL', label: 'Nacional' },
  { value: 'ESTADUAL', label: 'Estadual' },
  { value: 'MUNICIPAL', label: 'Municipal' },
  { value: 'ESCOLAR', label: 'Escolar' },
]

export const ACOES_FERIADO = [
  { value: 'zerar_dia', label: 'Zerar tudo no dia' },
  { value: 'zerar_pf', label: 'Zerar PF' },
  { value: 'zerar_pcq', label: 'Zerar PCQ' },
  { value: 'zerar_lanche', label: 'Zerar Lanche' },
  { value: 'apenas_observacao', label: 'Apenas observação' },
]

export const ESCOLAS_AFETADAS = [
  { value: 'TODAS', label: 'Todas' },
  { value: 'REGULARES', label: 'Regulares' },
  { value: 'INTEGRAIS', label: 'Integrais' },
  { value: 'CRECHES', label: 'Creches' },
  { value: 'BIFASICA', label: 'Bifásica' },
  { value: 'INTERIOR', label: 'Interior' },
  { value: 'APAE', label: 'APAE' },
  { value: 'OUTROS', label: 'Outros' },
]

export const PRODUTOS_AJUSTE = [
  { value: 'PF', label: 'Pão Francês' },
  { value: 'PCQ', label: 'Pão de Cachorro Quente' },
  { value: 'LANCHE', label: 'Lanche' },
  { value: 'PF_COMP', label: 'PF Complemento' },
]
