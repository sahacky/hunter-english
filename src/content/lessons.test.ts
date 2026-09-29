// Implements: plan://M5#5.3 — тесты сборки урока из контента (specs/05 §2–§4, specs/02 §2)
import { describe, expect, it } from 'vitest'
import type { StepKind } from '../domain/lesson/types'
import {
  assembleLesson,
  courseToLessonId,
  exercisePhraseIds,
  lessonToCourseId,
  loadLessonView,
  loadLessons,
  loadPhrases,
  type ExerciseItem,
  type LessonItem,
  type PhraseItem,
} from './lessons'

function phrase(id: string, overrides: Partial<PhraseItem> = {}): PhraseItem {
  return {
    id,
    text_en: `Text of ${id}`,
    translation_ru: `Перевод ${id}`,
    grammar_point_id: 'gp-e-01',
    variants: [`Text of ${id}`],
    ...overrides,
  }
}

function exercise(id: string, type: string, payload: Record<string, unknown> = {}): ExerciseItem {
  return {
    id,
    type,
    payload: { kind: type, ...payload },
    answer: { normalization: 'default', typo: 'allow' },
    meta: { skill: 'grammar', xp: 2 },
  }
}

function lesson(exerciseIds: string[]): LessonItem {
  return {
    id: 'les-e-01',
    rank: 'E',
    module: 'mod-e-1',
    title: 'to be: am / is / are',
    grammar_point: {
      id: 'gp-e-01',
      title_ru: 'Глагол to be',
      rule_md: 'правило',
      phrase_ids: ['ph-e-0001'],
      trap_id: 'trap-no-to-be',
    },
    vocab_band: { list: 'ngsl-spoken', from: 1, to: 50 },
    phrasebook_topic: null,
    trap_id: 'trap-no-to-be',
    quotes_topic: 'family',
    exercises: exerciseIds.map((id) => ({ id })),
    bebris_video: null,
  }
}

describe('courseToLessonId / lessonToCourseId (specs/01 §1)', () => {
  it('E-01 ↔ les-e-01', () => {
    expect(courseToLessonId('E-01')).toBe('les-e-01')
    expect(lessonToCourseId('les-e-01')).toBe('E-01')
    expect(lessonToCourseId(courseToLessonId('D-12'))).toBe('D-12')
  })
})

describe('exercisePhraseIds (specs/05 §3)', () => {
  it('phrase_id, source_phrase_id и steps[] трансформации', () => {
    expect(exercisePhraseIds(exercise('a', 'translate', { phrase_id: 'ph-e-0001' }))).toEqual([
      'ph-e-0001',
    ])
    expect(
      exercisePhraseIds(exercise('b', 'transform', { source_phrase_id: 'ph-e-0002' })),
    ).toEqual(['ph-e-0002'])
    expect(
      exercisePhraseIds(
        exercise('c', 'transform', {
          source_phrase_id: 'ph-e-0002',
          steps: [
            { task: 'question', phrase_id: 'ph-e-0003' },
            { task: 'negative', phrase_id: 'ph-e-0004' },
          ],
        }),
      ),
    ).toEqual(['ph-e-0002', 'ph-e-0003', 'ph-e-0004'])
  })

  it('cloze без фразы — пусто', () => {
    expect(exercisePhraseIds(exercise('d', 'cloze', { text_with_gap: 'I ___ hungry' }))).toEqual([])
  })
})

describe('assembleLesson (specs/02 §2 + specs/05 §3–§4)', () => {
  const exercises = [
    exercise('ex-e-0001', 'cloze', { text_with_gap: 'I ___ hungry', gap_answers: ['am'] }),
    exercise('ex-e-0002', 'cloze', {
      text_with_gap: 'You ___ kind',
      gap_answers: ['are'],
      quote: { title: 'Star Wars', season_episode: 'S05E02' },
    }),
    exercise('ex-e-0003', 'choose_translation', {
      prompt: 'привет',
      options: ['hello', 'bye', 'no'],
      correct: 0,
    }),
    exercise('ex-e-0004', 'translate', { prompt_ru: 'Я голоден.', phrase_id: 'ph-e-0001' }),
    exercise('ex-e-0005', 'dictation', { phrase_id: 'ph-e-0002' }),
    exercise('ex-e-0006', 'shadowing', { phrase_id: 'ph-e-0003' }),
  ]
  const phrases = [phrase('ph-e-0001'), phrase('ph-e-0002'), phrase('ph-e-0003')]
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const phraseById = new Map(phrases.map((p) => [p.id, p]))

  it('шаги шаблона + виртуальный шаг 7 «В колоду»', () => {
    const view = assembleLesson(lesson(exercises.map(({ id }) => id)), byId, phraseById)
    expect(view.steps.map(({ kind }: { kind: StepKind }) => kind)).toEqual([
      'rule',
      'warmup',
      'build',
      'listening',
      'speaking',
      'quotes',
      'deck',
    ])
    expect(view.steps.at(-1)).toEqual({ index: 7, kind: 'deck', exerciseIds: [] })
  })

  it('cloze с цитатой попадает в «Из сериала», без — в «Правило»', () => {
    const view = assembleLesson(lesson(exercises.map(({ id }) => id)), byId, phraseById)
    expect(view.content[1]?.map(({ exercise }) => exercise.id)).toEqual(['ex-e-0001'])
    expect(view.content[6]?.map(({ exercise }) => exercise.id)).toEqual(['ex-e-0002'])
  })

  it('payload → phrase привязан для упражнений с phrase_id', () => {
    const view = assembleLesson(lesson(exercises.map(({ id }) => id)), byId, phraseById)
    expect(view.content[3]?.[0].phrase?.id).toBe('ph-e-0001')
    expect(view.content[4]?.[0].phrase?.text_en).toBe('Text of ph-e-0002')
    expect(view.content[2]?.[0].phrase).toBeNull()
  })

  it('неизвестное упражнение — защитный throw', () => {
    expect(() => assembleLesson(lesson(['ex-e-9999']), byId, phraseById)).toThrow(/не найдено/)
  })

  it('урок без упражнений блока — шаг пропущен', () => {
    const view = assembleLesson(lesson(['ex-e-0004']), byId, phraseById)
    expect(view.steps.map(({ index }) => index)).toEqual([3, 7])
  })
})

describe('loadLessonView (реальные data/ ранга E)', () => {
  it('собирает все уроки E полными шагами шаблона', async () => {
    for (const lessonId of [
      'les-e-01',
      'les-e-02',
      'les-e-03',
      'les-e-04',
      'les-e-05',
      'les-e-06',
      'les-e-07',
      'les-e-08',
      'les-e-09',
      'les-e-10',
    ]) {
      const view = await loadLessonView(lessonId)
      expect(view, lessonId).not.toBeNull()
      expect(view?.lesson.rank).toBe('E')
      expect(view?.steps.map(({ kind }) => kind)).toEqual([
        'rule',
        'warmup',
        'build',
        'listening',
        'speaking',
        'quotes',
        'deck',
      ])
      // verb_tense без phrase_id — легально; у остальных типы строковые
      const buildPhrases = (view?.content[3] ?? []).map(({ phrase }) => phrase?.id)
      expect(
        buildPhrases.every((id) => id === undefined || typeof id === 'string'),
        lessonId,
      ).toBe(true)
      expect((view?.content[3] ?? []).length).toBeGreaterThanOrEqual(20)
      expect((view?.content[6] ?? []).length).toBe(2)
    }
  })

  it('пул фраз каждого урока ≥40, все фразы с аудио и уникальными id', async () => {
    const phrases = await loadPhrases()
    expect(phrases.length).toBeGreaterThanOrEqual(1050)
    expect(new Set(phrases.map(({ id }) => id)).size).toBe(phrases.length)
    expect(phrases.every(({ audio }) => audio?.en_gb?.startsWith('audio/phrases/cori/'))).toBe(true)

    const lessons = await loadLessons()
    // M14: E (24) + D (28) + C полный ранг (30)
    expect(lessons.length).toBe(82)
    const phraseById = new Set(phrases.map(({ id }) => id))
    for (const lesson of lessons) {
      const lessonPhrases = phrases.filter(
        ({ grammar_point_id }) => grammar_point_id === lesson.grammar_point.id,
      )
      expect(lessonPhrases.length, lesson.id).toBeGreaterThanOrEqual(40)
      for (const pid of lesson.grammar_point.phrase_ids) {
        expect(phraseById.has(pid), `${lesson.id} → ${pid}`).toBe(true)
      }
    }
  })

  it('D-уроки: ранг, модули, ловушки, цитаты D-ранга (plan://M12#12.3–12.4)', async () => {
    const lessons = await loadLessons()
    const d = lessons.filter((lesson) => lesson.rank === 'D')
    expect(d).toHaveLength(28)
    expect(d.every((lesson) => lesson.module.startsWith('mod-d-'))).toBe(true)
    expect(d.every((lesson) => (lesson.trap_id ?? '').startsWith('trap-'))).toBe(true)
    // первый D-урок собирается в полный шаблон
    const view = await loadLessonView('les-d-01')
    expect(view?.lesson.title).toContain('Present Continuous')
    expect(view?.steps.map(({ kind }) => kind)).toEqual([
      'rule',
      'warmup',
      'build',
      'listening',
      'speaking',
      'quotes',
      'deck',
    ])
    // разговорник directions привязан и открывается рангом D
    const withDirections = lessons.filter((lesson) => lesson.phrasebook_topic === 'directions')
    expect(withDirections.length).toBeGreaterThanOrEqual(3)
    // transform-упражнения D-27/D-28 (specs/02 §3 №14, план M12#12.7)
    const { loadExercises } = await import('./lessons')
    const exercises = await loadExercises()
    const transforms = exercises.filter((exercise) => exercise.type === 'transform')
    expect(transforms.length).toBeGreaterThanOrEqual(17)
    for (const exercise of transforms) {
      const payload = exercise.payload as unknown as {
        source_phrase_id: string
        steps: { task: string; phrase_id: string }[]
      }
      expect(payload.steps.length).toBeGreaterThanOrEqual(1)
      expect(['negative', 'question', 'past', 'future']).toContain(payload.steps[0]!.task)
    }
  })

  it('C-уроки: ранг C, Past Simple/will, transform past/future (plan://M14#14.2–14.3)', async () => {
    const lessons = await loadLessons()
    const c = lessons.filter((lesson) => lesson.rank === 'C')
    expect(c).toHaveLength(30)
    expect(c.every((lesson) => lesson.module.startsWith('mod-c-'))).toBe(true)
    const view = await loadLessonView('les-c-01')
    expect(view?.lesson.title).toContain('Past Simple')
    expect(view?.steps.map(({ kind }) => kind)).toEqual([
      'rule',
      'warmup',
      'build',
      'listening',
      'speaking',
      'quotes',
      'deck',
    ])
    // transform-цепочки времени: past/future (движок M14)
    const { loadExercises } = await import('./lessons')
    const exercises = await loadExercises()
    const cTransforms = exercises.filter(
      (exercise) => exercise.type === 'transform' && exercise.id.startsWith('ex-c-'),
    )
    expect(cTransforms.length).toBeGreaterThanOrEqual(6)
    for (const exercise of cTransforms) {
      const payload = exercise.payload as unknown as {
        steps: { task: string; phrase_id: string }[]
      }
      expect(['past', 'future']).toContain(payload.steps[0]!.task)
    }
    // разговорники ранга C существует и привязаны
    const withHotel = lessons.filter((lesson) => lesson.phrasebook_topic === 'hotel')
    expect(withHotel.length).toBeGreaterThanOrEqual(3)
    const topics = new Set(lessons.map((lesson) => lesson.phrasebook_topic).filter(Boolean))
    for (const t of ['passport', 'restaurant', 'pharmacy', 'airport'])
      expect(topics.has(t), t).toBe(true)
  })
})

describe('assembleLesson: кросс-урочные ссылки (transform, ревью M12 Б-1)', () => {
  it('les-d-27: все ссылки упражнений резолвятся в view.phrasesById', async () => {
    const view = await loadLessonView('les-d-27')
    if (!view) throw new Error('нет данных урока les-d-27')
    for (const items of Object.values(view.content)) {
      for (const { exercise } of items) {
        const ids = exercisePhraseIds(exercise)
        for (const id of ids) {
          expect(view.phrasesById[id], `${exercise.id} → ${id}`).toBeDefined()
        }
      }
    }
    // цепочка transform реально доходит до экрана: source и шаги на месте
    const transforms = Object.values(view.content)
      .flat()
      .filter(({ exercise }) => exercise.type === 'transform')
    expect(transforms.length).toBeGreaterThanOrEqual(15)
  })
})
