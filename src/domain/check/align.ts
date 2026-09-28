// Implements: plan://M5#5.1 — diff-выравнивание по словам (specs/02 §4.4–§4.5)

import { compareWords } from './levenshtein'
import type { DiffToken } from './types'

/** Стоимость замены в выравнивании: совпадение 0, допустимая опечатка 1, ошибка 2. */
function subCost(userToken: string, refToken: string, exactTypos: boolean): number {
  if (userToken === refToken) return 0
  if (exactTypos) return 2
  return compareWords(userToken, refToken) === 'typo' ? 1 : 2
}

/** Внутренний op backtrace: wrong — ошибочная замена, разворачивается в extra+missing. */
interface AlignOp {
  kind: 'match' | 'typo' | 'wrong' | 'extra' | 'missing'
  word?: string
  ref?: string
}

/**
 * Выравнивает слова ответа со словами эталона (DP-алгоритм, как в diff).
 * Ошибочная замена разворачивается в пару «лишнее слово» + «пропущенное слово»,
 * чтобы статусы соответствовали подсветке specs/02 §4.5.
 * Чистая функция; порядок статусов в результате — слева направо по фразе.
 */
export function alignWords(
  user: readonly string[],
  ref: readonly string[],
  exactTypos = false,
): DiffToken[] {
  const n = user.length
  const m = ref.length
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = 0; i <= n; i += 1) d[i][0] = i
  for (let j = 0; j <= m; j += 1) d[0][j] = j
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const diagonal = d[i - 1][j - 1] + subCost(user[i - 1], ref[j - 1], exactTypos)
      const extra = d[i - 1][j] + 1
      const missing = d[i][j - 1] + 1
      d[i][j] = Math.min(diagonal, extra, missing)
    }
  }
  const ops: AlignOp[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      d[i][j] === d[i - 1][j - 1] + subCost(user[i - 1], ref[j - 1], exactTypos)
    ) {
      const u = user[i - 1]
      const r = ref[j - 1]
      if (u === r) {
        ops.push({ kind: 'match', word: u })
      } else if (!exactTypos && compareWords(u, r) === 'typo') {
        ops.push({ kind: 'typo', word: u, ref: r })
      } else {
        ops.push({ kind: 'wrong', word: u, ref: r })
      }
      i -= 1
      j -= 1
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ kind: 'extra', word: user[i - 1] })
      i -= 1
    } else {
      ops.push({ kind: 'missing', word: ref[j - 1] })
      j -= 1
    }
  }
  // backtrace идёт с конца; после реверса wrong разворачивается в extra → missing
  const result: DiffToken[] = []
  for (let k = ops.length - 1; k >= 0; k -= 1) {
    const op = ops[k]
    if (op.kind === 'wrong') {
      result.push({ status: 'extra', word: op.word })
      result.push({ status: 'missing', word: op.ref })
    } else {
      result.push({ status: op.kind, word: op.word, ref: op.ref })
    }
  }
  return result
}

/** Число слов с допустимой опечаткой в выравнивании. */
export function countTypos(diff: readonly DiffToken[]): number {
  return diff.filter((t) => t.status === 'typo').length
}

/** Число ошибочных слов: лишних и пропущенных (specs/02 §4.4 — `wrong`). */
export function countWrong(diff: readonly DiffToken[]): number {
  return diff.filter((t) => t.status === 'extra' || t.status === 'missing').length
}
