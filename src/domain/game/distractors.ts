// Implements: plan://distractor-quality#D1 — дистракторы экзамена Врат (лексика).
// Чистая функция подбора: похожие на цель по части речи, частотному рангу,
// написанию и пересечению перевода — выбор должен быть сложным и проверять
// знание, а не угадывание («they/as/the» — прежнее поведение slice(0..3)).

/** Кандидат-дистрактор: заметка слова (specs/06 §0, Note без id/deck). */
export interface DistractorCandidate {
  entityId: string
  en: string
  ru: string
}

/** Ранги по entityId — loadWordRanks() (src/content/words). */
export type RankMap = ReadonlyMap<string, number>

/** Окно близости частотного ранга: ближе — похожее по «уровню» слова. */
const RANK_WINDOW = 300
/** Сколько лучших кандидатов конкурируют за слот (разнообразие между попытками). */
const DIVERSITY_POOL = 8

/** Часть речи из entityId (`lemma-pos` → `pos`; лемма может содержать дефис). */
function posOf(entityId: string): string {
  const dash = entityId.lastIndexOf('-')
  return dash === -1 ? '' : entityId.slice(dash + 1)
}

/** Редакционное расстояние (Левенштейн) — слова короткие, O(n·m) достаточно. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i]
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(
        prev[j]! + 1,
        row[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = row
  }
  return prev[b.length]!
}

/** Похожесть написания 0..1 (1 — совпадение). */
function spellingSimilarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length)
  if (max === 0) return 0
  return 1 - levenshtein(a, b) / max
}

/** Значимые токены перевода: часть речи/вариант перевода пересекаются — смысловая близость. */
function ruTokens(ru: string): Set<string> {
  return new Set(
    ru
      .toLowerCase()
      .split(/[^a-zа-яё]+/)
      .filter((token) => token.length >= 3),
  )
}

/**
 * Скоринг кандидата: чем выше — тем «коварнее» дистрактор.
 * Компоненты: часть речи (×2), окно ранга (до ×2), написание (до ×2.5,
 * от порога 0.45), общие токены перевода (×1.5).
 */
export function scoreDistractor(
  target: DistractorCandidate,
  candidate: DistractorCandidate,
  ranks: RankMap,
): number {
  let score = 0
  if (posOf(candidate.entityId) === posOf(target.entityId)) score += 2
  const targetRank = ranks.get(target.entityId)
  const candidateRank = ranks.get(candidate.entityId)
  if (targetRank !== undefined && candidateRank !== undefined) {
    const delta = Math.abs(targetRank - candidateRank)
    if (delta <= RANK_WINDOW) score += 2 * (1 - delta / RANK_WINDOW)
  }
  const spelling = spellingSimilarity(target.en, candidate.en)
  if (spelling >= 0.45) score += 2.5 * spelling
  const targetTokens = ruTokens(target.ru)
  for (const token of ruTokens(candidate.ru)) {
    if (targetTokens.has(token)) {
      score += 1.5
      break
    }
  }
  return score
}

/**
 * Топ-дистракторы для цели: кандидаты сортируются по скорингу, из лучших
 * DIVERSITY_POOL штук rng выбирает `count` — сложность стабильна, состав
 * варьируется между попытками. Возвращает меньше `count` только если пул мал.
 */
export function pickDistractors(
  target: DistractorCandidate,
  candidates: readonly DistractorCandidate[],
  ranks: RankMap,
  count: number,
  rng: () => number,
): DistractorCandidate[] {
  const seenEn = new Set([target.en])
  const scored: { candidate: DistractorCandidate; score: number }[] = []
  for (const candidate of candidates) {
    if (candidate.en === target.en || seenEn.has(candidate.en)) continue
    if (candidate.ru === target.ru) continue
    seenEn.add(candidate.en)
    scored.push({ candidate, score: scoreDistractor(target, candidate, ranks) })
  }
  scored.sort((a, b) => b.score - a.score || (a.candidate.entityId < b.candidate.entityId ? -1 : 1))
  const pool = scored.slice(0, Math.max(count, DIVERSITY_POOL)).map((s) => s.candidate)
  const out: DistractorCandidate[] = []
  // лучший («коварнейший») — всегда в наборе: порог сложности не зависит от rng;
  // вариативность между попытками — выбор остальных из окна разнообразия
  if (count > 0 && pool.length > 0) out.push(...pool.splice(0, 1))
  while (out.length < count && pool.length > 0) {
    out.push(...pool.splice(Math.floor(rng() * pool.length), 1))
  }
  return out
}
