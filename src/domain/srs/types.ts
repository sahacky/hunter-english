// Implements: plan://M4#4.1 — общие типы SRS-домена (specs/03, specs/06 §1)
// Чистый TS без знания о хранилище и React (архитектурный «шов», PLANS → M4).

/** Типы карточек — specs/03 §3 (srs://card-types). */
export type CardType = 'en-ru' | 'ru-en' | 'dictation' | 'cloze' | 'speak' | 'grammar'

/** Колоды — specs/06 §1 card_states.deck. */
export type Deck = 'words' | 'phrases' | 'quotes' | 'phrasebook'

/**
 * Заметка — источник контента. Из одной заметки максимум 4 карточки
 * (srs://rule-1); порядок создания для слов: en-ru → dictation → ru-en → speak.
 */
export interface Note {
  /** id заметки, напр. `note_house-noun` (стабилен, из id сущности контента). */
  id: string
  deck: Deck
  /** id сущности контента, напр. `house-noun` (data/words). */
  entityId: string
  /** EN-сторона (лемма / фраза / реплика). */
  en: string
  /** RU-сторона (перевод; для ввода — эталон и варианты). */
  ru: string
  /** Путь аудио из контента, напр. `audio/words/cori/house-noun.opus`. */
  audio?: string
}

/**
 * Хранимое состояние карточки — зеркало `card_states` (specs/06 §1):
 * поля FSRS 1:1 с `Card` ts-fsrs + служебные поля приложения.
 * Даты — ISO-строки UTC (в ts-fsrs конвертируются в Date на границе модуля).
 */
export interface CardState {
  /** `<entity_id>.<тип>`, напр. `house-noun.en-ru` (srs://card_id). */
  card_id: string
  note_id: string
  type: CardType
  deck: Deck
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  reps: number
  lapses: number
  /** 0 New / 1 Learning / 2 Review / 3 Relearning (State ts-fsrs). */
  state: 0 | 1 | 2 | 3
  last_review: string | null
  suspended: boolean
  cloze_index: number | null
  created_at: string
  updated_at: string
}

/** Запись журнала — `review_log` (specs/06 §1), append-only, id — UUIDv7 клиента. */
export interface ReviewLogEntry {
  id: string
  card_id: string
  rating: 1 | 2 | 3 | 4
  /** состояние до ответа */
  state: 0 | 1 | 2 | 3
  /** состояние после ответа */
  state_after: 0 | 1 | 2 | 3
  elapsed_days: number
  scheduled_days: number
  duration_ms: number
  client: 'web'
  session_id: string | null
  reviewed_at: string
}

/** Результат ответа: новое состояние + запись лога (одна транзакция в репозитории). */
export interface AnswerResult {
  next: CardState
  log: ReviewLogEntry
}

/** Класс записи в очереди сессии — specs/03 §7 (srs://session-order). */
export type QueueKind = 'learning' | 'review-young' | 'review-mature' | 'wake-up' | 'new'

/** Элемент очереди повторения. */
export interface QueueEntry {
  card: CardState
  note: Note
  kind: QueueKind
}

/** Счётчики очереди как в Anki — specs/03 §7. */
export interface QueueCounts {
  learning: number
  review: number
  new: number
}

/** План сессии: упорядоченная очередь + счётчики + применённый лимит новых. */
export interface SessionPlan {
  entries: QueueEntry[]
  counts: QueueCounts
  /** Сколько новых разрешено сегодня после flood-guard (srs://rule-5). */
  newLimit: number
  /** Долг на начало дня (due-карточки без новых) — причина урезания лимита. */
  debt: number
}

/** Порог young/mature, дней (srs://states; открытый вопрос 1 — пока 21). */
export const YOUNG_MATURE_DAYS = 21

/** Максимальное число карточек на заметку (srs://rule-1). */
export const MAX_CARDS_PER_NOTE = 4

/** Порядок создания карточек слова (srs://rule-1). */
export const WORD_CARD_ORDER: CardType[] = ['en-ru', 'dictation', 'ru-en', 'speak']

/** Интервал пассивной карточки (дней), открывающий обратные (srs://rule-2). */
export const WAKEUP_THRESHOLD_DAYS = 7

/** Максимум пробуждений в день (srs://rule-2). */
export const WAKEUP_DAILY_LIMIT = 5
