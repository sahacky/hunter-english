// Implements: plan://M7#7.5–7.6 — smoke-тесты экранов Рангов и Врат
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import '../i18n'
import { HunterDb } from '../data/db'
import { DexieProgressRepository } from '../data/progress-repository'
import { uuidv7 } from '../lib/uuidv7'
import GatesScreen from './GatesScreen'
import RanksScreen from './RanksScreen'

let db: HunterDb
let repo: DexieProgressRepository

beforeEach(() => {
  db = new HunterDb(`hunter-m7-test-${uuidv7()}`)
  repo = new DexieProgressRepository(db)
})

describe('RanksScreen /#/ranks', () => {
  it('показывает ранг, уровни и титулы', async () => {
    await repo.putStats({
      xp: 347,
      streak_current: 9,
      streak_best: 12,
      freezes_left: 3,
      rank: 'E',
      gates_history: [],
      last_counted_day: null,
      updated_at: new Date().toISOString(),
    })
    render(
      <HashRouter>
        <Routes>
          <Route path="/ranks" element={<RanksScreen repo={repo} />} />
        </Routes>
      </HashRouter>,
    )
    window.location.hash = '#/ranks'
    expect(await screen.findByText('[Статус охотника]')).toBeInTheDocument()
    expect(screen.getByText(/Охотник E-ранга/)).toBeInTheDocument()
    expect(screen.getByText(/Суммарный XP: 347/)).toBeInTheDocument()
    expect(screen.getByText(/«Winter is coming»/)).toBeInTheDocument()
    expect(screen.getByText(/«Equivalent exchange»/)).toBeInTheDocument()
  })
})

describe('GatesScreen /#/gates/E-D', () => {
  function renderGates(id = 'E-D') {
    window.location.hash = `#/gates/${id}`
    return render(
      <HashRouter>
        <Routes>
          <Route path="/gates/:id" element={<GatesScreen repo={repo} />} />
        </Routes>
      </HashRouter>,
    )
  }

  it('невалидные Врата → 404', async () => {
    renderGates('X-Z')
    expect(await screen.findByText(/Такие Врата не существуют/)).toBeInTheDocument()
  })

  it('intro: чеклист и вход открывают экзамен', async () => {
    renderGates()
    expect(await screen.findByText('Врата E → D', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText(/Слова \(надёжно\): 0 \/ 300/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
    // первая секция — лексика (выбор из вариантов)
    expect(
      await screen.findByText(/Лексика · секция 1 из 4/, {}, { timeout: 5000 }),
    ).toBeInTheDocument()
    const attempt = await repo.getGateAttempt('D')
    expect(attempt).not.toBeNull()
    expect(attempt?.started_at).toBeTruthy()
  })

  it('кулдаун 72ч блокирует вход после провала', async () => {
    await repo.putGateAttempt({
      gate: 'D',
      started_at: '2026-09-27T10:00:00Z',
      finished_at: new Date().toISOString(),
      passed: [],
      scores: [{ section: 'vocab', correct: 5, total: 20 }],
    })
    renderGates()
    const enter = await screen.findByRole('button', { name: 'Войти' }, { timeout: 5000 })
    expect(enter).toBeDisabled()
    expect(screen.getByText(/Повторная попытка будет доступна/)).toBeInTheDocument()
  })
})
