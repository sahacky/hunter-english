// Implements: plan://M7#7.5–7.6 — smoke-тесты экранов Рангов и Врат
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    // M9: вход в Врата ранга с экрана статуса (доступ с мобильного таб-бара)
    expect(screen.getByRole('link', { name: 'Врата E → D' })).toHaveAttribute('href', '#/gates/E-D')
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

// Implements: plan://M18 — GAP-5 specs/09 §4.7 (TC-UI-10 result-фаза + пересдача слабых)
describe('GatesScreen: экзамен → result → пересдача слабых секций (GAP-5)', () => {
  function renderGatesLocal(id = 'E-D') {
    window.location.hash = `#/gates/${id}`
    return render(
      <HashRouter>
        <Routes>
          <Route path="/gates/:id" element={<GatesScreen repo={repo} />} />
        </Routes>
      </HashRouter>,
    )
  }

  it('провал по всем секциям → вердикт, оценки, пересдача возвращается в экзамен', async () => {
    renderGatesLocal()
    expect(await screen.findByText('Врата E → D', {}, { timeout: 8000 })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
    expect(
      await screen.findByText(/Лексика · секция 1 из 4/, {}, { timeout: 8000 }),
    ).toBeInTheDocument()

    // Проходим все 65 заданий неверными ответами (вердикт детерминированно «провал»):
    // choose → первый вариант; ввод → «zzz» + Повторить; speak → самопроверка «Сказал(-а)»
    for (let step = 0; step < 500; step += 1) {
      if (screen.queryByText('Врата не пройдены')) break

      const options = screen
        .getAllByRole('button')
        .filter((b) => b.className.includes('lesson-option') && !b.hasAttribute('disabled'))
      if (options.length > 0) {
        fireEvent.click(options[0]!)
        continue
      }
      const said = screen.queryByRole('button', { name: /Сказал\(-а\)/ })
      if (said) {
        fireEvent.click(said)
        continue
      }
      const next = screen.queryByRole('button', { name: /^Дальше/ })
      if (next) {
        fireEvent.click(next)
        continue
      }
      const retry = screen.queryByRole('button', { name: /Ещё попытка/ })
      if (retry) {
        fireEvent.click(retry)
        continue
      }
      // речь «поддержана» (мок): два неудачных слушания открывают самопроверку
      const listeningNow = screen.queryByText(/Слушаю/)
      if (listeningNow) {
        await new Promise((resolve) => setTimeout(resolve, 10)) // мок завершает слушание
        continue
      }
      const say = screen.queryByRole('button', { name: /Скажи/ })
      if (say) {
        fireEvent.click(say)
        continue
      }
      const input = document.querySelector<HTMLInputElement>('.lesson-input:not([disabled])')
      if (input) {
        fireEvent.change(input, { target: { value: 'zzz' } })
        fireEvent.submit(input.closest('form')!)
        continue
      }
      throw new Error(`экзамен завис ${step}: ${document.body.textContent?.slice(0, 220)}`)
    }

    // result: вердикт, оценки секций, сумма, попытка сохранена
    expect(screen.getByText('Врата не пройдены')).toBeInTheDocument()
    expect(screen.getByText(/Лексика:/)).toBeInTheDocument()
    expect(screen.getByText(/Сумма: \d+%/)).toBeInTheDocument()
    // finishExam асинхронен (putGateAttempt) — ждём персиста попытки
    const attempt = await waitFor(async () => {
      const value = await repo.getGateAttempt('D')
      expect(value?.finished_at).toBeTruthy()
      expect(value?.scores).toHaveLength(4)
      return value
    })
    void attempt

    // пересдача слабых секций возвращает в экзамен
    fireEvent.click(screen.getByRole('button', { name: 'Пересдать слабые секции' }))
    expect(await screen.findByText(/секция 1 из 4/, {}, { timeout: 8000 })).toBeInTheDocument()
  }, 45000)
})

// M19: пройденный экзамен → rankUp; dispute в экзамене; чеклист пройденных уроков
const gatesSpeech = vi.hoisted(() => ({ heard: null as string | null }))
vi.mock('../lib/speech', () => ({
  isSpeechSupported: () => true,
  listenOnce: async () => {
    if (gatesSpeech.heard === null) throw new Error('no-speech')
    return gatesSpeech.heard
  },
  cancelListening: vi.fn(),
}))
vi.mock('../lib/tts', () => ({ speak: vi.fn(), stopSpeak: vi.fn(), setDefaultRate: vi.fn() }))

describe('GatesScreen: успешный экзамен (M19)', () => {
  it('чеклист intro считает пройденные уроки ранга', async () => {
    await repo.putLessonProgress({
      lesson_id: 'les-e-01',
      status: 'completed',
      score: 100,
      checkpoint: {
        passIndex: 0,
        stepIndex: 7,
        scores: [],
        srsEnqueued: [],
        passesDone: 1,
        results: {},
      },
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    window.location.hash = '#/gates/E-D'
    render(
      <HashRouter>
        <Routes>
          <Route path="/gates/:id" element={<GatesScreen repo={repo} />} />
        </Routes>
      </HashRouter>,
    )
    expect(
      await screen.findByText(/Уроки ранга E: 1 \/ 24/, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })
})
