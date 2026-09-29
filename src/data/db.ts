// Implements: plan://M4#4.2 — Dexie-схема, структурное зеркало specs/06 §3 (db://sync-dexie).
// Имена/поля совпадают с таблицами Postgres; user_id в MVP — 'local' (Supabase — M12).

import Dexie, { type Table } from 'dexie'
import type { LessonProgress } from '../domain/lesson/types'
import type { CardState, ReviewLogEntry } from '../domain/srs/types'

/** Владелец записей в MVP-гостевом режиме (до входа через Supabase, specs/06 §1). */
export const LOCAL_USER_ID = 'local'

/** Активный владелец записей Dexie: 'local' (гость) или uid после входа (M13).
 * Меняется ОДИН раз при login/logout с последующей перезагрузкой страницы. */
let activeUserId: string = LOCAL_USER_ID

export function getCurrentUserId(): string {
  return activeUserId
}

export function setCurrentUserId(userId: string): void {
  activeUserId = userId || LOCAL_USER_ID
}

export interface CardStateRow extends CardState {
  user_id: string
}

export interface ReviewLogRow extends ReviewLogEntry {
  user_id: string
}

export type LessonProgressRow = LessonProgress & { user_id: string }

export type UserStatsRow = import('../domain/game/types').UserStats & { user_id: string }

/** item_progress (specs/06 §3): kind-зависимый payload. */
export interface ItemProgressRow {
  user_id: string
  item_id: string
  kind: 'quest_day' | 'gate_attempts' | 'achievement' | 'quote'
  data: unknown
  updated_at: string
}

export interface SyncQueueRow {
  seq?: number
  table: 'card_states' | 'review_log' | 'lesson_progress' | 'user_stats' | 'item_progress'
  op: 'upsert' | 'insert'
  payload: unknown
  tries: number
  created_at: string
}

export interface MetaRow {
  key: string
  value: unknown
}

/** Профиль (specs/06 §1): зеркало серверной profiles; MVP-гость — 'local'. */
export interface ProfileRow {
  id: string
  display_name?: string | null
  locale?: string
  created_at?: string
  updated_at?: string
}

export class HunterDb extends Dexie {
  profiles!: Table<ProfileRow, string>
  card_states!: Table<CardStateRow, [string, string]>
  review_log!: Table<ReviewLogRow, string>
  lesson_progress!: Table<LessonProgressRow, [string, string]>
  user_stats!: Table<UserStatsRow, string>
  item_progress!: Table<ItemProgressRow, [string, string, string]>
  sync_queue!: Table<SyncQueueRow, number>
  meta!: Table<MetaRow, string>

  constructor(name = 'hunter-english') {
    super(name)
    this.version(1).stores({
      profiles: 'id',
      card_states: '[user_id+card_id], user_id, note_id, due, type, deck, updated_at',
      review_log: 'id, user_id, card_id, reviewed_at',
      lesson_progress: '[user_id+lesson_id], user_id, status, updated_at',
      item_progress: '[user_id+item_id+kind], user_id, updated_at',
      user_stats: 'user_id',
      disputes: '++id, card_id, created_at',
      sync_queue: '++seq, table, created_at',
      meta: 'key',
    })
  }
}

/** Экземпляр приложения; в тестах создают отдельный HunterDb со своим именем. */
export const db = new HunterDb()

/**
 * Перенос локального прогресса в аккаунт (первый вход, план M13#13.4):
 * все строки гостя 'local' получают user_id = uid — одна транзакция.
 * Идемпотентно: нет 'local'-строк — no-op. PK-поля (составные ключи с
 * user_id) пересчитываются Dexie автоматически при put с новым user_id.
 */
export async function remapLocalToUser(database: HunterDb, userId: string): Promise<void> {
  await database.transaction(
    'rw',
    [
      database.card_states,
      database.review_log,
      database.lesson_progress,
      database.user_stats,
      database.item_progress,
      database.sync_queue,
    ],
    async () => {
      const remapRows = async <T>(rows: readonly T[]): Promise<T[]> =>
        rows.map((row) => {
          const next = { ...(row as object), user_id: userId } as T & {
            user_id: string
            id?: unknown
          }
          if (next.id === LOCAL_USER_ID) next.id = userId
          return next as T
        })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const remapTable = async <T>(table: Dexie.Table<T, any>, rows: readonly T[]) => {
        if (rows.length === 0) return
        await table.bulkPut(await remapRows(rows))
        // старые guest-строки (user_id входит в PK) удаляем после вставки новых
        await (
          table as unknown as {
            where: (k: string) => { equals: (v: unknown) => { delete: () => Promise<number> } }
          }
        )
          .where('user_id')
          .equals(LOCAL_USER_ID)
          .delete()
      }
      await remapTable(
        database.card_states,
        await database.card_states.where('user_id').equals(LOCAL_USER_ID).toArray(),
      )
      await remapTable(
        database.review_log,
        await database.review_log.where('user_id').equals(LOCAL_USER_ID).toArray(),
      )
      await remapTable(
        database.lesson_progress,
        await database.lesson_progress.where('user_id').equals(LOCAL_USER_ID).toArray(),
      )
      // user_stats: PK user_id — единственная строка
      const stats = await database.user_stats.get(LOCAL_USER_ID)
      if (stats) {
        await database.user_stats.put({ ...stats, user_id: userId })
        await database.user_stats.delete(LOCAL_USER_ID)
      }
      await remapTable(
        database.item_progress,
        await database.item_progress.where('user_id').equals(LOCAL_USER_ID).toArray(),
      )
      // payload очереди синка ссылается на user_id — ремапим поля записей
      const queued = await database.sync_queue.toArray()
      for (const op of queued) {
        const payload = op.payload as Record<string, unknown> | null
        if (payload && payload.user_id === LOCAL_USER_ID) {
          const nextPayload: Record<string, unknown> = { ...payload, user_id: userId }
          if (nextPayload.id === LOCAL_USER_ID) nextPayload.id = userId
          await database.sync_queue.put({ ...op, payload: nextPayload })
        }
      }
    },
  )
}
