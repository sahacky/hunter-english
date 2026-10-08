// Implements: plan://M6#6.1 — единый шлюз озвучки (research/02 §2 «гибрид»):
// предзаписанное аудио (edge-tts Sonia, opus) — основной путь; всё без записи —
// фолбэк Web Speech speechSynthesis с выбором en-GB голоса (specs/01 §9).
// Настройки скорости и выбора голоса — с экраном настроек (M10, решение M6#5).

export interface SpeakOptions {
  /** Путь предзаписанного файла (напр. audio/phrases/sonia/ph-e-0001.opus). */
  src?: string
  /** 1 — обычный темп, 0.75 — «медленно» (🐢). */
  rate?: number
}

let audioEl: HTMLAudioElement | null = null

/** Скорость воспроизведения по умолчанию (настройка M10; 🐢 всегда 0.75). */
let defaultRate = 1

export function setDefaultRate(rate: number): void {
  defaultRate = rate === 0.75 ? 0.75 : 1
}

/** Выбранный en-GB голос speechSynthesis (кэш; голоса появляются асинхронно). */
let cachedVoice: SpeechSynthesisVoice | null = null

// --- счётчик аудирования (input-трек, plan://curriculum-review#I.1) -----------
/** Приёмник прослушанных секунд (ставится приложением: пишет в квест дня). */
let listenSink: ((seconds: number) => void) | null = null
/** Начало текущего воспроизведения (мс); null — ничего не играет. */
let listenStartedAt: number | null = null
/** Потолок одного flush'а: защита от «забытой вкладки» (10 мин). */
const LISTEN_FLUSH_CAP_SEC = 600

export function setListenSink(sink: ((seconds: number) => void) | null): void {
  listenSink = sink
}

/** Завершить текущий отрезок прослушивания и отдать секунды в sink. */
function flushListening(): void {
  if (listenStartedAt === null) return
  const seconds = Math.min(LISTEN_FLUSH_CAP_SEC, (Date.now() - listenStartedAt) / 1000)
  listenStartedAt = null
  if (seconds > 0 && listenSink) listenSink(seconds)
}

function startListening(): void {
  flushListening() // предыдущий отрезок не теряем
  listenStartedAt = Date.now()
}

function speechApi(): SpeechSynthesis | null {
  return typeof window !== 'undefined' ? (window.speechSynthesis ?? null) : null
}

function pickVoice(): SpeechSynthesisVoice | null {
  const api = speechApi()
  if (!api) return null
  const voices = api.getVoices()
  if (cachedVoice && voices.includes(cachedVoice)) return cachedVoice
  if (voices.length === 0) return null
  // приоритет: en-GB женский (консистентно с озвучкой курса) → en-GB →
  // любой English (системные Google/Microsoft предпочитаем)
  const english = voices.filter((voice) => voice.lang?.toLowerCase().startsWith('en'))
  const female = /female|sonia|libby|liberty|kate|serena|emma|maisie/i
  cachedVoice =
    english.find((voice) => voice.lang.toLowerCase() === 'en-gb' && female.test(voice.name)) ??
    english.find((voice) => voice.lang.toLowerCase() === 'en-gb') ??
    english.find((voice) => /en_GB/i.test(voice.lang)) ??
    english[0] ??
    null
  return cachedVoice
}

// голоса подгружаются асинхронно — обновим кэш по событию
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null
    pickVoice()
  }
}

/** Доступен ли фолбэк TTS (для UI: показывать ли озвучку у контента без записи). */
export function isTtsSupported(): boolean {
  return speechApi() !== null
}

/**
 * Озвучивает текст: файл если есть, иначе speechSynthesis.
 * Каждое новое воспроизведение останавливает предыдущее (specs/07 §5.1: R/S).
 * Возвращает true, если воспроизведение реально запущено.
 */
export function speak(text: string, options: SpeakOptions = {}): boolean {
  const rate = options.rate ?? defaultRate
  stopSpeak()
  if (options.src) {
    const el = new Audio(options.src)
    audioEl = el
    el.playbackRate = rate
    // input-трек: считаем реальное время воспроизведения (ended/pause/остановка)
    startListening()
    el.addEventListener('ended', flushListening)
    el.addEventListener('pause', flushListening)
    const playback = el.play()
    if (playback && typeof playback.catch === 'function') {
      playback.catch(() => {
        // актуален ли ещё этот элемент (могли начать новое воспроизведение/отменить)
        if (audioEl !== el) return
        audioEl = null
        flushListening() // воспроизведение не стартовало — отрезок не считаем
        // pause()-во-загрузки даёт AbortError — это отмена, а не «файла нет»
        speakViaTts(text, rate)
      })
    }
    return true
  }
  return speakViaTts(text, rate)
}

function speakViaTts(text: string, rate: number): boolean {
  const api = speechApi()
  if (!api || text.trim().length === 0) return false
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-GB'
  utterance.rate = rate
  const voice = pickVoice()
  if (voice) utterance.voice = voice
  try {
    startListening()
    utterance.onend = flushListening
    utterance.onerror = flushListening
    api.speak(utterance)
  } catch {
    flushListening()
    return false
  }
  return true
}

/** Останавливает текущее воспроизведение (смена задания/экрана, отмена). */
export function stopSpeak(): void {
  if (audioEl) {
    audioEl.pause()
    audioEl = null
  }
  const api = speechApi()
  if (api) api.cancel()
  flushListening()
}

/** Текущий audio-элемент (плейлист input-трека: автопереход по ended). */
export function currentAudio(): HTMLAudioElement | null {
  return audioEl
}
