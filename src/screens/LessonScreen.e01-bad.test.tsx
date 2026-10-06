// Фидбей 2026-10-06: «шаг 3, режим поддержки, после спора „Дальше“ не работает».
// Драйвер «плохого» пользователя: все ответы неверные + спор «Я был прав» на каждом
// find_error/translate, самопроверки на голосовых — до конца урока. Застревание = дамп.
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
  db = new HunterDb(`hunter-e01-bad-${uuidv7()}`)
  repo = new DexieProgressRepository(db)
})

const idle = () => new Promise((resolve) => setTimeout(resolve, 20))

function clickButton(name: string | RegExp): boolean {
  const btn = screen.queryAllByRole('button', { name }).find((b) => !b.hasAttribute('disabled'))
  if (!btn) return false
  fireEvent.click(btn)
  return true
}

function currentExercise(view: LessonView): ExerciseItem | undefined {
  const id = document.querySelector('[data-exercise-id]')?.getAttribute('data-exercise-id')
  if (!id) return undefined
  return Object.values(view.content)
    .flat()
    .find(({ exercise }) => exercise.id === id)?.exercise
}

/** Один тик «плохого» пользователя. */
const badPairDone = new Set<string>()
let smartMode = false // после первого «Повторить шаг» отвечаем верно (сценарий одумавшегося юзера)

function driveTick(view: LessonView): boolean {
  if (screen.queryByText('В колоду')) return clickButton(/Завершить урок/)
  if (screen.queryByRole('button', { name: /Понятно/ })) return clickButton(/Понятно/)

  // спор прежде всего — именно сценарий фидбея
  if (clickButton(/Я был прав/)) return true
  if (clickButton(/Сказал своими словами|Сказал\(-а\)/)) return true

  const exercise = currentExercise(view)
  const input = document.querySelector<HTMLInputElement>('.lesson-input:not([disabled])')

  const phrase = view.phrasesById[String(exercise?.payload.phrase_id ?? '')]
  if (exercise?.type === 'word_bank' && input) {
    fireEvent.change(input, {
      target: { value: smartMode ? (phrase?.text_en ?? 'zzz') : 'zzz wrong' },
    })
    fireEvent.submit(input.closest('form')!)
    return true
  }
  if (input) {
    const gap = exercise?.payload.gap_answers as string[] | undefined
    const good = ['translate', 'dictation', 'find_error'].includes(exercise?.type ?? '')
      ? (phrase?.text_en ?? '')
      : (gap?.[0] ?? '')
    fireEvent.change(input, { target: { value: smartMode ? good || 'zzz' : 'zzz' } })
    fireEvent.submit(input.closest('form')!)
    return true
  }
  if (exercise?.type === 'word_bank') {
    // клик по любой живой банковой плитке дважды (неверная сборка)
    const tile = screen
      .queryAllByRole('button')
      .find(
        (b) =>
          !b.hasAttribute('disabled') &&
          b.className.includes('lesson-tile') &&
          !b.className.includes('lesson-tile-slot'),
      )
    if (tile) {
      fireEvent.click(tile)
      return true
    }
  }
  if (exercise?.type === 'choose_translation') {
    const options = exercise.payload.options as string[]
    const name = smartMode ? options[exercise.payload.correct as number] : null
    const opt = name
      ? screen.queryAllByRole('button', { name }).find((b) => !b.hasAttribute('disabled'))
      : screen
          .queryAllByRole('button')
          .find((b) => b.className.includes('lesson-option') && !b.hasAttribute('disabled'))
    if (opt) {
      fireEvent.click(opt)
      return true
    }
  }
  if (exercise?.type === 'match_pairs') {
    const pairs = exercise.payload.pairs as { en: string; ru: string }[]
    const free = (name: string) =>
      screen.queryAllByRole('button', { name }).some((b) => !b.hasAttribute('disabled'))
    // одна «ошибочная» пара на упражнение, затем верные
    if (!badPairDone.has(exercise.id) && free(pairs[0].en) && free(pairs[1].ru)) {
      badPairDone.add(exercise.id)
      clickButton(pairs[0].en)
      return clickButton(pairs[1].ru)
    }
    const pair = pairs.find(({ en, ru }) => free(en) && free(ru))
    if (pair) {
      clickButton(pair.en)
      return clickButton(pair.ru)
    }
  }
  // word_bank собран — жмём «Проверить»
  if (clickButton(/^Проверить/)) return true
  if (clickButton(/Повторить шаг/)) {
    smartMode = true
    badPairDone.clear()
    return true
  }
  if (clickButton(/^Дальше/)) return true
  return clickButton(/Ещё попытка/)
}

describe('LessonScreen E-01: «плохой» пользователь + споры (фидбей 2026-10-06)', () => {
  it('доходит до финала, «Дальше» не залипает после споров', async () => {
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
    for (let tick = 0; tick < 600; tick += 1) {
      if (screen.queryByText('Урок завершён')) break
      const acted = driveTick(view)
      await idle()
      const snapshot = document.body.textContent?.slice(0, 500) ?? ''
      stuck = snapshot === lastSnapshot ? stuck + 1 : 0
      lastSnapshot = snapshot
      if (stuck > 15) {
        const row = await repo.getLessonProgress('les-e-01')
        const cp = row?.checkpoint
        const step2 = view.steps.find((s) => s.index === 2)
        const missing = step2?.exerciseIds.filter((id) => !cp?.results[id]) ?? []
        throw new Error(
          `ЗАСТРЯЛИ (тик ${tick}): stepIndex=${cp?.stepIndex}, результаты шага2: ${step2?.exerciseIds.map((id) => `${id}=${cp?.results[id]?.outcome ?? '—'}`).join(', ')}; БЕЗ ОТВЕТА: ${missing.join(',') || 'нет'}; упр=${document.querySelector('[data-exercise-id]')?.getAttribute('data-exercise-id')} input=${JSON.stringify(document.querySelector('.lesson-input')?.getAttribute('value') ?? document.querySelector('.lesson-input')?.value ?? null)} placeholder=${JSON.stringify(document.querySelector('.lesson-input')?.getAttribute('placeholder'))}; html: ${document.querySelector('[data-exercise-id]')?.innerHTML.slice(0, 900)}`,
        )
      }
      if (!acted) await waitFor(() => undefined, { timeout: 200 })
    }
    expect(screen.getByText('Урок завершён')).toBeInTheDocument()
  }, 90000)
})
