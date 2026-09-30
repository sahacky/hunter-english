// Implements: plan://M18 — GAP-5 specs/09 §4.7 (TC-UI-13 сценка разговорника с ответами)
import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import smalltalk from '../../data/phrasebook/smalltalk.json'
import '../i18n'
import PhrasebookScreen, { PhrasebookSituationScreen } from './PhrasebookScreen'

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
  it('список: все 10 ситуаций, карточки ведут на главы', async () => {
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
      10,
    )
    // контент всех глав уже поставлен (M8–M14) — ни одна карточка не «закрыта»
    expect(screen.queryByText(/главы пока не готовы/)).not.toBeInTheDocument()
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
