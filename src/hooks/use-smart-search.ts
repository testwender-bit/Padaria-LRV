// ============================================================
// hooks/use-smart-search.ts
// ============================================================
// Hook de busca inteligente com:
//   - useDeferredValue para filtragem instantânea sem travar
//   - Normalização (sem acento, case-insensitive)
//   - Busca por palavras parciais (cada palavra é buscada)
//   - Highlight do texto matching
//   - Ordenação por relevância (mais matches primeiro)
// ============================================================

import { useState, useMemo, useDeferredValue, useCallback } from 'react'
import { normalizeText } from '@/lib/busca-utils'

export interface SearchResult<T> {
  item: T
  score: number  // 0-1, quanto maior mais relevante
  matchedWords: string[]
}

export function useSmartSearch<T>(
  items: T[],
  getSearchableText: (item: T) => string,
  options: {
    minQueryLength?: number  // mínimo de caracteres para começar a buscar (default: 0)
    maxResults?: number      // limite de resultados (default: sem limite)
  } = {}
) {
  const { minQueryLength = 0, maxResults } = options
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const results = useMemo((): Array<SearchResult<T>> => {
    const q = normalizeText(deferredQuery).trim()

    if (q.length < minQueryLength) {
      // Sem query ou muito curta — retorna tudo com score 0
      const all = items.map(item => ({
        item,
        score: 0,
        matchedWords: [],
      }))
      return maxResults ? all.slice(0, maxResults) : all
    }

    // Divide a query em palavras
    const queryWords = q.split(/\s+/).filter(w => w.length > 0)

    const scored = items.map(item => {
      const text = normalizeText(getSearchableText(item))
      let score = 0
      const matchedWords: string[] = []

      for (const qw of queryWords) {
        if (text.includes(qw)) {
          score += 1
          matchedWords.push(qw)
          // Bônus se a palavra está no início do texto
          if (text.startsWith(qw)) score += 0.5
        }
      }

      // Normaliza score: 0-1
      const normalizedScore = queryWords.length > 0 ? score / (queryWords.length * 1.5) : 0

      return { item, score: normalizedScore, matchedWords }
    })

    // Filtra só os que têm pelo menos 1 match
    const filtered = scored.filter(r => r.score > 0)

    // Ordena por score (mais relevante primeiro)
    filtered.sort((a, b) => b.score - a.score)

    return maxResults ? filtered.slice(0, maxResults) : filtered
  }, [items, deferredQuery, getSearchableText, minQueryLength, maxResults])

  const clear = useCallback(() => setQuery(''), [])

  return {
    query,
    setQuery,
    results,
    clear,
    hasQuery: deferredQuery.trim().length > 0,
    resultCount: results.length,
  }
}

// ── Helper para highlight de texto ───────────────────────────

export function highlightMatch(text: string, query: string): Array<{ text: string; match: boolean }> {
  if (!query.trim()) return [{ text, match: false }]

  const normalizedText = normalizeText(text)
  const queryWords = normalizeText(query).split(/\s+/).filter(w => w.length > 0)

  if (queryWords.length === 0) return [{ text, match: false }]

  // Encontra todas as posições de match
  const matchRanges: Array<[number, number]> = []

  for (const qw of queryWords) {
    let idx = 0
    while ((idx = normalizedText.indexOf(qw, idx)) !== -1) {
      matchRanges.push([idx, idx + qw.length])
      idx += qw.length
    }
  }

  if (matchRanges.length === 0) return [{ text, match: false }]

  // Ordena ranges por posição
  matchRanges.sort((a, b) => a[0] - b[0])

  // Mescla ranges sobrepostos
  const merged: Array<[number, number]> = []
  for (const [start, end] of matchRanges) {
    if (merged.length > 0 && start <= merged[merged.length - 1][1]) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], end)
    } else {
      merged.push([start, end])
    }
  }

  // Constrói partes
  const parts: Array<{ text: string; match: boolean }> = []
  let lastEnd = 0
  for (const [start, end] of merged) {
    if (start > lastEnd) {
      parts.push({ text: text.slice(lastEnd, start), match: false })
    }
    parts.push({ text: text.slice(start, end), match: true })
    lastEnd = end
  }
  if (lastEnd < text.length) {
    parts.push({ text: text.slice(lastEnd), match: false })
  }

  return parts
}
