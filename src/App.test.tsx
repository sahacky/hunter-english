import 'fake-indexeddb/auto'
import { ONBOARDING_KEY } from './data/onboarding'
import { render, screen } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './i18n'

beforeEach(() => {
  localStorage.setItem(ONBOARDING_KEY, '1')
})

describe('App', () => {
  it('renders dashboard (quest window loads, plan://M7#7.4)', async () => {
    render(
      <HashRouter>
        <App />
      </HashRouter>,
    )
    expect(await screen.findByText('Ежедневный квест', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(await screen.findByText(/Охотник E-ранга \(A0\)/)).toBeInTheDocument()
  })

  it('renders navigation', () => {
    render(
      <HashRouter>
        <App />
      </HashRouter>,
    )
    expect(screen.getByRole('navigation', { name: 'Основная навигация' })).toBeInTheDocument()
  })
})

// Implements: plan://M19 — App: 404-маршрут (Placeholder); KI-2026-10-01: 404 с текстом и ссылкой
describe('App: маршруты', () => {
  it('неизвестный путь → 404 с текстом и возвратом на дашборд', async () => {
    window.location.hash = '#/no-such-page'
    render(
      <HashRouter>
        <App />
      </HashRouter>,
    )
    expect(await screen.findByRole('heading', { name: '404' })).toBeInTheDocument()
    expect(screen.getByText('Такой страницы нет. Проверь адрес.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'На дашборд' })).toHaveAttribute('href', '#/')
  })
})
