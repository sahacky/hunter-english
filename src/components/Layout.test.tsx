import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { OnlineBadge, useOnlineStatus } from './OnlineBadge'
import { act } from 'react'
import '../i18n'

// Implements: plan://M9#9.2–9.3 — таб-бар из 5 пунктов (specs/07 §1) и бейдж офлайн

function renderLayout(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Layout />
    </MemoryRouter>,
  )
}

describe('Layout', () => {
  it('рендерит десктоп-навигацию (7 пунктов)', () => {
    renderLayout()
    const nav = screen.getByRole('navigation', { name: 'Основная навигация' })
    expect(nav).toBeInTheDocument()
    expect(nav.querySelectorAll('a')).toHaveLength(7)
  })

  it('рендерит таб-бар из 5 пунктов с aria-подписью', () => {
    renderLayout()
    const tabbar = screen.getByRole('navigation', { name: 'Нижняя навигация' })
    const links = [...tabbar.querySelectorAll('a')]
    expect(links).toHaveLength(5)
    // порядок пунктов: дашборд, повторение, ранги, разговорник, настройки (решение M9#1)
    expect(links[0]).toHaveTextContent('Дашборд')
    expect(links[1]).toHaveTextContent('Повторение')
    expect(links[2]).toHaveTextContent('Ранги')
    expect(links[3]).toHaveTextContent('Разговорник')
    expect(links[4]).toHaveTextContent('Настройки')
    // каждый пункт — иконка + подпись
    links.forEach((link) => {
      expect(link.querySelector('svg')).toBeInTheDocument()
      expect(link.querySelector('span')).toBeInTheDocument()
    })
  })

  it('активный пункт таб-бара помечается классом active (единственный)', () => {
    renderLayout('/srs')
    const tabbar = screen.getByRole('navigation', { name: 'Нижняя навигация' })
    const active = tabbar.querySelectorAll('a.active')
    expect(active).toHaveLength(1)
    expect(active[0]).toHaveTextContent('Повторение')
  })
})

describe('OnlineBadge / useOnlineStatus', () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine')

  function setOnLine(value: boolean) {
    Object.defineProperty(Navigator.prototype, 'onLine', {
      configurable: true,
      get: () => value,
    })
  }

  afterEach(() => {
    if (originalOnLine) Object.defineProperty(Navigator.prototype, 'onLine', originalOnLine)
  })

  it('онлайн — бейджа нет', () => {
    setOnLine(true)
    render(<OnlineBadge />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('офлайн — бейдж виден, при возврате сети исчезает', () => {
    setOnLine(false)
    render(<OnlineBadge />)
    expect(screen.getByRole('status')).toHaveTextContent('офлайн')

    act(() => {
      setOnLine(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('useOnlineStatus реагирует на события online/offline', () => {
    let latest: boolean | undefined
    function Probe() {
      latest = useOnlineStatus()
      return null
    }
    setOnLine(true)
    render(<Probe />)
    expect(latest).toBe(true)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(latest).toBe(false)
  })
})
