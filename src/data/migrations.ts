// Implements: plan://curriculum-review#U3.2 — одноразовая миграция v1-флора оценки.
// Пользователи, применившие вердикт ДО 2026-10-02, получили suspend слов по
// СТАРОЙ полосе (старт D → ≤1000, A → ≤4000 — «вердикт = завершение ранга»).
// Новая семантика: скрыта полоса НИЖЕ ранга (D → ≤300), а новые слова дня идут
// из полосы текущего ранга — иначе у v1-профилей (например ранг A: всё ≤4000
// скрыто при потолке 4000) новые слова не приходят вовсе. Миграция возвращает
// в колоду полосу между новым и старым флором. Идемпотентна, gated флагом
// localStorage `hunter-floor-v2`.
import { PLACEMENT_WORD_FLOOR } from '../domain/placement/apply'
import type { Rank } from '../domain/game/types'

/** Флоры, применявшиеся версией до U3.2 (план O.3 изначально). */
const V1_FLOOR: Record<Exclude<Rank, 'E' | 'S'>, number> = {
  D: 1000,
  C: 1800,
  B: 2800,
  A: 4000,
}

const FLAG = 'hunter-floor-v2'

export function floorV2Done(): boolean {
  try {
    return localStorage.getItem(FLAG) === '1'
  } catch {
    return true // без localStorage гонять миграцию бессмысленно и небезопасно
  }
}

/**
 * Вернуть в колоду слова полосы (PLACEMENT_WORD_FLOOR[rank], V1_FLOOR[rank]]:
 * карточки, скрытые старым флором, но входящие в полосу текущего ранга.
 * Слова без карточек не трогаем (материализуются как unsuspended по rule-1).
 */
export async function fixV1WordFloor(
  repo: import('../domain/progress').ProgressRepository,
  statsRank: string,
  wordRanks: ReadonlyMap<string, number>,
): Promise<number> {
  if (statsRank !== 'D' && statsRank !== 'C' && statsRank !== 'B' && statsRank !== 'A') {
    localStorage.setItem(FLAG, '1')
    return 0
  }
  const rank = statsRank as Exclude<Rank, 'E' | 'S'>
  const from = PLACEMENT_WORD_FLOOR[rank]
  const to = V1_FLOOR[rank]
  const cards = await repo.getAllCards()
  const toUnsuspend: string[] = []
  for (const card of cards) {
    if (!card.suspended || card.deck !== 'words') continue
    const entityId = card.note_id.replace(/^note_/, '')
    const freq = wordRanks.get(entityId)
    if (freq === undefined || !Number.isFinite(freq)) continue
    if (freq > from && freq <= to) toUnsuspend.push(card.note_id)
  }
  if (toUnsuspend.length > 0) await repo.unsuspendNotes(toUnsuspend)
  localStorage.setItem(FLAG, '1')
  return toUnsuspend.length
}
