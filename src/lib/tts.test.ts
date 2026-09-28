// Implements: plan://M6#6.1 — тесты TTS-шлюза (моки speechSynthesis/Audio)
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isTtsSupported, speak, stopSpeak } from './tts'

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
  const instances: {
    src: string
    playbackRate: number
    play: ReturnType<typeof vi.fn>
    pause: ReturnType<typeof vi.fn>
  }[] = []
  const Ctor = vi.fn(function AudioLike(this: never, src: string) {
    const instance = {
      src,
      playbackRate: 1,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    }
    instances.push(instance)
    return instance
  })
  vi.stubGlobal('Audio', Ctor)
  return { Ctor, instances }
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
