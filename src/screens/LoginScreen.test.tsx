// Implements: план M21#21.4 (веха S4) — ветка ошибки magic link (LoginScreen:22)
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import '../i18n'
import LoginScreen from './LoginScreen'

const sendMagicLink = vi.fn(async () => ({ ok: false, error: 'magic failed' }))
vi.mock('../state/auth', () => ({
  useAuth: () => ({
    configured: true,
    userId: null,
    email: null,
    guest: true,
    sendMagicLink,
    signInWithGoogle: vi.fn(async () => ({ ok: false })),
    signOut: vi.fn(async () => undefined),
  }),
}))

describe('LoginScreen /#/login', () => {
  it('ошибка magic link → текст ошибки в UI, повторная отправка возможна', async () => {
    window.location.hash = '#/login'
    render(
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
        </Routes>
      </HashRouter>,
    )
    const input = document.querySelector('input[type=email]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'a@b.c' } })
    fireEvent.submit(input.closest('form')!)
    expect(await screen.findByText(/magic failed/)).toBeInTheDocument()
    expect(sendMagicLink).toHaveBeenCalledWith('a@b.c')
    expect(input).toBeEnabled()
  })
})
