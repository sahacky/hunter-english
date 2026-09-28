// Implements: plan://M7#7.5 — экран статуса охотника /#/ranks (specs/07 §2.1, specs/04 §2,§7)

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { levelInfo } from '../domain/game/game'
import type { UserStats } from '../domain/game/types'
import type { ProgressRepository } from '../domain/progress'
import { DexieProgressRepository } from '../data/progress-repository'

interface DashboardProps {
  repo?: ProgressRepository
}

/** Титулы-достижения: базовые условия на доступных счётчиках (решение M7#3). */
interface TitleDef {
  id: string
  quote: string
  source: string
  check: (stats: UserStats) => boolean
}

const TITLES: TitleDef[] = [
  {
    id: 'winter-is-coming',
    quote: 'Winter is coming',
    source: 'Game of Thrones',
    check: (s) => s.streak_best >= 7,
  },
  {
    id: 'equivalent-exchange',
    quote: 'Equivalent exchange',
    source: 'Fullmetal Alchemist',
    check: (s) => s.xp >= 1000,
  },
  {
    id: 'war-never-changes',
    quote: 'War never changes',
    source: 'Fallout',
    check: (s) => s.streak_best >= 30,
  },
  {
    id: 'valar-morghulis',
    quote: 'Valar morghulis',
    source: 'Game of Thrones',
    check: (s) => s.gates_history.some((g) => g.gate === 'C'),
  },
  {
    id: 'arise',
    quote: 'Arise',
    source: 'Solo Leveling',
    check: (s) => s.gates_history.length > 0,
  },
]

export default function RanksScreen({ repo: repoProp }: DashboardProps) {
  const { t } = useTranslation()
  const defaultRepo = useMemo(() => new DexieProgressRepository(), [])
  const repo = repoProp ?? defaultRepo
  const [stats, setStats] = useState<UserStats | null>(null)

  useEffect(() => {
    let alive = true
    void repo
      .getStats()
      .then((value) => {
        if (alive) setStats(value)
      })
      .catch(() => {
        if (alive) setStats(null)
      })
    return () => {
      alive = false
    }
  }, [repo])

  if (!stats) {
    return (
      <section className="panel">
        <p className="dim">{t('common.loading')}</p>
      </section>
    )
  }
  const level = levelInfo(stats.xp)
  return (
    <div className="ranks">
      <section className="panel">
        <h2>[{t('ranks.statusTitle')}]</h2>
        <p>{t('dashboard.rankAndLevel', { rank: stats.rank, level: level.level })}</p>
        <div
          className="dash-xp-bar"
          role="progressbar"
          aria-valuenow={Math.round(level.progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="dash-xp-fill" style={{ width: `${Math.round(level.progress * 100)}%` }} />
        </div>
        <p className="dim">{t('dashboard.xpProgress', { xp: level.rankXp, next: level.nextAt })}</p>
        <ul className="ranks-stats">
          <li>{t('ranks.totalXp', { xp: stats.xp })}</li>
          <li>{t('ranks.streaks', { current: stats.streak_current, best: stats.streak_best })}</li>
          <li>{t('dashboard.freezes', { count: stats.freezes_left })}</li>
          {stats.gates_history.length > 0 && (
            <li>
              {t('ranks.gatesPassed', {
                count: stats.gates_history.length,
                last: stats.gates_history.at(-1)?.gate ?? '',
              })}
            </li>
          )}
        </ul>
      </section>
      <section className="panel">
        <h2>[{t('ranks.titles')}]</h2>
        <ul className="ranks-titles">
          {TITLES.map((title) => {
            const unlocked = title.check(stats)
            return (
              <li key={title.id} className={unlocked ? 'ranks-title-unlocked' : 'dim'}>
                «{title.quote}» — {title.source}
                {unlocked ? ` · ${t('ranks.unlocked')}` : ''}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
