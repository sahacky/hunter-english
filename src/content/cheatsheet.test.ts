// Implements: plan://teaching-quality#cheat-sheet — юнит-тесты выжимки правил
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCheatGroups, ruleSummary, ruleTrapLine } from './cheatsheet'
import type { LessonItem } from './lessons'
import type { LessonProgress } from '../domain/lesson/types'
import { HunterDb } from '../data/db'
import { DexieProgressRepository } from '../data/progress-repository'
import { uuidv7 } from '../lib/uuidv7'

vi.mock('./lessons', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  loadLessons: vi.fn(),
}))

import { loadCheatSheet } from './cheatsheet'
import { loadLessons } from './lessons'

const mockLessons = vi.mocked(loadLessons)

describe('ruleSummary', () => {
  it('берёт строку «Формула:» без префикса и без `**` (формат Q1.1)', () => {
    const rule = [
      '**I am** Ivan. — Я Иван.',
      '',
      'Это глагол-связка **to be**.',
      '**Формула:** кто + am / is / are',
      "⚠️ Ловушка: ❌ I hungry → ✔ I'**m** hungry.",
    ].join('\n')
    expect(ruleSummary(rule)).toBe('кто + am / is / are')
  })

  it('фолбэк — первая содержательная строка (ранги до ревизии Q-фазы)', () => {
    const rule = [
      '**Present Continuous — процесс прямо сейчас.**',
      'am / is / are + глагол+-ing: I **am working** now.',
    ].join('\n')
    expect(ruleSummary(rule)).toBe('Present Continuous — процесс прямо сейчас.')
  })

  it('фолбэк пропускает пустые строки и строку ловушки', () => {
    expect(ruleSummary('\n\n⚠️ Ловушка: ❌ a → ✔ an.\n**Do** you work?')).toBe('Do you work?')
  })

  it('пустой rule_md — пустая выжимка', () => {
    expect(ruleSummary('')).toBe('')
  })

  it('длинная строка обрезается до 160 символов с «…»', () => {
    const long = `${'x'.repeat(200)}`
    expect(ruleSummary(long)).toHaveLength(160)
    expect(ruleSummary(long).endsWith('…')).toBe(true)
  })
})

describe('ruleTrapLine', () => {
  it('возвращает строку ловушки без `**`', () => {
    const rule =
      "**Формула:** кто + am / is / are\n⚠️ Ловушка ЛТ-01: ❌ I hungry → ✔ I**'m** hungry."
    expect(ruleTrapLine(rule)).toBe("⚠️ Ловушка ЛТ-01: ❌ I hungry → ✔ I'm hungry.")
  })

  it('null, если ловушки нет', () => {
    expect(ruleTrapLine('**Формула:** кто + am / is / are')).toBeNull()
  })
})

function mkLesson(id: string, rank: LessonItem['rank'], ruleMd: string): LessonItem {
  return {
    id,
    rank,
    module: 'm',
    title: `Урок ${id}`,
    grammar_point: { id: `gp-${id}`, title_ru: '', rule_md: ruleMd, phrase_ids: [] },
    vocab_band: null,
    phrasebook_topic: null,
    trap_id: null,
    quotes_topic: null,
    exercises: [],
    bebris_video: null,
  }
}

function progress(status: LessonProgress['status']): LessonProgress {
  return {
    lesson_id: '',
    status,
    score: null,
    checkpoint: {
      passIndex: 0,
      stepIndex: 1,
      scores: [],
      srsEnqueued: [],
      passesDone: 0,
      results: {},
    },
    completed_at: null,
    updated_at: '',
  }
}

describe('buildCheatGroups', () => {
  beforeEach(() => {
    mockLessons.mockReset()
  })
  const lessons = [
    mkLesson('les-e-01', 'E', '**Формула:** кто + am / is / are'),
    mkLesson('les-e-02', 'E', 'первая строка E-02'),
    mkLesson('les-d-01', 'D', 'первая строка D-01'),
    mkLesson('les-c-01', 'C', 'первая строка C-01'),
  ]

  it('только завершённые уроки (completed/review_due), in_progress/null пропускаются', () => {
    const rows = [
      progress('completed'),
      progress('review_due'),
      progress('in_progress'),
      progress('completed'),
    ]
    const groups = buildCheatGroups(lessons, rows)
    expect(groups.map((group) => group.rank)).toEqual(['E', 'C'])
    expect(groups[0]!.entries.map((entry) => entry.courseId)).toEqual(['E-01', 'E-02'])
    expect(groups[1]!.entries[0]!.summary).toBe('первая строка C-01')
  })

  it('порядок рангов курса E→S, пустые ранги не создаются', () => {
    const rows = [null, null, progress('completed'), null]
    const groups = buildCheatGroups(lessons, rows)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.rank).toBe('D')
  })

  it('ловушка попадает в запись, если есть', () => {
    const withTrap = mkLesson('les-e-03', 'E', '**Формула:** x\n⚠️ Ловушка: ❌ y → ✔ z.')
    const groups = buildCheatGroups(
      [...lessons, withTrap],
      [progress('completed'), null, null, null, progress('completed')],
    )
    expect(groups[0]!.entries[1]!.trap).toBe('⚠️ Ловушка: ❌ y → ✔ z.')
    expect(groups[0]!.entries[0]!.trap).toBeNull()
  })
})

describe('loadCheatSheet (загрузчик)', () => {
  it('уроки + чекпоинты одним чтением; по умолчанию Dexie-репозиторий совместим', async () => {
    const e01 = mkLesson('les-e-01', 'E', '**Формула:** кто + am / is / are')
    const d01 = mkLesson('les-d-01', 'D', 'первая строка D-01')
    mockLessons.mockResolvedValue([e01, d01])
    const repo = new DexieProgressRepository(new HunterDb(`hunter-cheat-${uuidv7()}`))
    const done: LessonProgress = {
      ...progress('completed'),
      lesson_id: e01.id,
      completed_at: '2026-10-04T00:00:00Z',
      updated_at: '2026-10-04T00:00:00Z',
    }
    await repo.putLessonProgress(done)
    const groups = await loadCheatSheet(repo)
    expect(mockLessons).toHaveBeenCalledTimes(1)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.rank).toBe('E')
    expect(groups[0]!.entries[0]).toMatchObject({
      courseId: 'E-01',
      summary: 'кто + am / is / are',
    })
  })
})
