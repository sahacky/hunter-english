// Implements: plan://teaching-quality#Q1.5 — free-output промпт «60 сек без сверки»
// (research/10-teaching-quality/02 §3 №7): монолог без expected[], чек-лист
// самооценки после таймера, исход self_reported (XP — по правилу самопроверки B-27).

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ExerciseOutcome } from '../../domain/lesson/types'

export interface FreeOutputTaskProps {
  /** Длительность монолога, сек (payload.free_output.seconds). */
  seconds: number
  /** Пункты чек-листа самооценки (payload.free_output.checklist_ru). */
  checklistRu: string[]
  /** Тема монолога (payload.question_en). */
  promptEn: string
  /** Ситуация → задача → исход (payload.situation_ru). */
  situationRu?: string
  /** Подсказка-паттерн (answer.hint_ru). */
  hintRu?: string
  onAnswer: (outcome: ExerciseOutcome, attempts: number) => void
  onNext: () => void
}

type FreeStage = 'idle' | 'speaking' | 'checklist'

/**
 * Свободная речь без сверки (Q1.5): idle (тема + подсказка) → speaking
 * (таймер, досрочно «Я закончил») → checklist (самооценка) → self_reported.
 * Используется и в уроке (интенсивы), и в финале S-экзамена (GatesScreen).
 */
export function FreeOutputTask({
  seconds,
  checklistRu,
  promptEn,
  situationRu,
  hintRu,
  onAnswer,
  onNext,
}: FreeOutputTaskProps) {
  const { t } = useTranslation()
  const [started, setStarted] = useState(false)
  const [finishedSpeaking, setFinishedSpeaking] = useState(false)
  const [left, setLeft] = useState(seconds)
  const [checked, setChecked] = useState<boolean[]>(() => checklistRu.map(() => false))

  useEffect(() => {
    if (!started || finishedSpeaking) return
    const id = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000)
    return () => clearInterval(id)
  }, [started, finishedSpeaking])

  // стадия производна: без setState-переходов в эффектах (react-hooks compiler)
  const stage: FreeStage = !started
    ? 'idle'
    : finishedSpeaking || left === 0
      ? 'checklist'
      : 'speaking'

  const finish = () => {
    onAnswer('self_reported', 1)
    onNext()
  }

  if (stage === 'idle') {
    return (
      <div className="lesson-exercise lesson-free-output">
        {situationRu && <p className="lesson-quote-src dim">{situationRu}</p>}
        <p className="lesson-prompt" lang="en">
          {promptEn}
        </p>
        <p className="dim">{t('lesson.freeHint', { seconds })}</p>
        {hintRu && <p className="dim">{hintRu}</p>}
        <div className="lesson-actions">
          <button type="button" className="srs-btn srs-btn-good" onClick={() => setStarted(true)}>
            {t('lesson.freeStart')} ({seconds}s)
          </button>
        </div>
      </div>
    )
  }
  if (stage === 'speaking') {
    return (
      <div className="lesson-exercise lesson-free-output">
        <p className="lesson-prompt" lang="en">
          {promptEn}
        </p>
        <p className="lesson-free-timer" role="timer" aria-live="polite">
          {t('lesson.freeLeft', { seconds: left })}
        </p>
        <div className="lesson-wave" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className="lesson-wave-bar" />
          ))}
        </div>
        <div className="lesson-actions">
          <button
            type="button"
            className="srs-btn srs-btn-good"
            onClick={() => setFinishedSpeaking(true)}
          >
            {t('lesson.freeDoneSpeaking')}
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="lesson-exercise lesson-free-output">
      <p className="lesson-prompt">
        <strong>{t('lesson.freeChecklist')}</strong>
      </p>
      <ul className="lesson-free-checklist">
        {checklistRu.map((item, i) => (
          <li key={item}>
            <label>
              <input
                type="checkbox"
                checked={checked[i] ?? false}
                onChange={() => setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)))}
              />{' '}
              {item}
            </label>
          </li>
        ))}
      </ul>
      <p className="dim">{t('lesson.freeChecklistHint')}</p>
      <div className="lesson-actions">
        <button type="button" className="srs-btn srs-btn-good" onClick={finish}>
          {t('lesson.freeFinish')}
        </button>
      </div>
    </div>
  )
}
