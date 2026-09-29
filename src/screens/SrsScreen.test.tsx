// Implements: plan://M4#4.4 — интеграционные тесты экрана /srs (fake-indexeddb)
import 'fake-indexeddb/auto'
import { fireEvent, render, screen } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { createFirstCards } from '../content/words'
import { DexieProgressRepository } from '../data/progress-repository'
import { HunterDb } from '../data/db'
import type { ProgressRepository } from '../domain/progress'
import type { Note } from '../domain/srs/types'
import { uuidv7 } from '../lib/uuidv7'
import SrsScreen from './SrsScreen'
import { SettingsProvider } from '../state/settings'
import { saveSettings } from '../data/settings'
import { db as globalDb } from '../data/db'
import { DEFAULT_SETTINGS } from '../domain/settings/types'
import '../i18n'

const WORDS: Array<[string, string]> = [
  ['house', 'дом'],
  ['water', 'вода'],
  ['friend', 'друг'],
]

let seq = 0
let db: HunterDb
let repo: DexieProgressRepository
let notes: Note[]

function mkNotes(count: number): Note[] {
  seq = 0
  return Array.from({ length: count }, (_, i) => {
    seq += 1
    const [en, ru] = WORDS[i % WORDS.length]
    // zero-padding: getAllCards сортирует card_id лексикографически (порядок новых не регламентирован)
    const n = String(seq).padStart(3, '0')
    return {
      id: `note_test${n}`,
      deck: 'words',
      entityId: `test${n}`,
      en,
      ru: `${ru} ${seq}`,
      audio: `audio/words/cori/test${n}.opus`,
    }
  })
}

async function bootstrap() {
  await repo.ensureCards(createFirstCards(notes, new Date()))
}

function delayRepo(inner: DexieProgressRepository, ms: number): ProgressRepository {
  return {
    ensureCards: (cards) => inner.ensureCards(cards),
    getAllCards: () => inner.getAllCards(),
    countNewAnsweredSince: (iso) => inner.countNewAnsweredSince(iso),
    saveAnswer: async (next, log) => {
      await new Promise((resolve) => setTimeout(resolve, ms))
      await inner.saveAnswer(next, log)
    },
    getLessonProgress: (lessonId) => inner.getLessonProgress(lessonId),
    putLessonProgress: (progress) => inner.putLessonProgress(progress),
    getStats: () => inner.getStats(),
    putStats: (stats) => inner.putStats(stats),
    getQuestDay: (iso) => inner.getQuestDay(iso),
    putQuestDay: (state) => inner.putQuestDay(state),
    getGateAttempt: (gate) => inner.getGateAttempt(gate),
    putGateAttempt: (attempt) => inner.putGateAttempt(attempt),
    getQuoteMark: (quoteId) => inner.getQuoteMark(quoteId),
    putQuoteMark: (quoteId, understood) => inner.putQuoteMark(quoteId, understood),
  }
}

beforeEach(() => {
  notes = mkNotes(WORDS.length)
  db = new HunterDb(`hunter-srs-test-${uuidv7()}`)
  repo = new DexieProgressRepository(db)
})

function renderScreen(injected?: ProgressRepository) {
  return render(
    <HashRouter>
      <SrsScreen repo={injected ?? repo} notes={notes} />
    </HashRouter>,
  )
}

describe('SrsScreen', () => {
  it('пустая очередь → «всё повторено»', async () => {
    render(
      <HashRouter>
        <SrsScreen repo={repo} notes={[]} />
      </HashRouter>,
    )
    await screen.findByText('Всё повторено — очередь на сегодня пуста.')
  })

  it('показывает фронт, пробел переворачивает, оценка 2 уходит в review_log', async () => {
    await bootstrap()
    renderScreen()

    expect(await screen.findByText('house')).toBeInTheDocument()
    expect(screen.queryByText('дом 1')).not.toBeInTheDocument()

    fireEvent.keyDown(window, { code: 'Space' })
    expect(await screen.findByText('дом 1')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: '2' })
    expect(await screen.findByText('water')).toBeInTheDocument()

    const logs = await db.review_log.toArray()
    expect(logs).toHaveLength(1)
    expect(logs[0].card_id).toBe('test001.en-ru')
    expect(logs[0].rating).toBe(3)
    expect(logs[0].session_id).not.toBeNull()
    expect(logs[0].duration_ms).toBeGreaterThanOrEqual(0)
    // ответ пишет: card_states + review_log + quest_day + user_stats (plan://M7#7.3)
    expect((await db.sync_queue.toArray()).length).toBe(4)
  })

  it('счётчики учу/повтор/новые живые, learning возвращается в очередь', async () => {
    await bootstrap()
    renderScreen()

    await screen.findByText('house')
    expect(screen.getByText('Новые: 3')).toBeInTheDocument()
    expect(screen.getByText('Учу: 0')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
    fireEvent.click(screen.getByRole('button', { name: /Вспомнил/ }))

    expect(await screen.findByText('water')).toBeInTheDocument()
    expect(screen.getByText('Новые: 2')).toBeInTheDocument()
    expect(screen.getByText('Учу: 1')).toBeInTheDocument()
  })

  it('клавиша 1 (Не вспомнил) работает и оставляет карточку в Learning', async () => {
    await bootstrap()
    renderScreen()

    await screen.findByText('house')
    fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
    fireEvent.click(screen.getByRole('button', { name: /Не вспомнил/ }))

    expect(await screen.findByText('water')).toBeInTheDocument()
    const [log] = await db.review_log.toArray()
    expect(log.rating).toBe(1)
    expect(log.state_after).toBe(1) // Learning
  })

  it('двойной клик во время сохранения даёт один ответ (гонка)', async () => {
    await bootstrap()
    renderScreen(delayRepo(repo, 40))

    await screen.findByText('house')
    fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
    fireEvent.click(screen.getByRole('button', { name: /Вспомнил/ }))
    fireEvent.click(screen.getByRole('button', { name: /Вспомнил/ }))

    await screen.findByText('water', undefined, { timeout: 4000 })
    for (let waited = 0; (await db.review_log.count()) < 1 && waited < 2000; waited += 50) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    expect(await db.review_log.count()).toBe(1)
    expect(await db.card_states.count()).toBe(3)
  })

  it('граница блока: 20 ответов → пауза → «Продолжить» → сессия идёт дальше', async () => {
    notes = mkNotes(21)
    await bootstrap()
    renderScreen()

    await screen.findByText('house')
    for (let i = 0; i < 20; i += 1) {
      await screen.findByText(notes[i].en, { selector: '.srs-front' }, { timeout: 4000 })
      // озвучка карточки 🔊/🐢 с клавишами R/S (plan://M6#6.3, specs/07 §3.5)
      expect(screen.getByRole('button', { name: /R/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /S/ })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
      fireEvent.click(screen.getByRole('button', { name: /Вспомнил/ }))
    }

    expect(
      await screen.findByText('Блок из 20 карточек пройден', undefined, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Ответов: 20')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }))
    expect(await screen.findByText(notes[20].en, { selector: '.srs-front' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
    fireEvent.click(screen.getByRole('button', { name: /Вспомнил/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Закончить' }))

    expect(
      await screen.findByText('Сессия завершена. Отличная работа, Охотник.', undefined, {
        timeout: 4000,
      }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Ответов: 21', undefined, { timeout: 4000 })).toBeInTheDocument()
    expect(await db.review_log.count()).toBe(21)
  })

  it('большой долг показывает банер «Нагрузка снижена»', async () => {
    // 201 карточка в долге → rule-5: новых 0 и красное окно
    const debtNotes = mkNotes(201)
    await repo.ensureCards(
      createFirstCards(debtNotes, new Date(Date.now() - 2 * 86_400_000)).map((card) => ({
        ...card,
        state: 2 as const,
        stability: 5,
        difficulty: 5,
        reps: 2,
        last_review: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      })),
    )
    render(
      <HashRouter>
        <SrsScreen repo={repo} notes={debtNotes} />
      </HashRouter>,
    )

    expect(await screen.findByText(/Нагрузка снижена/)).toBeInTheDocument()
    expect(screen.getByText('Новые: 0')).toBeInTheDocument()
  })

  it('маршрут /#/srs в App открывает экран повторения (реальные данные)', async () => {
    window.location.hash = '#/srs'
    render(
      <HashRouter>
        <App />
      </HashRouter>,
    )
    expect(
      await screen.findByText(/Пройдено 0 из/, undefined, { timeout: 10_000 }),
    ).toBeInTheDocument()
  })
})

describe('SrsScreen + настройки (plan://M10#10.3)', () => {
  it('режим 4 кнопок: Трудно/Легко появляются, клавиша 3 = Good', async () => {
    await saveSettings(globalDb.meta, { ...DEFAULT_SETTINGS, srsButtons: 4 })
    await bootstrap()
    render(
      <SettingsProvider>
        <HashRouter>
          <SrsScreen repo={repo} notes={notes} />
        </HashRouter>
      </SettingsProvider>,
    )

    expect(await screen.findByText('house')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
    expect(screen.getByRole('button', { name: /Трудно/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Легко/ })).toBeInTheDocument()
    // подсказка о режиме 4 не показывается
    expect(screen.queryByText(/включить в настройках/)).not.toBeInTheDocument()

    fireEvent.keyDown(window, { key: '3' })
    expect(await screen.findByText('water')).toBeInTheDocument()
    const [log] = await db.review_log.toArray()
    expect(log.rating).toBe(3)
  })

  it('интервалы на кнопках в 4-режиме (showIntervals)', async () => {
    await saveSettings(globalDb.meta, { ...DEFAULT_SETTINGS, srsButtons: 4, showIntervals: true })
    await bootstrap()
    render(
      <SettingsProvider>
        <HashRouter>
          <SrsScreen repo={repo} notes={notes} />
        </HashRouter>
      </SettingsProvider>,
    )

    await screen.findByText('house')
    fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
    // у всех четырёх кнопок mono-подпись следующего интервала (specs/08 §5)
    const intervals = screen.getAllByText(/^\d+[мчдг](\.\d)?$/)
    expect(intervals.length).toBe(4)
  })

  it('режим 2: после переворота — ненавязчивая подсказка про настройки (specs/03 §6)', async () => {
    await bootstrap()
    renderScreen()

    await screen.findByText('house')
    expect(screen.queryByText(/включить в настройках/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
    expect(screen.getByText(/включить в настройках/)).toBeInTheDocument()
  })

  it('Esc в сессии открывает подтверждение прерывания, «Закончить» завершает', async () => {
    await bootstrap()
    renderScreen()

    await screen.findByText('house')
    fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
    fireEvent.click(screen.getByRole('button', { name: /Вспомнил/ }))
    await screen.findByText('water')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(await screen.findByText(/Прервать сессию\?/)).toBeInTheDocument()
    // повторный Esc закрывает диалог (specs/07 §5.1), оценки заблокированы при открытом
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText(/Прервать сессию\?/)).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(window, { key: '2' }) // диалог открыт — не отвечает
    expect(await screen.findByText(/Прервать сессию\?/)).toBeInTheDocument()
    expect(screen.queryByText('water')).toBeInTheDocument()
    // «Закончить» в диалоге — вторая кнопка с этим именем (первая — шапка)
    fireEvent.click(screen.getAllByRole('button', { name: 'Закончить' })[1])
    expect(
      await screen.findByText(/Сессия завершена/, undefined, { timeout: 4000 }),
    ).toBeInTheDocument()
  })
})
