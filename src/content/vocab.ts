// Implements: plan://travel-vocab#V.3 — мини-словарь путешественника (data/vocab/, specs/05)
import { assertEnvelope } from './envelope'

/** Слово мини-словаря — схема data/schemas/vocab.schema.json. */
export interface TravelVocabEntry {
  topic: string
  en: string
  ru: string
  audio?: string
}

interface VocabFile {
  schema_version: number
  kind: 'vocab'
  items: TravelVocabEntry[]
}

const vocabModules = import.meta.glob('/data/vocab/*.json') as Record<
  string,
  () => Promise<VocabFile>
>

/** Порядок тем мини-словаря на экране (id тем из data/vocab/travel.json). */
export const VOCAB_TOPICS = [
  'politeness',
  'communication',
  'airport',
  'hotel',
  'restaurant',
  'shopping',
  'transport',
  'health',
  'numbers-time',
] as const

/** Все слова мини-словаря (ленивые чанки data/vocab/). */
export async function loadTravelVocab(): Promise<TravelVocabEntry[]> {
  const files = await Promise.all(Object.values(vocabModules).map((load) => load()))
  return files.flatMap((file, i) => {
    assertEnvelope(file, 'vocab', `data/vocab #${i}`)
    return file.items
  })
}

/** Группировка по темам в порядке VOCAB_TOPICS; неизвестные темы — в конец по алфавиту. */
export function groupVocabByTopic(
  entries: readonly TravelVocabEntry[],
): { topic: string; words: TravelVocabEntry[] }[] {
  const byTopic = new Map<string, TravelVocabEntry[]>()
  for (const entry of entries) {
    const list = byTopic.get(entry.topic)
    if (list) list.push(entry)
    else byTopic.set(entry.topic, [entry])
  }
  const known = [...VOCAB_TOPICS].filter((topic) => byTopic.has(topic))
  const rest = [...byTopic.keys()]
    .filter((topic) => !(VOCAB_TOPICS as readonly string[]).includes(topic))
    .sort()
  return [...known, ...rest].map((topic) => ({ topic, words: byTopic.get(topic)! }))
}
