// Implements: plan://M4#4.2 — Dexie-схема, структурное зеркало specs/06 §3 (db://sync-dexie).
// Имена/поля совпадают с таблицами Postgres; user_id в MVP — 'local' (Supabase — M12).

import Dexie, { type Table } from 'dexie'
import type { LessonProgress } from '../domain/lesson/types'
import type { CardState, ReviewLogEntry } from '../domain/srs/types'

/** Владелец записей в MVP (до входа через Supabase в M12, specs/06 §1). */
export const LOCAL_USER_ID = 'local'

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

export class HunterDb extends Dexie {
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
