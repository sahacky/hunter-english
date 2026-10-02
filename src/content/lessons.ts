// Implements: plan://M5#5.3 — загрузчик уроков/упражнений/фраз (specs/05 §2–§4).
// Контент живёт в data/lessons и data/phrases; ленивые чанки — как в words.ts.
// Домен (specs/02) работает с логическими шагами; здесь — связка payload → phrase.

import { assertEnvelope } from './envelope'
import { groupIntoSteps } from '../domain/lesson/steps'
import type { LessonStep } from '../domain/lesson/types'
import type { Note } from '../domain/srs/types'

/** Фраза — схема specs/05 §2 (kind: phrases). */
export interface PhraseItem {
  id: string
  text_en: string
  translation_ru: string
  grammar_point_id: string | null
  variants: string[]
  audio?: { en_gb?: string }
}

/** Блок answer упражнения — specs/05 §3. */
export interface ExerciseAnswer {
  normalization: 'default'
  typo: 'allow' | 'exact'
  accepted?: string[]
  speech_threshold?: number
  hint_ru?: string
}

/** Метаданные упражнения — specs/05 §3. */
export interface ExerciseMeta {
  skill: 'words' | 'grammar' | 'listening' | 'speaking'
  xp: number
}

/** Упражнение — схема specs/05 §3; payload различается по `kind` (дискриминатор). */
export interface ExerciseItem {
  id: string
  type: string
  payload: { kind: string } & Record<string, unknown>
  answer: ExerciseAnswer
  meta: ExerciseMeta
}

/** Урок — схема specs/05 §4 (kind: lessons). */
export interface LessonItem {
  id: string
  rank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S'
  module: string
  title: string
  grammar_point: {
    id: string
    title_ru: string
    rule_md: string
    phrase_ids: string[]
    trap_id?: string | null
  }
  vocab_band: { list: 'ngsl-spoken' | 'ngsl' | 'subtitles'; from: number; to: number } | null
  phrasebook_topic: string | null
  trap_id: string | null
  quotes_topic: string | null
  exercises: { id: string }[]
  bebris_video: {
    lesson: string
    playlist_index: number | null
    youtube_id: string | null
    title: string | null
  } | null
}

interface LessonsFile {
  schema_version: number
  kind: 'lessons'
  items: LessonItem[]
}

interface ExercisesFile {
  schema_version: number
  kind: 'exercises'
  items: ExerciseItem[]
}

interface PhrasesFile {
  schema_version: number
  kind: 'phrases'
  items: PhraseItem[]
}

/** Ленивые чанки: файлы по рангам (specs/05 §0), грузятся по запросу. */
const lessonModules = import.meta.glob('/data/lessons/lessons-*.json') as Record<
  string,
  () => Promise<LessonsFile>
>
const exerciseModules = import.meta.glob('/data/lessons/exercises-*.json') as Record<
  string,
  () => Promise<ExercisesFile>
>
const phraseModules = import.meta.glob('/data/phrases/phrases-*.json') as Record<
  string,
  () => Promise<PhrasesFile>
>

/** `course://E-01` из программы (specs/01 §1) → id урока в данных. */
export function courseToLessonId(courseId: string): string {
  return `les-${courseId.toLowerCase()}`
}

/** id урока → слаг маршрута `E-01` (валидация specs/07 §2.2 — на экране). */
export function lessonToCourseId(lessonId: string): string {
  return lessonId.replace(/^les-/, '').toUpperCase()
}

/** Порядок рангов курса (specs/01 §1): E → D → C → B → A → S. */
export const COURSE_RANKS = ['E', 'D', 'C', 'B', 'A', 'S'] as const

/**
 * Все уроки всех рангов в порядке курса E→S (для `/#/path` и «следующего урока»
 * дашборда). Чанки данных лежат файлами a…s — glob отдаёт их алфавитом, поэтому
 * порядок курса восстанавливается здесь (фидбей 2026-10-02: «первый урок» на
 * дашборде показывался A-01 — алфавитный порядок файлов).
 */
export async function loadLessons(): Promise<LessonItem[]> {
  const files = await Promise.all(Object.values(lessonModules).map((load) => load()))
  const lessons = files.flatMap((file, i) => {
    assertEnvelope(file, 'lessons', `data/lessons/lessons #${i}`)
    return file.items
  })
  const rankOrder = new Map(COURSE_RANKS.map((rank, index) => [rank, index]))
  return lessons.sort(
    (a, b) =>
      (rankOrder.get(a.rank) ?? 0) - (rankOrder.get(b.rank) ?? 0) || a.id.localeCompare(b.id),
  )
}

/** Урок по id (напр. `les-e-01`); null — урока нет в данных. */
export async function loadLesson(lessonId: string): Promise<LessonItem | null> {
  const lessons = await loadLessons()
  return lessons.find((lesson) => lesson.id === lessonId) ?? null
}

/** Все упражнения всех рангов; файлы-чанки грузятся параллельно. */
export async function loadExercises(): Promise<ExerciseItem[]> {
  const files = await Promise.all(Object.values(exerciseModules).map((load) => load()))
  return files.flatMap((file, i) => {
    assertEnvelope(file, 'exercises', `data/lessons/exercises #${i}`)
    return file.items
  })
}

/** Все фразы всех рангов; файлы-чанки грузятся параллельно. */
export async function loadPhrases(): Promise<PhraseItem[]> {
  const files = await Promise.all(Object.values(phraseModules).map((load) => load()))
  return files.flatMap((file, i) => {
    assertEnvelope(file, 'phrases', `data/phrases #${i}`)
    return file.items
  })
}

/** Задание урока, связанное с эталонной фразой (specs/05 §3: payload.phrase_id). */
export interface ResolvedExercise {
  exercise: ExerciseItem
  /** Фраза по payload.phrase_id (у cloze/choose_translation/match_pairs её нет). */
  phrase: PhraseItem | null
}

/** Готовый к показу урок: шаги домена + контент каждого шага. */
export interface LessonView {
  lesson: LessonItem
  /** Шаги 1–6 из данных + шаг 7 «В колоду» (заданий не имеет). */
  steps: LessonStep[]
  /** Контент шага в порядке следования. */
  content: Record<number, ResolvedExercise[]>
  /** Все фразы урока (пул целиком — правило, колода, словарь шага). */
  phrasesById: Record<string, PhraseItem>
}

/** id фраз, на которые ссылается payload упражнения (specs/05 §3). */
export function exercisePhraseIds(exercise: ExerciseItem): string[] {
  const payload = exercise.payload
  const ids: string[] = []
  if (typeof payload.phrase_id === 'string') ids.push(payload.phrase_id)
  if (typeof payload.source_phrase_id === 'string') ids.push(payload.source_phrase_id)
  const steps = Array.isArray(payload.steps) ? payload.steps : []
  for (const step of steps) {
    const stepPhraseId = (step as { phrase_id?: unknown }).phrase_id
    if (typeof stepPhraseId === 'string') ids.push(stepPhraseId)
  }
  return ids
}

/**
 * Чистая сборка урока: группирует упражнения в шаги (домен, specs/02 §2) и
 * привязывает эталонные фразы. Неизвестные ссылки — ошибка сборки (валидатор
 * specs/05 §9 не пропустит такие файлы, здесь — защитный throw).
 */
export function assembleLesson(
  lesson: LessonItem,
  exerciseById: Map<string, ExerciseItem>,
  phraseById: Map<string, PhraseItem>,
): LessonView {
  const refs = lesson.exercises.map(({ id }) => {
    const exercise = exerciseById.get(id)
    if (!exercise) throw new Error(`упражнение "${id}" урока ${lesson.id} не найдено`)
    return {
      id,
      type: exercise.type,
      isQuoteCloze: exercise.payload.kind === 'cloze' && Boolean(exercise.payload.quote),
    }
  })
  const content: Record<number, ResolvedExercise[]> = {}
  const steps: LessonStep[] = [...groupIntoSteps(refs), { index: 7, kind: 'deck', exerciseIds: [] }]
  for (const step of steps) {
    content[step.index] = step.exerciseIds.map((id) => {
      const exercise = exerciseById.get(id)
      /* istanbul ignore start — дубль проверки из refs-цикла выше (та же Map, те же id) */
      if (!exercise) throw new Error(`упражнение "${id}" урока ${lesson.id} не найдено`)
      /* istanbul ignore stop */
      const [phraseId] = exercisePhraseIds(exercise)
      return { exercise, phrase: phraseId ? (phraseById.get(phraseId) ?? null) : null }
    })
  }
  const lessonPhrases = Object.fromEntries(
    [...phraseById].filter(([, phrase]) => phrase.grammar_point_id === lesson.grammar_point.id),
  )
  // Кросс-урочные ссылки (transform-цепочки, find_error, answer_question —
  // ревью M12 Б-1): фразы, на которые ссылаются упражнения урока, доступны
  // экрану через view.phrasesById, даже если они из другого урока
  for (const { id } of lesson.exercises) {
    const exercise = exerciseById.get(id)
    /* istanbul ignore start — дубль проверки: отсутствующее упражнение уже дало throw выше */
    if (!exercise) continue
    /* istanbul ignore stop */
    for (const refId of exercisePhraseIds(exercise)) {
      const ref = phraseById.get(refId)
      if (ref && !(ref.id in lessonPhrases)) lessonPhrases[ref.id] = ref
    }
  }
  return { lesson, steps, content, phrasesById: lessonPhrases }
}

/** Полная загрузка урока с зависимостями; null — урока нет. */
export async function loadLessonView(lessonId: string): Promise<LessonView | null> {
  const lesson = await loadLesson(lessonId)
  if (!lesson) return null
  const [exercises, phrases] = await Promise.all([loadExercises(), loadPhrases()])
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  const phraseById = new Map(phrases.map((phrase) => [phrase.id, phrase]))
  return assembleLesson(lesson, exerciseById, phraseById)
}

/** Минимальный размер пула для варианта разогрева: 4 choose (цель+3 дистрактора) + 5 пар. */
const WARMUP_MIN_POOL = 9

function pickUnique<T>(pool: readonly T[], count: number, rng: () => number): T[] {
  const rest = [...pool]
  const out: T[] = []
  while (out.length < count && rest.length > 0) {
    out.push(...rest.splice(Math.floor(rng() * rest.length), 1))
  }
  return out
}

/**
 * Разогрев «с новыми заданиями» при повторе урока (план M21#21.1, отложено
 * ревью M5/M8): шаг 1 заменяется на свежесобранные choose_translation и
 * match_pairs из пула фраз этого же урока. Синтетические id (ex-warmup-r-…)
 * — в XP-карту экрана попадают через view.content по meta.xp. Если пул мал
 * (короткие уроки-колоды S-07/S-15) — view возвращается как есть.
 */
export function withWarmupVariant(view: LessonView, rng: () => number = Math.random): LessonView {
  const warmupStep = view.steps.find((step) => step.kind === 'warmup')
  if (!warmupStep) return view
  const all = Object.values(view.phrasesById).filter(
    (phrase) => phrase.grammar_point_id === view.lesson.grammar_point.id,
  )
  const ruCounts = new Map<string, number>()
  for (const phrase of all) {
    ruCounts.set(phrase.translation_ru, (ruCounts.get(phrase.translation_ru) ?? 0) + 1)
  }
  const pool = all.filter((phrase) => ruCounts.get(phrase.translation_ru) === 1)
  if (pool.length < WARMUP_MIN_POOL) return view

  const exercises: ExerciseItem[] = []
  const used = new Set<string>()
  const targets = pickUnique(pool, 4, rng)
  for (const target of targets) {
    used.add(target.id)
    const distractors = pickUnique(
      pool.filter((p) => p.id !== target.id && p.translation_ru !== target.translation_ru),
      3,
      rng,
    )
    /* istanbul ignore start — недостижимо: пул ≥9 с уникальными RU даёт ≥8 дистракторов */
    if (distractors.length < 3) return view
    /* istanbul ignore stop */
    const options = [...distractors.map((p) => p.text_en), target.text_en]
    // перемешивание Фишера—Йетса на копии (rng инъецируется для тестов)
    for (let i = options.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1))
      ;[options[i], options[j]] = [options[j], options[i]]
    }
    exercises.push({
      id: `ex-warmup-r-${exercises.length + 1}`,
      type: 'choose_translation',
      payload: {
        kind: 'choose_translation',
        prompt: target.translation_ru,
        options,
        correct: options.indexOf(target.text_en),
      },
      answer: { normalization: 'default', typo: 'exact' },
      meta: { skill: 'words', xp: 1 },
    })
  }
  const seenRu = new Set<string>()
  const pairPool = pool.filter((p) => {
    if (used.has(p.id) || seenRu.has(p.translation_ru)) return false
    seenRu.add(p.translation_ru)
    return true
  })
  const pairs = pickUnique(pairPool, 5, rng)
  /* istanbul ignore start — недостижимо: pairPool ≥ pool−4 ≥ 5 при пуле ≥9 */
  if (pairs.length < 5) return view
  /* istanbul ignore stop */
  exercises.push({
    id: 'ex-warmup-r-5',
    type: 'match_pairs',
    payload: {
      kind: 'match_pairs',
      pairs: pairs.map((p) => ({ en: p.text_en, ru: p.translation_ru })),
    },
    answer: { normalization: 'default', typo: 'exact' },
    meta: { skill: 'words', xp: 1 },
  })
  const content = { ...view.content, 1: exercises.map((exercise) => ({ exercise, phrase: null })) }
  return { ...view, content }
}

/** Заметки фраз для SRS (deck 'phrases'; урок отправляет их на шаге 7 — specs/02 §2). */
export function toPhraseNotes(phrases: readonly PhraseItem[]): Note[] {
  return phrases.map((phrase) => ({
    id: `note_${phrase.id}`,
    deck: 'phrases',
    entityId: phrase.id,
    en: phrase.text_en,
    ru: phrase.translation_ru,
    audio: phrase.audio?.en_gb,
  }))
}

/** Все заметки фраз (для /#/srs: разрешение note_id карточек, созданных уроками). */
export async function loadPhraseNotes(): Promise<Note[]> {
  return toPhraseNotes(await loadPhrases())
}

/** Запись каталога ловушек (data/traps.json → specs/05 §6.5). */
export interface TrapItem {
  id: string
  lt_id: string
  title_ru: string
  wrong_en: string
  right_en: string
  explanation_ru: string
  tags: string[]
}

interface TrapsFile {
  schema_version: number
  kind: 'traps'
  items: TrapItem[]
}

const trapsModule = import.meta.glob('/data/traps.json') as Record<string, () => Promise<TrapsFile>>

/** Цитата — схема specs/05 §5 (поля, нужные UI). */
export interface QuoteItem {
  id: string
  title: string
  season_episode: string
  speaker: string
  text: string
  translation_ru: string
  auto_vocab: { top1000: number }
  /** Предзаписанное аудио cori (plan://voice-fix V2.1); нет — Web Speech. */
  audio?: { en_gb?: string }
}

interface QuotesFile {
  schema_version: number
  kind: 'quotes'
  items: QuoteItem[]
}

const quoteModules = import.meta.glob('/data/quotes/*.json') as Record<
  string,
  () => Promise<QuotesFile>
>

/** Все цитаты всех тайтлов. */
export async function loadQuotes(): Promise<QuoteItem[]> {
  const files = await Promise.all(Object.values(quoteModules).map((load) => load()))
  return files.flatMap((file, i) => {
    assertEnvelope(file, 'quotes', `data/quotes #${i}`)
    return file.items
  })
}

/** Каталог ловушек: slug → запись (для CheckTask ловушек, specs/02 §4.3/§4.7). */
export async function loadTraps(): Promise<Map<string, TrapItem>> {
  const files = await Promise.all(Object.values(trapsModule).map((load) => load()))
  return new Map(files.flatMap((file) => file.items.map((trap) => [trap.id, trap] as const)))
}
