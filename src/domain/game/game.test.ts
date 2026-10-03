// Implements: plan://M7#7.1 — тесты домена геймификации (specs/04 §2–§6)
import { describe, expect, it } from 'vitest'
import {
  applyXpCap,
  BONUS_POOL,
  cooldownPassed,
  createQuestDay,
  judgeGate,
  levelInfo,
  levelThreshold,
  countStudyDay,
  NEXT_RANK,
  pickBonusQuest,
  questAwards,
  xpCategory,
  RANK_WORD_TARGET,
  rankOfFreq,
} from './game'
import { emptyStats } from './types'

describe('уровни (specs/04 §2.2)', () => {
  it('пороги 100/225/350… и уровень по XP ранга', () => {
    expect(levelThreshold(1)).toBe(0)
    expect(levelThreshold(2)).toBe(100)
    expect(levelThreshold(3)).toBe(225)
    expect(levelInfo(0).level).toBe(1)
    expect(levelInfo(99).level).toBe(1)
    expect(levelInfo(100).level).toBe(2)
    expect(levelInfo(224).level).toBe(2)
    expect(levelInfo(225).level).toBe(3)
    expect(levelInfo(5000).level).toBeGreaterThan(10)
  })

  it('прогресс к следующему уровню 0–1', () => {
    expect(levelInfo(50).progress).toBeCloseTo(0.5)
    expect(levelInfo(0).progress).toBe(0)
    expect(levelInfo(100).progress).toBe(0)
  })
})

describe('капы XP (specs/04 §4.2)', () => {
  it('начисление в пределах капа и обрезка сверху', () => {
    const zero = { reviews: 0, choice: 0, voice: 0, dictation: 0, shadowing: 0 }
    const first = applyXpCap(zero, 'reviews', 150)
    expect(first.awarded).toBe(150)
    const second = applyXpCap(first.counters, 'reviews', 100)
    expect(second.awarded).toBe(50)
    expect(second.counters.reviews).toBe(200)
    const third = applyXpCap(second.counters, 'reviews', 5)
    expect(third.awarded).toBe(0)
  })

  it('uncapped проходит целиком', () => {
    const zero = { reviews: 0, choice: 0, voice: 0, dictation: 0, shadowing: 0 }
    expect(applyXpCap(zero, 'uncapped', 999).awarded).toBe(999)
  })

  it('категории по типам упражнений', () => {
    expect(xpCategory('choose_translation')).toBe('choice')
    expect(xpCategory('speak')).toBe('voice')
    expect(xpCategory('dictation')).toBe('dictation')
    expect(xpCategory('shadowing')).toBe('shadowing')
    expect(xpCategory('translate')).toBe('uncapped')
  })
})

describe('стрик и заморозки (specs/04 §5)', () => {
  const base = emptyStats('2026-09-28T00:00:00Z')

  it('первый день: серия 1, заморозки стартовые 2', () => {
    const { stats, froze, broke } = countStudyDay(base, '2026-09-28T00:00:00Z')
    expect(stats.streak_current).toBe(1)
    expect(stats.freezes_left).toBe(2)
    expect(froze).toBe(false)
    expect(broke).toBe(false)
  })

  it('подряд: +1 за день; кратное 7 → +1 заморозка (макс 5)', () => {
    let stats = base
    for (let day = 0; day < 7; day += 1) {
      stats = countStudyDay(stats, `2026-09-${String(10 + day).padStart(2, '0')}T00:00:00Z`).stats
    }
    expect(stats.streak_current).toBe(7)
    expect(stats.freezes_left).toBe(3)
    expect(stats.streak_best).toBe(7)
  })

  it('пропуск в пределах заморозок — серия сохранена, заморозка списана', () => {
    const stats = countStudyDay(base, '2026-09-10T00:00:00Z').stats
    const after = countStudyDay(stats, '2026-09-12T00:00:00Z') // 1 день пропущен
    expect(after.froze).toBe(true)
    expect(after.freezesSpent).toBe(1)
    expect(after.stats.streak_current).toBe(2)
    expect(after.stats.freezes_left).toBe(1)
  })

  it('пропусков больше заморозок — серия обнулена', () => {
    const stats = countStudyDay(base, '2026-09-10T00:00:00Z').stats // freezes 2
    const after = countStudyDay(stats, '2026-09-20T00:00:00Z') // пропущено 8
    expect(after.broke).toBe(true)
    expect(after.stats.streak_current).toBe(1)
    expect(after.stats.streak_best).toBe(1)
  })
})

describe('квесты (specs/04 §6)', () => {
  it('бонус-квест детерминирован по дате', () => {
    const a = pickBonusQuest('2026-09-28T00:00:00Z')
    expect(pickBonusQuest('2026-09-28T00:00:00Z')).toEqual(a)
    expect(BONUS_POOL).toContain(a)
  })

  it('цель повторов = все due, минимум 20', () => {
    expect(createQuestDay('2026-09-28T00:00:00Z', 5).slots.reviews.target).toBe(20)
    expect(createQuestDay('2026-09-28T00:00:00Z', 37).slots.reviews.target).toBe(37)
  })

  it('награды: все слоты (вкл. аудирование) +30, бонус +15 — единожды', () => {
    const state = createQuestDay('2026-09-28T00:00:00Z', 20)
    expect(questAwards(state)).toEqual({ allDone: 0, bonus: 0 })
    state.slots.reviews.done = 20
    state.slots.dictation.done = 10
    state.slots.lesson.done = 1
    state.bonusDone = state.bonus.target
    // input-трек не закрыт — общего бонуса нет (plan://curriculum-review#I.1)
    expect(questAwards(state)).toEqual({ allDone: 0, bonus: 15 })
    state.slots.listening.done = state.slots.listening.target
    expect(questAwards(state)).toEqual({ allDone: 30, bonus: 15 })
    state.allDoneAwarded = true
    state.bonusAwarded = true
    expect(questAwards(state)).toEqual({ allDone: 0, bonus: 0 })
  })

  it('цель аудирования — 20 минут (input-трек)', () => {
    const state = createQuestDay('2026-09-28T00:00:00Z', 20)
    expect(state.slots.listening).toEqual({ done: 0, target: 20 * 60 })
  })
})

describe('Врата (specs/04 §3)', () => {
  const scores = (vocab: number, grammar: number, listening: number, speaking: number) => [
    { section: 'vocab' as const, correct: vocab, total: 20 },
    { section: 'grammar' as const, correct: grammar, total: 20 },
    { section: 'listening' as const, correct: listening, total: 15 },
    { section: 'speaking' as const, correct: speaking, total: 10 },
  ]

  it('сдача: все секции ≥80% и сумма ≥85%', () => {
    const verdict = judgeGate(scores(17, 18, 13, 9))
    expect(verdict.passed).toBe(true)
    expect(verdict.total).toBeGreaterThanOrEqual(85)
  })

  it('провал секции топит экзамен даже при высокой сумме', () => {
    const verdict = judgeGate(scores(20, 20, 8, 10))
    expect(verdict.passed).toBe(false)
    expect(verdict.weakSections.map((s) => s.section)).toContain('listening')
  })

  it('сумма <85% при всех секциях ≥80% — провал', () => {
    const verdict = judgeGate(scores(16, 16, 12, 8))
    expect(verdict.passed).toBe(false)
  })

  it('кулдаун 72 часа', () => {
    const failedAt = '2026-09-25T10:00:00Z'
    expect(cooldownPassed(failedAt, new Date('2026-09-27T09:59:00Z'))).toBe(false)
    expect(cooldownPassed(failedAt, new Date('2026-09-28T10:01:00Z'))).toBe(true)
  })

  it('ранг за Вратами', () => {
    expect(NEXT_RANK.E).toBe('D')
    expect(NEXT_RANK.S).toBe('S')
  })
})

describe('RANK_WORD_TARGET / rankOfFreq (U3.2: слова — из полосы ранга)', () => {
  it('цели словаря по рангам — канон specs/01 §2', () => {
    expect(RANK_WORD_TARGET).toEqual({ E: 300, D: 1000, C: 1800, B: 2800, A: 4000, S: 5000 })
  })

  it('ранг полосы по частотному рангу (границы включительно)', () => {
    expect(rankOfFreq(1)).toBe('E')
    expect(rankOfFreq(300)).toBe('E')
    expect(rankOfFreq(301)).toBe('D')
    expect(rankOfFreq(1000)).toBe('D')
    expect(rankOfFreq(1001)).toBe('C')
    expect(rankOfFreq(1800)).toBe('C')
    expect(rankOfFreq(1801)).toBe('B')
    expect(rankOfFreq(2800)).toBe('B')
    expect(rankOfFreq(4000)).toBe('A')
    expect(rankOfFreq(4001)).toBe('S')
    expect(rankOfFreq(Number.POSITIVE_INFINITY)).toBe('S')
  })
})
