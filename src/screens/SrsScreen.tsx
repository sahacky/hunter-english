// Implements: plan://M4#4.4 — экран повторения /srs (specs/03 §6–§7, specs/07 `/#/srs`).
// Фазы внутри маршрута: загрузка/бустрап → очередь → блок из 20 → финал
// (открытый вопрос 2 specs/07: отдельный маршрут не нужен для MVP).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  buildQueue,
  applyAnswer,
  dayStart,
  formatInterval,
  previewDue,
  type QueueItem,
} from '../domain/srs/scheduler'
import type { Note, QueueEntry, SessionPlan } from '../domain/srs/types'
import {
  createFirstCards,
  loadWordNotes,
  loadWordRanks,
  makeWordBandFilter,
} from '../content/words'
import { loadPhraseNotes } from '../content/lessons'
import { fixV1WordFloor, floorV2Done } from '../data/migrations'
import type { ProgressRepository } from '../domain/progress'
import { DexieProgressRepository } from '../data/progress-repository'
import { uuidv7 } from '../lib/uuidv7'
import { speak, stopSpeak } from '../lib/tts'
import { anySlotDone, awardXp, closeStudyDay } from '../domain/game/award'
import { RANK_WORD_TARGET, rankOfFreq } from '../domain/game/game'
import { useSettings } from '../state/settings'
import { showToast } from '../lib/toast'
import RulesCheatSheet from '../components/RulesCheatSheet'

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
  const [confirmExit, setConfirmExit] = useState(false)
  const [sessionId] = useState(() => uuidv7())
  // Ранги слов для бейджа «Полоса ранга X» (U3.2); null — инъекция notes (тесты)
  const [wordRanks, setWordRanks] = useState<Map<string, number> | null>(null)
  // Защита от двойного ответа, пока saveAnswer в полёте (review_log append-only —
  // дубль нельзя перезаписать, specs/06 §1)
  const busyRef = useRef(false)
  // Время показа текущей карточки — duration_ms в review_log (specs/06 §1);
  // инициализируется эффектом показа карточки ниже, до этого замеры не снимаются
  const cardShownAt = useRef(0)
  // Момент показа карточки — единый `now` для превью интервалов И applyAnswer:
  // seed fuzz в ts-fsrs включает review_time (DefaultInitSeedStrategy), поэтому
  // превью и фактический ответ обязаны зваться с одним now — иначе подпись
  // кнопки соврёт (ревью M10, Б1). reviewed_at = момент показа (допустимо:
  // duration_ms считается точно, гранулярность FSRS — дни).
  const previewNowRef = useRef(new Date())

  const { settings, ready: settingsReady } = useSettings()

  useEffect(() => {
    let alive = true
    async function start() {
      try {
        const wordNotes = notes ?? (await loadWordNotes())
        // Фразы уроков (M5): карточек может ещё не быть (урок создаёт их на шаге 7),
        // но заметки нужны для разрешения note_id → контент в очереди повторения.
        const phraseNotes = notes ? [] : await loadPhraseNotes()
        const allNotes = [...wordNotes, ...phraseNotes]
        // U3.2-миграция (одноразовая): v1-флор оценки скрыл полосу текущего
        // ранга — вернуть её, иначе новые слова не придут вовсе
        if (!floorV2Done() && !notes) {
          const [st, rk] = await Promise.all([repo.getStats(), loadWordRanks()])
          await fixV1WordFloor(repo, st.rank, rk)
        }
        // rule-1: при первом запуске материализуем первую карточку каждой заметки СЛОВ
        // (фразы материализует урок — specs/02 §2 шаг 7, не здесь)
        await repo.ensureCards(createFirstCards(wordNotes, new Date()))
        const [cards, stats, ranksMap] = await Promise.all([
          repo.getAllCards(),
          notes ? Promise.resolve(null) : repo.getStats(),
          notes ? Promise.resolve(null) : loadWordRanks(),
        ])
        const byId = new Map(allNotes.map((note) => [note.id, note]))
        // U3.2: новые слова — только из полосы текущего ранга (связь с уроками:
        // полоса ранга = лексика изучаемых уроков); повторы/пробуждения не фильтруем
        const wordCeiling = stats && ranksMap ? RANK_WORD_TARGET[stats.rank] : null
        const allowNew =
          wordCeiling !== null
            ? makeWordBandFilter(
                wordCeiling,
                ranksMap!,
                new Map(allNotes.map((note) => [note.id, note.entityId])),
              )
            : undefined
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
          baseNewLimit: Math.max(0, settings.newPerDay - newShownToday),
          allowNew,
        })
        if (!alive) return
        setWordRanks(ranksMap)
        setPlan(nextPlan)
        setQueue(nextPlan.entries)
        cardShownAt.current = Date.now()
        previewNowRef.current = new Date()
        if (nextPlan.entries.length > 0) setPhase({ kind: 'review' })
        else setPhase({ kind: 'done', empty: true })
      } catch {
        if (alive) setPhase({ kind: 'error' })
      }
    }
    // настройки грузятся асинхронно: ждём ready, чтобы строить очередь
    // с сохранённым newPerDay (ревью M10, минор 6)
    if (settingsReady || notes) void start()
    return () => {
      alive = false
    }
    // бустрап один раз на монтирование; notes/repo — инъекция, не триггерят перезапуск
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsReady])

  useEffect(() => {
    cardShownAt.current = Date.now()
    previewNowRef.current = new Date()
  }, [queue[0]?.card.card_id, phase.kind])

  // уход с экрана останавливает озвучку (plan://M6#6.3, ревью)
  useEffect(() => stopSpeak, [])

  // beforeunload в активной сессии: ответы уже в review_log, но пользователь
  // должен осознанно закрыть вкладку (specs/07 §4.3, решение M10#5)
  useEffect(() => {
    if (phase.kind !== 'review' || answeredTotal === 0) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [phase.kind, answeredTotal])

  const answer = useCallback(
    async (rating: 1 | 2 | 3 | 4) => {
      const entry = queue[0]
      if (!entry || busyRef.current) return
      busyRef.current = true
      // единый now с превью интервалов (seed fuzz включает review_time — ревью M10 Б1)
      const now = previewNowRef.current
      const { next, log } = applyAnswer(entry.card, rating, now, {
        logId: uuidv7(now),
        sessionId,
        durationMs: Date.now() - cardShownAt.current,
      })
      try {
        await repo.saveAnswer(next, log) // мгновенное сохранение каждого ответа
        // XP-шина (plan://M7#7.3): повтор 1 XP; выпуск новой карточки в Review +2
        const released = entry.card.state === 1 && next.state === 2
        const award = await awardXp(repo, new Date(), 1 + (released ? 2 : 0), 'reviews', {
          reviews: 1,
        })
        if (anySlotDone(award.quest)) {
          const closed = await closeStudyDay(repo, new Date())
          showToast(t('toast.questDone')) // решение M10#2: значимые события
          if (closed.freezeGained) showToast(t('toast.freezeGained'))
        }
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

  const entry = queue[0]
  // Полоса ранга слова на карточке (U3.2): субтитровое/без ранга — полоса S
  const bandRank =
    entry && wordRanks
      ? rankOfFreq(wordRanks.get(entry.note.entityId) ?? Number.POSITIVE_INFINITY)
      : null

  useEffect(() => {
    if (phase.kind !== 'review') return
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const onControl = event.target instanceof HTMLElement && event.target.tagName === 'BUTTON'
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === 'Escape') {
        // specs/07 §4.3/§5.1: Esc открывает подтверждение; повторный Esc закрывает
        setConfirmExit((prev) => !prev)
        return
      }
      if (confirmExit) return // диалог открыт — оценки не срабатывают (ревью M10 м2)
      // пробел на сфокусированной кнопке — её штатная активация; остальные клавиши (r/s/1..4) работают всегда
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
      } else if (revealed && ['1', '2', '3', '4'].includes(event.key)) {
        const digit = Number(event.key) as 1 | 2 | 3 | 4
        // режим 2: 1=Again, 2=Good (Hard/Easy — только в режиме 4, specs/03 §6)
        const rating = settings.srsButtons === 4 ? digit : digit === 1 ? 1 : 3
        if (settings.srsButtons === 2 && digit >= 3) return
        void answer(rating)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // entry не в deps (объявлен ниже): замыкание свежее через answer (меняется с queue)
  }, [phase.kind, revealed, answer, settings.srsButtons, confirmExit])

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
    setConfirmExit(false)
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
        {/* Шпаргалка пройденного (план {#cheat-sheet}): пауза между сессиями —
            момент «пробежать глазами»; в активной сессии не показываем (фокус) */}
        <RulesCheatSheet repo={repo} />
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
        <RulesCheatSheet repo={repo} />
      </section>
    )
  }

  // Превью интервалов для кнопок (specs/03 §6): from = замороженный момент показа
  // (previewNowRef), тот же now уходит в applyAnswer — подпись не врёт (ревью M10 Б1).
  // Чтение ref в рендере осознанное: previewNow заморожен на показе карточки и не
  // меняется до следующей (react-hooks/refs vs инвариант M10 — disable локальный)
  /* eslint-disable react-hooks/refs -- замороженный previewNow: один now для превью и applyAnswer (ревью M10 Б1) */
  const units = {
    m: t('srs.intervalUnits.m'),
    h: t('srs.intervalUnits.h'),
    d: t('srs.intervalUnits.d'),
    y: t('srs.intervalUnits.y'),
  }
  const intervals =
    settings.showIntervals && revealed
      ? {
          1: formatInterval(
            previewNowRef.current,
            previewDue(entry.card, 1, previewNowRef.current),
            units,
          ),
          2: formatInterval(
            previewNowRef.current,
            previewDue(entry.card, 2, previewNowRef.current),
            units,
          ),
          3: formatInterval(
            previewNowRef.current,
            previewDue(entry.card, 3, previewNowRef.current),
            units,
          ),
          4: formatInterval(
            previewNowRef.current,
            previewDue(entry.card, 4, previewNowRef.current),
            units,
          ),
        }
      : null
  /* eslint-enable react-hooks/refs -- см. обоснование выше */
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
        {entry.note.deck === 'words' && bandRank && (
          <p className="dim srs-band">{t('srs.band', { rank: bandRank })}</p>
        )}
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
          settings.srsButtons === 4 ? (
            <>
              <button
                type="button"
                className="srs-btn srs-btn-again"
                onClick={() => void answer(1)}
              >
                {t('srs.again4')} <kbd>1</kbd>
                {intervals && <span className="srs-btn-interval">{intervals[1]}</span>}
              </button>
              <button type="button" className="srs-btn" onClick={() => void answer(2)}>
                {t('srs.hard')} <kbd>2</kbd>
                {intervals && <span className="srs-btn-interval">{intervals[2]}</span>}
              </button>
              <button type="button" className="srs-btn srs-btn-good" onClick={() => void answer(3)}>
                {t('srs.good')} <kbd>3</kbd>
                {intervals && <span className="srs-btn-interval">{intervals[3]}</span>}
              </button>
              <button type="button" className="srs-btn" onClick={() => void answer(4)}>
                {t('srs.easy')} <kbd>4</kbd>
                {intervals && <span className="srs-btn-interval">{intervals[4]}</span>}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="srs-btn srs-btn-again"
                onClick={() => void answer(1)}
              >
                {t('srs.again')} <kbd>1</kbd>
                {intervals && <span className="srs-btn-interval">{intervals[1]}</span>}
              </button>
              <button type="button" className="srs-btn srs-btn-good" onClick={() => void answer(3)}>
                {t('srs.good')} <kbd>2</kbd>
                {intervals && <span className="srs-btn-interval">{intervals[3]}</span>}
              </button>
            </>
          )
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
      {revealed && settings.srsButtons === 2 && !settings.showIntervals && (
        <p className="srs-mode-hint dim">{t('srs.modeHint')}</p>
      )}
      {confirmExit && (
        <p className="srs-exit-confirm" role="alertdialog" aria-label={t('srs.exitConfirmTitle')}>
          <span>{t('srs.exitConfirm', { count: answeredTotal })}</span>
          <span className="srs-actions">
            <button type="button" className="srs-btn" onClick={() => setConfirmExit(false)}>
              {t('srs.exitCancel')}
            </button>
            <button type="button" className="srs-btn srs-btn-again" onClick={finish}>
              {t('srs.finish')}
            </button>
          </span>
        </p>
      )}
      <footer className="srs-progress dim">
        {/* clamp: живая очередь может выдать больше ответов, чем стартовый план (Known Issue M4) */}
        {t('srs.progress', {
          done: Math.min(answeredTotal, plan?.entries.length ?? 0),
          total: plan?.entries.length ?? 0,
        })}
      </footer>
    </section>
  )
}
