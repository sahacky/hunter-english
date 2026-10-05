// Implements: plan://ux-feedback-2#U.3 — страница-знакомства /#/intro: что за
// приложение, зачем и какой лор — кратко и понятно, до «Регистрации Охотника».
// Показывается только новичкам (флаг онбординга); «Начать» ведёт в welcome.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { isOnboarded } from '../data/onboarding'

/** SVG-иллюстрация в стиле Daylight: портал-Врата и путь рангов E→S (без внешних картинок — авторские права). */
function IntroArt() {
  return (
    <svg
      className="intro-art"
      viewBox="0 0 320 150"
      role="img"
      aria-label="Hunter English"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="intro-portal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--primary)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      {/* портал */}
      <path
        d="M60 130 V70 A50 50 0 0 1 160 70 V130"
        fill="none"
        stroke="var(--track)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path d="M60 130 V70 A50 50 0 0 1 160 70 V130" fill="url(#intro-portal)" opacity="0.5" />
      {/* ступени к порталу */}
      <line
        x1="48"
        y1="140"
        x2="172"
        y2="140"
        stroke="var(--track)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* путь рангов */}
      <polyline
        points="180,120 205,95 235,95 265,65 295,65"
        fill="none"
        stroke="var(--track)"
        strokeWidth="3"
        strokeDasharray="1 7"
        strokeLinecap="round"
      />
      {/* чипы рангов E→S */}
      {[
        [180, 120, 'E'],
        [205, 95, 'D'],
        [235, 95, 'C'],
        [265, 65, 'B'],
        [295, 65, 'A'],
      ].map(([cx, cy, label]) => (
        <g key={label as string}>
          <circle
            cx={cx as number}
            cy={cy as number}
            r="11"
            fill="var(--surface-2)"
            stroke="var(--primary)"
            strokeWidth="2"
          />
          <text
            x={cx as number}
            y={(cy as number) + 4}
            textAnchor="middle"
            fontSize="11"
            fontWeight="800"
            fill="var(--text)"
          >
            {label as string}
          </text>
        </g>
      ))}
      {/* S — над порталом смысла нет: вершина пути */}
      <g>
        <circle cx="295" cy="30" r="13" fill="var(--primary)" />
        <text
          x="295"
          y="35"
          textAnchor="middle"
          fontSize="12"
          fontWeight="800"
          fill="var(--on-primary)"
        >
          S
        </text>
      </g>
      {/* путешественник: чемодан у ступеней */}
      <g stroke="var(--text-dim)" strokeWidth="3" fill="none" strokeLinecap="round">
        <rect x="196" y="126" width="26" height="18" rx="5" fill="var(--surface-2)" />
        <path d="M204 126 v-5 a5 5 0 0 1 10 0 v5" />
      </g>
    </svg>
  )
}

export default function IntroScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<'checking' | 'show' | 'skip'>('checking')

  useEffect(() => {
    let alive = true
    void (async () => {
      const done = await isOnboarded()
      if (!alive) return
      setPhase(done ? 'skip' : 'show')
    })()
    return () => {
      alive = false
    }
  }, [])

  if (phase === 'checking') {
    return (
      <section className="panel">
        <p className="dim">{t('common.loading')}</p>
      </section>
    )
  }
  if (phase === 'skip') {
    navigate('/', { replace: true }) // уже знаком с Системой — сразу на дашборд
    return null
  }
  return (
    <section className="panel lesson-panel intro-panel landing-panel">
      <IntroArt />
      <h2>{t('intro.title')}</h2>
      <p className="dim">{t('intro.subtitle')}</p>

      <h3>{t('intro.whatTitle')}</h3>
      <p className="dim">{t('intro.whatText')}</p>

      <h3>{t('intro.loreTitle')}</h3>
      <p className="dim">{t('intro.loreText')}</p>

      <h3>{t('intro.dayTitle')}</h3>
      <p className="dim">{t('intro.dayText')}</p>

      <div className="lesson-actions">
        <button type="button" className="srs-btn srs-btn-good" onClick={() => navigate('/welcome')}>
          {t('intro.start')} ▶
        </button>
      </div>
    </section>
  )
}
