// Implements: plan://first-lessons-a0#V3 — тесты пре-урока «Азбука и первые слова».
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import '../i18n'
import { BASICS_LETTERS, BASICS_WORDS, basicsAudioSrc } from '../content/basics'
import BasicsScreen from './BasicsScreen'
import { speak as speakSpy } from '../lib/tts'

vi.mock('../lib/tts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/tts')>()),
  speak: vi.fn(),
  stopSpeak: vi.fn(),
}))

function renderScreen() {
  window.location.hash = '#/basics'
  return render(
    <HashRouter>
      <Routes>
        <Route path="/basics" element={<BasicsScreen />} />
        <Route path="/path" element={<div>ПРОГРАММА</div>} />
        <Route path="/lesson/:id" element={<div>УРОК</div>} />
      </Routes>
    </HashRouter>,
  )
}

describe('BasicsScreen (V3)', () => {
  beforeEach(() => {
    vi.mocked(speakSpy).mockClear()
  })
  it('алфавит: 26 букв, клик озвучивает через предзаписанный файл', () => {
    renderScreen()
    const letters = screen
      .getAllByRole('button', { name: /^([A-Z]|\s)/ })
      .filter((b) => b.className.includes('basics-letter'))
    expect(letters).toHaveLength(26)
    const first = BASICS_LETTERS[0]!
    fireEvent.click(screen.getByRole('button', { name: new RegExp(first.letter) }))
    expect(speakSpy).toHaveBeenCalledWith(first.letter, {
      src: basicsAudioSrc(`letter-${first.letter.toLowerCase()}`),
    })
  })

  it('тренажёр: верное слово → «Верно!», «Дальше» ведёт к следующему', () => {
    renderScreen()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: BASICS_WORDS[0]!.en } })
    fireEvent.click(screen.getByRole('button', { name: /Проверить/ }))
    expect(screen.getByText('Верно!')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Дальше/ }))
    expect(screen.getByText(BASICS_WORDS[1]!.ru)).toBeInTheDocument()
  })

  it('тренажёр: неверное → показываем правильное написание; Enter листает', () => {
    renderScreen()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'zzz' } })
    fireEvent.submit(input.closest('form')!)
    expect(screen.getByText(/Правильно так:/)).toBeInTheDocument()
    fireEvent.submit(input.closest('form')!)
    expect(screen.getByText(BASICS_WORDS[1]!.ru)).toBeInTheDocument()
  })

  it('озвучка слова — кнопка 🔊 с файлом', () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Прослушать' }))
    expect(speakSpy).toHaveBeenCalledWith(BASICS_WORDS[0]!.en, {
      src: basicsAudioSrc(`word-${BASICS_WORDS[0]!.en}`),
    })
  })

  it('после последнего слова — «Начать урок E-01» ведёт в урок', () => {
    renderScreen()
    for (const word of BASICS_WORDS) {
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: word.en } })
      fireEvent.submit(input.closest('form')!)
      fireEvent.click(screen.getByRole('button', { name: /^Дальше/ }))
    }
    expect(screen.getByText('Все слова пройдены!')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Начать урок E-01/ }))
    expect(window.location.hash).toBe('#/lesson/E-01')
  })

  it('пропуск → к программе', () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /Пропустить/ }))
    expect(window.location.hash).toBe('#/path')
  })
})
