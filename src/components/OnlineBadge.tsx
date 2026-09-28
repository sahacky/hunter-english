import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Онлайн-статус по navigator.onLine + событиям online/offline (specs/07 §1). */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}

/**
 * Бейдж «офлайн» в шапке (specs/07 §1: offline — всё работает локально,
 * прогресс сохранён). Не отображается при наличии сети.
 */
export function OnlineBadge() {
  const { t } = useTranslation()
  const online = useOnlineStatus()
  if (online) return null
  return (
    <span className="offline-badge" role="status">
      {t('app.offline')}
    </span>
  )
}
