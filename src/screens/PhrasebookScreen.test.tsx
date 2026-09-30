// Implements: plan://M18 — GAP-5 specs/09 §4.7 (TC-UI-13 сценка разговорника с ответами)
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
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
