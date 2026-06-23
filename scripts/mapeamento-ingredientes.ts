// ============================================================
// Mapeamento DEFINITIVO: ingrediente da ficha → alimento TACO
// ============================================================
// Criado manualmente com análise de cada ingrediente.
// Para itens não-TACO, marcados como "custom" (serão criados
// no banco com valores do backup).
// ============================================================

// Mapeamento: nome normalizado do ingrediente da ficha → {
//   taco_codigo: number | null,  // null = criar custom
//   taco_nome: string,           // nome oficial TACO ou nome custom
//   obs: string                  // observação do porque da escolha
// }

export const MAPEAMENTO_INGREDIENTES: Record<string, {
  taco_codigo: number | null
  taco_nome: string
  obs: string
}> = {
  // ── Cereais e derivados ──
  'arroz': { taco_codigo: 4, taco_nome: 'Arroz, tipo 1, cru', obs: 'Tipo 1 = mais comum no Brasil. Cru porque o sistema calcula cocção.' },
  'arroz cru': { taco_codigo: 4, taco_nome: 'Arroz, tipo 1, cru', obs: 'Mesmo que "arroz"' },
  'aveia': { taco_codigo: 7, taco_nome: 'Aveia, flocos, crua', obs: 'Flocos é a forma mais comum' },
  'aveia em flocos': { taco_codigo: 7, taco_nome: 'Aveia, flocos, crua', obs: 'Mesmo que "aveia"' },
  'amido de milho': { taco_codigo: 42, taco_nome: 'Milho, amido, cru', obs: 'Amido de milho = maisena' },
  'flocos de milho': { taco_codigo: 22, taco_nome: 'Cereais, milho, flocos, sem sal', obs: 'Flocos de milho sem sal' },
  'fuba': { taco_codigo: 43, taco_nome: 'Milho, fubá, cru', obs: 'Fubá de milho' },
  'fuba de milho': { taco_codigo: 43, taco_nome: 'Milho, fubá, cru', obs: 'Mesmo que "fubá"' },
  'macarrao de sopa': { taco_codigo: 40, taco_nome: 'Macarrão, trigo, cru', obs: 'Macarrão de sopa = trigo cru' },
  'macarrao espaguete': { taco_codigo: 40, taco_nome: 'Macarrão, trigo, cru', obs: 'Espaguete = macarrão de trigo' },
  'macarrao espaguete ou parafuso': { taco_codigo: 40, taco_nome: 'Macarrão, trigo, cru', obs: 'Tanto espaguete quanto parafuso = trigo cru' },
  'milho verde': { taco_codigo: 44, taco_nome: 'Milho, verde, cru', obs: 'Milho verde fresco' },
  'milho para canjica': { taco_codigo: 44, taco_nome: 'Milho, verde, cru', obs: 'Milho para canjica = milho verde' },
  'farinha de mandioca': { taco_codigo: 121, taco_nome: 'Farinha, de mandioca, crua', obs: 'Farinha de mandioca crua' },
  'quirera': { taco_codigo: 43, taco_nome: 'Milho, fubá, cru', obs: 'Quirera = fubá grosso, usar fubá como aproximação' },
  'quirerinha': { taco_codigo: 43, taco_nome: 'Milho, fubá, cru', obs: 'Quirerinha = fubá fino' },
  'pao': { taco_codigo: 53, taco_nome: 'Pão, trigo, francês', obs: 'Pão francês = mais comum' },
  'pao frances': { taco_codigo: 53, taco_nome: 'Pão, trigo, francês', obs: 'Pão francês' },
  'trigo para quibe': { taco_codigo: null, taco_nome: 'Trigo para quibe', obs: 'Não está na TACO — criar custom' },

  // ── Leguminosas ──
  'feijao': { taco_codigo: 562, taco_nome: 'Feijão, carioca, cru', obs: 'Carioca = mais comum no Brasil' },
  'feijao carioca': { taco_codigo: 562, taco_nome: 'Feijão, carioca, cru', obs: 'Carioca cru' },
  'feijao de corda': { taco_codigo: 564, taco_nome: 'Feijão, fradinho, cru', obs: 'De corda = fradinho' },
  'feijao preto': { taco_codigo: 568, taco_nome: 'Feijão, preto, cru', obs: 'Preto cru' },
  'lentilha': { taco_codigo: 578, taco_nome: 'Lentilha, crua', obs: 'Lentilha crua' },
  'ervilha': { taco_codigo: 559, taco_nome: 'Ervilha, em vagem', obs: 'Ervilha fresca em vagem' },
  'ervilha congelada': { taco_codigo: 559, taco_nome: 'Ervilha, em vagem', obs: 'Ervilha congelada ≈ fresca' },
  'ervilha seca': { taco_codigo: 560, taco_nome: 'Ervilha, enlatada, drenada', obs: 'Ervilha seca ≈ enlatada (aproximação)' },

  // ── Hortaliças ──
  'abobora cabotia': { taco_codigo: 65, taco_nome: 'Abóbora, cabotian, crua', obs: 'Cabotiá = cabotian' },
  'abobora moranga': { taco_codigo: 67, taco_nome: 'Abóbora, moranga, crua', obs: 'Moranga crua' },
  'abobora moranga/cabotia': { taco_codigo: 65, taco_nome: 'Abóbora, cabotian, crua', obs: 'Quando misto, usar cabotian (mais comum)' },
  'abobora paulista': { taco_codigo: 69, taco_nome: 'Abobora, pescoço, crua', obs: 'Paulista = pescoço' },
  'abobora paulista ou moranga': { taco_codigo: 67, taco_nome: 'Abóbora, moranga, crua', obs: 'Moranga como opção principal' },
  'abobrinha': { taco_codigo: 71, taco_nome: 'Abobrinha, italiana, crua', obs: 'Italiana = mais comum' },
  'abobrinha verde': { taco_codigo: 71, taco_nome: 'Abobrinha, italiana, crua', obs: 'Verde = italiana' },
  'alface': { taco_codigo: 78, taco_nome: 'Alface, crespa, crua', obs: 'Crespa = mais comum' },
  'alho': { taco_codigo: 82, taco_nome: 'Alho, cru', obs: 'Alho cru' },
  'beterraba': { taco_codigo: 98, taco_nome: 'Beterraba, crua', obs: 'Beterraba crua' },
  'brocolis': { taco_codigo: 101, taco_nome: 'Brócolis, cru', obs: 'Brócolis cru' },
  'cebola': { taco_codigo: 107, taco_nome: 'Cebola, crua', obs: 'Cebola crua' },
  'cenoura': { taco_codigo: 110, taco_nome: 'Cenoura, crua', obs: 'Cenoura crua' },
  'cenoura ou abobora': { taco_codigo: 110, taco_nome: 'Cenoura, crua', obs: 'Assumir cenoura como padrão' },
  'chuchu': { taco_codigo: 113, taco_nome: 'Chuchu, cru', obs: 'Chuchu cru' },
  'couve manteiga': { taco_codigo: 115, taco_nome: 'Couve, manteiga, crua', obs: 'Couve manteiga crua' },
  'pepino': { taco_codigo: 142, taco_nome: 'Pepino, cru', obs: 'Pepino cru' },
  'pimentao': { taco_codigo: 145, taco_nome: 'Pimentão, vermelho, cru', obs: 'Vermelho = mais saboroso' },
  'pimentao verde': { taco_codigo: 144, taco_nome: 'Pimentão, verde, cru', obs: 'Pimentão verde' },
  'quiabo': { taco_codigo: 147, taco_nome: 'Quiabo, cru', obs: 'Quiabo cru' },
  'repolho': { taco_codigo: 149, taco_nome: 'Repolho, branco, cru', obs: 'Branco = mais comum' },
  'repolho verde': { taco_codigo: 149, taco_nome: 'Repolho, branco, cru', obs: 'Verde = branco' },
  'rucula': { taco_codigo: 152, taco_nome: 'Rúcula, crua', obs: 'Rúcula crua' },
  'tomate': { taco_codigo: 157, taco_nome: 'Tomate, com semente, cru', obs: 'Tomate com semente' },
  'mandioca': { taco_codigo: 130, taco_nome: 'Mandioca, crua', obs: 'Mandioca crua' },
  'mandioca descascada': { taco_codigo: 130, taco_nome: 'Mandioca, crua', obs: 'Mandioca descascada = crua' },
  'batata doce': { taco_codigo: 89, taco_nome: 'Batata, doce, crua', obs: 'Batata doce crua' },
  'batata doce/inglesa': { taco_codigo: 89, taco_nome: 'Batata, doce, crua', obs: 'Assumir doce como padrão' },
  'batata inglesa': { taco_codigo: 92, taco_nome: 'Batata, inglesa, crua', obs: 'Batata inglesa crua' },

  // ── Frutas ──
  'abacaxi': { taco_codigo: 164, taco_nome: 'Abacaxi, cru', obs: 'Abacaxi cru' },
  'acerola': { taco_codigo: 169, taco_nome: 'Acerola, crua', obs: 'Acerola crua' },
  'banana': { taco_codigo: 179, taco_nome: 'Banana, nanica, crua', obs: 'Nanica = mais comum' },
  'banana da terra': { taco_codigo: 175, taco_nome: 'Banana, da terra, crua', obs: 'Da terra' },
  'banana maca': { taco_codigo: 178, taco_nome: 'Banana, maçã, crua', obs: 'Maçã' },
  'banana nanica': { taco_codigo: 179, taco_nome: 'Banana, nanica, crua', obs: 'Nanica' },
  'caqui': { taco_codigo: 189, taco_nome: 'Caqui, chocolate, cru', obs: 'Caqui (único disponível na TACO)' },
  'goiaba': { taco_codigo: 200, taco_nome: 'Goiaba, vermelha, com casca, crua', obs: 'Vermelha = mais comum' },
  'laranja': { taco_codigo: 208, taco_nome: 'Laranja, baía, crua', obs: 'Baía = mais comum para suco' },
  'limao': { taco_codigo: 220, taco_nome: 'Limão, tahiti, cru', obs: 'Tahiti = mais comum' },
  'maca': { taco_codigo: 222, taco_nome: 'Maçã, Fuji, com casca, crua', obs: 'Fuji = mais comum' },
  'maca nacional': { taco_codigo: 222, taco_nome: 'Maçã, Fuji, com casca, crua', obs: 'Nacional = Fuji' },
  'mamão': { taco_codigo: 225, taco_nome: 'Mamão, Formosa, cru', obs: 'Formosa = mais comum em escolas' },
  'mamão formosa': { taco_codigo: 225, taco_nome: 'Mamão, Formosa, cru', obs: 'Formosa' },
  'manga': { taco_codigo: 231, taco_nome: 'Manga, Tommy Atkins, crua', obs: 'Tommy Atkins = mais comum' },
  'melancia': { taco_codigo: 235, taco_nome: 'Melancia, crua', obs: 'Melancia' },
  'melao': { taco_codigo: 236, taco_nome: 'Melão, cru', obs: 'Melão' },
  'maracuja': { taco_codigo: 232, taco_nome: 'Maracujá, cru', obs: 'Maracujá cru' },
  'pokan': { taco_codigo: null, taco_nome: 'Poncã', obs: 'Poncã não está na TACO — criar custom' },
  'uva': { taco_codigo: 256, taco_nome: 'Uva, Itália, crua', obs: 'Itália = mais comum' },

  // ── Polpas ──
  'polpa caju': { taco_codigo: null, taco_nome: 'Polpa de caju', obs: 'Não está na TACO — criar custom' },
  'polpa de abacaxi': { taco_codigo: 165, taco_nome: 'Abacaxi, polpa, congelada', obs: 'Polpa de abacaxi TACO' },
  'polpa de acerola': { taco_codigo: 170, taco_nome: 'Acerola, polpa, congelada', obs: 'Polpa de acerola TACO' },
  'polpa de cupuacu': { taco_codigo: null, taco_nome: 'Polpa de cupuaçu', obs: 'Não está na TACO — criar custom' },
  'polpa de goiaba': { taco_codigo: null, taco_nome: 'Polpa de goiaba', obs: 'TACO tem goiaba fresca, não polpa — criar custom' },
  'polpa de manga': { taco_codigo: 230, taco_nome: 'Manga, polpa, congelada', obs: 'Polpa de manga TACO' },
  'polpa de maracuja': { taco_codigo: 233, taco_nome: 'Maracujá, polpa, congelada', obs: 'Polpa de maracujá TACO' },

  // ── Carnes ──
  'carne bovina em pedaco': { taco_codigo: 326, taco_nome: 'Carne, bovina, acém, moído, cru', obs: 'Acém = corte mais comum para pedaços' },
  'carne bovina moida': { taco_codigo: 326, taco_nome: 'Carne, bovina, acém, moído, cru', obs: 'Acém moído = carne moída' },
  'carne moida': { taco_codigo: 326, taco_nome: 'Carne, bovina, acém, moído, cru', obs: 'Carne moída = acém moído' },
  'carne suina': { taco_codigo: null, taco_nome: 'Carne suína', obs: 'TACO tem cortes específicos — usar custom genérico' },
  'carne suina em cubos': { taco_codigo: null, taco_nome: 'Carne suína em cubos', obs: 'Usar custom' },
  'figado bovino': { taco_codigo: 355, taco_nome: 'Carne, bovina, fígado, cru', obs: 'Fígado bovino cru' },
  'file de peito de frango': { taco_codigo: 409, taco_nome: 'Frango, peito, sem pele, cru', obs: 'Peito sem pele cru' },
  'peito de frango': { taco_codigo: 409, taco_nome: 'Frango, peito, sem pele, cru', obs: 'Peito sem pele cru' },
  'coxa e sobrecoxa': { taco_codigo: 397, taco_nome: 'Frango, coxa, com pele, crua', obs: 'Coxa com pele (sobrecoxa similar)' },
  'file de tilapia': { taco_codigo: null, taco_nome: 'Filé de tilápia', obs: 'Tilápia não está na TACO — criar custom' },
  'salsicha': { taco_codigo: null, taco_nome: 'Salsicha', obs: 'TACO não tem salsicha simples — criar custom' },
  'calabresa': { taco_codigo: null, taco_nome: 'Linguiça calabresa', obs: 'Não está na TACO — criar custom' },
  'linguica calabresa': { taco_codigo: null, taco_nome: 'Linguiça calabresa', obs: 'Não está na TACO — criar custom' },

  // ── Ovos e laticínios ──
  'ovo': { taco_codigo: 489, taco_nome: 'Ovo, de galinha, inteiro, cru', obs: 'Ovo cru' },
  'ovo mexido': { taco_codigo: 489, taco_nome: 'Ovo, de galinha, inteiro, cru', obs: 'Assumir cru (sistema calcula)' },
  'leite': { taco_codigo: 458, taco_nome: 'Leite, de vaca, integral', obs: 'Integral = mais comum' },
  'leite de vaca integral uht': { taco_codigo: 458, taco_nome: 'Leite, de vaca, integral', obs: 'UHT integral' },
  'leite integral uht': { taco_codigo: 458, taco_nome: 'Leite, de vaca, integral', obs: 'UHT integral' },
  'leite de coco': { taco_codigo: 523, taco_nome: 'Leite, de coco', obs: 'Leite de coco TACO' },
  'manteiga': { taco_codigo: 261, taco_nome: 'Manteiga, com sal', obs: 'Com sal = mais comum' },
  'margarina': { taco_codigo: null, taco_nome: 'Margarina', obs: 'Não está na TACO — criar custom' },
  'requeijao caseiro': { taco_codigo: 468, taco_nome: 'Queijo, requeijão, cremoso', obs: 'Requeijão caseiro ≈ cremoso' },
  'doce de leite': { taco_codigo: 501, taco_nome: 'Doce, de leite, cremoso', obs: 'Doce de leite TACO' },
  'doce de fruta': { taco_codigo: null, taco_nome: 'Doce de fruta', obs: 'Não está na TACO — criar custom' },

  // ── Óleos e gorduras ──
  'oleo': { taco_codigo: null, taco_nome: 'Óleo de soja', obs: 'TACO não tem óleo puro — criar custom (óleo de soja)' },
  'oleo de soja': { taco_codigo: null, taco_nome: 'Óleo de soja', obs: 'Criar custom' },
  'azeite de dende': { taco_codigo: null, taco_nome: 'Azeite de dendê', obs: 'Não está na TACO — criar custom' },

  // ── Açúcares ──
  'acucar': { taco_codigo: 494, taco_nome: 'Açúcar, refinado', obs: 'Refinado = mais comum em receitas' },
  'sal': { taco_codigo: null, taco_nome: 'Sal refinado', obs: 'Não está na TACO — criar custom' },
  'sal refinado': { taco_codigo: null, taco_nome: 'Sal refinado', obs: 'Criar custom' },

  // ── Temperos e especiarias (todos custom) ──
  'acafrao': { taco_codigo: null, taco_nome: 'Açafrão da terra (cúrcuma) em pó', obs: 'Não está na TACO — criar custom' },
  'cacau': { taco_codigo: 183, taco_nome: 'Cacau, cru', obs: 'Cacau TACO' },
  'cafe': { taco_codigo: null, taco_nome: 'Café coado sem açúcar', obs: 'TACO tem pó, não bebida — criar custom' },
  'canela': { taco_codigo: null, taco_nome: 'Canela em pó', obs: 'Não está na TACO — criar custom' },
  'canela em po': { taco_codigo: null, taco_nome: 'Canela em pó', obs: 'Criar custom' },
  'cha de erva doce': { taco_codigo: null, taco_nome: 'Chá de erva-doce', obs: 'Não está na TACO — criar custom' },
  'cha mate': { taco_codigo: null, taco_nome: 'Chá mate', obs: 'Não está na TACO — criar custom' },
  'cheiro verde': { taco_codigo: 153, taco_nome: 'Salsa, crua', obs: 'Cheiro verde ≈ salsa (salsinha)' },
  'cheiro verde\nlouro': { taco_codigo: 153, taco_nome: 'Salsa, crua', obs: 'Cheiro verde com louro — usar salsa' },
  'chocolate 50%': { taco_codigo: 498, taco_nome: 'Chocolate, meio amargo', obs: '50% ≈ meio amargo' },
  'chocolate em po 50%': { taco_codigo: 498, taco_nome: 'Chocolate, meio amargo', obs: '50% ≈ meio amargo' },
  'coco ralado': { taco_codigo: 590, taco_nome: 'Coco, cru', obs: 'Coco ralado ≈ coco cru (aproximação)' },
  'colorau': { taco_codigo: null, taco_nome: 'Colorau (colorifício)', obs: 'Não está na TACO — criar custom' },
  'extrato de tomate': { taco_codigo: 158, taco_nome: 'Tomate, extrato', obs: 'Extrato de tomate TACO' },
  'extrato tomate': { taco_codigo: 158, taco_nome: 'Tomate, extrato', obs: 'Mesmo que "extrato de tomate"' },
  'molho de carne moida': { taco_codigo: null, taco_nome: 'Molho de carne moída', obs: 'Não está na TACO — criar custom' },
  'molho de salsicha': { taco_codigo: null, taco_nome: 'Molho de salsicha', obs: 'Não está na TACO — criar custom' },
  'oregano': { taco_codigo: null, taco_nome: 'Orégano seco', obs: 'Não está na TACO — criar custom' },
  'pasta de frango (pate de frango)': { taco_codigo: null, taco_nome: 'Pasta de frango (patê de frango)', obs: 'Não está na TACO — criar custom' },
  'pimenta de cheiro': { taco_codigo: null, taco_nome: 'Pimenta de cheiro', obs: 'Não está na TACO — criar custom' },
  'proteina de soja': { taco_codigo: null, taco_nome: 'Proteína texturizada de soja', obs: 'Não está na TACO — criar custom' },
  'proteina texturizada de soja': { taco_codigo: null, taco_nome: 'Proteína texturizada de soja', obs: 'Criar custom' },
  'suco de limao': { taco_codigo: null, taco_nome: 'Suco de limão', obs: 'TACO tem limão tahiti — criar custom de suco' },
  'vinagre': { taco_codigo: null, taco_nome: 'Vinagre', obs: 'Não está na TACO — criar custom' },
  'vinagre branco': { taco_codigo: null, taco_nome: 'Vinagre branco', obs: 'Criar custom' },
  'vinagre tinto': { taco_codigo: null, taco_nome: 'Vinagre tinto', obs: 'Criar custom' },
  'agua': { taco_codigo: null, taco_nome: 'Água', obs: 'Não está na TACO — criar custom' },
}
