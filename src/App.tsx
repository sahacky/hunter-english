import { Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Layout } from './components/Layout'
import { ToastHost } from './components/ToastHost'
import { SettingsProvider } from './state/settings'
import { AuthProvider } from './state/auth'
import Dashboard from './screens/Dashboard'
import IntroScreen from './screens/IntroScreen'
import WelcomeScreen from './screens/WelcomeScreen'
import PathScreen from './screens/PathScreen'
import GatesScreen from './screens/GatesScreen'
import LessonScreen from './screens/LessonScreen'
import PhrasebookScreen, { PhrasebookSituationScreen } from './screens/PhrasebookScreen'
import RanksScreen from './screens/RanksScreen'
import SettingsScreen from './screens/SettingsScreen'
import SrsScreen from './screens/SrsScreen'
import LoginScreen from './screens/LoginScreen'
import QuotesScreen, { QuoteScreen } from './screens/QuotesScreen'

function Placeholder() {
  const { t } = useTranslation()
  return (
    <section className="panel">
      <h2>{t('notFound.title')}</h2>
      <p className="dim">{t('notFound.text')}</p>
      <p className="dim">
        <a href="#/">{t('common.backToDashboard')}</a>
      </p>
    </section>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="intro" element={<IntroScreen />} />
            <Route path="welcome" element={<WelcomeScreen />} />
            <Route path="path" element={<PathScreen />} />
            <Route path="lesson/:id" element={<LessonScreen />} />
            <Route path="srs" element={<SrsScreen />} />
            <Route path="ranks" element={<RanksScreen />} />
            <Route path="gates/:id?" element={<GatesScreen />} />
            <Route path="quotes" element={<QuotesScreen />} />
            <Route path="quotes/:id" element={<QuoteScreen />} />
            <Route path="phrasebook" element={<PhrasebookScreen />} />
            <Route path="phrasebook/:situation" element={<PhrasebookSituationScreen />} />
            <Route path="settings" element={<SettingsScreen />} />
            <Route path="login" element={<LoginScreen />} />
            <Route path="*" element={<Placeholder />} />
          </Route>
        </Routes>
        <ToastHost />
      </AuthProvider>
    </SettingsProvider>
  )
}
