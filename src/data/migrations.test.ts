// Implements: plan://curriculum-review#U3.2 — миграция v1-флора оценки
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fixV1WordFloor, floorV2Done } from './migrations'
import { HunterDb } from './db'
import { DexieProgressRepository } from './progress-repository'
import { uuidv7 } from '../lib/uuidv7'
import type { CardState } from '../domain/srs/types'

let repo: DexieProgressRepository

function card(noteId: string, suspended: boolean): CardState {
  return {
    card_id: `${noteId}.en-ru`,
    note_id: noteId,
    type: 'en-ru',
    deck: 'words',
    due: new Date().toISOString(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    last_review: null,
    suspended,
    cloze_index: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

const RANKS = new Map([
  ['w0300', 300], // полоса E — остаётся скрытой и при новом флоре A (≤2800)
  ['w2800', 2800], // граница нового флора A — скрыта
  ['w3000', 3000], // полоса A (2801–4000) — вернуть
  ['w4000', 4000], // полоса A — вернуть (граница включительно)
  ['w4500', 4500], // выше старого флора — никогда не была скрыта
  ['wsub', Number.POSITIVE_INFINITY], // субтитровые — не трогаем
])

beforeEach(() => {
  localStorage.clear()
  repo = new DexieProgressRepository(new HunterDb(`hunter-mig-test-${uuidv7()}`))
})

describe('fixV1WordFloor', () => {
  it('ранг A: возвращает полосу 2801–4000, остальное не трогает; флаг ставится', async () => {
    await repo.ensureCards(
      [
        'note_w0300',
        'note_w2800',
        'note_w3000',
        'note_w4000',
        'note_w4500',
        'note_wsub',
        'note_norank',
      ].map((n) => card(n, true)),
    )
    // w4500/wsub не были скрыты по флору — сделаем их обычными New
    await repo.unsuspendNotes(['note_w4500', 'note_wsub'])

    // norank нет в карте рангов, wsub — Infinity: оба пропускаются фильтром
    const fixed = await fixV1WordFloor(repo, 'A', RANKS)
    expect(fixed).toBe(2) // w3000 + w4000
    const cards = await repo.getAllCards()
    const byNote = new Map(cards.map((c) => [c.note_id, c.suspended]))
    expect(byNote.get('note_w3000')).toBe(false)
    expect(byNote.get('note_w4000')).toBe(false)
    expect(byNote.get('note_w2800')).toBe(true) // ≤ нового флора — скрыто
    expect(byNote.get('note_w0300')).toBe(true)
    expect(floorV2Done()).toBe(true)

    // идемпотентность: второй прогон ничего не меняет
    expect(await fixV1WordFloor(repo, 'A', RANKS)).toBe(0)
  })

  it('ранг E/S — просто ставит флаг', async () => {
    expect(await fixV1WordFloor(repo, 'E', RANKS)).toBe(0)
    expect(floorV2Done()).toBe(true)
  })
})

describe('floorV2Done', () => {
  it('localStorage недоступен → считаем миграцию проведённой (не гоняем)', () => {
    const original = window.localStorage
    // jsdom: подменяем getItem на кидающий
    const throwing = {
      ...original,
      getItem: () => {
        throw new Error('denied')
      },
    }
    vi.stubGlobal('localStorage', throwing)
    expect(floorV2Done()).toBe(true)
    vi.unstubAllGlobals()
  })
})
