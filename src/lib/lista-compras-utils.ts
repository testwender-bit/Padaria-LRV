// ============================================================
// LISTA DE COMPRAS — Normalização de nomes + categorias + ordem
// ============================================================
//
// Cada ingrediente do banco (Alimento.nome) pode aparecer com variações:
// "Mandioca descascada", "Mandioca", "Mandioca cozida" → todos devem virar
// um único item na lista de compras, com a quantidade somada.
//
// Este módulo define:
// 1. LISTA_CANONICA — lista de ingredientes na ordem exata que o usuário quer
//    ver na lista de compras (hortifruti → frutas → polpas → laticínios →
//    carnes → bebidas → padaria → mercearia → especiarias → padaria/confeitaria)
// 2. CATEGORIA por ingrediente
// 3. MAPA_VARIACOES — mapeia variações conhecidas para o nome canônico
// 4. normalizarNomeIngrediente(nome) → retorna o nome canônico
// 5. obterCategoria(nome) → retorna a categoria
// 6. ordenarItens(itens) → ordena conforme LISTA_CANONICA
// ============================================================

// ── Categorias (na ordem de exibição) ──────────────────────────
export const CATEGORIAS_LISTA = [
  'HORTIFRUTI',
  'FRUTAS',
  'POLPAS',
  'LATICINIOS',
  'CARNES_PROTEINAS',
  'BEBIDAS_LACTEAS',
  'PADARIA',
  'MERCEARIA_SECA',
  'ESPECIARIAS',
  'PADARIA_CONFEITARIA',
] as const

export type CategoriaLista = typeof CATEGORIAS_LISTA[number]

export const CATEGORIA_LABELS: Record<CategoriaLista, string> = {
  HORTIFRUTI: 'Hortifruti (Legumes e Verduras)',
  FRUTAS: 'Frutas',
  POLPAS: 'Polpas de Frutas',
  LATICINIOS: 'Laticínios',
  CARNES_PROTEINAS: 'Carnes e Proteínas',
  BEBIDAS_LACTEAS: 'Bebidas Lácteas e Leites',
  PADARIA: 'Padaria',
  MERCEARIA_SECA: 'Mercearia Seca',
  ESPECIARIAS: 'Especiarias e Condimentos',
  PADARIA_CONFEITARIA: 'Padaria/Confeitaria (Atacado)',
}

// ── Lista canônica na ordem EXATA que o usuário quer ───────────
// Cada item: { nome: string, categoria: CategoriaLista, unidade: string }
// `unidade` é a unidade de compra preferida (kg, L, unid, pct, etc.)
type ItemCanonico = {
  nome: string
  categoria: CategoriaLista
  unidade: string
}

export const LISTA_CANONICA: ItemCanonico[] = [
  // ── HORTIFRUTI (legumes e verduras) ──
  { nome: 'Abóbora Cabotiá', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Abóbora Paulista', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Abobrinha Verde', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Acelga', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Alface', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Alho', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Almeirão', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Batata doce', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Batata Inglesa', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Berinjela', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Beterraba', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Brócolis', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Cebola', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Cenoura', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Cheiro verde', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Chuchu', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Couve Manteiga', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Ervilha verde congelada', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Mandioca descascada', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Maxixe', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Milho verde espiga', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Pepino', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Pimenta de cheiro', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Pimentão', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Quiabo', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Repolho roxo', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Repolho verde', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Rúcula', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Tomate', categoria: 'HORTIFRUTI', unidade: 'kg' },
  { nome: 'Vagem', categoria: 'HORTIFRUTI', unidade: 'kg' },

  // ── FRUTAS ──
  { nome: 'Abacaxi', categoria: 'FRUTAS', unidade: 'kg' },
  { nome: 'Banana da terra', categoria: 'FRUTAS', unidade: 'kg' },
  { nome: 'Banana maçã', categoria: 'FRUTAS', unidade: 'kg' },
  { nome: 'Banana nanica', categoria: 'FRUTAS', unidade: 'kg' },
  { nome: 'Goiaba', categoria: 'FRUTAS', unidade: 'kg' },
  { nome: 'Laranja', categoria: 'FRUTAS', unidade: 'kg' },
  { nome: 'Limão comum', categoria: 'FRUTAS', unidade: 'kg' },
  { nome: 'Maçã', categoria: 'FRUTAS', unidade: 'kg' },
  { nome: 'Mamão formosa', categoria: 'FRUTAS', unidade: 'kg' },
  { nome: 'Manga', categoria: 'FRUTAS', unidade: 'kg' },
  { nome: 'Melancia', categoria: 'FRUTAS', unidade: 'kg' },
  { nome: 'Melão', categoria: 'FRUTAS', unidade: 'kg' },
  { nome: 'Mexerica ou Poncã', categoria: 'FRUTAS', unidade: 'kg' },
  { nome: 'Pitaya', categoria: 'FRUTAS', unidade: 'kg' },
  { nome: 'Uva vermelha', categoria: 'FRUTAS', unidade: 'kg' },

  // ── POLPAS ──
  { nome: 'Polpa de abacaxi', categoria: 'POLPAS', unidade: 'kg' },
  { nome: 'Polpa de acerola', categoria: 'POLPAS', unidade: 'kg' },
  { nome: 'Polpa de caju', categoria: 'POLPAS', unidade: 'kg' },
  { nome: 'Polpa de cupuaçu', categoria: 'POLPAS', unidade: 'kg' },
  { nome: 'Polpa de goiaba', categoria: 'POLPAS', unidade: 'kg' },
  { nome: 'Polpa de manga', categoria: 'POLPAS', unidade: 'kg' },
  { nome: 'Polpa de maracujá', categoria: 'POLPAS', unidade: 'kg' },

  // ── LATICÍNIOS ──
  { nome: 'Manteiga (500g)', categoria: 'LATICINIOS', unidade: 'unid' },
  { nome: 'Margarina sem lactose', categoria: 'LATICINIOS', unidade: 'kg' },
  { nome: 'Margarina sem leite', categoria: 'LATICINIOS', unidade: 'kg' },
  { nome: 'Nata', categoria: 'LATICINIOS', unidade: 'kg' },

  // ── CARNES E PROTEÍNAS ──
  { nome: 'Carne bovina de 1ª (patinho)', categoria: 'CARNES_PROTEINAS', unidade: 'kg' },
  { nome: 'Carne bovina de 2ª em isca', categoria: 'CARNES_PROTEINAS', unidade: 'kg' },
  { nome: 'Carne bovina de 2ª em cubo', categoria: 'CARNES_PROTEINAS', unidade: 'kg' },
  { nome: 'Carne bovina moída', categoria: 'CARNES_PROTEINAS', unidade: 'kg' },
  { nome: 'Carne de Ovino', categoria: 'CARNES_PROTEINAS', unidade: 'kg' },
  { nome: 'Carne Suína', categoria: 'CARNES_PROTEINAS', unidade: 'kg' },
  { nome: 'Coxa e sobrecoxa', categoria: 'CARNES_PROTEINAS', unidade: 'kg' },
  { nome: 'Coxa e sobrecoxa S/ osso', categoria: 'CARNES_PROTEINAS', unidade: 'kg' },
  { nome: 'Fígado Bovino', categoria: 'CARNES_PROTEINAS', unidade: 'kg' },
  { nome: 'Filé de peito de frango', categoria: 'CARNES_PROTEINAS', unidade: 'kg' },
  { nome: 'Filé de tilápia (800g)', categoria: 'CARNES_PROTEINAS', unidade: 'kg' },
  { nome: 'Linguiça calabresa', categoria: 'CARNES_PROTEINAS', unidade: 'kg' },
  { nome: 'Ovos de galinha (dz)', categoria: 'CARNES_PROTEINAS', unidade: 'dz' },
  { nome: 'Salsicha', categoria: 'CARNES_PROTEINAS', unidade: 'kg' },

  // ── BEBIDAS LÁCTEAS E LEITES ──
  { nome: 'Bebida láctea', categoria: 'BEBIDAS_LACTEAS', unidade: 'L' },
  { nome: 'Iogurte Natural (850g)', categoria: 'BEBIDAS_LACTEAS', unidade: 'unid' },
  { nome: 'Leite integral (cx 12 litros)', categoria: 'BEBIDAS_LACTEAS', unidade: 'cx' },
  { nome: 'Pão de forma Integral', categoria: 'BEBIDAS_LACTEAS', unidade: 'unid' },

  // ── PADARIA ──
  // (Pão de forma Integral está em BEBIDAS_LACTEAS conforme lista do usuário;
  // outros pães podem ser adicionados aqui se necessário.)

  // ── MERCEARIA SECA ──
  { nome: 'Açúcar', categoria: 'MERCEARIA_SECA', unidade: 'kg' },
  { nome: 'Adoçante stévia', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Amido de milho', categoria: 'MERCEARIA_SECA', unidade: 'kg' },
  { nome: 'Arroz Branco', categoria: 'MERCEARIA_SECA', unidade: 'kg' },
  { nome: 'Aveia em flocos', categoria: 'MERCEARIA_SECA', unidade: 'kg' },
  { nome: 'Azeite de dendê (200ml)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Bebida vegetal de aveia', categoria: 'MERCEARIA_SECA', unidade: 'L' },
  { nome: 'Biscoito água e sal (345g)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Biscoito de polvilho', categoria: 'MERCEARIA_SECA', unidade: 'kg' },
  { nome: 'Biscoito maisena (345g)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Biscoito sem glúten (150g)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Biscoito sem lactose (345g)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Biscoito diet (150g)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Cacau em pó 100% (500g)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Café (500g)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Canjica (500g)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Chá de Camomila (pct 100gr)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Chá de Erva doce (kg)', categoria: 'MERCEARIA_SECA', unidade: 'kg' },
  { nome: 'Chocolate em pó 50% (kg)', categoria: 'MERCEARIA_SECA', unidade: 'kg' },
  { nome: 'Coco ralado (Kg)', categoria: 'MERCEARIA_SECA', unidade: 'kg' },
  { nome: 'Doce de fruta (kg)', categoria: 'MERCEARIA_SECA', unidade: 'kg' },
  { nome: 'Doce de Leite balde (10kg)', categoria: 'MERCEARIA_SECA', unidade: 'balde' },
  { nome: 'Doce de leite balde (5kg)', categoria: 'MERCEARIA_SECA', unidade: 'balde' },
  { nome: 'Ervilha seca (500g)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Extrato de tomate 1,7kg', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Farinha de arroz (kg)', categoria: 'MERCEARIA_SECA', unidade: 'kg' },
  { nome: 'Farinha de mandioca (kg)', categoria: 'MERCEARIA_SECA', unidade: 'kg' },
  { nome: 'Farinha para kibe (500g)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Feijão carioca (kg)', categoria: 'MERCEARIA_SECA', unidade: 'kg' },
  { nome: 'Feijão de corda/caupi (kg)', categoria: 'MERCEARIA_SECA', unidade: 'kg' },
  { nome: 'Feijão preto (kg)', categoria: 'MERCEARIA_SECA', unidade: 'kg' },
  { nome: 'Flocão de milho (pacote 500gr)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Fórmula infantil APLV', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Fórmula infantil de 1º segmento', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Fórmula infantil de 2º segmento', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Fórmula infantil de soja', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Fórmula infantil de soja 3º segmento', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Leite em pó integral (kg)', categoria: 'MERCEARIA_SECA', unidade: 'kg' },
  { nome: 'Fubá (kg)', categoria: 'MERCEARIA_SECA', unidade: 'kg' },
  { nome: 'Leite de coco (L)', categoria: 'MERCEARIA_SECA', unidade: 'L' },
  { nome: 'Leite sem lactose (L)', categoria: 'MERCEARIA_SECA', unidade: 'L' },
  { nome: 'Lentilha (500g)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Macarrão caracol (500g)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Macarrão de arroz (500g)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Macarrão espaguete (500g)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Macarrão para sopa (500g)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Macarrão parafuso (500g)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Macarrão penne (pct 500gr)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Milho verde (1,7kg)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Óleo de soja (900ml)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Pão sem glúten', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Proteína de soja (kg)', categoria: 'MERCEARIA_SECA', unidade: 'kg' },
  { nome: 'Quirera (500g)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Sal pct de (kg)', categoria: 'MERCEARIA_SECA', unidade: 'kg' },
  { nome: 'Tapioca (500g)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Uva passa (200g)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },
  { nome: 'Vinagre branco (750ml)', categoria: 'MERCEARIA_SECA', unidade: 'unid' },

  // ── ESPECIARIAS E CONDIMENTOS ──
  { nome: 'Condimento: Colorau (pct 500gr)', categoria: 'ESPECIARIAS', unidade: 'unid' },
  { nome: 'Condimento: Açafrão (30g)', categoria: 'ESPECIARIAS', unidade: 'unid' },
  { nome: 'Condimento: Canela em pó (30g)', categoria: 'ESPECIARIAS', unidade: 'unid' },
  { nome: 'Condimento: Cravo da índia (50g)', categoria: 'ESPECIARIAS', unidade: 'unid' },
  { nome: 'Condimento: Curry (50g)', categoria: 'ESPECIARIAS', unidade: 'unid' },
  { nome: 'Condimento: Louro (5g)', categoria: 'ESPECIARIAS', unidade: 'unid' },
  { nome: 'Condimento: Orégano (100g)', categoria: 'ESPECIARIAS', unidade: 'unid' },
  { nome: 'Noz Moscada (30g)', categoria: 'ESPECIARIAS', unidade: 'unid' },

  // ── PADARIA/CONFEITARIA (atacado) ──
  { nome: 'Banha de porco', categoria: 'PADARIA_CONFEITARIA', unidade: 'kg' },
  { nome: 'Farinha Pronta (25kg)', categoria: 'PADARIA_CONFEITARIA', unidade: 'saco' },
  { nome: 'Farinha Pura (25kg)', categoria: 'PADARIA_CONFEITARIA', unidade: 'saco' },
  { nome: 'Fermento biológico (500g)', categoria: 'PADARIA_CONFEITARIA', unidade: 'unid' },
  { nome: 'Fermento químico (kg)', categoria: 'PADARIA_CONFEITARIA', unidade: 'kg' },
  { nome: 'Goiabada (kg)', categoria: 'PADARIA_CONFEITARIA', unidade: 'kg' },
  { nome: 'Margarina balde (15kg)', categoria: 'PADARIA_CONFEITARIA', unidade: 'balde' },
  { nome: 'Polvilho azedo (kg)', categoria: 'PADARIA_CONFEITARIA', unidade: 'kg' },
  { nome: 'Polvilho doce (kg)', categoria: 'PADARIA_CONFEITARIA', unidade: 'kg' },
  { nome: 'Química melhorador (5kg)', categoria: 'PADARIA_CONFEITARIA', unidade: 'unid' },
  { nome: 'Sal Amoníaco (kg)', categoria: 'PADARIA_CONFEITARIA', unidade: 'kg' },
]

// ── Mapa de variações → nome canônico ──────────────────────────
// Chave = nome "limpo" (lowercase, sem acentos, sem qualificadores de
// preparo), valor = nome canônico exato (como aparece em LISTA_CANONICA).
//
// IMPORTANTE: o algoritmo de normalização primeiro aplica limparNomeIngrediente
// (remove "cozido", "cru", "picado", etc.), depois normaliza acentos/case,
// depois procura neste mapa. Se não encontrar, retorna o nome limpo original
// (e o item aparecerá numa categoria "OUTROS" no final da lista).
const MAPA_VARIACOES: Record<string, string> = {
  // Hortifruti — variações comuns
  'abobora cabotia': 'Abóbora Cabotiá',
  'abobora paulista': 'Abóbora Paulista',
  'abobrinha': 'Abobrinha Verde',
  'abobrinha verde': 'Abobrinha Verde',
  'acelga': 'Acelga',
  'alface': 'Alface',
  'alho': 'Alho',
  'almeirao': 'Almeirão',
  'batata doce': 'Batata doce',
  'batata inglesa': 'Batata Inglesa',
  'batata': 'Batata Inglesa',  // alias
  'berinjela': 'Berinjela',
  'beterraba': 'Beterraba',
  'brocolis': 'Brócolis',
  'cebola': 'Cebola',
  'cenoura': 'Cenoura',
  'cheiro verde': 'Cheiro verde',
  'salsa': 'Cheiro verde',  // alias
  'salsinha': 'Cheiro verde',  // alias
  'chuchu': 'Chuchu',
  'couve manteiga': 'Couve Manteiga',
  'couve': 'Couve Manteiga',  // alias
  'ervilha verde congelada': 'Ervilha verde congelada',
  'ervilha congelada': 'Ervilha verde congelada',
  'mandioca descascada': 'Mandioca descascada',
  'mandioca': 'Mandioca descascada',  // alias
  'aipim': 'Mandioca descascada',  // alias
  'macaxeira': 'Mandioca descascada',  // alias
  'maxixe': 'Maxixe',
  'milho verde espiga': 'Milho verde espiga',
  'milho espiga': 'Milho verde espiga',
  'pepino': 'Pepino',
  'pimenta de cheiro': 'Pimenta de cheiro',
  'pimentao': 'Pimentão',
  'quiabo': 'Quiabo',
  'repolho roxo': 'Repolho roxo',
  'repolho verde': 'Repolho verde',
  'repolho': 'Repolho verde',  // alias
  'rucula': 'Rúcula',
  'tomate': 'Tomate',
  'tomate pelado': 'Tomate',  // alias
  'vagem': 'Vagem',

  // Frutas
  'abacaxi': 'Abacaxi',
  'banana da terra': 'Banana da terra',
  'banana maca': 'Banana maçã',
  'banana nanica': 'Banana nanica',
  'banana': 'Banana nanica',  // alias
  'goiaba': 'Goiaba',
  'laranja': 'Laranja',
  'limao comum': 'Limão comum',
  'limao': 'Limão comum',  // alias
  'maca': 'Maçã',
  'mamao formosa': 'Mamão formosa',
  'mamao': 'Mamão formosa',  // alias
  'manga': 'Manga',
  'melancia': 'Melancia',
  'melao': 'Melão',
  'mexerica ou ponca': 'Mexerica ou Poncã',
  'mexerica': 'Mexerica ou Poncã',
  'ponca': 'Mexerica ou Poncã',
  'tangerina': 'Mexerica ou Poncã',
  'pitaya': 'Pitaya',
  'uva vermelha': 'Uva vermelha',
  'uva': 'Uva vermelha',  // alias

  // Polpas
  'polpa de abacaxi': 'Polpa de abacaxi',
  'polpa de acerola': 'Polpa de acerola',
  'polpa de caju': 'Polpa de caju',
  'polpa de cupuacu': 'Polpa de cupuaçu',
  'polpa de goiaba': 'Polpa de goiaba',
  'polpa de manga': 'Polpa de manga',
  'polpa de maracuja': 'Polpa de maracujá',

  // Laticínios
  'manteiga': 'Manteiga (500g)',
  'manteiga 500g': 'Manteiga (500g)',
  'margarina sem lactose': 'Margarina sem lactose',
  'margarina sem leite': 'Margarina sem leite',
  'nata': 'Nata',
  'queijo': 'Nata',  // alias aproximado (se aparecer, vai para Nata)
  'requeijao': 'Nata',  // alias

  // Carnes
  'carne bovina de 1': 'Carne bovina de 1ª (patinho)',
  'carne bovina de 1a': 'Carne bovina de 1ª (patinho)',
  'patinho': 'Carne bovina de 1ª (patinho)',
  'carne bovina de 2 isca': 'Carne bovina de 2ª em isca',
  'carne bovina isca': 'Carne bovina de 2ª em isca',
  'isca bovina': 'Carne bovina de 2ª em isca',
  'carne bovina de 2 cubo': 'Carne bovina de 2ª em cubo',
  'carne bovina em cubos': 'Carne bovina de 2ª em cubo',
  'carne bovina moida': 'Carne bovina moída',
  'carne moida': 'Carne bovina moída',
  'patinho moido': 'Carne bovina moída',
  'carne de ovino': 'Carne de Ovino',
  'carne ovina': 'Carne de Ovino',
  'carne suina': 'Carne Suína',
  'pernil': 'Carne Suína',  // alias
  'coxa e sobrecoxa': 'Coxa e sobrecoxa',
  'frango coxa sobrecoxa': 'Coxa e sobrecoxa',
  'coxa e sobrecoxa s osso': 'Coxa e sobrecoxa S/ osso',
  'coxa e sobrecoxa sem osso': 'Coxa e sobrecoxa S/ osso',
  'figado bovino': 'Fígado Bovino',
  'figado': 'Fígado Bovino',  // alias
  'file de peito de frango': 'Filé de peito de frango',
  'peito de frango': 'Filé de peito de frango',
  'file de frango': 'Filé de peito de frango',
  'file de tilapia': 'Filé de tilápia (800g)',
  'tilapia': 'Filé de tilápia (800g)',
  'linguica calabresa': 'Linguiça calabresa',
  'calabresa': 'Linguiça calabresa',  // alias
  'ovos de galinha': 'Ovos de galinha (dz)',
  'ovo': 'Ovos de galinha (dz)',
  'ovos': 'Ovos de galinha (dz)',
  'salsicha': 'Salsicha',

  // Bebidas lácteas
  'bebida lactea': 'Bebida láctea',
  'iogurte natural': 'Iogurte Natural (850g)',
  'iogurte': 'Iogurte Natural (850g)',
  'leite integral': 'Leite integral (cx 12 litros)',
  'leite': 'Leite integral (cx 12 litros)',  // alias
  'pao de forma integral': 'Pão de forma Integral',
  'pao de forma': 'Pão de forma Integral',  // alias

  // Mercearia seca
  'acucar': 'Açúcar',
  'adocante stevia': 'Adoçante stévia',
  'adocante': 'Adoçante stévia',
  'amido de milho': 'Amido de milho',
  'maisena': 'Amido de milho',  // alias
  'arroz branco': 'Arroz Branco',
  'arroz': 'Arroz Branco',  // alias
  'aveia em flocos': 'Aveia em flocos',
  'aveia': 'Aveia em flocos',
  'azeite de dende': 'Azeite de dendê (200ml)',
  'dende': 'Azeite de dendê (200ml)',
  'bebida vegetal de aveia': 'Bebida vegetal de aveia',
  'leite de aveia': 'Bebida vegetal de aveia',  // alias
  'biscoito agua e sal': 'Biscoito água e sal (345g)',
  'biscoito de polvilho': 'Biscoito de polvilho',
  'biscoito maisena': 'Biscoito maisena (345g)',
  'biscoito sem gluten': 'Biscoito sem glúten (150g)',
  'biscoito sem lactose': 'Biscoito sem lactose (345g)',
  'biscoito diet': 'Biscoito diet (150g)',
  'cacau em po': 'Cacau em pó 100% (500g)',
  'cacau': 'Cacau em pó 100% (500g)',
  'chocolate em po': 'Chocolate em pó 50% (kg)',
  'cafe': 'Café (500g)',
  'canjica': 'Canjica (500g)',
  'cha de camomila': 'Chá de Camomila (pct 100gr)',
  'cha de erva doce': 'Chá de Erva doce (kg)',
  'coco ralado': 'Coco ralado (Kg)',
  'doce de fruta': 'Doce de fruta (kg)',
  'doce de leite balde 10kg': 'Doce de Leite balde (10kg)',
  'doce de leite balde 5kg': 'Doce de leite balde (5kg)',
  'doce de leite': 'Doce de Leite balde (10kg)',  // alias
  'ervilha seca': 'Ervilha seca (500g)',
  'extrato de tomate': 'Extrato de tomate 1,7kg)',
  'extrato tomate': 'Extrato de tomate 1,7kg',
  'farinha de arroz': 'Farinha de arroz (kg)',
  'farinha de mandioca': 'Farinha de mandioca (kg)',
  'farinha para kibe': 'Farinha para kibe (500g)',
  'trigo para kibe': 'Farinha para kibe (500g)',  // alias
  'feijao carioca': 'Feijão carioca (kg)',
  'feijao': 'Feijão carioca (kg)',  // alias
  'feijao de corda': 'Feijão de corda/caupi (kg)',
  'feijao caupi': 'Feijão de corda/caupi (kg)',
  'feijao preto': 'Feijão preto (kg)',
  'flocao de milho': 'Flocão de milho (pacote 500gr)',
  'flocao': 'Flocão de milho (pacote 500gr)',
  'formula infantil aplv': 'Fórmula infantil APLV',
  'formula infantil de 1 segmento': 'Fórmula infantil de 1º segmento',
  'formula infantil 1': 'Fórmula infantil de 1º segmento',
  'formula infantil de 2 segmento': 'Fórmula infantil de 2º segmento',
  'formula infantil 2': 'Fórmula infantil de 2º segmento',
  'formula infantil de soja': 'Fórmula infantil de soja',
  'formula infantil de soja 3 segmento': 'Fórmula infantil de soja 3º segmento',
  'leite em po integral': 'Leite em pó integral (kg)',
  'leite em po': 'Leite em pó integral (kg)',
  'fuba': 'Fubá (kg)',
  'fuba de milho': 'Fubá (kg)',
  'leite de coco': 'Leite de coco (L)',
  'leite sem lactose': 'Leite sem lactose (L)',
  'lentilha': 'Lentilha (500g)',
  'macarrao caracol': 'Macarrão caracol (500g)',
  'macarrao de arroz': 'Macarrão de arroz (500g)',
  'macarrao espaguete': 'Macarrão espaguete (500g)',
  'espiguete': 'Macarrão espaguete (500g)',
  'macarrao para sopa': 'Macarrão para sopa (500g)',
  'macarrao parafuso': 'Macarrão parafuso (500g)',
  'macarrao penne': 'Macarrão penne (pct 500gr)',
  'macarrao': 'Macarrão espaguete (500g)',  // alias genérico
  'macarrao trigo': 'Macarrão espaguete (500g)',  // TACO: "Macarrão, Trigo, Cru"
  'milho verde': 'Milho verde (1,7kg)',
  'milho': 'Milho verde (1,7kg)',  // alias
  'flocos de milho': 'Flocão de milho (pacote 500gr)',  // TACO: "Flocos de Milho (cuscuz)"
  'oleo de soja': 'Óleo de soja (900ml)',
  'oleo': 'Óleo de soja (900ml)',  // alias
  'pao sem gluten': 'Pão sem glúten',
  'proteina de soja': 'Proteína de soja (kg)',
  'pts': 'Proteína de soja (kg)',  // alias
  'quirera': 'Quirera (500g)',
  'sal': 'Sal pct de (kg)',
  'sal refinado': 'Sal pct de (kg)',
  'tapioca': 'Tapioca (500g)',
  'uva passa': 'Uva passa (200g)',
  'vinagre branco': 'Vinagre branco (750ml)',
  'vinagre': 'Vinagre branco (750ml)',  // alias

  // Especiarias
  'colorau': 'Condimento: Colorau (pct 500gr)',
  'condimento colorau': 'Condimento: Colorau (pct 500gr)',
  'colorifero': 'Condimento: Colorau (pct 500gr)',  // alias
  'acafrao': 'Condimento: Açafrão (30g)',
  'condimento acafrao': 'Condimento: Açafrão (30g)',
  'curcuma': 'Condimento: Açafrão (30g)',  // alias
  'canela em po': 'Condimento: Canela em pó (30g)',
  'condimento canela': 'Condimento: Canela em pó (30g)',
  'canela': 'Condimento: Canela em pó (30g)',
  'cravo da india': 'Condimento: Cravo da índia (50g)',
  'condimento cravo': 'Condimento: Cravo da índia (50g)',
  'cravo': 'Condimento: Cravo da índia (50g)',
  'curry': 'Condimento: Curry (50g)',
  'condimento curry': 'Condimento: Curry (50g)',
  'louro': 'Condimento: Louro (5g)',
  'folha de louro': 'Condimento: Louro (5g)',
  'condimento louro': 'Condimento: Louro (5g)',
  'oregano': 'Condimento: Orégano (100g)',
  'condimento oregano': 'Condimento: Orégano (100g)',
  'noz moscada': 'Noz Moscada (30g)',

  // Padaria/Confeitaria
  'banha de porco': 'Banha de porco',
  'banha': 'Banha de porco',  // alias
  'farinha pronta': 'Farinha Pronta (25kg)',
  'farinha pura': 'Farinha Pura (25kg)',
  'fermento biologico': 'Fermento biológico (500g)',
  'fermento po': 'Fermento biológico (500g)',  // alias (fermento de pão)
  'fermento quimico': 'Fermento químico (kg)',
  'fermento': 'Fermento químico (kg)',  // alias genérico
  'goiabada': 'Goiabada (kg)',
  'margarina balde': 'Margarina balde (15kg)',
  'polvilho azedo': 'Polvilho azedo (kg)',
  'polvilho doce': 'Polvilho doce (kg)',
  'polvilho': 'Polvilho doce (kg)',  // alias
  'quimica melhorador': 'Química melhorador (5kg)',
  'melhorador de farinha': 'Química melhorador (5kg)',
  'sal amoniaco': 'Sal Amoníaco (kg)',

  // ── v9.6: Padrões TACO específicos que faltavam ──
  // Farinha de trigo (TACO: "Farinha, de Trigo") — não estava na lista canônica
  // original, mas é muito comum. Adicionada como item de Padaria/Confeitaria.
  'farinha de trigo': 'Farinha Pura (25kg)',
  'farinha trigo': 'Farinha Pura (25kg)',

  // Margarina genérica (TACO: "Margarina" sem qualificador)
  'margarina': 'Margarina balde (15kg)',  // alias genérico → vai para balde (atacado)

  // Coco (TACO: "Coco, Cru") → mapeia para Coco ralado
  'coco': 'Coco ralado (Kg)',

  // Vinagre tinto (TACO: "Vinagre Tinto")
  'vinagre tinto': 'Vinagre branco (750ml)',  // alias — mesmo item na lista de compras

  // Extrato de tomate — typo no mapa original tinha parêntese extra
  'extrato de tomate 1 7kg': 'Extrato de tomate 1,7kg',
  'extrato de tomate 1,7kg': 'Extrato de tomate 1,7kg',

  // Água — não é um item de compra (não aparece na lista canônica).
  // Mapeamos para uma string que será filtrada ou aparece em OUTROS.
  'agua': 'Água',  // será exibida em OUTROS (não está na LISTA_CANONICA)

  // Carne bovina acem (TACO: "Carne, Bovina, Acem, sem Gordura, Cru")
  // Após limpar: "carne bovina" → match por substring com "carne bovina de 2"
  // Mas para ser mais específico, mapeamos acem para "Carne bovina de 2ª em cubo"
  'carne bovina acem': 'Carne bovina de 2ª em cubo',
  'acem': 'Carne bovina de 2ª em cubo',

  // Leite de vaca integral (TACO: "Leite, de Vaca, Integral")
  // Após limpar descritores "de vaca" → "leite integral" → já mapeado

  // Ovo de galinha (TACO: "Ovo, de Galinha, Cru")
  // Após limpar "de galinha" e "cru" → "ovo" → match por substring com "ovos de galinha"
  // Mas "ovo" tem length 3 (< 4), então não pega no substring match.
  // Adicionamos explicitamente:
  'ovo de galinha': 'Ovos de galinha (dz)',
}

// ── Helpers de normalização ────────────────────────────────────

// Remove acentos e converte para lowercase
function semAcentos(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

// v9.6: Limpa profundamente o nome do ingrediente.
// 1. Substitui vírgulas por espaços (TACO usa "Abobrinha, Verde, Crua")
// 2. Remove descritores de preparo (cozido, cru, picado, ralado, etc.)
// 3. Remove descritores de variedade TACO (verde, crespa, fuji, pera,
//    tipo 1, branca, cristal, acem, sem gordura, com sal, etc.)
// 4. Remove parênteses e seu conteúdo
// 5. Colapsa espaços múltiplos
function limparNomeTaco(s: string): string {
  let r = s.toLowerCase()
  // 1. Vírgulas → espaços
  r = r.replace(/,/g, ' ')
  // 2. Parênteses e conteúdo → remove
  r = r.replace(/\([^)]*\)/g, ' ')
  // 3. Remove descritores de preparo E variedade TACO
  //    Lista ampliada baseada nos nomes reais do banco TACO
  const descritores = [
    // Preparo
    'cozido', 'cozida', 'cozidos', 'cozidas',
    'cru', 'crus', 'crua', 'cruas',
    'picado', 'picada', 'picados', 'picadas',
    'ralado', 'ralada', 'ralados', 'raladas',
    'cortado', 'cortada', 'cortados', 'cortadas',
    'descascado', 'descascada', 'descascados', 'descascadas',
    'fresco', 'fresca', 'frescos', 'frescas',
    'seco', 'seca', 'secos', 'secas',
    'inteiro', 'inteira', 'inteiros', 'inteiras',
    'maduro', 'madura', 'maduros', 'maduras',
    'em cubos', 'em isca', 'em tiras', 'em rodelas', 'em pedacos', 'em pedaços',
    'sem gordura', 'com sal', 'sem sal',
    // Variedade / tipo (TACO descriptors)
    'verde', 'verdes',
    'crespa', 'crespo',
    'fuji', 'pera', 'gala', 'argentina',
    'tipo 1', 'tipo 2', 'tipo a', 'tipo b',
    'branca', 'branco',
    'cristal',
    'acem', 'acém',
    'moido', 'moída', 'moidos', 'moídas',
    'sem osso', 'com osso',
    'bovina', 'bovino',
    'suina', 'suíno', 'suíno',
    'de vaca', 'de galinha',
    // Outros descritores comuns
    'natural', 'industrializado', 'industrializada',
    'comum', 'especial',
    'extrativa',
    'organico', 'organica', 'orgânico', 'orgânica',
  ]
  for (const d of descritores) {
    // Remove o descritor como palavra completa (\b)
    r = r.replace(new RegExp(`\\b${d}\\b`, 'g'), ' ')
  }
  // 4. Colapsa espaços múltiplos
  r = r.replace(/\s+/g, ' ').trim()
  return r
}

/**
 * Normaliza o nome de um ingrediente para o nome canônico da lista de compras.
 *
 * Algoritmo v9.6:
 * 1. Remove acentos e converte para lowercase
 * 2. Limpa profundamente (vírgulas, parênteses, descritores TACO)
 * 3. Procura no MAPA_VARIACOES (match exato)
 * 4. Se não encontrar, tenta MATCH POR SUBSTRING: para cada chave do mapa,
 *    verifica se o nome limpo CONTÉM a chave. Isso pega casos como
 *    "carne bovina acem moido" → contém "carne bovina" → match.
 * 5. Se ainda não encontrar, retorna o nome limpo em title case (vai para OUTROS)
 *
 * @param nome Nome original do ingrediente (do banco Alimento.nome)
 * @returns Nome canônico (como aparece em LISTA_CANONICA) ou nome limpo
 */
export function normalizarNomeIngrediente(nome: string): string {
  if (!nome) return ''
  const semAcentosLower = semAcentos(nome)
  const limpo = limparNomeTaco(semAcentosLower)

  // 1. Match exato no mapa
  if (MAPA_VARIACOES[limpo]) return MAPA_VARIACOES[limpo]
  if (MAPA_VARIACOES[semAcentosLower]) return MAPA_VARIACOES[semAcentosLower]

  // 2. Match por substring — para cada chave do mapa, verifica se o nome
  //    limpo CONTÉM a chave. Prioriza chaves mais longas (mais específicas).
  const chavesOrdenadas = Object.keys(MAPA_VARIACOES)
    .filter((k) => k.length >= 4)  // ignora chaves muito curtas (ex: "ovo")
    .sort((a, b) => b.length - a.length)  // mais longas primeiro
  for (const chave of chavesOrdenadas) {
    if (limpo.includes(chave)) {
      return MAPA_VARIACOES[chave]
    }
  }

  // 3. Não encontrado — retorna nome limpo em title case (vai para OUTROS)
  return titleCase(limpo)
}

function titleCase(s: string): string {
  return s
    .split(' ')
    .map((w, i) => {
      if (i > 0 && ['de', 'da', 'do', 'das', 'dos', 'e', 'ou', 'a', 'o', 'em', 'para', 'com', 'sem'].includes(w)) {
        return w
      }
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
}

/**
 * Retorna a categoria de um ingrediente pelo seu nome canônico.
 * Se não encontrar, retorna 'OUTROS'.
 */
export function obterCategoria(nomeCanonico: string): CategoriaLista | 'OUTROS' {
  const item = LISTA_CANONICA.find((i) => i.nome === nomeCanonico)
  return item ? item.categoria : 'OUTROS'
}

/**
 * Retorna a unidade de compra preferida para um ingrediente.
 * Se não encontrar, retorna 'kg' como padrão.
 */
export function obterUnidade(nomeCanonico: string): string {
  const item = LISTA_CANONICA.find((i) => i.nome === nomeCanonico)
  return item ? item.unidade : 'kg'
}

/**
 * Retorna o índice de ordem de um ingrediente na LISTA_CANONICA.
 * Itens não encontrados recebem índice 9999 (vão para o final).
 */
function obterIndiceOrdem(nomeCanonico: string): number {
  return LISTA_CANONICA.findIndex((i) => i.nome === nomeCanonico)
}

/**
 * Ordena uma lista de itens conforme a ordem da LISTA_CANONICA.
 * Cada item deve ter a propriedade `nome_canonico`.
 * Itens não mapeados vão para o final, ordenados alfabeticamente.
 */
export function ordenarItens<T extends { nome_canonico: string }>(itens: T[]): T[] {
  return [...itens].sort((a, b) => {
    const idxA = obterIndiceOrdem(a.nome_canonico)
    const idxB = obterIndiceOrdem(b.nome_canonico)
    // Itens não mapeados (idx = -1) recebem 9999 para irem ao final
    const ordA = idxA === -1 ? 9999 : idxA
    const ordB = idxB === -1 ? 9999 : idxB
    if (ordA !== ordB) return ordA - ordB
    // Desempate: alfabético
    return a.nome_canonico.localeCompare(b.nome_canonico, 'pt-BR')
  })
}

// ── Tipos de saída da API ──────────────────────────────────────

export interface ItemListaComprasConsolidado {
  alimento_id: string
  nome_original: string  // nome do banco (pode ter variação)
  nome_canonico: string  // nome normalizado
  categoria: CategoriaLista | 'OUTROS'
  unidade: string
  qtd_total_gramas: number
  qtd_total_kg: number
  qtd_total_unidade: number  // convertido para a unidade canônica (se aplicável)
  por_escola: Array<{
    escola_id: string
    escola_nome: string
    escola_curto: string
    qtd_gramas: number
  }>
}

export interface ListaComprasResultado {
  modo: 'PREVISAO' | 'PEDIDO'
  periodo: {
    data_inicio: string  // YYYY-MM-DD
    data_fim: string
    descricao: string  // texto amigável
  }
  escolas: Array<{
    id: string
    nome: string
    nome_curto: string
    categoria: string
    rota: string
    alunos_parcial: number
    alunos_integral: number
  }>
  cardapios_utilizados: Array<{
    id: string
    nome: string
    categoria_escola: string
    fase_escolar: string
  }>
  semanas_consideradas: Array<{
    numero: number
    data_inicio: string
    data_fim: string
  }>
  totais: {
    total_escolas: number
    total_alunos_parcial: number
    total_alunos_integral: number
    total_itens: number
    total_kg: number
  }
  por_categoria: Array<{
    categoria: CategoriaLista | 'OUTROS'
    label: string
    itens: number
    kg: number
  }>
  itens: ItemListaComprasConsolidado[]
  // v9.6: aviso opcional quando não encontra cardápio com semanas no período
  aviso?: string
}
