// Implements: plan://M5#5.2 — правила XP урока (specs/02 §3; значения — specs/04 §4.1)

import type { ExerciseOutcome } from './types'

/**
 * XP за задание: первая попытка — полный XP; верно со второй — 50% (округление
 * вниз — «XP только за реальную работу»); подсказка/пропуск — 0; спорный ответ
 * («Я был прав», specs/02 §4.6) и самопроверка речи — полный XP.
 * «Верно с опечаткой» — полный XP (решение M5#4, specs/02 открытый вопрос 2).
 * Базовые значения берутся из `meta.xp` упражнения (specs/05 §3).
 */
export function xpForOutcome(baseXp: number, outcome: ExerciseOutcome): number {
  switch (outcome) {
    case 'correct':
    case 'disputed':
    case 'self_reported':
      return baseXp
    case 'correct_retry':
      return Math.floor(baseXp / 2)
    case 'hint':
    case 'skip':
      return 0
  }
}
