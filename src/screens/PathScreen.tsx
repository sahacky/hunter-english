// Implements: plan://onboarding#O.5, plan://curriculum-review#P.2 — «Путь обучения»
// /#/path (specs/07 §2.2): ранги → уроки со статусами цепочки, «ты здесь»,
// запуск урока. При старте «с первого урока ранга» уроки ниже ранга доступны
// (не зачтены) — ранг в user_stats разблокирует их отображение.
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { loadLessons, type LessonItem } from '../content/lessons'
import type { ProgressRepository } from '../domain/progress'
import { DexieProgressRepository } from '../data/progress-repository'
import { RANK_CEFR } from '../domain/game/game'
import { RANK_INDEX } from '../domain/placement/apply'
import type { StoredLessonStatus } from '../domain/lesson/types'

type RowStatus = StoredLessonStatus | 'locked' | 'available'

export interface PathRow {
  lesson: LessonItem
  status: RowStatus
  current: boolean
}

/**
 * Статусы цепочкой: пройден только completed/review_due (isLessonPassed, specs/02 §5).
 * startAtRank: уроки ниже ранга и первый урок ранга доступны без прохождения
 * цепочки (режим «начать с первого урока ранга», P.2); «ты здесь» — на полосе
 * ранга и выше, нижние остаются фоновыми.
 */
export function buildPathRows(
  lessons: readonly LessonItem[],
  rows: readonly (import('../domain/lesson/types').LessonProgress | null)[],
  opts: { startAtRank?: LessonItem['rank'] } = {},
): PathRow[] {
  const startIdx = opts.startAtRank ? RANK_INDEX[opts.startAtRank] : -1
  const firstOfStart =
    startIdx >= 0 ? lessons.find((lesson) => lesson.rank === opts.startAtRank) : undefined
  let prevPassed = true // первый урок доступен всегда
  let currentTaken = false
  return lessons.map((lesson, i) => {
    const stored = rows[i]?.status ?? null
    const passed = stored === 'completed' || stored === 'review_due'
    const unlockedByStart =
      startIdx >= 0 &&
      (RANK_INDEX[lesson.rank] < startIdx ||
        (lesson.rank === opts.startAtRank && lesson.id === firstOfStart?.id))
    const status: RowStatus = stored ?? (prevPassed || unlockedByStart ? 'available' : 'locked')
    const belowStart = startIdx >= 0 && RANK_INDEX[lesson.rank] < startIdx
    const current = !currentTaken && !passed && status !== 'locked' && !belowStart
    if (current) currentTaken = true
    prevPassed = passed
    return { lesson, status, current }
  })
}

const STATUS_ICON: Record<RowStatus, string> = {
  locked: '🔒',
  available: '▸',
  in_progress: '◐',
  completed: '✓',
  review_due: '↻',
}

export default function PathScreen({ repo: repoProp }: { repo?: ProgressRepository }) {
  const { t } = useTranslation()
  const defaultRepo = useMemo(() => new DexieProgressRepository(), [])
  const repo = repoProp ?? defaultRepo
  const [rows, setRows] = useState<PathRow[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      const lessons = await loadLessons()
      const [progress, stats] = await Promise.all([
        repo.getManyLessonProgress(lessons.map((lesson) => lesson.id)),
        repo.getStats(),
      ])
      if (!alive) return
      setRows(buildPathRows(lessons, progress, { startAtRank: stats.rank }))
    })().catch(() => {
      if (alive) setError(true)
    })
    return () => {
      alive = false
    }
  }, [repo])

  if (error) {
    return (
      <section className="panel">
        <h2>{t('dashboard.error')}</h2>
      </section>
    )
  }
  if (!rows) {
    return (
      <section className="panel">
        <p className="dim">{t('common.loading')}</p>
      </section>
    )
  }

  const ranks = ['E', 'D', 'C', 'B', 'A', 'S'] as const
  return (
    <section className="panel">
      <h2>{t('path.title')}</h2>
      {ranks.map((rank) => {
        const rankRows = rows.filter((row) => row.lesson.rank === rank)
        /* istanbul ignore next @preserve — контент содержит все ранги E–S; защита от пустого файла данных */
        if (rankRows.length === 0) return null
        const done = rankRows.filter(
          (row) => row.status === 'completed' || row.status === 'review_due',
        ).length
        return (
          <section key={rank} className="pb-vocab-topic">
            <h3>
              {t('path.rankHeader', { rank, cefr: RANK_CEFR[rank], done, total: rankRows.length })}
            </h3>
            <ul className="lesson-path">
              {rankRows.map((row) => {
                const href = `#/lesson/${row.lesson.id.replace(/^les-/, '').toUpperCase()}`
                const icon = row.current ? '▶' : STATUS_ICON[row.status]
                return (
                  <li
                    key={row.lesson.id}
                    className={[
                      'lesson-path-row',
                      row.status === 'completed' || row.status === 'review_due'
                        ? 'lesson-path-done'
                        : '',
                      row.current ? 'lesson-path-current' : '',
                      row.status === 'locked' ? 'lesson-path-locked' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {row.status === 'locked' ? (
                      <span className="dim" aria-label={t('path.status.locked')}>
                        <span className="path-num" aria-hidden="true">
                          {icon}
                        </span>
                        <span className="path-name">
                          {row.lesson.title}
                          <span className="path-meta">{t('path.status.locked')}</span>
                        </span>
                      </span>
                    ) : (
                      <a href={href} aria-label={t(`path.status.${row.status}`)}>
                        <span className="path-num" aria-hidden="true">
                          {icon}
                        </span>
                        <span className="path-name">
                          {row.lesson.title}
                          {row.current && (
                            <span className="path-meta"> · {t('path.youAreHere')}</span>
                          )}
                        </span>
                        <span className="path-go" aria-hidden="true">
                          →
                        </span>
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </section>
  )
}
