// Implements: plan://M4#4.2 — интерфейс репозитория прогресса (архитектурный «шов»).
// Домен не знает о хранилище: MVP — Dexie (src/data), M12 — Supabase поверх той же очереди
// (PLANS → M4, specs/06 §0 офлайн-first).

import type { CardState, ReviewLogEntry } from './srs/types'

export interface ProgressRepository {
  /** Идемпотентно создаёт отсутствующие карточки (контент-загрузчик, plan://M4#4.3). */
  ensureCards(cards: CardState[]): Promise<void>
  /** Все карточки пользователя (для сборки очереди buildQueue). */
  getAllCards(): Promise<CardState[]>
  /** Ответ: upsert card_state + append review_log — одна транзакция (specs/06 §1). */
  saveAnswer(next: CardState, log: ReviewLogEntry): Promise<void>
}
