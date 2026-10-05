// Implements: plan://M4#4.4 — интеграционные тесты экрана /srs (fake-indexeddb)
import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { HashRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { createFirstCards } from '../content/words'
import { dayStart } from '../domain/srs/scheduler'
import { createQuestDay } from '../domain/game/game'
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

vi.mock('../lib/tts', () => ({
  speak: vi.fn(),
  stopSpeak: vi.fn(),
  setDefaultRate: vi.fn(),
  setListenSink: vi.fn(),
  currentAudio: vi.fn(() => null),
}))

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
    suspendNotes: (noteIds) => inner.suspendNotes(noteIds),
    unsuspendNotes: (noteIds) => inner.unsuspendNotes(noteIds),
    getAllCards: () => inner.getAllCards(),
    countNewAnsweredSince: (iso) => inner.countNewAnsweredSince(iso),
    saveAnswer: async (next, log) => {
      await new Promise((resolve) => setTimeout(resolve, ms))
      await inner.saveAnswer(next, log)
    },
    getLessonProgress: (lessonId) => inner.getLessonProgress(lessonId),
    getManyLessonProgress: (ids) => inner.getManyLessonProgress(ids),
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
    await screen.findByText('Всё повторено — очередь на сегодня пуста.', undefined, {
      timeout: 4000,
    })
  })

  it('показывает фронт, пробел переворачивает, оценка 2 уходит в review_log', async () => {
    await bootstrap()
    renderScreen()

    expect(await screen.findByText('house', undefined, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.queryByText('дом 1')).not.toBeInTheDocument()

    fireEvent.keyDown(window, { key: ' ', code: 'Space' })
    expect(await screen.findByText('дом 1', undefined, { timeout: 4000 })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: '2' })
    expect(await screen.findByText('water', undefined, { timeout: 4000 })).toBeInTheDocument()

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

    await screen.findByText('house', undefined, { timeout: 4000 })
    expect(screen.getByText('Новые: 3')).toBeInTheDocument()
    expect(screen.getByText('Учу: 0')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
    fireEvent.click(screen.getByRole('button', { name: /Вспомнил/ }))

    expect(await screen.findByText('water', undefined, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByText('Новые: 2')).toBeInTheDocument()
    expect(screen.getByText('Учу: 1')).toBeInTheDocument()
  })

  it('клавиша 1 (Не вспомнил) работает и оставляет карточку в Learning', async () => {
    await bootstrap()
    renderScreen()

    await screen.findByText('house', undefined, { timeout: 4000 })
    fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
    fireEvent.click(screen.getByRole('button', { name: /Не вспомнил/ }))

    expect(await screen.findByText('water', undefined, { timeout: 4000 })).toBeInTheDocument()
    const [log] = await db.review_log.toArray()
    expect(log.rating).toBe(1)
    expect(log.state_after).toBe(1) // Learning
  })

  it('двойной клик во время сохранения даёт один ответ (гонка)', async () => {
    await bootstrap()
    renderScreen(delayRepo(repo, 40))

    await screen.findByText('house', undefined, { timeout: 4000 })
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
    // v2 (V.6): слова ≤10/день — пул блока 11 слов + 10 фраз (интерливинг
    // сохраняет порядок notes: нечётные words, чётные phrases), лимит 50
    notes = mkNotes(21).map((note, i) =>
      i % 2 === 0 ? note : { ...note, deck: 'phrases' as const },
    )
    await bootstrap()
    await saveSettings(globalDb.meta, { ...DEFAULT_SETTINGS, newPerDay: 50 })
    render(
      <SettingsProvider>
        <SrsScreen repo={repo} notes={notes} />
      </SettingsProvider>,
    )

    await screen.findByText('house', undefined, { timeout: 4000 })
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
    expect(
      await screen.findByText(notes[20].en, { selector: '.srs-front' }, { timeout: 4000 }),
    ).toBeInTheDocument()

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

    expect(
      await screen.findByText(/Нагрузка снижена/, undefined, { timeout: 4000 }),
    ).toBeInTheDocument()
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
    // U3.2: бейдж «Полоса ранга X» на карточке слова (реальные ранги загружены)
    expect(
      await screen.findByText(/Полоса ранга [EDCBS]/, undefined, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  it('chunk-карточка (Q2.2): фронт-шаблон со слотом ___, бэк — слот + фраза', async () => {
    // note с chunkSlot; пассив уже зрелый → chunk просыпается wake-up'ом
    notes = [
      {
        id: 'note_ph-0001',
        deck: 'phrases',
        entityId: 'ph-0001',
        en: "I'd like to book a table.",
        ru: 'Я хотел бы забронировать столик.',
        chunkSlot: 'book',
      },
    ]
    const now = new Date()
    await repo.ensureCards([
      {
        card_id: 'ph-0001.en-ru',
        note_id: 'note_ph-0001',
        type: 'en-ru',
        deck: 'phrases',
        due: new Date(now.getTime() + 3 * 86_400_000).toISOString(),
        stability: 10,
        difficulty: 5,
        elapsed_days: 9,
        scheduled_days: 12,
        reps: 3,
        lapses: 0,
        state: 2,
        last_review: new Date(now.getTime() - 3 * 86_400_000).toISOString(),
        suspended: false,
        cloze_index: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        card_id: 'ph-0001.chunk',
        note_id: 'note_ph-0001',
        type: 'chunk',
        deck: 'phrases',
        due: now.toISOString(),
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        state: 0,
        last_review: null,
        suspended: false,
        cloze_index: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ])
    renderScreen()

    expect(
      await screen.findByText("I'd like to ___ a table.", undefined, { timeout: 4000 }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
    // бэк: слот (strong) + вся фраза + перевод в одном блоке
    expect(await screen.findByText('book')).toBeInTheDocument()
    expect(screen.getByText(/· Я хотел бы забронировать столик/)).toBeInTheDocument()
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

    expect(await screen.findByText('house', undefined, { timeout: 4000 })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
    expect(screen.getByRole('button', { name: /Трудно/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Легко/ })).toBeInTheDocument()
    // подсказка о режиме 4 не показывается
    expect(screen.queryByText(/включить в настройках/)).not.toBeInTheDocument()

    fireEvent.keyDown(window, { key: '3' })
    expect(await screen.findByText('water', undefined, { timeout: 4000 })).toBeInTheDocument()
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

    await screen.findByText('house', undefined, { timeout: 4000 })
    fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
    // у всех четырёх кнопок mono-подпись следующего интервала (specs/08 §5)
    const intervals = screen.getAllByText(/^\d+[мчдг](\.\d)?$/)
    expect(intervals.length).toBe(4)
  })

  it('режим 2: после переворота — ненавязчивая подсказка про настройки (specs/03 §6)', async () => {
    await bootstrap()
    renderScreen()

    await screen.findByText('house', undefined, { timeout: 4000 })
    expect(screen.queryByText(/включить в настройках/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
    expect(screen.getByText(/включить в настройках/)).toBeInTheDocument()
  })

  it('Esc в сессии открывает подтверждение прерывания, «Закончить» завершает', async () => {
    await bootstrap()
    renderScreen()

    await screen.findByText('house', undefined, { timeout: 4000 })
    fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
    fireEvent.click(screen.getByRole('button', { name: /Вспомнил/ }))
    await screen.findByText('water', undefined, { timeout: 4000 })

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(
      await screen.findByText(/Прервать сессию\?/, undefined, { timeout: 4000 }),
    ).toBeInTheDocument()
    // повторный Esc закрывает диалог (specs/07 §5.1), оценки заблокированы при открытом
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText(/Прервать сессию\?/)).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(window, { key: '2' }) // диалог открыт — не отвечает
    expect(
      await screen.findByText(/Прервать сессию\?/, undefined, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(screen.queryByText('water')).toBeInTheDocument()
    // «Закончить» в диалоге — вторая кнопка с этим именем (первая — шапка)
    fireEvent.click(screen.getAllByRole('button', { name: 'Закончить' })[1])
    expect(
      await screen.findByText(/Сессия завершена/, undefined, { timeout: 4000 }),
    ).toBeInTheDocument()
  })
})

// Implements: plan://M18 — GAP-4 specs/09 §4.7 (TC-UI-05 beforeunload, TC-A11Y-04 onControl)
describe('SrsScreen: гарды (GAP-4)', () => {
  it('beforeunload отменяется только в активной сессии с ответами', async () => {
    await bootstrap()
    renderScreen()

    // до ответов — подтверждение не нужно
    await screen.findByText('house', undefined, { timeout: 4000 })
    const before = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(before)
    expect(before.defaultPrevented).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
    fireEvent.click(screen.getByRole('button', { name: /Вспомнил/ }))
    await screen.findByText('water', undefined, { timeout: 4000 })

    const after = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(after)
    expect(after.defaultPrevented).toBe(true)
  })

  it('Space на сфокусированной кнопке — её активация, карточка не переворачивается (onControl)', async () => {
    await bootstrap()
    renderScreen()
    await screen.findByText('house', undefined, { timeout: 4000 })

    const reveal = screen.getByRole('button', { name: /Показать ответ/ })
    reveal.focus()
    expect(document.activeElement).toBe(reveal)
    // keydown всплывает с target=кнопка (как в реальном браузере)
    fireEvent.keyDown(reveal, { key: ' ', code: 'Space', bubbles: true })
    expect(screen.queryByText('дом 1')).not.toBeInTheDocument()
    // Space вне контролов (target=window) всё ещё переворачивает
    fireEvent.keyDown(window, { key: ' ', code: 'Space' })
    expect(await screen.findByText('дом 1', undefined, { timeout: 4000 })).toBeInTheDocument()
  })
})

// M19: хвосты SrsScreen (4 кнопки, гарды клавиш, финал очереди, error-фаза)
describe('SrsScreen: хвосты (M19)', () => {
  it('гарды клавиш: repeat/модификаторы/цифра ≥3 в режиме 2 кнопок — no-op', async () => {
    await bootstrap()
    renderScreen()
    await screen.findByText('house', undefined, { timeout: 4000 })
    fireEvent.keyDown(window, { key: 'r', repeat: true })
    fireEvent.keyDown(window, { key: 'r', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'r', altKey: true })
    fireEvent.keyDown(window, { code: 'Space' }) // переворот
    expect(await screen.findByText('дом 1', undefined, { timeout: 4000 })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: '3' }) // режим 2: игнор
    expect(screen.getByText('дом 1')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: '2' }) // штатная оценка
    expect(await screen.findByText('water', undefined, { timeout: 4000 })).toBeInTheDocument()
  })

  it('озвучка 🔊/🐢 и отмена подтверждения выхода', async () => {
    await bootstrap()
    renderScreen()
    await screen.findByText('house', undefined, { timeout: 4000 })
    fireEvent.click(screen.getByRole('button', { name: /🔊/ }))
    fireEvent.click(screen.getByRole('button', { name: /🐢/ }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByText(/Прервать сессию\?/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Продолжить/ }))
    expect(screen.queryByText(/Прервать сессию\?/)).not.toBeInTheDocument()
  })

  it('очередь исчерпана (карточки ушли в Review) → финал «Сессия завершена»', async () => {
    await bootstrap()
    renderScreen()
    for (let round = 0; round < 40; round += 1) {
      await waitFor(
        () => {
          // либо финал, либо следующая карточка (гонка асинхронного сохранения)
          const reveal = screen.queryByRole('button', { name: /Показать ответ/ })
          const done = screen.queryByText(/Сессия завершена/)
          expect(reveal ?? done).toBeInTheDocument()
        },
        { timeout: 4000 },
      )
      if (screen.queryByText(/Сессия завершена/)) break
      fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /Вспомнил/ })).toBeInTheDocument()
        },
        { timeout: 4000 },
      )
      fireEvent.click(screen.getByRole('button', { name: /Вспомнил/ }))
    }
    await waitFor(
      () => {
        expect(screen.queryByText(/Сессия завершена/)).toBeInTheDocument()
      },
      { timeout: 4000 },
    )
  })

  it('сбой сохранения → error-фаза (спокойная, без белого экрана)', async () => {
    await bootstrap()
    const failing: ProgressRepository = {
      ...delayRepo(repo, 0),
      saveAnswer: async () => {
        throw new Error('disk full')
      },
    }
    renderScreen(failing)
    await screen.findByText('house', undefined, { timeout: 4000 })
    fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
    fireEvent.click(screen.getByRole('button', { name: /Вспомнил/ }))
    expect(
      await screen.findByText(/Ошибка|не удалось/i, undefined, { timeout: 4000 }),
    ).toBeInTheDocument()
  })
})

// Веха S4 (M21#21.4): хвосты экрана — сбой бустрапа, клавиши R/S,
// заморозка стрика в сессии, клики оценок в режиме 4 кнопок
describe('SrsScreen: хвосты S4', () => {
  it('сбой бустрапа (getAllCards) → error-фаза', async () => {
    const broken: ProgressRepository = {
      ...delayRepo(repo, 0),
      getAllCards: async () => {
        throw new Error('storage broken')
      },
    }
    renderScreen(broken)
    expect(
      await screen.findByText(/Не удалось сохранить прогресс/, undefined, { timeout: 4000 }),
    ).toBeInTheDocument()
  })

  it('клавиши R и S озвучивают карточку (обычный и медленный темп)', async () => {
    await bootstrap()
    renderScreen()
    await screen.findByText('house', undefined, { timeout: 4000 })
    const tts = await import('../lib/tts')
    fireEvent.keyDown(window, { key: 'r' })
    expect(vi.mocked(tts.speak)).toHaveBeenLastCalledWith('house', {
      src: 'audio/words/cori/test001.opus',
    })
    fireEvent.keyDown(window, { key: 's' })
    expect(vi.mocked(tts.speak)).toHaveBeenLastCalledWith('house', {
      src: 'audio/words/cori/test001.opus',
      rate: 0.75,
    })
  })

  it('закрытие дня на стрике 7 → тост о заморозке (freezeGained)', async () => {
    const { ToastHost } = await import('../components/ToastHost')
    const dayIso = dayStart(new Date()).toISOString()
    await repo.putStats({ ...(await repo.getStats()), streak_current: 6, streak_best: 6 })
    const quest = createQuestDay(dayIso, 0)
    quest.slots.reviews = { done: 19, target: 20 } // один ответ закроет слот повторов
    await repo.putQuestDay(quest)
    render(
      <HashRouter>
        <SrsScreen repo={repo} notes={notes} />
        <ToastHost />
      </HashRouter>,
    )
    await screen.findByText('house', undefined, { timeout: 4000 })
    fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Вспомнил/ }))
    // closeStudyDay: стрик 6→7 → +1 заморозка (тост «Получена заморозка стрика»)
    expect(
      await screen.findByText(/Получена заморозка стрика/i, undefined, { timeout: 4000 }),
    ).toBeInTheDocument()
    await waitFor(() => expect(repo.getStats()).resolves.toMatchObject({ freezes_left: 3 }))
  })

  it('режим 4 кнопок: клики Не вспомнил/Трудно/Вспомнил/Легко пишут рейтинги 1/2/3/4', async () => {
    await saveSettings(globalDb.meta, { ...DEFAULT_SETTINGS, srsButtons: 4 })
    try {
      notes = mkNotes(4)
      await bootstrap()
      render(
        <SettingsProvider>
          <HashRouter>
            <SrsScreen repo={repo} notes={notes} />
          </HashRouter>
        </SettingsProvider>,
      )
      // карточка 1: Again (learning — вернётся в очередь)
      await screen.findByText('house', undefined, { timeout: 4000 })
      fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
      fireEvent.click(screen.getByRole('button', { name: /^Не вспомнил/ }))
      // карточка 2: Hard
      await screen.findByText('water', undefined, { timeout: 4000 })
      fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
      fireEvent.click(screen.getByRole('button', { name: /^Трудно/ }))
      // карточка 3: Good
      await screen.findByText('friend', undefined, { timeout: 4000 })
      fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
      fireEvent.click(screen.getByRole('button', { name: /^Вспомнил/ }))
      // карточка 4: Easy
      await screen.findByText('house', { selector: '.srs-front' }, { timeout: 4000 })
      fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
      fireEvent.click(screen.getByRole('button', { name: /^Легко/ }))
      await waitFor(() => expect(db.review_log.count()).resolves.toBe(4), { timeout: 4000 })
      const ratings = (await db.review_log.toArray()).map((log) => log.rating).sort()
      expect(ratings).toEqual([1, 2, 3, 4])
    } finally {
      await saveSettings(globalDb.meta, DEFAULT_SETTINGS)
    }
  })
})
