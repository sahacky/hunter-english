// Implements: plan://M11#11.1–11.2 — Цитаты: галерея тайтлов /#/quotes и экран
// цитаты /#/quotes/:id (specs/07 §2.1). Раскраска слов по состоянию карточек
// колоды words; «понял без перевода» — item_progress kind='quote'.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { judge } from '../domain/check/checker'
import type { CheckResult } from '../domain/check/types'
import {
  findQuote,
  loadQuoteTitles,
  quoteWords,
  type QuoteItem,
  type QuoteTitle,
} from '../content/quotes'
import { createFirstCards, loadTopNgslLemmas, loadWordNotes } from '../content/words'
import type { CardState, Note } from '../domain/srs/types'
import type { ProgressRepository } from '../domain/progress'
import { DexieProgressRepository } from '../data/progress-repository'
import { speak, stopSpeak } from '../lib/tts'
import { showToast } from '../lib/toast'
import { FeedbackPlate } from '../components/lesson/ExerciseView'

function buildVocab(notes: Note[], cards: CardState[], top1000: Set<string>): Vocab {
  const byWord = new Map<string, Note[]>()
  for (const note of notes) {
    const list = byWord.get(note.en) ?? []
    list.push(note)
    byWord.set(note.en, list)
  }
  const states = new Map<string, number>()
  for (const card of cards) {
    const prev = states.get(card.note_id) ?? -1
    // «лучшее» = максимум состояния (2 Review выше Learning); suspended игнорируем
    if (!card.suspended && card.state > prev) states.set(card.note_id, card.state)
  }
  return { byWord, states, top1000 }
}

/** Знание слова: лучшее состояние карточек заметок этой леммы. */
type WordKnowledge = 'absent' | 'none' | 'learning' | 'known'

interface Vocab {
  /** лемма → заметки (переводы, «в колоду»). */
  byWord: Map<string, Note[]>
  /** note_id → лучшее состояние карточки (0 new, 1/3 learning, 2 review). */
  states: Map<string, number>
  /** Леммы топ-1000 NGSL (для cloze, решение M11#4). */
  top1000: Set<string>
}

/** Кандидаты-леммы токена: точное совпадение + простые словоформы (ревью M11 М4). */
function lookupStems(vocab: Vocab, word: string): string | null {
  const candidates = [word]
  if (word.endsWith('ies')) candidates.push(`${word.slice(0, -3)}y`)
  if (word.endsWith('es')) candidates.push(word.slice(0, -2))
  if (word.endsWith('s')) candidates.push(word.slice(0, -1))
  if (word.endsWith('ing')) {
    const stem = word.slice(0, -3)
    candidates.push(stem)
    if (stem.length > 2 && stem.at(-1) === stem.at(-2)) candidates.push(stem.slice(0, -1))
    candidates.push(`${stem}e`)
  }
  if (word.endsWith('ed')) {
    const stem = word.slice(0, -2)
    candidates.push(stem)
    if (stem.length > 2 && stem.at(-1) === stem.at(-2)) candidates.push(stem.slice(0, -1))
    candidates.push(`${stem}e`)
  }
  for (const candidate of candidates) {
    if (vocab.byWord.has(candidate)) return candidate
  }
  return null
}

function wordKnowledge(vocab: Vocab, word: string): WordKnowledge {
  const lemma = lookupStems(vocab, word)
  if (!lemma) return 'absent' // нет в датасете (имена/редкие) — не считаем незнакомым
  const notes = vocab.byWord.get(lemma) ?? []
  let best: WordKnowledge = 'none'
  for (const note of notes) {
    const state = vocab.states.get(note.id)
    if (state === 2) return 'known'
    if (state === 1 || state === 3) best = 'learning'
  }
  return best
}

/** Доля знакомых слов цитаты (для фильтра «понятные сейчас», ≥90% — канон).
 * Знаменатель — только слова датасета: имена и прочие отсутствующие
 * не занижают фильтр (ревью M11 М4). */
export function quoteUnderstanding(vocab: Vocab, quote: QuoteItem): number {
  const words = quoteWords(quote.text)
  let total = 0
  let known = 0
  for (const word of words) {
    const knowledge = wordKnowledge(vocab, word)
    if (knowledge === 'absent') continue
    total += 1
    if (knowledge === 'known') known += 1
  }
  return total === 0 ? 0 : known / total
}

/* ============================ /#/quotes — галерея ============================ */

export function QuotesScreen({ repo: repoProp }: { repo?: ProgressRepository }) {
  const { t } = useTranslation()
  const defaultRepo = useMemo(() => new DexieProgressRepository(), [])
  const repo = repoProp ?? defaultRepo
  const [searchParams, setSearchParams] = useSearchParams()
  const titleFilter = searchParams.get('title')
  const [titles, setTitles] = useState<QuoteTitle[] | null>(null)
  const [vocab, setVocab] = useState<Vocab | null>(null)
  const [onlyUnderstood, setOnlyUnderstood] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const [loadedTitles, notes, cardsList, top1000] = await Promise.all([
          loadQuoteTitles(),
          loadWordNotes(),
          repo.getAllCards(),
          loadTopNgslLemmas(),
        ])
        if (alive) {
          setTitles(loadedTitles)
          setVocab(buildVocab(notes, cardsList, top1000))
        }
      } catch {
        if (alive) setTitles([])
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cards = useMemo(() => {
    if (!titles || !vocab) return null
    return titles.map((title) => ({
      title,
      understood: title.quotes.filter((quote) => quoteUnderstanding(vocab, quote) >= 0.9).length,
    }))
  }, [titles, vocab])

  if (!cards) {
    return (
      <section className="panel">
        <p className="dim">{t('common.loading')}</p>
      </section>
    )
  }

  const selected = titleFilter ? cards.find(({ title }) => title.slug === titleFilter) : null

  // Выбран тайтл — список его цитат (specs/07 §2.1: /#/quotes?title=)
  if (selected) {
    return (
      <section className="panel">
        <h2 lang="en">{selected.title.title}</h2>
        <p className="dim">
          <a href="#/quotes">← {t('quotes.backToTitles')}</a>
        </p>
        <ul className="quotes-list">
          {selected.title.quotes.map((quote) => {
            const understood = quoteUnderstanding(vocab!, quote) >= 0.9
            return (
              <li key={quote.id}>
                <Link className="pb-card quotes-card" to={`/quotes/${quote.id}`}>
                  <span lang="en">{quote.text}</span>
                  <span className="dim">
                    {understood ? `✓ ${t('quotes.understoodShort')}` : ''}{' '}
                    {t('quotes.vocabCoverage', {
                      percent: Math.round((quote.auto_vocab?.top1000 ?? 0) * 100),
                    })}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    )
  }

  return (
    <section className="panel">
      <h2>{t('quotes.title')}</h2>
      <label className="quotes-filter">
        <input
          type="checkbox"
          checked={onlyUnderstood}
          onChange={(event) => setOnlyUnderstood(event.target.checked)}
        />
        {t('quotes.filterUnderstood')}
      </label>
      <ul className="quotes-list">
        {cards
          .filter(({ understood }) => !onlyUnderstood || understood > 0)
          .map(({ title, understood }) => (
            <li key={title.slug}>
              <button
                type="button"
                className="pb-card quotes-card"
                onClick={() => setSearchParams({ title: title.slug })}
              >
                <span className="quotes-card-title">{title.title}</span>
                <span className="dim">
                  {t('quotes.count', { count: title.quotes.length })} ·{' '}
                  {t('quotes.understoodCount', { count: understood })}
                </span>
              </button>
            </li>
          ))}
      </ul>
      {(cards.length === 0 ||
        (onlyUnderstood && cards.every(({ understood }) => understood === 0))) && (
        <p className="dim">{t('quotes.empty')}</p>
      )}
    </section>
  )
}

/* ========================= /#/quotes/:id — цитата ========================= */

interface QuoteScreenState {
  quote: QuoteItem
  vocab: Vocab
  understood: boolean
}

type Segment = { kind: 'word'; word: string; raw: string } | { kind: 'text'; raw: string }

function splitSegments(text: string): Segment[] {
  const segments: Segment[] = []
  const re = /[A-Za-z][A-Za-z'-]*/g
  let last = 0
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0
    if (start > last) segments.push({ kind: 'text', raw: text.slice(last, start) })
    const lower = match[0].toLowerCase()
    // притяжательное 's срезается — как в quoteWords (знание слова по лемме)
    const word = lower.endsWith("'s") ? lower.slice(0, -2) : lower
    segments.push({ kind: 'word', word, raw: match[0] })
    last = start + match[0].length
  }
  if (last < text.length) segments.push({ kind: 'text', raw: text.slice(last) })
  return segments
}

export function QuoteScreen({ repo: repoProp }: { repo?: ProgressRepository }) {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const defaultRepo = useMemo(() => new DexieProgressRepository(), [])
  const repo = repoProp ?? defaultRepo
  const [state, setState] = useState<QuoteScreenState | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [showRu, setShowRu] = useState(false)
  const [popover, setPopover] = useState<string | null>(null)
  const [cloze, setCloze] = useState<{
    word: string
    value: string
    result: CheckResult | null
  } | null>(null)

  useEffect(() => {
    let alive = true
    // смена :id сбрасывает прошлое состояние (404/цитата) — ревью M11 м1;
    // сброс синхронно в эффекте — осознанный ресет по смене параметра роутера
    /* eslint-disable react-hooks/set-state-in-effect -- ресет состояния при смене :id (ревью M11 м1) */
    setNotFound(false)
    setState(null)
    setPopover(null)
    setCloze(null)
    /* eslint-enable react-hooks/set-state-in-effect */
    void (async () => {
      try {
        const quote = await findQuote(params.id ?? '')
        if (!quote) {
          if (alive) setNotFound(true)
          return
        }
        const [notes, cards, understood, top1000] = await Promise.all([
          loadWordNotes(),
          repo.getAllCards(),
          repo.getQuoteMark(quote.id),
          loadTopNgslLemmas(),
        ])
        if (alive) setState({ quote, vocab: buildVocab(notes, cards, top1000), understood })
      } catch {
        if (alive) setNotFound(true)
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  // R/S — озвучка обычная/медленная (specs/07 §5.1), пока фокус не в поле ввода
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      const key = event.key.toLowerCase()
      if (key === 'r') speak(state?.quote.text ?? '')
      else if (key === 's') speak(state?.quote.text ?? '', { rate: 0.75 })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state?.quote.text])

  // уход с экрана останавливает озвучку
  useEffect(() => stopSpeak, [])

  const startCloze = useCallback(() => {
    /* istanbul ignore next @preserve — защитный гард: кнопка cloze рендерится только при state */
    if (!state) return
    const words = quoteWords(state.quote.text)
    // кандидат — слово из топ-1000 NGSL (решение M11#4), фолбэк — любое из датасета;
    // ответ — сам токен цитаты (без притяжательного 's)
    const inDataset = (word: string) => lookupStems(state.vocab, word) !== null
    const candidate =
      words.find((word) => {
        const lemma = lookupStems(state.vocab, word)
        return lemma !== null && state.vocab.top1000.has(lemma)
      }) ?? words.find(inDataset)
    /* istanbul ignore next @preserve — защитный гард: canCloze гарантирует кандидата (canCloze в disabled) */
    if (!candidate) return
    const answer = candidate.endsWith("'s") ? candidate.slice(0, -2) : candidate
    setCloze({ word: answer, value: '', result: null })
  }, [state])

  if (notFound) {
    return (
      <section className="panel">
        <h2>{t('notFound.title')}</h2>
        <p className="dim">{t('quotes.notFound')}</p>
      </section>
    )
  }
  if (!state) {
    return (
      <section className="panel">
        <p className="dim">{t('common.loading')}</p>
      </section>
    )
  }

  const { quote, vocab } = state
  const segments = splitSegments(quote.text)
  // лемма по токену через стем-кандидатов (формы: dreams → dream — ревью M11 М4)
  const popoverLemma = popover ? lookupStems(vocab, popover) : null
  const popoverNotes = popoverLemma ? (vocab.byWord.get(popoverLemma) ?? []) : []
  const inDeck = popoverNotes.some((note) => vocab.states.has(note.id))

  const addToDeck = async () => {
    /* istanbul ignore next @preserve — защитный гард: кнопка «В колоду» рендерится только при заметках */
    if (popoverNotes.length === 0) return
    await repo.ensureCards(createFirstCards(popoverNotes, new Date()))
    const nextVocab: Vocab = {
      ...vocab,
      states: new Map(vocab.states),
    }
    for (const note of popoverNotes)
      if (!nextVocab.states.has(note.id)) nextVocab.states.set(note.id, 0)
    setState((prev) => (prev ? { ...prev, vocab: nextVocab } : prev))
    setPopover(null)
    showToast(t('quotes.addedToDeck', { count: popoverNotes.length }))
  }

  const markUnderstood = async () => {
    const next = !state.understood
    await repo.putQuoteMark(quote.id, next)
    setState((prev) => (prev ? { ...prev, understood: next } : prev))
  }

  return (
    <section className="panel lesson-panel">
      <header className="lesson-head">
        <h2 lang="en">{quote.title}</h2>
        <p className="dim">
          {quote.speaker ?? ''}
          {quote.season_episode ? ` · ${quote.season_episode}` : ''}
        </p>
      </header>

      <p className="quote-text" lang="en">
        {segments.map((segment, index) =>
          segment.kind === 'text' ? (
            <span key={index}>{segment.raw}</span>
          ) : (
            <button
              key={index}
              type="button"
              className={`quote-word quote-word-${wordKnowledge(vocab, segment.word)}`}
              onClick={() => setPopover(popover === segment.word ? null : segment.word)}
            >
              {segment.raw}
            </button>
          ),
        )}
      </p>

      {popover && (
        <div className="quote-popover" role="dialog" aria-label={popover}>
          <p lang="en">{popover}</p>
          {popoverNotes.length > 0 ? (
            <ul>
              {popoverNotes.map((note) => (
                <li key={note.id}>
                  <span className="dim">{note.entityId.split('-').pop()}</span> — {note.ru}
                </li>
              ))}
            </ul>
          ) : (
            <p className="dim">{t('quotes.noTranslation')}</p>
          )}
          <div className="lesson-actions">
            {popoverNotes.length > 0 &&
              (inDeck ? (
                <span className="dim">{t('quotes.alreadyInDeck')}</span>
              ) : (
                <button
                  type="button"
                  className="srs-btn srs-btn-good"
                  onClick={() => void addToDeck()}
                >
                  {t('quotes.toDeck')}
                </button>
              ))}
            <button type="button" className="srs-btn" onClick={() => setPopover(null)}>
              {t('quotes.close')}
            </button>
          </div>
        </div>
      )}

      <div className="lesson-audio" aria-label={t('srs.audioLabel')}>
        <button type="button" className="srs-btn" onClick={() => speak(quote.text)}>
          🔊 <kbd>R</kbd>
        </button>
        <button type="button" className="srs-btn" onClick={() => speak(quote.text, { rate: 0.75 })}>
          🐢 <kbd>S</kbd>
        </button>
      </div>

      <div className="lesson-actions">
        <button type="button" className="srs-btn" onClick={() => setShowRu((prev) => !prev)}>
          {showRu ? t('quotes.hideRu') : t('quotes.showRu')}
        </button>
        {quote.link_playphrase && (
          <a className="srs-btn" href={quote.link_playphrase} target="_blank" rel="noreferrer">
            {t('quotes.playphrase')}
          </a>
        )}
        <button
          type="button"
          className="srs-btn"
          onClick={startCloze}
          disabled={!cloze && !canCloze(vocab, quote)}
        >
          {t('quotes.cloze')}
        </button>
        <button
          type="button"
          className={`srs-btn ${state.understood ? 'srs-btn-good' : ''}`}
          onClick={() => void markUnderstood()}
        >
          {state.understood ? `✓ ${t('quotes.understood')}` : t('quotes.markUnderstood')}
        </button>
      </div>

      {showRu && (
        <p className="dim" lang="ru">
          {quote.translation_ru}
        </p>
      )}

      {cloze && (
        <form
          className="lesson-exercise"
          onSubmit={(event) => {
            event.preventDefault()
            /* istanbul ignore next @preserve — защитный гард: форма рендерится только при cloze */
            if (!cloze) return
            if (cloze.result) {
              setCloze(null)
              return
            }
            if (!cloze.value.trim()) return
            const result = judge(cloze.value, { accepted: [cloze.word] })
            setCloze({ ...cloze, result })
          }}
        >
          <p className="lesson-prompt">
            {t('quotes.clozePrompt')}{' '}
            <span className="lesson-ref" lang="en">
              {maskedText(quote.text, cloze.word)}
            </span>
          </p>
          {!cloze.result && (
            <div className="lesson-input-row">
              <input
                className="lesson-input"
                lang="en"
                autoFocus
                value={cloze.value}
                onChange={(event) => setCloze({ ...cloze, value: event.target.value })}
              />
              <button type="submit" className="srs-btn srs-btn-good" disabled={!cloze.value.trim()}>
                {t('lesson.check')}
              </button>
            </div>
          )}
          {cloze.result && (
            <FeedbackPlate result={cloze.result} showReference={false} phrase={null} />
          )}
          {cloze.result && (
            <div className="lesson-actions">
              <button type="submit" className="srs-btn">
                {t('lesson.next')}
              </button>
            </div>
          )}
        </form>
      )}

      <p className="dim">
        <Link to="/quotes">← {t('quotes.back')}</Link>
      </p>
    </section>
  )
}

function canCloze(vocab: Vocab, quote: QuoteItem): boolean {
  return quoteWords(quote.text).some((word) => vocab.byWord.has(word))
}

function maskedText(text: string, word: string): string {
  return text.replace(
    new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
    '___',
  )
}

export default QuotesScreen
