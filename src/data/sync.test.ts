// Implements: plan://M13#13.3 — тесты движка синка на моках клиента (LWW,
// retry-queue, дедуп review_log по PK) и переноса гостевого прогресса.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HunterDb, LOCAL_USER_ID, getCurrentUserId, remapLocalToUser, setCurrentUserId } from './db'
import { flush, mergeLww, readSyncStatus } from './sync'
import { uuidv7 } from '../lib/uuidv7'

let db: HunterDb

beforeEach(() => {
  db = new HunterDb(`hunter-sync-test-${uuidv7()}`)
  setCurrentUserId(LOCAL_USER_ID)
})

function mockSupabase(behavior: {
  upsertError?: boolean
  insertError?: boolean
  calls: { table: string; op: 'upsert' | 'insert'; rows: unknown[] }[]
}) {
  const calls = behavior.calls
  return {
    from: (table: string) => ({
      upsert: async (rows: unknown[]) => {
        calls.push({ table, op: 'upsert', rows })
        return { error: behavior.upsertError ? new Error('network') : null }
      },
      insert: async (rows: unknown[]) => {
        calls.push({ table, op: 'insert', rows })
        return { error: behavior.insertError ? new Error('network') : null }
      },
      select: () => {
        throw new Error('not used in this test')
      },
    }),
  }
}

async function seedQueue() {
  await db.card_states.put({
    user_id: LOCAL_USER_ID,
    card_id: 'house-noun.en-ru',
    note_id: 'note_house-noun',
    type: 'en-ru',
    deck: 'words',
    due: new Date().toISOString(),
    stability: 1,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 1,
    lapses: 0,
    state: 2,
    last_review: null,
    suspended: false,
    cloze_index: null,
    created_at: new Date().toISOString(),
    updated_at: '2026-09-29T10:00:00Z',
  })
  await db.sync_queue.add({
    table: 'card_states',
    op: 'upsert',
    payload: {
      user_id: LOCAL_USER_ID,
      card_id: 'house-noun.en-ru',
      updated_at: '2026-09-29T10:00:00Z',
    },
    tries: 0,
    created_at: new Date().toISOString(),
  })
  await db.sync_queue.add({
    table: 'review_log',
    op: 'insert',
    payload: {
      id: 'log-1',
      user_id: LOCAL_USER_ID,
      card_id: 'house-noun.en-ru',
      rating: 3,
      reviewed_at: '2026-09-29T10:00:00Z',
    },
    tries: 0,
    created_at: new Date().toISOString(),
  })
}

describe('sync engine (моки клиента)', () => {
  it('isSyncConfigured=false → flush/pull — no-op, очередь не трогается', async () => {
    await seedQueue()
    const { flush: flushReal } = await import('./sync')
    await flushReal(db) // env отсутствует в тестах — гость
    expect(await db.sync_queue.count()).toBe(2)
    const status = await readSyncStatus(db)
    expect(status.configured).toBe(false)
    expect(status.queue).toBe(2)
  })
})

describe('mergeLww (specs/06 §3)', () => {
  it('сервер новее — побеждает; локаль новее — остаётся', async () => {
    await db.card_states.put({
      user_id: 'u1',
      card_id: 'a.en-ru',
      note_id: 'n',
      type: 'en-ru',
      deck: 'words',
      due: new Date().toISOString(),
      stability: 1,
      difficulty: 5,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 1,
      lapses: 0,
      state: 2,
      last_review: null,
      suspended: false,
      cloze_index: null,
      created_at: new Date().toISOString(),
      updated_at: '2026-09-28T00:00:00Z',
    })
    // серверная строка старше — не пишем
    await mergeLww(db, 'card_states', [
      { user_id: 'u1', card_id: 'a.en-ru', updated_at: '2026-09-27T00:00:00Z' },
    ])
    expect((await db.card_states.get(['u1', 'a.en-ru']))?.reps).toBe(1)
    // серверная строка новее — пишем
    await mergeLww(db, 'card_states', [
      { user_id: 'u1', card_id: 'a.en-ru', updated_at: '2026-09-30T00:00:00Z', reps: 42 } as never,
    ])
    expect((await db.card_states.get(['u1', 'a.en-ru']))?.reps).toBe(42)
  })
})

describe('flush с моком (поведение при ошибке/успехе)', () => {
  it('успех: очередь пустеет, upsert/insert по типам таблиц', async () => {
    await seedQueue()
    const calls: { table: string; op: string; rows: unknown[] }[] = []
    const sb = mockSupabase({ calls: calls as never })
    await flush(db, sb as never)
    expect(calls.map(({ table, op }) => `${table}:${op}`).sort()).toEqual([
      'card_states:upsert',
      'review_log:insert',
    ])
    expect(await db.sync_queue.count()).toBe(0)
  })

  it('ошибка сети: tries растёт, строки остаются; после 5 — failed', async () => {
    await seedQueue()
    const calls: { table: string; op: string; rows: unknown[] }[] = []
    const sb = mockSupabase({ upsertError: true, insertError: true, calls: calls as never })
    for (let i = 0; i < 5; i += 1) await flush(db, sb as never)
    const ops = await db.sync_queue.toArray()
    expect(ops.every((op) => op.tries === 5)).toBe(true)
    expect((await readSyncStatus(db)).failed).toBe(2)
    // 6-й flush больше не пытается (tries >= MAX_TRIES)
    await flush(db, sb as never)
    expect(calls).toHaveLength(10)
  })

  it('readSyncStatus: failed после 5 попыток', async () => {
    await db.sync_queue.add({
      table: 'card_states',
      op: 'upsert',
      payload: { user_id: 'local', card_id: 'x' },
      tries: 5,
      created_at: new Date().toISOString(),
    })
    const status = await readSyncStatus(db)
    expect(status.failed).toBe(1)
    expect(status.queue).toBe(0)
  })
})

describe('remapLocalToUser (перенос гостевого прогресса, план M13#13.4)', () => {
  it('все таблицы получают uid; PK-конфликтов нет; очередь ремапится', async () => {
    await seedQueue()
    await remapLocalToUser(db, 'uid-42')
    expect(await db.card_states.where('user_id').equals('local').count()).toBe(0)
    expect((await db.card_states.get(['uid-42', 'house-noun.en-ru']))?.card_id).toBe(
      'house-noun.en-ru',
    )
    const queued = await db.sync_queue.toArray()
    expect(queued.every((op) => (op.payload as { user_id: string }).user_id === 'uid-42')).toBe(
      true,
    )
    // идемпотентность: повтор — no-op
    await remapLocalToUser(db, 'uid-42')
    expect(await db.card_states.count()).toBe(1)
  })

  it('репозиторий после ремапа читает строки активного user_id', async () => {
    await seedQueue()
    await remapLocalToUser(db, 'uid-7')
    setCurrentUserId('uid-7')
    expect(getCurrentUserId()).toBe('uid-7')
    const { DexieProgressRepository } = await import('./progress-repository')
    const repo = new DexieProgressRepository(db)
    const cards = await repo.getAllCards()
    expect(cards).toHaveLength(1)
  })
})

vi.stubGlobal('navigator', navigator)
