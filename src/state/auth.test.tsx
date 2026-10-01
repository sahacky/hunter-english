// Implements: plan://M19 — покрытие auth-провайдера, supabase-гейта и экрана входа
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { useState } from 'react'
import '../i18n'

const supabaseMock = vi.hoisted(() => {
  const listeners: ((event: string) => void)[] = []
  return {
    configured: false,
    session: { user: null as { id: string; email: string } | null },
    otpError: null as string | null,
    oauthError: null as string | null,
    throwOnSession: false,
    auth: {
      onAuthStateChange: (cb: (event: string) => void) => {
        listeners.push(cb)
        return { data: { subscription: { unsubscribe: () => undefined } } }
      },
      getSession: async () => {
        // флаг включает реальный отказ сессии: catch-ветка провайдера (S4)
        if (supabaseMock.throwOnSession) throw new Error('session broken')
        return {
          data: {
            session: supabaseMock.session.user
              ? {
                  user: supabaseMock.session.user,
                }
              : null,
          },
        }
      },
      signInWithOtp: vi.fn(async () => ({
        error: supabaseMock.otpError ? { message: supabaseMock.otpError } : null,
      })),
      signInWithOAuth: vi.fn(async () => ({
        error: supabaseMock.oauthError ? { message: supabaseMock.oauthError } : null,
      })),
      signOut: vi.fn(async () => undefined),
    },
    emit: (event: string) => listeners.forEach((cb) => cb(event)),
  }
})

vi.mock('../data/supabase', () => ({
  isSyncConfigured: () => supabaseMock.configured,
  getSupabase: async () => supabaseMock,
}))

const dbMock = vi.hoisted(() => ({
  current: 'local',
  remap: vi.fn(async () => undefined),
  enqueueAll: vi.fn(async () => undefined),
}))
vi.mock('../data/db', () => ({
  db: { name: 'auth-test-db' },
  getCurrentUserId: () => dbMock.current,
  setCurrentUserId: (id: string) => {
    dbMock.current = id
  },
  remapLocalToUser: dbMock.remap,
}))
vi.mock('../data/sync', () => ({
  enqueueAllRows: dbMock.enqueueAll,
  syncNow: vi.fn(async () => undefined),
  trimQueue: vi.fn(async () => 0),
}))

import { AuthProvider, useAuth } from './auth'
import LoginScreen from '../screens/LoginScreen'

function Probe() {
  const auth = useAuth()
  const [magic, setMagic] = useState('')
  return (
    <div>
      <span data-testid="guest">{String(auth.guest)}</span>
      <span data-testid="email">{auth.email ?? 'none'}</span>
      <button
        type="button"
        onClick={() =>
          void auth.sendMagicLink('a@b.c').then((r) => setMagic(r.error ?? `ok:${r.ok}`))
        }
      >
        magic
      </button>
      <button
        type="button"
        onClick={() => void auth.signInWithGoogle().then((r) => setMagic(r.error ?? 'ok'))}
      >
        google
      </button>
      <button type="button" onClick={() => void auth.signOut()}>
        out
      </button>
      <span data-testid="magic">{magic}</span>
      {/* email≠null включает фоновые триггеры */}
      <span data-testid="u">{auth.userId ?? 'null'}</span>
    </div>
  )
}

beforeEach(() => {
  supabaseMock.configured = false
  supabaseMock.session.user = null
  supabaseMock.otpError = null
  supabaseMock.oauthError = null
  supabaseMock.throwOnSession = false
  dbMock.current = 'local'
  dbMock.remap.mockClear()
  dbMock.enqueueAll.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AuthProvider', () => {
  it('без env: гость сразу, sendMagicLink/Google отказывают', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    expect(await screen.findByTestId('guest')).toHaveTextContent('true')
    fireEvent.click(screen.getByText('magic'))
    await waitFor(() =>
      expect(screen.getByTestId('magic')).toHaveTextContent('supabase-not-configured'),
    )
    fireEvent.click(screen.getByText('google'))
    await waitFor(() =>
      expect(screen.getByTestId('magic')).toHaveTextContent('supabase-not-configured'),
    )
  })

  it('configured + сессия: перенос гостя (remap + enqueueAllRows + sync), email в состоянии', async () => {
    supabaseMock.configured = true
    supabaseMock.session.user = { id: 'uid-1', email: 'a@b.c' }
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('a@b.c'))
    expect(dbMock.remap).toHaveBeenCalledWith(expect.anything(), 'uid-1')
    expect(dbMock.enqueueAll).toHaveBeenCalledTimes(1) // был гость
    expect(dbMock.current).toBe('uid-1')
  })

  it('configured без сессии: гость; getSession падает → fallback-гость', async () => {
    supabaseMock.configured = true
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('guest')).toHaveTextContent('true'))

    supabaseMock.throwOnSession = true
    const { unmount } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getAllByTestId('guest').at(-1)).toHaveTextContent('true'))
    unmount()
  })

  it('SIGNED_OUT: локальный пользователь + reload', async () => {
    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', {
      value: { ...original, reload },
      writable: true,
      configurable: true,
    })
    try {
      supabaseMock.configured = true
      render(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      )
      await waitFor(() => expect(screen.getByTestId('guest')).toHaveTextContent('true'))
      dbMock.current = 'uid-9'
      supabaseMock.emit('SIGNED_OUT')
      await waitFor(() => expect(dbMock.current).toBe('local'))
      expect(reload).toHaveBeenCalled()
    } finally {
      Object.defineProperty(window, 'location', {
        value: original,
        writable: true,
        configurable: true,
      })
    }
  })

  it('magic link: успех и ошибка; google: ошибка; signOut зовёт клиента', async () => {
    supabaseMock.configured = true
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('guest')).toHaveTextContent('true'))
    fireEvent.click(screen.getByText('magic'))
    await waitFor(() => expect(screen.getByTestId('magic')).toHaveTextContent(''))
    supabaseMock.otpError = 'quota'
    fireEvent.click(screen.getByText('magic'))
    await waitFor(() => expect(screen.getByTestId('magic')).toHaveTextContent('quota'))
    supabaseMock.oauthError = 'popup blocked'
    fireEvent.click(screen.getByText('google'))
    await waitFor(() => expect(screen.getByTestId('magic')).toHaveTextContent('popup blocked'))
    fireEvent.click(screen.getByText('out'))
    await waitFor(() => expect(supabaseMock.auth.signOut).toHaveBeenCalled())
  })

  it('фоновый триггер online: syncNow при вошедшем пользователе', async () => {
    const { syncNow } = await import('../data/sync')
    supabaseMock.configured = true
    supabaseMock.session.user = { id: 'uid-2', email: 'x@y.z' }
    const onlineHandler = new Promise<void>((resolve) => {
      window.addEventListener('online', () => resolve(), { once: true })
    })
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('x@y.z'))
    window.dispatchEvent(new Event('online'))
    await onlineHandler
    await waitFor(() => expect(syncNow).toHaveBeenCalled())
  })

  // Веха S4 (M21#21.4): дефолтный контекст, ранний выход, фоновые триггеры при ошибке синка
  it('useAuth без провайдера: дефолтные magic/google/signOut работают и отказывают', async () => {
    render(<Probe />)
    expect(await screen.findByTestId('guest')).toHaveTextContent('true')
    fireEvent.click(screen.getByText('magic'))
    await waitFor(() => expect(screen.getByTestId('magic')).toHaveTextContent('ok:false'))
    fireEvent.click(screen.getByText('google'))
    await waitFor(() => expect(screen.getByTestId('magic')).toHaveTextContent('ok'))
    fireEvent.click(screen.getByText('out')) // дефолтный signOut — разрешается без действий
  })

  it('signOut без настроенного окружения — ранний return, клиент не зовётся', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('guest')).toHaveTextContent('true'))
    fireEvent.click(screen.getByText('out'))
    await waitFor(() => expect(screen.getByTestId('u')).toHaveTextContent('local'))
    expect(supabaseMock.auth.signOut).not.toHaveBeenCalled()
  })

  it('фоновые триггеры (online + 5-мин интервал) и activateUser глотают ошибку syncNow', async () => {
    const { syncNow } = await import('../data/sync')
    vi.useFakeTimers()
    try {
      supabaseMock.configured = true
      supabaseMock.session.user = { id: 'uid-3', email: 'i@o.p' }
      vi.mocked(syncNow).mockRejectedValue(new Error('offline'))
      render(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      )
      // activateUser: remap → enqueueAll → syncNow (reject поглощается catch-веткой);
      // async-цепочка обновляет state вне рендера — под React 19 флаш только в act
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(screen.getByTestId('email')).toHaveTextContent('i@o.p')
      // online-триггер: syncNow падает — onOnline глотает
      window.dispatchEvent(new Event('online'))
      // 5-минутный интервал: syncNow падает — catch глотает
      await vi.advanceTimersByTimeAsync(5 * 60_000)
      // activateUser + online + интервал
      expect(vi.mocked(syncNow).mock.calls.length).toBeGreaterThanOrEqual(3)
    } finally {
      vi.useRealTimers()
      vi.mocked(syncNow).mockImplementation(async () => undefined)
    }
  })
})

describe('LoginScreen', () => {
  function renderLogin() {
    window.location.hash = '#/login'
    return render(
      <AuthProvider>
        <HashRouter>
          <LoginScreen />
        </HashRouter>
      </AuthProvider>,
    )
  }

  it('без env: гостевая кнопка, форма не настроена', async () => {
    renderLogin()
    expect(await screen.findByRole('heading', { name: 'Вход' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /гость/i })).toHaveAttribute('href', '#/')
    expect(screen.getByText(/Синхронизация не настроена/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Google/ })).not.toBeInTheDocument()
  })

  it('configured: magic link отправлен / ошибка; Google-ошибка', async () => {
    supabaseMock.configured = true
    renderLogin()
    const emailInput = await screen.findByRole('textbox', { name: '' })
    fireEvent.change(emailInput, { target: { value: 'a@b.c' } })
    fireEvent.click(screen.getByRole('button', { name: /Отправить ссылку/ }))
    expect(await screen.findByText(/Письмо отправлено/)).toBeInTheDocument()

    supabaseMock.oauthError = 'blocked'
    fireEvent.click(screen.getByRole('button', { name: /Google/ }))
    expect(await screen.findByText('blocked')).toBeInTheDocument()
  })
})
