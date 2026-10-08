// Фидбей 2026-10-08: «Дальше» мертва на последнем задании шага — чекпоинт с
// отстающим счётчиком (answered < total при полных results). Самовосстановление
// handleNext форсит переход, когда всё отвечено.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import '../i18n'
import { loadLessonView, type LessonView } from '../content/lessons'
import type { ExerciseResult, LessonCheckpoint } from '../domain/lesson/types'
import { HunterDb } from '../data/db'
import { DexieProgressRepository } from '../data/progress-repository'
import { uuidv7 } from '../lib/uuidv7'
import LessonScreen from './LessonScreen'

vi.mock('../lib/tts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/tts')>()),
  speak: vi.fn(),
  stopSpeak: vi.fn(),
}))
vi.mock('../lib/toast', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/toast')>()),
  showToast: vi.fn(),
}))

let db: HunterDb
let repo: DexieProgressRepository

beforeEach(() => {
  db = new HunterDb(`hunter-heal-${uuidv7()}`)
  repo = new DexieProgressRepository(db)
})

function renderScreen(view: LessonView) {
  window.location.hash = '#/lesson/E-01'
  return render(
    <HashRouter>
      <Routes>
        <Route path="/lesson/:id" element={<LessonScreen repo={repo} view={view} />} />
      </Routes>
    </HashRouter>,
  )
}

describe('самовосстановление перехода шага (фидбей 2026-10-08)', () => {
  it('счётчик отстаёт, results полны — «Дальше» не молчит, шаг идёт дальше', async () => {
    const view = await loadLessonView('les-e-01')
    if (!view) throw new Error('нет данных les-e-01')
    // «сломанный» чекпоинт: шаг 3, все 28 построений отвечены,
    // но счётчик answered = 27 (одно не досчиталось — гонка/старая запись)
    const build = view.steps.find((s) => s.kind === 'build')!
    const results: Record<string, ExerciseResult> = {}
    for (const id of build.exerciseIds) results[id] = { attempts: 1, outcome: 'correct' }
    const checkpoint: LessonCheckpoint = {
      passIndex: 0,
      stepIndex: build.index,
      scores: [
        { stepIndex: 1, total: 3, answered: 3, firstTryCorrect: 3 },
        { stepIndex: 2, total: 5, answered: 5, firstTryCorrect: 5 },
        {
          stepIndex: build.index,
          total: build.exerciseIds.length,
          answered: 27,
          firstTryCorrect: 27,
        },
      ],
      srsEnqueued: [],
      passesDone: 0,
      results,
    }
    await repo.putLessonProgress({
      lesson_id: 'les-e-01',
      status: 'in_progress',
      score: null,
      checkpoint,
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    renderScreen(view)
    fireEvent.click(await screen.findByRole('button', { name: /Продолжить/ }, { timeout: 4000 }))
    // идём по построению — ведёмся ЭКРАНОМ (id из DOM), не списком
    const seen = new Set<string>()
    for (let guard = 0; guard < 90; guard++) {
      const head = document.querySelector('.lesson-head .dim')?.textContent ?? ''
      if (head.includes('шаг 4')) break
      const id = document.querySelector('[data-exercise-id]')?.getAttribute('data-exercise-id')
      if (!id || seen.has(id)) {
        // сводка шага открыта (id не меняется) — переходим с неё
        const goNext = screen.queryByRole('button', { name: /К следующему шагу/ })
        if (goNext) fireEvent.click(goNext)
        await new Promise((r) => setTimeout(r, 10))
        continue
      }
      seen.add(id)
      const resolved =
        Object.values(view.content)
          .flat()
          .find(({ exercise }) => exercise.id === id)?.exercise ?? null
      if (!resolved) break
      const phrase =
        view.phrasesById[String((resolved.payload as { phrase_id?: string }).phrase_id ?? '')]
      if (resolved.type === 'word_bank') {
        await waitFor(() => expect(screen.queryByRole('textbox')).toBeTruthy())
        const input = screen.getByRole('textbox')
        fireEvent.change(input, { target: { value: phrase?.text_en ?? 'I am hungry.' } })
        fireEvent.submit(input.closest('form')!)
      } else if (resolved.type === 'speak') {
        fireEvent.click(await screen.findByRole('button', { name: 'Сказал(-а)' }))
      } else {
        const gap = (resolved.payload as { gap_answers?: string[] }).gap_answers
        const input = await screen.findByRole('textbox')
        fireEvent.change(input, {
          target: { value: gap?.[0] ?? phrase?.text_en ?? 'I am hungry.' },
        })
        fireEvent.submit(input.closest('form')!)
      }
      for (let tick = 0; tick < 40; tick++) {
        const goNext = screen.queryByRole('button', { name: /К следующему шагу/ })
        const next = goNext ?? screen.queryByRole('button', { name: /^Дальше/ })
        if (next) {
          fireEvent.click(next)
          break
        }
        const nowId = document.querySelector('[data-exercise-id]')?.getAttribute('data-exercise-id')
        if (nowId && nowId !== id) break
        await new Promise((r) => setTimeout(r, 10))
      }
    }
    // без фикса здесь мёртвый «Дальше»: шаг 3 не пройден при answered 27/28
    expect(await screen.findByText(/шаг 4 из 7/, {}, { timeout: 4000 })).toBeInTheDocument()
  }, 60000)
})
