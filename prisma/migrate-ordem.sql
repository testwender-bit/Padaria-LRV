-- v8: Adiciona campo ordem em CardapioItem
ALTER TABLE CardapioItem ADD COLUMN ordem INTEGER NOT NULL DEFAULT 0;
