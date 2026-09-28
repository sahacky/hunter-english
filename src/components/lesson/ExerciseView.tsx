// Implements: plan://M5#5.5–5.6 — компоненты упражнений урока (specs/02 §3, specs/07 §3.3–3.4).
// Проверка — домен checker (specs/02 §4). Контракт: onAnswer вызывается РОВНО ОДИН раз
// на задание — финальным исходом (specs/02 §3: первая попытка / со второй / подсказка /
// пропуск / самопроверка); чекпоинт пишет экран сразу после него.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { judge, judgeDictation, judgeVoice } from '../../domain/check/checker'
import type { CheckResult, CheckTask } from '../../domain/check/types'
import { playAudio } from '../../lib/audio'
import { isSpeechSupported, listenOnce } from '../../lib/speech'
import type { ExerciseItem, PhraseItem } from '../../content/lessons'
import type { ExerciseOutcome } from '../../domain/lesson/types'

export interface ExerciseViewProps {
  exercise: ExerciseItem
  phrase: PhraseItem | null
  /** Финальный исход задания (ровно один раз). */
  onAnswer: (outcome: ExerciseOutcome, attempts: number) => void
  /** Переход к следующему заданию/шагу. */
  onNext: () => void
}

function payload<T extends Record<string, unknown>>(exercise: ExerciseItem): T {
  return exercise.payload as unknown as T
}

function taskFor(exercise: ExerciseItem, phrase: PhraseItem | null): CheckTask {
  const p = exercise.payload
  const accepted =
    exercise.answer.accepted ??
    (phrase ? [phrase.text_en, ...phrase.variants] : ((p.gap_answers as string[]) ?? []))
  return { accepted, trapLtId: null }
}

function outcomeText(result: CheckResult, attempts: number, hintUsed: boolean): ExerciseOutcome {
  if (hintUsed) return 'hint'
  if (result.verdict === 'correct' || result.verdict === 'correct_typo') {
    return attempts <= 1 ? 'correct' : 'correct_retry'
  }
  return 'skip'
}

/** Поле ввода с проверкой: перевод / cloze / диктант. */
export function InputCheckExercise({
  exercise,
  phrase,
  onAnswer,
  onNext,
  mode,
  lenient = false,
}: ExerciseViewProps & { mode: 'translate' | 'dictation' | 'cloze'; lenient?: boolean }) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [hintUsed, setHintUsed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const p = payload<{ prompt_ru?: string; text_with_gap?: string }>(exercise)
  const task = taskFor(exercise, phrase)
  const maxAttempts = lenient ? 3 : 2

  useEffect(() => {
    inputRef.current?.focus()
  }, [exercise.id])

  const check = () => {
    const nextAttempts = attempts + 1
    setAttempts(nextAttempts)
    const verdict = mode === 'dictation' ? judgeDictation(value, task) : judge(value, task)
    setResult(verdict)
    const ok = verdict.verdict === 'correct' || verdict.verdict === 'correct_typo'
    if (ok || nextAttempts >= maxAttempts) {
      // финальный исход: верно (с любой попытки) либо попытки исчерпаны → показ + 0 XP
      onAnswer(
        lenient && !ok ? 'correct' : outcomeText(verdict, nextAttempts, hintUsed),
        nextAttempts,
      )
    }
  }

  const retry = () => {
    setResult(null)
    setValue('')
    inputRef.current?.focus()
  }

  const title =
    mode === 'translate'
      ? (p.prompt_ru ?? phrase?.translation_ru ?? '')
      : mode === 'cloze'
        ? ((p.text_with_gap as string) ?? '')
        : ''

  const gapAnswers = exercise.payload.gap_answers as string[] | undefined

  return (
    <div className="lesson-exercise">
      {mode === 'cloze' && exercise.payload.quote ? (
        <p className="lesson-quote-src dim">
          {(exercise.payload.quote as { title: string; season_episode: string }).title} ·{' '}
          {(exercise.payload.quote as { title: string; season_episode: string }).season_episode}
        </p>
      ) : null}
      <p className="lesson-prompt" lang={mode === 'translate' ? 'ru' : 'en'}>
        {title}
      </p>
      {mode === 'dictation' && phrase?.audio?.en_gb && (
        <div className="lesson-audio">
          <button type="button" className="srs-btn" onClick={() => playAudio(phrase.audio!.en_gb!)}>
            🔊 <kbd>R</kbd>
          </button>
          <button
            type="button"
            className="srs-btn"
            onClick={() => playAudio(phrase.audio!.en_gb!, 0.75)}
          >
            🐢 <kbd>S</kbd>
          </button>
        </div>
      )}
      <form
        className="lesson-input-row"
        onSubmit={(event) => {
          event.preventDefault()
          if (result && (result.verdict !== 'wrong' || attempts >= maxAttempts)) {
            onNext()
          } else if (!result && value.trim()) {
            check()
          }
        }}
      >
        <input
          ref={inputRef}
          className="lesson-input"
          lang="en"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={result !== null && attempts >= maxAttempts}
        />
        {!result && (
          <button type="submit" className="srs-btn srs-btn-good" disabled={!value.trim()}>
            {t('lesson.check')} <kbd>⏎</kbd>
          </button>
        )}
      </form>
      {!result && mode === 'translate' && phrase && (
        <div className="lesson-hint-row">
          {!hintUsed ? (
            <button
              type="button"
              className="srs-btn"
              onClick={() => {
                setHintUsed(true)
                setValue(`${phrase.text_en.split(' ')[0]} `)
                inputRef.current?.focus()
              }}
            >
              {t('lesson.hint')}
            </button>
          ) : (
            <p className="dim">{t('lesson.hintUsed')}</p>
          )}
        </div>
      )}
      {result && (
        <FeedbackPlate result={result} showReference={attempts >= maxAttempts} phrase={phrase} />
      )}
      {result && (
        <div className="lesson-actions">
          {result.verdict === 'wrong' && attempts < maxAttempts && (
            <button type="button" className="srs-btn" onClick={retry}>
              {t('lesson.tryAgain')}
            </button>
          )}
          {(result.verdict !== 'wrong' || attempts >= maxAttempts) && (
            <button type="button" className="srs-btn srs-btn-good" onClick={onNext}>
              {t('lesson.next')} <kbd>⏎</kbd>
            </button>
          )}
        </div>
      )}
      {attempts >= maxAttempts && result?.verdict === 'wrong' && gapAnswers && (
        <p className="lesson-ref" lang="en">
          {gapAnswers.join(' / ')}
        </p>
      )}
    </div>
  )
}

/** Выбор перевода из 3–4 вариантов (specs/02 §3 №8): одна попытка. */
export function ChooseTranslationExercise({ exercise, onAnswer, onNext }: ExerciseViewProps) {
  const { t } = useTranslation()
  const p = payload<{ prompt: string; options: string[]; correct: number }>(exercise)
  const [picked, setPicked] = useState<number | null>(null)
  return (
    <div className="lesson-exercise">
      <p className="lesson-prompt" lang="ru">
        {p.prompt}
      </p>
      <ul className="lesson-options">
        {p.options.map((option, index) => {
          const state =
            picked === null
              ? 'idle'
              : index === p.correct
                ? 'correct'
                : index === picked
                  ? 'wrong'
                  : 'idle'
          return (
            <li key={option}>
              <button
                type="button"
                className={`lesson-option lesson-option-${state}`}
                lang="en"
                disabled={picked !== null}
                onClick={() => {
                  setPicked(index)
                  onAnswer(index === p.correct ? 'correct' : 'skip', 1)
                }}
              >
                {option}
              </button>
            </li>
          )
        })}
      </ul>
      {picked !== null && (
        <div className="lesson-actions">
          <p className={picked === p.correct ? 'lesson-verdict-ok' : 'lesson-verdict-bad'}>
            {picked === p.correct ? t('lesson.correct') : t('lesson.wrongAnswer')}
          </p>
          <button type="button" className="srs-btn srs-btn-good" onClick={onNext}>
            {t('lesson.next')} <kbd>⏎</kbd>
          </button>
        </div>
      )}
    </div>
  )
}

/** Найди пары EN↔RU (specs/02 §3 №9): XP за пару только с первой попытки. */
export function MatchPairsExercise({ exercise, onAnswer, onNext }: ExerciseViewProps) {
  const { t } = useTranslation()
  const p = payload<{ pairs: { en: string; ru: string }[] }>(exercise)
  const [matchedEn, setMatchedEn] = useState<string[]>([])
  const [selectedRu, setSelectedRu] = useState<string | null>(null)
  const [mistakes, setMistakes] = useState(0)
  return (
    <div className="lesson-exercise">
      <p className="lesson-prompt">{t('lesson.matchPrompt')}</p>
      <div className="lesson-match">
        <ul className="lesson-match-column">
          {p.pairs.map(({ en }) => (
            <li key={en}>
              <button
                type="button"
                className="lesson-option"
                lang="en"
                disabled={matchedEn.includes(en)}
                onClick={() => {
                  if (selectedRu === null) return
                  const pair = p.pairs.find((item) => item.en === en)
                  if (pair && pair.ru === selectedRu) {
                    setMatchedEn((prev) => [...prev, en])
                  } else {
                    setMistakes((n) => n + 1)
                  }
                  setSelectedRu(null)
                }}
              >
                {en}
              </button>
            </li>
          ))}
        </ul>
        <ul className="lesson-match-column">
          {p.pairs.map(({ ru }) => {
            const isMatched = p.pairs.some(({ en, ru: r }) => r === ru && matchedEn.includes(en))
            return (
              <li key={ru}>
                <button
                  type="button"
                  className={`lesson-option ${selectedRu === ru ? 'lesson-option-selected' : ''}`}
                  lang="ru"
                  disabled={isMatched}
                  onClick={() => setSelectedRu(selectedRu === ru ? null : ru)}
                >
                  {ru}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      {matchedEn.length === p.pairs.length && (
        <div className="lesson-actions">
          <p className="lesson-verdict-ok">
            {mistakes === 0
              ? t('lesson.correct')
              : t('lesson.matchDoneWithMistakes', { count: mistakes })}
          </p>
          <button
            type="button"
            className="srs-btn srs-btn-good"
            onClick={() => {
              onAnswer(mistakes === 0 ? 'correct' : 'correct_retry', 1)
              onNext()
            }}
          >
            {t('lesson.next')} <kbd>⏎</kbd>
          </button>
        </div>
      )}
    </div>
  )
}

/** Собери фразу из плиток (specs/02 §3 №4; Backspace — specs/07 §5.2). */
export function WordBankExercise({ exercise, phrase, onAnswer, onNext }: ExerciseViewProps) {
  const { t } = useTranslation()
  const p = payload<{ prompt_ru: string; tokens: string[] }>(exercise)
  const [bank, setBank] = useState(() => p.tokens.map((token) => ({ token, used: false })))
  const [slots, setSlots] = useState<string[]>([])
  const [attempts, setAttempts] = useState(0)
  const [revealed, setRevealed] = useState(false)

  const put = (token: string) => {
    if (revealed) return
    setBank((prev) => {
      const index = prev.findIndex((item) => item.token === token && !item.used)
      if (index === -1) return prev
      return prev.map((item, i) => (i === index ? { ...item, used: true } : item))
    })
    setSlots((prev) => [...prev, token])
  }

  const removeSlot = (slotIndex: number) => {
    if (revealed) return
    const token = slots[slotIndex]
    if (token === undefined) return
    setBank((prev) => {
      const next = [...prev]
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i].token === token && next[i].used) {
          next[i] = { ...next[i], used: false }
          break
        }
      }
      return next
    })
    setSlots((prev) => prev.filter((_, i) => i !== slotIndex))
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Backspace' && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault()
        removeSlot(slots.length - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, revealed])

  const check = () => {
    const nextAttempts = attempts + 1
    setAttempts(nextAttempts)
    const result = judge(slots.join(' '), taskFor(exercise, phrase))
    const ok = result.verdict === 'correct' || result.verdict === 'correct_typo'
    if (ok) {
      onAnswer(nextAttempts <= 1 ? 'correct' : 'correct_retry', nextAttempts)
      return
    }
    if (nextAttempts >= 2) {
      setRevealed(true)
      onAnswer('skip', nextAttempts)
    }
  }

  return (
    <div className="lesson-exercise">
      <p className="lesson-prompt" lang="ru">
        {p.prompt_ru}
      </p>
      <div className="lesson-slots" lang="en">
        {slots.length === 0 && <span className="dim">{t('lesson.wordBankHint')}</span>}
        {slots.map((token, index) => (
          <button
            key={`${token}-${index}`}
            type="button"
            className="lesson-tile lesson-tile-slot"
            onClick={() => removeSlot(index)}
            disabled={revealed}
          >
            {token}
          </button>
        ))}
      </div>
      <div className="lesson-bank" lang="en">
        {bank.map(({ token, used }, index) => (
          <button
            key={`${token}-${index}`}
            type="button"
            className="lesson-tile"
            disabled={used || revealed}
            onClick={() => put(token)}
          >
            {token}
          </button>
        ))}
      </div>
      {revealed && phrase && (
        <p className="lesson-ref" lang="en">
          {phrase.text_en}
        </p>
      )}
      <div className="lesson-actions">
        {!revealed && attempts < 2 && (
          <button
            type="button"
            className="srs-btn srs-btn-good"
            disabled={slots.length === 0}
            onClick={check}
          >
            {t('lesson.check')}
          </button>
        )}
        {(revealed || attempts > 0) && (
          <button type="button" className="srs-btn srs-btn-good" onClick={onNext}>
            {t('lesson.next')} <kbd>⏎</kbd>
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Голосовые упражнения (specs/02 §3 №3/№6/№11, §4.8): микрофон — best effort
 * Web Speech; RETRY — не ошибка, попытки не ограничены; фолбэк — текст или
 * самопроверка «Сказал(-а)» (self_reported, полный XP — specs/02 §3).
 */
export function VoiceExercise({
  exercise,
  phrase,
  onAnswer,
  onNext,
  mode,
}: ExerciseViewProps & { mode: 'speak' | 'shadowing' | 'answer' }) {
  const { t } = useTranslation()
  const p = payload<{ prompt_ru?: string; question_en?: string }>(exercise)
  const supported = isSpeechSupported()
  const [listening, setListening] = useState(false)
  const [feedback, setFeedback] = useState<CheckResult | null>(null)
  const [attempts, setAttempts] = useState(0)

  const task = taskFor(exercise, phrase)

  const listen = async () => {
    if (listening) return
    setListening(true)
    setFeedback(null)
    try {
      const recognized = await listenOnce({})
      const nextAttempts = attempts + 1
      setAttempts(nextAttempts)
      const result = judgeVoice(recognized, task)
      setFeedback(result)
      if (result.verdict === 'correct') {
        onAnswer(nextAttempts <= 1 ? 'correct' : 'correct_retry', nextAttempts)
      }
    } catch {
      setFeedback(null)
    } finally {
      setListening(false)
    }
  }

  const fallbackText = () => {
    const value = window.prompt(t('lesson.voiceFallbackPrompt')) ?? ''
    if (!value.trim()) return
    const nextAttempts = attempts + 1
    setAttempts(nextAttempts)
    const result = judge(value, task)
    setFeedback(result)
    if (result.verdict === 'correct' || result.verdict === 'correct_typo') {
      onAnswer(nextAttempts <= 1 ? 'correct' : 'correct_retry', nextAttempts)
    }
  }

  const selfReport = () => {
    onAnswer('self_reported', attempts + 1)
    onNext()
  }

  const prompt =
    mode === 'speak'
      ? (p.prompt_ru ?? phrase?.translation_ru ?? '')
      : mode === 'answer'
        ? ((p.question_en as string) ?? '')
        : (phrase?.text_en ?? '')

  return (
    <div className="lesson-exercise">
      <p className="lesson-prompt" lang={mode === 'speak' ? 'ru' : 'en'}>
        {prompt}
      </p>
      {mode === 'shadowing' && phrase?.audio?.en_gb && (
        <div className="lesson-audio">
          <button type="button" className="srs-btn" onClick={() => playAudio(phrase.audio!.en_gb!)}>
            🔊 <kbd>R</kbd>
          </button>
          <button
            type="button"
            className="srs-btn"
            onClick={() => playAudio(phrase.audio!.en_gb!, 0.75)}
          >
            🐢 <kbd>S</kbd>
          </button>
        </div>
      )}
      <div className="lesson-actions">
        {supported && (
          <button
            type="button"
            className={`srs-btn ${listening ? 'srs-btn-again' : 'srs-btn-good'}`}
            onClick={() => void listen()}
          >
            {listening ? t('lesson.listening') : t('lesson.sayIt')} 🎙
          </button>
        )}
        {!supported && <p className="dim">{t('lesson.speechUnavailable')}</p>}
        <button type="button" className="srs-btn" onClick={fallbackText}>
          {t('lesson.typeInstead')}
        </button>
        <button type="button" className="srs-btn" onClick={selfReport}>
          {t('lesson.saidIt')}
        </button>
      </div>
      {feedback && <FeedbackPlate result={feedback} showReference phrase={phrase} />}
      {feedback && (
        <div className="lesson-actions">
          {feedback.verdict === 'retry' && <p className="dim">{t('lesson.voiceRetryHint')}</p>}
          {(feedback.verdict === 'correct' || feedback.verdict === 'correct_typo') && (
            <button type="button" className="srs-btn srs-btn-good" onClick={onNext}>
              {t('lesson.next')} <kbd>⏎</kbd>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Плашка вердикта с diff-подсветкой (specs/02 §4.5) и «Я был прав» (§4.6).
 * onDispute вызывается экраном: спор засчитывается с полным XP (outcome disputed).
 */
export function FeedbackPlate({
  result,
  showReference = true,
  phrase,
  onDispute,
}: {
  result: CheckResult
  showReference?: boolean
  phrase?: PhraseItem | null
  onDispute?: () => void
}) {
  const { t } = useTranslation()
  const [disputed, setDisputed] = useState(false)
  const ok = result.verdict === 'correct' || result.verdict === 'correct_typo'
  const reference = phrase?.text_en ?? (result.ref.length > 0 ? result.ref : '')
  return (
    <div
      className={`lesson-feedback ${ok ? 'lesson-feedback-ok' : 'lesson-feedback-bad'}`}
      role="status"
    >
      <p className="lesson-verdict">
        {result.verdict === 'correct' && t('lesson.correct')}
        {result.verdict === 'correct_typo' && t('lesson.correctWithTypo')}
        {result.verdict === 'wrong' && t('lesson.wrongAnswer')}
        {result.verdict === 'retry' && t('lesson.voiceRetry')}
        {disputed && ` · ${t('lesson.disputed')}`}
      </p>
      {result.diff.length > 0 && (
        <p className="lesson-diff" lang="en">
          {result.diff.map((token, index) => (
            <span key={index} className={`lesson-diff-${token.status}`}>
              {token.status === 'missing' ? `+${token.ref ?? ''}` : (token.word ?? '')}
              {token.status === 'typo' && token.ref ? ` → ${token.ref}` : ''}
            </span>
          ))}
        </p>
      )}
      {!ok && showReference && reference && (
        <p className="lesson-ref" lang="en">
          {reference}
        </p>
      )}
      {result.trapTriggered && <p className="lesson-trap">⚠️ {t('lesson.trapHint')}</p>}
      {result.verdict === 'wrong' && onDispute && !disputed && (
        <button
          type="button"
          className="srs-btn"
          onClick={() => {
            setDisputed(true)
            onDispute()
          }}
        >
          {t('lesson.iWasRight')}
        </button>
      )}
    </div>
  )
}
