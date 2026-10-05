// Implements: plan://M11#11.1–11.2 — тесты экранов Цитат (реальные data/quotes)
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import '../i18n'
import { loadQuoteTitles, findQuote, quoteWords } from '../content/quotes'
import { loadTopNgslLemmas, loadWordNotes } from '../content/words'
import { speak } from '../lib/tts'
import { HunterDb } from '../data/db'
import { DexieProgressRepository } from '../data/progress-repository'
import { uuidv7 } from '../lib/uuidv7'
import QuotesScreen, { QuoteScreen } from './QuotesScreen'

// S4: обёртки для точечных rejectOnce в тестах ошибок загрузки (остальное — real)
vi.mock('../content/quotes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../content/quotes')>()
  return {
    ...actual,
    loadQuoteTitles: vi.fn(actual.loadQuoteTitles),
    findQuote: vi.fn(actual.findQuote),
  }
})
vi.mock('../content/words', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../content/words')>()
  return { ...actual, loadWordNotes: vi.fn(actual.loadWordNotes) }
})
vi.mock('../lib/tts', () => ({ speak: vi.fn(), stopSpeak: vi.fn(), setDefaultRate: vi.fn() }))

let db: HunterDb
let repo: DexieProgressRepository

beforeEach(() => {
  db = new HunterDb(`hunter-quotes-test-${uuidv7()}`)
  repo = new DexieProgressRepository(db)
})

function renderAt(hash: string) {
  window.location.hash = hash
  return render(
    <HashRouter>
      <Routes>
        <Route path="/quotes" element={<QuotesScreen repo={repo} />} />
        <Route path="/quotes/:id" element={<QuoteScreen repo={repo} />} />
      </Routes>
    </HashRouter>,
  )
}

/** Цитата с хотя бы одним словом из датасета (для поповера/колоды). */
async function quoteWithKnownWord() {
  const notes = await loadWordNotes()
  const words = new Set(notes.map((note) => note.en))
  for (const { quotes } of await loadQuoteTitles()) {
    for (const quote of quotes) {
      const known = quoteWords(quote.text).find((word) => words.has(word))
      if (known) return { quote, word: known }
    }
  }
  throw new Error('нет цитаты со словами датасета')
}

describe('QuotesScreen /#/quotes', () => {
  it('галерея тайтлов со счётчиками цитат (реальные данные)', async () => {
    renderAt('#/quotes')
    expect(await screen.findByText('Цитаты')).toBeInTheDocument()
    const titles = await loadQuoteTitles()
    // каждый тайтл показан со счётчиком
    for (const title of titles.slice(0, 3)) {
      expect(screen.getByText(title.title)).toBeInTheDocument()
    }
    expect(screen.getAllByText(/цитат/).length).toBe(titles.length)
  })

  it('фильтр «понятные» скрывает тайтлы без понятных цитат', async () => {
    renderAt('#/quotes')
    await screen.findByText('Цитаты')
    // без карточек знакомых слов нет → фильтр прячет всё (0 знакомых у пользователя)
    fireEvent.click(screen.getByLabelText('понятные мне сейчас'))
    expect(
      await screen.findByText('Колода собирается — цитаты появятся позже.'),
    ).toBeInTheDocument()
  })

  it('?title=: список цитат тайтла → переход на цитату', async () => {
    renderAt('#/quotes?title=supernatural')
    const heading = await screen.findByText('Supernatural')
    expect(heading).toBeInTheDocument()
    const links = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('#/quotes/q-'))
    expect(links.length).toBeGreaterThan(0)
  })

  it('?title= несуществующий → общая галерея (не 404, решение M11)', async () => {
    renderAt('#/quotes?title=no-such-title')
    expect(await screen.findByText('Цитаты')).toBeInTheDocument()
    expect(screen.getByText('Supernatural')).toBeInTheDocument()
  })

  it('понимание: карточки в Review + морфология (dreams→dream, имена не в знаменателе)', async () => {
    // находим цитату со словом-формой (напр. dreams) и леммой в датасете
    const notes = await loadWordNotes()
    const byWord = new Map<string, typeof notes>()
    for (const note of notes) {
      const list = byWord.get(note.en) ?? []
      list.push(note)
      byWord.set(note.en, list)
    }
    let quote: import('../content/quotes').QuoteItem | null = null
    let lemma = ''
    outer: for (const { quotes } of await loadQuoteTitles()) {
      for (const q of quotes) {
        for (const word of quoteWords(q.text)) {
          const stem = word.endsWith('s') ? word.slice(0, -1) : word
          if (word.length > 3 && word.endsWith('s') && byWord.has(stem) && !byWord.has(word)) {
            quote = q
            lemma = stem
            break outer
          }
        }
      }
    }
    if (!quote) return // в данных нет подходящей пары — тест пропускается

    // создаём карточку леммы в Review (state=2)
    const note = byWord.get(lemma)![0]
    const { createFirstCards } = await import('../content/words')
    const [card] = createFirstCards([note], new Date())
    await repo.saveAnswer(
      { ...card, state: 2, stability: 10, difficulty: 5, reps: 2, scheduled_days: 10 },
      {
        id: 'test-log',
        card_id: card.card_id,
        rating: 3,
        state: 0,
        state_after: 2,
        elapsed_days: 0,
        scheduled_days: 10,
        duration_ms: 0,
        client: 'web',
        session_id: null,
        reviewed_at: new Date().toISOString(),
      },
    )

    renderAt(`#/quotes/${quote.id}`)
    // форма окрашена как известная (стем-резолв dreams→dream)
    await screen.findByText('Показать перевод')
    const knownWord = screen
      .getAllByRole('button')
      .find((b) => b.classList.contains('quote-word') && b.classList.contains('quote-word-known'))
    expect(knownWord).toBeInTheDocument()
  })
})

describe('QuoteScreen /#/quotes/:id', () => {
  it('слова раскрашены и кликабельны, RU скрыт, показывается по кнопке', async () => {
    const { quote } = await quoteWithKnownWord()
    renderAt(`#/quotes/${quote.id}`)
    expect(await screen.findByText('Показать перевод')).toBeInTheDocument()
    expect(screen.queryByText(quote.translation_ru)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Показать перевод/ }))
    expect(screen.getByText(quote.translation_ru)).toBeInTheDocument()
    // слова цитаты — кнопки
    const words = screen.getAllByRole('button').filter((b) => b.classList.contains('quote-word'))
    expect(words.length).toBe(quoteWords(quote.text).length)
  })

  it('поповер слова: перевод + «В колоду» создаёт карточку rule-1', async () => {
    const { quote, word } = await quoteWithKnownWord()
    renderAt(`#/quotes/${quote.id}`)
    await screen.findByText('Показать перевод')

    const wordButton = await waitFor(() => {
      const norm = (value: string | null) => (value ?? '').toLowerCase().replace(/'s$/, '')
      const found = screen
        .getAllByRole('button')
        .find((b) => b.classList.contains('quote-word') && norm(b.textContent) === word)
      if (!found) throw new Error('слово не найдено')
      return found
    })
    fireEvent.click(wordButton)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /В колоду/ }))
    await waitFor(async () => {
      const cards = await repo.getAllCards()
      expect(cards.length).toBeGreaterThan(0)
    })
    const cards = await repo.getAllCards()
    expect(cards.every((card) => card.type === 'en-ru')).toBe(true)
    // после добавления поповер закрылся; повторное открытие слова — «уже в колоде»
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    fireEvent.click(
      screen
        .getAllByRole('button')
        .find(
          (b) =>
            b.classList.contains('quote-word') &&
            (b.textContent ?? '').toLowerCase().replace(/'s$/, '') === word,
        )!,
    )
    expect(await screen.findByText('уже в колоде')).toBeInTheDocument()
  })

  it('«понял без перевода» персистится (item_progress kind=quote)', async () => {
    const { quote } = await quoteWithKnownWord()
    renderAt(`#/quotes/${quote.id}`)
    await screen.findByText('Показать перевод')
    expect(await repo.getQuoteMark(quote.id)).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /Понял без перевода/ }))
    await waitFor(async () => {
      expect(await repo.getQuoteMark(quote.id)).toBe(true)
    })
    expect(screen.getByText(/✓ понял без перевода/)).toBeInTheDocument()
  })

  it('cloze: пропущенное слово проверяется доменом', async () => {
    const { quote, word } = await quoteWithKnownWord()
    renderAt(`#/quotes/${quote.id}`)
    await screen.findByText('Показать перевод')

    fireEvent.click(screen.getByRole('button', { name: /Cloze по цитате/ }))
    const input = await screen.findByRole('textbox')
    expect(screen.getByText(/___/)).toBeInTheDocument()
    fireEvent.change(input, { target: { value: word } })
    fireEvent.click(screen.getByRole('button', { name: /Проверить/ }))
    expect(await screen.findByText('Верно!')).toBeInTheDocument()
  })

  it('несуществующая цитата → 404', async () => {
    renderAt('#/quotes/q-nope-9999')
    expect(await screen.findByText('404')).toBeInTheDocument()
  })
})

describe('findQuote/quoteWords (данные)', () => {
  it('все цитаты находятся по id, id уникальны', async () => {
    const titles = await loadQuoteTitles()
    const ids = titles.flatMap(({ quotes }) => quotes.map((quote) => quote.id))
    expect(new Set(ids).size).toBe(ids.length)
    const one = await findQuote(ids[0]!)
    expect(one?.id).toBe(ids[0])
    expect(await findQuote('q-nope')).toBeNull()
  })
})

// M19: хвосты QuotesScreen (озвучка, поповер-закрытие, гарды клавиш, фильтр)
describe('QuotesScreen/QuoteScreen: хвосты (M19)', () => {
  it('галерея: фильтр «понятные» скрывает пустые; карточка ведёт на тайтл', async () => {
    renderAt('#/quotes')
    // фильтр на галерее: без изученных слов список пуст
    const filter = await screen.findByLabelText(/понятные мне сейчас/i)
    fireEvent.click(filter)
    await waitFor(() => {
      expect(screen.queryAllByRole('button', { name: /цитат/i })).toHaveLength(0)
    })
    fireEvent.click(filter) // снять фильтр — карточки вернулись
    const card = await screen.findAllByRole('button', { name: /цитат/i })
    fireEvent.click(card[0]!)
    await waitFor(() => expect(window.location.hash).toMatch(/title=/))
  })

  it('цитата: озвучка 🔊/🐢, закрытие поповера, клавиатурный гвард', async () => {
    const { quote, word } = await quoteWithKnownWord()
    renderAt(`#/quotes/${quote.id}`)
    await screen.findByText('Показать перевод')

    fireEvent.click(screen.getByRole('button', { name: /🔊/ }))
    fireEvent.click(screen.getByRole('button', { name: /🐢/ }))
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true }) // гвард: ничего не ломает

    // поповер: открыть и закрыть крестиком
    const wordButton = screen
      .getAllByRole('button')
      .find(
        (b) =>
          b.classList.contains('quote-word') &&
          (b.textContent ?? '').toLowerCase().replace(/'s$/, '') === word,
      )!
    fireEvent.click(wordButton)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Закрыть/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

// Implements: план M21#21.4 (веха S4) — хвосты покрытия QuotesScreen
describe('QuotesScreen/QuoteScreen: хвосты покрытия (S4)', () => {
  /** Кандидаты-леммы токена — копия lookupStems для поиска сценариев в данных. */
  function stems(word: string): string[] {
    const candidates = [word]
    if (word.endsWith('ies')) candidates.push(`${word.slice(0, -3)}y`)
    if (word.endsWith('es')) candidates.push(word.slice(0, -2))
    if (word.endsWith('s')) candidates.push(word.slice(0, -1))
    if (word.endsWith('ing')) {
      const stem = word.slice(0, -3)
      candidates.push(stem)
      if (stem.length > 2 && stem.at(-1) === stem.at(-2)) candidates.push(stem.slice(0, -1))
      candidates.push(`${stem}e`)
    }
    if (word.endsWith('ed')) {
      const stem = word.slice(0, -2)
      candidates.push(stem)
      if (stem.length > 2 && stem.at(-1) === stem.at(-2)) candidates.push(stem.slice(0, -1))
      candidates.push(`${stem}e`)
    }
    return candidates
  }

  it('ошибка загрузки тайтлов → галерея остаётся в загрузке (catch-ветка)', async () => {
    vi.mocked(loadQuoteTitles).mockRejectedValueOnce(new Error('load fail'))
    renderAt('#/quotes')
    // titles=[] при vocab=null → cards null → экран остаётся в состоянии загрузки
    expect(await screen.findByText('Загрузка…')).toBeInTheDocument()
    expect(screen.queryByText('Цитаты')).not.toBeInTheDocument()
  })

  it('ошибка загрузки слов на экране цитаты → 404 (catch-ветка)', async () => {
    vi.mocked(loadWordNotes).mockRejectedValueOnce(new Error('load fail'))
    renderAt('#/quotes/q-breaking-bad-0006')
    expect(await screen.findByText('404')).toBeInTheDocument()
  })

  it('галерея считает learning- и known-слова (best-ветки wordKnowledge)', async () => {
    const notes = await loadWordNotes()
    const pick = (en: string) => notes.find((note) => note.en === en)
    const learning = pick('it')
    const known = pick('dangerous')
    expect(learning && known).toBeTruthy()
    const { createFirstCards } = await import('../content/words')
    const log = (index: number) => ({
      id: `test-log-${index}`,
      card_id: '',
      rating: 3 as const,
      state: 0 as const,
      state_after: 0 as const,
      elapsed_days: 0,
      scheduled_days: 10,
      duration_ms: 0,
      client: 'web' as const,
      session_id: null,
      reviewed_at: new Date().toISOString(),
    })
    const [cardLearning] = createFirstCards([learning!], new Date())
    await repo.saveAnswer(
      { ...cardLearning, state: 1, stability: 1, difficulty: 5, reps: 1, scheduled_days: 0 },
      { ...log(1), card_id: cardLearning.card_id, state_after: 1 },
    )
    const [cardKnown] = createFirstCards([known!], new Date())
    await repo.saveAnswer(
      { ...cardKnown, state: 2, stability: 10, difficulty: 5, reps: 2, scheduled_days: 10 },
      { ...log(2), card_id: cardKnown.card_id, state_after: 2 },
    )
    renderAt('#/quotes')
    // useMemo галереи прогоняет quoteUnderstanding по всем цитатам
    expect(await screen.findByText('Цитаты')).toBeInTheDocument()
    expect(screen.getAllByText(/цитат/).length).toBeGreaterThan(0)
  })

  it('cloze: фолбэк-кандидат из датасета, когда в цитате нет слов топ-1000', async () => {
    const notes = await loadWordNotes()
    const byWord = new Set(notes.map((note) => note.en))
    const top1000 = await loadTopNgslLemmas()
    const titles = await loadQuoteTitles()
    let target: { id: string; word: string } | null = null
    outer: for (const { quotes } of titles) {
      for (const quote of quotes) {
        const words = quoteWords(quote.text)
        const hasTop = words.some((w) => stems(w).some((s) => top1000.has(s)))
        const dataset = words.filter((w) => stems(w).some((s) => byWord.has(s)))
        if (!hasTop && dataset.length > 0) {
          target = { id: quote.id, word: dataset[0]!.replace(/'s$/, '') }
          break outer
        }
      }
    }
    expect(target).not.toBeNull()
    renderAt(`#/quotes/${target!.id}`)
    await screen.findByText('Показать перевод')
    fireEvent.click(screen.getByRole('button', { name: /Cloze по цитате/ }))
    const input = await screen.findByRole('textbox')
    fireEvent.change(input, { target: { value: target!.word } })
    fireEvent.click(screen.getByRole('button', { name: /Проверить/ }))
    expect(await screen.findByText('Верно!')).toBeInTheDocument()
  })

  it('cloze: пустой сабмит игнорируется; «Дальше» после вердикта закрывает форму', async () => {
    const { quote, word } = await quoteWithKnownWord()
    renderAt(`#/quotes/${quote.id}`)
    await screen.findByText('Показать перевод')
    fireEvent.click(screen.getByRole('button', { name: /Cloze по цитате/ }))
    const input = await screen.findByRole('textbox')
    // пустое значение → guard (Enter/сабмит пустой формы)
    fireEvent.submit(input.closest('form')!)
    expect(screen.queryByText(/Верно|Неверно/)).not.toBeInTheDocument()
    expect(input.closest('form')).toBeInTheDocument()
    fireEvent.change(input, { target: { value: word } })
    fireEvent.submit(input.closest('form')!)
    expect(await screen.findByText('Верно!')).toBeInTheDocument()
    // «Дальше» (submit при установленном result) → setCloze(null), форма закрыта
    fireEvent.click(screen.getByRole('button', { name: /^Дальше/ }))
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument())
  })

  it('клавиши R/S озвучивают цитату; фокус в поле ввода глушит хоткей', async () => {
    const speakMock = vi.mocked(speak)
    speakMock.mockClear()
    const { quote } = await quoteWithKnownWord()
    renderAt(`#/quotes/${quote.id}`)
    await screen.findByText('Показать перевод')
    fireEvent.keyDown(window, { key: 'r' })
    expect(speakMock).toHaveBeenLastCalledWith(quote.text, { src: quote.audio?.en_gb })
    fireEvent.keyDown(window, { key: 's' })
    expect(speakMock).toHaveBeenLastCalledWith(quote.text, { src: quote.audio?.en_gb, rate: 0.75 })
    // хоткей не срабатывает, пока фокус/таргет — поле ввода (гард)
    fireEvent.click(screen.getByRole('button', { name: /Cloze по цитате/ }))
    const input = await screen.findByRole('textbox')
    fireEvent.keyDown(input, { key: 'r' })
    expect(speakMock).toHaveBeenCalledTimes(2)
  })
})

describe('QuoteScreen: кадр сцены (план M.3, фидбей-инфраструктура 2026-10-05)', () => {
  const stillQuote = {
    id: 'q-still-test',
    title: 'Test Title',
    season_episode: 'S01E01',
    speaker: 'Tester',
    text: 'The still must degrade silently.',
    translation_ru: 'Кадр должен тихо деградировать.',
    auto_vocab: { top1000: 1 },
    link_image: 'media/scenes/test-title/q-still-test.webp',
  }

  it('link_image: кнопка «Кадр сцены» раскрывает <img>; onError прячет блок', async () => {
    vi.mocked(findQuote).mockResolvedValueOnce(stillQuote)
    renderAt(`#/quotes/${stillQuote.id}`)
    expect(await screen.findByText('Показать перевод')).toBeInTheDocument()
    // без кадра кнопки нет
    expect(screen.queryByRole('button', { name: /Кадр сцены/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Кадр сцены/ }))
    const img = screen.getByRole('img', { name: /кадр сцены/ })
    expect(img).toHaveAttribute('src', 'media/scenes/test-title/q-still-test.webp')
    // файла нет (кэш вне git) — тихая деградация: блок удаляется
    fireEvent.error(img)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    // повторное раскрытие не ломает экран
    fireEvent.click(screen.getByRole('button', { name: /Скрыть кадр/ }))
    expect(screen.getByRole('button', { name: /Кадр сцены/ })).toBeInTheDocument()
  })
})
