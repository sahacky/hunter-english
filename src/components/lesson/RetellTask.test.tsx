// Implements: plan://teaching-quality#Q3.1 — тесты RetellTask (обратный цикл EN→RU→EN)
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import '../../i18n'
import { RetellTask } from './RetellTask'
import type { PhraseItem } from '../../content/lessons'

const phrase = {
  id: 'ph-e-0001',
  text_en: 'She is from Japan.',
  translation_ru: 'Она из Японии.',
  grammar_point_id: 'gp-e-01',
  variants: ['She is from Japan.'],
  audio: { en_gb: 'audio/phrases/cori/ph-e-0001.opus' },
} as PhraseItem

function renderTask(phraseOverride: PhraseItem | null = phrase) {
  const onAnswer = vi.fn()
  const onNext = vi.fn()
  render(
    <HashRouter>
      <RetellTask phrase={phraseOverride} onAnswer={onAnswer} onNext={onNext} />
    </HashRouter>,
  )
  return { onAnswer, onNext }
}

describe('RetellTask (план {#teaching-quality} Q3.1)', () => {
  it('флоу: слушаем → RU-пересказ → EN по-своему → self_reported', () => {
    const { onAnswer, onNext } = renderTask()
    expect(screen.getByText('Обратный цикл: EN → RU → EN')).toBeInTheDocument()
    expect(screen.getByText(/Прослушай фразу урока/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /🔊/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Понял\(а\) — перескажу/ }))
    expect(
      screen.getByText('Перескажи смысл фразы по-русски — своими словами.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Смысл: Она из Японии\./)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Сказал(-а)' }))
    expect(screen.getByText(/снова по-английски — по-своему/)).toBeInTheDocument()
    expect(screen.getByText(/Эталон: She is from Japan\./)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Сказал своими словами' }))
    expect(onAnswer).toHaveBeenCalledWith('self_reported', 1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('фразы нет — задание пропускается без ответа', () => {
    const { onAnswer, onNext } = renderTask(null)
    expect(screen.getByText(/Фраза цикла не найдена/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Дальше/ }))
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onAnswer).not.toHaveBeenCalled()
  })
})
