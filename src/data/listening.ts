// Implements: plan://curriculum-review#I.1 — учёт минут аудирования дня:
// автосчёт из шлюза озвучки (tts sink) + ручная отметка «послушал вне приложения».
// V6 (фидбей 2026-10-08): ежедневный состав эфира — понятые цитаты (top1000 ≥ 0.8)
// + фразы начатых уроков, дневной сид-шаффл (новые сочетания каждый день).
import { dayStart } from '../domain/srs/scheduler'
import { createQuestDay, LISTENING_TARGET_SEC } from '../domain/game/game'
import type { QuestDayState } from '../domain/game/types'
import type { ProgressRepository } from '../domain/progress'
import { loadLessons, loadPhrases, loadQuotes, type QuoteItem } from '../content/lessons'

/** Трек эфира дня: цитата или фраза урока. */
export interface ListenTrack {
  id: string
  text: string
  translationRu: string
  /** источник: тайтл цитаты или «Урок E-01» */
  source: string
  audio?: string
  link?: string
}

/** Порог понятности цитат: слова вне топ-1000 ≤ 20% (research/01: input 90%+). */
const QUOTE_VOCAB_MIN = 0.8
/** Сколько фраз уроков добавляем в эфир дня (ротация по дневному сиду). */
const PHRASE_CAP = 30

/** Детерминированный сид-шаффл (LCG как в GatesScreen): один день — один порядок. */
function dayShuffle<T>(items: readonly T[], seedKey: string): T[] {
  let hash = 0
  for (const ch of seedKey) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  let state = Math.abs(hash) || 1
  const rng = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * Эфир дня (V6): понятые цитаты (≥0.8 топ-1000) + фразы начатых уроков
 * (любая запись прогресса), перемешанные дневным сидом — каждый день
 * новый набор и порядок. Фразы уроков — заведомо понятный материал
 * (лексика и грамматика уже пройдены).
 */
export async function buildDailyTracks(
  repo: ProgressRepository,
  now: Date = new Date(),
): Promise<ListenTrack[]> {
  const dayKey = dayStart(now).toISOString().slice(0, 10)
  const quotes: QuoteItem[] = (await loadQuotes()).filter(
    (quote) => (quote.auto_vocab?.top1000 ?? 0) >= QUOTE_VOCAB_MIN,
  )
  const quoteTracks: ListenTrack[] = quotes.map((quote) => ({
    id: quote.id,
    text: quote.text,
    translationRu: quote.translation_ru,
    source: quote.title,
    audio: quote.audio?.en_gb,
    link: quote.link_playphrase,
  }))

  const lessons = await loadLessons()
  const rows = await repo.getManyLessonProgress(lessons.map((lesson) => lesson.id))
  const startedGps = new Set(
    lessons
      .filter((_lesson, index) => rows[index] !== null)
      .map((lesson) => lesson.grammar_point.id),
  )
  const phrases = (await loadPhrases()).filter(
    (phrase) =>
      startedGps.has(phrase.grammar_point_id ?? '') &&
      phrase.audio?.en_gb &&
      !quoteTracks.some((track) => track.text === phrase.text_en),
  )
  const phraseTracks: ListenTrack[] = dayShuffle(phrases, `${dayKey}-phrases`)
    .slice(0, PHRASE_CAP)
    .map((phrase) => ({
      id: phrase.id,
      text: phrase.text_en,
      translationRu: phrase.translation_ru,
      source: `Урок ${phrase.id.replace(/^ph-([a-z])-.*$/, '$1').toUpperCase()}-${
        phrase.grammar_point_id?.replace(/^gp-[a-z]-/, '') ?? ''
      }`,
      audio: phrase.audio?.en_gb,
    }))

  return dayShuffle([...quoteTracks, ...phraseTracks], dayKey)
}

/**
 * Дозаполняет слот listening в записях, созданных до input-трека
 * (старые строки квеста в IndexedDB гостей).
 */
export function questWithListening(row: QuestDayState): QuestDayState {
  if (row.slots.listening) return row
  return { ...row, slots: { ...row.slots, listening: { done: 0, target: LISTENING_TARGET_SEC } } }
}

/**
 * Ручная корректировка минут «вне приложения» (U3.1): дельта может быть
 * отрицательной (ошибся/нажал лишнего). Ручная доля хранится отдельно
 * (`manual`), автосчёт tts-sink не трогаем; границы: manual ≥ 0, done ≥ 0.
 */
export async function addManualListeningSeconds(
  repo: ProgressRepository,
  deltaSec: number,
  now: Date = new Date(),
): Promise<void> {
  if (!Number.isFinite(deltaSec) || deltaSec === 0) return
  const dayIso = dayStart(now).toISOString()
  const existing = await repo.getQuestDay(dayIso)
  const row = questWithListening(existing ?? createQuestDay(dayIso, 0))
  const prevManual = row.slots.listening.manual ?? 0
  const manual = Math.max(0, prevManual + deltaSec)
  const auto = row.slots.listening.done - prevManual
  await repo.putQuestDay({
    ...row,
    slots: {
      ...row.slots,
      listening: {
        ...row.slots.listening,
        manual,
        done: auto + manual,
      },
    },
  })
}

/**
 * Добавить секунды прослушанного аудирования в квест дня (создаёт запись дня,
 * если её ещё нет). Вызывается часто и малыми порциями: put маленькой строки
 * дешевле потери буфера при закрытии вкладки.
 */
export async function addListeningSeconds(
  repo: ProgressRepository,
  seconds: number,
  now: Date = new Date(),
): Promise<void> {
  if (!Number.isFinite(seconds) || seconds <= 0) return
  const dayIso = dayStart(now).toISOString()
  const existing = await repo.getQuestDay(dayIso)
  const row = questWithListening(existing ?? createQuestDay(dayIso, 0))
  await repo.putQuestDay({
    ...row,
    slots: {
      ...row.slots,
      listening: { ...row.slots.listening, done: row.slots.listening.done + seconds },
    },
  })
}
