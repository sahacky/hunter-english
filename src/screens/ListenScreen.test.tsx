// Implements: plan://curriculum-review#I.2 — экран input-трека /#/listen
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import '../i18n'
import ListenScreen from './ListenScreen'
import { HunterDb } from '../data/db'
import { DexieProgressRepository } from '../data/progress-repository'
import { uuidv7 } from '../lib/uuidv7'
import { dayStart } from '../domain/srs/scheduler'
import { createQuestDay } from '../domain/game/game'
import { addListeningSeconds } from '../data/listening'
import { currentAudio } from '../lib/tts'

vi.mock('../lib/tts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/tts')>()
  return {
    ...actual,
    speak: vi.fn(() => true),
    stopSpeak: vi.fn(),
    currentAudio: vi.fn(() => null),
  }
})
import { speak } from '../lib/tts'

// флаг «контент сломан» для теста error-фазы (loadQuotes → reject)
const contentBroken = vi.hoisted(() => ({ broken: false }))
vi.mock('../content/lessons', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../content/lessons')>()
  return {
    ...actual,
    loadQuotes: async () => {
      if (contentBroken.broken) throw new Error('data')
      return actual.loadQuotes()
    },
  }
})

let repo: DexieProgressRepository

beforeEach(() => {
  vi.clearAllMocks()
  repo = new DexieProgressRepository(new HunterDb(`hunter-screen-listen-${uuidv7()}`))
  window.location.hash = '#/listen'
})

function renderListen() {
  return render(
    <HashRouter>
      <ListenScreen repo={repo} />
    </HashRouter>,
  )
}

describe('ListenScreen', () => {
  it('счётчик дня + подборка понятых цитат (top1000 ≥ 0.9) с кнопками озвучки', async () => {
    const now = new Date('2026-03-01T10:00:00Z')
    vi.setSystemTime(now)
    try {
      await addListeningSeconds(repo, 125, now) // 2 мин
      renderListen()
      expect(
        await screen.findByText(/Сегодня: 2 \/ 20 мин/, {}, { timeout: 8000 }),
      ).toBeInTheDocument()
      expect(screen.getByText(/\d+ понятых цитат/)).toBeInTheDocument()
      // у каждой цитаты — 🔊 и 🐢
      const rows = screen.getAllByRole('listitem')
      expect(rows.length).toBeGreaterThan(0)
      const fast = screen.getAllByRole('button', { name: '🔊' })
      expect(fast.length).toBe(rows.length)
      fireEvent.click(fast[0]!)
      expect(speak).toHaveBeenCalled()
      fireEvent.click(screen.getAllByRole('button', { name: '🐢' })[0]!)
      expect(speak).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('ручная отметка «вне приложения» добивает счётчик до цели', async () => {
    renderListen()
    expect(
      await screen.findByText(/Сегодня: 0 \/ 20 мин/, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /вне приложения/ }))
    await waitFor(() => expect(screen.getByText(/Сегодня: 20 \/ 20 мин/)).toBeInTheDocument(), {
      timeout: 8000,
    })
  })

  it('«Играть всё» запускает плейлист, «Стоп» останавливает', async () => {
    renderListen()
    const playAll = await screen.findByRole('button', { name: /Играть всё/ }, { timeout: 8000 })
    fireEvent.click(playAll)
    const stop = await screen.findByRole('button', { name: /Стоп/ })
    expect(speak).toHaveBeenCalled()
    fireEvent.click(stop)
    expect(await screen.findByRole('button', { name: /Играть всё/ })).toBeInTheDocument()
  })

  it('плейлист с audio-элементом: ended переводит на следующую цитату; после Стопа — guard', async () => {
    let endedListener: (() => void) | undefined
    const fakeEl = {
      addEventListener: (_type: string, listener: () => void) => {
        endedListener = listener
      },
    }
    vi.mocked(currentAudio).mockReturnValue(fakeEl as unknown as HTMLAudioElement)
    renderListen()
    fireEvent.click(await screen.findByRole('button', { name: /Играть всё/ }, { timeout: 8000 }))
    await screen.findByRole('button', { name: /Стоп/ })
    const callsAfterFirst = vi.mocked(speak).mock.calls.length
    endedListener?.()
    await Promise.resolve()
    expect(vi.mocked(speak).mock.calls.length).toBe(callsAfterFirst + 1) // вторая цитата
    // Стоп → поздний ended ничего не запускает (guard плейлиста)
    fireEvent.click(screen.getByRole('button', { name: /Стоп/ }))
    const before = vi.mocked(speak).mock.calls.length
    endedListener?.()
    await Promise.resolve()
    expect(vi.mocked(speak).mock.calls.length).toBe(before)
  })

  it('событие focus окна обновляет счётчик дня', async () => {
    renderListen()
    expect(
      await screen.findByText(/Сегодня: 0 \/ 20 мин/, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
    await addListeningSeconds(repo, 90)
    fireEvent(window, new Event('focus'))
    await waitFor(() => expect(screen.getByText(/Сегодня: 1 \/ 20 мин/)).toBeInTheDocument(), {
      timeout: 8000,
    })
  })

  it('размонтирование до загрузки — живой гвард, без обновления состояния', async () => {
    const { unmount } = renderListen()
    unmount()
    await Promise.resolve()
    expect(window.location.hash).toBe('#/listen')
  })

  it('ошибка загрузки цитат — панель ошибки', async () => {
    contentBroken.broken = true
    try {
      renderListen()
      expect(
        await screen.findByText(/Не удалось загрузить/i, {}, { timeout: 8000 }),
      ).toBeInTheDocument()
    } finally {
      contentBroken.broken = false
    }
  })

  it('существующая запись дня без слота listening не ломает экран', async () => {
    const dayIso = dayStart(new Date()).toISOString()
    const legacy = createQuestDay(dayIso, 7)
    await repo.putQuestDay({
      ...legacy,
      slots: { ...legacy.slots, listening: undefined },
    } as never)
    renderListen()
    expect(
      await screen.findByText(/Сегодня: 0 \/ 20 мин/, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })
})
