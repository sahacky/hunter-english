// Implements: plan://onboarding#O.4 — онбординг /#/welcome (specs/07 §2.2):
// интро → «Оценка Охотника» (адаптивный тест) → вердикт → применение ранга.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { judge } from '../domain/check/checker'
import type { CheckResult } from '../domain/check/types'
import { FeedbackPlate } from '../components/lesson/ExerciseView'
import {
  nextPlacementTask,
  placementVerdict,
  type PlacementAnswer,
  type PlacementRank,
  type PlacementTask,
  type PlacementVerdict,
} from '../domain/placement/placement'
import { applyPlacement } from '../domain/placement/apply'
import { RANK_CEFR } from '../domain/game/game'
import { buildPlacementTasks } from '../content/placement'
import { loadLessons, loadPhrases, type LessonItem } from '../content/lessons'
import { loadWordRanks } from '../content/words'
import { isOnboarded, markOnboarded } from '../data/onboarding'
import type { ProgressRepository } from '../domain/progress'
import { DexieProgressRepository } from '../data/progress-repository'

interface WelcomeProps {
  repo?: ProgressRepository
  /** Переопределения для тестов (по умолчанию — реальный контент). */
  tasks?: PlacementTask[]
  lessons?: readonly LessonItem[]
  wordRanks?: ReadonlyMap<string, number>
}

type Phase =
  | { kind: 'checking' }
  | { kind: 'intro' }
  | { kind: 'quiz'; answers: PlacementAnswer[]; value: string; result: CheckResult | null }
  | { kind: 'verdict'; verdict: PlacementVerdict }
  | { kind: 'applying'; rank: PlacementRank }
  | { kind: 'error' }

/** Экран вердикта: и завершение теста, и мгновенный выход при исчерпании задач. */
function VerdictPane({
  verdict,
  onStart,
}: {
  verdict: PlacementVerdict
  onStart: (rank: PlacementRank) => void
}) {
  const { t } = useTranslation()
  return (
    <section className="panel lesson-panel">
      <h2>{t('welcome.verdictTitle')}</h2>
      <p className="dim">
        <strong>
          {verdict.rank} ({RANK_CEFR[verdict.rank]})
        </strong>
      </p>
      <p className="dim">
        {verdict.confidence === 'low' ? t('welcome.verdictLow') : t('welcome.verdictHigh')}
      </p>
      <p className="dim">{t('welcome.verdictNote')}</p>
      <div className="lesson-actions">
        <button
          type="button"
          className="srs-btn srs-btn-good"
          onClick={() => onStart(verdict.rank)}
        >
          {t('welcome.startLearning')}
        </button>
      </div>
    </section>
  )
}

export default function WelcomeScreen({
  repo: repoProp,
  tasks: tasksProp,
  lessons: lessonsProp,
  wordRanks: wordRanksProp,
}: WelcomeProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const defaultRepo = useMemo(() => new DexieProgressRepository(), [])
  const repo = repoProp ?? defaultRepo
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' })
  const [tasks, setTasks] = useState<PlacementTask[] | null>(tasksProp ?? null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const done = await isOnboarded()
      if (!alive) return
      if (done) {
        navigate('/', { replace: true }) // повторное открытие — specs/07 §2.2
        return
      }
      setPhase({ kind: 'intro' })
      if (!tasksProp) {
        const [lessons, phrases] = await Promise.all([loadLessons(), loadPhrases()])
        if (alive) setTasks(buildPlacementTasks(lessons, phrases))
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finish = async (rank: PlacementRank) => {
    setPhase({ kind: 'applying', rank })
    try {
      const [lessons, wordRanks] = await Promise.all([
        lessonsProp ? Promise.resolve(lessonsProp) : loadLessons(),
        wordRanksProp ? Promise.resolve(wordRanksProp) : loadWordRanks(),
      ])
      await applyPlacement({ repo, rank, lessons, wordRanks, now: new Date() })
      await markOnboarded()
      navigate('/', { replace: true })
    } catch {
      setPhase({ kind: 'error' })
    }
  }

  if (phase.kind === 'checking') {
    return (
      <section className="panel">
        <p className="dim">{t('common.loading')}</p>
      </section>
    )
  }

  if (phase.kind === 'intro') {
    return (
      <section className="panel lesson-panel">
        <h2>{t('welcome.title')}</h2>
        <p className="dim">{t('welcome.intro')}</p>
        <div className="lesson-actions">
          <button
            type="button"
            className="srs-btn srs-btn-good"
            disabled={!tasks}
            onClick={() => setPhase({ kind: 'quiz', answers: [], value: '', result: null })}
          >
            {t('welcome.startAssessment')}
          </button>
          <button type="button" className="srs-btn" onClick={() => void finish('E')}>
            {t('welcome.startFromZero')}
          </button>
        </div>
        {!tasks && <p className="dim">{t('common.loading')}</p>}
      </section>
    )
  }

  if (phase.kind === 'quiz') {
    const task = tasks ? nextPlacementTask(tasks, phase.answers) : null
    if (!task) {
      return (
        <VerdictPane
          verdict={placementVerdict(tasks ?? [], phase.answers)}
          onStart={(rank) => void finish(rank)}
        />
      )
    }
    const submit = () => {
      const verdict = judge(phase.value, { accepted: task.accepted })
      setPhase({ ...phase, result: verdict })
    }
    const result = phase.result
    const next = (correct: boolean) => {
      const answers = [...phase.answers, { taskId: task.id, correct }]
      const upcoming = tasks ? nextPlacementTask(tasks, answers) : null
      if (!upcoming) {
        setPhase({ kind: 'verdict', verdict: placementVerdict(tasks ?? [], answers) })
        return
      }
      setPhase({ kind: 'quiz', answers, value: '', result: null })
    }
    return (
      <section className="panel lesson-panel">
        <header className="lesson-head">
          <h2>{t('welcome.assessmentTitle')}</h2>
          <p className="dim">
            {t('welcome.progress', { current: phase.answers.length + 1, rank: task.rank })}
          </p>
        </header>
        <div className="pb-line">
          <p className="pb-bubble pb-bubble-user" lang="ru">
            {task.promptRu}
          </p>
          {!phase.result && (
            <form
              className="lesson-input-row"
              onSubmit={(event) => {
                event.preventDefault()
                if (phase.value.trim()) submit()
              }}
            >
              <input
                className="lesson-input"
                lang="en"
                autoFocus
                value={phase.value}
                onChange={(event) => setPhase({ ...phase, value: event.target.value })}
              />
              <button type="submit" className="srs-btn srs-btn-good" disabled={!phase.value.trim()}>
                {t('lesson.check')} <kbd>⏎</kbd>
              </button>
            </form>
          )}
          {result && (
            <>
              <FeedbackPlate result={result} showReference phrase={null} />
              <div className="lesson-actions">
                <button
                  type="button"
                  className="srs-btn srs-btn-good"
                  onClick={() =>
                    next(result.verdict === 'correct' || result.verdict === 'correct_typo')
                  }
                >
                  {t('lesson.next')} <kbd>⏎</kbd>
                </button>
              </div>
            </>
          )}
        </div>
        <p className="dim">
          <button type="button" className="srs-btn" onClick={() => setPhase({ kind: 'intro' })}>
            ← {t('welcome.backToIntro')}
          </button>
        </p>
      </section>
    )
  }

  if (phase.kind === 'verdict') {
    return <VerdictPane verdict={phase.verdict} onStart={(rank) => void finish(rank)} />
  }

  if (phase.kind === 'applying') {
    return (
      <section className="panel">
        <p className="dim">{t('welcome.applying')}</p>
      </section>
    )
  }

  // phase.kind === 'error'
  return (
    <section className="panel lesson-panel">
      <h2>{t('welcome.errorTitle')}</h2>
      <div className="lesson-actions">
        <button
          type="button"
          className="srs-btn srs-btn-good"
          onClick={() => setPhase({ kind: 'intro' })}
        >
          {t('welcome.retry')}
        </button>
      </div>
    </section>
  )
}
