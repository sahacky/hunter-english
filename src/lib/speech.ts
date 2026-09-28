// Implements: plan://M5#5.6 — распознавание речи (Web Speech API, specs/02 §4.8, specs/01 §9).
// Лучшее усилие: если API недоступен (Firefox/фаерблок) — упражнения показывают
// фолбэк «ввести текстом» / «Сказал(-а)» (self_reported). Тюнинг распознавания — M6.

/** Минимальная поверхность SpeechRecognition, нужная уроку. */
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: unknown) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

type RecognitionCtor = new () => SpeechRecognitionLike

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Доступно ли распознавание в этом браузере. */
export function isSpeechSupported(): boolean {
  return recognitionCtor() !== null
}

/**
 * Одна попытка распознавания: resolve с наилучшей транскриптом или reject
 * (нет речи / ошибка / прервано). Таймаут-остановка — stop().
 */
export function listenOnce(options: { lang?: string; onEnd?: () => void }): Promise<string> {
  return new Promise((resolve, reject) => {
    const Ctor = recognitionCtor()
    if (!Ctor) {
      reject(new Error('speech-unavailable'))
      return
    }
    const recognition = new Ctor()
    recognition.lang = options.lang ?? 'en-GB'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 3
    let settled = false
    recognition.onresult = (event) => {
      const first = event.results[0]?.[0]?.transcript
      if (typeof first === 'string' && !settled) {
        settled = true
        resolve(first)
      }
    }
    recognition.onerror = () => {
      if (!settled) {
        settled = true
        reject(new Error('speech-error'))
      }
    }
    recognition.onend = () => {
      options.onEnd?.()
      if (!settled) {
        settled = true
        reject(new Error('speech-no-match'))
      }
    }
    recognition.start()
  })
}
