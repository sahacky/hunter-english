// Implements: plan://M19 — покрытие quotes.ts (тайтлы/токены)
import { describe, expect, it } from 'vitest'
import { loadQuoteTitles, quoteWords } from './quotes'

describe('loadQuoteTitles', () => {
  it('все тайтлы со слагами, отсортированы по имени', async () => {
    const titles = await loadQuoteTitles()
    expect(titles.length).toBeGreaterThanOrEqual(15)
    expect(titles.some((t) => t.slug === 'supernatural' && t.quotes.length > 0)).toBe(true)
    const sorted = [...titles].sort((a, b) => a.title.localeCompare(b.title))
    expect(titles.map((t) => t.slug)).toEqual(sorted.map((t) => t.slug))
  })
})

describe('quoteWords', () => {
  it("токены: lowercase, без пунктуации, апострофы сохранены, «'s» срезается", () => {
    expect(quoteWords("Friends don't lie.")).toEqual(['friends', "don't", 'lie'])
    expect(quoteWords("It's Sam's!")).toEqual(['it', 'sam'])
    expect(quoteWords('123 !!! …')).toEqual([])
  })
})
