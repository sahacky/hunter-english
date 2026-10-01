// Implements: plan://onboarding#O.7 — домен «Оценки Охотника»
import { describe, expect, it } from 'vitest'
import {
  nextPlacementTask,
  placementVerdict,
  wrongsByRank,
  type PlacementTask,
  PLACEMENT_RANKS,
} from './placement'

function task(id: string, rank: PlacementTask['rank']): PlacementTask {
  return { id, rank, promptRu: `ru-${id}`, accepted: [`en-${id}`] }
}

/** Полный поток: по 2 задачи на полосу E→A. */
const TASKS: PlacementTask[] = PLACEMENT_RANKS.flatMap((rank) =>
  [1, 2].map((n) => task(`${rank}-${n}`, rank)),
)

describe('wrongsByRank / placementVerdict', () => {
  it('без ошибок → ранг A, confidence high', () => {
    const answers = TASKS.map((x) => ({ taskId: x.id, correct: true }))
    expect(placementVerdict(TASKS, answers)).toEqual({ rank: 'A', confidence: 'high' })
  })

  it('ранг не выше последней представленной полосы (завышение невозможно)', () => {
    // задачи только E и D, все верно → D, а не A
    const subset = TASKS.filter((task) => task.rank === 'E' || task.rank === 'D')
    const answers = subset.map((x) => ({ taskId: x.id, correct: true }))
    expect(placementVerdict(subset, answers)).toEqual({ rank: 'D', confidence: 'high' })
  })

  it('завалена E (2 ошибки) → ранг E; confidence low при промахе в вердикт-полосе', () => {
    const answers = [
      { taskId: 'E-1', correct: false },
      { taskId: 'E-2', correct: false },
    ]
    expect(placementVerdict(TASKS, answers)).toEqual({ rank: 'E', confidence: 'low' })
  })

  it('завалена D → ранг E (полоса до завала); E без ошибок → high', () => {
    const answers = [
      { taskId: 'E-1', correct: true },
      { taskId: 'E-2', correct: true },
      { taskId: 'D-1', correct: false },
      { taskId: 'D-2', correct: false },
    ]
    expect(placementVerdict(TASKS, answers)).toEqual({ rank: 'E', confidence: 'high' })
  })

  it('одна ошибка в полосе не валит её: B с 1 ошибкой → ранг A, high', () => {
    const answers = [
      ...['E-1', 'E-2', 'D-1', 'D-2', 'C-1', 'C-2'].map((id) => ({ taskId: id, correct: true })),
      { taskId: 'B-1', correct: false },
      { taskId: 'B-2', correct: true },
      ...['A-1', 'A-2'].map((id) => ({ taskId: id, correct: true })),
    ]
    expect(placementVerdict(TASKS, answers)).toEqual({ rank: 'A', confidence: 'high' })
  })

  it('промах в вердикт-полосе → confidence low (ранг не падает)', () => {
    const answers = [
      ...['E-1', 'E-2', 'D-1', 'D-2', 'C-1', 'C-2', 'B-1', 'B-2'].map((id) => ({
        taskId: id,
        correct: true,
      })),
      { taskId: 'A-1', correct: false },
      { taskId: 'A-2', correct: true },
    ]
    expect(placementVerdict(TASKS, answers)).toEqual({ rank: 'A', confidence: 'low' })
  })

  it('wrongsByRank считает только ошибки; чужие taskId игнорируются', () => {
    const wrongs = wrongsByRank(TASKS, [
      { taskId: 'C-1', correct: false },
      { taskId: 'C-2', correct: false },
      { taskId: 'B-1', correct: true },
      { taskId: 'нет-такой', correct: false },
    ])
    expect(wrongs.get('C')).toBe(2)
    expect(wrongs.has('B')).toBe(false)
  })
})

describe('nextPlacementTask (адаптивный поток)', () => {
  it('выдаёт задачи по порядку, пропуская отвеченные', () => {
    expect(nextPlacementTask(TASKS, [])!.id).toBe('E-1')
    expect(nextPlacementTask(TASKS, [{ taskId: 'E-1', correct: true }])!.id).toBe('E-2')
  })

  it('2 ошибки в полосе закрывают тест немедленно', () => {
    const answers = [
      { taskId: 'E-1', correct: true },
      { taskId: 'E-2', correct: true },
      { taskId: 'D-1', correct: false },
      { taskId: 'D-2', correct: false },
    ]
    expect(nextPlacementTask(TASKS, answers)).toBeNull()
  })

  it('все отвечены → null', () => {
    const answers = TASKS.map((x) => ({ taskId: x.id, correct: true }))
    expect(nextPlacementTask(TASKS, answers)).toBeNull()
  })
})
