// Implements: plan://curriculum-review#I.1 — учёт минут аудирования дня:
// автосчёт из шлюза озвучки (tts sink) + ручная отметка «послушал вне приложения».
import { dayStart } from '../domain/srs/scheduler'
import { createQuestDay, LISTENING_TARGET_SEC } from '../domain/game/game'
import type { QuestDayState } from '../domain/game/types'
import type { ProgressRepository } from '../domain/progress'

/**
 * Дозаполняет слот listening в записях, созданных до input-трека
 * (старые строки квеста в IndexedDB гостей).
 */
export function questWithListening(row: QuestDayState): QuestDayState {
  if (row.slots.listening) return row
  return { ...row, slots: { ...row.slots, listening: { done: 0, target: LISTENING_TARGET_SEC } } }
}

/**
 * Добавить секунды прослушанного аудирования в квест дня (создаёт запись дня,
 * если её ещё нет). Вызывается часто и малыми порциями: put маленькой строки
 * дешевле потери буфера при закрытии вкладки.
 */
export async function addListeningSeconds(
  repo: ProgressRepository,
  seconds: number,
  now: Date = new Date(),
): Promise<void> {
  if (!Number.isFinite(seconds) || seconds <= 0) return
  const dayIso = dayStart(now).toISOString()
  const existing = await repo.getQuestDay(dayIso)
  const row = questWithListening(existing ?? createQuestDay(dayIso, 0))
  await repo.putQuestDay({
    ...row,
    slots: {
      ...row.slots,
      listening: { ...row.slots.listening, done: row.slots.listening.done + seconds },
    },
  })
}
