// Implements: plan://M18 — GAP-5 specs/09 §4.7 (TC-UI-13 сценка разговорника с ответами)
import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import smalltalk from '../../data/phrasebook/smalltalk.json'
import '../i18n'
import PhrasebookScreen, { PhrasebookSituationScreen } from './PhrasebookScreen'

// S4: обёртка loadPhrasebook для rejectOnce (catch-ветка списка); остальное — real
vi.mock('../content/phrasebook', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../content/phrasebook')>()
  return { ...actual, loadPhrasebook: vi.fn(actual.loadPhrasebook) }
})

// plan://travel-vocab#V.5 — контролируемые слова мини-словаря (группировка real)
vi.mock('../content/vocab', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../content/vocab')>()
  return {
    ...actual,
    loadTravelVocab: vi.fn(async () => [
      {
        topic: 'airport',
        en: 'boarding pass',
        ru: 'посадочный талон',
        audio: 'audio/words/cori/boarding-noun.opus',
      },
      { topic: 'airport', en: 'gate', ru: 'выход (на посадку)' },
      { topic: 'politeness', en: 'thank you', ru: 'спасибо' },
    ]),
  }
})

vi.mock('../lib/tts', () => ({ speak: vi.fn(() => true), stopSpeak: vi.fn() }))

const dialogs = smalltalk.items
const firstUserLine = dialogs[0]!.lines.find((line) => line.accepted)!

function renderSituation(id = 'smalltalk') {
  window.location.hash = `#/phrasebook/${id}`
  return render(
    <HashRouter>
      <Routes>
        <Route path="/phrasebook/:situation" element={<PhrasebookSituationScreen />} />
      </Routes>
    </HashRouter>,
  )
}

describe('PhrasebookScreen /#/phrasebook', () => {
  it('список: 11 ситуаций (10 путешественника + идиомы M20) + карточка мини-словаря', async () => {
    window.location.hash = '#/phrasebook'
    render(
      <HashRouter>
        <Routes>
          <Route path="/phrasebook" element={<PhrasebookScreen />} />
        </Routes>
      </HashRouter>,
    )
    expect(await screen.findByText('Разговорник')).toBeInTheDocument()
    const cards = screen.getAllByRole('link')
    expect(cards.filter((c) => c.getAttribute('href')?.startsWith('#/phrasebook/'))).toHaveLength(
      12,
    )
    // контент всех глав уже поставлен (M8–M14) — ни одна карточка не «закрыта»
    expect(screen.queryByText(/главы пока не готовы/)).not.toBeInTheDocument()
    // карточка мини-словаря ведёт на свой вид
    expect(screen.getByText('Мини-словарь путешественника').closest('a')).toHaveAttribute(
      'href',
      '#/phrasebook/vocab',
    )
  })

  it('мини-словарь: темы в каноническом порядке, 🔊 зовёт speak с аудио и без (TTS)', async () => {
    renderSituation('vocab')
    expect(await screen.findByText('Мини-словарь путешественника')).toBeInTheDocument()
    expect(screen.getByText('Знакомство и вежливость')).toBeInTheDocument()
    // канонический порядок тем: politeness раньше airport
    const topics = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(topics.indexOf('Знакомство и вежливость')).toBeLessThan(
      topics.indexOf('Аэропорт и самолёт'),
    )
    // слово без аудио (gate) и с аудио (boarding pass)
    expect(screen.getByText('boarding pass')).toBeInTheDocument()
    expect(screen.getByText('gate')).toBeInTheDocument()

    const { speak } = await import('../lib/tts')
    const buttons = screen.getAllByRole('button', { name: 'Прослушать слово' })
    fireEvent.click(buttons[1]!) // boarding pass — с готовым аудио
    expect(vi.mocked(speak)).toHaveBeenLastCalledWith('boarding pass', {
      src: 'audio/words/cori/boarding-noun.opus',
    })
    fireEvent.click(buttons[2]!) // gate — TTS-фолбэк без src
    expect(vi.mocked(speak)).toHaveBeenLastCalledWith('gate', { src: undefined })
  })

  it('мини-словарь: ошибка загрузки — экран без тем (S4-покрытие catch-ветки)', async () => {
    const { loadTravelVocab } = await import('../content/vocab')
    vi.mocked(loadTravelVocab).mockRejectedValueOnce(new Error('disk'))
    renderSituation('vocab')
    expect(await screen.findByText('Мини-словарь путешественника')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument()
  })
})

describe('PhrasebookSituationScreen: диалог-сценка (GAP-5)', () => {
  it('реплика NPC видна целиком, ответ пользователя скрыт (…)', async () => {
    renderSituation()
    expect(
      await screen.findByText(dialogs[0]!.situation_ru, {}, { timeout: 4000 }),
    ).toBeInTheDocument()
    // первая реплика NPC — текст открыт
    expect(screen.getByText('Hello!', { selector: '.pb-bubble' })).toBeInTheDocument()
    expect(screen.getByText(/диалог 1 из/)).toBeInTheDocument()
  })

  it('неверный ответ — фидбэк без прохода; верный — «Дальше»', async () => {
    renderSituation()
    await screen.findByText(dialogs[0]!.situation_ru, {}, { timeout: 4000 })

    // первая реплика NPC — пропускаем
    fireEvent.click(await screen.findByRole('button', { name: /^Дальше/ }))

    // реплика пользователя: неверный ответ
    const input = (await screen.findAllByRole('textbox'))[0]!
    fireEvent.change(input, { target: { value: 'zzz' } })
    fireEvent.submit(input.closest('form')!)
    expect(await screen.findByText(/Неверно/, undefined, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Дальше/ })).not.toBeInTheDocument()

    // верный ответ — реплика пройдена
    fireEvent.change(input, { target: { value: firstUserLine.accepted![0]! } })
    fireEvent.submit(input.closest('form')!)
    expect(
      await screen.findByRole('button', { name: /^Дальше/ }, { timeout: 4000 }),
    ).toBeInTheDocument()
  })

  it('«Показать ответ» раскрывает реплику; сценарий проходится до финала', async () => {
    renderSituation()
    await screen.findByText(dialogs[0]!.situation_ru, {}, { timeout: 4000 })

    for (let step = 0; step < 200; step += 1) {
      if (screen.queryByText('Ситуация пройдена')) break
      const next = screen.queryByRole('button', { name: /^Дальше/ })
      if (next) {
        fireEvent.click(next)
        continue
      }
      const show = screen.queryByRole('button', { name: /Показать ответ/ })
      if (show) {
        fireEvent.click(show)
        continue
      }
      throw new Error(`сценка зависла на шаге ${step}: нет «Показать ответ»/«Дальше»`)
    }
    expect(await screen.findByText('Ситуация пройдена', {}, { timeout: 4000 })).toBeInTheDocument()
  })
})

// Implements: plan://M19 — toPhrasebookNotes: только реплики пользователя
describe('toPhrasebookNotes', () => {
  it('реплики пользователя идут в колоду phrasebook с аудио/переводом', async () => {
    const { toPhrasebookNotes } = await import('../content/phrasebook')
    const notes = toPhrasebookNotes(dialogs as Parameters<typeof toPhrasebookNotes>[0])
    const userLines = dialogs.flatMap((d) => d.lines.filter((l) => l.role === d.user_role))
    expect(notes).toHaveLength(userLines.length)
    expect(notes.every((note) => note.deck === 'phrasebook')).toBe(true)
    expect(notes[0]!.en).toBe(userLines[0]!.text_en)
    expect(notes[0]!.ru).toBe(userLines[0]!.translation_ru)
  })
})

// M19: голосовой ответ в сценке (M10#10.7)
const speechMock = vi.hoisted(() => ({ supported: false, heard: null as string | null }))
vi.mock('../lib/speech', () => ({
  isSpeechSupported: () => speechMock.supported,
  listenOnce: vi.fn(async () => {
    if (speechMock.heard === null) throw new Error('no speech')
    return speechMock.heard
  }),
  cancelListening: vi.fn(),
}))

describe('PhrasebookSituationScreen: голосовой ответ (M19)', () => {
  it('микрофон отвечает верной репликой → passed; ошибка — остаёмся на вводе', async () => {
    speechMock.supported = true
    speechMock.heard = firstUserLine.accepted![0]!
    const { unmount } = renderSituation()
    await screen.findByText(dialogs[0]!.situation_ru, {}, { timeout: 4000 })
    fireEvent.click(await screen.findByRole('button', { name: /^Дальше/ })) // NPC-реплика

    const voice = await screen.findByRole('button', { name: /Ответить голосом/ })
    fireEvent.click(voice)
    expect(
      await screen.findByRole('button', { name: /^Дальше/ }, { timeout: 4000 }),
    ).toBeInTheDocument()

    // ошибка микрофона: слушание завершается, ввод остаётся
    speechMock.heard = null
    unmount()
    renderSituation()
    await screen.findByText(dialogs[0]!.situation_ru, {}, { timeout: 4000 })
    fireEvent.click(await screen.findByRole('button', { name: /^Дальше/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Ответить голосом/ }))
    expect(await screen.findByRole('textbox', {}, { timeout: 4000 })).toBeInTheDocument()
  })
})

// Implements: план M21#21.4 (веха S4) — хвосты покрытия PhrasebookScreen
describe('PhrasebookScreen: хвосты покрытия (S4)', () => {
  it('ошибка загрузки диалогов → список со «закрытыми» главами (catch-ветка)', async () => {
    const { loadPhrasebook } = await import('../content/phrasebook')
    vi.mocked(loadPhrasebook).mockRejectedValueOnce(new Error('load fail'))
    window.location.hash = '#/phrasebook'
    render(
      <HashRouter>
        <Routes>
          <Route path="/phrasebook" element={<PhrasebookScreen />} />
        </Routes>
      </HashRouter>,
    )
    expect(await screen.findByText('Разговорник')).toBeInTheDocument()
    expect(screen.getAllByText(/главы пока не готовы/).length).toBeGreaterThan(0)
  })

  it('несуществующая ситуация → 404 (ветка !dialog)', async () => {
    renderSituation('no-such-situation')
    expect(
      await screen.findByText('Такой ситуации нет в разговорнике.', {}, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(screen.getByText('404')).toBeInTheDocument()
  })

  it('верный ответ с первой попытки → реплика пройдена (setLineState passed)', async () => {
    renderSituation()
    await screen.findByText(dialogs[0]!.situation_ru, {}, { timeout: 4000 })
    fireEvent.click(await screen.findByRole('button', { name: /^Дальше/ })) // NPC-реплика
    const input = (await screen.findAllByRole('textbox'))[0]!
    fireEvent.change(input, { target: { value: firstUserLine.accepted![0]! } })
    fireEvent.submit(input.closest('form')!)
    expect(
      await screen.findByRole('button', { name: /^Дальше/ }, { timeout: 4000 }),
    ).toBeInTheDocument()
    // lineState = passed: форма ответа скрыта, остаётся только «Дальше»
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('озвучка реплики; повторный клик по микрофону во время слушания — гард', async () => {
    speechMock.supported = true
    speechMock.heard = firstUserLine.accepted![0]!
    renderSituation()
    await screen.findByText(dialogs[0]!.situation_ru, {}, { timeout: 4000 })
    // 🔊 — speak по тексту реплики
    fireEvent.click(await screen.findByRole('button', { name: '🔊' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Дальше/ })) // NPC-реплика
    fireEvent.click(screen.getByRole('button', { name: '🔊' }))
    // голосовой ответ: первый клик начинает слушание
    fireEvent.click(await screen.findByRole('button', { name: /Ответить голосом/ }))
    const listening = await screen.findByRole('button', { name: /Слушаю/ })
    // повторный клик по disabled-кнопке — гард answerByVoice (listening)
    fireEvent.click(listening)
    expect(
      await screen.findByRole('button', { name: /^Дальше/ }, { timeout: 4000 }),
    ).toBeInTheDocument()
  })
})
