// Implements: plan://teaching-quality#cheat-sheet — свёрнутый блок «Шпаргалка
// пройденного» на /#/srs (решение 2026-10-04: вкладка «Повторение», без новой
// вкладки; показ в финале/паузе сессии и при пустой очереди). Загрузка ленивая —
// при первом раскрытии, бустрап SRS не тормозит.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { loadCheatSheet, type CheatGroup } from '../content/cheatsheet'
import type { ProgressRepository } from '../domain/progress'
import { DexieProgressRepository } from '../data/progress-repository'

type CheatState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; groups: CheatGroup[] }
  | { kind: 'error' }

export default function RulesCheatSheet({ repo: repoProp }: { repo?: ProgressRepository }) {
  const { t } = useTranslation()
  const [state, setState] = useState<CheatState>({ kind: 'idle' })

  // Ленивая загрузка при первом раскрытии; после ошибки повтор — следующим раскрытием
  const onToggle = (event: React.ToggleEvent<HTMLDetailsElement>) => {
    if (!event.currentTarget.open || state.kind === 'loading' || state.kind === 'ready') return
    setState({ kind: 'loading' })
    const repo = repoProp ?? new DexieProgressRepository()
    loadCheatSheet(repo)
      .then((groups) => setState({ kind: 'ready', groups }))
      .catch(() => setState({ kind: 'error' }))
  }

  return (
    <details className="srs-cheat" onToggle={onToggle}>
      <summary>📖 {t('srs.cheat.title')}</summary>
      {state.kind === 'loading' && <p className="dim">{t('srs.loading')}</p>}
      {state.kind === 'error' && <p className="srs-error">{t('srs.error')}</p>}
      {state.kind === 'ready' &&
        (state.groups.length === 0 ? (
          <p className="dim">{t('srs.cheat.empty')}</p>
        ) : (
          state.groups.map((group) => (
            <section key={group.rank} className="srs-cheat-rank">
              <h4>{t('srs.cheat.rank', { rank: group.rank })}</h4>
              <dl>
                {group.entries.map((entry) => (
                  <div key={entry.courseId} className="srs-cheat-entry">
                    <dt lang="ru">
                      {entry.courseId} · {entry.title}
                    </dt>
                    <dd lang="ru">{entry.summary}</dd>
                    {entry.trap && (
                      <dd className="srs-cheat-trap" lang="ru">
                        {entry.trap}
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            </section>
          ))
        ))}
    </details>
  )
}
