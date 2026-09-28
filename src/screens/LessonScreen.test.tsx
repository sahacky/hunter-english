// Implements: plan://M5#5.5–5.6 — тесты экрана урока на данных пилота E1 (specs/02 §2, §5)
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
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
