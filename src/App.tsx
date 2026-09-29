import { Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Layout } from './components/Layout'
import { ToastHost } from './components/ToastHost'
import { SettingsProvider } from './state/settings'
import Dashboard from './screens/Dashboard'
import GatesScreen from './screens/GatesScreen'
import LessonScreen from './screens/LessonScreen'
import PhrasebookScreen, { PhrasebookSituationScreen } from './screens/PhrasebookScreen'
import RanksScreen from './screens/RanksScreen'
import SettingsScreen from './screens/SettingsScreen'
import SrsScreen from './screens/SrsScreen'

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
  return (
    <SettingsProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="lesson/:id" element={<LessonScreen />} />
          <Route path="srs" element={<SrsScreen />} />
          <Route path="ranks" element={<RanksScreen />} />
          <Route path="gates/:id?" element={<GatesScreen />} />
          <Route path="quotes" element={<Placeholder page="quotes" />} />
          <Route path="phrasebook" element={<PhrasebookScreen />} />
          <Route path="phrasebook/:situation" element={<PhrasebookSituationScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="*" element={<Placeholder page="notFound" />} />
        </Route>
      </Routes>
      <ToastHost />
    </SettingsProvider>
  )
}
