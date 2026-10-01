// Implements: plan://onboarding#O.7 — сборка задач оценки из контента
import { describe, expect, it } from 'vitest'
import { buildPlacementTasks } from './placement'
import type { LessonItem, PhraseItem } from './lessons'

function lesson(id: string, rank: LessonItem['rank'], phraseIds: string[]): LessonItem {
  return {
    id,
    rank,
    module: `mod-${rank.toLowerCase()}-1`,
    title: `lesson ${id}`,
    grammar_point: { id: `gp-${id}`, title_ru: '', rule_md: '', phrase_ids: phraseIds },
    vocab_band: null,
    phrasebook_topic: null,
    trap_id: null,
    quotes_topic: null,
    exercises: [],
    bebris_video: null,
  }
}

function phrase(id: string, en: string, ru: string, variants: string[] = []): PhraseItem {
  return { id, text_en: en, translation_ru: ru, grammar_point_id: null, variants }
}

const phrases = [
  phrase('p1', 'I am fine.', 'Я в порядке'),
  phrase('p2', 'She is a doctor.', 'Она врач'),
  phrase('p3', 'We are ready.', 'Мы готовы'),
  phrase('p4', 'They are late.', 'Они опоздали'),
  phrase('p5', 'He is in.', 'Он внутри'),
  phrase('p6', 'It is open.', 'Это открыто'),
  phrase('p7', 'Dupe.', 'Мы готовы'), // дубль перевода — не попадёт
]

describe('buildPlacementTasks', () => {
  it('маяк — 5-й урок ранга; по 3 задачи; принятые варианты = text_en + variants', () => {
    const lessons = [
      lesson('les-e-01', 'E', ['p7']),
      lesson('les-e-02', 'E', ['p7']),
      lesson('les-e-03', 'E', ['p7']),
      lesson('les-e-04', 'E', ['p7']),
      lesson('les-e-05', 'E', ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']),
      lesson('les-d-01', 'D', ['p2', 'p3', 'p4']),
    ]
    const tasks = buildPlacementTasks(lessons, phrases)
    expect(tasks.filter((task) => task.rank === 'E')).toHaveLength(3)
    // якорь D: p2/p3 — дубли переводов (уже взяты полосой E), p7 — дубль внутри E-якоря; остаётся p4
    expect(tasks.filter((task) => task.rank === 'D')).toHaveLength(1)
    expect(tasks[0]).toMatchObject({
      id: 'pl-p1',
      rank: 'E',
      promptRu: 'Я в порядке',
      accepted: ['I am fine.'],
    })
    const withVariants = buildPlacementTasks(
      [lesson('les-d-05', 'D', ['p1'])],
      [phrase('p1', 'I am fine.', 'Я в порядке', ["I'm fine."])],
    )
    expect(withVariants[0]!.accepted).toEqual(['I am fine.', "I'm fine."])
  })

  it('если 5-го урока нет — берётся первый урок ранга; ранг без уроков пропускается', () => {
    const tasks = buildPlacementTasks([lesson('les-a-01', 'A', ['p1', 'p2', 'p3'])], phrases)
    expect(tasks.every((task) => task.rank === 'A')).toBe(true)
    expect(tasks).toHaveLength(3)
    const empty = buildPlacementTasks([], phrases)
    expect(empty).toEqual([])
  })

  it('дубли переводов между рангами отбрасываются (однозначность промпта)', () => {
    const lessons = [
      lesson('les-e-05', 'E', ['p1', 'p2', 'p3']),
      lesson('les-d-05', 'D', ['p1', 'p4', 'p5', 'p6']),
    ]
    const tasks = buildPlacementTasks(lessons, phrases)
    const prompts = tasks.map((task) => task.promptRu)
    expect(new Set(prompts).size).toBe(prompts.length)
    expect(tasks.find((task) => task.rank === 'D')!.promptRu).not.toBe('Я в порядке')
  })
})
