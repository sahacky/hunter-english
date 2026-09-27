import { Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Layout } from './components/Layout'

function Placeholder({ page }: { page: string }) {
  const { t } = useTranslation()
  return (
    <section className="panel">
      <h2>{t(`nav.${page}`)}</h2>
      <p className="dim">{t('common.inDevelopment')}</p>
    </section>
  )
}

export default function App() {
  const { t } = useTranslation()
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          index
          element={
            <section className="panel">
              <h2>{t('dashboard.greeting')}</h2>
              <p className="dim">{t('common.inDevelopment')}</p>
            </section>
          }
        />
        <Route path="lesson/:id" element={<Placeholder page="lesson" />} />
        <Route path="srs" element={<Placeholder page="srs" />} />
        <Route path="ranks" element={<Placeholder page="ranks" />} />
        <Route path="gates/:id?" element={<Placeholder page="gates" />} />
        <Route path="quotes" element={<Placeholder page="quotes" />} />
        <Route path="phrasebook" element={<Placeholder page="phrasebook" />} />
        <Route path="settings" element={<Placeholder page="settings" />} />
        <Route path="*" element={<Placeholder page="notFound" />} />
      </Route>
    </Routes>
  )
}
