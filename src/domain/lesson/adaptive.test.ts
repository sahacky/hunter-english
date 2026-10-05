// Implements: plan://teaching-quality#Q2.1 — тесты профиля адаптивной презентации
import { describe, expect, it } from 'vitest'
import { adaptiveProfile, ADAPTIVE_MIN_ANSWERED, ADAPTIVE_WINDOW } from './adaptive'

describe('adaptiveProfile (план {#teaching-quality} Q2.1)', () => {
  it('разгон: меньше 5 отвеченных — standard', () => {
    expect(adaptiveProfile([])).toBe('standard')
    expect(adaptiveProfile(['correct', 'correct', 'correct', 'correct'])).toBe('standard')
  })

  it('>95% с первой попытки → challenge (порог строго больше)', () => {
    const all = Array.from({ length: ADAPTIVE_MIN_ANSWERED }, () => 'correct')
    expect(adaptiveProfile(all)).toBe('challenge')
    // 95% ровно (19/20) — ещё standard
    const nineteen = [...all, ...Array.from({ length: 15 }, () => 'correct'), 'skip']
    expect(adaptiveProfile(nineteen)).toBe('standard')
  })

  it('<70% с первой попытки → support', () => {
    const weak = ['correct', 'skip', 'correct_retry', 'skip', 'skip', 'skip', 'skip']
    expect(adaptiveProfile(weak)).toBe('support')
  })

  it('окно: учитываются только последние 10 исходов', () => {
    // 4 старых провала + 10 свежих верных: окно = 10 correct → challenge
    const history = ['skip', 'skip', 'skip', 'skip', ...Array.from({ length: 10 }, () => 'correct')]
    expect(adaptiveProfile(history)).toBe('challenge')
    expect(ADAPTIVE_WINDOW).toBe(10)
  })

  it('self_reported/disputed/hint — не first-try', () => {
    const mixed = ['self_reported', 'disputed', 'hint', 'correct', 'correct', 'correct']
    // 3/6 = 50% → support
    expect(adaptiveProfile(mixed)).toBe('support')
  })
})
