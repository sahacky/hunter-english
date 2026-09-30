// Implements: plan://M5#5.5–5.6 — тесты экрана урока на данных пилота E1 (specs/02 §2, §5)
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import '../i18n'
import { loadLessonView } from '../content/lessons'
import type { ProgressRepository } from '../domain/progress'
import { HunterDb } from '../data/db'
import { DexieProgressRepository } from '../data/progress-repository'
import { uuidv7 } from '../lib/uuidv7'
import LessonScreen from './LessonScreen'

let db: HunterDb
let repo: DexieProgressRepository

beforeEach(() => {
  db = new HunterDb(`hunter-lesson-test-${uuidv7()}`)
  repo = new DexieProgressRepository(db)
})

function renderScreen(courseId: string, repository: ProgressRepository = repo) {
  window.location.hash = `#/lesson/${courseId}`
  return render(
    <HashRouter>
      <Routes>
        <Route path="/lesson/:id" element={<LessonScreen repo={repository} />} />
      </Routes>
    </HashRouter>,
  )
}

describe('LessonScreen /#/lesson/:id', () => {
  it('невалидный id → 404', async () => {
    renderScreen('E-99-бред')
    expect(await screen.findByText('404')).toBeInTheDocument()
  })

  it('несуществующий урок → 404', async () => {
    renderScreen('E-99')
    expect(await screen.findByText('404')).toBeInTheDocument()
  })

  it('шаг 1: правило → cloze → разогрев; чекпоинт пишется после каждого ответа', async () => {
    renderScreen('E-01')
    // правило урока E-01
    expect(await screen.findByText('Глагол to be в настоящем времени')).toBeInTheDocument()
    // примеры правила — первые фразы пула E-01
    expect(screen.getByText('Hello!')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Понятно/ }))

    // cloze правила: I ___ Ivan. → am
    const input = await screen.findByRole('textbox')
    fireEvent.change(input, { target: { value: 'am' } })
    fireEvent.click(screen.getByRole('button', { name: /Проверить/ }))
    expect(await screen.findByText('Верно!')).toBeInTheDocument()

    // чекпоинт сохранён с первым отвеченным заданием
    await waitFor(async () => {
      const row = await repo.getLessonProgress('les-e-01')
      expect(row).not.toBeNull()
      expect(row!.checkpoint.scores[0].answered).toBeGreaterThan(0)
    })
  })

  it('guard «Продолжить» при незавершённом уроке (specs/07 §4.4)', async () => {
    // готовая запись с шага 3
    await repo.putLessonProgress({
      lesson_id: 'les-e-01',
      status: 'in_progress',
      score: null,
      checkpoint: {
        passIndex: 0,
        stepIndex: 3,
        scores: [{ stepIndex: 2, total: 5, answered: 5, firstTryCorrect: 5 }],
        srsEnqueued: [],
        passesDone: 0,
        results: {},
      },
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    renderScreen('E-01')
    expect(await screen.findByText(/Вы остановились на шаге 3/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Продолжить/ }))
    // шаг 3 — построение: показан первый word-bank/translate
    expect(await screen.findByText(/шаг 3 из 7/)).toBeInTheDocument()
  })

  it('финал урока: шаг 7 отправляет фразы в колоду и завершает проход', async () => {
    const view = await loadLessonView('les-e-01')
    if (!view) throw new Error('нет данных урока les-e-01')
    const allExercises = view.steps.flatMap((step) => view.content[step.index] ?? [])
    // чекпоинт «всё отвечено, шаг 7»
    const scores = view.steps.map((step) => ({
      stepIndex: step.index,
      total: (view.content[step.index] ?? []).length,
      answered: (view.content[step.index] ?? []).length,
      firstTryCorrect: (view.content[step.index] ?? []).length,
    }))
    await repo.putLessonProgress({
      lesson_id: 'les-e-01',
      status: 'in_progress',
      score: null,
      checkpoint: {
        passIndex: 0,
        stepIndex: 7,
        scores,
        srsEnqueued: [],
        passesDone: 0,
        results: Object.fromEntries(
          allExercises.map(({ exercise }) => [exercise.id, { attempts: 1, outcome: 'correct' }]),
        ),
      },
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    renderScreen('E-01')
    fireEvent.click(await screen.findByRole('button', { name: /Продолжить/ }))
    expect(await screen.findByText('В колоду')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Завершить урок/ }))
    expect(await screen.findByText('Урок завершён')).toBeInTheDocument()

    // сводка отрисована до finishPass (блокер ревью: обнуление XP/точности)
    expect(await screen.findByText(/XP: \d+/)).toBeInTheDocument()
    expect(screen.getByText(/Точность: \d+%/)).toBeInTheDocument()
    const row = await repo.getLessonProgress('les-e-01')
    // фразы только что в колоде → «выучено» 0% → статус in_progress (specs/02 §2)
    expect(row?.status).toBe('in_progress')
    expect(row?.score).toBe(100)
    // XP упражнений начислен (ревью M7#Б1: раньше терялся после finishPass)
    const stats = await repo.getStats()
    expect(stats.xp).toBeGreaterThan(25)
    // сводина показывает фактическое начисление (без дубля — ревью M7#М8)
    const summaryXp = Number((screen.getByText(/XP: \d+/).textContent ?? '').match(/\d+/)?.[0] ?? 0)
    expect(summaryXp).toBe(stats.xp)
    expect(row?.checkpoint.passesDone).toBe(1)
    // фразы урока материализованы карточками en-ru (rule-1)
    const cards = await repo.getAllCards()
    const phraseCards = cards.filter((card) => card.note_id.startsWith('note_ph-e-'))
    expect(phraseCards.length).toBeGreaterThanOrEqual(40)
    expect(phraseCards.every((card) => card.type === 'en-ru')).toBe(true)
  })

  it('финал: проход по ошибкам — только ошибочные задания, без XP/персиста (M11#11.3)', async () => {
    const view = await loadLessonView('les-e-01')
    if (!view) throw new Error('нет данных урока les-e-01')
    const allExercises = view.steps.flatMap((step) => view.content[step.index] ?? [])
    const scores = view.steps.map((step) => ({
      stepIndex: step.index,
      total: (view.content[step.index] ?? []).length,
      answered: (view.content[step.index] ?? []).length,
      firstTryCorrect: (view.content[step.index] ?? []).length,
    }))
    const results = Object.fromEntries(
      allExercises.map(({ exercise }, index) => [
        exercise.id,
        // первые два задания — «с ошибкой»: со второй попытки и подсказка
        index === 0
          ? { attempts: 2, outcome: 'correct_retry' as const }
          : index === 1
            ? { attempts: 1, outcome: 'hint' as const }
            : { attempts: 1, outcome: 'correct' as const },
      ]),
    )
    await repo.putLessonProgress({
      lesson_id: 'les-e-01',
      status: 'in_progress',
      score: null,
      checkpoint: { passIndex: 0, stepIndex: 7, scores, srsEnqueued: [], passesDone: 0, results },
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    renderScreen('E-01')
    fireEvent.click(await screen.findByRole('button', { name: /Продолжить/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Завершить урок/ }))
    expect(await screen.findByText('Урок завершён')).toBeInTheDocument()

    // на финале — кнопка прохода по ошибкам с числом ошибок
    expect(await screen.findByText('Повторить ошибочные (2)')).toBeInTheDocument()
    const xpBefore = (await repo.getStats()).xp
    const checkpointBefore = (await repo.getLessonProgress('les-e-01'))?.checkpoint

    fireEvent.click(screen.getByRole('button', { name: /Повторить ошибочные/ }))
    expect(await screen.findByText('Проход по ошибкам')).toBeInTheDocument()
    expect(screen.getByText('задание 1 из 2')).toBeInTheDocument()
    // первое ошибочное задание повторно показано (cloze правила E-01)
    expect(await screen.findByRole('textbox')).toBeInTheDocument()

    // прогресс урока не затёрт повтором (решение M11#11.3)
    const checkpointAfter = (await repo.getLessonProgress('les-e-01'))?.checkpoint
    expect(checkpointAfter).toEqual(checkpointBefore)
    const xpAfter = (await repo.getStats()).xp
    expect(xpAfter).toBe(xpBefore)
  })

  it('голосовое упражнение: фолбэк «Сказал(-а)» без микрофона (jsdom)', async () => {
    // записываем прогресс прямо на шаге 5 (речь)
    const view = await loadLessonView('les-e-01')
    if (!view) throw new Error('нет данных урока les-e-01')
    const speaking = view.content[5] ?? []
    expect(speaking.length).toBeGreaterThan(0)
    await repo.putLessonProgress({
      lesson_id: 'les-e-01',
      status: 'in_progress',
      score: null,
      checkpoint: {
        passIndex: 0,
        stepIndex: 5,
        scores: [
          { stepIndex: 1, total: 3, answered: 3, firstTryCorrect: 3 },
          { stepIndex: 2, total: 5, answered: 5, firstTryCorrect: 5 },
          { stepIndex: 3, total: 24, answered: 24, firstTryCorrect: 24 },
          { stepIndex: 4, total: 5, answered: 5, firstTryCorrect: 5 },
        ],
        srsEnqueued: [],
        passesDone: 0,
        results: {},
      },
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    renderScreen('E-01')
    fireEvent.click(await screen.findByRole('button', { name: /Продолжить/ }))
    expect(await screen.findByText(/шаг 5 из 7/)).toBeInTheDocument()
    // микрофона нет → подсказка недоступности + фолбэки
    expect(await screen.findByText(/Микрофон недоступен/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Сказал/ }))
    // следующее речевое задание (или шаг завершён → «Из сериала»)
    await waitFor(() => {
      const progress = screen.getByText(/шаг \d из 7/)
      expect(progress).toBeInTheDocument()
    })
    const row = await repo.getLessonProgress('les-e-01')
    const speakingScore = row?.checkpoint.scores.find((s) => s.stepIndex === 5)
    expect(speakingScore?.answered).toBe(1)
    // самопроверка не растит статистику точности (specs/02 §3)
    expect(speakingScore?.firstTryCorrect).toBe(0)
  })
})

// Implements: plan://M19 — покрытие веток LessonScreen (walk/guard/deep-link/шорткаты)
describe('LessonScreen: обход и ветки (M19)', () => {
  it('deep-link: ?step=9 на свежем уроке → 404; ?step=1 → правило шага 1', async () => {
    window.location.hash = '#/lesson/E-01?step=9'
    const wrong = render(
      <HashRouter>
        <Routes>
          <Route path="/lesson/:id" element={<LessonScreen repo={repo} />} />
        </Routes>
      </HashRouter>,
    )
    expect(await screen.findByText('404', {}, { timeout: 5000 })).toBeInTheDocument()
    wrong.unmount()

    window.location.hash = '#/lesson/E-01?step=1'
    render(
      <HashRouter>
        <Routes>
          <Route path="/lesson/:id" element={<LessonScreen repo={repo} />} />
        </Routes>
      </HashRouter>,
    )
    expect(
      await screen.findByRole('button', { name: /Понятно/ }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(await screen.findByText(/шаг 1 из 7/)).toBeInTheDocument()
  })

  it('повтор пройденного урока: guard «Повторить» начинает свежий чекпоинт', async () => {
    await repo.putLessonProgress({
      lesson_id: 'les-e-01',
      status: 'completed',
      score: 95,
      checkpoint: {
        passIndex: 0,
        stepIndex: 7,
        scores: [],
        srsEnqueued: [],
        passesDone: 1,
        results: {},
      },
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    renderScreen('E-01')
    expect(
      await screen.findByText(/Урок уже пройден|Повторить урок/, {}, { timeout: 5000 }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Пройти повторно/ }))
    // свежий проход: правило шага 1 снова показано
    expect(await screen.findByText(/Понятно/, {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('Esc/✕: подтверждение выхода, «остаться» закрывает, «выйти» ведёт на главную', async () => {
    renderScreen('E-01')
    await screen.findByText(/Понятно/, {}, { timeout: 5000 })
    // ✕-кнопка открывает подтверждение
    fireEvent.click(screen.getByRole('button', { name: /✕/ }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Продолжить урок/ }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    // Esc-шорткат тоже открывает и закрывает
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    // beforeunload отменяется в незавершённом уроке
    const before = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(before)
    expect(before.defaultPrevented).toBe(true)
    // подтверждённый выход — на дашборд
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Выйти' }))
    await waitFor(() => expect(window.location.hash).toBe('#/'))
  })

  it('Enter: «Понятно» → следующее задание; из input не срабатывает', async () => {
    renderScreen('E-01')
    await screen.findByText(/Понятно/, {}, { timeout: 5000 })
    fireEvent.keyDown(window, { key: 'Enter' }) // правило → cloze
    expect(await screen.findByRole('textbox')).toBeInTheDocument()
    // Enter из input — нативная отправка формы, не «Дальше» урока
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('ошибка загрузки прогресса → error-фаза с кнопкой перезагрузки', async () => {
    const failing = {
      ...repo,
      getLessonProgress: async () => {
        throw new Error('db broken')
      },
    }
    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', {
      value: { ...original, reload: reload },
      writable: true,
      configurable: true,
    })
    try {
      renderScreen('E-01', failing as unknown as Parameters<typeof renderScreen>[1])
      const retry = await screen.findByRole(
        'button',
        { name: /Повторить загрузку|Обновить/ },
        { timeout: 5000 },
      )
      fireEvent.click(retry)
      expect(reload).toHaveBeenCalled()
    } finally {
      Object.defineProperty(window, 'location', {
        value: original,
        writable: true,
        configurable: true,
      })
    }
  })

  it('полный проход урока: все шаги до финала + видео-ссылка', async () => {
    renderScreen('E-01')
    expect(await screen.findByText(/Понятно/, {}, { timeout: 5000 })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Понятно/ }))

    // карты из данных урока: пары match (RU→EN) и правильные варианты choose (RU-промпт→EN)
    const view = await loadLessonView('les-e-01')
    const pairMaps: Map<string, string>[] = []
    const chooseCorrect = new Map<string, string>()
    for (const items of Object.values(view?.content ?? {})) {
      for (const { exercise } of items) {
        const payload = exercise.payload as {
          pairs?: { en: string; ru: string }[]
          prompt?: string
          options?: string[]
          correct?: number
        }
        if (payload.pairs) pairMaps.push(new Map(payload.pairs.map(({ en, ru }) => [ru, en])))
        if (payload.prompt && payload.options && payload.correct !== undefined) {
          chooseCorrect.set(payload.prompt, payload.options[payload.correct] ?? '')
        }
      }
    }

    const solveMatch = () => {
      for (const map of pairMaps) {
        for (const [ru, en] of map) {
          const ruBtn = screen.queryByRole('button', { name: ru })
          const enBtn = screen.queryByRole('button', { name: en })
          if (
            ruBtn &&
            enBtn &&
            !ruBtn.hasAttribute('disabled') &&
            !enBtn.hasAttribute('disabled')
          ) {
            fireEvent.click(ruBtn)
            fireEvent.click(enBtn)
            return true
          }
        }
      }
      return false
    }

    const solve = () => {
      // повтор шага приоритетнее «Дальше»: при <70% разогрева advanceStep
      // не пускает дальше, «Дальше» из упражнения — no-op (specs/02 §2)
      const repeatNow = screen.queryByRole('button', { name: /^Повторить шаг/ })
      if (repeatNow) {
        fireEvent.click(repeatNow)
        return
      }
      // свободные плитки банка (word_bank)
      const bankTile = screen
        .getAllByRole('button')
        .find(
          (b) =>
            b.className.includes('lesson-tile') &&
            !b.className.includes('slot') &&
            !b.hasAttribute('disabled'),
        )
      if (bankTile) {
        fireEvent.click(bankTile)
        return
      }
      // match_pairs решаем правильно (иначе матчинг не завершится)
      const ruOptions = screen
        .getAllByRole('button')
        .filter((b) => b.className.includes('lesson-option') && !b.hasAttribute('disabled'))
      if (ruOptions.length > 0 && solveMatch()) return
      // choose_translation — правильный вариант по RU-промпту (карта из данных);
      // до повтора шага — намеренно неверный (первый круг <70%)
      const promptText = document.querySelector('.lesson-prompt[lang="ru"]')?.textContent ?? ''
      const correctOption = chooseCorrect.get(promptText)
      if (correctOption) {
        const btn = screen.queryByRole('button', { name: correctOption })
        if (btn && !btn.hasAttribute('disabled')) {
          fireEvent.click(btn)
          return
        }
      }
      const option = ruOptions[0]
      if (option) {
        fireEvent.click(option)
        return
      }
      const said = screen.queryByRole('button', { name: /Сказал\(-а\)/ })
      if (said) {
        fireEvent.click(said)
        return
      }
      const next = screen.queryByRole('button', { name: /^Дальше/ })
      if (next) {
        fireEvent.click(next)
        return
      }
      const retry = screen.queryByRole('button', { name: /Ещё попытка/ })
      if (retry) {
        fireEvent.click(retry)
        return
      }
      const input = document.querySelector<HTMLInputElement>('.lesson-input:not([disabled])')
      if (input) {
        fireEvent.change(input, { target: { value: 'zzz' } })
        fireEvent.submit(input.closest('form')!)
        return
      }
      const finish = screen.queryByRole('button', { name: /Завершить урок/ })
      if (finish) {
        fireEvent.click(finish)
        return 'done' as const
      }
      throw new Error(
        `обход завис: ${document.querySelector('header')?.textContent?.slice(0, 80)} | ${document.body.textContent?.slice(0, 200)}`,
      )
    }

    // «zzz»/неверные ответы на всё — проход дойдёт до финала
    let done = false
    for (let step = 0; step < 1200 && !done; step += 1) {
      await waitFor(() => undefined, { timeout: 20 })
      if (screen.queryByText('Урок завершён')) {
        done = true
        break
      }
      const result = solve()
      if (result === 'done') continue
      // слоты word_bank заполнены → «Проверить»
      const checkBtn = screen.queryByRole('button', { name: /^Проверить$/ })
      if (checkBtn && !checkBtn.hasAttribute('disabled')) fireEvent.click(checkBtn)
    }
    expect(done).toBe(true)
    // видео урока E-01 присутствует на финале
    expect(screen.getByRole('link', { name: 'YouTube' })).toHaveAttribute(
      'href',
      expect.stringContaining('youtube.com/watch'),
    )
  }, 45000)
})
