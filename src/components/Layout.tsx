import { Link, NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { OnlineBadge } from './OnlineBadge'
import { BookIcon, CardsIcon, GatesIcon, GearIcon, ShieldIcon } from './icons'

const NAV = [
  { to: '/', key: 'dashboard' },
  { to: '/path', key: 'path' },
  { to: '/srs', key: 'srs' },
  { to: '/listen', key: 'listen' },
  { to: '/ranks', key: 'ranksGates' },
  { to: '/quotes', key: 'quotes' },
  { to: '/phrasebook', key: 'phrasebook' },
  { to: '/settings', key: 'settings' },
] as const

// Таб-бар <768px: 5 пунктов (specs/07 §1, решение M9#1)
const TABS = [
  { to: '/', key: 'dashboard', Icon: ShieldIcon },
  { to: '/srs', key: 'srs', Icon: CardsIcon },
  { to: '/ranks', key: 'ranks', Icon: GatesIcon },
  { to: '/phrasebook', key: 'phrasebook', Icon: BookIcon },
  { to: '/settings', key: 'settings', Icon: GearIcon },
] as const

export function Layout() {
  const { t } = useTranslation()
  return (
    <div className="app-shell">
      <header className="app-header">
        {/* лейбл — ссылка на главную (фидбей ux-feedback-3: «жму Hunter English —
            жду дашборд»); h1 не нужен: заголовок страницы рендерит каждый экран */}
        <Link className="app-title" to="/" aria-label={t('app.title')}>
          {t('app.title')}
        </Link>
        <OnlineBadge />
        <nav className="app-nav" aria-label={t('nav.label')}>
          {NAV.map((item) => (
            <NavLink key={item.key} to={item.to} end={item.to === '/'}>
              {t(`nav.${item.key}`)}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer dim">{t('app.tagline')}</footer>
      <nav className="tabbar" aria-label={t('nav.tabbarLabel')}>
        {TABS.map(({ to, key, Icon }) => (
          <NavLink key={key} to={to} end={to === '/'}>
            <Icon />
            <span>{t(`nav.${key}`)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
