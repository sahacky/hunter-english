// Implements: plan://onboarding#O.7 — применение стартового ранга
import { describe, expect, it } from 'vitest'
import { applyPlacement, PLACEMENT_WORD_FLOOR, waivedLessonProgress } from './apply'
import type { ProgressRepository } from '../progress'
import type { LessonProgress } from '../lesson/types'
import type { UserStats } from '../game/types'
import { emptyStats } from '../game/types'
import type { PlacementRank } from './placement'

function fakeRepo(): ProgressRepository & {
  stats: UserStats
  lessons: Map<string, LessonProgress>
  suspended: string[]
} {
  const state = {
    stats: emptyStats('2026-01-01T00:00:00Z'),
    lessons: new Map<string, LessonProgress>(),
    suspended: [] as string[],
  }
  return {
    get stats() {
      return state.stats
    },
    get lessons() {
      return state.lessons
    },
    get suspended() {
      return state.suspended
    },
    ensureCards: async () => undefined,
    suspendNotes: async (noteIds) => {
      state.suspended.push(...noteIds)
    },
    getAllCards: async () => [],
    saveAnswer: async (_next: never, _log: never) => undefined,
    countNewAnsweredSince: async () => 0,
    getLessonProgress: async (id: string) => state.lessons.get(id) ?? null,
    getManyLessonProgress: async (ids: string[]) => ids.map((id) => state.lessons.get(id) ?? null),
    putLessonProgress: async (progress: LessonProgress) => {
      state.lessons.set(progress.lesson_id, progress)
    },
    getStats: async () => state.stats,
    putStats: async (stats: UserStats) => {
      state.stats = stats
    },
    getQuestDay: async () => null,
    putQuestDay: async () => undefined,
    getGateAttempt: async () => null,
    putGateAttempt: async () => undefined,
    getQuoteMark: async () => false,
    putQuoteMark: async () => undefined,
  } satisfies ProgressRepository & {
    stats: UserStats
    lessons: Map<string, LessonProgress>
    suspended: string[]
  }
}

const LESSONS = [
  { id: 'les-e-01', rank: 'E' as const },
  { id: 'les-e-02', rank: 'E' as const },
  { id: 'les-d-01', rank: 'D' as const },
  { id: 'les-c-01', rank: 'C' as const },
  { id: 'les-b-01', rank: 'B' as const },
  { id: 'les-a-01', rank: 'A' as const },
  { id: 'les-s-01', rank: 'S' as const },
]

const WORD_RANKS = new Map<string, number>([
  ['the-determiner', 1],
  ['airport-noun', 900],
  ['hotel-noun', 1700],
  ['declare-verb', 2600],
  ['mislead-verb', 3900],
  ['sub-word', Number.POSITIVE_INFINITY], // субтитровые — вне NGSL-полос
])

describe('waivedLessonProgress', () => {
  it('completed без XP-данных: один полный проход, пустые результаты, score null', () => {
    const row = waivedLessonProgress('les-e-01', '2026-02-01T00:00:00Z')
    expect(row.status).toBe('completed')
    expect(row.score).toBeNull()
    expect(row.checkpoint.passesDone).toBe(1)
    expect(row.checkpoint.results).toEqual({})
    expect(row.checkpoint.srsEnqueued).toEqual([])
    expect(row.completed_at).toBe('2026-02-01T00:00:00Z')
  })
})

describe('applyPlacement', () => {
  it('ранг C: уроки E/D зачтены, C+ нет; ранг в статусе; XP не тронут; слова ≤1800 скрыты', async () => {
    const repo = fakeRepo()
    repo.stats.xp = 500
    const result = await applyPlacement({
      repo,
      rank: 'C' as PlacementRank,
      lessons: LESSONS,
      wordRanks: WORD_RANKS,
      now: new Date('2026-02-01T00:00:00Z'),
    })
    expect(result.rank).toBe('C')
    expect(repo.stats.rank).toBe('C')
    expect(repo.stats.xp).toBe(500) // оценка не работает XP
    expect([...repo.lessons.keys()].sort()).toEqual(['les-d-01', 'les-e-01', 'les-e-02'])
    expect(repo.lessons.get('les-e-01')!.status).toBe('completed')
    // полоса C = 1800: the(1), airport(900), hotel(1700) скрыты; declare(2600) — нет
    expect(repo.suspended.sort()).toEqual([
      'note_airport-noun',
      'note_hotel-noun',
      'note_the-determiner',
    ])
  })

  it('start_at_rank (P.2): только ранг в статусе — ни зачётов, ни скрытий слов', async () => {
    const repo = fakeRepo()
    const result = await applyPlacement({
      repo,
      rank: 'C' as PlacementRank,
      mode: 'start_at_rank',
      lessons: LESSONS,
      wordRanks: WORD_RANKS,
      now: new Date('2026-02-01T00:00:00Z'),
    })
    expect(result.rank).toBe('C')
    expect(repo.stats.rank).toBe('C')
    expect(repo.lessons.size).toBe(0) // нижние уроки доступны, но не зачтены
    expect(repo.suspended).toEqual([]) // слова полосы не скрываются
  })

  it('ранг E: ничего не зачитывается и не скрывается (floor 0)', async () => {
    const repo = fakeRepo()
    await applyPlacement({
      repo,
      rank: 'E',
      lessons: LESSONS,
      wordRanks: WORD_RANKS,
      now: new Date('2026-02-01T00:00:00Z'),
    })
    expect(repo.lessons.size).toBe(0)
    expect(repo.suspended).toEqual([])
    expect(repo.stats.rank).toBe('E')
  })

  it('ранг A: S-уроки не зачитываются; полоса 4000 скрывает почти всё NGSL', async () => {
    const repo = fakeRepo()
    await applyPlacement({
      repo,
      rank: 'A',
      lessons: LESSONS,
      wordRanks: WORD_RANKS,
      now: new Date('2026-02-01T00:00:00Z'),
    })
    expect(repo.lessons.has('les-s-01')).toBe(false)
    expect(repo.lessons.has('les-b-01')).toBe(true)
    expect(repo.suspended).toContain('note_mislead-verb')
    expect(repo.suspended).not.toContain('note_sub-word') // Infinity ≤ 4000 — false
    expect(PLACEMENT_WORD_FLOOR.A).toBe(4000)
  })
})
