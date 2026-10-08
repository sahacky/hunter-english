// Фидбей разработчика 2026-10-05: «застрял на 3 шаге E-01, кнопка „Дальше“ перестала
// нажиматься». Драйвер полного прохода урока: идёт по всем шагам, отвечая верно;
// зависание (экран не меняется) — падение с дампом экрана.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import '../i18n'
import { loadLessonView, type ExerciseItem, type LessonView } from '../content/lessons'
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
  db = new HunterDb(`hunter-e01-pass-${uuidv7()}`)
  repo = new DexieProgressRepository(db)
})

const idle = () => new Promise((resolve) => setTimeout(resolve, 20))

function clickButton(name: string | RegExp): boolean {
  const btn = screen.queryAllByRole('button', { name }).find((b) => !b.hasAttribute('disabled'))
  if (!btn) return false
  fireEvent.click(btn)
  return true
}

/** Текущее упражнение по data-якорю (если ещё в шаге). */
function currentExercise(view: LessonView): ExerciseItem | undefined {
  const id = document.querySelector('[data-exercise-id]')?.getAttribute('data-exercise-id')
  if (!id) return undefined
  return Object.values(view.content)
    .flat()
    .find(({ exercise }) => exercise.id === id)?.exercise
}

function answerFor(exercise: ExerciseItem | undefined, view: LessonView): string {
  if (!exercise) return ''
  const phrase = view.phrasesById[String(exercise.payload.phrase_id ?? '')]
  const gap = exercise.payload.gap_answers as string[] | undefined
  if (['translate', 'dictation', 'find_error'].includes(exercise.type)) return phrase?.text_en ?? ''
  if (gap && gap.length > 0) return gap[0]
  return ''
}

/** Один шаг драйвера: находит знакомый контрол и действует. true — было действие. */
function driveTick(view: LessonView): boolean {
  if (screen.queryByText('В колоду')) return clickButton(/Завершить урок/)
  if (screen.queryByRole('button', { name: /Понятно/ })) return clickButton(/Понятно/)
  // микрофон в jsdom недоступен — самопроверка доступна сразу
  if (clickButton(/Сказал своими словами|Сказал\(-а\)/)) return true

  const exercise = currentExercise(view)
  const input = document.querySelector<HTMLInputElement>('.lesson-input:not([disabled])')

  if (exercise?.type === 'word_bank' && input) {
    // challenge-режим (Q2.1): ввод по памяти
    const phrase = view.phrasesById[String(exercise.payload.phrase_id)]
    if (!phrase) return false
    fireEvent.change(input, { target: { value: phrase.text_en } })
    fireEvent.submit(input.closest('form')!)
    return true
  }

  if (input) {
    const answer = answerFor(exercise, view)
    if (!answer) return false
    fireEvent.change(input, { target: { value: answer } })
    fireEvent.submit(input.closest('form')!)
    return true
  }

  if (exercise?.type === 'word_bank') {
    // плитки: очередное слово эталона, кликаемое в банке
    const phrase = view.phrasesById[String(exercise.payload.phrase_id)]
    const next = phrase?.text_en
      .split(' ')
      .map((w) => w.replace(/[.,!?]/g, ''))
      .find((w) =>
        screen
          .queryAllByRole('button', { name: w })
          .some(
            (b) =>
              !b.hasAttribute('disabled') &&
              b.className.includes('lesson-tile') &&
              !b.className.includes('lesson-tile-slot'),
          ),
      )
    if (next) return clickButton(next)
  }

  if (exercise?.type === 'choose_translation') {
    const options = exercise.payload.options as string[]
    const correct = options[exercise.payload.correct as number] ?? ''
    // отвеченная опция disabled — падаем сквозь к «Дальше» (без раннего return)
    if (clickButton(correct)) return true
  }

  if (exercise?.type === 'match_pairs') {
    const pairs = exercise.payload.pairs as { en: string; ru: string }[]
    const pair = pairs.find(({ en }) =>
      screen.queryAllByRole('button', { name: en }).some((b) => !b.hasAttribute('disabled')),
    )
    if (pair) {
      clickButton(pair.en)
      return clickButton(pair.ru)
    }
  }

  if (clickButton(/К следующему шагу/)) return true
  if (clickButton(/^Дальше/)) return true
  return clickButton(/Ещё попытка/)
}

describe('LessonScreen: полный проход E-01 (фидбей: застревание на шаге 3)', () => {
  it('драйвер доходит до финала, «Дальше» не залипает', async () => {
    const view = await loadLessonView('les-e-01')
    if (!view) throw new Error('нет данных les-e-01')
    window.location.hash = '#/lesson/E-01'
    render(
      <HashRouter>
        <Routes>
          <Route path="/lesson/:id" element={<LessonScreen repo={repo} view={view} />} />
        </Routes>
      </HashRouter>,
    )
    expect(await screen.findByText(/to be: am \/ is \/ are/)).toBeInTheDocument()

    let stuck = 0
    let lastSnapshot = ''
    const log: string[] = []
    for (let tick = 0; tick < 400; tick += 1) {
      if (screen.queryByText('Урок завершён')) break
      const before = document.querySelector('[data-exercise-id]')?.getAttribute('data-exercise-id')
      const acted = driveTick(view)
      await idle()
      const snapshot = document.body.textContent?.slice(0, 300) ?? ''
      const after = document.querySelector('[data-exercise-id]')?.getAttribute('data-exercise-id')
      log.push(
        `${tick}: ${before}→${after} acted=${acted} ${snapshot.slice(0, 180).replace(/\s+/g, ' ')}`,
      )
      stuck = snapshot === lastSnapshot ? stuck + 1 : 0
      lastSnapshot = snapshot
      if (stuck > 12) {
        const cur = currentExercise(view)
        const step = view.steps.find((s) => s.index === 2)
        const pos = step?.exerciseIds.indexOf(String(cur?.id)) ?? -1
        throw new Error(
          `урок завис (тик ${tick}): упр ${cur?.id} [${pos + 1}/${step?.exerciseIds.length}] шаг 2\nлог:\n${log.slice(-18).join('\n')}`,
        )
      }
      if (!acted) await waitFor(() => undefined, { timeout: 200 })
    }
    expect(screen.getByText('Урок завершён')).toBeInTheDocument()
  }, 60000)
})
