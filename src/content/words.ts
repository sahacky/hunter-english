// Implements: plan://M4#4.3 — загрузчик контента слов и создание карточек по rule-1.
// Контент живёт в data/ (git), прогресс — в репозитории; связка — entityId (specs/06 §0).

import { createEmptyCard } from 'ts-fsrs'
import type { CardState, Note } from '../domain/srs/types'
import { WORD_CARD_ORDER } from '../domain/srs/types'

/** Статья data/words/*.json — схема specs/05 §2 (kind: words). */
export interface WordItem {
  id: string
  lemma: string
  part_of_speech: string
  translation_ru: string[]
  cefr_level: string
  freq_rank_ngsl: number
  audio: { en_gb?: string }
}

interface WordsFile {
  schema_version: number
  kind: 'words'
  items: WordItem[]
}

/** Ленивые чанки: каждый файл — отдельный чанк, грузятся параллельно при первом запросе. */
const wordModules = import.meta.glob('/data/words/*.json') as Record<
  string,
  () => Promise<WordsFile>
>

function toNote(item: WordItem): Note {
  return {
    id: `note_${item.id}`,
    deck: 'words',
    entityId: item.id,
    en: item.lemma,
    ru: item.translation_ru[0],
    audio: item.audio?.en_gb,
  }
}

/** Все заметки слов NGSL (~3 989), chunk-файлы грузятся параллельно. */
export async function loadWordNotes(): Promise<Note[]> {
  const files = await Promise.all(Object.values(wordModules).map((load) => load()))
  return files.flatMap((file) => file.items.map(toNote))
}

/** card_id по конвенции `<entity_id>.<тип>` (specs/03 §2, решение M1). */
export function cardId(entityId: string, type: string): string {
  return `${entityId}.${type}`
}

/**
 * Первая карточка заметки по rule-1 (srs://rule-1): для слов — en-ru,
 * состояние New из createEmptyCard ts-fsrs; остальные типы создаёт wake-up (rule-2).
 */
export function createFirstCards(notes: Note[], now: Date): CardState[] {
  const seed = createEmptyCard(now)
  return notes.map((note) => ({
    card_id: cardId(note.entityId, WORD_CARD_ORDER[0]),
    note_id: note.id,
    type: WORD_CARD_ORDER[0],
    deck: note.deck,
    due: seed.due.toISOString(),
    stability: seed.stability,
    difficulty: seed.difficulty,
    elapsed_days: seed.elapsed_days,
    scheduled_days: seed.scheduled_days,
    reps: seed.reps,
    lapses: seed.lapses,
    state: seed.state as CardState['state'],
    last_review: null,
    suspended: false,
    cloze_index: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  }))
}
