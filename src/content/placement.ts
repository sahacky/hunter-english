// Implements: plan://onboarding#O.2 — задачи «Оценки Охотника» из контента.
// Маяки: 5-й урок каждого ранга (тема устоялась, лексика базовая для полосы);
// по 3 фразы на ранг, промпты без дублей переводов (однозначность RU).
import type { LessonItem, PhraseItem } from './lessons'
import { PLACEMENT_RANKS, type PlacementTask } from '../domain/placement/placement'

const TASKS_PER_RANK = 3
/** Индекс урока-маяка внутри ранга (5-й урок: E-05 «Повторение №1» и т.п.). */
const ANCHOR_INDEX = 4

export function buildPlacementTasks(
  lessons: readonly LessonItem[],
  phrases: readonly PhraseItem[],
): PlacementTask[] {
  const phraseById = new Map(phrases.map((phrase) => [phrase.id, phrase]))
  const usedRu = new Set<string>()
  const tasks: PlacementTask[] = []
  for (const rank of PLACEMENT_RANKS) {
    const rankLessons = lessons.filter((lesson) => lesson.rank === rank)
    const anchor = rankLessons[ANCHOR_INDEX] ?? rankLessons[0]
    if (!anchor) continue
    let taken = 0
    for (const phraseId of anchor.grammar_point.phrase_ids) {
      const phrase = phraseById.get(phraseId)
      if (!phrase || usedRu.has(phrase.translation_ru)) continue
      usedRu.add(phrase.translation_ru)
      tasks.push({
        id: `pl-${phrase.id}`,
        rank,
        promptRu: phrase.translation_ru,
        accepted: [phrase.text_en, ...phrase.variants],
      })
      taken += 1
      if (taken >= TASKS_PER_RANK) break
    }
  }
  return tasks
}
