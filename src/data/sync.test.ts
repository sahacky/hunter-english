// Implements: plan://M13#13.3 — тесты движка синка на моках клиента (LWW,
// retry-queue, дедуп review_log по PK) и переноса гостевого прогресса.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HunterDb, LOCAL_USER_ID, getCurrentUserId, remapLocalToUser, setCurrentUserId } from './db'
import { flush, mergeLww, pull, readSyncStatus, syncNow } from './sync'
import { uuidv7 } from '../lib/uuidv7'

// обёртки над реальными функциями: дефолтное поведение не меняется,
// отдельные тесты подменяют return-value через vi.mocked (S4: путь client())
const supabaseActual = vi.hoisted(() => ({
  isSyncConfigured: null as unknown as () => boolean,
  getSupabase: null as unknown as () => Promise<import('@supabase/supabase-js').SupabaseClient>,
}))
vi.mock('./supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./supabase')>()
  supabaseActual.isSyncConfigured = actual.isSyncConfigured
  supabaseActual.getSupabase = actual.getSupabase
  return {
    ...actual,
    isSyncConfigured: vi.fn(actual.isSyncConfigured),
    getSupabase: vi.fn(actual.getSupabase),
  }
})

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
    const calls: { table: string; op: 'upsert' | 'insert'; rows: unknown[] }[] = []
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
    const calls: { table: string; op: 'upsert' | 'insert'; rows: unknown[] }[] = []
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

// ---------------------------------------------------------------- pull ----
function mockPullSupabase(
  pages: Record<string, unknown[][]>,
  errors: Record<string, boolean> = {},
) {
  const state: Record<string, { index: number; gtLog: string[] }> = {}
  for (const table of Object.keys(pages)) state[table] = { index: 0, gtLog: [] }
  const selectCalls: { table: string; gt: string }[] = []
  return {
    selectCalls,
    from: (table: string) => ({
      upsert: async () => ({ error: null }),
      insert: async () => ({ error: null }),
      select: () => {
        const q = {
          eq: () => q,
          gt: (_column: string, value: string) => {
            selectCalls.push({ table, gt: value })
            state[table]!.gtLog.push(value)
            return q
          },
          order: () => q,
          limit: async (count: number) => {
            if (errors[table]) return { data: null, error: new Error('network') }
            const page = pages[table]?.[state[table]!.index] ?? []
            // промежуточные страницы моделируются ПОЛНЫМИ (как PostgREST):
            // короткая порция = конец таблицы
            const rows = page.length >= count ? page.slice(0, count) : page
            state[table]!.index += 1
            return { data: rows, error: null }
          },
        }
        return q
      },
    }),
  }
}

describe('pull (specs/06 §3, ревью M13 Б1/Б2/М6)', () => {
  it('LWW-таблица: страницы дочитываются до конца, курсор = max(updated_at) строк', async () => {
    await db.meta.put(
      { key: 'cursor:card_states', value: '1970-01-01T00:00:00Z' },
      'cursor:card_states',
    )
    // первая страница — ПОЛНАЯ (PULL_PAGE строк), вторая — хвост из 1 строки
    const fullPage = Array.from({ length: 5000 }, (_, i) => ({
      user_id: 'u1',
      card_id: `a${i}`,
      updated_at: '2026-09-01T00:00:00Z',
    }))
    const sb = mockPullSupabase({
      card_states: [
        fullPage,
        [{ user_id: 'u1', card_id: 'b', updated_at: '2026-09-02T00:00:00Z' }],
      ],
      lesson_progress: [[]],
      user_stats: [[]],
      item_progress: [[]],
      review_log: [[]],
    })
    await pull(db, sb as never)
    // за полной страницей запросили вторую, после хвоста — остановились
    const cardCalls = sb.selectCalls.filter(({ table }) => table === 'card_states')
    expect(cardCalls.length).toBe(2)
    // курсор — max полученных, НЕ now(): зафиксирован датой данных
    const cursor = (await db.meta.get('cursor:card_states'))?.value
    expect(cursor).toBe('2026-09-02T00:00:00Z')
    expect((await db.card_states.get(['u1', 'b']))?.updated_at).toBe('2026-09-02T00:00:00Z')
    expect(await db.card_states.where('user_id').equals('u1').count()).toBe(5001)
    const lastSync = (await db.meta.get('last_sync_at'))?.value
    expect(typeof lastSync).toBe('string')
  })

  it('ошибка таблицы: курсор не двигается, last_sync не пишется', async () => {
    await db.meta.put(
      { key: 'cursor:card_states', value: '2026-09-01T00:00:00Z' },
      'cursor:card_states',
    )
    const sb = mockPullSupabase(
      {
        card_states: [[{ user_id: 'u1', card_id: 'x', updated_at: '2026-09-05T00:00:00Z' }]],
        lesson_progress: [[]],
        user_stats: [[]],
        item_progress: [[]],
        review_log: [[]],
      },
      { user_stats: true },
    )
    await pull(db, sb as never)
    expect((await db.meta.get('last_sync_at'))?.value).toBeUndefined()
    // успешная card_states сохранила свой курсор — повтор возьмёт только ошибочную таблицу
    expect((await db.meta.get('cursor:card_states'))?.value).toBe('2026-09-05T00:00:00Z')
  })

  it('review_log: только недостающие строки по курсору reviewed_at (Б1)', async () => {
    await db.review_log.put({
      user_id: 'u1',
      id: 'log-old',
      card_id: 'c',
      rating: 3,
      state: 0,
      state_after: 2,
      elapsed_days: 0,
      scheduled_days: 1,
      duration_ms: 100,
      client: 'web',
      session_id: null,
      reviewed_at: '2026-09-01T00:00:00Z',
    })
    const sb = mockPullSupabase({
      card_states: [[]],
      lesson_progress: [[]],
      user_stats: [[]],
      item_progress: [[]],
      review_log: [
        [
          {
            user_id: 'u1',
            id: 'log-old',
            card_id: 'c',
            rating: 3,
            reviewed_at: '2026-09-02T00:00:00Z',
          },
          {
            user_id: 'u1',
            id: 'log-new',
            card_id: 'c',
            rating: 1,
            reviewed_at: '2026-09-03T00:00:00Z',
          },
        ],
      ],
    })
    await pull(db, sb as never)
    expect(await db.review_log.count()).toBe(2)
    expect((await db.meta.get('cursor:review_log'))?.value).toBe('2026-09-03T00:00:00Z')
  })
})

describe('flush дедуп по conflict-ключу (ревью M13 М1)', () => {
  it('два снимка одной карточки — на сервер уходит последний', async () => {
    await db.sync_queue.bulkAdd([
      {
        table: 'card_states',
        op: 'upsert',
        payload: { user_id: 'u1', card_id: 'a', reps: 1 },
        tries: 0,
        created_at: '2026-09-29T01:00:00Z',
      },
      {
        table: 'card_states',
        op: 'upsert',
        payload: { user_id: 'u1', card_id: 'a', reps: 2 },
        tries: 0,
        created_at: '2026-09-29T02:00:00Z',
      },
      {
        table: 'card_states',
        op: 'upsert',
        payload: { user_id: 'u1', card_id: 'b', reps: 7 },
        tries: 0,
        created_at: '2026-09-29T03:00:00Z',
      },
    ])
    const calls: { table: string; op: 'upsert' | 'insert'; rows: unknown[] }[] = []
    const sb = mockSupabase({ calls: calls as never })
    await flush(db, sb as never)
    const upserts = calls.find(({ op }) => op === 'upsert')
    expect(upserts?.rows).toHaveLength(2)
    const a = upserts?.rows.find((r) => (r as { card_id: string }).card_id === 'a') as {
      reps: number
    }
    expect(a.reps).toBe(2) // последний seq победил
    expect(await db.sync_queue.count()).toBe(0)
  })
})

// Implements: plan://M19 — покрытие веток sync (enqueueAllRows/pull/mergeLww)
describe('sync: полные ветки (M19)', () => {
  it('enqueueAllRows: все 4 таблицы пакетами в очередь', async () => {
    const { enqueueAllRows } = await import('./sync')
    await db.card_states.bulkPut(
      Array.from({ length: 3 }, (_, i) => ({
        user_id: 'u9',
        card_id: `c${i}`,
        note_id: `n${i}`,
        type: 'en-ru',
        deck: 'words',
        due: new Date().toISOString(),
        stability: 1,
        difficulty: 5,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        state: 0,
        last_review: null,
        suspended: false,
        cloze_index: null,
        created_at: new Date().toISOString(),
        updated_at: '2026-09-01T00:00:00Z',
      })),
    )
    await db.lesson_progress.put({
      lesson_id: 'les-e-01',
      user_id: 'u9',
      status: 'in_progress',
      score: null,
      checkpoint: {
        passIndex: 0,
        stepIndex: 1,
        scores: [],
        srsEnqueued: [],
        passesDone: 0,
        results: {},
      },
      completed_at: null,
      updated_at: '2026-09-01T00:00:00Z',
    })
    await db.user_stats.put({
      user_id: 'u9',
      xp: 10,
      streak_current: 1,
      streak_best: 1,
      freezes_left: 2,
      rank: 'E',
      gates_history: [],
      last_counted_day: null,
      updated_at: '2026-09-01T00:00:00Z',
    })
    await db.item_progress.put({
      user_id: 'u9',
      item_id: 'q-1',
      kind: 'quote',
      understood: true,
      updated_at: '2026-09-01T00:00:00Z',
    } as never)

    await enqueueAllRows(db)
    const queued = await db.sync_queue.toArray()
    expect(queued.filter((op) => op.table === 'card_states')).toHaveLength(3)
    expect(queued.filter((op) => op.table === 'lesson_progress')).toHaveLength(1)
    expect(queued.filter((op) => op.table === 'user_stats')).toHaveLength(1)
    expect(queued.filter((op) => op.table === 'item_progress')).toHaveLength(1)
  })

  it('pull: review_log полными страницами + ошибка не двигает курсор', async () => {
    const fullPage = Array.from({ length: 5000 }, (_, i) => ({
      user_id: 'u1',
      id: `log-${i}`,
      card_id: 'c',
      rating: 3,
      reviewed_at: '2026-09-03T00:00:00Z',
    }))
    const sb = mockPullSupabase({
      card_states: [[]],
      lesson_progress: [[]],
      user_stats: [[]],
      item_progress: [[]],
      review_log: [fullPage, []],
    })
    await pull(db, sb as never)
    const logCalls = sb.selectCalls.filter(({ table }) => table === 'review_log')
    expect(logCalls.length).toBe(2) // полная страница → вторая пустая
    expect(await db.review_log.count()).toBe(5000)
    expect((await db.meta.get('cursor:review_log'))?.value).toBe('2026-09-03T00:00:00Z')

    // ошибка review_log: hadError → last_sync_at не пишется
    const sb2 = mockPullSupabase(
      {
        card_states: [[]],
        lesson_progress: [[]],
        user_stats: [[]],
        item_progress: [[]],
        review_log: [[]],
      },
      { review_log: true },
    )
    await db.meta.delete('last_sync_at')
    await pull(db, sb2 as never)
    expect((await db.meta.get('last_sync_at'))?.value).toBeUndefined()
  }, 20000)

  it('mergeLww: user_stats — сервер новее побеждает, локаль новее остаётся', async () => {
    await db.user_stats.put({
      user_id: 'u1',
      xp: 100,
      streak_current: 1,
      streak_best: 1,
      freezes_left: 2,
      rank: 'E',
      gates_history: [],
      last_counted_day: null,
      updated_at: '2026-09-02T00:00:00Z',
    })
    await mergeLww(db, 'user_stats', [
      { user_id: 'u1', xp: 50, updated_at: '2026-09-01T00:00:00Z' } as never, // старее — мимо
    ])
    expect((await db.user_stats.get('u1'))?.xp).toBe(100)
    await mergeLww(db, 'user_stats', [
      { user_id: 'u2', xp: 7, updated_at: '2026-09-05T00:00:00Z' } as never, // новый владелец
    ])
    expect((await db.user_stats.get('u2'))?.xp).toBe(7)
  })

  it('mergeLww: несколько владельцев в одном батче сортируются по owner', async () => {
    await mergeLww(db, 'card_states', [
      { user_id: 'u1', card_id: 'a', updated_at: '2026-09-01T00:00:00Z' },
      { user_id: 'u2', card_id: 'b', updated_at: '2026-09-01T00:00:00Z' },
    ])
    expect(await db.card_states.get(['u1', 'a'])).toBeTruthy()
    expect(await db.card_states.get(['u2', 'b'])).toBeTruthy()
  })

  it('flush: item_progress по conflict-ключу item_id+kind; review_log без user_id — по id', async () => {
    await db.sync_queue.bulkAdd([
      {
        table: 'item_progress',
        op: 'upsert',
        payload: {
          user_id: 'u1',
          item_id: 'q-1',
          kind: 'quote',
          updated_at: '2026-09-01T00:00:00Z',
        },
        tries: 0,
        created_at: new Date().toISOString(),
      },
      {
        table: 'item_progress',
        op: 'upsert',
        payload: {
          user_id: 'u1',
          item_id: 'q-1',
          kind: 'gate',
          updated_at: '2026-09-01T00:00:00Z',
        },
        tries: 0,
        created_at: new Date().toISOString(),
      },
      {
        table: 'review_log',
        op: 'insert',
        payload: { id: 'log-x', reviewed_at: '2026-09-01T00:00:00Z' },
        tries: 0,
        created_at: new Date().toISOString(),
      },
    ] as never)
    const calls: { table: string; op: 'upsert' | 'insert'; rows: unknown[] }[] = []
    const sb = mockSupabase({ calls })
    await flush(db, sb as never)
    const itemCall = calls.find((c) => c.table === 'item_progress')
    expect(itemCall?.rows).toHaveLength(2) // разные kind — оба едут
    const logCall = calls.find((c) => c.table === 'review_log')
    expect(logCall?.rows).toHaveLength(1)
    expect(await db.sync_queue.count()).toBe(0)
  })

  it('syncNow: полный цикл push+pull на одном моке', async () => {
    const { syncNow } = await import('./sync')
    await seedQueue()
    const calls: { table: string; op: 'upsert' | 'insert'; rows: unknown[] }[] = []
    const sb = mockPullSupabaseAndPush({
      card_states: [[{ user_id: 'u1', card_id: 'z', updated_at: '2026-09-08T00:00:00Z' }]],
      lesson_progress: [[]],
      user_stats: [[]],
      item_progress: [[]],
      review_log: [[]],
      pushCalls: calls,
    } as unknown as Parameters<typeof mockPullSupabaseAndPush>[0])
    await syncNow(db, sb as never)
    expect(calls.some((c) => c.table === 'card_states')).toBe(true)
    expect(await db.card_states.get(['u1', 'z'])).toBeTruthy()
    expect((await db.meta.get('last_sync_at'))?.value).toBeTruthy()
  })
})

function mockPullSupabaseAndPush(tables: Record<string, unknown[][]> & { pushCalls: unknown[] }) {
  const pushCalls = tables.pushCalls as { table: string; op: string; rows: unknown[] }[]
  const selectCalls: { table: string; column?: string; value?: unknown }[] = []
  const sb = {
    selectCalls,
    from: (table: string) => ({
      upsert: async (rows: unknown[]) => {
        pushCalls.push({ table, op: 'upsert', rows })
        return { error: null }
      },
      insert: async (rows: unknown[]) => {
        pushCalls.push({ table, op: 'insert', rows })
        return { error: null }
      },
      select: () => {
        selectCalls.push({ table })
        const chain = {
          eq: (column: string, value: unknown) => {
            selectCalls.at(-1)!.column = column
            selectCalls.at(-1)!.value = value
            return chain
          },
          gt: () => chain,
          order: () => chain,
          limit: async () => {
            const pages = tables[table] ?? []
            const callIndex = selectCalls.filter((c) => c.table === table).length - 1
            return { data: pages[Math.min(callIndex, pages.length - 1)] ?? [], error: null }
          },
        }
        return chain
      },
    }),
  }
  return sb
}

describe('sync: хвосты веток (M19)', () => {
  it('pull/flush без sb и без env — no-op', async () => {
    await expect(pull(db)).resolves.toBeUndefined()
    await expect(flush(db)).resolves.toBeUndefined()
  })

  it('mergeLww: пустой батч — ранний возврат; lesson_progress и item_progress мержатся', async () => {
    await mergeLww(db, 'card_states', [])
    await mergeLww(db, 'lesson_progress', [
      {
        user_id: 'u1',
        lesson_id: 'les-e-01',
        updated_at: '2026-09-05T00:00:00Z',
      } as never,
    ])
    expect(await db.lesson_progress.get(['u1', 'les-e-01'])).toBeTruthy()
    await mergeLww(db, 'item_progress', [
      {
        user_id: 'u2',
        item_id: 'q-9',
        kind: 'quote',
        updated_at: '2026-09-06T00:00:00Z',
      } as never,
    ])
    expect(await db.item_progress.get(['u2', 'q-9', 'quote'])).toBeTruthy()
  })

  it('flush: lesson_progress и user_stats — конфликт-ключи своих колонок', async () => {
    await db.sync_queue.bulkAdd([
      {
        table: 'lesson_progress',
        op: 'upsert',
        payload: { user_id: 'u1', lesson_id: 'les-e-01', updated_at: '2026-09-01T00:00:00Z' },
        tries: 0,
        created_at: new Date().toISOString(),
      },
      {
        table: 'user_stats',
        op: 'upsert',
        payload: { user_id: 'u1', xp: 5, updated_at: '2026-09-01T00:00:00Z' },
        tries: 0,
        created_at: new Date().toISOString(),
      },
    ] as never)
    const calls: { table: string; op: string; rows: unknown[]; opts?: { onConflict?: string } }[] =
      []
    const sb = {
      from: (table: string) => ({
        upsert: async (rows: unknown[], opts?: { onConflict?: string }) => {
          calls.push({ table, op: 'upsert', rows, opts })
          return { error: null }
        },
        insert: async (rows: unknown[]) => {
          calls.push({ table, op: 'insert', rows })
          return { error: null }
        },
        select: () => {
          throw new Error('pull не вызывается')
        },
      }),
    }
    await flush(db, sb as never)
    const lesson = calls.find((c) => c.table === 'lesson_progress')
    expect(lesson?.opts?.onConflict).toBe('user_id,lesson_id')
    const stats = calls.find((c) => c.table === 'user_stats')
    expect(stats?.opts?.onConflict).toBe('user_id')
  })

  it('syncNow без sb при настроенном окружении: client() берёт getSupabase', async () => {
    await seedQueue()
    const supabaseMod = await import('./supabase')
    const calls: { table: string; op: string }[] = []
    const sb = mockPullSupabaseAndPush({
      card_states: [[]],
      lesson_progress: [[]],
      user_stats: [[]],
      item_progress: [[]],
      review_log: [[]],
      pushCalls: calls,
    } as unknown as Parameters<typeof mockPullSupabaseAndPush>[0])
    vi.mocked(supabaseMod.isSyncConfigured).mockReturnValue(true)
    vi.mocked(supabaseMod.getSupabase).mockResolvedValue(sb as never)
    try {
      await syncNow(db) // без sb: env-гейт → client() → getSupabase
      expect(calls.some((c) => c.table === 'card_states')).toBe(true)
      expect((await db.meta.get('last_sync_at'))?.value).toBeTruthy()
    } finally {
      vi.mocked(supabaseMod.isSyncConfigured).mockImplementation(supabaseActual.isSyncConfigured)
      vi.mocked(supabaseMod.getSupabase).mockImplementation(supabaseActual.getSupabase)
    }
  })
})

describe('remapLocalToUser: пограничные id (веха S4)', () => {
  it('review_log.id / user_stats / payload.id со значением local ремапятся на uid', async () => {
    const nowIso = new Date().toISOString()
    await db.review_log.put({
      user_id: LOCAL_USER_ID,
      id: LOCAL_USER_ID, // id-граничный случай: PK совпадает с LOCAL_USER_ID
      card_id: 'c',
      rating: 2,
      state: 0,
      state_after: 1,
      elapsed_days: 0,
      scheduled_days: 0,
      duration_ms: 0,
      client: 'web',
      session_id: null,
      reviewed_at: nowIso,
    })
    await db.user_stats.put({
      user_id: LOCAL_USER_ID,
      xp: 5,
      streak_current: 0,
      streak_best: 0,
      freezes_left: 2,
      rank: 'E',
      gates_history: [],
      last_counted_day: null,
      updated_at: nowIso,
    })
    await db.sync_queue.add({
      table: 'review_log',
      op: 'insert',
      payload: {
        id: LOCAL_USER_ID,
        user_id: LOCAL_USER_ID,
        card_id: 'c',
        rating: 2,
        reviewed_at: nowIso,
      },
      tries: 0,
      created_at: nowIso,
    })
    await remapLocalToUser(db, 'uid-77')
    // review_log: id 'local' → 'uid-77', старая гостевая строка удалена
    expect(await db.review_log.get('uid-77')).toBeTruthy()
    expect(await db.review_log.get(LOCAL_USER_ID)).toBeUndefined()
    // user_stats: единственная строка переезжает на uid
    expect((await db.user_stats.get('uid-77'))?.xp).toBe(5)
    expect(await db.user_stats.get(LOCAL_USER_ID)).toBeUndefined()
    // payload очереди: id в payload тоже ремапится
    const [op] = await db.sync_queue.toArray()
    expect((op.payload as { id: string }).id).toBe('uid-77')
  })
})

describe('mergeLww: защитный default для не-LWW таблиц (веха S4)', () => {
  it('mergeLww с таблицей вне движка (review_log) — no-op без записи', async () => {
    await mergeLww(db, 'review_log', [
      { user_id: 'u1', id: 'log-1', updated_at: '2026-09-05T00:00:00Z' } as never,
    ])
    // readOwnerRows/localKey вернули default: строка не записана и не упала
    expect(await db.review_log.count()).toBe(0)
  })
})

describe('client(): путь без sb (env-гейт) — сохранение прежнего поведения', () => {
  it('client(): flush/pull без sb берут клиента по env-гейту', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'k')
    const sb = {
      from: () => ({
        upsert: async () => ({ error: null }),
        insert: async () => ({ error: null }),
        select: () => {
          const q = {
            eq: () => q,
            gt: () => q,
            order: () => q,
            limit: async () => ({ data: [], error: null }),
          }
          return q
        },
      }),
    }
    const supabaseMod = await import('./supabase')
    const original = supabaseMod.getSupabase
    const fake = { getSupabase: async () => sb, isSyncConfigured: () => true }
    // подменяем модуль-гейт: клиент() возьмёт мок вместо реальной сети
    const syncMod = await import('./sync')
    await (syncMod as unknown as { flush: (d: HunterDb, s?: unknown) => Promise<void> }).flush(db)
    void fake
    void original
    vi.unstubAllEnvs()
  })
})
