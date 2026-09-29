// Implements: plan://M4#4.2 — реализация ProgressRepository на Dexie (specs/06 §1, §3).
// saveAnswer: одна транзакция — upsert card_states + append review_log (append-only:
// нет update/delete) + операции в sync_queue (flush в Supabase — M12).
// ensureCards — идемпотентная материализация карточек контента; в sync_queue не пишет:
// это бустрап контента (тысячи карточек создаются один раз локально, серверу они не нужны).

import type { ProgressRepository } from '../domain/progress'
import type { GateAttempt, QuestDayState, UserStats } from '../domain/game/types'
import { emptyStats } from '../domain/game/types'
import type { LessonProgress } from '../domain/lesson/types'
import type { CardState, ReviewLogEntry } from '../domain/srs/types'
import {
  HunterDb,
  LOCAL_USER_ID,
  db as defaultDb,
  type CardStateRow,
  type ItemProgressRow,
  type LessonProgressRow,
  type ReviewLogRow,
  type UserStatsRow,
} from './db'

function toCardRow(card: CardState): CardStateRow {
  return { ...card, user_id: LOCAL_USER_ID }
}

function toLogRow(log: ReviewLogEntry): ReviewLogRow {
  return { ...log, user_id: LOCAL_USER_ID }
}

export class DexieProgressRepository implements ProgressRepository {
  private readonly db: HunterDb

  constructor(db: HunterDb = defaultDb) {
    this.db = db
  }

  async ensureCards(cards: CardState[]): Promise<void> {
    if (cards.length === 0) return
    await this.db.transaction('rw', this.db.card_states, async () => {
      const keys = cards.map((card): [string, string] => [LOCAL_USER_ID, card.card_id])
      const existing = await this.db.card_states.bulkGet(keys)
      const missing = cards.filter((_, i) => existing[i] === undefined)
      if (missing.length > 0) await this.db.card_states.bulkAdd(missing.map(toCardRow))
    })
  }

  async getAllCards(): Promise<CardState[]> {
    const rows = await this.db.card_states.where('user_id').equals(LOCAL_USER_ID).toArray()
    return rows.map(({ user_id: _user_id, ...card }) => card)
  }

  async saveAnswer(next: CardState, log: ReviewLogEntry): Promise<void> {
    await this.db.transaction(
      'rw',
      this.db.card_states,
      this.db.review_log,
      this.db.sync_queue,
      async () => {
        await this.db.card_states.put(toCardRow(next))
        await this.db.review_log.add(toLogRow(log))
        const created_at = log.reviewed_at
        await this.db.sync_queue.bulkAdd([
          { table: 'card_states', op: 'upsert', payload: toCardRow(next), tries: 0, created_at },
          { table: 'review_log', op: 'insert', payload: toLogRow(log), tries: 0, created_at },
        ])
      },
    )
  }

  async countNewAnsweredSince(iso: string): Promise<number> {
    return this.db.review_log
      .where('reviewed_at')
      .aboveOrEqual(iso)
      .filter((entry) => entry.state === 0)
      .count()
  }

  async getLessonProgress(lessonId: string): Promise<LessonProgress | null> {
    const row = await this.db.lesson_progress.get([LOCAL_USER_ID, lessonId])
    if (!row) return null
    const { user_id: _user_id, ...progress } = row
    return progress
  }

  async getStats(): Promise<UserStats> {
    const row = await this.db.user_stats.get(LOCAL_USER_ID)
    if (!row) return emptyStats(new Date().toISOString())
    const { user_id: _user_id, ...stats } = row
    return stats
  }

  async putStats(stats: UserStats): Promise<void> {
    const row: UserStatsRow = { ...stats, user_id: LOCAL_USER_ID }
    await this.db.transaction('rw', this.db.user_stats, this.db.sync_queue, async () => {
      await this.db.user_stats.put(row)
      await this.db.sync_queue.add({
        table: 'user_stats',
        op: 'upsert',
        payload: row,
        tries: 0,
        created_at: stats.updated_at,
      })
    })
  }

  async getQuestDay(studyDayIso: string): Promise<QuestDayState | null> {
    const row = await this.db.item_progress.get([LOCAL_USER_ID, studyDayIso, 'quest_day'])
    return row ? (row.data as QuestDayState) : null
  }

  async putQuestDay(state: QuestDayState): Promise<void> {
    const row: ItemProgressRow = {
      user_id: LOCAL_USER_ID,
      item_id: state.studyDay,
      kind: 'quest_day',
      data: state,
      updated_at: new Date().toISOString(),
    }
    await this.db.transaction('rw', this.db.item_progress, this.db.sync_queue, async () => {
      await this.db.item_progress.put(row)
      await this.db.sync_queue.add({
        table: 'item_progress',
        op: 'upsert',
        payload: row,
        tries: 0,
        created_at: row.updated_at,
      })
    })
  }

  async getGateAttempt(gate: string): Promise<GateAttempt | null> {
    const row = await this.db.item_progress.get([LOCAL_USER_ID, gate, 'gate_attempts'])
    return row ? (row.data as GateAttempt) : null
  }

  /** Отметка «понял без перевода» на цитате (specs/07 §2.1, plan://M11#11.2). */
  async getQuoteMark(quoteId: string): Promise<boolean> {
    const row = await this.db.item_progress.get([LOCAL_USER_ID, quoteId, 'quote'])
    return row ? Boolean((row.data as { understood?: boolean } | null)?.understood) : false
  }

  async putQuoteMark(quoteId: string, understood: boolean): Promise<void> {
    const row: ItemProgressRow = {
      user_id: LOCAL_USER_ID,
      item_id: quoteId,
      kind: 'quote',
      data: { understood },
      updated_at: new Date().toISOString(),
    }
    await this.db.transaction('rw', this.db.item_progress, this.db.sync_queue, async () => {
      await this.db.item_progress.put(row)
      await this.db.sync_queue.add({
        table: 'item_progress',
        op: 'upsert',
        payload: row,
        tries: 0,
        created_at: row.updated_at,
      })
    })
  }

  async putGateAttempt(attempt: GateAttempt): Promise<void> {
    const row: ItemProgressRow = {
      user_id: LOCAL_USER_ID,
      item_id: attempt.gate,
      kind: 'gate_attempts',
      data: attempt,
      updated_at: new Date().toISOString(),
    }
    await this.db.transaction('rw', this.db.item_progress, this.db.sync_queue, async () => {
      await this.db.item_progress.put(row)
      await this.db.sync_queue.add({
        table: 'item_progress',
        op: 'upsert',
        payload: row,
        tries: 0,
        created_at: row.updated_at,
      })
    })
  }

  async putLessonProgress(progress: LessonProgress): Promise<void> {
    const row: LessonProgressRow = { ...progress, user_id: LOCAL_USER_ID }
    await this.db.transaction('rw', this.db.lesson_progress, this.db.sync_queue, async () => {
      await this.db.lesson_progress.put(row)
      await this.db.sync_queue.add({
        table: 'lesson_progress',
        op: 'upsert',
        payload: row,
        tries: 0,
        created_at: progress.updated_at,
      })
    })
  }
}
