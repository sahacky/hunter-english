// Implements: plan://M19 — покрытие ExerciseView (specs/09 §3: все типы упражнений)
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ExerciseItem } from '../../content/lessons'
import type { PhraseItem } from '../../content/lessons'
import '../../i18n'
import {
  ChooseTranslationExercise,
  FeedbackPlate,
  InputCheckExercise,
  MatchPairsExercise,
  VoiceExercise,
  WordBankExercise,
} from './ExerciseView'
import type { CheckResult } from '../../domain/check/types'

vi.mock('../../lib/tts', () => ({ speak: vi.fn(), stopSpeak: vi.fn() }))
const speechMock = vi.hoisted(() => ({
  supported: false,
  heard: null as string | null,
  fail: false,
}))
vi.mock('../../lib/speech', () => ({
  isSpeechSupported: () => speechMock.supported,
  listenOnce: vi.fn(async () => {
    if (speechMock.fail) throw new Error('no speech')
    if (speechMock.heard === null) throw new Error('empty')
    return speechMock.heard
  }),
  cancelListening: vi.fn(),
}))

function ex(type: string, payload: Record<string, unknown>): ExerciseItem {
  return {
    id: `ex-test-${type}`,
    type,
    payload: { kind: type, ...payload },
    answer: { normalization: 'default', typo: 'allow' },
    meta: { skill: 'grammar', xp: 2 },
  } as ExerciseItem
}

const phrase: PhraseItem = {
  id: 'ph-test-0001',
  text_en: 'The house is big',
  translation_ru: 'Дом большой',
  grammar_point_id: 'gp-test',
  variants: ['The house is big'],
  audio: { en_gb: 'audio/phrases/cori/ph-test-0001.opus' },
} as PhraseItem

const spy = () => {
  const calls: { outcome: string; attempts: number }[] = []
  const next = vi.fn()
  return {
    calls,
    onAnswer: vi.fn((outcome: string, attempts: number) => calls.push({ outcome, attempts })),
    onNext: next,
    onDispute: vi.fn(),
  }
}

beforeEach(() => {
  speechMock.supported = false
  speechMock.heard = null
  speechMock.fail = false
})

describe('InputCheckExercise', () => {
  it('верный ответ с первой попытки → correct, без «Ещё попытка»', async () => {
    const s = spy()
    render(
      <InputCheckExercise
        mode="translate"
        exercise={ex('translate', { prompt_ru: 'Дом большой', phrase_id: phrase.id })}
        phrase={phrase}
        trap={null}
        onAnswer={s.onAnswer}
        onDispute={vi.fn()}
        onNext={s.onNext}
      />,
    )
    const input = document.querySelector<HTMLInputElement>('.lesson-input')!
    fireEvent.change(input, { target: { value: 'The house is big' } })
    fireEvent.submit(input.closest('form')!)
    expect(await screen.findByText('Верно!')).toBeInTheDocument()
    expect(s.calls).toEqual([{ outcome: 'correct', attempts: 1 }])
    fireEvent.click(screen.getByRole('button', { name: /^Дальше/ }))
    expect(s.onNext).toHaveBeenCalledTimes(1)
  })

  it('ошибка → «Ещё попытка», вторая ошибка → skip + эталон + dispute', async () => {
    const s = spy()
    render(
      <InputCheckExercise
        mode="translate"
        exercise={ex('translate', { prompt_ru: 'Дом большой', phrase_id: phrase.id })}
        phrase={phrase}
        trap={null}
        onAnswer={s.onAnswer}
        onDispute={s.onDispute}
        onNext={s.onNext}
      />,
    )
    const submit = () => {
      const input = document.querySelector<HTMLInputElement>('.lesson-input')!
      fireEvent.change(input, { target: { value: 'zzz' } })
      fireEvent.submit(input.closest('form')!)
    }
    submit()
    expect(await screen.findByText('Неверно')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ещё попытка/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Ещё попытка/ }))
    submit()
    expect(
      await screen.findByText('The house is big', { selector: '.lesson-ref' }),
    ).toBeInTheDocument()
    expect(s.calls).toEqual([{ outcome: 'skip', attempts: 2 }])
    fireEvent.click(screen.getByRole('button', { name: /Я был прав/ }))
    expect(s.onDispute).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/ответ оспорен/)).toBeInTheDocument()
  })

  it('опечатка → correct_typo; подсказка раскрывает первое слово и гасит XP', async () => {
    const s = spy()
    render(
      <InputCheckExercise
        mode="translate"
        exercise={ex('translate', { prompt_ru: 'Дом большой', phrase_id: phrase.id })}
        phrase={phrase}
        trap={null}
        onAnswer={s.onAnswer}
        onDispute={vi.fn()}
        onNext={s.onNext}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Подсказка/ }))
    const input = document.querySelector<HTMLInputElement>('.lesson-input')!
    expect(input.value).toBe('The ')
    expect(screen.getByText(/Подсказка открыта/)).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'The hous is big' } })
    fireEvent.submit(input.closest('form')!)
    expect(await screen.findByText(/Верно \(с опечаткой\)/)).toBeInTheDocument()
    expect(s.calls).toEqual([{ outcome: 'hint', attempts: 1 }])
  })

  it('dictation: кнопки озвучки с лимитом, ввод по слуху', async () => {
    const s = spy()
    render(
      <InputCheckExercise
        mode="dictation"
        exercise={ex('dictation', { phrase_id: phrase.id })}
        phrase={phrase}
        trap={null}
        onAnswer={s.onAnswer}
        onDispute={vi.fn()}
        onNext={s.onNext}
      />,
    )
    // аудио-кнопки 🔊/🐢 с счётчиком 3/3
    expect(screen.getByText('3/3')).toBeInTheDocument()
    const input = document.querySelector<HTMLInputElement>('.lesson-input')!
    fireEvent.change(input, { target: { value: 'house is big' } }) // артикль прощается
    fireEvent.submit(input.closest('form')!)
    expect(await screen.findByText(/Верно \(с опечаткой\)/)).toBeInTheDocument()
  })

  it('verb_tense показывает маркер; find_error — подсказку', () => {
    const { rerender } = render(
      <InputCheckExercise
        mode="verb_tense"
        exercise={ex('verb_tense', {
          sentence_with_gap: 'She ___ every day. (работать)',
          marker: 'форма',
          gap_answers: ['works'],
        })}
        phrase={null}
        trap={null}
        onAnswer={vi.fn()}
        onDispute={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    expect(screen.getByText(/Маркер времени: форма/)).toBeInTheDocument()
    rerender(
      <InputCheckExercise
        mode="find_error"
        exercise={ex('find_error', { wrong_en: 'She work every day.', hint_ru: 'Работает' })}
        phrase={null}
        trap={null}
        onAnswer={vi.fn()}
        onDispute={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    expect(screen.getByText(/Найди и исправь ошибку/)).toBeInTheDocument()
  })

  it('cloze с цитатой: источник + вторая сессия ввода по Enter ведёт к onNext', async () => {
    const s = spy()
    render(
      <InputCheckExercise
        mode="cloze"
        exercise={ex('cloze', {
          text_with_gap: 'Friends ___ lie.',
          gap_answers: ["don't"],
          quote: { title: 'Stranger Things', season_episode: 'S1E1' },
        })}
        phrase={null}
        trap={null}
        onAnswer={s.onAnswer}
        onDispute={vi.fn()}
        onNext={s.onNext}
      />,
    )
    expect(screen.getByText(/Stranger Things · S1E1/)).toBeInTheDocument()
    const input = document.querySelector<HTMLInputElement>('.lesson-input')!
    fireEvent.change(input, { target: { value: "don't" } })
    fireEvent.submit(input.closest('form')!)
    expect(await screen.findByText('Верно!')).toBeInTheDocument()
    // Enter на finished-инпуте = Дальше (§5.1)
    fireEvent.submit(input.closest('form')!)
    expect(s.onNext).toHaveBeenCalledTimes(1)
  })
})

describe('ChooseTranslationExercise', () => {
  it('верный и неверный выбор', async () => {
    const s = spy()
    const { unmount } = render(
      <ChooseTranslationExercise
        exercise={ex('choose_translation', {
          prompt: 'Дом',
          options: ['house', 'water', 'friend'],
          correct: 0,
        })}
        phrase={null}
        trap={null}
        onAnswer={s.onAnswer}
        onDispute={vi.fn()}
        onNext={s.onNext}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'water' }))
    expect(await screen.findByText('Неверно')).toBeInTheDocument()
    expect(s.calls).toEqual([{ outcome: 'skip', attempts: 1 }])
    fireEvent.click(screen.getByRole('button', { name: /^Дальше/ }))
    unmount()

    const s2 = spy()
    render(
      <ChooseTranslationExercise
        exercise={ex('choose_translation', {
          prompt: 'Дом',
          options: ['house', 'water'],
          correct: 0,
        })}
        phrase={null}
        trap={null}
        onAnswer={s2.onAnswer}
        onDispute={vi.fn()}
        onNext={s2.onNext}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'house' }))
    expect(await screen.findByText('Верно!')).toBeInTheDocument()
    expect(s2.calls).toEqual([{ outcome: 'correct', attempts: 1 }])
    unmount()
  })
})

describe('MatchPairsExercise', () => {
  const pairs = [
    { en: 'house', ru: 'дом' },
    { en: 'water', ru: 'вода' },
    { en: 'friend', ru: 'друг' },
  ]

  it('соединение без ошибок → correct; с ошибками → correct_retry', async () => {
    const s = spy()
    render(
      <MatchPairsExercise
        exercise={ex('match_pairs', { pairs })}
        phrase={null}
        trap={null}
        onAnswer={s.onAnswer}
        onDispute={vi.fn()}
        onNext={s.onNext}
      />,
    )
    const en = (name: string) => screen.getByRole('button', { name })
    // ошибка: выбрали «вода», кликнули house
    fireEvent.click(screen.getByRole('button', { name: 'вода' }))
    fireEvent.click(en('house'))
    // верные пары
    for (const { en: e, ru } of pairs) {
      fireEvent.click(screen.getByRole('button', { name: ru }))
      fireEvent.click(en(e))
    }
    expect(await screen.findByText(/Готово \(ошибок: 1\)/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Дальше/ }))
    expect(s.calls).toEqual([{ outcome: 'correct_retry', attempts: 1 }])
    expect(s.onNext).toHaveBeenCalledTimes(1)
  })

  it('повторный клик по выбранной RU снимает выбор', () => {
    render(
      <MatchPairsExercise
        exercise={ex('match_pairs', { pairs })}
        phrase={null}
        trap={null}
        onAnswer={vi.fn()}
        onDispute={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    const ru = screen.getByRole('button', { name: 'дом' })
    fireEvent.click(ru)
    expect(ru).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(ru)
    expect(ru).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('WordBankExercise', () => {
  /** Клик по свободной (не used) плитке банка — слоты и банк делят имя. */
  function clickBankTile(token: string) {
    const tile = screen
      .getAllByRole('button', { name: token })
      .find((button) => !button.hasAttribute('disabled'))
    if (!tile) throw new Error(`нет свободной плитки «${token}»`)
    fireEvent.click(tile)
  }

  function renderBank(tokens: string[], order: string[], s = spy()) {
    const view = render(
      <WordBankExercise
        exercise={ex('word_bank', {
          prompt_ru: phrase.translation_ru,
          tokens,
          phrase_id: phrase.id,
        })}
        phrase={phrase}
        trap={null}
        onAnswer={s.onAnswer}
        onDispute={vi.fn()}
        onNext={s.onNext}
      />,
    )
    for (const token of order) clickBankTile(token)
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }))
    return { ...s, view }
  }

  it('верная сборка с первой попытки → correct', async () => {
    const s = renderBank(['The', 'house', 'is', 'big', 'extra'], ['The', 'house', 'is', 'big'])
    expect(await screen.findByText('Верно!')).toBeInTheDocument()
    expect(s.calls).toEqual([{ outcome: 'correct', attempts: 1 }])
  })

  it('неверная сборка → пересборка; вторая ошибка → reveal + skip + dispute', async () => {
    const s = spy()
    render(
      <WordBankExercise
        exercise={ex('word_bank', {
          prompt_ru: phrase.translation_ru,
          tokens: ['The', 'house', 'is', 'big'],
          phrase_id: phrase.id,
        })}
        phrase={phrase}
        trap={null}
        onAnswer={s.onAnswer}
        onDispute={vi.fn()}
        onNext={s.onNext}
      />,
    )
    for (const token of ['is', 'The', 'big', 'house']) clickBankTile(token)
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }))
    expect(await screen.findByText('Неверно')).toBeInTheDocument()
    // пересборка: снимаем плитки по одной (DOM обновляется после каждого клика)
    let guard = 0
    while (guard < 10) {
      const slot = screen
        .getAllByRole('button')
        .find((b) => b.className.includes('lesson-tile-slot') && !b.hasAttribute('disabled'))
      if (!slot) break
      fireEvent.click(slot)
      guard += 1
    }
    for (const token of ['The', 'house', 'is', 'big']) clickBankTile(token)
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }))
    expect(await screen.findByText(/Верно \(с опечаткой\)|Верно!/)).toBeInTheDocument()
    expect(s.calls).toEqual([{ outcome: 'correct_retry', attempts: 2 }])
  })

  it('Backspace возвращает последнюю плитку', () => {
    render(
      <WordBankExercise
        exercise={ex('word_bank', {
          prompt_ru: phrase.translation_ru,
          tokens: ['The', 'house'],
          phrase_id: phrase.id,
        })}
        phrase={phrase}
        trap={null}
        onAnswer={vi.fn()}
        onDispute={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'The' }))
    fireEvent.click(screen.getByRole('button', { name: 'house' }))
    expect(screen.getAllByRole('button', { name: 'house' }).length).toBe(2) // слот + банк
    fireEvent.keyDown(window, { key: 'Backspace' })
    fireEvent.keyDown(window, { key: 'Backspace' })
    expect(screen.getByText(/Собери фразу из плиток/)).toBeInTheDocument()
  })
})

describe('VoiceExercise', () => {
  const voiceEx = () => ex('speak', { prompt_ru: 'Дом большой', phrase_id: phrase.id })

  it('микрофон недоступен: самопроверка «Сказал(-а)» → onNext', async () => {
    const s = spy()
    render(
      <VoiceExercise
        mode="speak"
        exercise={voiceEx()}
        phrase={phrase}
        trap={null}
        onAnswer={s.onAnswer}
        onDispute={vi.fn()}
        onNext={s.onNext}
      />,
    )
    expect(screen.getByText(/Микрофон недоступен/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Сказал\(-а\)/ }))
    expect(s.calls).toEqual([{ outcome: 'self_reported', attempts: 1 }])
    expect(s.onNext).toHaveBeenCalledTimes(1)
  })

  it('распознавание верное с первой попытки → correct', async () => {
    speechMock.supported = true
    speechMock.heard = 'The house is big'
    const s = spy()
    render(
      <VoiceExercise
        mode="speak"
        exercise={voiceEx()}
        phrase={phrase}
        trap={null}
        onAnswer={s.onAnswer}
        onDispute={vi.fn()}
        onNext={s.onNext}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Скажи/ }))
    expect(await screen.findByText('Верно!')).toBeInTheDocument()
    expect(s.calls).toEqual([{ outcome: 'correct', attempts: 1 }])
  })

  it('распознавание ошиблось → retry-плашка; после 2 неудач текст = correct', async () => {
    speechMock.supported = true
    speechMock.heard = 'totally wrong words'
    const s = spy()
    render(
      <VoiceExercise
        mode="speak"
        exercise={voiceEx()}
        phrase={phrase}
        trap={null}
        onAnswer={s.onAnswer}
        onDispute={vi.fn()}
        onNext={s.onNext}
      />,
    )
    const say = screen.getByRole('button', { name: /Скажи/ })
    fireEvent.click(say)
    await screen.findAllByText(/Не расслышало|Попытки не ограничены/)
    fireEvent.click(say)
    await screen.findAllByText(/Не расслышало|Попытки не ограничены/)
    // фолбэк текстом после 2 неудач — полный XP (specs/02 §3 №3)
    fireEvent.click(screen.getByRole('button', { name: /Ввести текстом/ }))
    const input = document.querySelector<HTMLInputElement>('.lesson-input')!
    fireEvent.change(input, { target: { value: 'The house is big' } })
    fireEvent.submit(input.closest('form')!)
    expect(await screen.findByText('Верно!')).toBeInTheDocument()
    expect(s.calls).toEqual([{ outcome: 'correct', attempts: 3 }])
  })

  it('микрофон бросил ошибку → попытки растут, слушание сбрасывается', async () => {
    speechMock.supported = true
    speechMock.fail = true
    const s = spy()
    render(
      <VoiceExercise
        mode="speak"
        exercise={voiceEx()}
        phrase={phrase}
        trap={null}
        onAnswer={s.onAnswer}
        onDispute={vi.fn()}
        onNext={s.onNext}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Скажи/ }))
    await waitForIdle()
    expect(screen.getByRole('button', { name: /Скажи/ })).toBeInTheDocument()
    expect(s.onAnswer).not.toHaveBeenCalled()
  })

  it('5 неудачных попыток → «Сдаться» (0 XP), mode=answer без сдачи', async () => {
    speechMock.supported = true
    speechMock.fail = true
    const s = spy()
    const { rerender } = render(
      <VoiceExercise
        mode="speak"
        exercise={voiceEx()}
        phrase={phrase}
        trap={null}
        onAnswer={s.onAnswer}
        onDispute={vi.fn()}
        onNext={s.onNext}
      />,
    )
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: /Скажи/ }))
      await waitForIdle()
    }
    const giveUp = screen.getByRole('button', { name: /Сдаться/ })
    fireEvent.click(giveUp)
    expect(s.calls).toEqual([{ outcome: 'skip', attempts: 5 }])
    expect(s.onNext).toHaveBeenCalledTimes(1)

    // answer-режим: кнопки сдачи нет
    rerender(
      <VoiceExercise
        mode="answer"
        exercise={ex('answer_question', {
          question_en: 'Where is the house?',
          phrase_id: phrase.id,
        })}
        phrase={phrase}
        trap={null}
        onAnswer={s.onAnswer}
        onDispute={vi.fn()}
        onNext={s.onNext}
      />,
    )
    expect(screen.queryByRole('button', { name: /Сдаться/ })).not.toBeInTheDocument()
    expect(screen.getByText('Where is the house?')).toBeInTheDocument()
  })

  it('shadowing: аудио-кнопки + промт фразой', () => {
    render(
      <VoiceExercise
        mode="shadowing"
        exercise={ex('shadowing', { phrase_id: phrase.id })}
        phrase={phrase}
        trap={null}
        onAnswer={vi.fn()}
        onDispute={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    expect(screen.getByText('The house is big')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /🔊/ })).toBeInTheDocument()
  })
})

describe('FeedbackPlate', () => {
  it('diff с пропущенным словом (+слово) и ловушкой', () => {
    const result = {
      verdict: 'wrong',
      ref: 'The house is big',
      diff: [
        { status: 'match', word: 'The' },
        { status: 'missing', word: 'house' },
        { status: 'typo', word: 'hus', ref: 'house' },
      ],
      trapTriggered: true,
    } as unknown as CheckResult
    render(<FeedbackPlate result={result} phrase={null} />)
    expect(screen.getByText('+house')).toBeInTheDocument()
    expect(screen.getByText(/hus → house/)).toBeInTheDocument()
    expect(screen.getByText(/Сработала ловушка/)).toBeInTheDocument()
  })

  it('без onDispute кнопки «Я был прав» нет', () => {
    const result = {
      verdict: 'wrong',
      ref: 'x',
      diff: [],
      trapTriggered: false,
    } as unknown as CheckResult
    render(<FeedbackPlate result={result} phrase={null} showReference={false} />)
    expect(screen.queryByRole('button', { name: /Я был прав/ })).not.toBeInTheDocument()
  })
})

function waitForIdle() {
  return new Promise((resolve) => setTimeout(resolve, 30))
}

// M19: хвосты ExerciseView (аудио-кнопки, гарды, пустой ввод)
describe('ExerciseView: хвосты (M19)', () => {
  it('AudioButtons: клики 🔊/🐢, лимит 3 прослушиваний, клавиши r/s', async () => {
    const { speak } = await import('../../lib/tts')
    render(
      <InputCheckExercise
        mode="dictation"
        exercise={ex('dictation', { phrase_id: phrase.id })}
        phrase={phrase}
        trap={null}
        onAnswer={vi.fn()}
        onDispute={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    const slow = screen.getByRole('button', { name: /🐢/ })
    fireEvent.click(screen.getByRole('button', { name: /🔊/ }))
    expect(speak).toHaveBeenCalled()
    fireEvent.click(slow)
    fireEvent.keyDown(window, { key: 'r' })
    fireEvent.keyDown(window, { key: 's' })
    fireEvent.keyDown(window, { key: 'r', repeat: true }) // повтор — игнор
    fireEvent.keyDown(window, { key: 'r', ctrlKey: true }) // модификатор — игнор
    expect(screen.getByText('0/3')).toBeInTheDocument() // лимит исчерпан
  })

  it('match_pairs: клик по EN без выбранной RU — no-op', () => {
    render(
      <MatchPairsExercise
        exercise={ex('match_pairs', {
          pairs: [
            { en: 'house', ru: 'дом' },
            { en: 'water', ru: 'вода' },
          ],
        })}
        phrase={null}
        trap={null}
        onAnswer={vi.fn()}
        onDispute={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'house' }))
    // ничего не подобралось, обе колонки активны
    expect(screen.getByRole('button', { name: 'дом' })).not.toHaveAttribute('disabled')
  })

  it('voice: пустой текстовый ввод не проверяется (guard)', async () => {
    speechMock.supported = true
    speechMock.fail = true
    render(
      <VoiceExercise
        mode="speak"
        exercise={ex('speak', { prompt_ru: 'Дом', phrase_id: phrase.id })}
        phrase={phrase}
        trap={null}
        onAnswer={vi.fn()}
        onDispute={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Скажи/ }))
    await waitForIdle()
    fireEvent.click(screen.getByRole('button', { name: /Ввести текстом/ }))
    const input = document.querySelector<HTMLInputElement>('.lesson-input')!
    fireEvent.submit(input.closest('form')!) // пустое значение — guard
    expect(screen.queryByText(/Верно|Неверно/)).not.toBeInTheDocument()
  })

  it('сценка B-27: ситуация, аудио собеседника, подсказка и «Сказал своими словами» сразу', async () => {
    speechMock.supported = true
    speechMock.heard = null
    const scene = ex('answer_question', {
      question_en: 'Have you ever been abroad?',
      situation_ru: 'Раунд 1 из 2 — Путешествия: опыт',
      audio: 'audio/phrasebook/cori/pb-smalltalk-03-l0.opus',
      free_form: true,
    })
    scene.answer = {
      normalization: 'default',
      typo: 'allow',
      accepted: ['Yes, I have been to three countries.', 'I have been to three countries.'],
      speech_threshold: 0.85,
      hint_ru: 'Импровизация: засчитывается любой уместный ответ — можно своими словами.',
    }
    const s = spy()
    render(
      <VoiceExercise
        mode="answer"
        exercise={scene}
        phrase={null}
        trap={null}
        onAnswer={s.onAnswer}
        onDispute={s.onDispute}
        onNext={s.onNext}
      />,
    )
    expect(screen.getByText('Раунд 1 из 2 — Путешествия: опыт')).toBeInTheDocument()
    expect(screen.getByText('Have you ever been abroad?')).toBeInTheDocument()
    expect(screen.getByText(/Импровизация: засчитывается любой/)).toBeInTheDocument()
    // предзаписанная реплика собеседника — кнопки 🔊/🐢 без лимита прослушиваний
    expect(screen.getByRole('button', { name: /🔊/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /🐢/ })).toBeInTheDocument()
    // микрофон доступен и попыток 0, но free_form: самопроверка сразу (B-27)
    fireEvent.click(screen.getByRole('button', { name: 'Сказал своими словами' }))
    expect(s.calls).toEqual([{ outcome: 'self_reported', attempts: 1 }])
    expect(s.onNext).toHaveBeenCalledTimes(1)
  })

  it('сценка B-27: голос дал верный ответ → correct (эталоны из accepted[])', async () => {
    speechMock.supported = true
    speechMock.heard = 'Yes, I have been to three countries.'
    const scene = ex('answer_question', {
      question_en: 'Have you ever been abroad?',
      situation_ru: 'Раунд 1 из 2 — Путешествия: опыт',
      free_form: true,
    })
    scene.answer = {
      normalization: 'default',
      typo: 'allow',
      accepted: ['Yes, I have been to three countries.'],
      speech_threshold: 0.85,
    }
    const s = spy()
    render(
      <VoiceExercise
        mode="answer"
        exercise={scene}
        phrase={null}
        trap={null}
        onAnswer={s.onAnswer}
        onDispute={s.onDispute}
        onNext={s.onNext}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Скажи/ }))
    expect(await screen.findByText('Верно!')).toBeInTheDocument()
    expect(s.calls).toEqual([{ outcome: 'correct', attempts: 1 }])
  })
})

// Implements: план M21#21.4 (веха S4) — хвосты покрытия ExerciseView
describe('ExerciseView: хвосты покрытия (S4)', () => {
  it('клавиши r/s игнорируются при фокусе в поле ввода (гард AudioButtons)', () => {
    render(
      <InputCheckExercise
        mode="dictation"
        exercise={ex('dictation', { phrase_id: phrase.id })}
        phrase={phrase}
        trap={null}
        onAnswer={vi.fn()}
        onDispute={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    const input = document.querySelector<HTMLInputElement>('.lesson-input')!
    fireEvent.keyDown(input, { key: 'r' }) // таргет — input → хоткей заглушён
    fireEvent.keyDown(input, { key: 's' })
    expect(screen.getByText('3/3')).toBeInTheDocument() // лимит прослушиваний не потрачен
  })

  it('клик по использованной плитке не меняет банк (гард put index=-1)', () => {
    render(
      <WordBankExercise
        exercise={ex('word_bank', {
          prompt_ru: phrase.translation_ru,
          tokens: ['The', 'house'],
          phrase_id: phrase.id,
        })}
        phrase={phrase}
        trap={null}
        onAnswer={vi.fn()}
        onDispute={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'The' }))
    // плитка The теперь used/disabled — повторный клик не должен ни снять её, ни задублить слот
    const usedBankTile = screen
      .getAllByRole('button', { name: 'The' })
      .find((b) => b.hasAttribute('disabled'))!
    fireEvent.click(usedBankTile)
    // слот один: The; bank: The (disabled), house
    expect(screen.getAllByRole('button', { name: 'The' })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'house' })).toBeInTheDocument()
  })

  it('гарды WordBank: Backspace на пустых слотах, двойная проверка, клики после финиша', async () => {
    const s = spy()
    render(
      <WordBankExercise
        exercise={ex('word_bank', {
          prompt_ru: phrase.translation_ru,
          tokens: ['The', 'house', 'is', 'big'],
          phrase_id: phrase.id,
        })}
        phrase={phrase}
        trap={null}
        onAnswer={s.onAnswer}
        onDispute={vi.fn()}
        onNext={s.onNext}
      />,
    )
    // Backspace при пустых слотах — removeSlot(-1), токен undefined → return
    fireEvent.keyDown(window, { key: 'Backspace' })
    expect(screen.getByText(/Собери фразу из плиток/)).toBeInTheDocument()
    for (const token of ['The', 'house', 'is', 'big']) {
      fireEvent.click(
        screen.getAllByRole('button', { name: token }).find((b) => !b.hasAttribute('disabled'))!,
      )
    }
    // двойной клик по «Проверить» без промежуточного рендера: второй упирается в busyRef-гард
    const check = screen.getByRole('button', { name: 'Проверить' })
    act(() => {
      check.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      check.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(await screen.findByText('Верно!')).toBeInTheDocument()
    expect(s.calls).toEqual([{ outcome: 'correct', attempts: 1 }]) // onAnswer ровно один раз
    // после финиша клики по disabled плиткам — гарды finished (put/removeSlot)
    fireEvent.click(
      screen.getAllByRole('button', { name: 'house' }).find((b) => b.hasAttribute('disabled'))!,
    )
    fireEvent.click(
      screen.getAllByRole('button').find((b) => b.className.includes('lesson-tile-slot'))!,
    )
    expect(s.calls).toEqual([{ outcome: 'correct', attempts: 1 }])
  })

  it('клик по микрофону после завершения — гард listen (done)', async () => {
    speechMock.supported = true
    speechMock.heard = 'The house is big'
    const s = spy()
    render(
      <VoiceExercise
        mode="speak"
        exercise={ex('speak', { prompt_ru: 'Дом большой', phrase_id: phrase.id })}
        phrase={phrase}
        trap={null}
        onAnswer={s.onAnswer}
        onDispute={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Скажи/ }))
    expect(await screen.findByText('Верно!')).toBeInTheDocument()
    // кнопка задизейплена (done) — повторный клик не должен ни слушать, ни отвечать
    fireEvent.click(screen.getByRole('button', { name: /Скажи/ }))
    expect(s.calls).toEqual([{ outcome: 'correct', attempts: 1 }])
  })
})
