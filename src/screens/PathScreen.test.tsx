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

  it('V15: проход завершён (in_progress + passesDone=1) — следующий урок ОТКРЫТ, плашка дозревания', () => {
    const rows = buildPathRows(LESSONS, [
      { status: 'in_progress', checkpoint: { passesDone: 1 } } as never,
      null,
      null,
      null,
      null,
    ])
    expect(rows[1]!.status).toBe('available')
    expect(rows[0]!.maturing).toBe(true)
    expect(rows[1]!.maturing).toBe(false)
  })

  it('start_at_rank D (P.2): уроки ниже ранга доступны (не зачтены), D-01 доступен и текущий', () => {
    const rows = buildPathRows(LESSONS, [null, null, null, null, null], { startAtRank: 'D' })
    // нижние доступны без прохождения цепочки, но «ты здесь» там не ставится
    expect(rows[0]!.status).toBe('available')
    expect(rows[0]!.current).toBe(false)
    expect(rows[1]!.status).toBe('available')
    expect(rows[1]!.current).toBe(false)
    expect(rows[2]!.status).toBe('available')
    expect(rows[2]!.current).toBe(false)
    // первый урок ранга — доступен и «ты здесь»; выше — цепочка как прежде
    expect(rows[3]!.status).toBe('available')
    expect(rows[3]!.current).toBe(true)
    expect(rows[4]!.status).toBe('locked')
  })

  it('start_at_rank D: внутри ранга цепочка сохраняется — E-уроки не влияют на D-01', () => {
    const rows = buildPathRows(
      [lesson('les-d-01', 'D'), lesson('les-d-02', 'D'), lesson('les-s-01', 'S')],
      [null, null, null],
      { startAtRank: 'D' },
    )
    expect(rows[0]!.status).toBe('available')
    expect(rows[1]!.status).toBe('locked') // D-02 откроется после D-01
    expect(rows[2]!.status).toBe('locked')
  })

  it('start_at_rank не перекрывает сохранённые статусы (зачтённые остаются completed)', () => {
    const rows = buildPathRows(
      LESSONS,
      [{ status: 'completed' } as never, null, null, null, null],
      { startAtRank: 'D' },
    )
    expect(rows[0]!.status).toBe('completed')
    expect(rows[1]!.status).toBe('available')
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
    // locked-уроки рендерятся span'ами (не ссылками) с 🔒-бейджем (ux-фикс тёмной темы)
    const spans = document.querySelectorAll('.lesson-path-row .lesson-path-lockrow')
    expect(spans.length).toBeGreaterThan(0)
  })

  it('ранг D в статусе (start_at_rank, P.2): «ты здесь» — на D-01, уроки E доступны', async () => {
    const stats = await repo.getStats()
    await repo.putStats({ ...stats, rank: 'D', updated_at: '2026-02-01T00:00:00Z' })
    window.location.hash = '#/path'
    render(
      <HashRouter>
        <PathScreen repo={repo} />
      </HashRouter>,
    )
    expect(await screen.findByText('Программа обучения')).toBeInTheDocument()
    const currentRow = document.querySelector('.lesson-path-current')
    expect(currentRow).toBeTruthy()
    expect(currentRow!.textContent).toContain('ты здесь')
    // текущий урок — в секции ранга D (первый урок ранга)
    const rankHeader = currentRow!.closest('.pb-vocab-topic')?.querySelector('h3')?.textContent
    expect(rankHeader).toMatch(/Ранг D/)
  })

  it('ошибка загрузки — панель ошибки', async () => {
    // прототипная делегация (spread ломает this у Dexie-методов — M19)
    const failing = Object.create(repo) as DexieProgressRepository
    failing.getManyLessonProgress = async () => {
      throw new Error('db')
    }
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
    // прототипная делегация (spread ломает this у Dexie-методов — M19)
    const slow = Object.create(repo) as DexieProgressRepository
    slow.getManyLessonProgress = (() =>
      new Promise((resolve) => {
        resolveProgress = resolve
      })) as DexieProgressRepository['getManyLessonProgress']
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
