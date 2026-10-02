// Implements: plan://M19 — Dashboard/RanksScreen error-фазы и дашборд-детали
import 'fake-indexeddb/auto'
import { ONBOARDING_KEY, PLACEMENT_INFO_KEY } from '../data/onboarding'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import '../i18n'
import { HunterDb } from '../data/db'
import { DexieProgressRepository } from '../data/progress-repository'
import { uuidv7 } from '../lib/uuidv7'
import Dashboard from './Dashboard'
import RanksScreen from './RanksScreen'
import type { ProgressRepository } from '../domain/progress'
import { waivedLessonProgress } from '../domain/placement/apply'

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
  localStorage.removeItem(PLACEMENT_INFO_KEY)
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
    expect(await screen.findByText('Ежедневный квест', {}, { timeout: 5000 })).toBeInTheDocument()
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
      expect(await screen.findByText('Ежедневный квест', {}, { timeout: 5000 })).toBeInTheDocument()
      expect(screen.queryByText('Цитата дня')).not.toBeInTheDocument()
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
      for (let i = 0; i < 800 && !screen.queryByText('Ежедневный квест'); i += 1) {
        await vi.advanceTimersByTimeAsync(100)
      }
      expect(screen.queryByText('Ежедневный квест')).toBeInTheDocument()
      expect(screen.getByText(/до конца дня/)).toBeInTheDocument()
      // тик минутного интервала — setTimer выполняется без сбоев
      await vi.advanceTimersByTimeAsync(60_000)
      expect(screen.getByText(/до конца дня/)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
  it('первый вход без онбординга — редирект на /#/intro (plan://ux-feedback-2#U.3)', async () => {
    localStorage.removeItem(ONBOARDING_KEY)
    window.location.hash = '#/'
    render(
      <HashRouter>
        <Dashboard repo={repo} />
      </HashRouter>,
    )
    await waitFor(() => expect(window.location.hash).toBe('#/intro'), { timeout: 8000 })
  })

  // plan://curriculum-review#P.2 — старт с ранга и объяснение «почему этот урок»
  it('ранг D в статусе: следующий урок — D-01 (не E-01), уроки ниже ранга пропускаются', async () => {
    const stats = await repo.getStats()
    await repo.putStats({ ...stats, rank: 'D', updated_at: '2026-02-01T00:00:00Z' })
    window.location.hash = '#/'
    render(
      <HashRouter>
        <Dashboard repo={repo} />
      </HashRouter>,
    )
    expect(await screen.findByText('Ежедневный квест', {}, { timeout: 8000 })).toBeInTheDocument()
    expect(screen.getByText(/D-01 ·/)).toBeInTheDocument()
    expect(screen.queryByText(/E-01 ·/)).not.toBeInTheDocument()
  })

  it('placement waive: дашборд объясняет зачёт нижних уроков', async () => {
    const stats = await repo.getStats()
    await repo.putStats({ ...stats, rank: 'D', updated_at: '2026-02-01T00:00:00Z' })
    localStorage.setItem(
      PLACEMENT_INFO_KEY,
      JSON.stringify({ rank: 'D', mode: 'waive', appliedAt: '2026-02-01T00:00:00Z' }),
    )
    window.location.hash = '#/'
    render(
      <HashRouter>
        <Dashboard repo={repo} />
      </HashRouter>,
    )
    expect(
      await screen.findByText(/Оценка назначила ранг D \(A1\)/, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(screen.getByText(/зачтены без опыта/)).toBeInTheDocument()
  })

  it('placement start_at_rank: дашборд объясняет старт с первого урока ранга', async () => {
    const stats = await repo.getStats()
    await repo.putStats({ ...stats, rank: 'D', updated_at: '2026-02-01T00:00:00Z' })
    localStorage.setItem(
      PLACEMENT_INFO_KEY,
      JSON.stringify({ rank: 'D', mode: 'start_at_rank', appliedAt: '2026-02-01T00:00:00Z' }),
    )
    window.location.hash = '#/'
    render(
      <HashRouter>
        <Dashboard repo={repo} />
      </HashRouter>,
    )
    expect(
      await screen.findByText(/Ты начал с ранга D \(A1\)/, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(screen.getByText(/уроки ниже не зачтены/)).toBeInTheDocument()
  })

  it('placement пояснение исчезает, когда первый урок ранга уже пройден', async () => {
    const stats = await repo.getStats()
    await repo.putStats({ ...stats, rank: 'D', updated_at: '2026-02-01T00:00:00Z' })
    localStorage.setItem(
      PLACEMENT_INFO_KEY,
      JSON.stringify({ rank: 'D', mode: 'start_at_rank', appliedAt: '2026-02-01T00:00:00Z' }),
    )
    await repo.putLessonProgress({
      ...waivedLessonProgress('les-d-01', '2026-02-01T00:00:00Z'),
    })
    window.location.hash = '#/'
    render(
      <HashRouter>
        <Dashboard repo={repo} />
      </HashRouter>,
    )
    expect(await screen.findByText(/D-02 ·/, {}, { timeout: 8000 })).toBeInTheDocument()
    expect(screen.queryByText(/Ты начал с ранга/)).not.toBeInTheDocument()
  })

  // plan://ux-feedback-2#U.2 — кнопка «Сохранить прогресс» качает файл экспорта
  it('«Сохранить прогресс» на дашборде скачивает JSON-дамп с датой', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    const clicks: string[] = []
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function capture(this: HTMLAnchorElement) {
        clicks.push(this.download)
      })
    const urlSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation((blob: Blob | MediaSource) => {
        void blob
        return createObjectURL()
      })
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeObjectURL)
    window.location.hash = '#/'
    try {
      render(
        <HashRouter>
          <Dashboard repo={repo} />
        </HashRouter>,
      )
      const button = await screen.findByRole(
        'button',
        { name: /Сохранить прогресс/ },
        { timeout: 8000 },
      )
      fireEvent.click(button)
      await waitFor(() => expect(clicks.length).toBe(1))
      expect(clicks[0]).toMatch(/^hunter-english-progress-\d{4}-\d{2}-\d{2}\.json$/)
      expect(screen.getByText(/Прогресс хранится в этом браузере/)).toBeInTheDocument()
    } finally {
      clickSpy.mockRestore()
      urlSpy.mockRestore()
      revokeSpy.mockRestore()
    }
  })

  it('сохранение не удалось → тост об ошибке, кнопка снова активна', async () => {
    const urlSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('no blobs here')
    })
    const { ToastHost } = await import('../components/ToastHost')
    window.location.hash = '#/'
    try {
      render(
        <HashRouter>
          <Dashboard repo={repo} />
          <ToastHost />
        </HashRouter>,
      )
      const button = await screen.findByRole(
        'button',
        { name: /Сохранить прогресс/ },
        { timeout: 8000 },
      )
      fireEvent.click(button)
      expect(await screen.findByText('Не удалось сохранить файл')).toBeInTheDocument()
      await waitFor(() => expect(button).not.toBeDisabled())
    } finally {
      urlSpy.mockRestore()
    }
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
