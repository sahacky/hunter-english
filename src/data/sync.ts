// Implements: plan://M13#13.3 — движок синхронизации по specs/06 §3.
// flush(): sync_queue → Supabase (upsert/insert, retry с экспоненциальной
// задержкой ≤5 попыток); pull(): курсорные выборки + LWW-merge в Dexie;
// syncNow(): flush → pull → курсоры в meta. Без env — no-op (гость).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { HunterDb } from './db'
import { getSupabase, isSyncConfigured } from './supabase'

/** Таблицы LWW (upsert) и append-only (insert) — specs/06 §3. */
const UPSERT_TABLES = new Set([
  'card_states',
  'lesson_progress',
  'user_stats',
  'item_progress',
  'profiles',
])
const MAX_TRIES = 5
const PUSH_BATCH = 200

export interface SyncStatus {
  configured: boolean
  queue: number
  failed: number
  lastSyncAt: string | null
}

/** Тонкая поверхность клиента для тестов (моки). */
export interface SupabaseLike {
  from: (table: string) => {
    upsert: (
      rows: unknown[],
      opts?: { onConflict?: string; ignoreDuplicates?: boolean },
    ) => PromiseLike<{ error: unknown }>
    insert: (rows: unknown[]) => PromiseLike<{ error: unknown }>
    select: (columns: string, opts?: { count?: 'exact' }) => SupabaseQueryLike
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

/** Push локальной очереди (specs/06 §3). Ошибки сети → tries+1, остаётся в очереди. */
export async function flush(database: HunterDb, sb?: SupabaseLike): Promise<void> {
  if (!isSyncConfigured() && !sb) return // sb передаётся тестами в обход env-гейта
  const supabase = sb ?? ((await client()) as unknown as SupabaseLike)
  const queued = await database.sync_queue.toArray()
  // группируем по таблице: батчи upsert по PUSH_BATCH; insert review_log — без дедупа
  const byTable = new Map<string, typeof queued>()
  for (const op of queued) {
    const list = byTable.get(op.table) ?? []
    list.push(op)
    byTable.set(op.table, list)
  }
  for (const [table, ops] of byTable) {
    const doable = ops.filter((op) => op.tries < MAX_TRIES)
    for (let start = 0; start < doable.length; start += PUSH_BATCH) {
      const batch = doable.slice(start, start + PUSH_BATCH)
      const rows = batch.map((op) => op.payload)
      const result = UPSERT_TABLES.has(table)
        ? await supabase.from(table).upsert(rows, { onConflict: conflictKey(table) })
        : await supabase.from(table).insert(rows)
      if (result.error) {
        for (const op of batch) {
          await database.sync_queue.update(op.seq!, { tries: op.tries + 1 })
        }
      } else {
        const seqs = batch.map((op) => op.seq!).filter((seq) => seq !== undefined)
        await database.sync_queue.bulkDelete(seqs)
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
    case 'profiles':
      return 'id'
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
}

/** Pull: изменения с сервера + LWW-merge в Dexie (specs/06 §3 init 4–5). */
export async function pull(database: HunterDb, sb?: SupabaseLike): Promise<void> {
  if (!isSyncConfigured() && !sb) return // sb передаётся тестами в обход env-гейта
  const supabase = sb ?? ((await client()) as unknown as SupabaseLike)
  const lastSync =
    ((await database.meta.get('last_sync_at'))?.value as string | undefined) ??
    '1970-01-01T00:00:00Z'
  const lwwTables = [
    'profiles',
    'card_states',
    'lesson_progress',
    'user_stats',
    'item_progress',
  ] as const
  for (const table of lwwTables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .gt('updated_at', lastSync)
      .order('updated_at', { ascending: false })
      .limit(5000)
    if (error || !data) continue
    await mergeLww(database, table, data as LwwRow[])
  }
  await database.meta.put({ key: 'last_sync_at', value: new Date().toISOString() }, 'last_sync_at')
}

/** LWW: серверная строка побеждает локальную при updated_at больше; равенство — сервер. */
export async function mergeLww(
  database: HunterDb,
  table: string,
  incoming: LwwRow[],
): Promise<void> {
  for (const row of incoming) {
    const local = await findLocal(database, table, row)
    const localAt = (local as LwwRow | null)?.updated_at ?? ''
    if ((row.updated_at ?? '') >= localAt) {
      await putRow(database, table, row)
    }
  }
}

async function putRow(database: HunterDb, table: string, row: LwwRow): Promise<void> {
  switch (table) {
    case 'profiles':
      await database.profiles.put(row as never)
      break
    case 'card_states':
      await database.card_states.put(row as never)
      break
    case 'lesson_progress':
      await database.lesson_progress.put(row as never)
      break
    case 'user_stats':
      await database.user_stats.put(row as never)
      break
    case 'item_progress':
      await database.item_progress.put(row as never)
      break
  }
}

async function findLocal(database: HunterDb, table: string, row: LwwRow): Promise<unknown | null> {
  switch (table) {
    case 'profiles':
      return (await database.profiles.get(String(row.id))) ?? null
    case 'card_states':
      return (await database.card_states.get([row.user_id, row.card_id])) ?? null
    case 'lesson_progress':
      return (await database.lesson_progress.get([row.user_id, row.lesson_id])) ?? null
    case 'user_stats':
      return (await database.user_stats.get(row.user_id ?? '')) ?? null
    case 'item_progress':
      return (await database.item_progress.get([row.user_id, row.item_id, row.kind])) ?? null
    default:
      return null
  }
}

/** Полный цикл: push → pull (план M13#13.4 использует при входе/кнопке). */
export async function syncNow(database: HunterDb, sb?: SupabaseLike): Promise<void> {
  await flush(database, sb)
  await pull(database, sb)
}
