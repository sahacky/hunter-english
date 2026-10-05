// Implements: plan://M5#5.2 — группировка заданий в шаги и критерии шагов (specs/02 §2, §3)

import type { LessonStep, StepKind, StepScore } from './types'

/** Тип упражнения → шаг шаблона (specs/05 §3 type ↔ specs/02 §2 блок). */
const EXERCISE_STEP: Record<string, StepKind> = {
  cloze: 'rule',
  choose_translation: 'warmup',
  match_pairs: 'warmup',
  word_bank: 'build',
  translate: 'build',
  speak: 'build',
  find_error: 'build',
  verb_tense: 'build',
  transform: 'build',
  dictation: 'listening',
  shadowing: 'speaking',
  answer_question: 'speaking',
  dialog: 'speaking',
  retell: 'speaking',
}

/** Вход группировки: id + тип упражнения + флаг «cloze в цитате». */
export interface ExerciseRef {
  id: string
  type: string
  /** payload.kind === 'cloze' && payload.quote — specs/05 §3 (шаг «Из сериала»). */
  isQuoteCloze?: boolean
}

/**
 * Группирует упорядоченный список упражнений урока в шаги 1–6 (specs/02 §2).
 * Шаг 7 «В колоду» заданий не имеет — runner добавляет его сам.
 * Пустые шаги пропускаются (в данных нет заданий этого блока).
 * `card` в уроках не используется (SRS-only, specs/05 §3) — игнорируется.
 */
export function groupIntoSteps(exercises: readonly ExerciseRef[]): LessonStep[] {
  const order: StepKind[] = ['rule', 'warmup', 'build', 'listening', 'speaking', 'quotes']
  const byKind = new Map<StepKind, string[]>()
  for (const exercise of exercises) {
    const kind = exercise.isQuoteCloze ? 'quotes' : EXERCISE_STEP[exercise.type]
    if (!kind) continue
    const bucket = byKind.get(kind)
    if (bucket) bucket.push(exercise.id)
    else byKind.set(kind, [exercise.id])
  }
  const steps: LessonStep[] = []
  for (let index = 0; index < order.length; index += 1) {
    const kind = order[index]
    const exerciseIds = byKind.get(kind)
    if (!exerciseIds || exerciseIds.length === 0) continue
    steps.push({ index: index + 1, kind, exerciseIds })
  }
  return steps
}

export interface StepEvaluation {
  /** Шаг пройден — можно идти дальше. */
  passed: boolean
  /** Блок предлагается повторить, но не принуждает (specs/02 §2: слух <60%). */
  retrySuggested: boolean
  /** Доля верных с первой попытки среди отвеченных, 0–1 (null — нечего считать). */
  accuracy: number | null
}

/**
 * Критерий перехода шага (specs/02 §2): правило/построение/речь/цитаты — все
 * задания отвечены (ошибки не блокируют); разогрев — ≥70% с первой попытки,
 * иначе блок повторяется; слух — все отвечены, <60% — плашка-предложение.
 */
export function evaluateStep(kind: StepKind, score: StepScore): StepEvaluation {
  const accuracy = score.answered > 0 ? score.firstTryCorrect / score.answered : null
  const allAnswered = score.total > 0 && score.answered >= score.total
  switch (kind) {
    case 'warmup':
      return { passed: allAnswered && (accuracy ?? 0) >= 0.7, retrySuggested: false, accuracy }
    case 'listening':
      return {
        passed: allAnswered,
        retrySuggested: allAnswered && (accuracy ?? 1) < 0.6,
        accuracy,
      }
    case 'deck':
      return { passed: allAnswered, retrySuggested: false, accuracy }
    default:
      return { passed: allAnswered, retrySuggested: false, accuracy }
  }
}
