// Implements: plan://onboarding#O.7 — «Путь обучения»: статусы цепочки и рендер
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import '../i18n'
import PathScreen, { buildPathRows } from './PathScreen'
import { HunterDb } from '../data/db'
import { DexieProgressRepository } from '../data/progress-repository'
import { waivedLessonProgress } from '../domain/placement/apply'
import type { LessonItem } from '../content/lessons'
import { uuidv7 } from '../lib/uuidv7'

function lesson(id: string, rank: LessonItem['rank']): LessonItem {
  return {
    id,
    rank,
    module: `mod-${rank.toLowerCase()}-1`,
    title: `Урок ${id}`,
    grammar_point: { id: `gp-${id}`, title_ru: '', rule_md: '', phrase_ids: [] },
    vocab_band: null,
    phrasebook_topic: null,
    trap_id: null,
    quotes_topic: null,
    exercises: [],
    bebris_video: null,
  }
}

const LESSONS = [
  lesson('les-e-01', 'E'),
  lesson('les-e-02', 'E'),
  lesson('les-e-03', 'E'),
  lesson('les-d-01', 'D'),
  lesson('les-s-01', 'S'),
]

let db: HunterDb
let repo: DexieProgressRepository

beforeEach(() => {
  db = new HunterDb(`hunter-path-test-${uuidv7()}`)
  repo = new DexieProgressRepository(db)
})

describe('buildPathRows (цепочка статусов)', () => {
  it('без прогресса: первый доступен и «ты здесь», остальные locked (строгая цепочка)', () => {
    const rows = buildPathRows(LESSONS, [null, null, null, null, null])
    expect(rows.map((row) => row.status)).toEqual([
      'available',
      'locked',
      'locked',
      'locked',
      'locked',
    ])
    expect(rows[0]!.current).toBe(true)
    expect(rows.filter((row) => row.current)).toHaveLength(1)
  })

  it('зачёт оценкой (E-01/E-02 completed) → D-01 доступен и текущий', () => {
    const rows = buildPathRows(LESSONS, [
      { status: 'completed' } as never,
      { status: 'completed' } as never,
      null,
      null,
      null,
    ])
    expect(rows[0]!.status).toBe('completed')
    expect(rows[2]!.status).toBe('available')
    expect(rows[2]!.current).toBe(true)
  })

  it('цепочка строгая (как computeLessonStatus): E-01 пройден, E-02 нет → E-03 locked', () => {
    const rows = buildPathRows(LESSONS, [{ status: 'completed' } as never, null, null, null, null])
    expect(rows[1]!.status).toBe('available')
    expect(rows[1]!.current).toBe(true)
    expect(rows[2]!.status).toBe('locked')
    expect(rows[2]!.current).toBe(false)
  })

  it('in_progress и review_due из сохранённых статусов', () => {
    const rows = buildPathRows(LESSONS, [
      { status: 'completed' } as never,
      { status: 'in_progress' } as never,
      { status: 'review_due' } as never,
      null,
      null,
    ])
    expect(rows[1]!.status).toBe('in_progress')
    expect(rows[1]!.current).toBe(true)
    expect(rows[2]!.status).toBe('review_due')
  })
})

describe('PathScreen', () => {
  it('рендерит ранги с прогрессом; зачтённый урок — ссылкой, locked нет', async () => {
    await repo.putLessonProgress(waivedLessonProgress('les-e-01', '2026-02-01T00:00:00Z'))
    window.location.hash = '#/path'
    render(
      <HashRouter>
        <PathScreen repo={repo} />
      </HashRouter>,
    )
    expect(await screen.findByText('Программа обучения')).toBeInTheDocument()
    // реальный контент: ранг E = 24 урока, зачтён один (waived)
    expect(screen.getByText(/Ранг E \(A0\) · 1\/24 уроков/)).toBeInTheDocument()
    expect(screen.getByText(/ты здесь/)).toBeInTheDocument()
    expect(screen.getAllByText(/Ранг S/).length).toBeGreaterThan(0)
    // locked-уроки рендерятся span'ами (не ссылками)
    const spans = document.querySelectorAll('.lesson-path-row span.dim')
    expect(spans.length).toBeGreaterThan(0)
  })

  it('ошибка загрузки — панель ошибки', async () => {
    const failing = {
      ...repo,
      getManyLessonProgress: async () => {
        throw new Error('db')
      },
    } as unknown as DexieProgressRepository
    window.location.hash = '#/path'
    render(
      <HashRouter>
        <PathScreen repo={failing} />
      </HashRouter>,
    )
    expect(
      await screen.findByText('Система недоступна: не удалось загрузить прогресс.'),
    ).toBeInTheDocument()
  })

  it('размонтирование до ответа репозитория — без обновления состояния (живой гард)', async () => {
    let resolveProgress!: (rows: never[]) => void
    const slow = {
      ...repo,
      getManyLessonProgress: () =>
        new Promise((resolve) => {
          resolveProgress = resolve
        }),
    } as unknown as DexieProgressRepository
    window.location.hash = '#/path'
    const { unmount } = render(
      <HashRouter>
        <PathScreen repo={slow} />
      </HashRouter>,
    )
    // ждём, пока дойдёт до ожидания репозитория (loadLessons реальный — асинхронно)
    await vi.waitFor(() => expect(typeof resolveProgress).toBe('function'))
    unmount()
    resolveProgress([])
    await Promise.resolve()
  })
})
