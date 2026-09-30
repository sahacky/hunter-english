// Implements: plan://M12#12.7 — тесты упражнения transform (specs/02 §3 №14)
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TransformExercise } from './ExerciseView'
import type { ExerciseItem, PhraseItem } from '../../content/lessons'
import '../../i18n'

const source: PhraseItem = {
  id: 'ph-test-0001',
  text_en: 'He likes tea.',
  translation_ru: 'Ему нравится чай.',
  grammar_point_id: null,
  variants: ['He likes tea.'],
}

const negative: PhraseItem = {
  id: 'ph-test-0002',
  text_en: "He doesn't like tea.",
  translation_ru: 'Ему не нравится чай.',
  grammar_point_id: null,
  variants: ["He doesn't like tea."],
}

const question: PhraseItem = {
  id: 'ph-test-0003',
  text_en: 'Does he like tea?',
  translation_ru: 'Ему нравится чай?',
  grammar_point_id: null,
  variants: ['Does he like tea?'],
}

const exercise: ExerciseItem = {
  id: 'ex-d-9999',
  type: 'transform',
  payload: {
    kind: 'transform',
    source_phrase_id: 'ph-test-0001',
    steps: [
      { task: 'negative', phrase_id: 'ph-test-0002' },
      { task: 'question', phrase_id: 'ph-test-0003' },
    ],
  },
  answer: { normalization: 'default', typo: 'allow' },
  meta: { skill: 'grammar', xp: 3 },
}

const phrasesById = {
  'ph-test-0001': source,
  'ph-test-0002': negative,
  'ph-test-0003': question,
}

function setup() {
  const onAnswer = vi.fn()
  const onNext = vi.fn()
  render(
    <TransformExercise
      exercise={exercise}
      phrase={source}
      trap={null}
      onAnswer={onAnswer}
      onDispute={vi.fn()}
      onNext={onNext}
      phrasesById={phrasesById}
    />,
  )
  return { onAnswer, onNext }
}

describe('TransformExercise', () => {
  it('шаг 1: источник + задача отрицания; верный ответ ведёт к шагу 2', () => {
    const { onAnswer } = setup()
    expect(screen.getByText('He likes tea.')).toBeInTheDocument()
    expect(screen.getByText('Сделай отрицанием (−)')).toBeInTheDocument()
    expect(screen.getByText(/шаг 1 из 2/)).toBeInTheDocument()

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: "He doesn't like tea." } })
    fireEvent.click(screen.getByRole('button', { name: /Проверить/ }))
    expect(screen.getByText('Верно!')).toBeInTheDocument()
    expect(onAnswer).not.toHaveBeenCalled() // исход — только после всех шагов

    fireEvent.click(screen.getByRole('button', { name: /Дальше/ }))
    expect(screen.getByText("He doesn't like tea.")).toBeInTheDocument()
    expect(screen.getByText('Сделай вопросом (?)')).toBeInTheDocument()
  })

  it('все шаги с первой попытки → onAnswer("correct") и финал', () => {
    const { onAnswer, onNext } = setup()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: "He doesn't like tea." } })
    fireEvent.click(screen.getByRole('button', { name: /Проверить/ }))
    fireEvent.click(screen.getByRole('button', { name: /Дальше/ }))

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Does he like tea?' } })
    fireEvent.click(screen.getByRole('button', { name: /Проверить/ }))
    fireEvent.click(screen.getByRole('button', { name: /Дальше/ }))

    expect(onAnswer).toHaveBeenCalledWith('correct', 2)
    expect(onNext).not.toHaveBeenCalled() // ждём «Дальше» на финальном экране
    fireEvent.click(screen.getByRole('button', { name: /Дальше/ }))
    expect(onNext).toHaveBeenCalled()
  })

  it('ошибка + Retry со второй попытки → correct_retry по итогу', () => {
    const { onAnswer } = setup()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'He no like tea.' } })
    fireEvent.click(screen.getByRole('button', { name: /Проверить/ }))
    expect(screen.getByText('Неверно')).toBeInTheDocument()
    // неудача очищает ввод (retry): вторая попытка верна
    const input2 = screen.getByRole('textbox')
    fireEvent.change(input2, { target: { value: "He doesn't like tea." } })
    fireEvent.click(screen.getByRole('button', { name: /Проверить/ }))
    fireEvent.click(screen.getByRole('button', { name: /Дальше/ }))

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Does he like tea?' } })
    fireEvent.click(screen.getByRole('button', { name: /Проверить/ }))
    fireEvent.click(screen.getByRole('button', { name: /Дальше/ }))

    expect(onAnswer).toHaveBeenCalledWith('correct_retry', 3)
  })

  it('после двух неудач шага показывается эталон и цепочка идёт дальше', () => {
    const { onAnswer } = setup()
    const bad = 'wrong wrong wrong'
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: bad } })
    fireEvent.click(screen.getByRole('button', { name: /Проверить/ }))

    const input2 = screen.getByRole('textbox')
    fireEvent.change(input2, { target: { value: bad } })
    fireEvent.click(screen.getByRole('button', { name: /Проверить/ }))
    // после второй неудачи — эталон и «Дальше»
    expect(
      screen.getByText("He doesn't like tea.", { selector: '.lesson-ref' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Дальше/ }))
    expect(screen.getByText('Сделай вопросом (?)')).toBeInTheDocument()
    expect(onAnswer).not.toHaveBeenCalled()
  })
})

// M19: fallback при отсутствующей фразе шага
describe('TransformExercise: отсутствующие ссылки', () => {
  it('фраза шага не найдена → заглушка с «Дальше»', async () => {
    const broken: ExerciseItem = {
      ...exercise,
      payload: {
        kind: 'transform',
        source_phrase_id: 'ph-test-0001',
        steps: [{ task: 'negative', phrase_id: 'ph-missing-9999' }],
      },
    }
    render(
      <TransformExercise
        exercise={broken}
        phrase={null}
        trap={null}
        onAnswer={vi.fn()}
        onDispute={vi.fn()}
        onNext={vi.fn()}
        phrasesById={phrasesById}
      />,
    )
    expect(await screen.findByText(/Неизвестный тип упражнения/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Дальше/ })).toBeInTheDocument()
  })
})
