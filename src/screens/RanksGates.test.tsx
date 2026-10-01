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

    // карта правильных ответов choose (RU-промпт → EN) — кликаем заведомо неверную
    // опцию (после key-фикса M21 задания перемонтируются, «залипший» done-стейт
    // исчез, случайный клик стал непредсказуем)
    const { loadWordNotes } = await import('../content/words')
    const ruEn = new Map((await loadWordNotes()).map((n) => [n.ru, n.en]))

    // Проходим все 65 заданий неверными ответами (вердикт детерминированно «провал»):
    // choose → неверный вариант; ввод → «zzz» + Повторить; speak → самопроверка «Сказал(-а)»
    for (let step = 0; step < 500; step += 1) {
      if (screen.queryByText('Врата не пройдены')) break

      const options = screen
        .getAllByRole('button')
        .filter((b) => b.className.includes('lesson-option') && !b.hasAttribute('disabled'))
      if (options.length > 0) {
        const prompt = document.querySelector('.lesson-prompt')?.textContent ?? ''
        const right = ruEn.get(prompt ?? '')
        const wrong = options.find((b) => b.textContent !== right) ?? options[1]!
        fireEvent.click(wrong)
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

// Implements: план M21#21.4 (веха S4) — обёртки loadWordNotes/loadWordRanks для
// точечных моков (catch-гард load; сужение полосы лексики экзамена)
vi.mock('../content/words', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../content/words')>()
  return {
    ...actual,
    loadWordNotes: vi.fn(actual.loadWordNotes),
    loadWordRanks: vi.fn(actual.loadWordRanks),
  }
})
// S4: вердикт Врат мокается точечно в тесте успешного прохода (см. комментарий теста)
vi.mock('../domain/game/game', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../domain/game/game')>()
  return { ...actual, judgeGate: vi.fn(actual.judgeGate) }
})

describe('Финальное испытание S-FINAL (M20)', () => {
  it('intro: финальный заголовок и чеклист ранга S / 15', async () => {
    window.location.hash = '#/gates/S-FINAL'
    render(
      <HashRouter>
        <Routes>
          <Route path="/gates/:id" element={<GatesScreen repo={repo} />} />
        </Routes>
      </HashRouter>,
    )
    expect(
      await screen.findByText(/Финальное испытание: подтверждение S/, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Уроки ранга S: 0 \/ 15/)).toBeInTheDocument()
    expect(screen.getByText(/Слова \(надёжно\): 0 \/ 5000/)).toBeInTheDocument()
  })

  it('RanksScreen: ранг S без Финала — ссылка на S-FINAL; после Финала — ссылки нет', async () => {
    window.location.hash = '#/ranks'
    const stats = {
      xp: 9000,
      streak_current: 3,
      streak_best: 7,
      freezes_left: 1,
      rank: 'S' as const,
      gates_history: [{ gate: 'S' as const, passed_at: new Date().toISOString(), score: 90 }],
      last_counted_day: null,
      updated_at: new Date().toISOString(),
    }
    await repo.putStats(stats)
    const { unmount } = render(
      <HashRouter>
        <Routes>
          <Route path="/ranks" element={<RanksScreen repo={repo} />} />
        </Routes>
      </HashRouter>,
    )
    expect(await screen.findByText(/Финальное испытание \(подтверждение S\)/)).toBeInTheDocument()
    unmount()
    await repo.putStats({
      ...stats,
      gates_history: [
        ...stats.gates_history,
        { gate: 'S-FINAL', passed_at: new Date().toISOString(), score: 88 },
      ],
    })
    render(
      <HashRouter>
        <Routes>
          <Route path="/ranks" element={<RanksScreen repo={repo} />} />
        </Routes>
      </HashRouter>,
    )
    await screen.findByText(/\[Титулы\]/)
    expect(screen.queryByText(/Финальное испытание \(подтверждение S\)/)).not.toBeInTheDocument()
  })
})

// Implements: план M21#21.4 (веха S4) — хвосты покрытия GatesScreen
describe('GatesScreen: хвосты покрытия (S4)', () => {
  function renderGatesS4(id = 'E-D') {
    window.location.hash = `#/gates/${id}`
    return render(
      <HashRouter>
        <Routes>
          <Route path="/gates/:id" element={<GatesScreen repo={repo} />} />
        </Routes>
      </HashRouter>,
    )
  }

  const idle = () => new Promise((resolve) => setTimeout(resolve, 30))

  it('попытка с finished_at без оценок → кулдаун (гард passedExam)', async () => {
    await repo.putGateAttempt({
      gate: 'D',
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      passed: [],
      scores: [],
    })
    renderGatesS4()
    const enter = await screen.findByRole('button', { name: 'Войти' }, { timeout: 8000 })
    expect(enter).toBeDisabled()
    expect(screen.getByText(/Повторная попытка будет доступна/)).toBeInTheDocument()
  })

  it('ошибка загрузки слов → intro всё равно открывается (catch-гард load)', async () => {
    const { loadWordNotes } = await import('../content/words')
    vi.mocked(loadWordNotes).mockRejectedValueOnce(new Error('load fail'))
    renderGatesS4()
    expect(await screen.findByText('Врата E → D', {}, { timeout: 8000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Войти' })).toBeEnabled()
  })

  it('провал с сильной секцией: passed-секции в попытке; споры в вводе', async () => {
    // сужаем полосу лексики до одного слова → секция «Лексика» = 1 задание,
    // верный ответ даёт 100% по секции при общем провале (fail-ветка finishExam)
    const { loadWordNotes, loadWordRanks } = await import('../content/words')
    const notes = await loadWordNotes()
    const ranks = new Map(notes.map((note) => [note.entityId, 99999]))
    ranks.set(notes[0]!.entityId, 1)
    vi.mocked(loadWordRanks).mockReturnValueOnce(Promise.resolve(ranks))

    renderGatesS4()
    expect(await screen.findByText('Врата E → D', {}, { timeout: 8000 })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
    expect(
      await screen.findByText(/Лексика · секция 1 из 4/, {}, { timeout: 8000 }),
    ).toBeInTheDocument()

    let disputes = 0
    for (let step = 0; step < 600; step += 1) {
      if (screen.queryByText('Врата не пройдены')) break
      const options = screen
        .getAllByRole('button')
        .filter((b) => b.className.includes('lesson-option') && !b.hasAttribute('disabled'))
      if (options.length > 0) {
        // единственное задание лексики — верный ответ (100% секции)
        const en = notes[0]!.en
        const right = options.find((b) => b.textContent === en) ?? options[0]!
        fireEvent.click(right)
        continue
      }
      const dispute = screen.queryByRole('button', { name: /Я был прав/ })
      if (dispute) {
        fireEvent.click(dispute)
        disputes += 1
        continue
      }
      const retry = screen.queryByRole('button', { name: /Ещё попытка/ })
      if (retry) {
        fireEvent.click(retry)
        continue
      }
      const giveUp = screen.queryByRole('button', { name: /Сдаться/ })
      if (giveUp) {
        fireEvent.click(giveUp) // речь: 5 неудач → skip (авто-переход)
        continue
      }
      const next = screen.queryByRole('button', { name: /^Дальше/ })
      if (next) {
        fireEvent.click(next)
        continue
      }
      if (screen.queryByText(/Слушаю/)) {
        await idle()
        continue
      }
      const say = screen.queryByRole('button', { name: /Скажи/ })
      if (say) {
        gatesSpeech.heard = 'zzz'
        fireEvent.click(say)
        continue
      }
      const input = document.querySelector<HTMLInputElement>('.lesson-input:not([disabled])')
      if (input) {
        const audio = screen.queryByRole('button', { name: /🔊/ })
        if (audio) fireEvent.click(audio)
        fireEvent.change(input, { target: { value: 'zzz' } }) // перевод/диктант — неверно
        fireEvent.submit(input.closest('form')!)
        continue
      }
      throw new Error(`экзамен завис ${step}: ${document.body.textContent?.slice(0, 220)}`)
    }

    expect(screen.getByText('Врата не пройдены')).toBeInTheDocument()
    // споры: первый перевод + первый диктант (disputed-ветка onDispute)
    expect(disputes).toBeGreaterThanOrEqual(2)
    const attempt = await waitFor(async () => {
      const value = await repo.getGateAttempt('D')
      expect(value?.finished_at).toBeTruthy()
      return value
    })
    // единственная сданная секция попала в passed через map (fail-ветка finishExam)
    expect(attempt?.passed).toContain('vocab')
  }, 90000)

  it('успешный экзамен: ранг повышается, история и тост (finishExam pass-ветка)', async () => {
    // Полный проход 65/65 в юните недостижим: упражнения экзамена рендерятся без key,
    // состояние первого задания каждой секции «перетекает» на остальные (Known Issue S4).
    // Для pass-ветки finishExam мокаем вердикт домена — остальное (putStats, тост,
    // история) выполняется реально.
    const { judgeGate } = await import('../domain/game/game')
    vi.mocked(judgeGate).mockReturnValueOnce({ passed: true, total: 100, weakSections: [] })

    renderGatesS4()
    expect(await screen.findByText('Врата E → D', {}, { timeout: 8000 })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
    expect(
      await screen.findByText(/Лексика · секция 1 из 4/, {}, { timeout: 8000 }),
    ).toBeInTheDocument()

    for (let step = 0; step < 600; step += 1) {
      if (screen.queryByText('Врата пройдены')) break
      const options = screen
        .getAllByRole('button')
        .filter((b) => b.className.includes('lesson-option') && !b.hasAttribute('disabled'))
      if (options.length > 0) {
        fireEvent.click(options[0]!)
        continue
      }
      const retry = screen.queryByRole('button', { name: /Ещё попытка/ })
      if (retry) {
        fireEvent.click(retry)
        continue
      }
      const giveUp = screen.queryByRole('button', { name: /Сдаться/ })
      if (giveUp) {
        fireEvent.click(giveUp)
        continue
      }
      const next = screen.queryByRole('button', { name: /^Дальше/ })
      if (next) {
        fireEvent.click(next)
        continue
      }
      if (screen.queryByText(/Слушаю/)) {
        await idle()
        continue
      }
      const say = screen.queryByRole('button', { name: /Скажи/ })
      if (say) {
        gatesSpeech.heard = 'zzz'
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

    expect(screen.getByText('Врата пройдены')).toBeInTheDocument()
    expect(await screen.findByText(/Ранг повышен/)).toBeInTheDocument()
    const stats = await waitFor(async () => {
      const value = await repo.getStats()
      expect(value.rank).toBe('D')
      return value
    })
    expect(stats.gates_history).toHaveLength(1)
    expect(stats.gates_history[0]?.gate).toBe('D')
  }, 90000)
})
