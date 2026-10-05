// Implements: plan://teaching-quality#Q2.1 — адаптивная презентация серии
// (research/10-teaching-quality/02 §3 №5, Flow-триада): точность серии >95% →
// challenge (word_bank как текстовый ввод), <70% → support (подсказка первого
// слова без XP-штрафа). Меняется ТОЛЬКО презентация: состав упражнений, id и
// XP не трогаются — restore чекпоинта стабилен (Watch out WAL: рантайм-перевыбор
// упражнений запрещён).

/** Профиль адаптивной презентации текущей серии ответов. */
export type AdaptiveProfile = 'support' | 'standard' | 'challenge'

/** Скользящее окно серии: последние N отвеченных заданий прохода. */
export const ADAPTIVE_WINDOW = 10

/** Минимум отвеченных до включения адаптации (разгон серии). */
export const ADAPTIVE_MIN_ANSWERED = 5

const SUPPORT_BELOW = 0.7
const CHALLENGE_ABOVE = 0.95

/**
 * Профиль по исходам отвеченных заданий прохода (в порядке следования;
 * outcome — как в checkpoint.results: 'correct' = верно с первой попытки).
 * 'correct_retry'/'hint'/'skip'/'self_reported'/'disputed' — не first-try.
 */
export function adaptiveProfile(outcomes: readonly string[]): AdaptiveProfile {
  const recent = outcomes.slice(-ADAPTIVE_WINDOW)
  if (recent.length < ADAPTIVE_MIN_ANSWERED) return 'standard'
  const firstTry = recent.filter((outcome) => outcome === 'correct').length
  const accuracy = firstTry / recent.length
  if (accuracy > CHALLENGE_ABOVE) return 'challenge'
  if (accuracy < SUPPORT_BELOW) return 'support'
  return 'standard'
}
