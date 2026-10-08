// Implements: plan://M4#4.3 — тесты загрузчика контента на реальных data/words
import { describe, expect, it } from 'vitest'
import { YOUNG_MATURE_DAYS, WORD_CARD_ORDER, type Note } from '../domain/srs/types'
import {
  cardId,
  createFirstCards,
  loadWordNotes,
  makeWordBandFilter,
  wordBandAllowed,
} from './words'

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
    expect(house?.audio).toMatch(/^audio\/words\/[a-z0-9-]+\/.+\.opus$/)

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

  it('chunkSlot-заметка получает вторую карточку chunk (Q2.2)', () => {
    const notes: Note[] = [
      {
        id: 'note_ph-1',
        deck: 'phrases',
        entityId: 'ph-1',
        en: "I'd like to book a table.",
        ru: 'Я хотел бы забронировать столик.',
        chunkSlot: 'book',
      },
    ]
    const cards = createFirstCards(notes, NOW)
    expect(cards.map(({ type }) => type)).toEqual(['en-ru', 'chunk'])
    expect(cards[1]).toMatchObject({
      card_id: 'ph-1.chunk',
      note_id: 'note_ph-1',
      deck: 'phrases',
      state: 0,
      suspended: false,
    })
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

describe('wordBandAllowed (U3.2: слова — из полосы текущего ранга)', () => {
  const ranks = new Map([
    ['house-noun', 500],
    ['mislead-verb', 3900],
    ['sub-word', Number.POSITIVE_INFINITY],
  ])

  it('в полосе — да; выше полосы — нет; субтитровые — только на полосе S', () => {
    expect(wordBandAllowed('house-noun', 1000, ranks)).toBe(true)
    expect(wordBandAllowed('mislead-verb', 1000, ranks)).toBe(false)
    expect(wordBandAllowed('mislead-verb', 4000, ranks)).toBe(true)
    expect(wordBandAllowed('sub-word', 4000, ranks)).toBe(false)
    expect(wordBandAllowed('sub-word', 5000, ranks)).toBe(true)
  })

  it('не-слова (нет в карте рангов) — всегда допуск', () => {
    expect(wordBandAllowed('ph-c-0001', 300, ranks)).toBe(true)
  })
})

describe('makeWordBandFilter (U3.2: фильтр новых карточек дня)', () => {
  const ranks = new Map([
    ['house-noun', 500],
    ['mislead-verb', 3900],
  ])
  const notes = new Map([
    ['note_house-noun', 'house-noun'],
    ['note_mislead-verb', 'mislead-verb'],
  ])
  const allow = makeWordBandFilter(1000, ranks, notes)

  it('не-слова и заметки без entityId — проходят; слова — по полосе', () => {
    expect(allow({ deck: 'phrases', note_id: 'note_ph-1' })).toBe(true)
    expect(allow({ deck: 'words', note_id: 'note_unknown' })).toBe(true)
    expect(allow({ deck: 'words', note_id: 'note_house-noun' })).toBe(true)
    expect(allow({ deck: 'words', note_id: 'note_mislead-verb' })).toBe(false)
  })
})
