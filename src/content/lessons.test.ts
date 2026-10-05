// Implements: plan://M5#5.3 — тесты сборки урока из контента (specs/05 §2–§4, specs/02 §2)
import { describe, expect, it } from 'vitest'
import type { StepKind } from '../domain/lesson/types'
import {
  assembleLesson,
  COURSE_RANKS,
  courseToLessonId,
  exercisePhraseIds,
  lessonToCourseId,
  loadLessonView,
  loadExercises,
  loadLessons,
  loadPhraseNotes,
  loadPhrases,
  loadQuotes,
  withWarmupVariant,
  type ExerciseItem,
  type LessonItem,
  type LessonView,
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

describe('withWarmupVariant (план M21#21.1 — разогрев повтора «с новыми заданиями»)', () => {
  function bigPoolView(): LessonView {
    const ids = Array.from({ length: 12 }, (_, i) => `ph-${String(i + 1).padStart(4, '0')}`)
    const phrases = ids.map((id) => phrase(id))
    const phraseById = new Map(phrases.map((p) => [p.id, p]))
    const exercises = [
      exercise('ex-w-01', 'choose_translation', {
        prompt: 'Перевод ph-0001',
        options: ['a'],
        correct: 0,
      }),
      exercise('ex-w-02', 'translate', { prompt_ru: 'Я голоден.', phrase_id: 'ph-0001' }),
    ]
    const byId = new Map(exercises.map((e) => [e.id, e]))
    // warmup + build: шаг 1 существует
    return assembleLesson(lesson(['ex-w-01', 'ex-w-02']), byId, phraseById)
  }

  const seeded = (seed: number) => () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }

  it('шаг 1 заменён на 4 choose + 1 match с синтетическими id и xp=1', () => {
    const view = withWarmupVariant(bigPoolView(), seeded(7))
    const warmup = view.content[1] ?? []
    expect(warmup).toHaveLength(5)
    expect(warmup.map(({ exercise }) => exercise.type)).toEqual([
      'choose_translation',
      'choose_translation',
      'choose_translation',
      'choose_translation',
      'match_pairs',
    ])
    for (const { exercise } of warmup) {
      expect(exercise.id).toMatch(/^ex-warmup-r-\d$/)
      expect(exercise.meta.xp).toBe(1)
    }
    for (const { exercise } of warmup.slice(0, 4)) {
      expect(exercise.payload.options).toHaveLength(4)
      expect(exercise.payload.correct).toBeGreaterThanOrEqual(0)
      expect(exercise.payload.options).toContain(
        `Text of ${(exercise.payload.prompt as string).replace('Перевод ', '')}`,
      )
    }
  })

  it('match-пары уникальны по RU и цели choose не дублируются', () => {
    const view = withWarmupVariant(bigPoolView(), seeded(42))
    const warmup = view.content[1] ?? []
    const prompts = warmup.slice(0, 4).map(({ exercise }) => exercise.payload.prompt)
    expect(new Set(prompts).size).toBe(4)
    const pairs = (warmup[4].exercise.payload as unknown as { pairs: { ru: string[] }[] }).pairs
    expect(pairs).toHaveLength(5)
    expect(new Set(pairs.map((p) => p.ru)).size).toBe(5)
  })

  it('детерминизм: один rng — один результат', () => {
    expect(withWarmupVariant(bigPoolView(), seeded(1))).toEqual(
      withWarmupVariant(bigPoolView(), seeded(1)),
    )
  })

  it('маленький пул — view возвращается без изменений', () => {
    const exercises = [exercise('ex-w-01', 'translate', { phrase_id: 'ph-0001' })]
    const byId = new Map(exercises.map((e) => [e.id, e]))
    const phrases = [phrase('ph-0001'), phrase('ph-0002')]
    const phraseById = new Map(phrases.map((p) => [p.id, p]))
    const view = assembleLesson(lesson(['ex-w-01']), byId, phraseById)
    // шага warmup нет вовсе → без изменений
    expect(withWarmupVariant(view)).toBe(view)
  })

  it('warmup есть, но уникальных RU-фраз меньше минимума — view без изменений (M21#21.4)', () => {
    // choose_translation даёт шаг warmup, но пул из 2 фраз < WARMUP_MIN_POOL (9)
    const exercises = [
      exercise('ex-w-01', 'choose_translation', {
        prompt: 'Перевод ph-0001',
        options: ['a'],
        correct: 0,
      }),
    ]
    const byId = new Map(exercises.map((e) => [e.id, e]))
    const phrases = [phrase('ph-0001'), phrase('ph-0002')]
    const phraseById = new Map(phrases.map((p) => [p.id, p]))
    const view = assembleLesson(lesson(['ex-w-01']), byId, phraseById)
    expect(view.steps.some(({ kind }) => kind === 'warmup')).toBe(true)
    expect(withWarmupVariant(view)).toBe(view)
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
    // v2 (программа v2): E (24) + D (39, вкл. Past Simple/PC) + C (19) + B (30) + A (22) + S (15)
    expect(lessons.length).toBe(149)
    const phraseById = new Set(phrases.map(({ id }) => id))
    for (const lesson of lessons) {
      // B-27 — сценочный урок разговорника (specs/01 §8): своего пула дрилл-фраз нет,
      // правило ссылается на 3 фразы-примера других уроков B
      if (lesson.id === 'les-b-27') {
        expect(lesson.grammar_point.phrase_ids).toHaveLength(3)
        for (const pid of lesson.grammar_point.phrase_ids) {
          expect(phraseById.has(pid), `${lesson.id} → ${pid}`).toBe(true)
        }
        continue
      }
      const lessonPhrases = phrases.filter(
        ({ grammar_point_id }) => grammar_point_id === lesson.grammar_point.id,
      )
      // A/S-ранги: сложнее материал, меньше дрилл-фраз на урок (M16, M20)
      const min = lesson.rank === 'A' || lesson.rank === 'S' ? 20 : 40
      expect(lessonPhrases.length, lesson.id).toBeGreaterThanOrEqual(min)
      for (const pid of lesson.grammar_point.phrase_ids) {
        expect(phraseById.has(pid), `${lesson.id} → ${pid}`).toBe(true)
      }
    }
  })

  it('порядок курса: E → D → C → B → A → S, внутри ранга — по order (программа v2)', async () => {
    const lessons = await loadLessons()
    expect(lessons.length).toBe(149)
    expect(lessons[0]!.id).toBe('les-e-01')
    expect(lessons.at(-1)!.id).toBe('les-s-15')
    const rankSeq = lessons.map(({ rank }) => rank)
    const first = rankSeq.indexOf('E')
    for (const rank of ['D', 'C', 'B', 'A', 'S'] as const) {
      expect(rankSeq.indexOf(rank)).toBeGreaterThan(first)
    }
    // монотонность: ранг не «возвращается» назад по списку
    const weights = rankSeq.map((rank) =>
      COURSE_RANKS.indexOf(rank as (typeof COURSE_RANKS)[number]),
    )
    for (let i = 1; i < weights.length; i += 1) {
      expect(weights[i]).toBeGreaterThanOrEqual(weights[i - 1]!)
    }
    // v2 (plan://curriculum-review#V.1–V.3): Past Simple в конце D (до финала
    // D-26…28), будущее в C открывает going to, ранг A — с «карты времён»
    const d = lessons.filter((lesson) => lesson.rank === 'D')
    expect(d.at(-4)!.id).toBe('les-c-24') // Past Continuous
    expect(d.at(-3)!.id).toBe('les-d-26') // финальный блок D
    expect(d.filter((l) => l.id.startsWith('les-c-')).map((l) => l.id)).toEqual([
      ...Array.from({ length: 10 }, (_, i) => `les-c-${String(i + 1).padStart(2, '0')}`),
      'les-c-24',
    ])
    const c = lessons.filter((lesson) => lesson.rank === 'C')
    expect(c[0]!.id).toBe('les-c-14') // be going to — раньше will
    expect(c.findIndex((l) => l.id === 'les-c-14')).toBeLessThan(
      c.findIndex((l) => l.id === 'les-c-11'),
    )
    const a = lessons.filter((lesson) => lesson.rank === 'A')
    expect(a[0]!.id).toBe('les-a-03') // «Карта всех времён» первой
    expect(a.findIndex((l) => l.id === 'les-a-01')).toBe(9) // Future Continuous — середина
    // order — плотная последовательность 1..N внутри каждого ранга
    for (const rank of ['E', 'D', 'C', 'B', 'A', 'S'] as const) {
      const orders = lessons.filter((lesson) => lesson.rank === rank).map(({ order }) => order)
      expect(orders).toEqual(Array.from({ length: orders.length }, (_, i) => i + 1))
    }
  })

  it('D-уроки: ранг, модули, ловушки, цитаты D-ранга (plan://M12#12.3–12.4 + v2 V.1)', async () => {
    const lessons = await loadLessons()
    const d = lessons.filter((lesson) => lesson.rank === 'D')
    // v2: 28 исходных + Past Simple (les-c-01…10) + Past Continuous (les-c-24)
    expect(d).toHaveLength(39)
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

  it('C-уроки: ранг C, будущее going to → will, transform (plan://M14#14.2–14.3 + v2 V.1/V.2)', async () => {
    const lessons = await loadLessons()
    const c = lessons.filter((lesson) => lesson.rank === 'C')
    // v2: Past Simple-блок и Past Continuous ушли в конец D — в C 19 уроков
    expect(c).toHaveLength(19)
    const b = lessons.filter((lesson) => lesson.rank === 'B')
    expect(b).toHaveLength(30)
    const a = lessons.filter((lesson) => lesson.rank === 'A')
    expect(a).toHaveLength(22)
    expect(c.every((lesson) => lesson.module.startsWith('mod-c-'))).toBe(true)
    // Past Simple-уроки принадлежат рангу D (v2 V.1), маршрут по id жив
    const view = await loadLessonView('les-c-01')
    expect(view?.lesson.rank).toBe('D')
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

  it('B-27 «диалог-сценки на скорости»: правило + 2 раунда сцен разговорника (specs/01 §8)', async () => {
    const lessons = await loadLessons()
    const b = lessons.filter((lesson) => lesson.rank === 'B')
    // B-27 встал между b-26 и b-28 (order-миграция v2 без смены id)
    expect(b.slice(25, 28).map((lesson) => lesson.id)).toEqual(['les-b-26', 'les-b-27', 'les-b-28'])
    expect(b.map((lesson) => lesson.order)).toEqual([...Array(30).keys()].map((i) => i + 1))
    const view = await loadLessonView('les-b-27')
    if (!view) throw new Error('нет данных урока les-b-27')
    // шаблон сокращён естественным образом: правило → речь (сценки) → колода
    expect(view.steps.map(({ kind }) => kind)).toEqual(['rule', 'speaking', 'deck'])
    expect(view.content[1]!.every(({ exercise }) => exercise.type === 'cloze')).toBe(true)
    const scenes = view.content[5]!
    expect(scenes).toHaveLength(7)
    expect(scenes.every(({ exercise }) => exercise.type === 'answer_question')).toBe(true)
    // 2 раунда = 2 базовые ситуации разговорника (фиксируются в данных, specs/01 §8);
    // подпись сцены с Q1.3 дополняется задачей/исходом — база до первой точки
    const situations = new Set(
      scenes.map(
        ({ exercise }) =>
          String((exercise.payload as Record<string, unknown>).situation_ru).split('. ')[0],
      ),
    )
    expect(situations.size).toBe(2)
    // фразы-примеры правила пришиты из других уроков B — доступны экрану
    // (RuleCard с озвучкой, шаг 7 «В колоду»), своего пула у сцен нет
    for (const pid of view.lesson.grammar_point.phrase_ids) {
      const phrase = view.phrasesById[pid]
      expect(phrase, pid).toBeTruthy()
      expect(phrase.audio?.en_gb).toMatch(/^audio\/phrases\/cori\//)
    }
    expect(Object.keys(view.phrasesById)).toHaveLength(3)
    for (const { exercise } of scenes) {
      const payload = exercise.payload as unknown as {
        question_en: string
        situation_ru: string
        audio: string
        free_form: boolean
      }
      expect(payload.question_en.length).toBeGreaterThan(0)
      expect(payload.situation_ru.length).toBeGreaterThan(0)
      // реплика собеседника — предзаписанное аудио разговорника, без новых файлов
      expect(payload.audio).toMatch(/^audio\/phrasebook\/cori\/pb-/)
      expect(payload.free_form).toBe(true)
      expect(exercise.answer.accepted?.length).toBeGreaterThanOrEqual(1)
      expect(exercise.answer.speech_threshold).toBe(0.85)
      expect(exercise.answer.hint_ru).toBeTruthy()
      expect(exercise.meta.skill).toBe('speaking')
    }
  })
})

describe('loadQuotes / loadPhraseNotes (specs/05 §5, /#/srs)', () => {
  it('цитаты всех тайтлов проходят конверт и содержат поля UI', async () => {
    const quotes = await loadQuotes()
    expect(quotes.length).toBeGreaterThan(0)
    expect(
      quotes.every(({ id, title, season_episode, speaker, text, translation_ru }) =>
        Boolean(id && title && season_episode && speaker && text && translation_ru),
      ),
    ).toBe(true)
  })

  it('заметки фраз — 1:1 с фразами, id с префиксом note_', async () => {
    const [notes, phrases] = await Promise.all([loadPhraseNotes(), loadPhrases()])
    expect(notes.length).toBe(phrases.length)
    expect(notes.every((note) => note.id.startsWith('note_') && note.deck === 'phrases')).toBe(true)
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

describe('сцены разговорника: info-gap контракт (план {#teaching-quality} Q1.3, specs/02 {#scenes-tbl})', () => {
  const SCENE_LESSONS = [
    'les-c-26',
    'les-c-27',
    'les-c-28',
    'les-c-29',
    'les-c-30',
    'les-b-27',
    'les-b-30',
  ] as const

  it('каждая сцена интенсивов имеет разрыв и неязыковой исход (situation_ru: Задача/Исход/Разрыв)', async () => {
    const [lessons, exercises] = await Promise.all([loadLessons(), loadExercises()])
    const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]))
    for (const lessonId of SCENE_LESSONS) {
      const lesson = lessons.find((l) => l.id === lessonId)
      if (!lesson) throw new Error(`нет урока ${lessonId}`)
      const scenes = lesson.exercises
        .map(({ id }) => byId.get(id))
        .filter((e) => e?.payload.kind === 'answer_question')
      expect(scenes.length, lessonId).toBeGreaterThan(0)
      for (const scene of scenes) {
        const situation = String(scene!.payload.situation_ru ?? '')
        expect(situation, `${lessonId}/${scene!.id}`).toMatch(/Задача:|Разрыв|Разрыв:/)
        expect(situation, `${lessonId}/${scene!.id}`).toMatch(/Исход:/)
        // свободная речь: сцена со situation_ru — всегда free_form или с эталонами
        expect(
          scene!.payload.free_form === true || scene!.answer.accepted?.length,
          `${lessonId}/${scene!.id}`,
        ).toBeTruthy()
      }
    }
  })

  it('info-gap-сцены C-26…C-30/B-30: пользователь спрашивает (accepted — вопросы)', async () => {
    const [lessons, exercises] = await Promise.all([loadLessons(), loadExercises()])
    const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]))
    for (const lessonId of [
      'les-c-26',
      'les-c-27',
      'les-c-28',
      'les-c-29',
      'les-c-30',
      'les-b-30',
    ]) {
      const lesson = lessons.find((l) => l.id === lessonId)
      if (!lesson) throw new Error(`нет урока ${lessonId}`)
      const scenes = lesson.exercises
        .map(({ id }) => byId.get(id)!)
        .filter((e) => e.payload.kind === 'answer_question' && e.payload.free_form === true)
      expect(scenes.length, lessonId).toBeGreaterThan(0)
      for (const scene of scenes) {
        // разрыв: собеседник «знает» — пользователь спрашивает (вопросительные шаблоны)
        expect(scene.answer.accepted?.length, scene.id).toBeGreaterThan(0)
        for (const template of scene.answer.accepted ?? []) {
          expect(template, `${scene.id}: ${template}`).toMatch(/\?$/)
        }
        // существование audio-файла проверяет validate:data (specs/05 §9)
      }
    }
  })
})
