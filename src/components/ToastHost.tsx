// Implements: plan://M10#10.5 — хост тостов: стек сверху справа, aria-live polite,
// автоскрытие 4с (specs/04 §10 «умеренность»; reduced-motion — без анимации).
import { useEffect, useState } from 'react'
import { subscribeToasts, type Toast } from '../lib/toast'

const TOAST_TTL_MS = 4000

export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const unsubscribe = subscribeToasts((toast) => {
      setToasts((prev) => [...prev.slice(-3), toast]) // не более 4 в стеке
      timers.push(
        setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== toast.id)), TOAST_TTL_MS),
      )
    })
    return () => {
      unsubscribe()
      timers.forEach(clearTimeout)
    }
  }, [])

  if (toasts.length === 0) return null
  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          <span className="toast-sigil" aria-hidden="true">
            ⟦⟧
          </span>
          {toast.message}
        </div>
      ))}
    </div>
  )
}
