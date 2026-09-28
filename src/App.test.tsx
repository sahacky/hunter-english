import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './i18n'

describe('App', () => {
  it('renders dashboard (quest window loads, plan://M7#7.4)', async () => {
    render(
      <HashRouter>
        <App />
      </HashRouter>,
    )
    expect(await screen.findByText('[Ежедневный квест]', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(await screen.findByText(/Охотник E-ранга/)).toBeInTheDocument()
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
