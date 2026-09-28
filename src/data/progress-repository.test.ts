// Implements: plan://M4#4.2 — тесты ProgressRepository на fake-indexeddb
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { applyAnswer } from '../domain/srs/scheduler'
import type { CardState, Note } from '../domain/srs/types'
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
