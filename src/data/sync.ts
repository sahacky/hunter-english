// Implements: plan://M13#13.3 — движок синхронизации по specs/06 §3.
// flush(): sync_queue → Supabase (upsert/insert, батч 200, дедуп по
// conflict-ключу — последний seq побеждает, tries ≤ 5);
// pull(): постраничные выборки + LWW-merge; курсор — high-water mark
// max(updated_at) ПОЛУЧЕННЫХ строк (не wall-clock: часы устройств дрейфуют,
// ревью M13 Б2), при ошибке таблицы курсор не двигается;
// review_log — курсор max(reviewed_at), только недостающие строки (Б1).
// Без env и без явного клиента (тесты) — no-op (гость).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { HunterDb } from './db'
import { getSupabase, isSyncConfigured } from './supabase'

/** Таблицы LWW (upsert); review_log — append-only (insert); profiles создаёт
 * серверный триггер handle_new_user — клиент её не синкаронизирует. */
const UPSERT_TABLES = new Set(['card_states', 'lesson_progress', 'user_stats', 'item_progress'])
const MAX_TRIES = 5
const PUSH_BATCH = 200
const PULL_PAGE = 5000

export interface SyncStatus {
  configured: boolean
  queue: number
  failed: number
  lastSyncAt: string | null
}

/** Тонкая поверхность клиента для тестов (моки). */
export interface SupabaseLike {
  from: (table: string) => {
    upsert: (rows: unknown[], opts?: { onConflict?: string }) => PromiseLike<{ error: unknown }>
    insert: (rows: unknown[]) => PromiseLike<{ error: unknown }>
    select: (columns: string) => SupabaseQueryLike
  }
}

export interface SupabaseQueryLike {
  eq: (column: string, value: unknown) => SupabaseQueryLike
  gt: (column: string, value: unknown) => SupabaseQueryLike
  order: (column: string, opts?: { ascending?: boolean }) => SupabaseQueryLike
  limit: (count: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>
}

async function client(): Promise<SupabaseClient | SupabaseLike> {
  return getSupabase() as unknown as SupabaseClient
}

/** Снимок статуса для UI (настройки). */
export async function readSyncStatus(database: HunterDb): Promise<SyncStatus> {
  const queued = await database.sync_queue.toArray()
  return {
    configured: isSyncConfigured(),
    queue: queued.filter((op) => op.tries < MAX_TRIES).length,
    failed: queued.filter((op) => op.tries >= MAX_TRIES).length,
    lastSyncAt: ((await database.meta.get('last_sync_at'))?.value as string | undefined) ?? null,
  }
}

function conflictKeyOf(table: string, payload: Record<string, unknown>): string {
  switch (table) {
    case 'card_states':
      return `${payload.user_id}:${payload.card_id}`
    case 'lesson_progress':
      return `${payload.user_id}:${payload.lesson_id}`
    case 'item_progress':
      return `${payload.user_id}:${payload.item_id}:${payload.kind}`
    default:
      return String(payload.user_id ?? payload.id ?? '')
  }
}

/**
 * Push локальной очереди (specs/06 §3). Внутри батча строки дедуплицируются
 * по conflict-ключу: побеждает операция с максимальным seq (последний снимок,
 * ревью M13 М1). Ошибка сети → tries+1 (после 5 — failed, виден в UI).
 */
export async function flush(database: HunterDb, sb?: SupabaseLike): Promise<void> {
  if (!isSyncConfigured() && !sb) return // sb передаётся тестами в обход env-гейта
  const supabase = sb ?? ((await client()) as unknown as SupabaseLike)
  const queued = (await database.sync_queue.toArray()).sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
  const byTable = new Map<string, typeof queued>()
  for (const op of queued) {
    const list = byTable.get(op.table) ?? []
    list.push(op)
    byTable.set(op.table, list)
  }
  for (const [table, ops] of byTable) {
    const doable = ops.filter((op) => op.tries < MAX_TRIES)
    // дедуп: по conflict-ключу остаётся последняя (макс. seq) операция
    const latest = new Map<string, (typeof doable)[number]>()
    for (const op of doable) {
      latest.set(conflictKeyOf(table, op.payload as Record<string, unknown>), op)
    }
    const winners = [...latest.values()]
    for (let start = 0; start < winners.length; start += PUSH_BATCH) {
      const batch = winners.slice(start, start + PUSH_BATCH)
      const rows = batch.map((op) => op.payload)
      const result = UPSERT_TABLES.has(table)
        ? await supabase.from(table).upsert(rows, { onConflict: conflictKey(table) })
        : await supabase.from(table).insert(rows)
      if (result.error) {
        for (const op of batch) {
          await database.sync_queue.update(op.seq!, { tries: op.tries + 1 })
        }
      } else {
        // отправлены только winners: остальные дубли той же строки уже покрыты
        const seqs = ops.filter((op) => op.tries < MAX_TRIES).map((op) => op.seq!)
        await database.sync_queue.bulkDelete(seqs.filter((seq) => seq !== undefined))
      }
    }
  }
}

function conflictKey(table: string): string {
  switch (table) {
    case 'card_states':
      return 'user_id,card_id'
    case 'lesson_progress':
      return 'user_id,lesson_id'
    case 'item_progress':
      return 'user_id,item_id,kind'
    default:
      return 'user_id'
  }
}

interface LwwRow {
  user_id?: string
  id?: string
  card_id?: string
  lesson_id?: string
  item_id?: string
  kind?: string
  updated_at?: string
  reviewed_at?: string
}

/**
 * Полная выгрузка строк активного пользователя в очередь (первый вход гостя:
 * sync_queue пуст — очередь не велась; ревью M13 минор о росте очереди гостя).
 */
export async function enqueueAllRows(database: HunterDb): Promise<void> {
  const tables: Array<
    [
      (
        | HunterDb['card_states']
        | HunterDb['lesson_progress']
        | HunterDb['user_stats']
        | HunterDb['item_progress']
      ),
      string,
    ]
  > = [
    [database.card_states, 'card_states'],
    [database.lesson_progress, 'lesson_progress'],
    [database.user_stats, 'user_stats'],
    [database.item_progress, 'item_progress'],
  ]
  for (const [table, name] of tables) {
    const rows = await table.toArray()
    for (let start = 0; start < rows.length; start += PUSH_BATCH) {
      const chunk = rows.slice(start, start + PUSH_BATCH)
      await database.sync_queue.bulkAdd(
        chunk.map((row) => ({
          table: name as 'card_states',
          op: 'upsert' as const,
          payload: row,
          tries: 0,
          created_at: new Date().toISOString(),
        })),
      )
    }
  }
}

/**
 * Pull: изменения с сервера + LWW-merge в Dexie (specs/06 §3 init 4–5).
 * Постранично (asc, ≤PULL_PAGE за запрос) до исчерпания; курсор таблицы —
 * max(updated_at) ПОЛУЧЕННЫХ строк (high-water, ревью M13 Б2d); при ошибке
 * курсор не двигается (Б2c). review_log — по курсору reviewed_at, только
 * недостающие строки (Б1).
 */
export async function pull(database: HunterDb, sb?: SupabaseLike): Promise<void> {
  if (!isSyncConfigured() && !sb) return
  const supabase = sb ?? ((await client()) as unknown as SupabaseLike)
  const lwwTables = ['card_states', 'lesson_progress', 'user_stats', 'item_progress'] as const
  let hadError = false
  for (const table of lwwTables) {
    let cursor =
      ((await database.meta.get(`cursor:${table}`))?.value as string | undefined) ??
      '1970-01-01T00:00:00Z'
    for (;;) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .gt('updated_at', cursor)
        .order('updated_at', { ascending: true })
        .limit(PULL_PAGE)
      if (error || !data) {
        hadError = true
        break
      }
      if (data.length > 0) {
        await mergeLww(database, table, data as LwwRow[])
        const maxAt = (data as LwwRow[]).reduce(
          (max, row) => ((row.updated_at ?? '') > max ? (row.updated_at ?? '') : max),
          cursor,
        )
        cursor = maxAt
        await database.meta.put({ key: `cursor:${table}`, value: cursor }, `cursor:${table}`)
      }
      if (data.length < PULL_PAGE) break // таблица дочитана
    }
  }
  // review_log: append-only — курсор по reviewed_at, добавляем только новые id
  let logCursor =
    ((await database.meta.get('cursor:review_log'))?.value as string | undefined) ??
    '1970-01-01T00:00:00Z'
  for (;;) {
    const { data, error } = await supabase
      .from('review_log')
      .select('*')
      .gt('reviewed_at', logCursor)
      .order('reviewed_at', { ascending: true })
      .limit(PULL_PAGE)
    if (error || !data) {
      hadError = true
      break
    }
    if (data.length > 0) {
      for (const row of data as LwwRow[]) {
        const exists = await database.review_log.get(String(row.id))
        if (!exists) await database.review_log.put(row as never)
      }
      logCursor = (data as LwwRow[]).reduce(
        (max, row) => ((row.reviewed_at ?? '') > max ? (row.reviewed_at ?? '') : max),
        logCursor,
      )
      await database.meta.put({ key: 'cursor:review_log', value: logCursor }, 'cursor:review_log')
    }
    if (data.length < PULL_PAGE) break
  }
  if (!hadError) {
    await database.meta.put(
      { key: 'last_sync_at', value: new Date().toISOString() },
      'last_sync_at',
    )
  }
}

/**
 * LWW: серверная строка побеждает локальную при updated_at ≥; локаль новее —
 * остаётся. Постраничный merge: локальные строки владельца читаются одним
 * запросом, победители пишутся bulkPut — 5000 строк не должны порождать
 * 2×N точечных операций (ревью M13, CI-таймаут).
 */
export async function mergeLww(
  database: HunterDb,
  table: string,
  incoming: LwwRow[],
): Promise<void> {
  if (incoming.length === 0) return
  const winners: LwwRow[] = []
  if (table === 'user_stats') {
    for (const row of incoming) {
      const local = (await database.user_stats.get(row.user_id ?? '')) as LwwRow | null
      if ((row.updated_at ?? '') >= (local?.updated_at ?? '')) winners.push(row)
    }
    await database.user_stats.bulkPut(winners as never)
    return
  }
  const byOwner = new Map<string, LwwRow[]>()
  for (const row of incoming) {
    const list = byOwner.get(row.user_id ?? '') ?? []
    list.push(row)
    byOwner.set(row.user_id ?? '', list)
  }
  for (const [owner, rows] of byOwner) {
    const localRows = await readOwnerRows(database, table, owner)
    const localByKey = new Map<string, LwwRow>()
    for (const local of localRows) localByKey.set(localKey(table, local), local)
    for (const row of rows) {
      const local = localByKey.get(localKey(table, row))
      if ((row.updated_at ?? '') >= (local?.updated_at ?? '')) winners.push(row)
    }
  }
  await bulkPutRows(database, table, winners)
}

function localKey(table: string, row: LwwRow): string {
  switch (table) {
    case 'card_states':
      return String(row.card_id ?? '')
    case 'lesson_progress':
      return String(row.lesson_id ?? '')
    case 'item_progress':
      return `${row.item_id}:${row.kind}`
    default:
      // недостижимо: mergeLww вызывается только для LWW-таблиц (защитный default)
      /* istanbul ignore next */
      return ''
  }
}

async function readOwnerRows(database: HunterDb, table: string, owner: string): Promise<LwwRow[]> {
  switch (table) {
    case 'card_states':
      return (await database.card_states.where('user_id').equals(owner).toArray()) as never
    case 'lesson_progress':
      return (await database.lesson_progress.where('user_id').equals(owner).toArray()) as never
    case 'item_progress':
      return (await database.item_progress.where('user_id').equals(owner).toArray()) as never
    default:
      // недостижимо: readOwnerRows вызывается только для LWW-таблиц (защитный default)
      /* istanbul ignore next */
      return []
  }
}

async function bulkPutRows(database: HunterDb, table: string, rows: LwwRow[]): Promise<void> {
  switch (table) {
    case 'card_states':
      await database.card_states.bulkPut(rows as never)
      break
    case 'lesson_progress':
      await database.lesson_progress.bulkPut(rows as never)
      break
    case 'item_progress':
      await database.item_progress.bulkPut(rows as never)
      break
  }
}

/** Полный цикл: push → pull (вход/кнопка; фоновый online-триггер — auth.tsx). */
export async function syncNow(database: HunterDb, sb?: SupabaseLike): Promise<void> {
  await flush(database, sb)
  await pull(database, sb)
}
