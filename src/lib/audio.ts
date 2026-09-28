// Implements: plan://M5#5.5 — воспроизведение учебного аудио (specs/07 §5.1: R/S).
// Аудио — локальные opus-файлы; «медленно» — playbackRate 0.75 (specs/02 §3).

let current: HTMLAudioElement | null = null

/** Проигрывает файл из data-контента (напр. audio/phrases/cori/ph-e-0001.opus). */
export function playAudio(src: string, rate = 1): void {
  current?.pause()
  const audio = new Audio(src)
  audio.playbackRate = rate
  current = audio
  void audio.play().catch(() => {
    // Автоплей заблокирован или файл недоступен — озвучка необязательна для логики урока
  })
}

/** Останавливает текущее воспроизведение (смена задания/экрана). */
export function stopAudio(): void {
  current?.pause()
  current = null
}
