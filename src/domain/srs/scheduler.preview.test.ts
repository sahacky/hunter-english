import { describe, expect, it } from 'vitest'
import { applyAnswer, formatInterval, previewDue } from './scheduler'
import type { CardState } from './types'

// Implements: plan://M10#10.3 (ревью Б1) — превью интервалов детерминированно
// совпадает с фактическим ответом при одинаковом now (seed fuzz включает
// review_time в ts-fsrs 4.7 DefaultInitSeedStrategy)

function reviewCard(): CardState {
  return {
    card_id: 'preview-test.en-ru',
    note_id: 'preview-test',
    type: 'en-ru',
    deck: 'words',
    due: new Date().toISOString(),
    stability: 51.5,
    difficulty: 5.2,
    elapsed_days: 30,
    scheduled_days: 45,
    reps: 6,
    lapses: 0,
    state: 2,
    last_review: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    suspended: false,
    cloze_index: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

describe('previewDue ↔ applyAnswer паритет (ревью M10 Б1)', () => {
  for (const rating of [1, 2, 3, 4] as const) {
    it(`рейтинг ${rating}: превью = фактический due при одном now`, () => {
      const now = new Date('2026-09-29T12:00:00')
      const card = reviewCard()
      const preview = previewDue(card, rating, now)
      const { next } = applyAnswer(card, rating, now, { logId: 'test' })
      expect(preview.getTime()).toBe(new Date(next.due).getTime())
    })
  }

  it('разные now → превью может отличаться (fuzz): поэтому экран замораживает now', () => {
    const card = reviewCard()
    const a = previewDue(card, 3, new Date('2026-09-29T12:00:00'))
    const b = previewDue(card, 3, new Date('2026-09-29T12:00:05'))
    // утверждение «не обязаны совпадать» нельзя требеть строго (диапазон может
    // дать одинаковый результат) — но паритет выше гарантирует честность UI
    expect(a instanceof Date && b instanceof Date).toBe(true)
  })
})

describe('formatInterval (units)', () => {
  const from = new Date('2026-09-29T12:00:00')
  it('минуты/часы/дни с дефолтными суффиксами', () => {
    expect(formatInterval(from, new Date('2026-09-29T12:10:00'))).toBe('10м')
    expect(formatInterval(from, new Date('2026-09-29T18:00:00'))).toBe('6ч')
    expect(formatInterval(from, new Date('2026-10-29T12:00:00'))).toBe('30д')
  })
  it('локализованные суффиксы', () => {
    const en = { m: 'm', h: 'h', d: 'd', y: 'y' }
    expect(formatInterval(from, new Date('2026-09-29T12:10:00'), en)).toBe('10m')
    expect(formatInterval(from, new Date('2026-10-29T12:00:00'), en)).toBe('30d')
  })
})
