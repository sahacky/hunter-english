// Implements: plan://M4#4.2, plan://M5#5.2 — тесты ProgressRepository на fake-indexeddb
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { LessonProgress } from '../domain/lesson/types'
import { applyAnswer } from '../domain/srs/scheduler'
import type { CardState, Note } from '../domain/srs/types'
import { waivedLessonProgress } from '../domain/placement/apply'
import { uuidv7 } from '../lib/uuidv7'
import { HunterDb } from './db'
import { DexieProgressRepository } from './progress-repository'

const NOW = new Date(2026, 8, 28, 10, 0, 0)
const DAY = 86_400_000

let seq = 0
let db: HunterDb
let repo: DexieProgressRepository

function mkNote(): Note {
  seq += 1
  return { id: `note_w${seq}`, deck: 'words', entityId: `w${seq}`, en: 'house', ru: 'дом' }
}

function mkCard(): CardState {
  const note = mkNote()
  return {
    card_id: `${note.entityId}.en-ru`,
    note_id: note.id,
    type: 'en-ru',
    deck: 'words',
    due: new Date(NOW.getTime() - DAY).toISOString(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    last_review: null,
    suspended: false,
    cloze_index: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
  }
}

beforeEach(() => {
  seq = 0
  db = new HunterDb(`hunter-test-${uuidv7()}`)
  repo = new DexieProgressRepository(db)
})

describe('DexieProgressRepository', () => {
  it('ensureCards создаёт отсутствующие и идемпотентен при повторе', async () => {
    const card = mkCard()
    await repo.ensureCards([card])
    // прогресс не должен перезаписаться вторым ensureCards
    const answer = applyAnswer(card, 3, NOW, { logId: uuidv7() })
    await repo.saveAnswer(answer.next, answer.log)
    await repo.ensureCards([card])

    const cards = await repo.getAllCards()
    expect(cards).toHaveLength(1)
    expect(cards[0]).toEqual(answer.next)
  })

  it('saveAnswer в одной транзакции пишет карточку, лог и две операции в sync_queue', async () => {
    const card = mkCard()
    await repo.ensureCards([card])

    const { next, log } = applyAnswer(card, 1, NOW, { logId: uuidv7(), sessionId: 's-1' })
    await repo.saveAnswer(next, log)

    const [stored] = await repo.getAllCards()
    expect(stored).toEqual(next)

    const logs = await db.review_log.toArray()
    expect(logs).toHaveLength(1)
    expect(logs[0]).toEqual({ ...log, user_id: 'local' })

    const queue = await db.sync_queue.orderBy('seq').toArray()
    expect(queue.map(({ table, op }) => ({ table, op }))).toEqual([
      { table: 'card_states', op: 'upsert' },
      { table: 'review_log', op: 'insert' },
    ])
    expect(queue.every((row) => row.tries === 0 && row.payload)).toBe(true)
  })

  it('review_log append-only: повторные ответы добавляют записи, не перезаписывая', async () => {
    const card = mkCard()
    await repo.ensureCards([card])

    const first = applyAnswer(card, 3, NOW, { logId: uuidv7() })
    await repo.saveAnswer(first.next, first.log)
    const second = applyAnswer(first.next, 3, new Date(NOW.getTime() + 10 * 60_000), {
      logId: uuidv7(),
    })
    await repo.saveAnswer(second.next, second.log)

    const logs = await db.review_log.toArray()
    expect(logs).toHaveLength(2)
    expect(new Set(logs.map(({ id }) => id)).size).toBe(2)
    expect((await repo.getAllCards())[0].state).toBe(2)
  })

  it('countNewAnsweredSince считает ответы на новых карточках с момента', async () => {
    const card = mkCard()
    await repo.ensureCards([card])

    expect(await repo.countNewAnsweredSince(NOW.toISOString())).toBe(0)

    const first = applyAnswer(card, 3, NOW, { logId: uuidv7() })
    await repo.saveAnswer(first.next, first.log)
    expect(await repo.countNewAnsweredSince(NOW.toISOString())).toBe(1)
    expect(await repo.countNewAnsweredSince(new Date(NOW.getTime() + 60_000).toISOString())).toBe(0)

    const second = applyAnswer(first.next, 3, new Date(NOW.getTime() + 120_000), {
      logId: uuidv7(),
    })
    await repo.saveAnswer(second.next, second.log)
    // второй ответ уже не на новой карточке (state до ответа = Learning)
    expect(await repo.countNewAnsweredSince(NOW.toISOString())).toBe(1)
  })

  it('lesson_progress: put/get чекпоинта и запись в sync_queue', async () => {
    expect(await repo.getLessonProgress('les-e-01')).toBeNull()

    const progress: LessonProgress = {
      lesson_id: 'les-e-01',
      status: 'in_progress',
      score: null,
      checkpoint: {
        passIndex: 0,
        stepIndex: 2,
        scores: [{ stepIndex: 1, total: 2, answered: 2, firstTryCorrect: 2 }],
        srsEnqueued: [],
        passesDone: 0,
        results: { 'ex-e-0001': { attempts: 1, outcome: 'correct' } },
      },
      completed_at: null,
      updated_at: NOW.toISOString(),
    }
    await repo.putLessonProgress(progress)

    const stored = await repo.getLessonProgress('les-e-01')
    expect(stored).toEqual(progress)

    const completed: LessonProgress = {
      ...progress,
      status: 'completed',
      score: 92,
      completed_at: NOW.toISOString(),
      updated_at: new Date(NOW.getTime() + 60_000).toISOString(),
    }
    await repo.putLessonProgress(completed)
    expect(await repo.getLessonProgress('les-e-01')).toEqual(completed)

    const queued = await db.sync_queue.where('table').equals('lesson_progress').toArray()
    expect(queued.length).toBe(2)
    expect(queued.every((row) => row.op === 'upsert')).toBe(true)
  })

  it('user_stats: пустые статы для нового профиля, put/get + sync_queue (M7#7.2)', async () => {
    const fresh = await repo.getStats()
    expect(fresh.xp).toBe(0)
    expect(fresh.rank).toBe('E')
    expect(fresh.freezes_left).toBe(2)

    const stats = {
      ...fresh,
      xp: 347,
      streak_current: 5,
      streak_best: 9,
      updated_at: NOW.toISOString(),
    }
    await repo.putStats(stats)
    expect(await repo.getStats()).toEqual(stats)
    const queued = await db.sync_queue.where('table').equals('user_stats').toArray()
    expect(queued.length).toBe(1)
  })

  it('quest_day: item_progress kind=quest_day по учебному дню (M7#7.2)', async () => {
    const day = '2026-09-28T00:00:00.000Z'
    expect(await repo.getQuestDay(day)).toBeNull()
    const state = {
      studyDay: day,
      slots: {
        reviews: { done: 12, target: 20 },
        lesson: { done: 1, target: 1 },
        dictation: { done: 4, target: 10 },
      },
      bonus: { id: 'speak-5', target: 5 },
      bonusDone: 2,
      allDoneAwarded: false,
      bonusAwarded: false,
      streakCounted: true,
      xp: { reviews: 12, choice: 3, voice: 6, dictation: 12, shadowing: 0 },
      freezesSpent: 0,
    }
    await repo.putQuestDay(state)
    expect(await repo.getQuestDay(day)).toEqual(state)
    const rows = (await db.item_progress.toArray()).filter((row) => row.kind === 'quest_day')
    expect(rows.length).toBe(1)
    expect(rows[0].item_id).toBe(day)
  })

  it('gate_attempts: попытка Врат по ключу gate (M7#7.2)', async () => {
    expect(await repo.getGateAttempt('D')).toBeNull()
    const attempt = {
      gate: 'D' as const,
      started_at: NOW.toISOString(),
      finished_at: null,
      passed: [],
      scores: [{ section: 'vocab' as const, correct: 10, total: 20 }],
    }
    await repo.putGateAttempt(attempt)
    expect(await repo.getGateAttempt('D')).toEqual(attempt)
  })
})

describe('suspendNotes + getManyLessonProgress (plan://onboarding#O.3)', () => {
  it('suspend прячет карточки заметок (идемпотентно) и кладёт снимки в sync_queue', async () => {
    const { createFirstCards } = await import('../content/words')
    const notes = [
      { id: 'note_a-noun', deck: 'words' as const, entityId: 'a-noun', en: 'a', ru: 'а' },
      { id: 'note_b-noun', deck: 'words' as const, entityId: 'b-noun', en: 'b', ru: 'б' },
      { id: 'note_c-noun', deck: 'words' as const, entityId: 'c-noun', en: 'c', ru: 'в' },
    ]
    await repo.ensureCards(createFirstCards(notes, NOW))
    await repo.suspendNotes(['note_a-noun', 'note_b-noun'])
    let cards = await repo.getAllCards()
    expect(
      cards
        .filter((card) => card.suspended)
        .map((card) => card.note_id)
        .sort(),
    ).toEqual(['note_a-noun', 'note_b-noun'])
    // повтор — no-op (уже скрыты, очередь не растёт)
    const queueBefore = (await db.sync_queue.count()) ?? 0
    await repo.suspendNotes(['note_a-noun'])
    expect(await db.sync_queue.count()).toBe(queueBefore)
    cards = await repo.getAllCards()
    expect(cards.filter((card) => card.suspended)).toHaveLength(2)
    // пустой список — no-op
    await repo.suspendNotes([])
    expect(await repo.getAllCards()).toHaveLength(3)
  })

  it('getManyLessonProgress читает чекпоинты пачкой, отсутствующие — null', async () => {
    await repo.putLessonProgress(waivedLessonProgress('les-e-01', NOW.toISOString()))
    const rows = await repo.getManyLessonProgress(['les-e-01', 'les-e-02'])
    expect(rows[0]!.lesson_id).toBe('les-e-01')
    expect(rows[1]).toBeNull()
  })
})

describe('uuidv7', () => {
  it('формат RFC 9562: версия 7, вариант RFC, timestamp в старших 48 битах', () => {
    const id = uuidv7(NOW)
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(BigInt(`0x${id.replace(/-/g, '').slice(0, 12)}`)).toBe(BigInt(NOW.getTime()))
  })

  it('уникален и сортируется по времени', () => {
    const earlier = uuidv7(new Date(NOW.getTime() - 1000))
    const later = uuidv7(new Date(NOW.getTime() + 1000))
    const set = new Set(Array.from({ length: 50 }, () => uuidv7()))
    expect(set.size).toBe(50)
    expect(earlier < later).toBe(true)
  })
})
