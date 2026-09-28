// Implements: plan://M4#4.4 — экран повторения /srs (specs/03 §6–§7, specs/07 `/#/srs`).
// Фазы внутри маршрута: загрузка/бустрап → очередь → блок из 20 → финал
// (открытый вопрос 2 specs/07: отдельный маршрут не нужен для MVP).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  buildQueue,
  applyAnswer,
  dayStart,
  DEFAULT_NEW_LIMIT,
  type QueueItem,
} from '../domain/srs/scheduler'
import type { Note, QueueEntry, SessionPlan } from '../domain/srs/types'
import { createFirstCards, loadWordNotes } from '../content/words'
import { loadPhraseNotes } from '../content/lessons'
import type { ProgressRepository } from '../domain/progress'
import { DexieProgressRepository } from '../data/progress-repository'
import { uuidv7 } from '../lib/uuidv7'
import { speak, stopSpeak } from '../lib/tts'

const BLOCK_SIZE = 20

type Phase =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'review' }
  | { kind: 'block' }
  | { kind: 'done'; empty: boolean }

interface SrsScreenProps {
  /** Репозиторий прогресса (инъекция для тестов; по умолчанию — Dexie). */
  repo?: ProgressRepository
  /** Заметки слов (инъекция для тестов; по умолчанию — data/words). */
  notes?: Note[]
}

export default function SrsScreen({ repo: repoProp, notes }: SrsScreenProps) {
  const { t } = useTranslation()
  const defaultRepo = useMemo(() => new DexieProgressRepository(), [])
  const repo = repoProp ?? defaultRepo
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [plan, setPlan] = useState<SessionPlan | null>(null)
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [revealed, setRevealed] = useState(false)
  const [answeredTotal, setAnsweredTotal] = useState(0)
  const [answeredInBlock, setAnsweredInBlock] = useState(0)
  const [sessionId] = useState(() => uuidv7())
  // Защита от двойного ответа, пока saveAnswer в полёте (review_log append-only —
  // дубль нельзя перезаписать, specs/06 §1)
  const busyRef = useRef(false)
  // Время показа текущей карточки — duration_ms в review_log (specs/06 §1)
  const cardShownAt = useRef(Date.now())

  useEffect(() => {
    let alive = true
    async function start() {
      try {
        const wordNotes = notes ?? (await loadWordNotes())
        // Фразы уроков (M5): карточек может ещё не быть (урок создаёт их на шаге 7),
        // но заметки нужны для разрешения note_id → контент в очереди повторения.
        const phraseNotes = notes ? [] : await loadPhraseNotes()
        const allNotes = [...wordNotes, ...phraseNotes]
        // rule-1: при первом запуске материализуем первую карточку каждой заметки СЛОВ
        // (фразы материализует урок — specs/02 §2 шаг 7, не здесь)
        await repo.ensureCards(createFirstCards(wordNotes, new Date()))
        const cards = await repo.getAllCards()
        const byId = new Map(allNotes.map((note) => [note.id, note]))
        const items: QueueItem[] = cards
          .map((card) => {
            const note = byId.get(card.note_id)
            return note ? { card, note } : undefined
          })
          .filter((item): item is QueueItem => item !== undefined)
        const now = new Date()
        // Дневной лимит новых действует между сессиями (srs://rule-3):
        // вычитаем уже отвечённые сегодня новые. Пробуждения (wokenToday) не
        // учитываются: обратные карточки материализуются позже (M6+).
        const newShownToday = await repo.countNewAnsweredSince(dayStart(now).toISOString())
        const nextPlan = buildQueue(items, {
          now,
          baseNewLimit: Math.max(0, DEFAULT_NEW_LIMIT - newShownToday),
        })
        if (!alive) return
        setPlan(nextPlan)
        setQueue(nextPlan.entries)
        cardShownAt.current = Date.now()
        if (nextPlan.entries.length > 0) setPhase({ kind: 'review' })
        else setPhase({ kind: 'done', empty: true })
      } catch {
        if (alive) setPhase({ kind: 'error' })
      }
    }
    void start()
    return () => {
      alive = false
    }
    // бустрап один раз на монтирование; notes/repo — инъекция, не триггерят перезапуск
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    cardShownAt.current = Date.now()
  }, [queue[0]?.card.card_id, phase.kind])

  // уход с экрана останавливает озвучку (plan://M6#6.3, ревью)
  useEffect(() => stopSpeak, [])

  const answer = useCallback(
    async (rating: 1 | 3) => {
      const entry = queue[0]
      if (!entry || busyRef.current) return
      busyRef.current = true
      const now = new Date()
      const { next, log } = applyAnswer(entry.card, rating, now, {
        logId: uuidv7(now),
        sessionId,
        durationMs: now.getTime() - cardShownAt.current,
      })
      try {
        await repo.saveAnswer(next, log) // мгновенное сохранение каждого ответа
      } catch {
        setPhase({ kind: 'error' })
        return
      } finally {
        busyRef.current = false
      }
      const rest = queue.slice(1)
      if (next.state === 1 || next.state === 3) {
        // Живая очередь внутри сессии (specs/03 §7 srs://session-order п.1):
        // Learning/Relearning возвращается, когда подойдёт её минутный due.
        // Позиция — после новых (показ чуть раньше точного due при пустом хвосте
        // очереди — приемлемое приближение MVP, Anki ведёт себя так же).
        rest.push({ card: next, note: entry.note, kind: 'learning' })
      }
      const inBlock = answeredInBlock + 1
      setQueue(rest)
      setRevealed(false)
      setAnsweredTotal((n) => n + 1)
      setAnsweredInBlock(inBlock)
      if (rest.length === 0) setPhase({ kind: 'done', empty: false })
      else if (inBlock >= BLOCK_SIZE) setPhase({ kind: 'block' })
    },
    [queue, answeredInBlock, repo, sessionId],
  )

  useEffect(() => {
    if (phase.kind !== 'review') return
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const onControl = event.target instanceof HTMLElement && event.target.tagName === 'BUTTON'
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      // пробел на сфокусированной кнопке — её штатная активация; остальные клавиши (r/s/1/2) работают всегда
      if (event.code === 'Space') {
        if (onControl) return
        event.preventDefault()
        setRevealed(true)
        return
      }
      if (key === 'r') {
        speak(entry.note.en, { src: entry.note.audio })
      } else if (key === 's') {
        speak(entry.note.en, { src: entry.note.audio, rate: 0.75 })
      } else if (revealed && event.key === '1') {
        void answer(1)
      } else if (revealed && event.key === '2') {
        void answer(3)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase.kind, revealed, answer])

  const counters = useMemo(() => {
    const count = (kind: QueueEntry['kind']) => queue.filter(({ kind: k }) => k === kind).length
    return {
      learning: count('learning'),
      review: count('review-young') + count('review-mature'),
      new: count('new') + count('wake-up'),
    }
  }, [queue])

  const finish = () => {
    stopSpeak()
    setPhase({ kind: 'done', empty: false })
  }

  if (phase.kind === 'loading') {
    return (
      <section className="panel srs-panel">
        <p className="dim">{t('srs.loading')}</p>
      </section>
    )
  }
  if (phase.kind === 'error') {
    return (
      <section className="panel srs-panel">
        <p className="srs-error">{t('srs.error')}</p>
      </section>
    )
  }
  if (phase.kind === 'done') {
    return (
      <section className="panel srs-panel">
        <h2>{t('srs.title')}</h2>
        <p>{phase.empty ? t('srs.empty') : t('srs.sessionDone')}</p>
        <p className="dim">{t('srs.answered', { count: answeredTotal })}</p>
      </section>
    )
  }
  if (phase.kind === 'block') {
    return (
      <section className="panel srs-panel">
        <h2>{t('srs.blockDone', { count: BLOCK_SIZE })}</h2>
        <p className="dim">{t('srs.answered', { count: answeredTotal })}</p>
        <div className="srs-actions">
          <button
            type="button"
            className="srs-btn srs-btn-good"
            onClick={() => {
              setAnsweredInBlock(0)
              setPhase({ kind: 'review' })
            }}
          >
            {t('srs.continue')}
          </button>
          <button type="button" className="srs-btn" onClick={finish}>
            {t('srs.finish')}
          </button>
        </div>
      </section>
    )
  }

  const entry = queue[0]
  return (
    <section className="panel srs-panel">
      <header className="srs-head">
        <h2>{t('srs.title')}</h2>
        <ul className="srs-counters" aria-label={t('srs.countersLabel')}>
          <li className="srs-counter srs-counter-learning">
            {t('srs.counters.learning')}: {counters.learning}
          </li>
          <li className="srs-counter srs-counter-review">
            {t('srs.counters.review')}: {counters.review}
          </li>
          <li className="srs-counter srs-counter-new">
            {t('srs.counters.new')}: {counters.new}
          </li>
        </ul>
        <button type="button" className="srs-finish" onClick={finish}>
          {t('srs.finish')}
        </button>
      </header>

      {plan && plan.debt > 200 && <p className="srs-warning">{t('srs.loadReduced')}</p>}

      <div className="srs-card">
        <p className="srs-front" lang="en">
          {entry.note.en}
        </p>
        <div className="lesson-audio" aria-label={t('srs.audioLabel')}>
          <button
            type="button"
            className="srs-btn"
            onClick={() => speak(entry.note.en, { src: entry.note.audio })}
          >
            🔊 <kbd>R</kbd>
          </button>
          <button
            type="button"
            className="srs-btn"
            onClick={() => speak(entry.note.en, { src: entry.note.audio, rate: 0.75 })}
          >
            🐢 <kbd>S</kbd>
          </button>
        </div>
        {revealed ? (
          <p className="srs-back" lang="ru">
            {entry.note.ru}
          </p>
        ) : (
          <p className="srs-back dim">{t('srs.hint')}</p>
        )}
      </div>

      <div className="srs-actions">
        {revealed ? (
          <>
            <button type="button" className="srs-btn srs-btn-again" onClick={() => void answer(1)}>
              {t('srs.again')} <kbd>1</kbd>
            </button>
            <button type="button" className="srs-btn srs-btn-good" onClick={() => void answer(3)}>
              {t('srs.good')} <kbd>2</kbd>
            </button>
          </>
        ) : (
          <button
            type="button"
            className="srs-btn srs-btn-reveal"
            onClick={() => setRevealed(true)}
          >
            {t('srs.showAnswer')} <kbd>space</kbd>
          </button>
        )}
      </div>
      <footer className="srs-progress dim">
        {t('srs.progress', { done: answeredTotal, total: plan?.entries.length ?? 0 })}
      </footer>
    </section>
  )
}
