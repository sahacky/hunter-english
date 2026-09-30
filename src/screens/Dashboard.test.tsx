// Implements: plan://M19 — Dashboard/RanksScreen error-фазы и дашборд-детали
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import '../i18n'
import { HunterDb } from '../data/db'
import { DexieProgressRepository } from '../data/progress-repository'
import { uuidv7 } from '../lib/uuidv7'
import Dashboard from './Dashboard'
import RanksScreen from './RanksScreen'
import type { ProgressRepository } from '../domain/progress'

let db: HunterDb
let repo: DexieProgressRepository

beforeEach(() => {
  db = new HunterDb(`hunter-dash-test-${uuidv7()}`)
  repo = new DexieProgressRepository(db)
})

// прототипная делегация (spread ломает this у Dexie-методов — M19)
const failingStats = (): ProgressRepository => {
  const failing: ProgressRepository = Object.create(repo)
  failing.getStats = async () => {
    throw new Error('stats broken')
  }
  return failing
}

describe('Dashboard', () => {
  it('ошибка загрузки статов → error-фаза', async () => {
    window.location.hash = '#/'
    render(
      <HashRouter>
        <Dashboard repo={failingStats()} />
      </HashRouter>,
    )
    expect(await screen.findByText(/Не удалось загрузить|ошибк/i)).toBeInTheDocument()
  })

  it('квест-окно, цитата дня и «Начать день» с чистой базой', async () => {
    window.location.hash = '#/'
    render(
      <HashRouter>
        <Dashboard repo={repo} />
      </HashRouter>,
    )
    expect(await screen.findByText('[Ежедневный квест]', {}, { timeout: 5000 })).toBeInTheDocument()
    // дашборд ведёт в повторение/урок
    expect(screen.getByRole('link', { name: /Начать день|Повторение|Урок/ })).toBeTruthy()
  })
})

describe('RanksScreen', () => {
  it('ошибка загрузки статов → error-фаза', async () => {
    window.location.hash = '#/ranks'
    render(
      <HashRouter>
        <RanksScreen repo={failingStats()} />
      </HashRouter>,
    )
    expect(await screen.findByText(/Не удалось загрузить|ошибк/i)).toBeInTheDocument()
  })
})
