// Implements: plan://onboarding#O.2, plan://curriculum-review#P.1 — задачи «Оценки Охотника».
// Маяки: 5-й урок каждого ранга (тема устоялась, лексика базовая для полосы);
// 6 фраз на ранг (выборка ≥5–6, P.1) с добором из соседних уроков ранга, если
// в маяке не хватает однозначных RU-промптов; дубли переводов исключаются.
import type { LessonItem, PhraseItem } from './lessons'
import { PLACEMENT_RANKS, type PlacementTask } from '../domain/placement/placement'

const TASKS_PER_RANK = 6
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
    if (rankLessons.length === 0) continue
    // от маяка к краям: сначала сам маяк (5-й урок или первый), затем остальные уроки ранга по порядку
    const anchorPos = rankLessons.length > ANCHOR_INDEX ? ANCHOR_INDEX : 0
    const ordered = [...rankLessons.slice(anchorPos), ...rankLessons.slice(0, anchorPos)]
    let taken = 0
    for (const lesson of ordered) {
      for (const phraseId of lesson.grammar_point.phrase_ids) {
        if (taken >= TASKS_PER_RANK) break
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
      }
      if (taken >= TASKS_PER_RANK) break
    }
  }
  return tasks
}
