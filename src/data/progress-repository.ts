// Implements: plan://M4#4.2 — реализация ProgressRepository на Dexie (specs/06 §1, §3).
// saveAnswer: одна транзакция — upsert card_states + append review_log (append-only:
// нет update/delete) + операции в sync_queue (flush в Supabase — M12).
// ensureCards — идемпотентная материализация карточек контента; в sync_queue не пишет:
// это бустрап контента (тысячи карточек создаются один раз локально, серверу они не нужны).

import type { ProgressRepository } from '../domain/progress'
import type { CardState, ReviewLogEntry } from '../domain/srs/types'
import {
  HunterDb,
  LOCAL_USER_ID,
  db as defaultDb,
  type CardStateRow,
  type ReviewLogRow,
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
}
