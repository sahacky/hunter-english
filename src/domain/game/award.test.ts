// Implements: plan://M7#7.3 — тесты XP-шины (fake-indexeddb)
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { HunterDb } from '../../data/db'
import { DexieProgressRepository } from '../../data/progress-repository'
import { uuidv7 } from '../../lib/uuidv7'
import { anySlotDone, awardLessonFinish, awardXp, closeStudyDay } from './award'
import { dayStart } from '../srs/scheduler'
import { createQuestDay } from './game'

const NOW = new Date(2026, 8, 28, 10, 0, 0)

let db: HunterDb
let repo: DexieProgressRepository

beforeEach(() => {
  db = new HunterDb(`hunter-award-test-${uuidv7()}`)
  repo = new DexieProgressRepository(db)
})

describe('awardXp', () => {
  it('начисляет XP с капом и двигает счётчик повторов квеста', async () => {
    const result = await awardXp(repo, NOW, 1, 'reviews', { reviews: 1 })
    expect(result.awarded).toBe(1)
    expect(result.quest.slots.reviews.done).toBe(1)
    expect(result.stats.xp).toBe(1)
    expect((await repo.getQuestDay(result.quest.studyDay))?.xp.reviews).toBe(1)
  })

  it('кап режет превышение', async () => {
    await awardXp(repo, NOW, 200, 'reviews')
    const second = await awardXp(repo, NOW, 10, 'reviews')
    expect(second.awarded).toBe(0)
  })

  it('все 3 слота закрыты → +30 единожды', async () => {
    const dayIso = dayStart(NOW).toISOString()
    const state = createQuestDay(dayIso, 20)
    state.slots.reviews.done = 20
    state.slots.dictation.done = 10
    await repo.putQuestDay(state)
    const result = await awardXp(repo, NOW, 0, 'uncapped', {})
    expect(result.awarded).toBe(0) // слот урока ещё не закрыт
    state.slots.lesson.done = 1
    await repo.putQuestDay(state)
    const done = await awardXp(repo, NOW, 0, 'uncapped', {})
    expect(done.awarded).toBe(30)
    const again = await awardXp(repo, NOW, 0, 'uncapped', {})
    expect(again.awarded).toBe(0)
  })
})

describe('closeStudyDay', () => {
  it('первое закрытие дня: стрик 1, второй вызов — идемпотентен', async () => {
    const dayIso = dayStart(NOW).toISOString()
    const state = createQuestDay(dayIso, 20)
    state.slots.lesson.done = 1
    await repo.putQuestDay(state)
    expect(anySlotDone(state)).toBe(true)
    const { stats, freezeGained } = await closeStudyDay(repo, NOW)
    expect(stats.streak_current).toBe(1)
    expect(freezeGained).toBe(false) // заморозка — на кратных 7 (game://streak)
    expect((await repo.getQuestDay(dayIso))?.streakCounted).toBe(true)
    await closeStudyDay(repo, NOW)
    expect((await repo.getStats()).streak_current).toBe(1)
  })

  it('стрик 7 → выдана заморозка (freezeGained, тост M10)', async () => {
    const dayIso = dayStart(NOW).toISOString()
    await repo.putStats({
      ...(await repo.getStats()),
      streak_current: 6,
      streak_best: 6,
      freezes_left: 2,
    })
    const state = createQuestDay(dayIso, 20)
    state.slots.reviews.done = 1
    await repo.putQuestDay(state)
    const { stats, freezeGained } = await closeStudyDay(repo, NOW)
    expect(stats.streak_current).toBe(7)
    expect(freezeGained).toBe(true)
    expect(stats.freezes_left).toBe(3)
  })
})

describe('awardLessonFinish', () => {
  it('XP по категориям + бонус первого урока + слоты квеста', async () => {
    const result = await awardLessonFinish(repo, NOW, {
      xpByCategory: { uncapped: 20, choice: 4, voice: 3, dictation: 6 },
      dictationCount: 5,
      bonusByType: { speak: 2 },
      isRepeat: false,
    })
    expect(result.awarded).toBe(20 + 4 + 3 + 6 + 25)
    expect(result.quest.slots.lesson.done).toBe(1)
    expect(result.quest.slots.dictation.done).toBe(5)
    // speak-2 засчитан только если сегодняшний бонус — speak-5
    const bonusIsSpeak = result.quest.bonus.id === 'speak-5'
    expect(result.quest.bonusDone).toBe(bonusIsSpeak ? 2 : 0)
    // второй урок дня: бонус +10 (слот «повторы» не закрыт — общего бонуса нет)
    const second = await awardLessonFinish(repo, NOW, {
      xpByCategory: { uncapped: 10 },
      dictationCount: 5,
      bonusByType: {},
      isRepeat: false,
    })
    expect(second.awarded).toBe(10 + 10)
  })

  it('повтор урока: 50% XP упражнений, без бонуса', async () => {
    const result = await awardLessonFinish(repo, NOW, {
      xpByCategory: { uncapped: 21 },
      dictationCount: 0,
      bonusByType: {},
      isRepeat: true,
    })
    expect(result.awarded).toBe(10) // floor(21/2)
  })
})
