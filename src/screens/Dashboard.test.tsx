// Implements: plan://M19 — Dashboard/RanksScreen error-фазы и дашборд-детали
import 'fake-indexeddb/auto'
import { ONBOARDING_KEY } from '../data/onboarding'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import '../i18n'
import { HunterDb } from '../data/db'
import { DexieProgressRepository } from '../data/progress-repository'
import { uuidv7 } from '../lib/uuidv7'
import Dashboard from './Dashboard'
import RanksScreen from './RanksScreen'
import type { ProgressRepository } from '../domain/progress'

// флаг тестов «нет готовых цитат»: loadQuotes отдаёт пустой список (дефолт — реальные данные)
const lessonsMock = vi.hoisted(() => ({ noQuotes: false }))
vi.mock('../content/lessons', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../content/lessons')>()
  return {
    ...actual,
    loadQuotes: async () => (lessonsMock.noQuotes ? [] : actual.loadQuotes()),
  }
})

let db: HunterDb
let repo: DexieProgressRepository

beforeEach(() => {
  localStorage.setItem(ONBOARDING_KEY, '1')
  db = new HunterDb(`hunter-dash-test-${uuidv7()}`)
  repo = new DexieProgressRepository(db)
})

// прототипная делегация (spread ломает this у Dexie-методов — M19)
const failingStats = (): ProgressRepository => {
  const failing: ProgressRepository = Object.create(repo)
  failing.getStats = async () => {
    throw new Error('stats broken')
  }
  return failing
}

describe('Dashboard', () => {
  it('ошибка загрузки статов → error-фаза', async () => {
    window.location.hash = '#/'
    render(
      <HashRouter>
        <Dashboard repo={failingStats()} />
      </HashRouter>,
    )
    expect(await screen.findByText(/Не удалось загрузить|ошибк/i)).toBeInTheDocument()
  })

  it('квест-окно, цитата дня и «Начать день» с чистой базой', async () => {
    window.location.hash = '#/'
    render(
      <HashRouter>
        <Dashboard repo={repo} />
      </HashRouter>,
    )
    expect(await screen.findByText('[Ежедневный квест]', {}, { timeout: 5000 })).toBeInTheDocument()
    // дашборд ведёт в повторение/урок
    expect(screen.getByRole('link', { name: /Начать день|Повторение|Урок/ })).toBeTruthy()
  })

  // Веха S4 (M21#21.4): цитаты не готовы, unmount в загрузке, минутный таймер
  it('цитаты не готовы (пустой список) → секция «Цитата дня» не показывается', async () => {
    lessonsMock.noQuotes = true
    try {
      render(
        <HashRouter>
          <Dashboard repo={repo} />
        </HashRouter>,
      )
      expect(
        await screen.findByText('[Ежедневный квест]', {}, { timeout: 5000 }),
      ).toBeInTheDocument()
      expect(screen.queryByText('[Цитата дня]')).not.toBeInTheDocument()
    } finally {
      lessonsMock.noQuotes = false
    }
  })

  it('unmount во время загрузки уроков — setData не выполняется, без ошибки', async () => {
    const lessonCalls: string[] = []
    // прототипная делегация (spread ломает this у Dexie-методов — M19)
    const slow: ProgressRepository = Object.create(repo)
    slow.getLessonProgress = async (lessonId: string) => {
      lessonCalls.push(lessonId)
      await new Promise((resolve) => setTimeout(resolve, 60))
      return repo.getLessonProgress(lessonId)
    }
    const { unmount } = render(
      <HashRouter>
        <Dashboard repo={slow} />
      </HashRouter>,
    )
    expect(await screen.findByText('Загрузка…')).toBeInTheDocument()
    // ждём начала цикла уроков (Promise.all уже разрешён) — окно для unmount
    await waitFor(() => expect(lessonCalls.length).toBeGreaterThan(0), { timeout: 5000 })
    unmount()
    // даём дозреть асинхронной загрузке: alive=false — ветка `if (!alive)` срабатывает
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(screen.queryByText('[Ежедневный квест]')).not.toBeInTheDocument()
  })

  it('таймер до конца дня обновляется раз в минуту (интервал жив)', async () => {
    vi.useFakeTimers()
    try {
      render(
        <HashRouter>
          <Dashboard repo={repo} />
        </HashRouter>,
      )
      // find* на фейковых таймерах не поллит — крутим часы до загрузки данных;
      // запас 800×100мс: под нагрузкой CI-раннера загрузка идёт дольше (прецедент M17)
      for (let i = 0; i < 800 && !screen.queryByText('[Ежедневный квест]'); i += 1) {
        await vi.advanceTimersByTimeAsync(100)
      }
      expect(screen.queryByText('[Ежедневный квест]')).toBeInTheDocument()
      expect(screen.getByText(/до конца дня/)).toBeInTheDocument()
      // тик минутного интервала — setTimer выполняется без сбоев
      await vi.advanceTimersByTimeAsync(60_000)
      expect(screen.getByText(/до конца дня/)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
  it('первый вход без онбординга — редирект на /#/welcome (plan://onboarding#O.4)', async () => {
    localStorage.removeItem(ONBOARDING_KEY)
    window.location.hash = '#/'
    render(
      <HashRouter>
        <Dashboard repo={repo} />
      </HashRouter>,
    )
    await waitFor(() => expect(window.location.hash).toBe('#/welcome'), { timeout: 8000 })
  })
})

describe('RanksScreen', () => {
  it('ошибка загрузки статов → error-фаза', async () => {
    window.location.hash = '#/ranks'
    render(
      <HashRouter>
        <RanksScreen repo={failingStats()} />
      </HashRouter>,
    )
    expect(await screen.findByText(/Не удалось загрузить|ошибк/i)).toBeInTheDocument()
  })
})
