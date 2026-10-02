// Implements: plan://curriculum-review#I.1 — bootstrap счётчика аудирования в App:
// sink из шлюза озвучки пишет секунды в квест дня (глобальная Dexie-база)
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import './i18n'
import App from './App'
import { db, getCurrentUserId } from './data/db'
import { dayStart } from './domain/srs/scheduler'

// перехват регистрации sink'а: App вызывает setListenSink на монтировании
const registered = vi.hoisted(() => ({ sinks: [] as ((seconds: number) => void)[] }))
vi.mock('./lib/tts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/tts')>()
  return {
    ...actual,
    setListenSink: (sink: ((seconds: number) => void) | null) => {
      if (sink) registered.sinks.push(sink)
    },
  }
})

interface QuestDataRow {
  data: { slots: { listening: { done: number } } }
}

beforeEach(() => {
  window.location.hash = '#/'
  registered.sinks.length = 0
})

describe('App: sink аудирования (plan://curriculum-review#I.1)', () => {
  it(
    'mount регистрирует sink; прослушанные секунды попадают в квест дня',
    { timeout: 30_000 },
    async () => {
      render(
        <HashRouter>
          <App />
        </HashRouter>,
      )
      await waitFor(() => expect(registered.sinks.length).toBe(1), { timeout: 8000 })
      registered.sinks[0]!(42)
      await waitFor(
        async () => {
          const dayIso = dayStart(new Date()).toISOString()
          const row = (await db.item_progress.get([
            getCurrentUserId(),
            dayIso,
            'quest_day',
          ])) as unknown as QuestDataRow | undefined
          expect(row?.data.slots.listening.done).toBeGreaterThanOrEqual(42)
        },
        { timeout: 8000 },
      )
    },
  )

  it('неизвестный маршрут — 404-страница с возвратом на дашборд', { timeout: 30_000 }, async () => {
    window.location.hash = '#/no-such-place'
    render(
      <HashRouter>
        <App />
      </HashRouter>,
    )
    expect(
      await screen.findByText('Такой страницы нет. Проверь адрес.', {}, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(screen.getByText('На дашборд')).toBeInTheDocument()
  })
})
