// Implements: plan://M5#5.5–5.6 — экран урока /#/lesson/:id (specs/07 §2.1, §4.4; specs/02 §2, §5).
// Пошаговый flow шаблона: Правило → Разогрев → Построение → Слух → Речь → Из сериала →
// В колоду. Чекпоинт пишется после каждого ответа (specs/02 §5, единица — задание).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  advanceStep,
  computeLessonStatus,
  createCheckpoint,
  currentStepEvaluation,
  finishPass,
  findStep,
  passAccuracy,
  recordAnswer,
} from '../domain/lesson/runner'
import type { ExerciseOutcome, LessonCheckpoint, SrsLessonStats } from '../domain/lesson/types'
import {
  courseToLessonId,
  loadLessonView,
  loadTraps,
  toPhraseNotes,
  withWarmupVariant,
  type ExerciseItem,
  type LessonView,
  type PhraseItem,
  type ResolvedExercise,
  type TrapItem,
} from '../content/lessons'
import { createFirstCards } from '../content/words'
import { awardLessonFinish, closeStudyDay, anySlotDone } from '../domain/game/award'
import { showToast } from '../lib/toast'
import { xpCategory } from '../domain/game/game'
import type { ProgressRepository } from '../domain/progress'
import { DexieProgressRepository } from '../data/progress-repository'
import { speak, stopSpeak } from '../lib/tts'
import {
  ChooseTranslationExercise,
  InputCheckExercise,
  MatchPairsExercise,
  TransformExercise,
  VoiceExercise,
  WordBankExercise,
} from '../components/lesson/ExerciseView'

const COURSE_ID_RE = /^(E|D|C|B|A|S)-\d{2}$/

type Phase =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'notfound' }
  | { kind: 'guard'; stepIndex: number; repeat: boolean } // specs/07 §4.4 + повтор пройденного
  | { kind: 'step' }
  | { kind: 'deck' } // шаг 7 «В колоду»
  | { kind: 'done' }
  | { kind: 'replay'; index: number } // проход по ошибкам (M11#11.3)

interface LessonScreenProps {
  repo?: ProgressRepository
  /** Собранный урок (инъекция для тестов; по умолчанию — данные ранга из data/). */
  view?: LessonView
  /** Каталог ловушек (инъекция для тестов; по умолчанию — data/traps.json). */
  traps?: Map<string, TrapItem>
}

/** Итог прохода для финального экрана — до сброса чекпоинта finishPass. */
interface PassSummary {
  xp: number
  accuracy: number
  minutes: number
}

function lessonPhrases(view: LessonView): PhraseItem[] {
  return Object.values(view.phrasesById)
}

/** SRS-статистика фраз урока для computeLessonStatus (specs/02 §5): интервал ≥7 дней — «выучено». */
function lessonSrsStats(
  cards: {
    card_id: string
    note_id: string
    deck: string
    state: number
    scheduled_days: number
  }[],
  view: LessonView,
): SrsLessonStats {
  const ids = new Set(lessonPhrases(view).map((phrase) => phrase.id))
  let learned = 0
  let lapsed = 0
  let total = 0
  for (const card of cards) {
    if (card.deck !== 'phrases') continue
    if (!card.note_id.startsWith('note_') || !ids.has(card.note_id.slice('note_'.length))) continue
    total += 1
    if (card.state === 2 && card.scheduled_days >= 7) learned += 1
    else if (card.state === 2) lapsed += 1
  }
  return { total, learned, lapsed }
}

/** Карточка правила (шаг 1): правило + примеры с озвучкой + «⚠️ Ловушка» (specs/02 §2). */
function RuleCard({ view, onUnderstood }: { view: LessonView; onUnderstood: () => void }) {
  const { t } = useTranslation()
  const gp = view.lesson.grammar_point
  return (
    <div className="lesson-exercise lesson-rule">
      <h3 lang="ru">{gp.title_ru}</h3>
      <div className="lesson-rule-md" lang="ru">
        {gp.rule_md.split('\n').map((line, index) => (
          <p key={index} className={line.startsWith('⚠') ? 'lesson-trap' : undefined}>
            {line.replace(/\*\*/g, '')}
          </p>
        ))}
      </div>
      <ul className="lesson-rule-examples">
        {gp.phrase_ids.slice(0, 3).map((pid) => {
          const phrase = view.phrasesById[pid]
          return (
            <li key={pid} lang="en">
              {phrase?.text_en ?? pid}
              {phrase?.audio?.en_gb && (
                <button
                  type="button"
                  className="srs-btn"
                  onClick={() => speak(phrase.text_en, { src: phrase.audio?.en_gb })}
                >
                  🔊
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <div className="lesson-actions">
        <button type="button" className="srs-btn srs-btn-good" onClick={onUnderstood}>
          {t('lesson.gotIt')} <kbd>⏎</kbd>
        </button>
      </div>
    </div>
  )
}

export default function LessonScreen({
  repo: repoProp,
  view: viewProp,
  traps: trapsProp,
}: LessonScreenProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const params = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const defaultRepo = useMemo(() => new DexieProgressRepository(), [])
  const repo = repoProp ?? defaultRepo
  const [view, setView] = useState<LessonView | null>(viewProp ?? null)
  const [traps, setTraps] = useState<Map<string, TrapItem>>(trapsProp ?? new Map())
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [confirmExit, setConfirmExit] = useState(false)
  const [checkpoint, setCheckpoint] = useState<LessonCheckpoint>(() => createCheckpoint())
  const [exerciseIndex, setExerciseIndex] = useState(0)
  const [ruleShown, setRuleShown] = useState(false)
  const [summary, setSummary] = useState<PassSummary | null>(null)
  /** Проход по ошибкам (M11#11.3): id заданий, где были ошибки (без XP и персиста). */
  const [replayIds, setReplayIds] = useState<string[]>([])
  const [startedAt] = useState(() => Date.now())
  /** прошлый статус записи: повтор пройденного не затирает оригинал (specs/07 §4.4) */
  const previousRowRef = useRef<{ status: string; score: number | null } | null>(null)
  const checkpointRef = useRef(checkpoint)
  // зеркало актуального чекпоинта для асинхронных сохранений — запись в эффекте,
  // не в рендере (react-hooks/refs; семантика та же: к моменту колбэков commit прошёл)
  useEffect(() => {
    checkpointRef.current = checkpoint
  })
  const saveBusy = useRef(false)
  const pendingRef = useRef<LessonCheckpoint | null>(null)
  // setState после размонтирования — unhandled rejection в CI (прецедент M19)
  const mountedRef = useRef(true)
  useEffect(
    () => () => {
      mountedRef.current = false
    },
    [],
  )

  const courseId = params.id ?? ''
  const valid = COURSE_ID_RE.test(courseId)

  // --- сохранение чекпоинта: очередь «последний выигрывает» ------------------
  const persist = useCallback(
    async (cp: LessonCheckpoint) => {
      /* istanbul ignore start — двойная гарда: все вызывающие уже проверили view */
      if (!view) return
      /* istanbul ignore stop */
      pendingRef.current = cp
      if (saveBusy.current) return
      saveBusy.current = true
      try {
        while (pendingRef.current !== null) {
          const next = pendingRef.current
          pendingRef.current = null
          await repo.putLessonProgress({
            lesson_id: view.lesson.id,
            status: (previousRowRef.current?.status as 'in_progress') ?? 'in_progress',
            score: previousRowRef.current?.score ?? null,
            checkpoint: next,
            completed_at: null,
            updated_at: new Date().toISOString(),
          })
        }
      } finally {
        saveBusy.current = false
      }
    },
    [repo, view],
  )

  // --- загрузка урока + сохранённого чекпоинта ------------------------------
  useEffect(() => {
    let alive = true
    async function load() {
      if (!valid) {
        setPhase({ kind: 'notfound' })
        return
      }
      const stepParam = searchParams.get('step')
      const lessonView = viewProp ?? (await loadLessonView(courseToLessonId(courseId)))
      const trapMap = trapsProp ?? (await loadTraps())
      if (!alive) return
      if (!lessonView) {
        setPhase({ kind: 'notfound' })
        return
      }
      setView(lessonView)
      setTraps(trapMap)
      let row
      try {
        row = await repo.getLessonProgress(lessonView.lesson.id)
      } catch {
        if (alive) setPhase({ kind: 'error' })
        return
      }
      if (!alive) return
      previousRowRef.current = row ? { status: row.status, score: row.score } : null
      const startCp = row?.checkpoint ?? createCheckpoint()
      const firstStep = findStep(lessonView.steps, startCp.stepIndex) ?? lessonView.steps[0] ?? null
      if (!firstStep) {
        setPhase({ kind: 'error' })
        return
      }
      // guard: незавершённый первый проход ИЛИ повтор уже пройденного урока
      if (row && row.checkpoint.passesDone === 0 && row.checkpoint.stepIndex > 1) {
        setCheckpoint({ ...startCp, stepIndex: firstStep.index })
        setPhase({ kind: 'guard', stepIndex: firstStep.index, repeat: false })
        return
      }
      if (row && row.checkpoint.passesDone >= 1) {
        setCheckpoint(createCheckpoint())
        setPhase({ kind: 'guard', stepIndex: 1, repeat: true })
        return
      }
      // deep-link ?step= (specs/07 §4.2): только ≤ достигнутого; невалидный — 404
      if (stepParam !== null) {
        const requested = Number(stepParam)
        const okStep =
          Number.isInteger(requested) && requested >= 1 && requested <= startCp.stepIndex
        if (!okStep) {
          setPhase({ kind: 'notfound' })
          return
        }
        const cp = { ...startCp, stepIndex: requested }
        setCheckpoint(cp)
        setRuleShown(requested > 1)
        setPhase(requested === 7 ? { kind: 'deck' } : { kind: 'step' })
        return
      }
      const cp = { ...startCp, stepIndex: firstStep.index }
      setCheckpoint(cp)
      setRuleShown(cp.stepIndex > 1)
      setPhase(cp.stepIndex === 7 ? { kind: 'deck' } : { kind: 'step' })
    }
    void load().catch(() => {
      if (alive) setPhase({ kind: 'error' })
    })
    return () => {
      alive = false
      stopSpeak()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const step = view?.steps.find((s) => s.index === checkpoint.stepIndex)
  const stepExercises = step ? (view?.content[step.index] ?? []) : []
  /** id → упражнение по всему уроку (для «прохода по ошибкам», M11#11.3). */
  const exerciseById = useMemo(() => {
    const map = new Map<string, ResolvedExercise>()
    if (view) {
      for (const items of Object.values(view.content)) {
        for (const item of items) map.set(item.exercise.id, item)
      }
    }
    return map
  }, [view])
  const trap: TrapItem | null = view?.lesson.trap_id
    ? (traps.get(view.lesson.trap_id) ?? null)
    : null

  /** Финальный исход задания (компонент вызывает ровно один раз) — specs/02 §5. */
  const handleAnswer = useCallback(
    (outcome: ExerciseOutcome, attempts: number, exerciseId: string) => {
      /* istanbul ignore start — двойная гарда: роутер рендерится только при view */
      if (!view) return
      /* istanbul ignore stop */
      const next = recordAnswer(checkpointRef.current, view.steps, exerciseId, outcome, attempts)
      setCheckpoint(next)
      void persist(next)
    },
    [view, persist],
  )

  /** Спор «Я был прав» (specs/02 §4.6): перезапись исхода на disputed (полный XP). */
  const handleDispute = useCallback(
    (exerciseId: string) => {
      /* istanbul ignore start — двойная гарда: роутер рендерится только при view */
      if (!view) return
      /* istanbul ignore stop */
      const result = checkpointRef.current.results[exerciseId]
      const attempts = result?.attempts ?? 1
      const next = recordAnswer(checkpointRef.current, view.steps, exerciseId, 'disputed', attempts)
      setCheckpoint(next)
      void persist(next)
    },
    [view, persist],
  )

  /** «Дальше»: следующее задание шага или переход шага (specs/02 §2). */
  const handleNext = useCallback(() => {
    if (!view || !step) return
    stopSpeak()
    const more = exerciseIndex + 1 < stepExercises.length
    if (more) {
      setExerciseIndex(exerciseIndex + 1)
      return
    }
    const next = advanceStep(checkpointRef.current, view.steps)
    if (next) {
      setCheckpoint(next)
      void persist(next)
      setExerciseIndex(0)
      setRuleShown(false)
      setPhase(next.stepIndex === 7 ? { kind: 'deck' } : { kind: 'step' })
    }
  }, [view, step, exerciseIndex, stepExercises.length, persist])

  /** Повтор шага (разогрев <70% с первой попытки — specs/02 §2: блок повторяется). */
  const repeatStep = () => {
    const cp: LessonCheckpoint = {
      ...checkpointRef.current,
      scores: checkpointRef.current.scores.filter(
        (score) => score.stepIndex !== checkpointRef.current.stepIndex,
      ),
    }
    setCheckpoint(cp)
    setExerciseIndex(0)
  }

  const stepEvaluation = useMemo(
    () => (view ? currentStepEvaluation(checkpoint, view.steps) : null),
    [view, checkpoint],
  )

  const stepNeedsRepeat =
    stepEvaluation !== null &&
    !stepEvaluation.passed &&
    step !== undefined &&
    stepExercises.length > 0 &&
    (checkpoint.scores.find((s) => s.stepIndex === checkpoint.stepIndex)?.answered ?? 0) >=
      stepExercises.length

  /** Шаг 7: фразы урока → SRS (rule-1: en-ru первой) — specs/02 §2 шаг 7. */
  const enrollDeck = useCallback(async () => {
    /* istanbul ignore start — двойная гарда: единственный вызывающий проверил view */
    if (!view) return
    /* istanbul ignore stop */
    await repo.ensureCards(createFirstCards(toPhraseNotes(lessonPhrases(view)), new Date()))
    const cp: LessonCheckpoint = {
      ...checkpointRef.current,
      srsEnqueued: lessonPhrases(view).map((phrase) => phrase.id),
    }
    setCheckpoint(cp)
    void persist(cp)
  }, [view, repo, persist])

  const finishLesson = useCallback(async () => {
    /* istanbul ignore start — двойная гарда: кнопка финала рендерится только при view */
    if (!view) return
    /* istanbul ignore stop */
    try {
      await enrollDeck()
      // istanbul ignore next — защитная ветка от unmount-гонки (нестабильна в юнитах)
      if (!mountedRef.current) return
      // снимок ДО finishPass (сбрасывает results/scores) — ревью M7#Б1
      const finished = checkpointRef.current
      const accuracy = passAccuracy(finished.scores) ?? 0
      const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000))
      setSummary({ xp: 0, accuracy, minutes })
      // ошибки для «прохода по ошибкам» (M11#11.3): не-первая попытка, подсказка, пропуск
      setReplayIds(
        Object.entries(finished.results)
          .filter(
            ([, result]) =>
              result.attempts > 1 || result.outcome === 'hint' || result.outcome === 'skip',
          )
          .map(([exerciseId]) => exerciseId),
      )
      // статус по правилам specs/02 §5; повтор не затирает оригинал (specs/07 §4.4)
      const cards = await repo.getAllCards()
      // istanbul ignore next — защитная ветка от unmount-гонки (нестабильна в юнитах)
      if (!mountedRef.current) return
      const previous = previousRowRef.current
      const stored =
        previous && previous.status !== 'in_progress'
          ? {
              status: previous.status as 'completed' | 'review_due',
              score: previous.score ?? accuracy,
            }
          : ((): { status: 'in_progress' | 'completed' | 'review_due'; score: number } => {
              const status = computeLessonStatus({
                row: {
                  lesson_id: view.lesson.id,
                  status: 'in_progress',
                  checkpoint: finishPass(checkpointRef.current),
                  score: accuracy,
                  completed_at: null,
                  updated_at: new Date().toISOString(),
                },
                previousCompleted: true,
                totalPasses: 1,
                srs: lessonSrsStats(cards, view),
              })
              const stored: 'in_progress' | 'completed' | 'review_due' =
                status === 'locked' || status === 'available'
                  ? 'in_progress'
                  : status === 'in_progress'
                    ? 'in_progress'
                    : status
              return { status: stored, score: accuracy }
            })()
      const cp = finishPass(finished)
      setCheckpoint(cp)
      await repo.putLessonProgress({
        lesson_id: view.lesson.id,
        status: stored.status,
        score: stored.score,
        checkpoint: cp,
        completed_at: stored.status === 'in_progress' ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      // XP-шина (plan://M7#7.3): категории упражнений с капами, квесты, стрик
      const xpByCategory: Record<string, number> = {}
      const typesById = new Map<string, string>()
      const quoteClozeIds = new Set<string>()
      for (const items of Object.values(view.content)) {
        for (const { exercise } of items) {
          typesById.set(exercise.id, exercise.type)
          if (exercise.type === 'cloze' && exercise.payload.quote) quoteClozeIds.add(exercise.id)
        }
      }
      for (const [exerciseId, result] of Object.entries(finished.results)) {
        const base = xpMap(view)[exerciseId]
        const type = typesById.get(exerciseId)
        if (base === undefined || !type) continue
        const category = xpCategory(type)
        const earned = xpForOutcomeXp(base, result.outcome)
        xpByCategory[category] = (xpByCategory[category] ?? 0) + earned
      }
      const dictationCount = finished.scores.find((score) => score.stepIndex === 4)?.answered ?? 0
      const bonusByType: Record<string, number> = {}
      for (const [exerciseId] of Object.entries(finished.results)) {
        const type = typesById.get(exerciseId)
        if (!type) continue
        // cloze-бонус — только цитатные (шаг «Из сериала»), не правило (ревью M7#М12)
        if (type === 'cloze' && !quoteClozeIds.has(exerciseId)) continue
        bonusByType[type] = (bonusByType[type] ?? 0) + 1
      }
      const award = await awardLessonFinish(repo, new Date(), {
        xpByCategory,
        dictationCount,
        bonusByType,
        isRepeat: Boolean(previous && previous.status !== 'in_progress'),
      })
      // istanbul ignore next — защитная ветка от unmount-гонки (нестабильна в юнитах)
      if (!mountedRef.current) return
      if (anySlotDone(award.quest)) {
        const closed = await closeStudyDay(repo, new Date())
        showToast(t('toast.questDone')) // решение M10#2: значимые события
        if (closed.freezeGained) showToast(t('toast.freezeGained'))
      }
      setSummary((prev) => (prev ? { ...prev, xp: award.awarded } : prev))
      setPhase({ kind: 'done' })
    } catch {
      // istanbul ignore next — защитная ветка от unmount-гонки (нестабильна в юнитах)
      if (mountedRef.current) setPhase({ kind: 'error' })
    }
  }, [view, enrollDeck, repo, startedAt])

  // Enter — «Дальше»/«Понятно», только когда фокус не на интерактивном элементе
  // (specs/07 §5.1); иначе активный контрол обрабатывает Enter сам (без дубля)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return
      const target = event.target
      const onControl =
        target instanceof HTMLInputElement ||
        (target instanceof HTMLButtonElement && !target.disabled)
      if (onControl) return
      if (phase.kind !== 'step') return
      if (step?.kind === 'rule' && !ruleShown) {
        stopSpeak()
        setRuleShown(true)
        return
      }
      handleNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase.kind, ruleShown, step, handleNext])

  // Выход из незавершённого урока — осознанный (specs/07 §4.3–4.4): прогресс
  // сохранён, продолжить можно с шага N. Esc открывает/закрывает подтверждение,
  // но не срабатывает из полей ввода (specs/07 §5.1 — шорткоты вне input).
  useEffect(() => {
    if (phase.kind !== 'step') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      setConfirmExit((prev) => !prev)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase.kind])

  // beforeunload в незавершённом уроке (решение M10#5: нативный диалог браузера)
  useEffect(() => {
    if (phase.kind !== 'step' && phase.kind !== 'deck') return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [phase.kind])

  if (phase.kind === 'loading') {
    return (
      <section className="panel lesson-panel">
        <p className="dim">{t('common.loading')}</p>
      </section>
    )
  }
  if (phase.kind === 'error') {
    return (
      <section className="panel lesson-panel">
        <p className="srs-error">{t('lesson.error')}</p>
        <div className="lesson-actions">
          <button type="button" className="srs-btn" onClick={() => window.location.reload()}>
            {t('lesson.retryLoad')}
          </button>
        </div>
      </section>
    )
  }
  if (phase.kind === 'notfound' || !view) {
    return (
      <section className="panel lesson-panel">
        <h2>{t('notFound.title')}</h2>
        <p className="dim">{t('lesson.notFound')}</p>
      </section>
    )
  }
  if (phase.kind === 'guard') {
    return (
      <section className="panel lesson-panel">
        <h2 lang="ru">{view.lesson.title}</h2>
        {phase.repeat ? (
          <>
            <p>{t('lesson.repeatPrompt')}</p>
            <p className="dim">{t('lesson.repeatNote')}</p>
          </>
        ) : (
          <p>
            {t('lesson.resumePrompt', {
              step: Math.max(1, view.steps.findIndex((s) => s.index === phase.stepIndex) + 1),
            })}
          </p>
        )}
        <div className="lesson-actions">
          <button
            type="button"
            className="srs-btn srs-btn-good"
            onClick={() => {
              if (phase.repeat) {
                const fresh = createCheckpoint()
                setCheckpoint(fresh)
                // разогрев «с новыми заданиями» при повторе (план M21#21.1)
                if (view) setView(withWarmupVariant(view))
              }
              setExerciseIndex(0)
              setRuleShown(false)
              setPhase(
                !phase.repeat && checkpoint.stepIndex === 7 ? { kind: 'deck' } : { kind: 'step' },
              )
            }}
          >
            {phase.repeat ? t('lesson.repeatLesson') : t('lesson.resume')}
          </button>
        </div>
      </section>
    )
  }
  if (phase.kind === 'done') {
    return (
      <section className="panel lesson-panel">
        <h2>{t('lesson.lessonDone')}</h2>
        <ul className="lesson-summary">
          <li>{t('lesson.summaryXp', { xp: summary?.xp ?? 0 })}</li>
          <li>{t('lesson.summaryAccuracy', { accuracy: summary?.accuracy ?? 0 })}</li>
          <li>{t('lesson.summaryTime', { minutes: summary?.minutes ?? 1 })}</li>
          <li>{t('lesson.summaryDeck', { count: lessonPhrases(view).length })}</li>
        </ul>
        <p className="dim">{t('lesson.completionNote')}</p>
        {replayIds.length > 0 && (
          <div className="lesson-actions" style={{ margin: '12px 0' }}>
            <button
              type="button"
              className="srs-btn"
              onClick={() => setPhase({ kind: 'replay', index: 0 })}
            >
              {t('lesson.replayButton', { count: replayIds.length })}
            </button>
          </div>
        )}
        {view.lesson.bebris_video?.youtube_id && (
          <p className="dim">
            {t('lesson.videoTopic')}:{' '}
            <a
              href={`https://www.youtube.com/watch?v=${view.lesson.bebris_video.youtube_id}`}
              target="_blank"
              rel="noreferrer"
            >
              YouTube
            </a>
          </p>
        )}
      </section>
    )
  }
  if (phase.kind === 'replay') {
    const list = replayIds
      .map((id) => exerciseById.get(id))
      .filter((item): item is ResolvedExercise => item !== undefined)
    const currentReplay = list[phase.index]
    if (!currentReplay) {
      // защитный случай (пустой список) — возврат на финал
      return (
        <section className="panel lesson-panel">
          <h2>{t('lesson.lessonDone')}</h2>
          <p className="dim">{t('lesson.replayEmpty')}</p>
          <div className="lesson-actions">
            <button type="button" className="srs-btn" onClick={() => setPhase({ kind: 'done' })}>
              {t('lesson.replayBackToSummary')}
            </button>
          </div>
        </section>
      )
    }
    return (
      <section className="panel lesson-panel">
        <header className="lesson-head">
          <h2>{t('lesson.replayTitle')}</h2>
          <p className="dim">
            {t('lesson.replayProgress', { current: phase.index + 1, total: list.length })}
          </p>
          <button type="button" className="srs-finish" onClick={() => setPhase({ kind: 'done' })}>
            ✕ {t('lesson.exit')}
          </button>
        </header>
        <ExerciseRouter
          key={currentReplay.exercise.id}
          current={currentReplay}
          trap={trap}
          onAnswer={() => undefined}
          onDispute={() => undefined}
          phrasesById={view.phrasesById}
          onNext={() => {
            if (phase.index + 1 < list.length) {
              setPhase({ kind: 'replay', index: phase.index + 1 })
            } else {
              showToast(t('lesson.replayFinished'))
              setPhase({ kind: 'done' })
            }
          }}
        />
      </section>
    )
  }
  if (phase.kind === 'deck') {
    return (
      <section className="panel lesson-panel">
        <h2>{t('lesson.deckTitle')}</h2>
        <p className="dim">{t('lesson.deckText', { count: lessonPhrases(view).length })}</p>
        <div className="lesson-actions">
          <button
            type="button"
            className="srs-btn srs-btn-good"
            onClick={() => void finishLesson()}
          >
            {t('lesson.finishLesson')}
          </button>
        </div>
      </section>
    )
  }

  // --- активный шаг ----------------------------------------------------------
  const current = stepExercises[exerciseIndex]
  const isRuleStep = step?.kind === 'rule'
  // позиция шага в уроке (пустые блоки шаблона пропускаются — B-27: 1,5,7 → 1,2,3);
  // синтетический вид без текущего шага (тесты) — считаем первой
  const stepPosition = Math.max(
    1,
    view.steps.findIndex((s) => s.index === checkpoint.stepIndex) + 1,
  )
  return (
    <section className="panel lesson-panel">
      <header className="lesson-head">
        <h2 lang="ru">{view.lesson.title}</h2>
        <p className="dim">
          {t(`lesson.steps.${step?.kind ?? 'rule'}`)} ·{' '}
          {t('lesson.stepProgress', { current: stepPosition, total: view.steps.length })}
        </p>
        <button type="button" className="srs-finish" onClick={() => setConfirmExit(true)}>
          ✕ {t('lesson.exit')}
        </button>
      </header>

      {confirmExit && (
        <p
          className="srs-exit-confirm"
          role="alertdialog"
          aria-label={t('lesson.exitConfirmTitle')}
        >
          <span>{t('lesson.exitConfirm', { step: stepPosition })}</span>
          <span className="srs-actions">
            <button type="button" className="srs-btn" onClick={() => setConfirmExit(false)}>
              {t('lesson.exitCancel')}
            </button>
            <button
              type="button"
              className="srs-btn srs-btn-again"
              onClick={() => {
                stopSpeak()
                navigate('/')
              }}
            >
              {t('lesson.exitYes')}
            </button>
          </span>
        </p>
      )}

      {isRuleStep && !ruleShown && (
        <RuleCard
          view={view}
          onUnderstood={() => {
            stopSpeak()
            setRuleShown(true)
          }}
        />
      )}

      {(ruleShown || !isRuleStep) && current && (
        <ExerciseRouter
          key={current.exercise.id}
          current={current}
          trap={trap}
          onAnswer={(outcome, attempts) => handleAnswer(outcome, attempts, current.exercise.id)}
          onDispute={() => handleDispute(current.exercise.id)}
          onNext={handleNext}
          phrasesById={view.phrasesById}
        />
      )}

      {stepNeedsRepeat && (
        <div className="lesson-actions">
          <p className="dim">{t('lesson.stepIncomplete')}</p>
          <button type="button" className="srs-btn" onClick={repeatStep}>
            {t('lesson.repeatStep')}
          </button>
        </div>
      )}

      {/* слух <60%: шаг не блокируем, но предлагаем повтор (specs/02 §2, план M21#21.1) */}
      {stepEvaluation?.retrySuggested && !stepNeedsRepeat && (
        <div className="lesson-actions">
          <p className="dim">{t('lesson.listeningRetryHint')}</p>
          <button type="button" className="srs-btn" onClick={repeatStep}>
            {t('lesson.repeatStep')}
          </button>
        </div>
      )}
    </section>
  )
}

/** Роутер типов упражнений: маппинг type → компонент. */
function ExerciseRouter({
  current,
  trap,
  onAnswer,
  onDispute,
  onNext,
  phrasesById,
}: {
  current: { exercise: ExerciseItem; phrase: PhraseItem | null }
  trap: TrapItem | null
  onAnswer: (outcome: ExerciseOutcome, attempts: number) => void
  onDispute: () => void
  onNext: () => void
  phrasesById: Record<string, PhraseItem>
}) {
  const { t } = useTranslation()
  const { exercise, phrase } = current
  const common = { exercise, phrase, trap, onAnswer, onDispute, onNext }
  switch (exercise.type) {
    case 'translate':
      return <InputCheckExercise mode="translate" {...common} />
    case 'dictation':
      return <InputCheckExercise mode="dictation" {...common} />
    case 'cloze':
      // cloze правила: ошибки не штрафуются XP (specs/02 §2 шаг 1)
      return <InputCheckExercise mode="cloze" {...common} lenient />
    case 'choose_translation':
      return <ChooseTranslationExercise {...common} />
    case 'match_pairs':
      return <MatchPairsExercise {...common} />
    case 'word_bank':
      return <WordBankExercise {...common} />
    case 'find_error':
      return <InputCheckExercise mode="find_error" {...common} />
    case 'verb_tense':
      return <InputCheckExercise mode="verb_tense" {...common} />
    case 'transform':
      return <TransformExercise {...common} phrasesById={phrasesById} />
    case 'speak':
      return <VoiceExercise mode="speak" {...common} />
    case 'shadowing':
      return <VoiceExercise mode="shadowing" {...common} />
    case 'answer_question':
      return <VoiceExercise mode="answer" {...common} />
    default:
      // типы перечислены схемой exercise (specs/05 §3) — default недостижим
      /* istanbul ignore next */
      return (
        <div className="lesson-exercise">
          <p className="dim">{t('lesson.unknownExercise', { type: exercise.type })}</p>
          <div className="lesson-actions">
            <button type="button" className="srs-btn srs-btn-good" onClick={onNext}>
              {t('lesson.next')} <kbd>⏎</kbd>
            </button>
          </div>
        </div>
      )
  }
}

/** XP исхода по правилам попыток (specs/02 §3; канон значений — meta.xp). */
function xpForOutcomeXp(base: number, outcome: string): number {
  if (outcome === 'correct' || outcome === 'disputed' || outcome === 'self_reported') return base
  if (outcome === 'correct_retry') return Math.floor(base / 2)
  return 0
}

function xpMap(view: LessonView): Record<string, number> {
  const map: Record<string, number> = {}
  for (const items of Object.values(view.content)) {
    for (const { exercise } of items) map[exercise.id] = exercise.meta.xp
  }
  return map
}
