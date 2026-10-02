// Implements: plan://M7#7.1 — уровни, капы XP, стрик, квесты, Врата (specs/04 §2–§6)

import type {
  BonusQuest,
  GateSectionScore,
  LevelInfo,
  QuestDayState,
  Rank,
  UserStats,
  XpCategory,
  XpDayCounters,
} from './types'

// --- Уровни (specs/04 §2.2: порог n → n+1 = 100 + 25×(n−1) XP ранга) --------

/** Пороги суммарны в ранге: ур.1→2 на 100, 2→3 на 225, 3→4 на 350… */
export function levelThreshold(level: number): number {
  if (level <= 1) return 0
  let total = 0
  for (let n = 1; n < level; n += 1) total += 100 + 25 * (n - 1)
  return total
}

export function levelInfo(rankXp: number): LevelInfo {
  let level = 1
  let consumed = 0
  while (rankXp >= consumed + (100 + 25 * (level - 1))) {
    consumed += 100 + 25 * (level - 1)
    level += 1
  }
  const stepSize = 100 + 25 * (level - 1)
  const nextAt = consumed + stepSize
  return {
    level,
    rankXp,
    nextAt,
    progress: Math.min(1, (rankXp - consumed) / stepSize),
  }
}

// --- Дневные капы XP (specs/04 §4.2) ----------------------------------------

/** CEFR-подпись ранга (specs/04 §2.1: E=A0 … S=C1) — для отображения рядом с рангом. */
export const RANK_CEFR: Record<'E' | 'D' | 'C' | 'B' | 'A' | 'S', string> = {
  E: 'A0',
  D: 'A1',
  C: 'A2',
  B: 'B1',
  A: 'B2',
  S: 'C1',
}

export const XP_CAPS: Record<Exclude<XpCategory, 'uncapped'>, number> = {
  reviews: 200,
  choice: 30,
  voice: 60,
  dictation: 60,
  shadowing: 45,
}

/** Применяет начисление с учётом капа дня; возвращает фактически начисленное. */
export function applyXpCap(
  counters: XpDayCounters,
  category: XpCategory,
  amount: number,
): { awarded: number; counters: XpDayCounters } {
  if (category === 'uncapped' || amount <= 0) {
    return { awarded: amount, counters }
  }
  const already = counters[category]
  const room = Math.max(0, XP_CAPS[category] - already)
  const awarded = Math.min(amount, room)
  return {
    awarded,
    counters: { ...counters, [category]: already + awarded },
  }
}

/** Категория капа по типу упражнения (specs/05 §3 type). */
export function xpCategory(exerciseType: string): XpCategory {
  switch (exerciseType) {
    case 'choose_translation':
    case 'match_pairs':
      return 'choice'
    case 'speak':
    case 'answer_question':
      return 'voice'
    case 'dictation':
      return 'dictation'
    case 'shadowing':
      return 'shadowing'
    default:
      return 'uncapped'
  }
}

// --- Стрик и заморозки (specs/04 §5) ----------------------------------------

export const FREEZE_START = 2
export const FREEZE_MAX = 5

export interface StreakReconciliation {
  stats: UserStats
  freezesSpent: number
  froze: boolean
  broke: boolean
}

/**
 * Пересчёт стрика при закрытии учебного дня (game://streak-day/streak-break/freeze-auto):
 * пропущенные дни закрываются заморозками (не больше запаса), иначе серия
 * обнуляется. Заморозка +1 за каждое кратное 7 серии (максимум 5 на счету).
 * todayIso — dayStart(now) текущего дня.
 */
export function countStudyDay(stats: UserStats, todayIso: string): StreakReconciliation {
  const DAY = 86_400_000
  const today = new Date(todayIso).getTime()
  const last = stats.last_counted_day ? new Date(stats.last_counted_day).getTime() : null
  let streak = stats.streak_current
  let freezes = stats.freezes_left
  let freezesSpent = 0
  let broke = false
  let froze = false
  if (last !== null) {
    const missed = Math.round((today - last) / DAY) - 1
    if (missed > 0) {
      if (missed <= freezes) {
        freezes -= missed
        freezesSpent = missed
        froze = missed > 0
      } else {
        streak = 0
        broke = true
      }
    }
  }
  streak += 1
  // game://freeze: +1 за каждые 7 дней серии
  if (streak > 0 && streak % 7 === 0 && freezes < FREEZE_MAX) {
    freezes += 1
  }
  const next: UserStats = {
    ...stats,
    streak_current: streak,
    streak_best: Math.max(stats.streak_best, streak),
    freezes_left: freezes,
    last_counted_day: todayIso,
    updated_at: new Date().toISOString(),
  }
  return { stats: next, freezesSpent, froze, broke }
}

// --- Ежедневные квесты (specs/04 §6) ----------------------------------------

export const BONUS_POOL: BonusQuest[] = [
  { id: 'speak-5', target: 5 },
  { id: 'shadowing-5', target: 5 },
  { id: 'quotes-cloze-3', target: 3 },
  { id: 'match-10', target: 10 },
]

export const DICTATION_TARGET = 10
export const REVIEWS_MIN = 20

/** Seeded выбор бонус-квеста: детерминирован по дате (без переролла). */
export function pickBonusQuest(studyDayIso: string, pool: BonusQuest[] = BONUS_POOL): BonusQuest {
  let hash = 0
  for (const ch of studyDayIso) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return pool[Math.abs(hash) % pool.length]
}

/** Новое состояние квеста на учебный день. */
export function createQuestDay(studyDayIso: string, dueToday: number): QuestDayState {
  return {
    studyDay: studyDayIso,
    slots: {
      reviews: { done: 0, target: Math.max(REVIEWS_MIN, dueToday) },
      lesson: { done: 0, target: 1 },
      dictation: { done: 0, target: DICTATION_TARGET },
    },
    bonus: pickBonusQuest(studyDayIso),
    bonusDone: 0,
    allDoneAwarded: false,
    bonusAwarded: false,
    streakCounted: false,
    xp: { reviews: 0, choice: 0, voice: 0, dictation: 0, shadowing: 0 },
    freezesSpent: 0,
  }
}

export interface QuestAward {
  /** +30 за все 3 слота (game://quest-all). */
  allDone: number
  /** +15 за бонус-квест (game://quest-bonus). */
  bonus: number
}

/** Начисление за закрытие квеста: единожды за день, XP без капа (бонусы). */
export function questAwards(state: QuestDayState): QuestAward {
  const allDone =
    !state.allDoneAwarded &&
    state.slots.reviews.done >= state.slots.reviews.target &&
    state.slots.lesson.done >= state.slots.lesson.target &&
    state.slots.dictation.done >= state.slots.dictation.target
      ? 30
      : 0
  const bonus = !state.bonusAwarded && state.bonusDone >= state.bonus.target ? 15 : 0
  return { allDone, bonus }
}

// --- Врата (specs/04 §3) -----------------------------------------------------

export const GATE_SECTION_PASS = 0.8
export const GATE_TOTAL_PASS = 0.85
export const GATE_COOLDOWN_MS = 72 * 3_600_000

export interface GateVerdict {
  passed: boolean
  /** сумма процентов 0–100. */
  total: number
  weakSections: GateSectionScore[]
}

/** Вердикт попытки: каждая секция ≥80% И сумма ≥85% (specs/04 §3.1). */
export function judgeGate(scores: GateSectionScore[]): GateVerdict {
  const total = Math.round(
    (scores.reduce((sum, s) => sum + (s.total > 0 ? s.correct / s.total : 1), 0) /
      Math.max(1, scores.length)) *
      100,
  )
  const weakSections = scores.filter((s) => s.total > 0 && s.correct / s.total < GATE_SECTION_PASS)
  return {
    passed: weakSections.length === 0 && total >= GATE_TOTAL_PASS * 100,
    total,
    weakSections,
  }
}

/** Кулдаун пересдачи: не раньше 72ч после провала (game://gate-cooldown). */
export function cooldownPassed(failedAtIso: string, now: Date): boolean {
  return now.getTime() - new Date(failedAtIso).getTime() >= GATE_COOLDOWN_MS
}

/** Ранг вслед за сданными Вратами (specs/04 §2.1). */
export const NEXT_RANK: Record<Rank, Rank> = {
  E: 'D',
  D: 'C',
  C: 'B',
  B: 'A',
  A: 'S',
  S: 'S',
}

/** Чеклист готовности к Вратам (game://gate-progress, упрощённо M7). */
export interface GateChecklist {
  wordsKnown: { value: number; target: number; ok: boolean }
  lessonsDone: { value: number; target: number; ok: boolean }
  ready: boolean
}
