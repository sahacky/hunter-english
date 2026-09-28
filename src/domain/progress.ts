// Implements: plan://M4#4.2 — интерфейс репозитория прогресса (архитектурный «шов»).
// Домен не знает о хранилище: MVP — Dexie (src/data), M12 — Supabase поверх той же очереди
// (PLANS → M4, specs/06 §0 офлайн-first).

import type { CardState, ReviewLogEntry } from './srs/types'
import type { GateAttempt, QuestDayState, UserStats } from './game/types'
import type { LessonProgress } from './lesson/types'

export interface ProgressRepository {
  /** Идемпотентно создаёт отсутствующие карточки (контент-загрузчик, plan://M4#4.3). */
  ensureCards(cards: CardState[]): Promise<void>
  /** Все карточки пользователя (для сборки очереди buildQueue). */
  getAllCards(): Promise<CardState[]>
  /** Ответ: upsert card_state + append review_log — одна транзакция (specs/06 §1). */
  saveAnswer(next: CardState, log: ReviewLogEntry): Promise<void>
  /**
   * Сколько ответов сегодня дано на новых карточках (state до ответа = 0) —
   * дневной лимит новых srs://rule-3 между сессиями.
   */
  countNewAnsweredSince(iso: string): Promise<number>
  /** Чекпоинт урока (specs/06 §3 db://table-lesson_progress); null — урок не начат. */
  getLessonProgress(lessonId: string): Promise<LessonProgress | null>
  /**
   * Сохраняет чекпоинт урока (upsert + sync_queue). Единица сохранения —
   * отдельное задание: экран пишет после каждого вердикта (specs/02 §5).
   */
  putLessonProgress(progress: LessonProgress): Promise<void>
  /** Статы охотника (specs/06 §3 user_stats); новый профиль — пустые статы. */
  getStats(): Promise<UserStats>
  putStats(stats: UserStats): Promise<void>
  /** Состояние квеста учебного дня (item_progress kind='quest_day'). */
  getQuestDay(studyDayIso: string): Promise<QuestDayState | null>
  putQuestDay(state: QuestDayState): Promise<void>
  /** Попытка Врат (item_progress kind='gate_attempts'). */
  getGateAttempt(gate: string): Promise<GateAttempt | null>
  putGateAttempt(attempt: GateAttempt): Promise<void>
}
