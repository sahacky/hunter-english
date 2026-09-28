// Implements: plan://M5#5.2 — runner урока и вычисление статуса (specs/02 §2, §5)
// Чистые функции над чекпоинтом: экран (M5#5.5) только применяет переходы и пишет
// результат каждого задания в репозиторий немедленно (единица сохранения — задание).

import { evaluateStep, type StepEvaluation } from './steps'
import { xpForOutcome } from './xp'
import type {
  ExerciseOutcome,
  ExerciseResult,
  LessonCheckpoint,
  LessonProgress,
  LessonStatus,
  LessonStep,
  SrsLessonStats,
  StepScore,
} from './types'

/** Создаёт пустой чекпоинт: проход 0, шаг 1 «Правило». */
export function createCheckpoint(): LessonCheckpoint {
  return {
    passIndex: 0,
    stepIndex: 1,
    scores: [],
    srsEnqueued: [],
    passesDone: 0,
    results: {},
  }
}

/** Шаг с индексом `stepIndex` из списка шагов (или null — шагов нет). */
export function findStep(steps: readonly LessonStep[], stepIndex: number): LessonStep | null {
  return steps.find((step) => step.index === stepIndex) ?? null
}

function ensureScore(scores: StepScore[], step: LessonStep): StepScore {
  const existing = scores.find((s) => s.stepIndex === step.index)
  if (existing) return existing
  return { stepIndex: step.index, total: step.exerciseIds.length, answered: 0, firstTryCorrect: 0 }
}

/**
 * Фиксирует результат задания в чекпоинте (иммутабельно): счёт шага, исход,
 * попытки. Идемпотентно по exerciseId: повторная запись (спор «Я был прав»,
 * повторный ответ после resume) обновляет исход, но не наращивает счёт шага.
 */
export function recordAnswer(
  checkpoint: LessonCheckpoint,
  steps: readonly LessonStep[],
  exerciseId: string,
  outcome: ExerciseOutcome,
  attempts: number,
): LessonCheckpoint {
  const step = findStep(steps, checkpoint.stepIndex)
  if (!step || !step.exerciseIds.includes(exerciseId)) return checkpoint
  const previous = checkpoint.results[exerciseId]
  const prev = ensureScore(checkpoint.scores, step)
  // перезапись (спор §4.6, повторный ответ после resume): счёт answered не трогаем,
  // точность корректируем при смене класса исхода (неверно → засчитан верным и обратно)
  let firstTryCorrect = prev.firstTryCorrect
  if (previous) {
    if (!isCorrectFirstTry(previous.outcome) && isCorrectFirstTry(outcome)) firstTryCorrect += 1
    else if (isCorrectFirstTry(previous.outcome) && !isCorrectFirstTry(outcome))
      firstTryCorrect -= 1
  } else if (isCorrectFirstTry(outcome)) {
    firstTryCorrect += 1
  }
  const score: StepScore = previous
    ? { ...prev, firstTryCorrect }
    : { ...prev, answered: prev.answered + 1, firstTryCorrect }
  const result: ExerciseResult = { attempts, outcome }
  return {
    ...checkpoint,
    scores: [...checkpoint.scores.filter((s) => s.stepIndex !== step.index), score],
    results: { ...checkpoint.results, [exerciseId]: result },
  }
}

/**
 * Верно с первой попытки: полный успех либо спор (specs/02 §4.6 — засчитывается
 * верным). Самопроверка речи НЕ растит статистику точности (specs/02 §3) — только XP.
 */
function isCorrectFirstTry(outcome: ExerciseOutcome): boolean {
  return outcome === 'correct' || outcome === 'disputed'
}

/** Оценка текущего шага (критерий specs/02 §2). */
export function currentStepEvaluation(
  checkpoint: LessonCheckpoint,
  steps: readonly LessonStep[],
): StepEvaluation | null {
  const step = findStep(steps, checkpoint.stepIndex)
  if (!step) return null
  return evaluateStep(step.kind, ensureScore(checkpoint.scores, step))
}

/**
 * Переходит к следующему шагу, если текущий пройден; null — переход запрещён
 * или следующего шага нет. Завершение прохода — явный вызов finishPass после
 * шага 7 «В колоду» (заданий не имеет, завершается действием пользователя).
 */
export function advanceStep(
  checkpoint: LessonCheckpoint,
  steps: readonly LessonStep[],
): LessonCheckpoint | null {
  const evaluation = currentStepEvaluation(checkpoint, steps)
  if (!evaluation || !evaluation.passed) return null
  const nextIndex = checkpoint.stepIndex + 1
  const next = findStep(steps, nextIndex)
  return next ? { ...checkpoint, stepIndex: nextIndex } : null
}

/** Завершает проход: фиксирует точность, сбрасывает позицию на проход +1 / шаг 1. */
export function finishPass(checkpoint: LessonCheckpoint): LessonCheckpoint {
  return {
    ...checkpoint,
    passesDone: checkpoint.passesDone + 1,
    passIndex: checkpoint.passIndex + 1,
    stepIndex: 1,
    scores: [],
    results: {},
  }
}

/**
 * Точность прохода в процентах (0–100): верные с первой попытки / отвеченные.
 * null — в проходе не отвечено ничего.
 */
export function passAccuracy(scores: readonly StepScore[]): number | null {
  let answered = 0
  let correct = 0
  for (const score of scores) {
    answered += score.answered
    correct += score.firstTryCorrect
  }
  if (answered === 0) return null
  return Math.round((correct / answered) * 100)
}

/** Суммарный XP текущего прохода по исходам заданий (значения — meta.xp данных). */
export function totalXp(checkpoint: LessonCheckpoint, xpById: Record<string, number>): number {
  let total = 0
  for (const [exerciseId, result] of Object.entries(checkpoint.results)) {
    const base = xpById[exerciseId]
    if (base !== undefined) total += xpForOutcome(base, result.outcome)
  }
  return total
}

/**
 * Статус урока на пути (specs/02 §5):
 * - `locked` — предыдущий урок не пройден (пройден = completed или review_due);
 * - `available` — записи нет и урок не начат;
 * - `in_progress` — проход не завершён ИЛИ завершён, но <90% фраз «выучено»
 *   (плашка «Урок почти готов», отметка «пройден» заблокирована, specs/02 §2);
 * - `completed` — все проходы завершены и ≥90% фраз «выучено»;
 * - `review_due` — как completed, но точность прохода <60% или ≥30% фраз просело.
 * `row` — сохранённая запись (null — урока ещё не касались).
 */
export function computeLessonStatus(args: {
  row: LessonProgress | null
  previousCompleted: boolean
  totalPasses: number
  srs: SrsLessonStats
}): LessonStatus {
  const { row, previousCompleted, totalPasses, srs } = args
  if (!previousCompleted) return 'locked'
  if (!row) return 'available'
  const passesComplete = row.checkpoint.passesDone >= totalPasses
  if (!passesComplete) return 'in_progress'
  const learnedRatio = srs.total > 0 ? srs.learned / srs.total : 0
  const lapsedRatio = srs.total > 0 ? srs.lapsed / srs.total : 0
  if (learnedRatio < 0.9) return 'in_progress'
  const accuracy = (row.score ?? 100) / 100
  if (accuracy < 0.6 || lapsedRatio >= 0.3) return 'review_due'
  return 'completed'
}

/**
 * Разблокирован ли следующий урок: предыдущий считается пройденным
 * в completed и review_due (specs/06 §3: review_due — «пройден, к повторению»).
 */
export function isLessonPassed(status: LessonStatus): boolean {
  return status === 'completed' || status === 'review_due'
}
