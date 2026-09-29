// Implements: plan://M13#13.4 — экран входа /#/login (specs/07 §2.1):
// гостевой режим — основная кнопка; вход magic link / Google при настроенном Supabase.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../state/auth'

export default function LoginScreen() {
  const { t } = useTranslation()
  const { configured, sendMagicLink, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    const result = await sendMagicLink(email.trim())
    setBusy(false)
    if (result.ok) setSent(true)
    else setError(result.error ?? t('login.genericError'))
  }

  const google = async () => {
    setBusy(true)
    setError(null)
    const result = await signInWithGoogle()
    if (!result.ok) {
      setBusy(false)
      setError(result.error ?? t('login.genericError'))
    }
  }

  return (
    <section className="panel lesson-panel">
      <h2>{t('login.title')}</h2>
      <p className="dim">{t('login.guestNote')}</p>

      <div
        className="lesson-actions"
        style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}
      >
        <Link className="dash-start-btn" to="/">
          {t('login.continueGuest')}
        </Link>

        {configured ? (
          <>
            {sent ? (
              <p className="lesson-feedback lesson-feedback-ok">{t('login.magicSent')}</p>
            ) : (
              <form
                className="lesson-input-row"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (email.trim() && !busy) void submit()
                }}
              >
                <input
                  className="lesson-input"
                  type="email"
                  placeholder={t('login.emailPlaceholder')}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <button
                  type="submit"
                  className="srs-btn srs-btn-good"
                  disabled={!email.trim() || busy}
                >
                  {t('login.sendLink')}
                </button>
              </form>
            )}
            <button type="button" className="srs-btn" disabled={busy} onClick={() => void google()}>
              {t('login.google')}
            </button>
          </>
        ) : (
          <p className="dim">{t('login.notConfigured')}</p>
        )}

        {error && <p className="srs-error">{error}</p>}
      </div>
    </section>
  )
}
