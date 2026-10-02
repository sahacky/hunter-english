// Implements: plan://ux-feedback-2#U.3 — страница-знакомства /#/intro
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import '../i18n'
import IntroScreen from './IntroScreen'
import { ONBOARDING_KEY } from '../data/onboarding'

beforeEach(() => {
  localStorage.removeItem(ONBOARDING_KEY)
  window.location.hash = '#/intro'
})

describe('IntroScreen', () => {
  it('новичок: лор и суть приложения + кнопка «Начать» ведёт в welcome', async () => {
    render(
      <HashRouter>
        <IntroScreen />
      </HashRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Hunter English' })).toBeInTheDocument()
    // три блока: что это / лор / как идут дни
    expect(screen.getByRole('heading', { name: 'Что это' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Лор' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Как идут дни' })).toBeInTheDocument()
    expect(screen.getByText(/Ты — Охотник, а это — Система/)).toBeInTheDocument()
    expect(screen.getByText(/ранг поднимают только Врата/)).toBeInTheDocument()
    // иллюстрация на месте (SVG с меткой)
    expect(screen.getByRole('img', { name: 'Hunter English' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Начать/ }))
    await waitFor(() => expect(window.location.hash).toBe('#/welcome'))
  })

  it('уже онбордился — редирект на дашборд, страницу не показываем', async () => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    render(
      <HashRouter>
        <IntroScreen />
      </HashRouter>,
    )
    await waitFor(() => expect(window.location.hash).toBe('#/'))
    expect(screen.queryByRole('heading', { name: 'Лор' })).not.toBeInTheDocument()
  })

  it('размонтирование до завершения init-эффекта — живой гвард, без обновления состояния', async () => {
    const { unmount } = render(
      <HashRouter>
        <IntroScreen />
      </HashRouter>,
    )
    unmount() // isOnboarded ещё в микротаске — эффект обязан выйти молча
    await Promise.resolve()
    expect(window.location.hash).toBe('#/intro') // navigate не вызывался
  })
})
