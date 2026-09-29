// Implements: plan://M11#11.1–11.2 — тесты экранов Цитат (реальные data/quotes)
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import '../i18n'
import { loadQuoteTitles, findQuote, quoteWords } from '../content/quotes'
import { loadWordNotes } from '../content/words'
import { HunterDb } from '../data/db'
import { DexieProgressRepository } from '../data/progress-repository'
import { uuidv7 } from '../lib/uuidv7'
import QuotesScreen, { QuoteScreen } from './QuotesScreen'

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
