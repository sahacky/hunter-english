// Implements: plan://curriculum-review#I.2 — экран input-трека /#/listen:
// эфир ДНЯ (V6, фидбей 2026-10-08): понятые цитаты (top1000 ≥ 0.8) + фразы
// начатых уроков, дневной сид-шаффл — каждый день новый состав (было: один
// статичный список цитат). «Играть всё», счётчик минут, ручная отметка
// «послушал вне приложения»; минуты считаются шлюзом озвучки (tts sink).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildDailyTracks, type ListenTrack } from '../data/listening'
import { speak, stopSpeak, currentAudio } from '../lib/tts'
import { dayStart } from '../domain/srs/scheduler'
import { createQuestDay, LISTENING_TARGET_SEC } from '../domain/game/game'
import { addManualListeningSeconds, questWithListening } from '../data/listening'
import type { ProgressRepository } from '../domain/progress'
import { DexieProgressRepository } from '../data/progress-repository'

interface ListenProps {
  repo?: ProgressRepository
}

export default function ListenScreen({ repo: repoProp }: ListenProps) {
  const { t } = useTranslation()
  const defaultRepo = useMemo(() => new DexieProgressRepository(), [])
  const repo = repoProp ?? defaultRepo
  const [tracks, setTracks] = useState<ListenTrack[] | null>(null)
  const [error, setError] = useState(false)
  const [secondsToday, setSecondsToday] = useState(0)
  const [manualSec, setManualSec] = useState(0)
  const [playingAll, setPlayingAll] = useState(false)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const playAllRef = useRef(false)

  const refresh = async () => {
    const dayIso = dayStart(new Date()).toISOString()
    const existing = await repo.getQuestDay(dayIso)
    const row = questWithListening(existing ?? createQuestDay(dayIso, 0))
    setSecondsToday(row.slots.listening.done)
    setManualSec(row.slots.listening.manual ?? 0)
  }

  useEffect(() => {
    let alive = true
    void (async () => {
      const playlist = await buildDailyTracks(repo)
      if (!alive) return
      setTracks(playlist)
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

  const play = (track: ListenTrack, rate = 1) => {
    setCurrentId(track.id)
    speak(track.text, { src: track.audio, rate })
  }

  /** Последовательное воспроизведение плейлиста по кругу, до «Стоп». */
  const playAll = async (list: ListenTrack[]) => {
    /* istanbul ignore next @preserve — кнопка «Играть всё» disabled при пустом списке: guard недостижим через UI */
    if (list.length === 0) return
    setPlayingAll(true)
    playAllRef.current = true
    let index = 0
    const audio = () => {
      /* istanbul ignore next @preserve — кнопка «Играть всё» скрыта на время Стопа: ref всегда true при входе */
      if (!playAllRef.current) return
      const track = list[index % list.length]!
      play(track)
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
        setCurrentId(track.id)
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

  const markOutside = async (minutes: number) => {
    await addManualListeningSeconds(repo, minutes * 60)
    await refresh()
  }

  if (error) {
    return (
      <section className="panel">
        <p className="srs-error">{t('dashboard.error')}</p>
      </section>
    )
  }
  if (!tracks) {
    return (
      <section className="panel">
        <p className="dim">{t('common.loading')}</p>
      </section>
    )
  }
  const minutes = Math.floor(secondsToday / 60)
  const manualMin = Math.floor(manualSec / 60)
  const targetMin = LISTENING_TARGET_SEC / 60
  return (
    <section className="panel lesson-panel">
      <header className="lesson-head">
        <h2>{t('listen.title')}</h2>
        <p className="dim">
          {t('listen.counter', { minutes, target: targetMin })} ·{' '}
          {t('listen.total', { count: tracks.length })} · {t('listen.dailyHint')}
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
            disabled={tracks.length === 0}
            onClick={() => void playAll(tracks)}
          >
            ▶ {t('listen.playAll')}
          </button>
        )}
      </div>
      {/* U3.1: ручные минуты — ввод с корректировкой (передобавил — убери минусом) */}
      <div className="lesson-actions listen-manual">
        <span className="dim">{t('listen.outside')}</span>
        <button type="button" className="srs-btn" onClick={() => void markOutside(-5)}>
          −5
        </button>
        <button type="button" className="srs-btn" onClick={() => void markOutside(5)}>
          +5
        </button>
        <button type="button" className="srs-btn" onClick={() => void markOutside(20)}>
          +20
        </button>
        {manualMin > 0 && (
          <button type="button" className="srs-btn" onClick={() => void markOutside(-manualMin)}>
            {t('listen.resetManual', { minutes: manualMin })}
          </button>
        )}
      </div>
      <ul className="listen-list">
        {tracks.map((track) => (
          <li
            key={track.id}
            className={`listen-row${currentId === track.id ? ' listen-row-current' : ''}`}
          >
            <div className="listen-text">
              <p lang="en">«{track.text}»</p>
              <p className="dim" lang="ru">
                {track.translationRu} — {track.source}
              </p>
            </div>
            <div className="listen-actions">
              {track.link && (
                <a
                  className="srs-btn"
                  href={track.link}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t('listen.video')}
                  title={t('listen.video')}
                >
                  🎬
                </a>
              )}
              <button type="button" className="srs-btn" onClick={() => play(track)}>
                🔊
              </button>
              <button type="button" className="srs-btn" onClick={() => play(track, 0.75)}>
                🐢
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
