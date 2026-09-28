// Implements: plan://M5#5.1 — алгоритм проверки ответов (specs/02 §4.3–§4.8)
// Чистый TS: на вход — ответ пользователя и эталоны задания, на выход — вердикт с diff.

import { alignWords, countTypos, countWrong } from './align'
import { expandTokens, normalize, tokenize } from './normalize'
import type { CheckMode, CheckResult, CheckTask, DiffToken } from './types'

/** Ловушки, для которых опечатки не прощаются (specs/02 §4.7). */
export const STRICT_TYPO_TRAPS: ReadonlySet<string> = new Set(['ЛТ-06', 'ЛТ-17', 'ЛТ-19'])

/** Максимум слов с опечатками, при котором ответ ещё засчитывается (§4.4). */
const MAX_TYPOS = 2

/** Пороги мягкой голосовой проверки (specs/02 §4.8). */
const VOICE_RATIO = 0.85
const VOICE_RATIO_LONG = 0.8
const VOICE_LONG_PHRASE = 8

interface Candidate {
  diff: DiffToken[]
  typos: number
  wrong: number
  ref: string
}

function buildCandidate(
  userTokens: readonly string[],
  refTokens: readonly string[],
  ref: string,
  exactTypos: boolean,
): Candidate {
  const diff = alignWords(userTokens, refTokens, exactTypos)
  return { diff, typos: countTypos(diff), wrong: countWrong(diff), ref }
}

/**
 * Сравнение текста с эталонами (specs/02 §4.4): каждый вариант — в двух проходах
 * (как есть и с раскрытием сокращений, §4.2). Вердикт — лучший: сначала точное
 * совпадение, затем ≤2 слов с опечатками; иначе «неверно» с diff лучшего варианта.
 * Если длина ответа и варианта различается больше чем на 2 слова — выравнивание
 * строится для diff, но такой проход не засчитывается (§4.4).
 * Ловушки (§4.3/§4.7) применяет judge — здесь чистое сравнение.
 */
export function checkText(userInput: string, task: CheckTask): CheckResult {
  const userTokens = tokenize(userInput)
  const userExpanded = expandTokens(userTokens)
  let bestPass: Candidate | null = null
  let bestFail: Candidate | null = null
  for (const ref of task.accepted) {
    const refTokens = expandTokens(tokenize(ref))
    for (const tokens of [userTokens, userExpanded]) {
      const candidate = buildCandidate(tokens, refTokens, ref, task.exactTypos === true)
      const lenGap = Math.abs(tokens.length - refTokens.length) > 2
      const passes = !lenGap && candidate.wrong === 0 && candidate.typos <= MAX_TYPOS
      if (passes) {
        if (!bestPass || candidate.typos < bestPass.typos) bestPass = candidate
      } else if (!bestFail || candidate.wrong + candidate.typos < bestFail.wrong + bestFail.typos) {
        bestFail = candidate
      }
      if (bestPass && bestPass.typos === 0) {
        return toResult('correct', bestPass, false)
      }
    }
  }
  if (bestPass) {
    return toResult(bestPass.typos > 0 ? 'correct_typo' : 'correct', bestPass, false)
  }
  return toResult('wrong', bestFail ?? emptyCandidate(userInput), false)
}

/** Явно запрещённый паттерн ловушки совпал (§4.3): сравнение как есть и с раскрытием. */
function matchesTrapWrong(userInput: string, trapWrong: string): boolean {
  const plain = normalize(userInput) === normalize(trapWrong)
  if (plain) return true
  const userExpanded = expandTokens(tokenize(userInput))
  const trapExpanded = expandTokens(tokenize(trapWrong))
  return (
    userExpanded.length === trapExpanded.length &&
    userExpanded.every((word, index) => word === trapExpanded[index])
  )
}

/**
 * Полный вердикт (specs/02 §4.7): голос — мягкая проверка §4.8, текст — §4.4
 * плюс явный запрет паттерна ловушки (§4.3) и строгие ловушки ЛТ-06/17/19 (§4.7).
 */
export function judge(userInput: string, task: CheckTask, mode: CheckMode = 'text'): CheckResult {
  if (mode === 'voice') return judgeVoice(userInput, task)
  const result = checkText(userInput, task)
  if (task.trapWrong && matchesTrapWrong(userInput, task.trapWrong)) {
    return { ...result, verdict: 'wrong', trapTriggered: true }
  }
  if (result.verdict === 'correct_typo' && task.trapLtId && STRICT_TYPO_TRAPS.has(task.trapLtId)) {
    return { ...result, verdict: 'wrong' }
  }
  return result
}

/**
 * Диктант (specs/02 §3, тип 5): пропущенные артикли a/an/the — опечатка,
 * а не ошибка. Прощаются только ПРОПУЩЕННЫЕ пользователем артикли эталона
 * (не более 2): строгий вердикт «неверно» пересматривается по эталонам без
 * артиклей; лишние артикли ответа остаются ошибкой (лишнее слово). Прочие
 * опечатки — по общим правилам §4.4 через judge.
 */
export function judgeDictation(userInput: string, task: CheckTask): CheckResult {
  const strict = judge(userInput, task)
  if (strict.verdict !== 'wrong') return strict
  const userTokens = expandTokens(tokenize(userInput))
  const articles = ['a', 'an', 'the']
  // считаем пропущенные артикли по эталонам, чьи прочие слова покрываются ответом
  let minForgiven = Infinity
  for (const ref of task.accepted) {
    const refTokens = expandTokens(tokenize(ref))
    const rest = [...userTokens]
    let missing = 0
    let covered = true
    for (const word of refTokens) {
      const index = rest.indexOf(word)
      if (index >= 0) rest.splice(index, 1)
      else if (articles.includes(word)) missing += 1
      else covered = false
    }
    if (covered) minForgiven = Math.min(minForgiven, missing)
  }
  if (minForgiven > 2) return strict
  const refWithoutArticles = (s: string) => stripArticles(expandTokens(tokenize(s))).join(' ')
  const relaxed = judge(userInput, { ...task, accepted: task.accepted.map(refWithoutArticles) })
  const ok = relaxed.verdict === 'correct' || relaxed.verdict === 'correct_typo'
  return ok ? { ...relaxed, verdict: 'correct_typo' } : strict
}

/** Убирает артикли из распознанной речи (specs/02 §4.8). */
function stripArticles(tokens: readonly string[]): string[] {
  return tokens.filter((token) => token !== 'a' && token !== 'an' && token !== 'the')
}

/**
 * Мягкая проверка распознанной речи (specs/02 §4.8): сравнение по словам,
 * порог 0.85 (0.80 для фраз длиннее 8 слов); порог из данных —
 * `answer.speech_threshold` (specs/05 §3), если задан.
 * M6#6.2 (решение M6#2): артикли a/an/the исключаются из ОБОИХ сторон —
 * распознавание регулярно их глотает, знаменатель считается по не-артикльным
 * словам эталона (REVIEW-маркер M5 снят; кандидат на правку specs/02 §4.8).
 * Diff строится по тем же «голым» токенам — вердикт и подсветка не спорят.
 * VERDICT_RETRY ошибкой не считается: попытки не ограничены (§4.8).
 */
export function judgeVoice(recognized: string, task: CheckTask): CheckResult {
  const userTokens = stripArticles(expandTokens(tokenize(recognized)))
  const baseThreshold = task.speechThreshold ?? VOICE_RATIO
  let best: { ratio: number; candidate: Candidate } | null = null
  for (const ref of task.accepted) {
    const refTokens = expandTokens(tokenize(ref))
    const refBare = stripArticles(refTokens)
    // эталон из одних артиклей — сравниваем без раздевания (латентный случай данных)
    const effective = refBare.length > 0 ? refBare : refTokens
    const compareAgainst = refBare.length > 0 ? userTokens : expandTokens(tokenize(recognized))
    if (effective.length === 0) continue
    const pool = [...compareAgainst]
    let matched = 0
    for (const word of effective) {
      const index = pool.indexOf(word)
      if (index >= 0) {
        matched += 1
        pool.splice(index, 1)
      }
    }
    const ratio = matched / effective.length
    const threshold = effective.length > VOICE_LONG_PHRASE ? VOICE_RATIO_LONG : baseThreshold
    const candidate = buildCandidate(compareAgainst, effective, ref, task.exactTypos === true)
    if (!best || ratio > best.ratio) best = { ratio, candidate }
    if (ratio >= threshold) {
      return toResult('correct', candidate, false)
    }
  }
  return toResult('retry', best?.candidate ?? emptyCandidate(recognized), false)
}

function emptyCandidate(input: string): Candidate {
  return { diff: [], typos: 0, wrong: 0, ref: input }
}

function toResult(
  verdict: CheckResult['verdict'],
  candidate: Candidate,
  trap: boolean,
): CheckResult {
  return {
    verdict,
    diff: candidate.diff,
    ref: candidate.ref,
    trapTriggered: trap,
  }
}
