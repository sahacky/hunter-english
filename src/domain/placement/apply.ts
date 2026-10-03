// Implements: plan://onboarding#O.3 — применение стартового ранга («Оценка Охотника»).
// Ранг в статус; уроки ниже ранга зачитываются (completed, без XP — оценка не
// экзамен, specs/01 §1 2a); слова ниже полосы ранга скрываются из колоды (suspend).
import type { ProgressRepository } from '../progress'
import type { LessonProgress } from '../lesson/types'
import type { UserStats } from '../game/types'
import type { PlacementRank } from './placement'

/** Индекс ранга для сравнения «ниже/выше» (S выше всех — оценкой не назначается). */
export const RANK_INDEX: Record<'E' | 'D' | 'C' | 'B' | 'A' | 'S', number> = {
  E: 0,
  D: 1,
  C: 2,
  B: 3,
  A: 4,
  S: 5,
}

/**
 * Полоса слов, «известная» стартовому рангу (план U3.2: вердикт = СТАРТ ранга,
 * скрыта полоса НИЖЕ ранга — цель предыдущего ранга, RANK_WORD_TARGET):
 * старт D → скрыты ≤300 (полоса E), старт C → ≤1000 (полоса D) и т.д.
 * Новые слова дня идут из полосы текущего ранга (SrsScreen, RANK_WORD_TARGET).
 */
export const PLACEMENT_WORD_FLOOR: Record<PlacementRank, number> = {
  E: 0,
  D: 300,
  C: 1000,
  B: 1800,
  A: 2800,
}

/** Минимальный lesson_progress «зачтено оценкой»: один полный проход, финал. */
export function waivedLessonProgress(lessonId: string, nowIso: string): LessonProgress {
  return {
    lesson_id: lessonId,
    status: 'completed',
    score: null, // точность неизвестна — оценки не было; повтор урока доступен
    checkpoint: {
      passIndex: 0,
      stepIndex: 7,
      scores: [],
      srsEnqueued: [], // фразы зачтённых уроков в колоду не уходят
      passesDone: 1,
      results: {},
    },
    completed_at: nowIso,
    updated_at: nowIso,
  }
}

export type ApplyPlacementMode = 'waive' | 'start_at_rank'

export interface ApplyPlacementArgs {
  repo: ProgressRepository
  rank: PlacementRank
  /**
   * waive — зачитать уроки ниже ранга (completed без XP) и скрыть слова полосы
   * (поведение O.3); start_at_rank — только ранг в статус, ничего не зачитывается
   * и не скрывается: пользователь начинает с первого урока ранга, нижние доступны
   * (plan://curriculum-review#P.2).
   */
  mode?: ApplyPlacementMode
  /** Все уроки (id + rank) — зачитываются те, что ниже ранга. */
  lessons: readonly { id: string; rank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S' }[]
  /** entityId слова → лучший частотный ранг (loadWordRanks). */
  wordRanks: ReadonlyMap<string, number>
  now: Date
}

/**
 * Применить вердикт оценки. Идемпотентно: повторный вызов с тем же рангом
 * перезапишет те же строки. XP не начисляется и не сбрасывается.
 */
export async function applyPlacement(args: ApplyPlacementArgs): Promise<UserStats> {
  const { repo, rank, lessons, wordRanks, now, mode = 'waive' } = args
  const stats = await repo.getStats()
  const next: UserStats = { ...stats, rank, updated_at: now.toISOString() }
  await repo.putStats(next)

  if (mode === 'start_at_rank') return next

  const target = RANK_INDEX[rank]
  for (const lesson of lessons) {
    if (RANK_INDEX[lesson.rank] >= target) continue
    await repo.putLessonProgress(waivedLessonProgress(lesson.id, now.toISOString()))
  }

  const floor = PLACEMENT_WORD_FLOOR[rank]
  if (floor > 0) {
    const noteIds = [...wordRanks.entries()]
      .filter(([, freqRank]) => freqRank <= floor)
      .map(([entityId]) => `note_${entityId}`)
    await repo.suspendNotes(noteIds)
  }
  return next
}
