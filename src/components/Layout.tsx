import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const NAV = [
  { to: '/', key: 'dashboard' },
  { to: '/srs', key: 'srs' },
  { to: '/ranks', key: 'ranks' },
  { to: '/gates', key: 'gates' },
  { to: '/quotes', key: 'quotes' },
  { to: '/phrasebook', key: 'phrasebook' },
  { to: '/settings', key: 'settings' },
] as const

export function Layout() {
  const { t } = useTranslation()
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-title">{t('app.title')}</span>
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
    </div>
  )
}
