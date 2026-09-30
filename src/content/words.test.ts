// Implements: plan://M4#4.3 — тесты загрузчика контента на реальных data/words
import { describe, expect, it } from 'vitest'
import { YOUNG_MATURE_DAYS, WORD_CARD_ORDER } from '../domain/srs/types'
import { cardId, createFirstCards, loadWordNotes } from './words'

const NOW = new Date(2026, 8, 28, 10, 0, 0)

describe('loadWordNotes (data/words)', () => {
  it('грузит все chunk-файлы NGSL в заметки', async () => {
    const notes = await loadWordNotes()
    expect(notes.length).toBeGreaterThanOrEqual(3900)
    const ids = new Set(notes.map(({ id }) => id))
    expect(ids.size).toBe(notes.length)
  })

  it('поля заметки: en=lemma, ru=первый перевод, audio из en_gb', async () => {
    const notes = await loadWordNotes()
    const house = notes.find(({ en }) => en === 'house')
    expect(house).toBeDefined()
    expect(house?.deck).toBe('words')
    expect(house?.id).toMatch(/^note_/)
    expect(house?.ru.length).toBeGreaterThan(0)
    expect(house?.audio).toMatch(/^audio\/words\/cori\/.+\.opus$/)

    const withoutRu = notes.filter(({ ru }) => !ru)
    expect(withoutRu).toEqual([])
    const withoutAudio = notes.filter(({ audio }) => !audio)
    expect(withoutAudio).toEqual([])
  })
})

describe('createFirstCards (srs://rule-1)', () => {
  it('по одной en-ru карточке на заметку, состояние New', async () => {
    const notes = await loadWordNotes()
    const cards = createFirstCards(notes, NOW)
    expect(cards).toHaveLength(notes.length)
    expect(cards.every(({ type }) => type === WORD_CARD_ORDER[0])).toBe(true)

    const card = cards.find(({ note_id }) => note_id === notes[0].id)
    expect(card?.card_id).toBe(cardId(notes[0].entityId, 'en-ru'))
    expect(card?.state).toBe(0)
    expect(card?.due).toBe(NOW.toISOString())
    expect(card?.reps).toBe(0)
    expect(card?.last_review).toBeNull()
    expect(card?.suspended).toBe(false)
    expect(card?.cloze_index).toBeNull()
    expect(card?.scheduled_days).toBeLessThanOrEqual(YOUNG_MATURE_DAYS)
  })

  it('id карточек уникальны', async () => {
    const notes = await loadWordNotes()
    const cards = createFirstCards(notes, NOW)
    expect(new Set(cards.map(({ card_id }) => card_id)).size).toBe(cards.length)
  })
})

// Implements: plan://M19 — loadWordRanks: суб-полоса и NGSL-минимум
describe('loadWordRanks (ветки полос)', () => {
  it('NGSL-слово — числовой ранг; субтитровое — Infinity; дубль берёт минимум', async () => {
    const { loadWordRanks } = await import('./words')
    const ranks = await loadWordRanks()
    const ngsl = [...ranks.entries()].find(([, rank]) => Number.isFinite(rank))
    expect(ngsl).toBeTruthy()
    // суб-полоса (words-2810-4000 и далее) — Infinity
    const sub = [...ranks.entries()].filter(([, rank]) => rank === Number.POSITIVE_INFINITY)
    expect(sub.length).toBeGreaterThan(100)
  })
})
