// Implements: plan://onboarding#O.4, plan://curriculum-review#P.1–P.2 — онбординг /#/welcome
// (specs/07 §2.2): интро → «Оценка Охотника» (адаптивный тест, «не знаю» —
// честный промах) → вердикт (low confidence → предложить ранг ниже) → явный
// выбор применения (зачесть нижние vs начать с первого урока ранга).
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { judge } from '../domain/check/checker'
import type { CheckResult } from '../domain/check/types'
import { FeedbackPlate } from '../components/lesson/ExerciseView'
import {
  nextPlacementTask,
  placementVerdict,
  suggestLowerRank,
  type PlacementAnswer,
  type PlacementRank,
  type PlacementTask,
  type PlacementVerdict,
} from '../domain/placement/placement'
import { applyPlacement, type ApplyPlacementMode } from '../domain/placement/apply'
import { RANK_CEFR } from '../domain/game/game'
import { buildPlacementTasks } from '../content/placement'
import { loadLessons, loadPhrases, type LessonItem } from '../content/lessons'
import { loadWordRanks } from '../content/words'
import { isOnboarded, markOnboarded, savePlacementInfo } from '../data/onboarding'
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
  | { kind: 'applyChoice'; rank: PlacementRank }
  | { kind: 'applying'; rank: PlacementRank }
  | { kind: 'error' }

/** Экран вердикта: и завершение теста, и мгновенный выход при исчерпании задач. */
function VerdictPane({
  verdict,
  onChoose,
}: {
  verdict: PlacementVerdict
  onChoose: (rank: PlacementRank) => void
}) {
  const { t } = useTranslation()
  const lower = verdict.confidence === 'low' ? suggestLowerRank(verdict.rank) : null
  return (
    <section className="panel lesson-panel landing-panel">
      <h2>{t('welcome.verdictTitle')}</h2>
      <p className="dim">
        <strong>
          {verdict.rank} ({RANK_CEFR[verdict.rank]})
        </strong>
      </p>
      <p className="dim">
        {verdict.confidence === 'low' ? t('welcome.verdictLow') : t('welcome.verdictHigh')}
      </p>
      {lower && (
        <p className="dim">
          {t('welcome.verdictOfferLower', { rank: lower, cefr: RANK_CEFR[lower] })}
        </p>
      )}
      <p className="dim">{t('welcome.verdictNote')}</p>
      <div className="lesson-actions">
        <button
          type="button"
          className="srs-btn srs-btn-good"
          onClick={() => onChoose(verdict.rank)}
        >
          {t('welcome.startAtRank', { rank: verdict.rank, cefr: RANK_CEFR[verdict.rank] })}
        </button>
        {lower && (
          <button type="button" className="srs-btn" onClick={() => onChoose(lower)}>
            {t('welcome.startAtRankLower', { rank: lower, cefr: RANK_CEFR[lower] })}
          </button>
        )}
      </div>
    </section>
  )
}

/** Экран применения вердикта (P.2): явный выбор режима старта. */
function ApplyChoicePane({
  rank,
  onApply,
}: {
  rank: PlacementRank
  onApply: (mode: ApplyPlacementMode) => void
}) {
  const { t } = useTranslation()
  return (
    <section className="panel lesson-panel landing-panel">
      <h2>{t('welcome.applyTitle')}</h2>
      <p className="dim">{t('welcome.applyQuestion', { rank, cefr: RANK_CEFR[rank] })}</p>
      <div className="lesson-actions">
        <div>
          <button
            type="button"
            className="srs-btn srs-btn-good"
            onClick={() => onApply('start_at_rank')}
          >
            {t('welcome.applyStart')}
          </button>
          <p className="dim">{t('welcome.applyStartDesc', { rank })}</p>
        </div>
        <div>
          <button type="button" className="srs-btn" onClick={() => onApply('waive')}>
            {t('welcome.applyWaive')}
          </button>
          <p className="dim">{t('welcome.applyWaiveDesc', { rank })}</p>
        </div>
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

  const finish = async (rank: PlacementRank, mode: ApplyPlacementMode) => {
    setPhase({ kind: 'applying', rank })
    try {
      const [lessons, wordRanks] = await Promise.all([
        lessonsProp ? Promise.resolve(lessonsProp) : loadLessons(),
        wordRanksProp ? Promise.resolve(wordRanksProp) : loadWordRanks(),
      ])
      await applyPlacement({ repo, rank, mode, lessons, wordRanks, now: new Date() })
      await savePlacementInfo(rank, mode)
      await markOnboarded()
      navigate('/', { replace: true })
    } catch {
      setPhase({ kind: 'error' })
    }
  }

  if (phase.kind === 'checking') {
    return (
      <section className="panel landing-panel">
        <p className="dim">{t('common.loading')}</p>
      </section>
    )
  }

  if (phase.kind === 'intro') {
    return (
      <section className="panel lesson-panel landing-panel">
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
          <button type="button" className="srs-btn" onClick={() => void finish('E', 'waive')}>
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
          onChoose={(rank) =>
            rank === 'E'
              ? void finish('E', 'waive') // ниже E нет уроков — выбор применения не нужен
              : setPhase({ kind: 'applyChoice', rank })
          }
        />
      )
    }
    const submit = () => {
      const verdict = judge(phase.value, { accepted: task.accepted })
      setPhase({ ...phase, result: verdict })
    }
    const dontKnow = () => {
      // честный промах: сразу показываем эталон (P.1 — защита от угадывания)
      const verdict = judge('', { accepted: task.accepted })
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
      <section className="panel lesson-panel landing-panel">
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
              <button type="button" className="srs-btn" onClick={dontKnow}>
                {t('welcome.dontKnow')}
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
    return (
      <VerdictPane
        verdict={phase.verdict}
        onChoose={(rank) =>
          rank === 'E'
            ? void finish('E', 'waive') // ниже E нет уроков — выбор применения не нужен
            : setPhase({ kind: 'applyChoice', rank })
        }
      />
    )
  }

  if (phase.kind === 'applyChoice') {
    return <ApplyChoicePane rank={phase.rank} onApply={(mode) => void finish(phase.rank, mode)} />
  }

  if (phase.kind === 'applying') {
    return (
      <section className="panel landing-panel">
        <p className="dim">{t('welcome.applying')}</p>
      </section>
    )
  }

  // phase.kind === 'error'
  return (
    <section className="panel lesson-panel landing-panel">
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
