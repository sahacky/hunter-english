// Implements: plan://M19 — покрытие src/lib/speech.ts (Web Speech best-effort)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cancelListening, isSpeechSupported, listenOnce } from './speech'

class FakeRecognition {
  lang = ''
  continuous = false
  interimResults = false
  maxAlternatives = 1
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null =
    null
  onerror: ((event: unknown) => void) | null = null
  onend: (() => void) | null = null
  started = false
  stopped = false
  start() {
    this.started = true
  }
  stop() {
    this.stopped = true
    this.onend?.() // как в браузере: stop триггерит onend
  }
}

let instance: FakeRecognition | null = null

beforeEach(() => {
  instance = null
  const w = window as unknown as Record<string, unknown>
  delete w.SpeechRecognition
  delete w.webkitSpeechRecognition
})

afterEach(() => {
  cancelListening()
  vi.useRealTimers()
})

function install(ctor: new () => FakeRecognition = FakeRecognition) {
  class Capturing extends ctor {
    constructor() {
      super()
      instance = this
    }
  }
  ;(window as unknown as Record<string, unknown>).SpeechRecognition = Capturing
}

describe('isSpeechSupported', () => {
  it('нет API → false; есть → true (включая webkit-префикс)', () => {
    expect(isSpeechSupported()).toBe(false)
    install()
    expect(isSpeechSupported()).toBe(true)
    delete (window as unknown as Record<string, unknown>).SpeechRecognition
    ;(window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition
    expect(isSpeechSupported()).toBe(true)
  })
})

describe('listenOnce', () => {
  it('без API — отказ speech-unavailable', async () => {
    await expect(listenOnce({})).rejects.toThrow('speech-unavailable')
  })

  it('результат распознан: первый транскрипт, en-GB по умолчанию', async () => {
    install(
      class extends FakeRecognition {
        start() {
          this.onresult?.({ results: [[{ transcript: 'the house is big' }]] })
          this.onend?.()
        }
      },
    )
    await expect(listenOnce({})).resolves.toBe('the house is big')
    expect(instance?.lang).toBe('en-GB')
  })

  it('onerror → speech-error; onEnd-колбэк зовётся', async () => {
    let ended = false
    install(
      class extends FakeRecognition {
        start() {
          this.onerror?.({})
          this.onend?.()
        }
      },
    )
    await expect(listenOnce({ onEnd: () => (ended = true) })).rejects.toThrow('speech-error')
    expect(ended).toBe(true)
  })

  it('onend без результата → speech-no-match; кастомный lang', async () => {
    let seenLang = ''
    install(
      class extends FakeRecognition {
        start() {
          seenLang = this.lang
          this.onend?.()
        }
      },
    )
    await expect(listenOnce({ lang: 'en-US' })).rejects.toThrow('speech-no-match')
    expect(seenLang).toBe('en-US')
  })

  it('таймаут: stop() зовётся, промис отказывает (зависания Chrome, ревью M10)', async () => {
    vi.useFakeTimers()
    install()
    const promise = listenOnce({ timeoutMs: 100 })
    const assertion = expect(promise).rejects.toThrow('speech-timeout')
    vi.advanceTimersByTime(150)
    await assertion
    expect(instance?.stopped).toBe(true)
  })

  it('cancelListening останавливает активное распознавание', async () => {
    install()
    const promise = listenOnce({ timeoutMs: 10_000 })
    expect(isSpeechSupported()).toBe(true)
    cancelListening()
    await expect(promise).rejects.toThrow()
  })

  it('повторный onresult после settle игнорируется', async () => {
    install(
      class extends FakeRecognition {
        start() {
          this.onresult?.({ results: [[{ transcript: 'first' }]] })
          this.onresult?.({ results: [[{ transcript: 'second' }]] })
          this.onend?.()
        }
      },
    )
    await expect(listenOnce({})).resolves.toBe('first')
  })
})
