// Implements: plan://onboarding#O.4 — флаг пройденного онбординга (localStorage,
// per-браузер; specs/07 §2.2: повторное открытие /#/welcome после прохождения —
// редирект на главную). Декси не используется сознательно: флаг не синкается
// (прогресс уже есть — оценка на новом устройстве не предлагается) и должен
// читаться до первого рендера дашборда.
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
