// Implements: plan://curriculum-review#I.2 — экран input-трека /#/listen:
// подборка «понятых» цитат (auto_vocab.top1000 ≥ 0.9 — тот же фильтр, что у
// цитаты дня) как плейлист с «Играть всё», счётчик минут дня и ручная отметка
// «послушал вне приложения». Минуты считаются шлюзом озвучки (tts sink).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { loadQuotes, type QuoteItem } from '../content/lessons'
import { speak, stopSpeak, currentAudio } from '../lib/tts'
import { dayStart } from '../domain/srs/scheduler'
import { createQuestDay, LISTENING_TARGET_SEC } from '../domain/game/game'
import { addListeningSeconds, questWithListening } from '../data/listening'
import type { ProgressRepository } from '../domain/progress'
import { DexieProgressRepository } from '../data/progress-repository'

/** Понятые цитаты — по покрытию топ-1000 NGSL (как «цитата дня» на дашборде). */
function understoodQuotes(quotes: readonly QuoteItem[]): QuoteItem[] {
  return quotes.filter((quote) => (quote.auto_vocab?.top1000 ?? 0) >= 0.9)
}

interface ListenProps {
  repo?: ProgressRepository
}

export default function ListenScreen({ repo: repoProp }: ListenProps) {
  const { t } = useTranslation()
  const defaultRepo = useMemo(() => new DexieProgressRepository(), [])
  const repo = repoProp ?? defaultRepo
  const [quotes, setQuotes] = useState<QuoteItem[] | null>(null)
  const [error, setError] = useState(false)
  const [secondsToday, setSecondsToday] = useState(0)
  const [playingAll, setPlayingAll] = useState(false)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const playAllRef = useRef(false)

  const refresh = async () => {
    const dayIso = dayStart(new Date()).toISOString()
    const existing = await repo.getQuestDay(dayIso)
    const row = questWithListening(existing ?? createQuestDay(dayIso, 0))
    setSecondsToday(row.slots.listening.done)
  }

  useEffect(() => {
    let alive = true
    void (async () => {
      const quotes = understoodQuotes(await loadQuotes())
      if (!alive) return
      setQuotes(quotes)
      await refresh()
    })().catch(() => {
      if (alive) setError(true)
    })
    // счётчик подтягивается при каждом возвращении на экран
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      window.removeEventListener('focus', onFocus)
      playAllRef.current = false
      stopSpeak()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const play = (quote: QuoteItem, rate = 1) => {
    setCurrentId(quote.id)
    speak(quote.text, { src: quote.audio?.en_gb, rate })
  }

  /** Последовательное воспроизведение плейлиста по кругу, до «Стоп». */
  const playAll = async (list: QuoteItem[]) => {
    /* istanbul ignore next @preserve — кнопка «Играть всё» disabled при пустом списке: guard недостижим через UI */
    if (list.length === 0) return
    setPlayingAll(true)
    playAllRef.current = true
    let index = 0
    const audio = () => {
      /* istanbul ignore next @preserve — кнопка «Играть всё» скрыта на время Стопа: ref всегда true при входе */
      if (!playAllRef.current) return
      const quote = list[index % list.length]!
      play(quote)
      const el = currentAudio()
      if (el) {
        el.addEventListener(
          'ended',
          () => {
            if (!playAllRef.current) return
            index += 1
            void audio()
          },
          { once: true },
        )
      } else {
        // фолбэк TTS без audio-элемента: автоперехода нет — играем текущий
        setCurrentId(quote.id)
      }
    }
    audio()
  }

  const stopAll = () => {
    playAllRef.current = false
    setPlayingAll(false)
    setCurrentId(null)
    stopSpeak()
  }

  const markOutside = async () => {
    await addListeningSeconds(repo, LISTENING_TARGET_SEC)
    await refresh()
  }

  if (error) {
    return (
      <section className="panel">
        <p className="srs-error">{t('dashboard.error')}</p>
      </section>
    )
  }
  if (!quotes) {
    return (
      <section className="panel">
        <p className="dim">{t('common.loading')}</p>
      </section>
    )
  }
  const minutes = Math.floor(secondsToday / 60)
  const targetMin = LISTENING_TARGET_SEC / 60
  return (
    <section className="panel lesson-panel">
      <header className="lesson-head">
        <h2>{t('listen.title')}</h2>
        <p className="dim">
          {t('listen.counter', { minutes, target: targetMin })} ·{' '}
          {t('listen.total', { count: quotes.length })}
        </p>
      </header>
      <div className="lesson-actions">
        {playingAll ? (
          <button type="button" className="srs-btn" onClick={stopAll}>
            ⏹ {t('listen.stopAll')}
          </button>
        ) : (
          <button
            type="button"
            className="srs-btn srs-btn-good"
            disabled={quotes.length === 0}
            onClick={() => void playAll(quotes)}
          >
            ▶ {t('listen.playAll')}
          </button>
        )}
        <button type="button" className="srs-btn" onClick={() => void markOutside()}>
          {t('listen.markOutside', { minutes: targetMin })}
        </button>
      </div>
      <ul className="listen-list">
        {quotes.map((quote) => (
          <li
            key={quote.id}
            className={`listen-row${currentId === quote.id ? ' listen-row-current' : ''}`}
          >
            <div className="listen-text">
              <p lang="en">«{quote.text}»</p>
              <p className="dim" lang="ru">
                {quote.translation_ru} — {quote.title}
              </p>
            </div>
            <div className="listen-actions">
              <button type="button" className="srs-btn" onClick={() => play(quote)}>
                🔊
              </button>
              <button type="button" className="srs-btn" onClick={() => play(quote, 0.75)}>
                🐢
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
