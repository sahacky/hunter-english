// Implements: plan://M4#4.4 — интеграционные тесты экрана /srs (fake-indexeddb)
import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { createFirstCards } from '../content/words'
import { DexieProgressRepository } from '../data/progress-repository'
import { HunterDb } from '../data/db'
import type { Note } from '../domain/srs/types'
import { uuidv7 } from '../lib/uuidv7'
import SrsScreen from './SrsScreen'
import '../i18n'

const WORDS: Array<[string, string]> = [
  ['house', 'дом'],
  ['water', 'вода'],
  ['friend', 'друг'],
]

let seq = 0
let db: HunterDb
let repo: DexieProgressRepository
let notes: Note[]

function mkNotes(): Note[] {
  seq = 0
  return WORDS.map(([en, ru]) => {
    seq += 1
    return {
      id: `note_test${seq}`,
      deck: 'words',
      entityId: `test${seq}`,
      en,
      ru,
      audio: `audio/words/cori/test${seq}.opus`,
    }
  })
}

async function bootstrap() {
  await repo.ensureCards(createFirstCards(notes, new Date()))
}

beforeEach(() => {
  notes = mkNotes()
  db = new HunterDb(`hunter-srs-test-${uuidv7()}`)
  repo = new DexieProgressRepository(db)
})

function renderScreen() {
  return render(
    <HashRouter>
      <SrsScreen repo={repo} notes={notes} />
    </HashRouter>,
  )
}

describe('SrsScreen', () => {
  it('пустая очередь → «всё повторено»', async () => {
    render(
      <HashRouter>
        <SrsScreen repo={repo} notes={[]} />
      </HashRouter>,
    )
    expect(await screen.findByText('Всё повторено — очередь на сегодня пуста.')).toBeInTheDocument()
  })

  it('показывает фронт, пробел переворачивает, оценка 2 уходит в review_log', async () => {
    await bootstrap()
    renderScreen()

    expect(await screen.findByText('house')).toBeInTheDocument()
    expect(screen.queryByText('дом')).not.toBeInTheDocument()

    fireEvent.keyDown(window, { code: 'Space' })
    expect(await screen.findByText('дом')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: '2' })
    expect(await screen.findByText('water')).toBeInTheDocument()

    const logs = await db.review_log.toArray()
    expect(logs).toHaveLength(1)
    expect(logs[0].card_id).toBe('test1.en-ru')
    expect(logs[0].rating).toBe(3)
    expect(logs[0].session_id).not.toBeNull()
    expect((await db.sync_queue.toArray()).length).toBe(2)
  })

  it('кнопки 1/2 кликабельны, счётчик очереди живой, финал после всех карточек', async () => {
    await bootstrap()
    renderScreen()

    expect(await screen.findByText('house')).toBeInTheDocument()

    for (let i = 0; i < WORDS.length; i += 1) {
      await screen.findByText(WORDS[i][0])
      fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
      fireEvent.click(screen.getByRole('button', { name: /Вспомнил/ }))
    }

    expect(
      await screen.findByText('Сессия завершена. Отличная работа, Охотник.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Ответов: 3')).toBeInTheDocument()
    expect(await db.review_log.count()).toBe(WORDS.length)
  })

  it('клавиша 1 (Не вспомнил) тоже работает и красит очередь', async () => {
    await bootstrap()
    renderScreen()

    expect(await screen.findByText('house')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Показать ответ/ }))
    fireEvent.click(screen.getByRole('button', { name: /Не вспомнил/ }))

    expect(await screen.findByText('water')).toBeInTheDocument()
    const [log] = await db.review_log.toArray()
    expect(log.rating).toBe(1)
    expect(log.state_after).toBe(1) // осталась в Learning
  })

  it('маршрут /srs в App рендерит экран повторения', async () => {
    window.location.hash = '#/srs'
    render(
      <HashRouter>
        <App />
      </HashRouter>,
    )
    await waitFor(() => expect(screen.getByText('Повторение')).toBeInTheDocument())
  })
})
