// Implements: plan://M7#7.1 — типы домена геймификации (specs/04, specs/06 §3)
// Чистый TS: хранение — ProgressRepository (user_stats, item_progress), UI — экраны M7.

/** Ранг охотника = CEFR (specs/04 §2.1); меняется только через «Врата». */
export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S'

/** Идентификатор экзамена: обычные Врата по целевому рангу + особый Финал (specs/07 §2 S-FINAL). */
export type GateId = Rank | 'S-FINAL'

/** user_stats — зеркало specs/06 §3 (db://table-user_stats). */
export interface UserStats {
  xp: number
  streak_current: number
  streak_best: number
  freezes_left: number
  rank: Rank
  /** [{ gate, passed_at, score }] — история Врат (jsonb specs/06 §3). */
  gates_history: { gate: GateId; passed_at: string; score: number }[]
  /** учебный день (ISO dayStart) последнего засчитанного дня — для стрика. */
  last_counted_day: string | null
  updated_at: string
}

export function emptyStats(now: string): UserStats {
  return {
    xp: 0,
    streak_current: 0,
    streak_best: 0,
    freezes_left: 2, // стартовый запас (game://freeze)
    rank: 'E',
    gates_history: [],
    last_counted_day: null,
    updated_at: now,
  }
}

/** Категории дневных капов XP (specs/04 §4.2). */
export type XpCategory =
  | 'reviews' // повторы карточек ≤200
  | 'choice' // упражнения-выбор ≤30
  | 'voice' // голосом ≤60
  | 'dictation' // диктант ≤60
  | 'shadowing' // shadowing ≤45
  | 'uncapped' // ввод/word-bank/cloze/бонусы — без капа

/** Счётчики XP текущего учебного дня (quest_day.data.xp). */
export interface XpDayCounters {
  reviews: number
  choice: number
  voice: number
  dictation: number
  shadowing: number
}

/** Слоты ежедневного квеста (specs/04 §6). */
export interface QuestSlots {
  /** «Повтори карточки»: отвечено / цель (все due, минимум 20 для счёта). */
  reviews: { done: number; target: number }
  /** «Пройди урок»: 0/1. */
  lesson: { done: number; target: number }
  /** «Диктант»: фразы / 10. */
  dictation: { done: number; target: number }
  /** «Аудирование»: секунды / 20 мин (input-трек, plan://curriculum-review#I.1). */
  listening: { done: number; target: number }
}

/** Бонус-квест дня (seeded по дате, без переролла — specs/04 §6). */
export interface BonusQuest {
  id: string
  target: number
}

/** Состояние квеста дня — item_progress kind='quest_day' (specs/06 §3). */
export interface QuestDayState {
  /** учебный день (ISO dayStart) — ключ записи. */
  studyDay: string
  slots: QuestSlots
  bonus: BonusQuest
  bonusDone: number
  allDoneAwarded: boolean
  bonusAwarded: boolean
  /** день засчитан для стрика (хотя бы один слот — game://streak-day). */
  streakCounted: boolean
  xp: XpDayCounters
  /** списание заморозок за пропущенные до этого дня (в момент пересчёта). */
  freezesSpent: number
}

/** Секция экзамена «Врата» (specs/04 §3.1). */
export type GateSection = 'vocab' | 'grammar' | 'listening' | 'speaking'

export interface GateSectionScore {
  section: GateSection
  correct: number
  total: number
}

/** Результат попытки Врат (item_progress kind='gate_attempts'). */
export interface GateAttempt {
  gate: GateId
  started_at: string
  finished_at: string | null
  /** секции прошлой попытки, сохранённые для пересдачи (game://gate-retry-sections). */
  passed: GateSection[]
  scores: GateSectionScore[]
}

/** Уровень внутри ранга (specs/04 §2.2). */
export interface LevelInfo {
  level: number
  /** XP, засчитанный в текущем ранге. */
  rankXp: number
  /** порог следующего подуровня (суммарный в ранге). */
  nextAt: number
  /** прогресс к следующему уровню 0–1. */
  progress: number
}
