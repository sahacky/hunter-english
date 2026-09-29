// Implements: plan://M4#4.1 — доменное ядро SRS (specs/03 §2, §4–§7)
// Чистый TS без знания о хранилище и React (архитектурный «шов», PLANS → M4).
// Планирование ведёт ts-fsrs как есть (specs/03 §1, принцип 1); здесь только обёртка,
// границы дня обучения и сборка очереди сессии.

import { fsrs, generatorParameters, State, type Card as FsrsCard, type Grade } from 'ts-fsrs'
import type {
  AnswerResult,
  CardState,
  Deck,
  Note,
  QueueCounts,
  QueueEntry,
  QueueKind,
  ReviewLogEntry,
  SessionPlan,
} from './types'
import {
  REVERSE_CARD_TYPES,
  WAKEUP_DAILY_LIMIT,
  WAKEUP_THRESHOLD_DAYS,
  YOUNG_MATURE_DAYS,
} from './types'

/** Час локальной границы дня обучения (srs://day-boundary). */
export const DAY_BOUNDARY_HOUR = 4

/** Дневной лимит новых по умолчанию (srs://rule-3; настройка профиля 5–50). */
export const DEFAULT_NEW_LIMIT = 15

/** Параметры планировщика — specs/03 §2 (srs://ts-fsrs). */
export function createScheduler() {
  return fsrs(
    generatorParameters({
      request_retention: 0.9,
      maximum_interval: 36500,
      enable_fuzz: true,
      enable_short_term: true,
      // REVIEW: specs/03 §2 задаёт learning_steps ['1m','10m'] / relearning_steps ['10m'],
      // но ts-fsrs 4.x шаги не конфигурирует — при enable_short_term библиотека сама
      // ведёт минутные шаги (New: Again 1м / Hard 5м / Good 10м; шаг Relearning 5м).
      // Следуем принципу specs/03 §1 «библиотеку используем как есть».
    }),
  )
}

const scheduler = createScheduler()

/** Метаданные ответа, нужные репозиторию (UUIDv7 генерирует вызывающий, plan://M4#4.2). */
export interface AnswerMeta {
  /** id записи review_log (UUIDv7 клиента). */
  logId: string
  /** id сессии повторения, если ответ в рамках сессии. */
  sessionId?: string | null
  /** Время обдумывания ответа. */
  durationMs?: number
}

function toFsrsCard(state: CardState): FsrsCard {
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsed_days,
    scheduled_days: state.scheduled_days,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    last_review: state.last_review ? new Date(state.last_review) : undefined,
  }
}

/**
 * Применяет ответ к карточке: считает новое состояние FSRS и запись журнала
 * (srs://buttons: Again=1, Hard=2, Good=3, Easy=4; specs/03 §2 — вызов f.next).
 * Чистая функция: хранилище не трогает, запись лога пишет репозиторий.
 */
export function applyAnswer(
  state: CardState,
  rating: 1 | 2 | 3 | 4,
  now: Date,
  meta: AnswerMeta,
): AnswerResult {
  const { card, log } = scheduler.next(toFsrsCard(state), now, rating as Grade)
  const next: CardState = {
    card_id: state.card_id,
    note_id: state.note_id,
    type: state.type,
    deck: state.deck,
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as CardState['state'],
    last_review: card.last_review ? card.last_review.toISOString() : null,
    suspended: state.suspended,
    cloze_index: state.cloze_index,
    created_at: state.created_at,
    updated_at: now.toISOString(),
  }
  const entry: ReviewLogEntry = {
    id: meta.logId,
    card_id: state.card_id,
    rating: log.rating as ReviewLogEntry['rating'],
    state: log.state as CardState['state'],
    state_after: next.state,
    elapsed_days: log.elapsed_days,
    scheduled_days: log.scheduled_days,
    duration_ms: meta.durationMs ?? 0,
    client: 'web',
    session_id: meta.sessionId ?? null,
    reviewed_at: log.review.toISOString(),
  }
  return { next, log: entry }
}

/**
 * Превью следующего due для оценки (кнопки с интервалами, specs/03 §6).
 * Чистая функция: то же планирование, что в applyAnswer, без записи лога.
 */
export function previewDue(state: CardState, rating: 1 | 2 | 3 | 4, now: Date): Date {
  const { card } = scheduler.next(toFsrsCard(state), now, rating as Grade)
  return card.due
}

/** Человекочитаемый интервал до due: Nм / Nч / Nд (mono-подпись кнопок SRS). */
export function formatInterval(from: Date, to: Date): string {
  const minutes = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000))
  if (minutes < 60) return `${Math.max(1, minutes)}м`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}ч`
  const days = Math.round(hours / 24)
  if (days < 365) return `${days}д`
  return `${(days / 365).toFixed(1)}г`
}

/**
 * Начало текущего дня обучения: 4:00 локального времени (srs://day-boundary).
 * Для момента до 4:00 — 4:00 предыдущего календарного дня.
 */
export function dayStart(now: Date): Date {
  const start = new Date(now)
  start.setHours(DAY_BOUNDARY_HOUR, 0, 0, 0)
  if (now.getHours() < DAY_BOUNDARY_HOUR) start.setDate(start.getDate() - 1)
  return start
}

/** Локальный день обучения в формате `YYYY-MM-DD` (для стриков/квестов, srs://day-boundary). */
export function studyDay(now: Date): string {
  const day = dayStart(now)
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const date = String(day.getDate()).padStart(2, '0')
  return `${day.getFullYear()}-${month}-${date}`
}

/** Принадлежат ли два момента одному дню обучения (4:00-граница). */
export function sameStudyDay(a: Date, b: Date): boolean {
  return studyDay(a) === studyDay(b)
}

/**
 * Защита от завала (srs://rule-5): долг ≤50 → 15; 51–120 → 8; 121–200 → 4; >200 → 0.
 * Пользовательский лимит (srs://rule-3, 5–50) может только уменьшить потолок.
 */
export function newLimitForDebt(debt: number, baseLimit: number = DEFAULT_NEW_LIMIT): number {
  const cap = debt <= 50 ? 15 : debt <= 120 ? 8 : debt <= 200 ? 4 : 0
  return Math.min(baseLimit, cap)
}

/**
 * rule-2 (srs://rule-2): пассивная карточка «созрела» для пробуждения обратных —
 * живёт в Review с интервалом ≥ 7 дней.
 */
export function isWakeUpDue(passive: CardState): boolean {
  return (
    !passive.suspended &&
    passive.state === State.Review &&
    passive.scheduled_days >= WAKEUP_THRESHOLD_DAYS
  )
}

/** Элемент входа очереди: карточка + заметка (склейка делает репозиторий, plan://M4#4.2). */
export interface QueueItem {
  card: CardState
  note: Note
}

export interface BuildQueueOptions {
  now: Date
  /** Пользовательский лимит новых (srs://rule-3, 5–50; дефолт 15). */
  baseNewLimit?: number
  /** Сколько пробуждений уже потрачено сегодня (srs://limits-new). */
  wokenToday?: number
}

const DECK_ORDER: Deck[] = ['words', 'phrases', 'quotes', 'phrasebook']

function byDueAsc(a: CardState, b: CardState): number {
  return a.due.localeCompare(b.due)
}

/**
 * Перемешивание новых по колодам (interleaving, specs/03 §3): round-robin по колодам,
 * внутри колоды — по created_at, затем card_id (детерминированно, без RNG).
 */
function interleaveByDeck(cards: CardState[]): CardState[] {
  const pools = new Map<Deck, CardState[]>()
  for (const card of cards) {
    const pool = pools.get(card.deck)
    if (pool) pool.push(card)
    else pools.set(card.deck, [card])
  }
  for (const pool of pools.values()) {
    pool.sort(
      (a, b) => a.created_at.localeCompare(b.created_at) || a.card_id.localeCompare(b.card_id),
    )
  }
  const result: CardState[] = []
  let left = true
  while (left) {
    left = false
    for (const deck of DECK_ORDER) {
      const next = pools.get(deck)?.shift()
      if (next) {
        result.push(next)
        left = true
      }
    }
  }
  return result
}

/**
 * Очередь сессии (srs://session-order): learning → review (young → mature) →
 * пробуждённые обратные (≤5/день, лимит новых не расходуют) → новые (лимит srs://rule-3/5).
 * Карточки с due в будущем и suspended не попадают в очередь.
 */
export function buildQueue(items: QueueItem[], options: BuildQueueOptions): SessionPlan {
  const { now, baseNewLimit = DEFAULT_NEW_LIMIT, wokenToday = 0 } = options
  const nowIso = now.toISOString()
  const startIso = dayStart(now).toISOString()

  const active = items.filter((item) => !item.card.suspended)

  // Пробуждённые: ещё не активные карточки заметок, у которых есть «созревшая» пассивная.
  const matureByNote = new Map<string, CardState>()
  for (const { card } of active) {
    if (isWakeUpDue(card)) {
      const prev = matureByNote.get(card.note_id)
      if (!prev || card.scheduled_days > prev.scheduled_days) matureByNote.set(card.note_id, card)
    }
  }
  const isWakeUp = (card: CardState): boolean =>
    card.state === State.New &&
    REVERSE_CARD_TYPES.includes(card.type) &&
    matureByNote.has(card.note_id)

  const learning: CardState[] = []
  const young: CardState[] = []
  const mature: CardState[] = []
  const newCards: CardState[] = []
  const wakeUps: CardState[] = []
  for (const { card } of active) {
    if (card.state === State.New) {
      if (isWakeUp(card)) wakeUps.push(card)
      else newCards.push(card)
      continue
    }
    if (card.due > nowIso) continue
    if (card.state === State.Learning || card.state === State.Relearning) {
      learning.push(card)
    } else if (card.state === State.Review) {
      const pool = card.scheduled_days < YOUNG_MATURE_DAYS ? young : mature
      pool.push(card)
    }
  }
  learning.sort(byDueAsc)
  young.sort(byDueAsc)
  mature.sort(byDueAsc)

  // Долг на начало дня (srs://rule-5) — причина урезания лимита новых.
  const debt = active.filter(({ card }) => card.state !== State.New && card.due <= startIso).length
  const newLimit = newLimitForDebt(debt, baseNewLimit)

  wakeUps.sort(
    (a, b) =>
      (matureByNote.get(b.note_id)?.scheduled_days ?? 0) -
        (matureByNote.get(a.note_id)?.scheduled_days ?? 0) || a.card_id.localeCompare(b.card_id),
  )
  const wokenLeft = Math.max(0, WAKEUP_DAILY_LIMIT - wokenToday)
  const woken = wakeUps.slice(0, wokenLeft)
  const fresh = interleaveByDeck(newCards).slice(0, newLimit)

  const entries: QueueEntry[] = []
  const push = (cards: CardState[], kind: QueueKind, notes: Map<string, Note>) => {
    for (const card of cards) {
      const note = notes.get(card.note_id)
      if (note) entries.push({ card, note, kind })
    }
  }
  const notes = new Map<string, Note>()
  for (const item of active) notes.set(item.note.id, item.note)
  push(learning, 'learning', notes)
  push(young, 'review-young', notes)
  push(mature, 'review-mature', notes)
  push(woken, 'wake-up', notes)
  push(fresh, 'new', notes)

  const counts: QueueCounts = {
    learning: learning.length,
    review: young.length + mature.length,
    // Счётчик «новые» включает пробуждённые (синий как у Anki), но лимит новых не расходуют.
    new: fresh.length + woken.length,
  }
  return { entries, counts, newLimit, debt }
}
