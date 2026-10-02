// Implements: plan://onboarding#O.4 — флаг пройденного онбординга (localStorage,
// per-браузер; specs/07 §2.2: повторное открытие /#/welcome после прохождения —
// редирект на главную). Декси не используется сознательно: флаг не синкается
// (прогресс уже есть — оценка на новом устройстве не предлагается) и должен
// читаться до первого рендера дашборда.
import type { ApplyPlacementMode } from '../domain/placement/apply'
import type { PlacementRank } from '../domain/placement/placement'

export const ONBOARDING_KEY = 'hunter-onboarding-done'

export async function isOnboarded(): Promise<boolean> {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === '1'
  } catch {
    // приватный режим/запрещённое хранилище — не блокируем вход в приложение
    return true
  }
}

export async function markOnboarded(): Promise<void> {
  try {
    localStorage.setItem(ONBOARDING_KEY, '1')
  } catch {
    // без хранилища флаг не запомнится — welcome предложится снова; не критично
  }
}

/**
 * Как был применён вердикт оценки (plan://curriculum-review#P.2): дашборд
 * объясняет «почему этот урок». Хранится рядом с флагом онбординга —
 * пояснение нужно только на устройстве, где проходила оценка; ранг в
 * user_stats синхронизируется отдельно и служит источником правды.
 */
export const PLACEMENT_INFO_KEY = 'hunter-placement-info'

export interface PlacementInfo {
  rank: PlacementRank
  mode: ApplyPlacementMode
  appliedAt: string
}

function isPlacementInfo(value: unknown): value is PlacementInfo {
  if (typeof value !== 'object' || value === null) return false
  const info = value as Partial<PlacementInfo>
  return (
    (info.rank === 'E' ||
      info.rank === 'D' ||
      info.rank === 'C' ||
      info.rank === 'B' ||
      info.rank === 'A') &&
    (info.mode === 'waive' || info.mode === 'start_at_rank') &&
    typeof info.appliedAt === 'string'
  )
}

export async function getPlacementInfo(): Promise<PlacementInfo | null> {
  try {
    const raw = localStorage.getItem(PLACEMENT_INFO_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isPlacementInfo(parsed) ? parsed : null
  } catch {
    // повреждённые данные — считаем, что оценки не было
    return null
  }
}

export async function savePlacementInfo(
  rank: PlacementRank,
  mode: ApplyPlacementMode,
): Promise<void> {
  try {
    localStorage.setItem(
      PLACEMENT_INFO_KEY,
      JSON.stringify({ rank, mode, appliedAt: new Date().toISOString() } satisfies PlacementInfo),
    )
  } catch {
    // без хранилища пояснение на дашборде не покажется; не критично
  }
}
