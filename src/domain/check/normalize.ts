// Implements: plan://M5#5.1 — нормализация и эквивалентность сокращений (specs/02 §4.1–§4.2)

/**
 * Нормализация строки (specs/02 §4.1): регистр, апострофы, кавычки,
 * лишние пробелы, конечные знаки пунктуации.
 */
export function normalize(input: string): string {
  let s = input.trim().toLowerCase()
  s = s.replace(/[’‘´`]/g, "'")
  s = s.replace(/[“”«»„]/g, '"')
  s = s.replace(/\s+/g, ' ')
  s = s.replace(/[.!,;:?…]+$/, '')
  return s.trim()
}

/**
 * Разбивает нормализованную строку на слова; поверхностная пунктуация
 * каждого токена снимается (апостроф и дефис внутри слова сохраняются).
 */
export function tokenize(input: string): string[] {
  return normalize(input)
    .split(' ')
    .filter(Boolean)
    .map((token) => token.replace(/^[.,!?;:"'…()[\]–—-]+/, '').replace(/[.,!?;:"'…()[\]–—-]+$/, ''))
    .filter(Boolean)
}

/**
 * Сокращения эквивалентны полной форме (specs/02 §4.2).
 * `can't` = `cannot` = `can not` — канон спеки даёт тройную эквивалентность,
 * поэтому все три формы раскрываются в [can, not] (в псевдокоде §4.2 can't → cannot,
 * но тогда «can not» не сравнялся бы с «cannot» — следуем утверждению спеки).
 * `gonna` → going to: сравнение расширенных строк само обеспечивает условие
 * «только если в variants[] есть going to-вариант».
 */
export const CONTRACTIONS: Readonly<Record<string, readonly string[]>> = {
  "i'm": ['i', 'am'],
  "you're": ['you', 'are'],
  "we're": ['we', 'are'],
  "they're": ['they', 'are'],
  "he's": ['he', 'is'],
  "she's": ['she', 'is'],
  "it's": ['it', 'is'],
  "that's": ['that', 'is'],
  "what's": ['what', 'is'],
  "where's": ['where', 'is'],
  "who's": ['who', 'is'],
  "there's": ['there', 'is'],
  "don't": ['do', 'not'],
  "doesn't": ['does', 'not'],
  "didn't": ['did', 'not'],
  "isn't": ['is', 'not'],
  "aren't": ['are', 'not'],
  "wasn't": ['was', 'not'],
  "weren't": ['were', 'not'],
  "won't": ['will', 'not'],
  "can't": ['can', 'not'],
  cannot: ['can', 'not'],
  "i've": ['i', 'have'],
  "you've": ['you', 'have'],
  "we've": ['we', 'have'],
  "they've": ['they', 'have'],
  "i'll": ['i', 'will'],
  "you'll": ['you', 'will'],
  "we'll": ['we', 'will'],
  "they'll": ['they', 'will'],
  "he'll": ['he', 'will'],
  "she'll": ['she', 'will'],
  "it'll": ['it', 'will'],
  "i'd": ['i', 'would'],
  "you'd": ['you', 'would'],
  "we'd": ['we', 'would'],
  "they'd": ['they', 'would'],
  gonna: ['going', 'to'],
}

/** Раскрывает сокращения в последовательности токенов (пока есть замены). */
export function expandTokens(tokens: readonly string[]): string[] {
  let current = [...tokens]
  for (let pass = 0; pass < 3; pass += 1) {
    const next: string[] = []
    let changed = false
    for (const token of current) {
      const expansion = CONTRACTIONS[token]
      if (expansion) {
        next.push(...expansion)
        changed = true
      } else {
        next.push(token)
      }
    }
    current = next
    if (!changed) break
  }
  return current
}
