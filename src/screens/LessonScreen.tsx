// Implements: plan://M5#5.5–5.6 — экран урока /#/lesson/:id (specs/07 §2.1, §4.4; specs/02 §2, §5).
// Пошаговый flow шаблона: Правило → Разогрев → Построение → Слух → Речь → Из сериала →
// В колоду. Чекпоинт пишется после каждого ответа (specs/02 §5, единица — задание).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  advanceStep,
  createCheckpoint,
  currentStepEvaluation,
  finishPass,
  passAccuracy,
  recordAnswer,
  totalXp,
} from '../domain/lesson/runner'
import type { ExerciseOutcome, LessonCheckpoint } from '../domain/lesson/types'
import {
  courseToLessonId,
  loadLessonView,
  type LessonView,
  type PhraseItem,
} from '../content/lessons'
import { createFirstCards } from '../content/words'
import type { Note } from '../domain/srs/types'
import type { ProgressRepository } from '../domain/progress'
import { DexieProgressRepository } from '../data/progress-repository'
import { playAudio, stopAudio } from '../lib/audio'
import {
  ChooseTranslationExercise,
  InputCheckExercise,
  MatchPairsExercise,
  VoiceExercise,
  WordBankExercise,
} from '../components/lesson/ExerciseView'

const COURSE_ID_RE = /^(E|D|C|B|A|S)-\d{2}$/

type Phase =
  | { kind: 'loading' }
  | { kind: 'notfound' }
  | { kind: 'guard'; stepIndex: number } // «Продолжить / Сначала» (specs/07 §4.4)
  | { kind: 'step' }
  | { kind: 'deck' } // шаг 7 «В колоду»
  | { kind: 'done' }

interface LessonScreenProps {
  repo?: ProgressRepository
  /** Собранный урок (инъекция для тестов; по умолчанию — данные ранга из data/). */
  view?: LessonView
}

function phraseNotes(phrases: PhraseItem[]): Note[] {
  return phrases.map((phrase) => ({
    id: `note_${phrase.id}`,
    deck: 'phrases',
    entityId: phrase.id,
    en: phrase.text_en,
    ru: phrase.translation_ru,
    audio: phrase.audio?.en_gb,
  }))
}

function lessonPhrases(view: LessonView): PhraseItem[] {
  return Object.values(view.phrasesById)
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
                  onClick={() => playAudio(phrase.audio!.en_gb!)}
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

export default function LessonScreen({ repo: repoProp, view: viewProp }: LessonScreenProps) {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const defaultRepo = useMemo(() => new DexieProgressRepository(), [])
  const repo = repoProp ?? defaultRepo
  const [view, setView] = useState<LessonView | null>(viewProp ?? null)
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [checkpoint, setCheckpoint] = useState<LessonCheckpoint>(() => createCheckpoint())
  const [exerciseIndex, setExerciseIndex] = useState(0)
  const [ruleShown, setRuleShown] = useState(false)
  const [deckEnrolled, setDeckEnrolled] = useState(false)
  const [startedAt] = useState(() => Date.now())
  const saveBusy = useRef(false)

  const courseId = params.id ?? ''
  const valid = COURSE_ID_RE.test(courseId)

  // --- загрузка урока + сохранённого чекпоинта ------------------------------
  useEffect(() => {
    let alive = true
    async function load() {
      if (!valid) {
        setPhase({ kind: 'notfound' })
        return
      }
      const lessonView = viewProp ?? (await loadLessonView(courseToLessonId(courseId)))
      if (!alive) return
      if (!lessonView) {
        setPhase({ kind: 'notfound' })
        return
      }
      setView(lessonView)
      const row = await repo.getLessonProgress(lessonView.lesson.id)
      if (!alive) return
      if (row && row.checkpoint.passesDone === 0 && row.checkpoint.stepIndex > 1) {
        setCheckpoint(row.checkpoint)
        setPhase({ kind: 'guard', stepIndex: row.checkpoint.stepIndex })
        return
      }
      // deep-link ?step= (specs/07 §4.2): только ≤ достигнутого шага
      const startCp = row?.checkpoint ?? createCheckpoint()
      const requested = Number(searchParams.get('step'))
      const allowed =
        Number.isInteger(requested) && requested > 0 && requested <= startCp.stepIndex
          ? requested
          : startCp.stepIndex
      const cp = { ...startCp, stepIndex: allowed }
      setCheckpoint(cp)
      setRuleShown(allowed > 1) // правило показываем на первом заходе шага 1
      setPhase(allowed === 7 ? { kind: 'deck' } : { kind: 'step' })
    }
    void load().catch(() => {
      if (alive) setPhase({ kind: 'notfound' })
    })
    return () => {
      alive = false
      stopAudio()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const step = view?.steps.find((s) => s.index === checkpoint.stepIndex)
  const stepExercises = step ? (view?.content[step.index] ?? []) : []

  const persist = useCallback(
    async (cp: LessonCheckpoint) => {
      if (!view || saveBusy.current) return
      saveBusy.current = true
      try {
        await repo.putLessonProgress({
          lesson_id: view.lesson.id,
          status: 'in_progress',
          score: null,
          checkpoint: cp,
          completed_at: null,
          updated_at: new Date().toISOString(),
        })
      } finally {
        saveBusy.current = false
      }
    },
    [repo, view],
  )

  /** Финальный исход задания (компонент вызывает ровно один раз) — specs/02 §5. */
  const handleAnswer = useCallback(
    (outcome: ExerciseOutcome, _attempts: number, exerciseId: string) => {
      if (!view) return
      setCheckpoint((cp) => {
        const next = recordAnswer(cp, view.steps, exerciseId, outcome, _attempts)
        void persist(next)
        return next
      })
    },
    [view, persist],
  )

  /** «Дальше»: следующее задание шага или переход шага (specs/02 §2). */
  const handleNext = useCallback(() => {
    if (!view || !step) return
    stopAudio()
    const more = exerciseIndex + 1 < stepExercises.length
    if (more) {
      setExerciseIndex(exerciseIndex + 1)
      return
    }
    setCheckpoint((cp) => {
      const next = advanceStep(cp, view.steps)
      if (next) {
        void persist(next)
        setExerciseIndex(0)
        setRuleShown(false)
        setPhase(next.stepIndex === 7 ? { kind: 'deck' } : { kind: 'step' })
        return next
      }
      return cp
    })
  }, [view, step, exerciseIndex, stepExercises.length, persist])

  /** Повтор шага (разогрев <70% с первой попытки — specs/02 §2: блок повторяется). */
  const repeatStep = () => {
    setCheckpoint((cp) => ({
      ...cp,
      scores: cp.scores.filter((score) => score.stepIndex !== checkpoint.stepIndex),
    }))
    setExerciseIndex(0)
  }

  const stepEvaluation = useMemo(
    () => (view ? currentStepEvaluation(checkpoint, view.steps) : null),
    [view, checkpoint],
  )

  // шаг отвечен полностью, но критерий не выполнен (разогрев <70%) — предложить повтор
  const stepNeedsRepeat =
    stepEvaluation !== null &&
    !stepEvaluation.passed &&
    step !== undefined &&
    stepExercises.length > 0 &&
    (checkpoint.scores.find((s) => s.stepIndex === checkpoint.stepIndex)?.answered ?? 0) >=
      stepExercises.length

  /** Шаг 7: фразы урока → SRS (rule-1: en-ru первой), завершение прохода. */
  const enrollDeck = useCallback(async () => {
    if (!view || deckEnrolled) return
    await repo.ensureCards(createFirstCards(phraseNotes(lessonPhrases(view)), new Date()))
    setDeckEnrolled(true)
  }, [view, repo, deckEnrolled])

  const finishLesson = useCallback(async () => {
    if (!view) return
    await enrollDeck()
    const accuracy = passAccuracy(checkpoint.scores)
    const cp = finishPass(checkpoint)
    setCheckpoint(cp)
    await repo.putLessonProgress({
      lesson_id: view.lesson.id,
      status: 'completed',
      score: accuracy,
      checkpoint: cp,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    setPhase({ kind: 'done' })
  }, [view, enrollDeck, checkpoint, repo])

  // Enter — «Дальше»/«Понятно», только когда фокус не на интерактивном элементе
  // (specs/07 §5.1); иначе кнопки обрабатывают Enter сами (без дубля)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return
      if (!(event.target instanceof HTMLBodyElement)) return
      if (phase.kind !== 'step') return
      if (isRuleStepFor(view, checkpoint.stepIndex) && !ruleShown) {
        setRuleShown(true)
        return
      }
      handleNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase.kind, ruleShown, view, checkpoint.stepIndex, handleNext])

  if (phase.kind === 'loading') {
    return (
      <section className="panel lesson-panel">
        <p className="dim">{t('common.loading')}</p>
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
        <p>{t('lesson.resumePrompt', { step: phase.stepIndex })}</p>
        <div className="lesson-actions">
          <button
            type="button"
            className="srs-btn srs-btn-good"
            onClick={() => {
              setExerciseIndex(0)
              setRuleShown(false)
              setPhase(checkpoint.stepIndex === 7 ? { kind: 'deck' } : { kind: 'step' })
            }}
          >
            {t('lesson.resume')}
          </button>
          <button
            type="button"
            className="srs-btn"
            onClick={() => {
              const fresh = createCheckpoint()
              setCheckpoint(fresh)
              setExerciseIndex(0)
              setRuleShown(false)
              setPhase({ kind: 'step' })
              void persist(fresh)
            }}
          >
            {t('lesson.startOver')}
          </button>
        </div>
      </section>
    )
  }
  if (phase.kind === 'done') {
    const xp = totalXp(checkpoint, xpMap(view))
    const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000))
    return (
      <section className="panel lesson-panel">
        <h2>{t('lesson.lessonDone')}</h2>
        <ul className="lesson-summary">
          <li>{t('lesson.summaryXp', { xp })}</li>
          <li>{t('lesson.summaryAccuracy', { accuracy: passAccuracy(checkpoint.scores) ?? 0 })}</li>
          <li>{t('lesson.summaryTime', { minutes })}</li>
          <li>{t('lesson.summaryDeck', { count: lessonPhrases(view).length })}</li>
        </ul>
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
  return (
    <section className="panel lesson-panel">
      <header className="lesson-head">
        <h2 lang="ru">{view.lesson.title}</h2>
        <p className="dim">
          {t(`lesson.steps.${step?.kind ?? 'rule'}`)} ·{' '}
          {t('lesson.stepProgress', { current: checkpoint.stepIndex, total: view.steps.length })}
        </p>
      </header>

      {isRuleStep && !ruleShown && <RuleCard view={view} onUnderstood={() => setRuleShown(true)} />}

      {(ruleShown || !isRuleStep) && current && (
        <ExerciseRouter
          key={current.exercise.id}
          current={current}
          stepKind={step?.kind ?? 'rule'}
          onAnswer={(outcome, attempts) => handleAnswer(outcome, attempts, current.exercise.id)}
          onNext={handleNext}
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
    </section>
  )
}

/** Роутер типов упражнений: маппинг type → компонент. */
function ExerciseRouter({
  current,
  stepKind,
  onAnswer,
  onNext,
}: {
  current: { exercise: import('../content/lessons').ExerciseItem; phrase: PhraseItem | null }
  stepKind: string
  onAnswer: (outcome: ExerciseOutcome, attempts: number) => void
  onNext: () => void
}) {
  const { exercise, phrase } = current
  switch (exercise.type) {
    case 'translate':
      return (
        <InputCheckExercise
          mode="translate"
          exercise={exercise}
          phrase={phrase}
          onAnswer={onAnswer}
          onNext={onNext}
        />
      )
    case 'dictation':
      return (
        <InputCheckExercise
          mode="dictation"
          exercise={exercise}
          phrase={phrase}
          onAnswer={onAnswer}
          onNext={onNext}
        />
      )
    case 'cloze':
      // cloze правила: ошибки не штрафуются XP (specs/02 §2 шаг 1)
      return (
        <InputCheckExercise
          mode="cloze"
          exercise={exercise}
          phrase={phrase}
          onAnswer={onAnswer}
          onNext={onNext}
          lenient={stepKind === 'rule'}
        />
      )
    case 'choose_translation':
      return (
        <ChooseTranslationExercise
          exercise={exercise}
          phrase={phrase}
          onAnswer={onAnswer}
          onNext={onNext}
        />
      )
    case 'match_pairs':
      return (
        <MatchPairsExercise
          exercise={exercise}
          phrase={phrase}
          onAnswer={onAnswer}
          onNext={onNext}
        />
      )
    case 'word_bank':
      return (
        <WordBankExercise exercise={exercise} phrase={phrase} onAnswer={onAnswer} onNext={onNext} />
      )
    case 'speak':
      return (
        <VoiceExercise
          mode="speak"
          exercise={exercise}
          phrase={phrase}
          onAnswer={onAnswer}
          onNext={onNext}
        />
      )
    case 'shadowing':
      return (
        <VoiceExercise
          mode="shadowing"
          exercise={exercise}
          phrase={phrase}
          onAnswer={onAnswer}
          onNext={onNext}
        />
      )
    case 'answer_question':
      return (
        <VoiceExercise
          mode="answer"
          exercise={exercise}
          phrase={phrase}
          onAnswer={onAnswer}
          onNext={onNext}
        />
      )
    default:
      return <p className="dim">exercise.type: {exercise.type}</p>
  }
}

/** Шаг 1 «Правило» у текущего урока (для обработки Enter). */
function isRuleStepFor(view: LessonView | null, stepIndex: number): boolean {
  return view?.steps.find((s) => s.index === stepIndex)?.kind === 'rule'
}

function xpMap(view: LessonView): Record<string, number> {
  const map: Record<string, number> = {}
  for (const items of Object.values(view.content)) {
    for (const { exercise } of items) map[exercise.id] = exercise.meta.xp
  }
  return map
}
