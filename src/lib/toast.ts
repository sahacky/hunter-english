// Implements: plan://M10#10.5 — тосты «Системы» (specs/04 §10, решение M7#2):
// только значимые события, стек с автоскрытием, aria-live polite.
type ToastListener = (toast: Toast) => void

export interface Toast {
  id: number
  message: string
}

let nextId = 1
const listeners = new Set<ToastListener>()

/** Показать тост (автоскрытие — ответственность ToastHost). */
export function showToast(message: string): void {
  const toast: Toast = { id: nextId++, message }
  listeners.forEach((listener) => listener(toast))
}

export function subscribeToasts(listener: ToastListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
