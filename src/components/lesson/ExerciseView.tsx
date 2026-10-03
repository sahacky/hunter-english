// Implements: plan://M5#5.5–5.6 — компоненты упражнений урока (specs/02 §3, §4; specs/07 §3.3–3.4).
// Проверка — домен checker. Контракт: onAnswer вызывается РОВНО ОДИН раз на задание
// финальным исходом (specs/02 §3); повторный вызов возможен только спором «Я был прав»
// (§4.6, исход disputed) — чекпоинт идемпотентен по exerciseId.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { judge, judgeDictation, judgeVoice } from '../../domain/check/checker'
import type { CheckResult, CheckTask } from '../../domain/check/types'
import type { ExerciseOutcome } from '../../domain/lesson/types'
import { speak } from '../../lib/tts'
import { cancelListening, isSpeechSupported, listenOnce } from '../../lib/speech'
import type { ExerciseItem, PhraseItem, TrapItem } from '../../content/lessons'

export interface ExerciseViewProps {
  exercise: ExerciseItem
  phrase: PhraseItem | null
  /** Ловушка урока (specs/02 §4.3/§4.7: запрет паттерна + строгие опечатки). */
  trap: TrapItem | null
  /** Финальный исход задания (ровно один раз; повтор — только спором). */
  onAnswer: (outcome: ExerciseOutcome, attempts: number) => void
  /** Спор «Я был прав»: перезапись исхода на disputed (полный XP, §4.6). */
  onDispute: () => void
  /** Переход к следующему заданию/шагу. */
  onNext: () => void
}

function payload<T extends Record<string, unknown>>(exercise: ExerciseItem): T {
  return exercise.payload as unknown as T
}

function taskFor(
  exercise: ExerciseItem,
  phrase: PhraseItem | null,
  trap: TrapItem | null,
): CheckTask {
  const p = exercise.payload
  const accepted =
    exercise.answer.accepted ??
    (phrase ? [phrase.text_en, ...phrase.variants] : ((p.gap_answers as string[]) ?? []))
  return {
    accepted,
    trapLtId: trap?.lt_id ?? null,
    trapWrong: trap?.wrong_en ?? null,
    exactTypos: exercise.answer.typo === 'exact',
    speechThreshold: exercise.answer.speech_threshold,
  }
}

/** Аудио-кнопки 🔊/🐢 с клавишами R/S (specs/07 §5.1) и лимитом прослушиваний ≤3 (specs/02 §3 №5). */
function AudioButtons({
  text,
  src,
  limitPlays = 0,
}: {
  text: string
  /** Предзаписанный файл; нет файла — TTS-фолбэк (M6#6.1). */
  src?: string
  limitPlays?: number
}) {
  const [plays, setPlays] = useState(0)
  const exhausted = limitPlays > 0 && plays >= limitPlays
  const play = (rate: number) => {
    if (exhausted) return
    setPlays((n) => n + 1)
    speak(text, { src, rate })
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.target instanceof HTMLInputElement) return
      const key = event.key.toLowerCase()
      if (key === 'r') play(1)
      else if (key === 's') play(0.75)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plays, exhausted])
  return (
    <div className="lesson-audio">
      <button type="button" className="srs-btn" disabled={exhausted} onClick={() => play(1)}>
        🔊 <kbd>R</kbd>
      </button>
      <button type="button" className="srs-btn" disabled={exhausted} onClick={() => play(0.75)}>
        🐢 <kbd>S</kbd>
      </button>
      {limitPlays > 0 && (
        <span className="dim">
          {limitPlays - plays}/{limitPlays}
        </span>
      )}
    </div>
  )
}

/** Поле ввода с проверкой: перевод / cloze / диктант. */
export function InputCheckExercise({
  exercise,
  phrase,
  trap,
  onAnswer,
  onDispute,
  onNext,
  mode,
  lenient = false,
}: ExerciseViewProps & {
  mode: 'translate' | 'dictation' | 'cloze' | 'find_error' | 'verb_tense'
  lenient?: boolean
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [hintUsed, setHintUsed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const p = payload<{
    prompt_ru?: string
    text_with_gap?: string
    wrong_en?: string
    hint_ru?: string
    sentence_with_gap?: string
    marker?: string
  }>(exercise)
  const task = taskFor(exercise, phrase, trap)
  const maxAttempts = lenient ? 3 : 2
  const finished = result !== null && (result.verdict !== 'wrong' || attempts >= maxAttempts)

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
      if (hintUsed) onAnswer('hint', nextAttempts)
      else if (lenient && !ok)
        onAnswer('correct', nextAttempts) // cloze правила: ошибки не штрафуются XP (specs/02 §2)
      else if (ok) onAnswer(nextAttempts <= 1 ? 'correct' : 'correct_retry', nextAttempts)
      else onAnswer('skip', nextAttempts)
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
        : mode === 'find_error'
          ? ((p.wrong_en as string) ?? '')
          : ((p.sentence_with_gap as string) ?? '')

  const gapAnswers = exercise.payload.gap_answers as string[] | undefined

  return (
    <div className="lesson-exercise">
      {mode === 'cloze' && exercise.payload.quote ? (
        <p className="lesson-quote-src dim">
          {(exercise.payload.quote as { title: string; season_episode: string }).title} ·{' '}
          {(exercise.payload.quote as { title: string; season_episode: string }).season_episode}
        </p>
      ) : null}
      {mode === 'find_error' && <p className="dim">{t('lesson.findErrorHint')}</p>}
      {mode === 'verb_tense' && p.marker && (
        <p className="dim">
          {t('lesson.markerHint')}: {p.marker}
        </p>
      )}
      <p className="lesson-prompt" lang={mode === 'translate' ? 'ru' : 'en'}>
        {title}
      </p>
      {mode === 'dictation' && phrase?.audio?.en_gb && (
        <AudioButtons text={phrase.text_en} src={phrase.audio.en_gb} limitPlays={3} />
      )}
      {mode === 'cloze' && Boolean(exercise.payload.quote) && (
        <AudioButtons text={String(p.text_with_gap ?? '').replace(/_+/, '…')} />
      )}
      <form
        className="lesson-input-row"
        onSubmit={(event) => {
          event.preventDefault()
          if (finished) onNext()
          else if (!result && value.trim()) check()
        }}
      >
        <input
          ref={inputRef}
          className="lesson-input"
          lang="en"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={finished}
        />
        {!result && (
          <button type="submit" className="srs-btn srs-btn-good" disabled={!value.trim()}>
            {t('lesson.check')} <kbd>⏎</kbd>
          </button>
        )}
      </form>
      {!result && mode === 'translate' && phrase && !hintUsed && (
        <div className="lesson-hint-row">
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
        </div>
      )}
      {hintUsed && !finished && <p className="dim">{t('lesson.hintUsed')}</p>}
      {result && (
        <FeedbackPlate
          result={result}
          showReference={
            finished && result.verdict !== 'correct' && result.verdict !== 'correct_typo'
          }
          phrase={phrase}
          onDispute={finished && result.verdict === 'wrong' ? onDispute : undefined}
        />
      )}
      {result && (
        <div className="lesson-actions">
          {result.verdict === 'wrong' && attempts < maxAttempts && (
            <button type="button" className="srs-btn" onClick={retry}>
              {t('lesson.tryAgain')}
            </button>
          )}
          {finished && (
            <button type="button" className="srs-btn srs-btn-good" onClick={onNext}>
              {t('lesson.next')} <kbd>⏎</kbd>
            </button>
          )}
        </div>
      )}
      {finished && result?.verdict === 'wrong' && gapAnswers && gapAnswers.length > 0 && (
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
            <li key={`${option}-${index}`}>
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
        <div className="lesson-actions" role="status">
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
  const [selectedRu, setSelectedRu] = useState<number | null>(null)
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
                  if (p.pairs[selectedRu].en === en) {
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
          {p.pairs.map(({ ru }, index) => {
            const isMatched = matchedEn.includes(p.pairs[index].en)
            return (
              <li key={`${ru}-${index}`}>
                <button
                  type="button"
                  className={`lesson-option ${selectedRu === index ? 'lesson-option-selected' : ''}`}
                  lang="ru"
                  aria-pressed={selectedRu === index}
                  disabled={isMatched}
                  onClick={() => setSelectedRu(selectedRu === index ? null : index)}
                >
                  {ru}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      {matchedEn.length === p.pairs.length && (
        <div className="lesson-actions" role="status">
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
export function WordBankExercise({
  exercise,
  phrase,
  trap,
  onAnswer,
  onDispute,
  onNext,
}: ExerciseViewProps) {
  const { t } = useTranslation()
  const p = payload<{ prompt_ru: string; tokens: string[] }>(exercise)
  const [bank, setBank] = useState(() => p.tokens.map((token) => ({ token, used: false })))
  const [slots, setSlots] = useState<string[]>([])
  const [attempts, setAttempts] = useState(0)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [revealed, setRevealed] = useState(false)
  const solved =
    result !== null && (result.verdict === 'correct' || result.verdict === 'correct_typo')
  const finished = solved || revealed

  const put = (token: string) => {
    /* istanbul ignore next @preserve */ // плитки disabled при finished — гарда защитная
    if (finished) return
    setBank((prev) => {
      const index = prev.findIndex((item) => item.token === token && !item.used)
      /* istanbul ignore next @preserve */ // повторный клик по used-плитке невозможен (disabled)
      if (index === -1) return prev
      return prev.map((item, i) => (i === index ? { ...item, used: true } : item))
    })
    setSlots((prev) => [...prev, token])
  }

  const removeSlot = (slotIndex: number) => {
    /* istanbul ignore next @preserve */ // защитные гарды: слоты disabled/индекс всегда валиден
    if (finished) return
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
  }, [slots, finished])

  const busyRef = useRef(false)

  const check = () => {
    /* istanbul ignore next */ // кнопка скрыта при finished; busyRef — защита от гонки
    /* istanbul ignore next */ // кнопка скрыта при finished; busy — защита гонки
    if (finished || busyRef.current) return
    busyRef.current = true
    const nextAttempts = attempts + 1
    setAttempts(nextAttempts)
    const verdict = judge(slots.join(' '), taskFor(exercise, phrase, trap))
    setResult(verdict)
    if (verdict.verdict === 'correct' || verdict.verdict === 'correct_typo') {
      onAnswer(nextAttempts <= 1 ? 'correct' : 'correct_retry', nextAttempts)
      return
    }
    if (nextAttempts >= 2) {
      setRevealed(true)
      onAnswer('skip', nextAttempts)
      return
    }
    // первая неудача: разрешаем пересобрать и проверить снова
    busyRef.current = false
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
            disabled={finished}
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
            disabled={used || finished}
            onClick={() => put(token)}
          >
            {token}
          </button>
        ))}
      </div>
      {result && (
        <FeedbackPlate
          result={result}
          showReference={revealed}
          phrase={phrase}
          onDispute={revealed ? onDispute : undefined}
        />
      )}
      {revealed && phrase && (
        <p className="lesson-ref" lang="en">
          {phrase.text_en}
        </p>
      )}
      <div className="lesson-actions">
        {!finished && attempts < 2 && (
          <button
            type="button"
            className="srs-btn srs-btn-good"
            disabled={slots.length === 0}
            onClick={check}
          >
            {t('lesson.check')}
          </button>
        )}
        {finished && (
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
 * Web Speech; RETRY — не ошибка, попытки не ограничены; фолбэк — текст
 * (после 2 неудач — без потери XP, §3 №3) или самопроверка «Сказал(-а)»
 * (только при недоступном микрофоне; полный XP, точность не растит — §3).
 */
export function VoiceExercise({
  exercise,
  phrase,
  trap,
  onAnswer,
  onDispute,
  onNext,
  mode,
}: ExerciseViewProps & { mode: 'speak' | 'shadowing' | 'answer' }) {
  const { t } = useTranslation()
  const p = payload<{
    prompt_ru?: string
    question_en?: string
    situation_ru?: string
    audio?: string
    free_form?: boolean
  }>(exercise)
  const supported = isSpeechSupported()
  const [listening, setListening] = useState(false)
  const [feedback, setFeedback] = useState<CheckResult | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [done, setDone] = useState(false)
  const [typing, setTyping] = useState(false)
  const [typed, setTyped] = useState('')
  const task = taskFor(exercise, phrase, trap)

  useEffect(() => cancelListening, [])

  const finish = (outcome: ExerciseOutcome, nextAttempts: number) => {
    setDone(true)
    onAnswer(outcome, nextAttempts)
  }

  const listen = async () => {
    /* istanbul ignore next @preserve */ // кнопка disabled в этих состояниях (React не диспатчит клики)
    if (listening || done) return
    setListening(true)
    setFeedback(null)
    try {
      const recognized = await listenOnce({})
      const nextAttempts = attempts + 1
      setAttempts(nextAttempts)
      const result = judgeVoice(recognized, task)
      setFeedback(result)
      if (result.verdict === 'correct') {
        finish(nextAttempts <= 1 ? 'correct' : 'correct_retry', nextAttempts)
      }
    } catch {
      setAttempts((n) => n + 1)
      setFeedback(null)
    } finally {
      setListening(false)
    }
  }

  const checkTyped = () => {
    if (!typed.trim() || done) return
    const nextAttempts = attempts + 1
    setAttempts(nextAttempts)
    const result = judge(typed, task)
    setFeedback(result)
    if (result.verdict === 'correct' || result.verdict === 'correct_typo') {
      // после 2 неудачных голосовых попыток текст — без потери XP (specs/02 §3 №3)
      const voiceFails = attempts
      finish(voiceFails >= 2 || nextAttempts <= 1 ? 'correct' : 'correct_retry', nextAttempts)
    }
  }

  const prompt =
    mode === 'speak'
      ? (p.prompt_ru ?? phrase?.translation_ru ?? '')
      : mode === 'answer'
        ? ((p.question_en as string) ?? '')
        : (phrase?.text_en ?? '')

  // сценка разговорника (B-27): свобода важнее точности — самопроверка сразу
  const canSelfReport = !supported || attempts >= 2 || p.free_form === true

  return (
    <div className="lesson-exercise">
      {mode === 'answer' && p.situation_ru && (
        <p className="lesson-quote-src dim">{p.situation_ru}</p>
      )}
      <p className="lesson-prompt" lang={mode === 'speak' ? 'ru' : 'en'}>
        {prompt}
      </p>
      {mode === 'shadowing' && phrase?.audio?.en_gb && (
        <AudioButtons text={phrase.text_en} src={phrase.audio.en_gb} />
      )}
      {mode === 'answer' && p.audio && <AudioButtons text={prompt} src={p.audio} />}
      {mode === 'answer' && exercise.answer.hint_ru && !done && (
        <p className="dim">{exercise.answer.hint_ru}</p>
      )}
      {listening && (
        <div className="lesson-wave" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className="lesson-wave-bar" />
          ))}
        </div>
      )}
      <div className="lesson-actions">
        {supported && (
          <button
            type="button"
            className={`srs-btn ${listening ? 'srs-btn-again' : 'srs-btn-good'}`}
            onClick={() => void listen()}
            disabled={done || listening}
          >
            {listening ? t('lesson.listening') : t('lesson.sayIt')} 🎙
          </button>
        )}
        {!done && attempts >= 5 && mode !== 'answer' && (
          <button
            type="button"
            className="srs-btn"
            onClick={() => {
              finish('skip', attempts)
              onNext()
            }}
          >
            {t('lesson.giveUp')} (0 XP)
          </button>
        )}
        {!supported && <p className="dim">{t('lesson.speechUnavailable')}</p>}
        <button
          type="button"
          className="srs-btn"
          onClick={() => setTyping((prev) => !prev)}
          disabled={done}
        >
          {t('lesson.typeInstead')}
        </button>
        {canSelfReport && !done && (
          <button
            type="button"
            className="srs-btn srs-btn-good"
            onClick={() => {
              finish('self_reported', attempts + 1)
              onNext()
            }}
          >
            {p.free_form ? t('lesson.saidItFree') : t('lesson.saidIt')}
          </button>
        )}
      </div>
      {typing && !done && (
        <form
          className="lesson-input-row"
          onSubmit={(event) => {
            event.preventDefault()
            checkTyped()
          }}
        >
          <input
            className="lesson-input"
            lang="en"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={t('lesson.voiceFallbackPrompt')}
          />
          <button type="submit" className="srs-btn srs-btn-good" disabled={!typed.trim()}>
            {t('lesson.check')} <kbd>⏎</kbd>
          </button>
        </form>
      )}
      {feedback && (
        <FeedbackPlate
          result={feedback}
          showReference={feedback.verdict !== 'correct'}
          phrase={phrase}
          onDispute={feedback.verdict === 'wrong' && done ? onDispute : undefined}
        />
      )}
      {feedback?.verdict === 'retry' && !done && (
        <p className="dim">{t('lesson.voiceRetryHint')}</p>
      )}
      {done && (
        <div className="lesson-actions">
          <button type="button" className="srs-btn srs-btn-good" onClick={onNext}>
            {t('lesson.next')} <kbd>⏎</kbd>
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Плашка вердикта с diff-подсветкой (specs/02 §4.5) и «Я был прав» (§4.6).
 * onDispute перезаписывает исход на disputed: полный XP, пометка в очереди правки.
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
              {token.status === 'missing'
                ? `+${token.word ?? token.ref ?? ''}`
                : (token.word ?? '')}
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

/**
 * Трансформация ±? (specs/02 §3 №14, план M12#12.7): цепочка шагов
 * утверждение → отрицание → вопрос. Источник шага N — фраза-эталон шага N-1,
 * ответ проверяется по variants фразы текущего шага. onAnswer — один раз,
 * финальным исходом всех шагов.
 */
export function TransformExercise({
  exercise,
  phrase,
  onAnswer,
  onNext,
  phrasesById,
}: ExerciseViewProps & { phrasesById: Record<string, PhraseItem> }) {
  const { t } = useTranslation()
  const payloadData = exercise.payload as unknown as {
    source_phrase_id: string
    steps: { task: 'question' | 'negative' | 'past' | 'future'; phrase_id: string }[]
  }
  const source = phrasesById[payloadData.source_phrase_id] ?? phrase
  const [stepIndex, setStepIndex] = useState(0)
  const [typed, setTyped] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [totalAttempts, setTotalAttempts] = useState(0)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [done, setDone] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [exercise.id, stepIndex])

  const step = payloadData.steps[stepIndex]
  const target = step ? phrasesById[step.phrase_id] : null
  // источник текущего шага: сам source для первого, эталон предыдущего — дальше
  const currentText =
    stepIndex === 0
      ? source?.text_en
      : (phrasesById[payloadData.steps[stepIndex - 1]!.phrase_id]?.text_en ?? '')

  const check = () => {
    /* istanbul ignore next @preserve — защитный гард: форма рендерится только при валидных step/target */
    if (!target || !step) return
    const task: CheckTask = {
      accepted: target.variants.length > 0 ? target.variants : [target.text_en],
    }
    const nextAttempts = attempts + 1
    const verdict = judge(typed, task)
    setAttempts(nextAttempts)
    setTotalAttempts((prev) => prev + 1)
    setResult(verdict)
  }

  const advance = () => {
    const isLast = stepIndex + 1 >= payloadData.steps.length
    if (isLast) {
      const steps = payloadData.steps.length
      const firstTry = totalAttempts <= steps
      onAnswer(firstTry ? 'correct' : 'correct_retry', totalAttempts)
      setDone(true)
      return
    }
    setStepIndex(stepIndex + 1)
    setTyped('')
    setAttempts(0)
    setResult(null)
  }

  const ok = result?.verdict === 'correct' || result?.verdict === 'correct_typo'
  const failed = result !== null && !ok && attempts >= 2

  if (!step || !target) {
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

  return (
    <div className="lesson-exercise">
      <p className="dim">
        {t('lesson.transform.step', { current: stepIndex + 1, total: payloadData.steps.length })}
      </p>
      <p className="lesson-prompt" lang="en">
        {currentText}
      </p>
      <p className="lesson-trap">{t(`lesson.transform.tasks.${step.task}`)}</p>
      {!done && !ok && !failed && (
        <form
          className="lesson-input-row"
          onSubmit={(event) => {
            event.preventDefault()
            /* istanbul ignore next @preserve — защитная ветка: условие совпадает с failed,
               при котором форма уже не рендерится (эталон и «Дальше» — вне формы) */
            if (result && !ok && attempts >= 2) {
              advance()
              return
            }
            if (typed.trim()) check()
          }}
        >
          <input
            ref={inputRef}
            className="lesson-input"
            lang="en"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
          <button type="submit" className="srs-btn srs-btn-good" disabled={!typed.trim()}>
            {t('lesson.check')} <kbd>⏎</kbd>
          </button>
        </form>
      )}
      {failed && (
        <>
          <p className="lesson-ref" lang="en">
            {target.text_en}
          </p>
          <div className="lesson-actions">
            <button type="button" className="srs-btn srs-btn-good" onClick={advance}>
              {t('lesson.next')} <kbd>⏎</kbd>
            </button>
          </div>
        </>
      )}
      {result && <FeedbackPlate result={result} showReference={false} phrase={target} />}
      {ok && !done && (
        <div className="lesson-actions">
          <button type="button" className="srs-btn srs-btn-good" onClick={advance}>
            {t('lesson.next')} <kbd>⏎</kbd>
          </button>
        </div>
      )}
      {done && (
        <div className="lesson-actions">
          <button type="button" className="srs-btn srs-btn-good" onClick={onNext}>
            {t('lesson.next')} <kbd>⏎</kbd>
          </button>
        </div>
      )}
    </div>
  )
}
