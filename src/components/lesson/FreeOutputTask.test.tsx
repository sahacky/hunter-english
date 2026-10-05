// Implements: plan://teaching-quality#Q1.5 — тесты FreeOutputTask («60 сек без сверки»)
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import '../../i18n'
import { FreeOutputTask } from './FreeOutputTask'
import type { ExerciseOutcome } from '../../domain/lesson/types'

const PROPS = {
  seconds: 60,
  checklistRu: ['как проходил(а) регистрацию', 'что было с багажом', 'нашёл(ла) ли выход'],
  promptEn: 'Tell me about your last flight.',
  situationRu: 'Монолог (60 сек без сверки): последний полёт. Исход: история рассказана.',
  hintRu: 'Помогут паттерны: First I…, then…',
}

function renderTask(onAnswer: (outcome: ExerciseOutcome, attempts: number) => void = vi.fn()) {
  const onNext = vi.fn()
  render(
    <HashRouter>
      <FreeOutputTask {...PROPS} onAnswer={onAnswer} onNext={onNext} />
    </HashRouter>,
  )
  return { onAnswer, onNext }
}

describe('FreeOutputTask (план {#teaching-quality} Q1.5)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('idle: тема EN, ситуация с исходом, подсказка; старт открывает таймер', () => {
    renderTask()
    expect(screen.getByText('Tell me about your last flight.')).toBeInTheDocument()
    expect(screen.getByText(/Монолог \(60 сек без сверки\)/)).toBeInTheDocument()
    expect(screen.getByText(/First I…/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Начать монолог/ }))
    expect(screen.getByRole('timer')).toHaveTextContent('Осталось: 60 сек')
  })

  it('speaking: «Я закончил(а)» — досрочный переход к чек-листу', () => {
    renderTask()
    fireEvent.click(screen.getByRole('button', { name: /Начать монолог/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Я закончил(а)' }))
    expect(screen.getByText('Отметь, что удалось')).toBeInTheDocument()
    // пункт чек-листа = чекбокс; текст пункта — внутри label (input + текст)
    expect(screen.getAllByRole('checkbox')).toHaveLength(PROPS.checklistRu.length)
    expect(screen.getByText(/багажом/)).toBeInTheDocument()
  })

  it('чек-лист: чекбоксы кликабельны; «Готово» → self_reported + onNext', () => {
    const { onAnswer, onNext } = renderTask()
    fireEvent.click(screen.getByRole('button', { name: /Начать монолог/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Я закончил(а)' }))
    const box = screen.getAllByRole('checkbox')[0]!
    fireEvent.click(box)
    expect(box).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }))
    expect(onAnswer).toHaveBeenCalledWith('self_reported', 1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('таймер: по истечении — авто-переход к чек-листу', () => {
    vi.useFakeTimers()
    renderTask()
    fireEvent.click(screen.getByRole('button', { name: /Начать монолог/ }))
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByText('Отметь, что удалось')).toBeInTheDocument()
  })
})
