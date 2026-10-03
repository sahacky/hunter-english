// Implements: plan://onboarding#O.7 — онбординг: оценка ранга и применение
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import '../i18n'
import WelcomeScreen from './WelcomeScreen'
import { ONBOARDING_KEY, PLACEMENT_INFO_KEY } from '../data/onboarding'
import type { ProgressRepository } from '../domain/progress'
import type { PlacementTask } from '../domain/placement/placement'
import type { LessonItem } from '../content/lessons'
import type { UserStats } from '../domain/game/types'
import { emptyStats } from '../domain/game/types'
import type { LessonProgress } from '../domain/lesson/types'

function fakeRepo() {
  const state = {
    stats: emptyStats('2026-01-01T00:00:00Z'),
    lessons: new Map<string, LessonProgress>(),
    suspended: [] as string[],
  }
  const repo: ProgressRepository = {
    ensureCards: async () => undefined,
    suspendNotes: async (ids) => {
      state.suspended.push(...ids)
    },
    getAllCards: async () => [],
    saveAnswer: async () => undefined,
    countNewAnsweredSince: async () => 0,
    getLessonProgress: async (id) => state.lessons.get(id) ?? null,
    getManyLessonProgress: async (ids) => ids.map((id) => state.lessons.get(id) ?? null),
    putLessonProgress: async (p) => {
      state.lessons.set(p.lesson_id, p)
    },
    getStats: async () => state.stats,
    putStats: async (stats: UserStats) => {
      state.stats = stats
    },
    getQuestDay: async () => null,
    putQuestDay: async () => undefined,
    getGateAttempt: async () => null,
    putGateAttempt: async () => undefined,
    getQuoteMark: async () => false,
    putQuoteMark: async () => undefined,
  }
  return { repo, state }
}

/** Задачи: по 2 на полосу E/D — достаточно для вердикта. */
const TASKS: PlacementTask[] = [
  { id: 'e1', rank: 'E', promptRu: 'Я в порядке', accepted: ['I am fine.', "I'm fine."] },
  { id: 'e2', rank: 'E', promptRu: 'Она врач', accepted: ['She is a doctor.'] },
  { id: 'd1', rank: 'D', promptRu: 'Мы дома', accepted: ['We are at home.'] },
  { id: 'd2', rank: 'D', promptRu: 'Они опоздали', accepted: ['They are late.'] },
]

const LESSONS: LessonItem[] = [
  {
    id: 'les-e-01',
    rank: 'E',
    module: 'mod-e-1',
    title: 'e1',
    grammar_point: { id: 'gp', title_ru: '', rule_md: '', phrase_ids: [] },
    vocab_band: null,
    phrasebook_topic: null,
    trap_id: null,
    quotes_topic: null,
    exercises: [],
    bebris_video: null,
  },
]
const WORD_RANKS = new Map([['fine-adjective', 500]])

function renderWelcome(props: Partial<Parameters<typeof WelcomeScreen>[0]> = {}) {
  const { repo, state } = fakeRepo()
  const utils = render(
    <HashRouter>
      <WelcomeScreen
        repo={repo}
        tasks={TASKS}
        lessons={LESSONS}
        wordRanks={WORD_RANKS}
        {...props}
      />
    </HashRouter>,
  )
  return { repo, state, ...utils }
}

function answer(value: string) {
  fireEvent.change(screen.getByRole('textbox'), { target: { value } })
  fireEvent.submit(screen.getByRole('textbox').closest('form')!)
}

beforeEach(() => {
  localStorage.removeItem(ONBOARDING_KEY)
  localStorage.removeItem(PLACEMENT_INFO_KEY)
  window.location.hash = '#/welcome'
})

describe('WelcomeScreen', () => {
  it('уже онбордился — редирект на главную', async () => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    renderWelcome()
    await waitFor(() => expect(window.location.hash).toBe('#/'))
  })

  it('интро → «с нуля» → ранг E применён, флаг поставлен, без зачётов', async () => {
    const { state } = renderWelcome()
    expect(await screen.findByText('Регистрация Охотника')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Начать с нуля (ранг E)'))
    await waitFor(() => expect(window.location.hash).toBe('#/'))
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('1')
    expect(state.stats.rank).toBe('E')
    expect(state.lessons.size).toBe(0)
    expect(state.suspended).toEqual([])
  })

  it('оценка: верный ответ с вариантом → вердикт по результатам → применение ранга E', async () => {
    const { state } = renderWelcome()
    fireEvent.click(await screen.findByText('Пройти оценку ранга'))
    // E-1: вариант "I'm fine." принят
    answer("I'm fine.")
    expect(await screen.findByText(/Дальше/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Дальше/ }))
    // E-2: неверно → 1 ошибка полосы E (не закрывает)
    answer('nope')
    await screen.findByRole('button', { name: /Дальше/ })
    fireEvent.click(screen.getByRole('button', { name: /Дальше/ }))
    // D-1: неверно → 1 ошибка D; D-2: неверно → полоса D закрыта, тест окончен → вердикт E
    answer('wrong 1')
    await screen.findByRole('button', { name: /Дальше/ })
    fireEvent.click(screen.getByRole('button', { name: /Дальше/ }))
    answer('wrong 2')
    await screen.findByRole('button', { name: /Дальше/ })
    fireEvent.click(screen.getByRole('button', { name: /Дальше/ }))
    // вердикт: ранг E, low (была ошибка в E); ниже E предложений нет
    expect(await screen.findByText('Система назначает ранг')).toBeInTheDocument()
    expect(screen.getByText('E (A0)')).toBeInTheDocument()
    expect(screen.getByText(/Система сомневалась/)).toBeInTheDocument()
    expect(screen.queryByText(/Надёжнее/)).not.toBeInTheDocument()
    // ниже E уроков нет — выбор применения пропускается
    fireEvent.click(screen.getByText('Начать с ранга E (A0)'))
    await waitFor(() => expect(window.location.hash).toBe('#/'))
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('1')
    expect(state.stats.rank).toBe('E') // вердикт E — без зачётов, floor 0
  })

  it('оценка без ошибок → ранг D → «зачесть нижние» применяет зачёты и скрытие слов', async () => {
    const { state } = renderWelcome()
    fireEvent.click(await screen.findByText('Пройти оценку ранга'))
    for (const value of ['I am fine.', 'She is a doctor.', 'We are at home.', 'They are late.']) {
      answer(value)
      await screen.findByRole('button', { name: /Дальше/ })
      fireEvent.click(screen.getByRole('button', { name: /Дальше/ }))
    }
    expect(await screen.findByText(/Чистый срез/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Начать с ранга D (A1)'))
    // экран применения (P.2): явный выбор режима
    expect(await screen.findByText('Применение ранга')).toBeInTheDocument()
    expect(screen.getByText(/Ранг D \(A1\)/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Зачесть нижние уроки'))
    await waitFor(() => expect(window.location.hash).toBe('#/'))
    expect(state.stats.rank).toBe('D')
    expect(state.lessons.get('les-e-01')?.status).toBe('completed')
    // U3.2: старт D скрывает полосу НИЖЕ ранга (≤300): fine(500) — уже полоса D, учим
    expect(state.suspended).toEqual([])
    expect(JSON.parse(localStorage.getItem(PLACEMENT_INFO_KEY)!)).toMatchObject({
      rank: 'D',
      mode: 'waive',
    })
  })

  it('P.2 «начать с первого урока ранга»: без зачётов и скрытия слов', async () => {
    const { state } = renderWelcome()
    fireEvent.click(await screen.findByText('Пройти оценку ранга'))
    for (const value of ['I am fine.', 'She is a doctor.', 'We are at home.', 'They are late.']) {
      answer(value)
      await screen.findByRole('button', { name: /Дальше/ })
      fireEvent.click(screen.getByRole('button', { name: /Дальше/ }))
    }
    await screen.findByText(/Чистый срез/)
    fireEvent.click(screen.getByText('Начать с ранга D (A1)'))
    fireEvent.click(await screen.findByText('Начать с первого урока ранга'))
    await waitFor(() => expect(window.location.hash).toBe('#/'))
    expect(state.stats.rank).toBe('D')
    expect(state.lessons.size).toBe(0) // нижние доступны, но не зачтены
    expect(state.suspended).toEqual([])
    expect(JSON.parse(localStorage.getItem(PLACEMENT_INFO_KEY)!)).toMatchObject({
      rank: 'D',
      mode: 'start_at_rank',
    })
  })

  it('P.1 «не знаю» — честный промах: показывает эталон и считается ошибкой', async () => {
    const { state } = renderWelcome()
    fireEvent.click(await screen.findByText('Пройти оценку ранга'))
    // E-1: «не знаю» без ввода
    fireEvent.click(screen.getByRole('button', { name: 'Не знаю' }))
    // эталон показан (FeedbackPlate с reference)
    expect(await screen.findByText(/I am fine\./)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Дальше/ }))
    // E-2: снова «не знаю» → полоса E закрыта двумя ошибками → вердикт E low
    fireEvent.click(screen.getByRole('button', { name: 'Не знаю' }))
    await screen.findByRole('button', { name: /Дальше/ })
    fireEvent.click(screen.getByRole('button', { name: /Дальше/ }))
    expect(await screen.findByText('Система назначает ранг')).toBeInTheDocument()
    expect(screen.getByText(/Система сомневалась/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Начать с ранга E (A0)'))
    await waitFor(() => expect(window.location.hash).toBe('#/'))
    expect(state.stats.rank).toBe('E')
  })

  it('P.1 low confidence → явное предложение ранга ниже (D low → E)', async () => {
    const { state } = renderWelcome()
    fireEvent.click(await screen.findByText('Пройти оценку ранга'))
    // E чисто, D с одним промахом → вердикт D low
    for (const value of ['I am fine.', 'She is a doctor.']) {
      answer(value)
      await screen.findByRole('button', { name: /Дальше/ })
      fireEvent.click(screen.getByRole('button', { name: /Дальше/ }))
    }
    answer('nope')
    await screen.findByRole('button', { name: /Дальше/ })
    fireEvent.click(screen.getByRole('button', { name: /Дальше/ }))
    answer('They are late.')
    await screen.findByRole('button', { name: /Дальше/ })
    fireEvent.click(screen.getByRole('button', { name: /Дальше/ }))
    expect(await screen.findByText('Система назначает ранг')).toBeInTheDocument()
    expect(screen.getByText(/Система в тебе не уверена/)).toBeInTheDocument()
    // выбираем надёжный ранг ниже (E — применяется сразу, без экрана выбора)
    fireEvent.click(screen.getByText('Надёжнее: ранг E (A0)'))
    await waitFor(() => expect(window.location.hash).toBe('#/'))
    expect(state.stats.rank).toBe('E')
    expect(JSON.parse(localStorage.getItem(PLACEMENT_INFO_KEY)!)).toMatchObject({
      rank: 'E',
      mode: 'waive',
    })
  })

  it('ошибка применения → экран ошибки → повтор работает', async () => {
    const { repo } = fakeRepo()
    const failing: ProgressRepository = {
      ...repo,
      putStats: vi.fn(async () => {
        throw new Error('db locked')
      }),
    }
    render(
      <HashRouter>
        <WelcomeScreen repo={failing} tasks={TASKS} lessons={LESSONS} wordRanks={WORD_RANKS} />
      </HashRouter>,
    )
    fireEvent.click(await screen.findByText('Начать с нуля (ранг E)'))
    expect(await screen.findByText('Система не смогла применить ранг')).toBeInTheDocument()
    expect(localStorage.getItem(ONBOARDING_KEY)).toBeNull()
    // повтор: чиним репозиторий — успех
    ;(failing.putStats as ReturnType<typeof vi.fn>).mockImplementation(async (stats: UserStats) => {
      await repo.putStats(stats)
    })
    fireEvent.click(screen.getByText('Повторить'))
    fireEvent.click(await screen.findByText('Начать с нуля (ранг E)'))
    await waitFor(() => expect(window.location.hash).toBe('#/'))
  })

  it('«Назад» из оценки возвращает к интро', async () => {
    renderWelcome()
    fireEvent.click(await screen.findByText('Пройти оценку ранга'))
    fireEvent.click(screen.getByText(/Назад/))
    expect(await screen.findByText('Регистрация Охотника')).toBeInTheDocument()
  })

  it('без переопределений: задачи грузятся из контента, кнопка оценки активируется', async () => {
    const { repo } = fakeRepo()
    render(
      <HashRouter>
        <WelcomeScreen repo={repo} />
      </HashRouter>,
    )
    const button = await screen.findByText('Пройти оценку ранга')
    // контент может успеть загрузиться до первого кадра — ждём только готовность
    await waitFor(() => expect(button).not.toBeDisabled(), { timeout: 8000 })
  })

  it('пустой набор задач (нет контента-маяков) — оценка сразу выдаёт вердикт E', async () => {
    render(
      <HashRouter>
        <WelcomeScreen repo={fakeRepo().repo} tasks={[]} lessons={LESSONS} wordRanks={WORD_RANKS} />
      </HashRouter>,
    )
    fireEvent.click(await screen.findByText('Пройти оценку ранга'))
    expect(await screen.findByText('Система назначает ранг')).toBeInTheDocument()
    expect(screen.getByText('E (A0)')).toBeInTheDocument()
    expect(screen.getByText(/Чистый срез/)).toBeInTheDocument()
    // старт из мгновенного вердикта тоже применяет ранг
    fireEvent.click(screen.getByText('Начать с ранга E (A0)'))
    await waitFor(() => expect(window.location.hash).toBe('#/'))
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('1')
  })

  it('размонтирование до завершения init-эффекта — живой гвард, без обновления состояния', async () => {
    const { unmount } = render(
      <HashRouter>
        <WelcomeScreen repo={fakeRepo().repo} tasks={TASKS} />
      </HashRouter>,
    )
    unmount() // isOnboarded ещё в микротаске — эффект обязан выйти молча
    await Promise.resolve()
    expect(window.location.hash).toBe('#/welcome') // navigate не вызывался
  })
})
