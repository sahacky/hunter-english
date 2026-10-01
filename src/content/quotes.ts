// Implements: plan://M11#11.1 — лоадер цитат: тайтлы из data/quotes/*.json
// (specs/05 §5). Раскраска слов и знание — на экранах (по card_state).

export interface QuoteItem {
  id: string
  title: string
  season_episode?: string
  speaker?: string
  text: string
  translation_ru: string
  auto_vocab?: { top1000: number }
  est_rank?: string
  link_playphrase?: string
  /** Предзаписанное аудио cori (plan://voice-fix V2.1); нет — Web Speech. */
  audio?: { en_gb?: string }
}

interface QuotesFile {
  schema_version: number
  kind: 'quotes'
  items: QuoteItem[]
}

const quoteModules = import.meta.glob('/data/quotes/*.json') as Record<
  string,
  () => Promise<QuotesFile>
>

/** Тайтл-группа цитат: slug = имя файла. */
export interface QuoteTitle {
  slug: string
  title: string
  quotes: QuoteItem[]
}

function slugOf(modulePath: string): string {
  const file = modulePath.split('/').pop() ?? ''
  return file.replace(/\.json$/, '')
}

/** Все тайтлы с цитатами, отсортированы по имени. */
export async function loadQuoteTitles(): Promise<QuoteTitle[]> {
  const entries = await Promise.all(
    Object.entries(quoteModules).map(async ([path, load]) => {
      const file = await load()
      return { slug: slugOf(path), title: file.items[0]?.title ?? slugOf(path), quotes: file.items }
    }),
  )
  return entries.sort((a, b) => a.title.localeCompare(b.title))
}

/** Поиск цитаты по id (перебор тайтлов лениво — данных мало). */
export async function findQuote(id: string): Promise<QuoteItem | null> {
  for (const { quotes } of await loadQuoteTitles()) {
    const found = quotes.find((quote) => quote.id === id)
    if (found) return found
  }
  return null
}

/** Токены-слова цитаты (lowercase, без пунктуации; апострофы сохранены). */
export function quoteWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []).map((w) =>
    w.endsWith("'s") ? w.slice(0, -2) : w,
  )
}
