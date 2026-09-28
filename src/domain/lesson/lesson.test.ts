// Implements: plan://M5#5.2 — unit-тесты домена урока (specs/02 §2, §3, §5)
import { describe, expect, it } from 'vitest'
import {
  advanceStep,
  computeLessonStatus,
  createCheckpoint,
  findStep,
  finishPass,
  isLessonPassed,
  passAccuracy,
  recordAnswer,
  totalXp,
} from './runner'
import { evaluateStep, groupIntoSteps } from './steps'
import { xpForOutcome } from './xp'
import type { LessonProgress, LessonStep, StepScore } from './types'

const STEPS: LessonStep[] = [
  { index: 1, kind: 'rule', exerciseIds: ['ex-cloze-1', 'ex-cloze-2'] },
  { index: 2, kind: 'warmup', exerciseIds: ['ex-choice-1', 'ex-choice-2', 'ex-match-1'] },
  { index: 3, kind: 'build', exerciseIds: ['ex-wb-1', 'ex-tr-1', 'ex-sp-1'] },
  {
    index: 4,
    kind: 'listening',
    exerciseIds: ['ex-dict-1', 'ex-dict-2', 'ex-dict-3', 'ex-dict-4', 'ex-dict-5'],
  },
  { index: 5, kind: 'speaking', exerciseIds: ['ex-sh-1', 'ex-aq-1'] },
  { index: 6, kind: 'quotes', exerciseIds: ['ex-qcloze-1'] },
  { index: 7, kind: 'deck', exerciseIds: [] },
]

function score(overrides: Partial<StepScore> = {}): StepScore {
  return { stepIndex: 1, total: 2, answered: 2, firstTryCorrect: 2, ...overrides }
}

describe('groupIntoSteps (specs/02 §2)', () => {
  it('раскладывает упражнения по блокам шаблона в порядке шагов', () => {
    const steps = groupIntoSteps([
      { id: 'a', type: 'cloze' },
      { id: 'b', type: 'choose_translation' },
      { id: 'c', type: 'match_pairs' },
      { id: 'd', type: 'word_bank' },
      { id: 'e', type: 'translate' },
      { id: 'f', type: 'speak' },
      { id: 'g', type: 'dictation' },
      { id: 'h', type: 'shadowing' },
      { id: 'i', type: 'answer_question' },
      { id: 'j', type: 'cloze', isQuoteCloze: true },
    ])
    expect(steps.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6])
    expect(steps[0].kind).toBe('rule')
    expect(steps[2].exerciseIds).toEqual(['d', 'e', 'f'])
    expect(steps[5].kind).toBe('quotes')
  })

  it('пропускает пустые блоки и игнорирует card (SRS-only)', () => {
    const steps = groupIntoSteps([
      { id: 'a', type: 'card' },
      { id: 'b', type: 'translate' },
    ])
    expect(steps).toEqual([{ index: 3, kind: 'build', exerciseIds: ['b'] }])
  })
})

describe('evaluateStep (specs/02 §2 — критерии перехода)', () => {
  it('правило: достаточно ответить все задания', () => {
    const evaluation = evaluateStep('rule', score({ stepIndex: 1, firstTryCorrect: 0 }))
    expect(evaluation.passed).toBe(true)
  })

  it('разогрев: ≥70% с первой попытки, иначе повтор блока', () => {
    expect(
      evaluateStep('warmup', score({ firstTryCorrect: 3, total: 3, answered: 3 })).passed,
    ).toBe(true)
    expect(
      evaluateStep('warmup', score({ firstTryCorrect: 2, total: 3, answered: 3 })).passed,
    ).toBe(false)
  })

  it('построение: ошибки не блокируют', () => {
    expect(evaluateStep('build', score({ firstTryCorrect: 0 })).passed).toBe(true)
  })

  it('слух: <60% — предлагается повторить, но шаг пройден', () => {
    const evaluation = evaluateStep(
      'listening',
      score({ firstTryCorrect: 2, total: 5, answered: 5 }),
    )
    expect(evaluation.passed).toBe(true)
    expect(evaluation.retrySuggested).toBe(true)
    const good = evaluateStep('listening', score({ firstTryCorrect: 3, total: 5, answered: 5 }))
    expect(good.retrySuggested).toBe(false)
  })

  it('не отвеченные задания не дают переход', () => {
    expect(evaluateStep('rule', score({ answered: 1 })).passed).toBe(false)
  })
})

describe('xpForOutcome (specs/02 §3, specs/04 §4.1)', () => {
  it('первая попытка, спор и самопроверка — полный XP', () => {
    expect(xpForOutcome(3, 'correct')).toBe(3)
    expect(xpForOutcome(3, 'disputed')).toBe(3)
    expect(xpForOutcome(3, 'self_reported')).toBe(3)
  })

  it('верно со второй — 50% с округлением вниз', () => {
    expect(xpForOutcome(2, 'correct_retry')).toBe(1)
    expect(xpForOutcome(3, 'correct_retry')).toBe(1)
  })

  it('подсказка и пропуск — 0', () => {
    expect(xpForOutcome(3, 'hint')).toBe(0)
    expect(xpForOutcome(3, 'skip')).toBe(0)
  })
})

describe('recordAnswer и переходы шагов', () => {
  it('фиксирует исход и счёт шага', () => {
    let cp = createCheckpoint()
    cp = recordAnswer(cp, STEPS, 'ex-cloze-1', 'correct', 1)
    cp = recordAnswer(cp, STEPS, 'ex-cloze-2', 'correct_retry', 2)
    expect(cp.results['ex-cloze-1']).toEqual({ attempts: 1, outcome: 'correct' })
    expect(cp.scores[0]).toEqual({
      stepIndex: 1,
      total: 2,
      answered: 2,
      firstTryCorrect: 1,
    })
  })

  it('подсказка завершает задание: счёт answered растёт, XP — 0', () => {
    let cp = createCheckpoint()
    cp = recordAnswer(cp, STEPS, 'ex-cloze-1', 'hint', 1)
    expect(cp.scores[0].answered).toBe(1)
    expect(cp.scores[0].firstTryCorrect).toBe(0)
    expect(evaluateStep('rule', cp.scores[0]).passed).toBe(false) // ещё не все отвечены
    cp = recordAnswer(cp, STEPS, 'ex-cloze-2', 'hint', 1)
    expect(evaluateStep('rule', cp.scores[0]).passed).toBe(true)
  })

  it('самопроверка речи не растит статистику точности (specs/02 §3)', () => {
    let cp = createCheckpoint()
    cp = recordAnswer(cp, STEPS, 'ex-cloze-1', 'self_reported', 1)
    expect(cp.scores[0].answered).toBe(1)
    expect(cp.scores[0].firstTryCorrect).toBe(0)
  })

  it('повторная запись того же задания не наращивает счёт (resume/спор)', () => {
    let cp = createCheckpoint()
    cp = recordAnswer(cp, STEPS, 'ex-cloze-1', 'skip', 2)
    cp = recordAnswer(cp, STEPS, 'ex-cloze-1', 'disputed', 2)
    expect(cp.scores[0].answered).toBe(1)
    expect(cp.scores[0].firstTryCorrect).toBe(1)
    expect(cp.results['ex-cloze-1']).toEqual({ attempts: 2, outcome: 'disputed' })
  })

  it('задание не из текущего шага игнорируется', () => {
    const cp = recordAnswer(createCheckpoint(), STEPS, 'ex-tr-1', 'correct', 1)
    expect(cp.results).toEqual({})
    expect(cp.scores).toEqual([])
  })

  it('переход запрещён, пока шаг не пройден', () => {
    let cp = createCheckpoint()
    cp = recordAnswer(cp, STEPS, 'ex-cloze-1', 'correct', 1)
    expect(advanceStep(cp, STEPS)).toBeNull()
  })

  it('переход двигает на следующий шаг', () => {
    let cp = createCheckpoint()
    cp = recordAnswer(cp, STEPS, 'ex-cloze-1', 'correct', 1)
    cp = recordAnswer(cp, STEPS, 'ex-cloze-2', 'skip', 1)
    const next = advanceStep(cp, STEPS)
    expect(next?.stepIndex).toBe(2)
  })

  it('шаг 7 «В колоду» без заданий завершается явным finishPass', () => {
    let cp = createCheckpoint()
    cp = { ...cp, stepIndex: 7 }
    expect(advanceStep(cp, STEPS)).toBeNull()
    cp = finishPass(cp)
    expect(cp.passesDone).toBe(1)
    expect(cp.passIndex).toBe(1)
    expect(cp.stepIndex).toBe(1)
    expect(cp.scores).toEqual([])
    expect(cp.results).toEqual({})
  })
})

describe('passAccuracy и totalXp', () => {
  it('точность прохода = верные с первой попытки / отвеченные, 0–100', () => {
    expect(passAccuracy([score({ answered: 4, firstTryCorrect: 3 })])).toBe(75)
    expect(passAccuracy([])).toBeNull()
    expect(passAccuracy([score({ answered: 0 })])).toBeNull()
  })

  it('суммарный XP по meta.xp заданий', () => {
    let cp = createCheckpoint()
    cp = recordAnswer(cp, STEPS, 'ex-cloze-1', 'correct', 1)
    cp = recordAnswer(cp, STEPS, 'ex-cloze-2', 'hint', 1)
    expect(totalXp(cp, { 'ex-cloze-1': 2, 'ex-cloze-2': 2 })).toBe(2)
  })
})

describe('computeLessonStatus (specs/02 §5)', () => {
  const srs = (total: number, learned: number, lapsed = 0) => ({ total, learned, lapsed })
  const row = (
    checkpoint: ReturnType<typeof createCheckpoint>,
    score: number | null,
  ): LessonProgress => ({
    lesson_id: 'les-e-01',
    status: 'in_progress',
    score,
    checkpoint,
    completed_at: null,
    updated_at: '2026-09-28T10:00:00.000Z',
  })

  it('locked, пока предыдущий урок не пройден', () => {
    const status = computeLessonStatus({
      row: null,
      previousCompleted: false,
      totalPasses: 1,
      srs: srs(10, 10),
    })
    expect(status).toBe('locked')
  })

  it('available для нового урока', () => {
    const status = computeLessonStatus({
      row: null,
      previousCompleted: true,
      totalPasses: 1,
      srs: srs(10, 0),
    })
    expect(status).toBe('available')
  })

  it('in_progress, пока проход не завершён', () => {
    const cp = createCheckpoint()
    const status = computeLessonStatus({
      row: row(cp, null),
      previousCompleted: true,
      totalPasses: 1,
      srs: srs(10, 10),
    })
    expect(status).toBe('in_progress')
  })

  it('in_progress при <90% фраз «выучено» (плашка «урок почти готов»)', () => {
    const cp = finishPass(createCheckpoint())
    const status = computeLessonStatus({
      row: row(cp, 80),
      previousCompleted: true,
      totalPasses: 1,
      srs: srs(10, 8),
    })
    expect(status).toBe('in_progress')
  })

  it('completed при всех проходах и ≥90% «выучено»', () => {
    const cp = finishPass(createCheckpoint())
    const status = computeLessonStatus({
      row: row(cp, 90),
      previousCompleted: true,
      totalPasses: 1,
      srs: srs(10, 9),
    })
    expect(status).toBe('completed')
  })

  it('review_due при точности <60% или ≥30% просевших фраз', () => {
    const cp = finishPass(createCheckpoint())
    const lowAccuracy = computeLessonStatus({
      row: row(cp, 55),
      previousCompleted: true,
      totalPasses: 1,
      srs: srs(10, 10),
    })
    expect(lowAccuracy).toBe('review_due')
    const lapsed = computeLessonStatus({
      row: row(cp, 90),
      previousCompleted: true,
      totalPasses: 1,
      srs: srs(10, 9, 3),
    })
    expect(lapsed).toBe('review_due')
  })

  it('два прохода: passesDone < totalPasses — ещё in_progress', () => {
    const cp = finishPass(createCheckpoint())
    const status = computeLessonStatus({
      row: row(cp, 90),
      previousCompleted: true,
      totalPasses: 2,
      srs: srs(10, 10),
    })
    expect(status).toBe('in_progress')
  })
})

describe('isLessonPassed', () => {
  it('review_due не блокирует следующий урок', () => {
    expect(isLessonPassed('completed')).toBe(true)
    expect(isLessonPassed('review_due')).toBe(true)
    expect(isLessonPassed('in_progress')).toBe(false)
    expect(isLessonPassed('available')).toBe(false)
    expect(isLessonPassed('locked')).toBe(false)
  })
})

describe('findStep', () => {
  it('находит шаг по индексу, отсутствующий — null', () => {
    expect(findStep(STEPS, 4)?.kind).toBe('listening')
    expect(findStep(STEPS, 9)).toBeNull()
  })
})
