// Implements: plan://M6#6.1 — единый шлюз озвучки (research/02 §2 «гибрид»):
// предзаписанное аудио (Piper cori, opus) — основной путь; всё без записи —
// фолбэк Web Speech speechSynthesis с выбором en-GB голоса (specs/01 §9).
// Настройки скорости и выбора голоса — с экраном настроек (M10, решение M6#5).

export interface SpeakOptions {
  /** Путь предзаписанного файла (напр. audio/phrases/cori/ph-e-0001.opus). */
  src?: string
  /** 1 — обычный темп, 0.75 — «медленно» (🐢). */
  rate?: number
}

let audioEl: HTMLAudioElement | null = null

/** Выбранный en-GB голос speechSynthesis (кэш; голоса появляются асинхронно). */
let cachedVoice: SpeechSynthesisVoice | null = null

function speechApi(): SpeechSynthesis | null {
  return typeof window !== 'undefined' ? (window.speechSynthesis ?? null) : null
}

function pickVoice(): SpeechSynthesisVoice | null {
  const api = speechApi()
  if (!api) return null
  const voices = api.getVoices()
  if (cachedVoice && voices.includes(cachedVoice)) return cachedVoice
  if (voices.length === 0) return null
  // приоритет: en-GB → любой English; системные Google/Microsoft предпочитаем
  const english = voices.filter((voice) => voice.lang?.toLowerCase().startsWith('en'))
  cachedVoice =
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
  const rate = options.rate ?? 1
  stopSpeak()
  if (options.src) {
    audioEl = new Audio(options.src)
    audioEl.playbackRate = rate
    const playback = audioEl.play()
    if (playback && typeof playback.catch === 'function') {
      playback.catch(() => {
        // файл недоступен/автоплей заблокирован → пробуем TTS-фолбэк
        audioEl = null
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
    api.speak(utterance)
  } catch {
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
}
