// Implements: plan://M5#5.5–5.6 — тесты экрана урока на данных пилота E1 (specs/02 §2, §5)
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import '../i18n'
import {
  loadLessonView,
  type ExerciseItem,
  type LessonView,
  type PhraseItem,
} from '../content/lessons'
import type { ProgressRepository } from '../domain/progress'
import { createQuestDay } from '../domain/game/game'
import { emptyStats } from '../domain/game/types'
import { dayStart } from '../domain/srs/scheduler'
import type { CardState } from '../domain/srs/types'
import { HunterDb } from '../data/db'
import { DexieProgressRepository } from '../data/progress-repository'
import { showToast } from '../lib/toast'
import { speak } from '../lib/tts'
import { uuidv7 } from '../lib/uuidv7'
import LessonScreen from './LessonScreen'

// tts/toast — границы окружения: в jsdom их не проверяем, только факт вызова
vi.mock('../lib/tts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/tts')>()),
  speak: vi.fn(),
}))
vi.mock('../lib/toast', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/toast')>()),
  showToast: vi.fn(),
}))

// флаг для сценария «сборка урока упала» (error-фаза загрузки, specs/07 §4.1)
const lessonModuleFlags = vi.hoisted(() => ({ failLoadLessonView: false }))
vi.mock('../content/lessons', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../content/lessons')>()
  return {
    ...actual,
    loadLessonView: async (...args: Parameters<typeof actual.loadLessonView>) => {
      if (lessonModuleFlags.failLoadLessonView) throw new Error('сборка урока упала (тест)')
      return actual.loadLessonView(...args)
    },
  }
})

let db: HunterDb
let repo: DexieProgressRepository

beforeEach(() => {
  db = new HunterDb(`hunter-lesson-test-${uuidv7()}`)
  repo = new DexieProgressRepository(db)
})

function renderScreen(courseId: string, repository: ProgressRepository = repo, view?: LessonView) {
  window.location.hash = `#/lesson/${courseId}`
  return render(
    <HashRouter>
      <Routes>
        <Route path="/lesson/:id" element={<LessonScreen repo={repository} view={view} />} />
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
    // правило урока E-01; холодный CI-раннер + ленивый контент-чанк — таймаут
    // с запасом (прецедент M17: постмортем a45b3a5, CI-цейтнот)
    expect(
      await screen.findByText('Глагол to be в настоящем времени', {}, { timeout: 4000 }),
    ).toBeInTheDocument()
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

  it('B-27: правило → 2 cloze → сразу «Речь»-сценки (пустые блоки пропущены)', async () => {
    renderScreen('B-27')
    expect(
      await screen.findByText('Диалог без подготовки', {}, { timeout: 4000 }),
    ).toBeInTheDocument()
    // примеры правила — фразы других уроков B (кросс-урочный резолв)
    expect(screen.getByText('It depends.')).toBeInTheDocument()
    expect(screen.getByText("It's up to you.")).toBeInTheDocument()
    expect(screen.getByText('Maybe next time.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Понятно/ }))
    // 2 cloze правила
    for (const gap of ['think', 'you']) {
      const input = await screen.findByRole('textbox')
      fireEvent.change(input, { target: { value: gap } })
      fireEvent.click(screen.getByRole('button', { name: /Проверить/ }))
      expect(await screen.findByText('Верно!')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /^Дальше/ }))
    }
    // разогрев/построение/слух пусты: «Речь» — шаг 2 из 3, первая сценка
    expect(await screen.findByText('Речь · шаг 2 из 3')).toBeInTheDocument()
    expect(screen.getByText(/Раунд 1 из 2 — Путешествия: опыт/)).toBeInTheDocument()
    expect(screen.getByText('Have you ever been abroad?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Сказал своими словами' })).toBeInTheDocument()
    // самопроверка проходит сцену без распознавания (свобода важнее точности)
    fireEvent.click(screen.getByRole('button', { name: 'Сказал своими словами' }))
    expect(await screen.findByText('Which one did you like best?')).toBeInTheDocument()
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
    // фразы урока материализованы карточками en-ru (rule-1); чанк-фразы — ещё и chunk (Q2.2)
    const cards = await repo.getAllCards()
    const phraseCards = cards.filter((card) => card.note_id.startsWith('note_ph-e-'))
    expect(phraseCards.length).toBeGreaterThanOrEqual(40)
    expect(phraseCards.every((card) => card.type === 'en-ru' || card.type === 'chunk')).toBe(true)
    expect(phraseCards.some((card) => card.type === 'chunk')).toBe(true)
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
      // не пускает дальше, «Дальше» из упражнения — no-op (specs/02 §2).
      // Listening-плашка (M21#21.1) — необязывающее предложение: её «Повторить
      // шаг» не нажимаем (проход с неверными ответами зациклится), идём «Дальше».
      const repeatNow = screen.queryByRole('button', { name: /^Повторить шаг/ })
      if (repeatNow && screen.queryByText(/Шаг не пройден/)) {
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
    let seenListeningRetry = false
    for (let step = 0; step < 1200 && !done; step += 1) {
      await waitFor(() => undefined, { timeout: 20 })
      if (screen.queryByText(/Слух просел/)) seenListeningRetry = true
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
    // слух <60% при неверных ответах → плашка-предложение показана (M21#21.1)
    expect(seenListeningRetry).toBe(true)
    // видео урока E-01 присутствует на финале
    expect(screen.getByRole('link', { name: 'YouTube' })).toHaveAttribute(
      'href',
      expect.stringContaining('youtube.com/watch'),
    )
  }, 45000)
})

// Implements: plan://M21#21.4 — сведение непокрытых statements экрана урока к нулю.
// Хвосты: озвучка правила, SRS-статистика финала, споры, повтор шага, unmount-гонки,
// проход по ошибкам, шорткаты в фазах без заданий, роутер упражнений.
describe('LessonScreen: хвосты покрытия (M21#21.4)', () => {
  const lessonErrorText = 'Не удалось загрузить урок или сохранить прогресс. Попробуй снова.'

  function fakeCard(overrides: Partial<CardState> = {}): CardState {
    const now = new Date().toISOString()
    return {
      card_id: 'card-x.en-ru',
      note_id: 'note_x',
      type: 'en-ru',
      deck: 'phrases',
      due: now,
      stability: 5,
      difficulty: 5,
      elapsed_days: 1,
      scheduled_days: 10,
      reps: 3,
      lapses: 0,
      state: 2,
      last_review: now,
      suspended: false,
      cloze_index: null,
      created_at: now,
      updated_at: now,
      ...overrides,
    }
  }

  /** Чекпоинт «весь урок отвечен верно, шаг 7» — курс на финал через guard. */
  async function seedRowStep7() {
    const view = await loadLessonView('les-e-01')
    if (!view) throw new Error('нет данных урока les-e-01')
    const allExercises = view.steps.flatMap((step) => view.content[step.index] ?? [])
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
          allExercises.map(({ exercise }) => [
            exercise.id,
            { attempts: 1, outcome: 'correct' as const },
          ]),
        ),
      },
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
  }

  async function finishViaDeck() {
    fireEvent.click(await screen.findByRole('button', { name: /Продолжить/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Завершить урок/ }))
    expect(await screen.findByText('Урок завершён')).toBeInTheDocument()
  }

  /** Repo-обёртка с делегированием по прототипу (замена отдельных методов). */
  function repoWith(methods: Partial<ProgressRepository>): ProgressRepository {
    const wrapped = Object.create(repo) as ProgressRepository
    return Object.assign(wrapped, methods)
  }

  function syntheticExercise(
    id: string,
    type: string,
    payload: Record<string, unknown> = {},
  ): ExerciseItem {
    return {
      id,
      type,
      payload: { kind: type, ...payload },
      answer: { normalization: 'default', typo: 'allow' },
      meta: { skill: 'grammar', xp: 2 },
    }
  }

  function syntheticLessonView(
    exercise: ExerciseItem,
    phrasesById: Record<string, PhraseItem> = {},
  ): LessonView {
    return {
      lesson: {
        id: 'les-e-01',
        rank: 'E',
        module: 'mod-e-1',
        title: 'Синтетический урок',
        grammar_point: {
          id: 'gp-e-01',
          title_ru: 'Синтетика',
          rule_md: 'правило',
          phrase_ids: [],
          trap_id: null,
        },
        vocab_band: null,
        phrasebook_topic: null,
        trap_id: null,
        quotes_topic: null,
        exercises: [{ id: exercise.id }],
        bebris_video: null,
      },
      steps: [
        { index: 1, kind: 'build', exerciseIds: [exercise.id] },
        { index: 7, kind: 'deck', exerciseIds: [] },
      ],
      content: { 1: [{ exercise, phrase: null }] },
      phrasesById,
    }
  }

  it('правило: 🔊-кнопка примера озвучивает эталонную фразу (specs/02 §2)', async () => {
    renderScreen('E-01')
    const audioButtons = await screen.findAllByRole('button', { name: /🔊/ })
    expect(audioButtons.length).toBeGreaterThan(0)
    fireEvent.click(audioButtons[0]!)
    expect(vi.mocked(speak)).toHaveBeenCalledWith(
      'Hello!',
      expect.objectContaining({ src: expect.stringContaining('audio/') }),
    )
  })

  it('загрузка: unmount до ответа данных — без setState после размонтирования (гонка)', async () => {
    window.location.hash = '#/lesson/E-99'
    const handle = render(
      <HashRouter>
        <Routes>
          <Route path="/lesson/:id" element={<LessonScreen repo={repo} />} />
        </Routes>
      </HashRouter>,
    )
    handle.unmount()
    // даём load() дозреть после unmount: alive-guard обязан прервать фазу
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(document.querySelector('.lesson-panel')).toBeNull()
  })

  it('загрузка: unmount при чтении прогресса — ранний возврат (гонка)', async () => {
    let release!: (value: null) => void
    const gated = repoWith({
      getLessonProgress: () =>
        new Promise<null>((resolve) => {
          release = resolve
        }),
    })
    const handle = renderScreen('E-01', gated)
    await waitFor(() => expect(release).toBeDefined())
    handle.unmount()
    release(null)
    await new Promise((resolve) => setTimeout(resolve, 50))
    // ранний возврат: фаза не переведена, приложение не падает
    expect(document.querySelector('.lesson-panel')).toBeNull()
  })

  it('загрузка: падение сборки урока → error-фаза (specs/07 §4.1)', async () => {
    lessonModuleFlags.failLoadLessonView = true
    try {
      renderScreen('E-01')
      expect(await screen.findByText(lessonErrorText, {}, { timeout: 5000 })).toBeInTheDocument()
    } finally {
      lessonModuleFlags.failLoadLessonView = false
    }
  })

  it('урок без шагов → error-фаза (защитная ветка пустого шаблона)', async () => {
    const view = await loadLessonView('les-e-01')
    if (!view) throw new Error('нет данных урока les-e-01')
    renderScreen('E-01', repo, { ...view, steps: [] })
    expect(await screen.findByText(lessonErrorText, {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('спор «Я был прав» перезаписывает исход на disputed (specs/02 §4.6)', async () => {
    renderScreen('E-01')
    fireEvent.click(await screen.findByRole('button', { name: /Понятно/ }))
    const input = await screen.findByRole('textbox')
    for (const wrong of ['xxx', 'yyy', 'zzz']) {
      fireEvent.change(input, { target: { value: wrong } })
      fireEvent.click(screen.getByRole('button', { name: /Проверить/ }))
      if (wrong !== 'zzz') {
        fireEvent.click(await screen.findByRole('button', { name: /Ещё попытка/ }))
      }
    }
    // cloze исчерпал 3 попытки → вердикт wrong → доступен спор
    fireEvent.click(await screen.findByRole('button', { name: /Я был прав/ }))
    expect(await screen.findByText(/ответ оспорен/)).toBeInTheDocument()
    await waitFor(async () => {
      const row = await repo.getLessonProgress('les-e-01')
      expect(row?.checkpoint.results['ex-e-0001']).toMatchObject({ outcome: 'disputed' })
    })
  })

  it('разогрев <70%: «Повторить шаг» сбрасывает блок (specs/02 §2)', async () => {
    const view = await loadLessonView('les-e-01')
    if (!view) throw new Error('нет данных урока les-e-01')
    const warmup = view.content[2] ?? []
    expect(warmup.length).toBe(5)
    const firstPayload = warmup[0]?.exercise.payload as unknown as {
      options: string[]
      correct: number
    }
    const wrongFirst = firstPayload.options.find((_, index) => index !== firstPayload.correct) ?? ''
    renderScreen('E-01')
    fireEvent.click(await screen.findByRole('button', { name: /Понятно/ }))
    // шаг 1 — три cloze правила: отвечаем верно, чтобы дойти до разогрева
    for (const { exercise } of view.content[1] ?? []) {
      const answers = exercise.payload.gap_answers as string[]
      const input = await screen.findByRole('textbox')
      fireEvent.change(input, { target: { value: answers[0] ?? 'am' } })
      fireEvent.click(screen.getByRole('button', { name: /Проверить/ }))
      fireEvent.click(await screen.findByRole('button', { name: /^Дальше/ }))
    }
    // 4 choose_translation — намеренно неверно (исход skip, не first-try)
    for (let index = 0; index < 4; index += 1) {
      const payload = warmup[index]?.exercise.payload as unknown as {
        options: string[]
        correct: number
      }
      const wrong = payload.options.find((_, optionIndex) => optionIndex !== payload.correct) ?? ''
      fireEvent.click(await screen.findByRole('button', { name: wrong }))
      fireEvent.click(await screen.findByRole('button', { name: /^Дальше/ }))
    }
    // match_pairs: одна ошибка, затем достройка — исход correct_retry
    const pairs = (
      warmup[4]?.exercise.payload as unknown as { pairs: { en: string; ru: string }[] }
    ).pairs
    fireEvent.click(await screen.findByRole('button', { name: pairs[0]!.ru }))
    fireEvent.click(screen.getByRole('button', { name: pairs[1]!.en }))
    for (const { en, ru } of pairs) {
      fireEvent.click(screen.getByRole('button', { name: ru }))
      fireEvent.click(screen.getByRole('button', { name: en }))
    }
    // фиксация исхода матча — «Дальше» (onAnswer correct_retry + переход)
    fireEvent.click(await screen.findByRole('button', { name: /^Дальше/ }))
    // 0 верных с первой попытки из 5 → блок не пройден
    expect(await screen.findByText(/Шаг не пройден/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Повторить шаг/ }))
    // блок сброшен: первое задание разогрева заново, плашка ушла
    expect(await screen.findByRole('button', { name: wrongFirst })).toBeInTheDocument()
    expect(screen.queryByText(/Шаг не пройден/)).not.toBeInTheDocument()
  })

  it('финал: SRS-статистика фраз — выучено/просело/чужие карточки (specs/02 §5)', async () => {
    const view = await loadLessonView('les-e-01')
    if (!view) throw new Error('нет данных урока les-e-01')
    const pool = Object.values(view.phrasesById).filter(
      (phrase) => phrase.grammar_point_id === view.lesson.grammar_point.id,
    )
    expect(pool.length).toBeGreaterThanOrEqual(40)
    // все фразы урока «выучены» (state 2, интервал ≥7 дней), первая просела
    await repo.ensureCards(
      pool.map((phrase, index) =>
        fakeCard({
          card_id: `${phrase.id}.en-ru`,
          note_id: `note_${phrase.id}`,
          state: 2,
          scheduled_days: index === 0 ? 2 : 10,
        }),
      ),
    )
    // посторонние карточки не попадают в статистику урока
    await repo.ensureCards([
      fakeCard({ card_id: 'word-house.en-ru', note_id: 'note_house-noun', deck: 'words' }),
      fakeCard({ card_id: 'no-prefix.en-ru', note_id: 'ph-e-02-0001' }),
      fakeCard({ card_id: 'ph-e-02-0001.en-ru', note_id: 'note_ph-e-02-0001' }),
    ])
    await seedRowStep7()
    renderScreen('E-01')
    await finishViaDeck()
    const row = await repo.getLessonProgress('les-e-01')
    // 39/40 выучено (≥90%), точность 100%, просевших <30% → completed (specs/02 §5)
    expect(row?.status).toBe('completed')
    expect(row?.completed_at).not.toBeNull()
  })

  it('финал: седьмой день стрика даёт заморозку и тост (M10)', async () => {
    const now = new Date()
    await repo.putStats({
      ...emptyStats(now.toISOString()),
      streak_current: 6,
      freezes_left: 2,
      last_counted_day: new Date(now.getTime() - 86_400_000).toISOString(),
    })
    await repo.putQuestDay(createQuestDay(dayStart(now).toISOString(), 0))
    await seedRowStep7()
    renderScreen('E-01')
    await finishViaDeck()
    const stats = await repo.getStats()
    expect(stats.streak_current).toBe(7)
    expect(stats.freezes_left).toBe(3)
    expect(vi.mocked(showToast)).toHaveBeenCalledWith('Получена заморозка стрика: ❄ +1')
  })

  it('финал: фантомные id в чекпоинте — XP-хвосты и пустой проход по ошибкам (M21#21.4)', async () => {
    await repo.putLessonProgress({
      lesson_id: 'les-e-01',
      status: 'in_progress',
      score: null,
      checkpoint: {
        passIndex: 0,
        stepIndex: 7,
        scores: [],
        srsEnqueued: [],
        passesDone: 0,
        results: {
          'ex-ghost-a': { attempts: 1, outcome: 'correct' },
          'ex-ghost-b': { attempts: 2, outcome: 'correct_retry' },
        },
      },
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    renderScreen('E-01')
    fireEvent.click(await screen.findByRole('button', { name: /Продолжить/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Завершить урок/ }))
    expect(await screen.findByText('Урок завершён')).toBeInTheDocument()
    // фантомный id не резолвится в упражнение → защитный экран пустого повтора
    fireEvent.click(screen.getByRole('button', { name: 'Повторить ошибочные (1)' }))
    expect(await screen.findByText('Ошибок не осталось.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'К финалу урока' }))
    expect(await screen.findByText('Урок завершён')).toBeInTheDocument()
  })

  it('проход по ошибкам: ответ, спор, выход и финал повтора (M11#11.3)', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Повторить ошибочные (2)' }))

    const failCloze = async () => {
      const input = await screen.findByRole('textbox')
      for (const wrong of ['xxx', 'yyy', 'zzz']) {
        fireEvent.change(input, { target: { value: wrong } })
        fireEvent.click(screen.getByRole('button', { name: /Проверить/ }))
        if (wrong !== 'zzz') {
          fireEvent.click(await screen.findByRole('button', { name: /Ещё попытка/ }))
        }
      }
    }

    await failCloze()
    // «Дальше» в повторе — к заданию 2 из 2
    fireEvent.click(await screen.findByRole('button', { name: /^Дальше/ }))
    expect(await screen.findByText('задание 2 из 2')).toBeInTheDocument()
    // ✕ — выход из повтора на финал
    fireEvent.click(screen.getByRole('button', { name: '✕ Выход' }))
    expect(await screen.findByText('Урок завершён')).toBeInTheDocument()

    // повторный заход: доделываем оба задания до конца
    fireEvent.click(screen.getByRole('button', { name: 'Повторить ошибочные (2)' }))
    await failCloze()
    fireEvent.click(await screen.findByRole('button', { name: /^Дальше/ }))
    expect(await screen.findByText('задание 2 из 2')).toBeInTheDocument()
    await failCloze()
    // спор в повторе: onDispute — no-op (исходы повтора не пишутся, M11#11.3)
    fireEvent.click(await screen.findByRole('button', { name: /Я был прав/ }))
    fireEvent.click(await screen.findByRole('button', { name: /^Дальше/ }))
    expect(await screen.findByText('Урок завершён')).toBeInTheDocument()
    expect(vi.mocked(showToast)).toHaveBeenCalledWith(
      'Ошибочные задания пройдены. Система довольна.',
    )
  })

  it('финал: unmount на постановке в колоду — ранний возврат без записи финала', async () => {
    await seedRowStep7()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const slow = repoWith({
      ensureCards: async () => {
        await gate
      },
    })
    const handle = renderScreen('E-01', slow)
    fireEvent.click(await screen.findByRole('button', { name: /Продолжить/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Завершить урок/ }))
    handle.unmount()
    release()
    await new Promise((resolve) => setTimeout(resolve, 50))
    const row = await repo.getLessonProgress('les-e-01')
    // ранний возврат: чекпоинт финала (passesDone 1) не записан
    expect(row?.checkpoint.passesDone).toBe(0)
    expect(row?.status).toBe('in_progress')
  })

  it('финал: unmount при чтении карточек — ранний возврат (гонка)', async () => {
    await seedRowStep7()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const slow = repoWith({
      getAllCards: async () => {
        await gate
        return repo.getAllCards()
      },
    })
    const handle = renderScreen('E-01', slow)
    fireEvent.click(await screen.findByRole('button', { name: /Продолжить/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Завершить урок/ }))
    handle.unmount()
    release()
    await new Promise((resolve) => setTimeout(resolve, 50))
    const row = await repo.getLessonProgress('les-e-01')
    expect(row?.checkpoint.passesDone).toBe(0)
  })

  it('финал: unmount при записи квеста — ранний возврат (гонка)', async () => {
    await seedRowStep7()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const slow = repoWith({
      putQuestDay: async (state: Parameters<ProgressRepository['putQuestDay']>[0]) => {
        await gate
        return repo.putQuestDay(state)
      },
    })
    const handle = renderScreen('E-01', slow)
    fireEvent.click(await screen.findByRole('button', { name: /Продолжить/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Завершить урок/ }))
    // прогресс финала записан ДО начисления квеста
    await waitFor(async () => {
      const row = await repo.getLessonProgress('les-e-01')
      expect(row?.checkpoint.passesDone).toBe(1)
    })
    handle.unmount()
    release()
    await new Promise((resolve) => setTimeout(resolve, 50))
  })

  it('финал: ошибка постановки в колоду → error-фаза (specs/07 §4.1)', async () => {
    await seedRowStep7()
    const broken = repoWith({
      ensureCards: async () => {
        throw new Error('колода недоступна (тест)')
      },
    })
    renderScreen('E-01', broken)
    fireEvent.click(await screen.findByRole('button', { name: /Продолжить/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Завершить урок/ }))
    expect(await screen.findByText(lessonErrorText, {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('шаг «В колоду»: Enter не двигает фазу (specs/07 §5.1)', async () => {
    await seedRowStep7()
    renderScreen('E-01')
    fireEvent.click(await screen.findByRole('button', { name: /Продолжить/ }))
    expect(await screen.findByText('В колоду')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByText('В колоду')).toBeInTheDocument()
  })

  it('Enter в шаге двигает «Дальше» по заданиям (specs/07 §5.1)', async () => {
    renderScreen('E-01')
    fireEvent.click(await screen.findByRole('button', { name: /Понятно/ }))
    const input = await screen.findByRole('textbox')
    fireEvent.change(input, { target: { value: 'am' } })
    fireEvent.click(screen.getByRole('button', { name: /Проверить/ }))
    expect(await screen.findByText('Верно!')).toBeInTheDocument()
    // Enter вне контролов = «Дальше»: первое правило → второй cloze
    fireEvent.keyDown(window, { key: 'Enter' })
    const nextInput = await screen.findByRole('textbox')
    expect(nextInput).toHaveValue('')
  })

  it('Esc из поля ввода не открывает подтверждение выхода (specs/07 §5.1)', async () => {
    renderScreen('E-01')
    fireEvent.click(await screen.findByRole('button', { name: /Понятно/ }))
    const input = await screen.findByRole('textbox')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('неизвестный тип упражнения → заглушка роутера (защита specs/05 §3)', async () => {
    const view = syntheticLessonView(syntheticExercise('ex-mystery', 'mystery_kind'))
    renderScreen('E-01', repo, view)
    expect(
      await screen.findByText('Неизвестный тип упражнения: mystery_kind', {}, { timeout: 5000 }),
    ).toBeInTheDocument()
    // «Дальше» из заглушки: шаг не пройден → переход заблокирован, экран жив
    fireEvent.click(screen.getByRole('button', { name: /^Дальше/ }))
    expect(screen.getByText('Неизвестный тип упражнения: mystery_kind')).toBeInTheDocument()
  })

  it('transform-упражнение рендерится роутером (specs/02 §3 №14)', async () => {
    const phrasesById: Record<string, PhraseItem> = {
      'ph-s-0001': {
        id: 'ph-s-0001',
        text_en: 'He is happy.',
        translation_ru: 'Он счастлив.',
        grammar_point_id: 'gp-e-01',
        variants: ['He is happy.'],
      },
      'ph-s-0002': {
        id: 'ph-s-0002',
        text_en: 'He is not happy.',
        translation_ru: 'Он не счастлив.',
        grammar_point_id: 'gp-e-01',
        variants: ["He isn't happy.", 'He is not happy.'],
      },
    }
    const view = syntheticLessonView(
      syntheticExercise('ex-tr-synth', 'transform', {
        source_phrase_id: 'ph-s-0001',
        steps: [{ task: 'negative', phrase_id: 'ph-s-0002' }],
      }),
      phrasesById,
    )
    renderScreen('E-01', repo, view)
    expect(
      await screen.findByText('Трансформация · шаг 1 из 1', {}, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(screen.getByText('He is happy.')).toBeInTheDocument()
  })

  it('повтор урока без содержательных шагов: Enter проходит через гарду «Дальше»', async () => {
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
    const view = await loadLessonView('les-e-01')
    if (!view) throw new Error('нет данных урока les-e-01')
    const deckOnly: LessonView = { ...view, steps: view.steps.filter((step) => step.index === 7) }
    renderScreen('E-01', repo, deckOnly)
    expect(
      await screen.findByText(
        'Урок уже пройден. Хочешь пройти его повторно?',
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Пройти повторно' }))
    // фаза step при отсутствии шага 1: Enter проходит через гарду handleNext
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByText(/шаг 1 из 1/)).toBeInTheDocument()
  })

  it('curiosity: зацепка — первая строка шага правила (план {#teaching-quality} Q1.2)', async () => {
    renderScreen('E-01')
    expect(await screen.findByText(/Любопытно:/)).toBeInTheDocument()
    expect(screen.getByText(/русского глагола нет/)).toBeInTheDocument()
  })

  it('Mayer signaling (Q2.3): формула и «Проверь себя» — сигнальные блоки правила', async () => {
    renderScreen('E-01')
    expect(await screen.findByText(/Формула: кто \+ am \/ is \/ are/)).toBeInTheDocument()
    const formula = screen.getByText(/Формула:/).closest('p')
    expect(formula).toHaveClass('lesson-formula')
    const selfCheck = screen.getByText(/Проверь себя:/).closest('p')
    expect(selfCheck).toHaveClass('lesson-check-self')
    // ловушка остаётся золотой строкой (сигнал-нарушение)
    expect(screen.getByText(/Ловушка ЛТ-01/).closest('p')).toHaveClass('lesson-trap')
  })

  it('curiosity: клиффхэнгер на шаге 7 «В колоду» (план {#teaching-quality} Q1.2)', async () => {
    await seedRowStep7()
    const view = await loadLessonView('les-e-01')
    if (!view) throw new Error('нет данных урока les-e-01')
    renderScreen('E-01', repo, view)
    fireEvent.click(await screen.findByRole('button', { name: /Продолжить/ }))
    expect(await screen.findByText('В колоду')).toBeInTheDocument()
    expect(screen.getByText(/Что дальше/)).toBeInTheDocument()
    expect(screen.getByText(/превратить предмет в «предмет вообще»/)).toBeInTheDocument()
  })

  it('curiosity: поле отсутствует — блоки не рендерятся (синтетика без поля)', async () => {
    const view = await loadLessonView('les-e-01')
    if (!view) throw new Error('нет данных урока les-e-01')
    const bare: LessonView = { ...view, lesson: { ...view.lesson, curiosity: null } }
    renderScreen('E-01', repo, bare)
    expect(await screen.findByText('Понятно')).toBeInTheDocument()
    expect(screen.queryByText(/Любопытно:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Что дальше/)).not.toBeInTheDocument()
  })

  it('адаптивная презентация серии (Q2.1): 6+ верных → challenge, word_bank текстом', async () => {
    const view = await loadLessonView('les-e-01')
    if (!view) throw new Error('нет данных урока les-e-01')
    // чекпоинт: правило и разогрев отвечены без ошибок, текущий шаг — построение
    const scores = view.steps.map((step) => ({
      stepIndex: step.index,
      total: (view.content[step.index] ?? []).length,
      answered: step.index < 3 ? (view.content[step.index] ?? []).length : 0,
      firstTryCorrect: step.index < 3 ? (view.content[step.index] ?? []).length : 0,
    }))
    const results: Record<string, { attempts: number; outcome: 'correct' }> = {}
    for (const step of view.steps) {
      if (step.index >= 3) break
      for (const { exercise } of view.content[step.index] ?? []) {
        results[exercise.id] = { attempts: 1, outcome: 'correct' }
      }
    }
    const buildStep = view.steps.find((step) => step.kind === 'build')
    if (!buildStep) throw new Error('в E-01 нет шага построения')
    await repo.putLessonProgress({
      lesson_id: 'les-e-01',
      status: 'in_progress',
      score: null,
      checkpoint: {
        passIndex: 0,
        stepIndex: buildStep.index,
        scores,
        srsEnqueued: [],
        passesDone: 0,
        results,
      },
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    renderScreen('E-01', repo, view)
    fireEvent.click(await screen.findByRole('button', { name: /Продолжить/ }))
    // бейдж режима вызова в шапке
    expect(await screen.findByText(/режим вызова/)).toBeInTheDocument()
    // первое задание построения E-01 — word_bank: в challenge ввод текстом, плиток нет
    const input = await screen.findByRole('textbox')
    expect(input).toBeInTheDocument()
    expect(document.querySelector('.lesson-bank')).toBeNull()
  })
})
