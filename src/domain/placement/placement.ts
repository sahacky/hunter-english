// Implements: plan://onboarding#O.2 — домен «Оценки Охотника» (specs/01 §1 2a, specs/07 §2.2).
// Входной тест назначает стартовый ранг E–A (S — только через Врата).
// Чистый TS без знания о контенте/хранилище: экран подаёт задачи, домен
// ведёт адаптивный поток и выносит вердикт.

/** Ранги, назначаемые оценкой (S в списке намеренно нет — specs/01 §1 2a). */
export const PLACEMENT_RANKS = ['E', 'D', 'C', 'B', 'A'] as const
export type PlacementRank = (typeof PLACEMENT_RANKS)[number]

/** Задача оценки: перевод фразы-маяка полосы ранга. */
export interface PlacementTask {
  id: string
  rank: PlacementRank
  promptRu: string
  accepted: string[]
}

/** Ошибки в полосе, после которых полоса (и тест) закрывается. */
export const WRONGS_TO_STOP = 2

export interface PlacementAnswer {
  taskId: string
  correct: boolean
}

export interface PlacementVerdict {
  rank: PlacementRank
  /** high — чистый срез (вердикт-полоса без ошибок); low — были промахи. */
  confidence: 'high' | 'low'
}

/** Сводка ошибок по полосам. */
export function wrongsByRank(
  tasks: readonly PlacementTask[],
  answers: readonly PlacementAnswer[],
): Map<PlacementRank, number> {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const wrongs = new Map<PlacementRank, number>()
  for (const answer of answers) {
    const task = byId.get(answer.taskId)
    if (task && !answer.correct) wrongs.set(task.rank, (wrongs.get(task.rank) ?? 0) + 1)
  }
  return wrongs
}

/**
 * Вердикт: последняя полоса ДО первой заваленной (≥ WRONGS_TO_STOP ошибок),
 * но не выше последней полосы, которой были задачи (без задач выше — ранг не
 * растёт: тест не проверял этот уровень). Ни одна не завалена → верхняя
 * представленная полоса; завалена E → E. confidence: low при ошибках в вердикт-полосе.
 */
export function placementVerdict(
  tasks: readonly PlacementTask[],
  answers: readonly PlacementAnswer[],
): PlacementVerdict {
  const wrongs = wrongsByRank(tasks, answers)
  const presented = new Set(tasks.map((task) => task.rank))
  let rank: PlacementRank = 'E'
  for (const current of PLACEMENT_RANKS) {
    if (!presented.has(current)) break
    if ((wrongs.get(current) ?? 0) >= WRONGS_TO_STOP) break
    rank = current
  }
  return { rank, confidence: (wrongs.get(rank) ?? 0) > 0 ? 'low' : 'high' }
}

/**
 * Следующая задача потока: задачи идут полосами E→A по порядку; полоса с
 * WRONGS_TO_STOP ошибками закрывает тест (дальше всё слишком сложно).
 * Возвращает null — тест окончен.
 */
export function nextPlacementTask(
  tasks: readonly PlacementTask[],
  answers: readonly PlacementAnswer[],
): PlacementTask | null {
  const wrongs = wrongsByRank(tasks, answers)
  // заваленная полоса закрывает тест целиком — дальнейшие полосы слишком сложны
  if (PLACEMENT_RANKS.some((rank) => (wrongs.get(rank) ?? 0) >= WRONGS_TO_STOP)) return null
  const answered = new Set(answers.map((answer) => answer.taskId))
  for (const task of tasks) {
    if (answered.has(task.id)) continue
    return task
  }
  return null
}
