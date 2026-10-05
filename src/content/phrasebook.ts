// Implements: plan://M8#8.1 — загрузчик разговорника (specs/05 §6, specs/07 §2.1)
import type { Note } from '../domain/srs/types'
import { assertEnvelope } from './envelope'

/** Диалог разговорника — схема specs/05 §6. */
export interface PhrasebookDialog {
  id: string
  rank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S'
  topic: string
  situation_ru: string
  user_role: string
  lines: {
    role: string
    text_en: string
    translation_ru: string
    accepted?: string[]
    /** Предзаписанное аудио cori (plan://voice-fix V2.2); нет — Web Speech. */
    audio?: string
    /** Слово-слот чанк-шаблона (план {#teaching-quality} Q2.2). */
    chunk_slot?: string
  }[]
}

interface PhrasebookFile {
  schema_version: number
  kind: 'phrasebook'
  items: PhrasebookDialog[]
}

const phrasebookModules = import.meta.glob('/data/phrasebook/*.json') as Record<
  string,
  () => Promise<PhrasebookFile>
>

/** Все диалоги разговорника. */
export async function loadPhrasebook(): Promise<PhrasebookDialog[]> {
  const files = await Promise.all(Object.values(phrasebookModules).map((load) => load()))
  return files.flatMap((file, i) => {
    assertEnvelope(file, 'phrasebook', `data/phrasebook #${i}`)
    return file.items
  })
}

/** Ситуации разговорника (specs/01 §2: 10 ситуаций путешественника + идиомы M20). */
export const SITUATIONS: { id: string; minRank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S' }[] = [
  { id: 'smalltalk', minRank: 'E' },
  { id: 'emergency', minRank: 'E' },
  { id: 'directions', minRank: 'D' },
  { id: 'taxi', minRank: 'D' },
  { id: 'shop', minRank: 'D' },
  { id: 'airport', minRank: 'D' },
  { id: 'passport', minRank: 'C' },
  { id: 'hotel', minRank: 'C' },
  { id: 'restaurant', minRank: 'C' },
  { id: 'pharmacy', minRank: 'D' }, // превью с D-19 (план M12#12.7); полная глава — C
  { id: 'idioms', minRank: 'S' }, // идиомы путешественника (план M20#20.3, specs/01 §10 S-02)
]

/** Заметки реплик разговорника для SRS (колода phrasebook). */
export function toPhrasebookNotes(dialogs: readonly PhrasebookDialog[]): Note[] {
  return dialogs.flatMap((dialog) =>
    dialog.lines
      .filter((line) => line.role === dialog.user_role)
      .map((line, index) => ({
        id: `note_${dialog.id}-l${index}`,
        deck: 'phrasebook' as const,
        entityId: `${dialog.id}-l${index}`,
        en: line.text_en,
        ru: line.translation_ru,
        chunkSlot: line.chunk_slot,
      })),
  )
}
