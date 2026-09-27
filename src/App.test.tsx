import { render, screen } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './i18n'

describe('App', () => {
  it('renders dashboard greeting', () => {
    render(
      <HashRouter>
        <App />
      </HashRouter>,
    )
    expect(screen.getByText('Добро пожаловать, Охотник')).toBeInTheDocument()
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
