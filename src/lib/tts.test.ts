// Implements: plan://M6#6.1 — тесты TTS-шлюза (моки speechSynthesis/Audio)
// init-фейк: существует только на время инициализации модуля tts, чтобы
// выполнилась подписка onvoiceschanged (веха S4); сразу после импорта убираем,
// чтобы не влиять на существующие тесты фолбэка.
const initSynth = vi.hoisted(() => {
  const synth = {
    speak: () => undefined,
    cancel: () => undefined,
    getVoices: () => [] as unknown[],
    onvoiceschanged: null as (() => void) | null,
  }
  ;(globalThis as { speechSynthesis?: unknown }).speechSynthesis = synth
  return synth
})
import { afterEach, describe, expect, it, vi } from 'vitest'
import { currentAudio, isTtsSupported, setListenSink, speak, stopSpeak } from './tts'

// модуль tts уже инициализировался с initSynth — возвращаем окружение в jsdom-режим
;(globalThis as { speechSynthesis?: unknown }).speechSynthesis = undefined

function mockSpeechApi(voices: { lang: string; name: string }[] = []) {
  const speakFn = vi.fn()
  const cancel = vi.fn()
  const api = {
    speak: speakFn,
    cancel,
    getVoices: () => voices,
    onvoiceschanged: null,
  }
  vi.stubGlobal('speechSynthesis', api)
  return { speakFn, cancel, api }
}

/** Стах-объект utterance (jsdom не реализует SpeechSynthesisUtterance). */
function mockUtterance() {
  const instances: { text: string; lang: string; rate: number; voice: unknown }[] = []
  class Utterance {
    text: string
    lang = 'en-US'
    rate = 1
    voice: unknown = null
    constructor(text: string) {
      this.text = text
      instances.push(this)
    }
  }
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
  return instances
}

function mockAudio() {
  type Listener = (event: { type: string }) => void
  const instances: {
    src: string
    playbackRate: number
    play: ReturnType<typeof vi.fn>
    pause: ReturnType<typeof vi.fn>
    addEventListener: (type: string, listener: Listener) => void
    listeners: Map<string, Listener[]>
  }[] = []
  const Ctor = vi.fn(function AudioLike(this: never, src: string) {
    const listeners = new Map<string, Listener[]>()
    const instance = {
      src,
      playbackRate: 1,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      listeners,
      addEventListener: (type: string, listener: Listener) => {
        const list = listeners.get(type) ?? []
        list.push(listener)
        listeners.set(type, list)
      },
    }
    instances.push(instance)
    return instance
  })
  vi.stubGlobal('Audio', Ctor)
  const emit = (instance: (typeof instances)[number], type: string) => {
    for (const listener of instance.listeners.get(type) ?? []) listener({ type })
  }
  return { Ctor, instances, emit }
}

afterEach(() => {
  vi.unstubAllGlobals()
  stopSpeak()
})

describe('tts шлюз (plan://M6#6.1)', () => {
  it('файл есть → HTMLAudio с темпом', () => {
    const { Ctor, instances } = mockAudio()
    const result = speak('hello', { src: 'audio/phrases/cori/ph-e-0001.opus', rate: 0.75 })
    expect(result).toBe(true)
    expect(Ctor).toHaveBeenCalledWith('audio/phrases/cori/ph-e-0001.opus')
    expect(instances[0].playbackRate).toBe(0.75)
    expect(instances[0].play).toHaveBeenCalled()
  })

  it('файла нет → speechSynthesis с en-GB голосом', () => {
    const { speakFn } = mockSpeechApi([
      { lang: 'en-US', name: 'Sam' },
      { lang: 'en-GB', name: 'Google UK English Female' },
    ])
    mockUtterance()
    const result = speak('I am hungry')
    expect(result).toBe(true)
    expect(speakFn).toHaveBeenCalled()
    const utterance = speakFn.mock.calls[0][0] as { lang: string; voice: { name: string } }
    expect(utterance.lang).toBe('en-GB')
    expect(utterance.voice.name).toBe('Google UK English Female')
  })

  it('нет en-GB → любой английский голос', () => {
    const { speakFn } = mockSpeechApi([
      { lang: 'ru-RU', name: 'Russian' },
      { lang: 'en-US', name: 'Sam' },
    ])
    mockUtterance()
    speak('hello')
    const utterance = speakFn.mock.calls[0][0] as { voice: { name: string } }
    expect(utterance.voice.name).toBe('Sam')
  })

  it('speechSynthesis недоступен → false', () => {
    vi.stubGlobal('speechSynthesis', undefined)
    expect(speak('hello')).toBe(false)
    expect(isTtsSupported()).toBe(false)
  })

  it('stopSpeak отменяет синтез', () => {
    const { cancel } = mockSpeechApi()
    mockUtterance()
    speak('hello')
    stopSpeak()
    expect(cancel).toHaveBeenCalled()
  })

  it('ошибка файла уходит в TTS-фолбэк', async () => {
    const Ctor = vi.fn(function AudioLike(this: never, src: string) {
      return {
        src,
        playbackRate: 1,
        play: vi.fn().mockRejectedValue(new Error('blocked')),
        pause: vi.fn(),
        addEventListener: () => undefined,
      }
    })
    vi.stubGlobal('Audio', Ctor)
    const { speakFn } = mockSpeechApi([{ lang: 'en-GB', name: 'UK' }])
    mockUtterance()
    speak('hello', { src: 'audio/missing.opus' })
    await vi.waitFor(() => expect(speakFn).toHaveBeenCalled())
  })

  it('ревью M6#1: отклонённый play() старого элемента не трогает новое воспроизведение', async () => {
    vi.useFakeTimers()
    try {
      const rejectHolder: { reject?: (e: Error) => void } = {}
      const paused: string[] = []
      const Ctor = vi.fn(function AudioLike(this: never, src: string) {
        return {
          src,
          playbackRate: 1,
          play: () =>
            new Promise<void>((_resolve, reject) => {
              if (src === 'audio/first.opus') rejectHolder.reject = reject
              else _resolve()
            }),
          pause: () => paused.push(src),
          addEventListener: () => undefined,
        }
      })
      vi.stubGlobal('Audio', Ctor)
      const { speakFn } = mockSpeechApi([{ lang: 'en-GB', name: 'UK' }])
      mockUtterance()
      speak('first', { src: 'audio/first.opus' })
      speak('second', { src: 'audio/second.opus' })
      // первый элемент прерывается вторым — его play() отклоняется позже
      rejectHolder.reject?.(new Error('interrupted'))
      await Promise.resolve()
      expect(speakFn).not.toHaveBeenCalled() // «first» не озвучился TTS поверх «second»
      expect(paused).toContain('audio/first.opus')
    } finally {
      vi.useRealTimers()
    }
  })

  it('ревью M6#1: stopSpeak до отклонения play() не включает TTS', async () => {
    const rejectHolder: { reject?: (e: Error) => void } = {}
    const Ctor = vi.fn(function AudioLike(this: never, _src: string) {
      return {
        playbackRate: 1,
        play: () =>
          new Promise<void>((_resolve, reject) => {
            rejectHolder.reject = reject
          }),
        pause: vi.fn(),
        addEventListener: () => undefined,
      }
    })
    vi.stubGlobal('Audio', Ctor)
    const { speakFn } = mockSpeechApi([{ lang: 'en-GB', name: 'UK' }])
    mockUtterance()
    speak('cancelled', { src: 'audio/x.opus' })
    stopSpeak()
    rejectHolder.reject?.(new Error('aborted'))
    await Promise.resolve()
    expect(speakFn).not.toHaveBeenCalled()
  })
})

// M19: хвосты tts (нет API → false, смена голосов сбрасывает кэш)
describe('tts: хвосты (M19)', () => {
  it('без speechSynthesis speak — фолбэк false', () => {
    vi.unstubAllGlobals()
    expect(speak('hello')).toBe(false)
  })

  it('onvoiceschanged сбрасывает кэш голоса без крэша', () => {
    const { api } = mockSpeechApi([{ lang: 'en-GB', name: 'Cori' }])
    mockUtterance()
    expect(speak('hello')).toBe(true)
    ;(api as unknown as { onvoiceschanged: (() => void) | null }).onvoiceschanged?.()
    expect(speak('hello')).toBe(true)
  })

  // Веха S4 (M21#21.4): init-подписка onvoiceschanged и защитные ветки pickVoice/speak
  it('voiceschanged после удаления API: pickVoice возвращает null (init-подписка жива)', () => {
    expect(isTtsSupported()).toBe(false)
    // обработчик подписан на initSynth при инициализации модуля tts;
    // на момент события speechSynthesis уже нет — pickVoice должен вернуть null
    vi.stubGlobal('speechSynthesis', undefined)
    initSynth.onvoiceschanged?.()
    expect(isTtsSupported()).toBe(false)
  })

  it('api.speak бросает исключение → false (защитный catch)', () => {
    vi.stubGlobal('speechSynthesis', {
      speak: () => {
        throw new Error('engine broken')
      },
      cancel: vi.fn(),
      getVoices: () => [],
    })
    mockUtterance()
    expect(speak('hello')).toBe(false)
  })
})

describe('tts счётчик аудирования (plan://curriculum-review#I.1)', () => {
  it('файл доиграл → sink получает секунды отрезка', () => {
    vi.useFakeTimers()
    try {
      const { instances, emit } = mockAudio()
      const sink = vi.fn()
      setListenSink(sink)
      speak('hello', { src: 'audio/x.opus' })
      vi.advanceTimersByTime(4000)
      emit(instances[0]!, 'ended')
      expect(sink).toHaveBeenCalledTimes(1)
      expect(sink.mock.calls[0]![0]).toBeCloseTo(4, 1)
    } finally {
      setListenSink(null)
      vi.useRealTimers()
    }
  })

  it('stopSpeak досрочно → flush текущего отрезка; новый speak не теряет прошлый', () => {
    vi.useFakeTimers()
    try {
      mockAudio()
      const sink = vi.fn()
      setListenSink(sink)
      speak('one', { src: 'audio/a.opus' })
      vi.advanceTimersByTime(2000)
      speak('two', { src: 'audio/b.opus' }) // останавливает первый и флашит его
      expect(sink).toHaveBeenCalledTimes(1)
      expect(sink.mock.calls[0]![0]).toBeCloseTo(2, 1)
      vi.advanceTimersByTime(3000)
      stopSpeak()
      expect(sink).toHaveBeenCalledTimes(2)
      expect(sink.mock.calls[1]![0]).toBeCloseTo(3, 1)
    } finally {
      setListenSink(null)
      vi.useRealTimers()
    }
  })

  it('потолок одного отрезка — 600 с (защита от забытой вкладки)', () => {
    vi.useFakeTimers()
    try {
      const { emit } = mockAudio()
      const sink = vi.fn()
      setListenSink(sink)
      speak('long', { src: 'audio/x.opus' })
      vi.advanceTimersByTime(3_600_000) // час «играет»
      emit({ listeners: new Map() } as never, 'ended') // без слушателей — flush вручную не сработает
      stopSpeak()
      expect(sink.mock.calls[0]![0]).toBe(600)
    } finally {
      setListenSink(null)
      vi.useRealTimers()
    }
  })
})

describe('currentAudio (плейлист input-трека)', () => {
  it('возвращает активный элемент во время воспроизведения и null после остановки', () => {
    const { instances } = mockAudio()
    expect(currentAudio()).toBeNull()
    speak('hello', { src: 'audio/x.opus' })
    expect(currentAudio()).toBe(instances[0]!)
    stopSpeak()
    expect(currentAudio()).toBeNull()
  })
})
