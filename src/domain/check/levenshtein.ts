// Implements: plan://M5#5.1 — сравнение слов и пороги опечаток (specs/02 §4.4)

/**
 * Слова, где опечатка меняет смысл: для них typoLimit = 0 (specs/02 §4.4).
 * Список черновой из спеки; финализирован при написании тестов (открытый вопрос 3
 * specs/02): expansions сокращений («cannot», «gonna») снимают часть неоднозначностей,
 * состав оставлен как в спеке — канон.
 */
export const EXCEPTIONS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'the',
  'in',
  'on',
  'at',
  'to',
  'of',
  'and',
  'or',
  'not',
  'no',
  'is',
  'are',
  'was',
  'were',
  'am',
  'be',
  'been',
  'do',
  'does',
  'did',
  'will',
  'would',
  'can',
  'could',
  'must',
  'should',
  'have',
  'has',
  'had',
  'i',
  'you',
  'he',
  'she',
  'it',
  'we',
  'they',
  'my',
  'your',
  'his',
  'her',
  'its',
  'our',
  'their',
])

/** Расстояние Левенштейна (вставка/удаление/замена, вес 1). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i]
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, substitution)
    }
    prev = curr
  }
  return prev[b.length]
}

/** Порог опечаток слова эталона: ≤3 букв — 0, ≤7 — 1, 8+ — 2 (specs/02 §4.4). */
export function typoLimit(refWord: string): number {
  const len = refWord.length
  if (len <= 3) return 0
  if (len <= 7) return 1
  return 2
}

export type WordMatch = 'match' | 'typo' | 'mismatch'

/** Сравнение пары слов: совпадение / допустимая опечатка / ошибка (specs/02 §4.4). */
export function compareWords(userToken: string, refToken: string): WordMatch {
  if (userToken === refToken) return 'match'
  if (EXCEPTIONS.has(userToken) || EXCEPTIONS.has(refToken)) return 'mismatch'
  return levenshtein(userToken, refToken) <= typoLimit(refToken) ? 'typo' : 'mismatch'
}
