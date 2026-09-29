// Implements: plan://M7#7.3 — XP-шина: начисление XP с капами дня, квест-счётчики,
// стрик (specs/04 §4–§6). Экраны вызывают award после реальной работы; здесь —
// чистые трансформации состояния + запись через репозиторий.

import { dayStart } from '../srs/scheduler'
import type { ProgressRepository } from '../progress'
import { applyXpCap, countStudyDay, createQuestDay, questAwards } from './game'
import type { QuestDayState, UserStats, XpCategory } from './types'

export interface AwardResult {
  /** фактически начисленный XP (после капа). */
  awarded: number
  quest: QuestDayState
  stats: UserStats
}

/**
 * Начисляет XP с учётом дневного капа категории и обновляет квест-счётчики.
 * Реакция «повтор карточки» также двигает слот квеста «Повтори карточки».
 * Стрик пересчитывается отдельно (closeStudyDay) — при выполнении слота.
 */
export async function awardXp(
  repo: ProgressRepository,
  now: Date,
  amount: number,
  category: XpCategory,
  questDelta: Partial<{ reviews: number; dictation: number; lesson: number; bonus: number }> = {},
): Promise<AwardResult> {
  const dayIso = dayStart(now).toISOString()
  const [stats, existing] = await Promise.all([repo.getStats(), repo.getQuestDay(dayIso)])
  const quest = existing ?? createQuestDay(dayIso, 0) // цель повторов уточняется вызывающим (дашборд/сессия)
  const { awarded, counters } = applyXpCap(quest.xp, category, amount)
  const nextQuest: QuestDayState = {
    ...quest,
    xp: counters,
    slots: {
      ...quest.slots,
      reviews: {
        ...quest.slots.reviews,
        done: quest.slots.reviews.done + (questDelta.reviews ?? 0),
      },
      lesson: {
        ...quest.slots.lesson,
        done: quest.slots.lesson.done + (questDelta.lesson ?? 0),
      },
      dictation: {
        ...quest.slots.dictation,
        done: quest.slots.dictation.done + (questDelta.dictation ?? 0),
      },
    },
    bonusDone: quest.bonusDone + (questDelta.bonus ?? 0),
  }
  const awards = questAwards(nextQuest)
  const bonusXp = awards.allDone + awards.bonus
  const nextStats: UserStats = {
    ...stats,
    xp: stats.xp + awarded + bonusXp,
    updated_at: now.toISOString(),
  }
  if (awards.allDone > 0) nextQuest.allDoneAwarded = true
  if (awards.bonus > 0) nextQuest.bonusAwarded = true
  await Promise.all([repo.putQuestDay(nextQuest), repo.putStats(nextStats)])
  return { awarded: awarded + bonusXp, quest: nextQuest, stats: nextStats }
}

/**
 * Закрывает учебный день для стрика: выполняется при первом засчитанном слоте
 * (game://streak-day). Идемпотентна в пределах дня (streakCounted).
 * freezeGained — выдана ли заморозка (+1 за кратные 7 стрика) — для тоста (M10).
 */
export async function closeStudyDay(
  repo: ProgressRepository,
  now: Date,
): Promise<{ stats: UserStats; freezeGained: boolean }> {
  const dayIso = dayStart(now).toISOString()
  const [stats, quest] = await Promise.all([repo.getStats(), repo.getQuestDay(dayIso)])
  if (!quest || quest.streakCounted) return { stats, freezeGained: false }
  const reconciliation = countStudyDay(stats, dayIso)
  const nextQuest: QuestDayState = {
    ...quest,
    streakCounted: true,
    freezesSpent: reconciliation.freezesSpent,
  }
  await Promise.all([repo.putQuestDay(nextQuest), repo.putStats(reconciliation.stats)])
  return {
    stats: reconciliation.stats,
    freezeGained: reconciliation.stats.freezes_left > stats.freezes_left,
  }
}

/** Слот квеста выполнен (для стрика достаточно любого — game://streak-day). */
export function anySlotDone(quest: QuestDayState): boolean {
  return (
    quest.slots.reviews.done >= quest.slots.reviews.target ||
    quest.slots.lesson.done >= quest.slots.lesson.target ||
    quest.slots.dictation.done >= quest.slots.dictation.target
  )
}

/**
 * Финал урока (specs/04 §4.1–§4.2): XP упражнений по категориям с капами,
 * слот квеста «Пройди урок» (+1), счётчик диктанта; бонус урока: +25 первый
 * урок дня, +10 последующий (повторный проход урока: 50% XP упражнений,
 * без бонуса — specs/04 §4.2). Одна транзакция состояния.
 */
/** Тип упражнения → id бонус-квеста (specs/04 §6 пул). */
export const BONUS_TYPES: Record<string, string> = {
  speak: 'speak-5',
  shadowing: 'shadowing-5',
  cloze: 'quotes-cloze-3',
  match_pairs: 'match-10',
}

export async function awardLessonFinish(
  repo: ProgressRepository,
  now: Date,
  opts: {
    xpByCategory: Partial<Record<XpCategory, number>>
    dictationCount: number
    /** сколько отвечено упражнений каждого типа (для бонус-квеста дня). */
    bonusByType: Record<string, number>
    isRepeat: boolean
  },
): Promise<AwardResult> {
  const dayIso = dayStart(now).toISOString()
  const [stats, existing] = await Promise.all([repo.getStats(), repo.getQuestDay(dayIso)])
  const quest = existing ?? createQuestDay(dayIso, 0)
  let counters = quest.xp
  let awarded = 0
  for (const [category, amount] of Object.entries(opts.xpByCategory) as [XpCategory, number][]) {
    const scaled = opts.isRepeat ? Math.floor(amount / 2) : amount
    const result = applyXpCap(counters, category, scaled)
    counters = result.counters
    awarded += result.awarded
  }
  const lessonBonus = opts.isRepeat ? 0 : quest.slots.lesson.done === 0 ? 25 : 10
  awarded += lessonBonus
  const nextQuest: QuestDayState = {
    ...quest,
    xp: counters,
    slots: {
      ...quest.slots,
      lesson: { ...quest.slots.lesson, done: quest.slots.lesson.done + 1 },
      dictation: {
        ...quest.slots.dictation,
        done: quest.slots.dictation.done + opts.dictationCount,
      },
    },
    bonusDone:
      quest.bonusDone +
      Object.entries(BONUS_TYPES)
        .filter(([, bonusId]) => bonusId === quest.bonus.id)
        .reduce((sum, [type]) => sum + (opts.bonusByType[type] ?? 0), 0),
  }
  const awards = questAwards(nextQuest)
  awarded += awards.allDone + awards.bonus
  if (awards.allDone > 0) nextQuest.allDoneAwarded = true
  if (awards.bonus > 0) nextQuest.bonusAwarded = true
  const nextStats: UserStats = {
    ...stats,
    xp: stats.xp + awarded,
    updated_at: now.toISOString(),
  }
  await Promise.all([repo.putQuestDay(nextQuest), repo.putStats(nextStats)])
  return { awarded, quest: nextQuest, stats: nextStats }
}
