// Implements: plan://M4#4.1 — unit-тесты доменного ядра SRS (specs/03 §2, §4–§7)
import { describe, expect, it } from 'vitest'
import type { CardState, Note } from './types'
import {
  applyAnswer,
  buildQueue,
  createScheduler,
  dayStart,
  DEFAULT_NEW_LIMIT,
  isWakeUpDue,
  newLimitForDebt,
  sameStudyDay,
  studyDay,
  WORDS_NEW_DAILY_CAP,
} from './scheduler'

const NOW = new Date(2026, 8, 28, 10, 0, 0) // 2026-09-28 10:00 локально
const MINUTE = 60_000

let seq = 0

function mkNote(overrides: Partial<Note> = {}): Note {
  seq += 1
  return {
    id: `note_w${seq}`,
    deck: 'words',
    entityId: `w${seq}`,
    en: `word ${seq}`,
    ru: `слово ${seq}`,
    ...overrides,
  }
}

function mkCard(overrides: Partial<CardState> = {}): CardState {
  const note = overrides.note_id ? undefined : mkNote()
  return {
    card_id: `w${seq}.en-ru`,
    note_id: note ? note.id : (overrides.note_id as string),
    type: 'en-ru',
    deck: 'words',
    due: new Date(NOW.getTime() - MINUTE).toISOString(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    last_review: null,
    suspended: false,
    cloze_index: null,
    created_at: new Date(NOW.getTime() - 86_400_000).toISOString(),
    updated_at: new Date(NOW.getTime() - 86_400_000).toISOString(),
    ...overrides,
  }
}

describe('applyAnswer (specs/03 §2, §5–§6)', () => {
  it('новая карточка + Good → Learning, шаг 10 минут, запись лога', () => {
    const card = mkCard()
    const { next, log } = applyAnswer(card, 3, NOW, { logId: 'log-1' })

    expect(next.state).toBe(1)
    expect(next.due).toBe(new Date(NOW.getTime() + 10 * MINUTE).toISOString())
    expect(next.reps).toBe(1)
    expect(next.stability).toBeGreaterThan(0)
    expect(next.last_review).toBe(NOW.toISOString())
    expect(next.card_id).toBe(card.card_id)
    expect(next.created_at).toBe(card.created_at)
    expect(next.updated_at).toBe(NOW.toISOString())

    expect(log.id).toBe('log-1')
    expect(log.card_id).toBe(card.card_id)
    expect(log.rating).toBe(3)
    expect(log.state).toBe(0)
    expect(log.state_after).toBe(1)
    expect(log.reviewed_at).toBe(NOW.toISOString())
    expect(log.session_id).toBeNull()
    expect(log.client).toBe('web')
  })

  it('новая карточка + Easy → выпуск в Review с дневным интервалом', () => {
    const { next } = applyAnswer(mkCard(), 4, NOW, { logId: 'log-2' })
    expect(next.state).toBe(2)
    expect(next.scheduled_days).toBeGreaterThanOrEqual(1)
    expect(next.due).toBe(new Date(NOW.getTime() + next.scheduled_days * 86_400_000).toISOString())
  })

  it('Learning + Good → выпуск в Review', () => {
    const first = applyAnswer(mkCard(), 3, NOW, { logId: 'log-1' }).next
    const atStep = new Date(new Date(first.due).getTime())
    const second = applyAnswer(first, 3, atStep, { logId: 'log-2' })

    expect(second.next.state).toBe(2)
    expect(second.next.scheduled_days).toBeGreaterThanOrEqual(1)
    expect(second.log.state).toBe(1)
    expect(second.log.state_after).toBe(2)
  })

  it('Review + Again → Relearning, шаг минут, lapses +1', () => {
    const card = mkCard({
      state: 2,
      stability: 12,
      difficulty: 5,
      reps: 4,
      scheduled_days: 12,
      elapsed_days: 12,
      last_review: new Date(NOW.getTime() - 12 * 86_400_000).toISOString(),
      due: new Date(NOW.getTime() - 3 * 86_400_000).toISOString(),
    })
    const { next, log } = applyAnswer(card, 1, NOW, { logId: 'log-3' })

    expect(next.state).toBe(3)
    expect(next.lapses).toBe(card.lapses + 1)
    expect(next.scheduled_days).toBe(0)
    expect(new Date(next.due).getTime() - NOW.getTime()).toBe(5 * MINUTE)
    expect(log.state).toBe(2)
    expect(log.state_after).toBe(3)
  })

  it('Relearning + Good → возврат в Review', () => {
    const card = mkCard({
      state: 3,
      stability: 2,
      difficulty: 6,
      reps: 6,
      lapses: 1,
      last_review: new Date(NOW.getTime() - 5 * MINUTE).toISOString(),
      due: new Date(NOW.getTime() - MINUTE).toISOString(),
    })
    const { next } = applyAnswer(card, 3, NOW, { logId: 'log-4' })
    expect(next.state).toBe(2)
    expect(next.scheduled_days).toBeGreaterThanOrEqual(1)
  })

  it('метаданные ответа попадают в лог (session_id, duration_ms)', () => {
    const { log } = applyAnswer(mkCard(), 2, NOW, {
      logId: 'log-5',
      sessionId: 'session-1',
      durationMs: 6400,
    })
    expect(log.session_id).toBe('session-1')
    expect(log.duration_ms).toBe(6400)
  })
})

describe('граница дня обучения 4:00 (srs://day-boundary)', () => {
  it('до 4:00 — предыдущий день', () => {
    expect(studyDay(new Date(2026, 8, 28, 3, 59))).toBe('2026-09-27')
    expect(studyDay(new Date(2026, 0, 1, 0, 0))).toBe('2025-12-31')
  })

  it('после 4:00 — текущий день', () => {
    expect(studyDay(new Date(2026, 8, 28, 4, 0))).toBe('2026-09-28')
    expect(studyDay(new Date(2026, 8, 28, 23, 59))).toBe('2026-09-28')
  })

  it('dayStart возвращает 4:00 текущего дня обучения', () => {
    expect(dayStart(new Date(2026, 8, 28, 10, 30)).getHours()).toBe(4)
    expect(dayStart(new Date(2026, 8, 28, 2, 0)).getDate()).toBe(27)
  })

  it('sameStudyDay разделяет ночную сессию и утро', () => {
    const night = new Date(2026, 8, 28, 1, 0)
    const morning = new Date(2026, 8, 28, 5, 0)
    expect(sameStudyDay(night, new Date(2026, 8, 27, 20, 0))).toBe(true)
    expect(sameStudyDay(morning, night)).toBe(false)
  })
})

describe('защита от завала (srs://rule-5)', () => {
  it.each([
    [0, 15],
    [50, 15],
    [51, 8],
    [120, 8],
    [121, 4],
    [200, 4],
    [201, 0],
    [1000, 0],
  ])('долг %i → лимит %i', (debt, limit) => {
    expect(newLimitForDebt(debt)).toBe(limit)
  })

  it('пользовательский лимит может только уменьшить потолок', () => {
    expect(newLimitForDebt(10, 8)).toBe(8)
    expect(newLimitForDebt(10, 30)).toBe(DEFAULT_NEW_LIMIT)
    expect(newLimitForDebt(300, 30)).toBe(0)
  })
})

describe('rule-2: пробуждение обратных карточек', () => {
  it('пассивная карточка созрела при интервале ≥ 7 дней в Review', () => {
    expect(isWakeUpDue(mkCard({ state: 2, scheduled_days: 7 }))).toBe(true)
    expect(isWakeUpDue(mkCard({ state: 2, scheduled_days: 30 }))).toBe(true)
    expect(isWakeUpDue(mkCard({ state: 2, scheduled_days: 6 }))).toBe(false)
    expect(isWakeUpDue(mkCard({ state: 1, scheduled_days: 30 }))).toBe(false)
    expect(isWakeUpDue(mkCard({ state: 2, scheduled_days: 30, suspended: true }))).toBe(false)
  })

  it('просыпаются только обратные типы (ru-en/speak), dictation идёт как новая', () => {
    const passive = mkCard({
      card_id: 'w0.en-ru',
      note_id: 'n-w0',
      state: 2,
      scheduled_days: 9,
      due: new Date(NOW.getTime() + 86_400_000).toISOString(),
    })
    const reverse = mkCard({ card_id: 'w0.ru-en', note_id: 'n-w0', type: 'ru-en', state: 0 })
    const dictation = mkCard({
      card_id: 'w0.dictation',
      note_id: 'n-w0',
      type: 'dictation',
      state: 0,
    })

    const plan = buildQueue(
      [passive, reverse, dictation].map((card) => ({
        card,
        note: { id: card.note_id, deck: 'words' as const, entityId: 'w0', en: 'w', ru: 'с' },
      })),
      { now: NOW },
    )
    expect(plan.entries.map(({ card, kind }) => [card.card_id, kind])).toEqual([
      ['w0.ru-en', 'wake-up'],
      ['w0.dictation', 'new'],
    ])
  })
})

describe('buildQueue (srs://session-order)', () => {
  const noteOf = (card: CardState, overrides: Partial<Note> = {}): Note =>
    mkNote({ id: card.note_id, entityId: card.card_id, ...overrides })

  function entry(card: CardState, noteOverrides: Partial<Note> = {}) {
    return { card, note: noteOf(card, noteOverrides) }
  }

  it('порядок: learning → review-young → review-mature → wake-up → new', () => {
    const learning = mkCard({ card_id: 'a.en-ru', note_id: 'n-a', state: 1 })
    const young = mkCard({ card_id: 'b.en-ru', note_id: 'n-b', state: 2, scheduled_days: 4 })
    const matured = mkCard({ card_id: 'c.en-ru', note_id: 'n-c', state: 2, scheduled_days: 30 })
    const passive = mkCard({
      card_id: 'd.en-ru',
      note_id: 'n-d',
      state: 2,
      scheduled_days: 9,
      due: new Date(NOW.getTime() + 3 * 86_400_000).toISOString(),
    })
    const reverse = mkCard({ card_id: 'd.ru-en', note_id: 'n-d', type: 'ru-en', state: 0 })
    const fresh = mkCard({ card_id: 'e.en-ru', note_id: 'n-e', state: 0 })

    const plan = buildQueue(
      [fresh, matured, learning, young, passive, reverse].map((card) => entry(card)),
      { now: NOW },
    )

    expect(plan.entries.map(({ card, kind }) => [card.card_id, kind])).toEqual([
      ['a.en-ru', 'learning'],
      ['b.en-ru', 'review-young'],
      ['c.en-ru', 'review-mature'],
      ['d.ru-en', 'wake-up'],
      ['e.en-ru', 'new'],
    ])
    expect(plan.counts).toEqual({ learning: 1, review: 2, new: 2 })
  })

  it('просроченные review идут раньше менее просроченных, будущие не попадают в очередь', () => {
    const late = mkCard({
      card_id: 'late.en-ru',
      note_id: 'n-late',
      state: 2,
      scheduled_days: 3,
      due: new Date(NOW.getTime() - 5 * 86_400_000).toISOString(),
    })
    const soon = mkCard({
      card_id: 'soon.en-ru',
      note_id: 'n-soon',
      state: 2,
      scheduled_days: 3,
      due: new Date(NOW.getTime() - 86_400_000).toISOString(),
    })
    const future = mkCard({
      card_id: 'future.en-ru',
      note_id: 'n-future',
      state: 2,
      scheduled_days: 3,
      due: new Date(NOW.getTime() + 86_400_000).toISOString(),
    })

    const plan = buildQueue(
      [soon, future, late].map((card) => entry(card)),
      { now: NOW },
    )
    expect(plan.entries.map(({ card }) => card.card_id)).toEqual(['late.en-ru', 'soon.en-ru'])
  })

  it('flood-guard урезает новые, долг считается от начала дня (4:00)', () => {
    const items = [] as ReturnType<typeof entry>[]
    for (let i = 0; i < 130; i += 1) {
      items.push(
        entry(
          mkCard({
            card_id: `w${i}.en-ru`,
            note_id: `n-w${i}`,
            state: 2,
            scheduled_days: 3,
            due: new Date(NOW.getTime() - 2 * 86_400_000).toISOString(),
          }),
        ),
      )
    }
    for (let i = 0; i < 20; i += 1) {
      items.push(entry(mkCard({ card_id: `n${i}.en-ru`, note_id: `n-n${i}`, state: 0 })))
    }

    const plan = buildQueue(items, { now: NOW })
    expect(plan.debt).toBe(130)
    expect(plan.newLimit).toBe(4)
    expect(plan.entries.filter(({ kind }) => kind === 'new')).toHaveLength(4)
    expect(plan.counts.new).toBe(4)
  })

  it('пробуждённые не расходуют лимит новых и ограничены 5 в день', () => {
    const items = [] as ReturnType<typeof entry>[]
    for (let i = 0; i < 8; i += 1) {
      const passive = mkCard({
        card_id: `w${i}.en-ru`,
        note_id: `n-w${i}`,
        state: 2,
        scheduled_days: 10 + i,
      })
      items.push(entry(passive))
      items.push(
        entry(mkCard({ card_id: `w${i}.ru-en`, note_id: `n-w${i}`, type: 'ru-en', state: 0 })),
      )
    }
    // v2 (V.6): 10 слов (кап) + 10 фраз — лимит 15 добирается фразами
    for (let i = 0; i < 10; i += 1) {
      items.push(entry(mkCard({ card_id: `f${i}.en-ru`, note_id: `n-f${i}`, state: 0 })))
    }
    for (let i = 0; i < 10; i += 1) {
      items.push(
        entry(mkCard({ card_id: `p${i}.en-ru`, note_id: `n-p${i}`, state: 0, deck: 'phrases' })),
      )
    }

    const plan = buildQueue(items, { now: NOW })
    const woken = plan.entries.filter(({ kind }) => kind === 'wake-up')
    const fresh = plan.entries.filter(({ kind }) => kind === 'new')
    expect(woken).toHaveLength(5)
    expect(fresh).toHaveLength(DEFAULT_NEW_LIMIT)
    // интерливинг чередует колоды: слов в лимите ≤ капа V.6 (здесь 8 из 15)
    expect(fresh.filter(({ card }) => card.deck === 'words').length).toBeLessThanOrEqual(
      WORDS_NEW_DAILY_CAP,
    )
    expect(plan.counts.new).toBe(DEFAULT_NEW_LIMIT + 5)

    const nextDayPlan = buildQueue(items, { now: NOW, wokenToday: 3 })
    expect(nextDayPlan.entries.filter(({ kind }) => kind === 'wake-up')).toHaveLength(2)
  })

  it('V.6: новых слов ≤10/день даже при большом newPerDay (plan://curriculum-review#V.6)', () => {
    const items = [] as ReturnType<typeof entry>[]
    for (let i = 0; i < 20; i += 1) {
      const n = String(i).padStart(2, '0')
      items.push(entry(mkCard({ card_id: `w${n}.en-ru`, note_id: `n-w${n}`, state: 0 })))
    }
    const plan = buildQueue(items, { now: NOW, baseNewLimit: 50 })
    const fresh = plan.entries.filter(({ kind }) => kind === 'new')
    expect(fresh).toHaveLength(WORDS_NEW_DAILY_CAP)
    expect(fresh.every(({ card }) => card.deck === 'words')).toBe(true)
    // кап берёт старые по created_at/card_id слова — первые 10 (паддинг = порядок)
    expect(fresh.map(({ card }) => card.card_id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `w${String(i).padStart(2, '0')}.en-ru`),
    )
    // пользовательский лимит < капа по-прежнему режет раньше
    const small = buildQueue(items, { now: NOW, baseNewLimit: 5 })
    expect(small.entries.filter(({ kind }) => kind === 'new')).toHaveLength(5)
  })

  it('suspended и будущие карточки исключены, счётчики только по очереди', () => {
    const suspended = mkCard({ card_id: 's.en-ru', note_id: 'n-s', state: 2, suspended: true })
    const due = mkCard({ card_id: 'd.en-ru', note_id: 'n-d', state: 2, scheduled_days: 2 })

    const plan = buildQueue(
      [suspended, due].map((card) => entry(card)),
      { now: NOW },
    )
    expect(plan.entries.map(({ card }) => card.card_id)).toEqual(['d.en-ru'])
    expect(plan.counts).toEqual({ learning: 0, review: 1, new: 0 })
  })

  it('новые перемешиваются по колодам (round-robin)', () => {
    const items = [] as ReturnType<typeof entry>[]
    for (let i = 0; i < 3; i += 1) {
      items.push(
        entry(mkCard({ card_id: `w${i}.en-ru`, note_id: `n-w${i}`, state: 0 }), { deck: 'words' }),
      )
      items.push(
        entry(
          mkCard({
            card_id: `q${i}.cloze`,
            note_id: `n-q${i}`,
            type: 'cloze',
            deck: 'quotes',
            state: 0,
          }),
          { deck: 'quotes' },
        ),
      )
    }

    const plan = buildQueue(items, { now: NOW })
    expect(plan.entries.map(({ card }) => card.deck)).toEqual([
      'words',
      'quotes',
      'words',
      'quotes',
      'words',
      'quotes',
    ])
  })
})

// Implements: plan://M18 — GAP-3 specs/09 §4.2 (TC-SRS-11)
describe('параметры FSRS — specs/03 §2 (srs://ts-fsrs)', () => {
  it('retention 0.90, max interval 36500, fuzz и short-term включены', () => {
    const params = createScheduler().parameters
    expect(params.request_retention).toBe(0.9)
    expect(params.maximum_interval).toBe(36500)
    expect(params.enable_fuzz).toBe(true)
    expect(params.enable_short_term).toBe(true)
  })
})

// M19: formatInterval — годы (строка 147)
describe('formatInterval: человекочитаемые интервалы', () => {
  it('минуты/часы/дни/годы', async () => {
    const { formatInterval } = await import('./scheduler')
    const from = new Date('2026-09-30T12:00:00Z')
    const at = (minutes: number) => new Date(from.getTime() + minutes * 60_000)
    expect(formatInterval(from, at(5))).toMatch(/м/)
    expect(formatInterval(from, at(90))).toMatch(/ч/)
    expect(formatInterval(from, at(60 * 24 * 3))).toMatch(/д/)
    expect(formatInterval(from, at(60 * 24 * 400))).toMatch(/г/)
  })
})
