// Implements: plan://M7#7.4 — дашборд «Охотник» /#/ (specs/07 §2.1, specs/04 §5–§6).
// Окна Системы: ежедневный квест, статус, «Начать день», цитата дня.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { dayStart } from '../domain/srs/scheduler'
import { levelInfo, RANK_CEFR } from '../domain/game/game'
import { createQuestDay } from '../domain/game/game'
import type { QuestDayState, UserStats } from '../domain/game/types'
import type { LessonItem, QuoteItem } from '../content/lessons'
import { loadLessons, loadQuotes } from '../content/lessons'
import { createFirstCards, loadWordNotes } from '../content/words'
import { XpDots } from '../components/XpDots'
import { RANK_INDEX } from '../domain/placement/apply'
import { getPlacementInfo, type PlacementInfo } from '../data/onboarding'
import { downloadProgressExport } from '../data/export'
import { showToast } from '../lib/toast'
import type { ProgressRepository } from '../domain/progress'
import { DexieProgressRepository } from '../data/progress-repository'
import { isOnboarded } from '../data/onboarding'

interface DashboardProps {
  repo?: ProgressRepository
}

interface DashboardData {
  onboarded: boolean
  stats: UserStats
  quest: QuestDayState
  dueToday: number
  knownCards: number
  nextLesson: LessonItem | null
  quote: QuoteItem | null
  placement: PlacementInfo | null
  /** Первый урок ранга из placement — пока он «следующий», дашборд объясняет выбор. */
  firstPlacementLesson: LessonItem | null
}

function pickQuoteOfTheDay(quotes: QuoteItem[], studyDayIso: string): QuoteItem | null {
  const ready = quotes.filter((quote) => (quote.auto_vocab?.top1000 ?? 0) >= 0.9)
  if (ready.length === 0) return null
  let hash = 0
  for (const ch of studyDayIso) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return ready[Math.abs(hash) % ready.length]
}

/** Время до следующей границы учебного дня (4:00) в «чч:мм». */
export function timeToDayBoundary(now: Date): string {
  const boundary = dayStart(new Date(now.getTime() + 86_400_000))
  const diff = Math.max(0, boundary.getTime() - now.getTime())
  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  return `${hours}:${String(minutes).padStart(2, '0')}`
}

export default function Dashboard({ repo: repoProp }: DashboardProps) {
  const { t } = useTranslation()
  const defaultRepo = useMemo(() => new DexieProgressRepository(), [])
  const repo = repoProp ?? defaultRepo
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [timer, setTimer] = useState(() => timeToDayBoundary(new Date()))

  // plan://ux-feedback-2#U.2 — быстрое сохранение прогресса файлом, не заходя в настройки
  const saveProgress = useCallback(async () => {
    /* istanbul ignore next @preserve — защита от повторного входа: кнопка disabled на время saveBusy, через UI недостижимо */
    if (saveBusy) return
    setSaveBusy(true)
    try {
      await downloadProgressExport()
      showToast(t('dashboard.saveDone'))
    } catch {
      showToast(t('dashboard.saveFailed'))
    } finally {
      setSaveBusy(false)
    }
  }, [saveBusy, t])

  useEffect(() => {
    let alive = true
    async function load() {
      const now = new Date()
      const dayIso = dayStart(now).toISOString()
      const [stats, questRow, lessons, quotes, wordNotes] = await Promise.all([
        repo.getStats(),
        repo.getQuestDay(dayIso),
        loadLessons(),
        loadQuotes(),
        loadWordNotes(),
      ])
      const onboarded = await isOnboarded()
      if (!alive) return
      // карточки материализуются при первом заходе (как в /#/srs — M4)
      await repo.ensureCards(createFirstCards(wordNotes, now))
      const cards = await repo.getAllCards()
      const dueToday = cards.filter(
        (card) => card.state !== 0 && new Date(card.due).getTime() <= now.getTime(),
      ).length
      let quest = questRow
      if (!quest) {
        quest = createQuestDay(dayIso, dueToday)
        await repo.putQuestDay(quest)
      }
      let nextLesson: LessonItem | null = null
      // старт с ранга (P.2): уроки ниже ранга не «следующие» — они доступны в
      // Программе, но ведут пользователя с полосы placement-ранга
      const statsRank = RANK_INDEX[stats.rank]
      for (const lesson of lessons) {
        if (RANK_INDEX[lesson.rank] < statsRank) continue
        const row = await repo.getLessonProgress(lesson.id)
        if (!row || row.status !== 'completed') {
          nextLesson = lesson
          break
        }
      }
      const placement = await getPlacementInfo()
      if (!alive) return
      setData({
        onboarded,
        stats,
        quest,
        dueToday,
        knownCards: cards.filter((card) => card.state === 2).length,
        nextLesson,
        quote: pickQuoteOfTheDay(quotes, dayIso),
        placement,
        firstPlacementLesson: placement
          ? (lessons.find((lesson) => lesson.rank === placement.rank) ?? null)
          : null,
      })
    }
    void load().catch(() => {
      if (alive) setError(true)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setTimer(timeToDayBoundary(new Date())), 60_000)
    return () => clearInterval(interval)
  }, [])

  const startDayHref = useCallback(() => {
    /* istanbul ignore start — защита: Link рендерится только после загрузки data (data гарантированно не null), ветка недостижима; прагма start/stop — рабочий формат инструментария vitest+istanbul (ignore next в пайплайне не учитывается) */
    if (!data) return '/srs'
    /* istanbul ignore stop */
    return data.dueToday > 0
      ? '/srs'
      : data.nextLesson
        ? `/lesson/${data.nextLesson.id.replace(/^les-/, '').toUpperCase()}`
        : '/srs'
  }, [data])

  if (error) {
    return (
      <section className="panel">
        <p className="srs-error">{t('dashboard.error')}</p>
      </section>
    )
  }
  if (data && !data.onboarded) {
    // первый вход — знакомство и оценка ранга (plan://ux-feedback-2#U.3 → welcome)
    return <Navigate to="/intro" replace />
  }
  if (!data) {
    return (
      <section className="panel">
        <p className="dim">{t('common.loading')}</p>
      </section>
    )
  }

  const level = levelInfo(data.stats.xp) // уровни считаем от общего XP (ранг E — старт)
  const slots = [
    {
      label: t('dashboard.quests.reviews'),
      done: data.quest.slots.reviews.done,
      target: data.quest.slots.reviews.target,
    },
    {
      label: t('dashboard.quests.lesson'),
      done: data.quest.slots.lesson.done,
      target: data.quest.slots.lesson.target,
    },
    {
      label: t('dashboard.quests.dictation'),
      done: data.quest.slots.dictation.done,
      target: data.quest.slots.dictation.target,
    },
  ]
  return (
    <div className="dashboard">
      <section className="panel dash-quest">
        <h2>{t('dashboard.questTitle')}</h2>
        <ul className="dash-quest-list">
          {slots.map((slot) => (
            <li
              key={slot.label}
              className={slot.done >= slot.target ? 'dash-quest-done' : undefined}
            >
              <span aria-hidden="true">{slot.done >= slot.target ? '✓' : ''}</span> {slot.label}{' '}
              <span className="dim">
                {slot.done}/{slot.target}
              </span>
            </li>
          ))}
          <li>
            {t('dashboard.quests.bonus')}: {t(`dashboard.bonus.${data.quest.bonus.id}`)}{' '}
            <span className="dim">
              {data.quest.bonusDone}/{data.quest.bonus.target}
            </span>
          </li>
        </ul>
        <p className="dim">
          ⏱ {t('dashboard.dayLeft')} {timer}
        </p>
      </section>

      <section className="panel dash-status">
        <h2>{t('dashboard.statusTitle')}</h2>
        <div className="dash-status-grid">
          <div
            className="dash-ring"
            aria-hidden="true"
            style={{
              background: `conic-gradient(var(--primary) 0 ${Math.round(level.progress * 100)}%, var(--track) ${Math.round(level.progress * 100)}% 100%)`,
            }}
          >
            <b>
              {data.stats.rank}
              <small>{RANK_CEFR[data.stats.rank]}</small>
            </b>
          </div>
          <div className="dash-status-main">
            <p>
              {t('dashboard.rankAndLevel', {
                rank: data.stats.rank,
                cefr: RANK_CEFR[data.stats.rank],
                level: level.level,
              })}
            </p>
            <XpDots percent={Math.round(level.progress * 100)} />
            <p className="dim">
              {t('dashboard.xpProgress', { xp: level.rankXp, next: level.nextAt })}
            </p>
            <div>
              <span className="dash-chip">
                🔥 {t('dashboard.streak', { days: data.stats.streak_current })}
              </span>
              <span className="dash-chip dash-chip-warm">
                ❄ {t('dashboard.freezes', { count: data.stats.freezes_left })}
              </span>
              <span className="dash-chip">
                {t('dashboard.wordsKnown', { count: data.knownCards })}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="panel dash-start">
        <Link className="srs-btn srs-btn-good dash-start-btn" to={startDayHref()}>
          ▶{' '}
          {data.dueToday > 0
            ? t('dashboard.startReviews', { count: data.dueToday })
            : t('dashboard.startLesson')}
        </Link>
        {data.nextLesson && (
          <p className="dim">
            {t('dashboard.nextLesson')}: {data.nextLesson.id.replace(/^les-/, '').toUpperCase()} ·{' '}
            {data.nextLesson.title}
          </p>
        )}
        {data.stats.xp === 0 && data.nextLesson?.id === 'les-e-01' && (
          <p className="dim">{t('dashboard.beginnerHint')}</p>
        )}
        {data.placement &&
          data.nextLesson &&
          data.nextLesson.id === data.firstPlacementLesson?.id &&
          data.nextLesson.id !== 'les-e-01' && (
            <p className="dim">
              {t(
                data.placement.mode === 'waive'
                  ? 'dashboard.placementWaive'
                  : 'dashboard.placementStart',
                { rank: data.placement.rank, cefr: RANK_CEFR[data.placement.rank] },
              )}
            </p>
          )}
        <p className="dim">
          <Link to="/path">→ {t('dashboard.programLink')}</Link>
        </p>
        <div className="lesson-actions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="srs-btn"
            disabled={saveBusy}
            onClick={() => void saveProgress()}
          >
            💾 {t('dashboard.saveProgress')}
          </button>
        </div>
        <p className="dim">{t('dashboard.saveProgressHint')}</p>
      </section>

      {data.quote && (
        <section className="panel dash-quote">
          <h2>{t('dashboard.quoteTitle')}</h2>
          <blockquote lang="en">«{data.quote.text}»</blockquote>
          <p className="dim" lang="ru">
            {data.quote.translation_ru} — {data.quote.title}
          </p>
        </section>
      )}
    </div>
  )
}
