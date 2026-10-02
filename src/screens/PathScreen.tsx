// Implements: plan://onboarding#O.5 — «Путь обучения» /#/path (specs/07 §2.2):
// ранги → уроки со статусами цепочки, «ты здесь», запуск урока.
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { loadLessons, type LessonItem } from '../content/lessons'
import type { ProgressRepository } from '../domain/progress'
import { DexieProgressRepository } from '../data/progress-repository'
import { RANK_CEFR } from '../domain/game/game'
import type { StoredLessonStatus } from '../domain/lesson/types'

type RowStatus = StoredLessonStatus | 'locked' | 'available'

export interface PathRow {
  lesson: LessonItem
  status: RowStatus
  current: boolean
}

/** Статусы цепочкой: пройден только completed/review_due (isLessonPassed, specs/02 §5). */
export function buildPathRows(
  lessons: readonly LessonItem[],
  rows: readonly (import('../domain/lesson/types').LessonProgress | null)[],
): PathRow[] {
  let prevPassed = true // первый урок доступен всегда
  let currentTaken = false
  return lessons.map((lesson, i) => {
    const stored = rows[i]?.status ?? null
    const passed = stored === 'completed' || stored === 'review_due'
    const status: RowStatus = stored ?? (prevPassed ? 'available' : 'locked')
    const current = !currentTaken && !passed && status !== 'locked'
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
      const progress = await repo.getManyLessonProgress(lessons.map((lesson) => lesson.id))
      if (!alive) return
      setRows(buildPathRows(lessons, progress))
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
                const label = `${STATUS_ICON[row.status]} ${row.lesson.title}${
                  row.current ? ` · ${t('path.youAreHere')}` : ''
                }`
                return (
                  <li key={row.lesson.id} className="lesson-path-row">
                    {row.status === 'locked' ? (
                      <span className="dim" aria-label={t('path.status.locked')}>
                        {label}
                      </span>
                    ) : (
                      <a href={href} aria-label={t(`path.status.${row.status}`)}>
                        {label}
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
