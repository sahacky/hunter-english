// Implements: plan://curriculum-review#I.1 — учёт минут аудирования дня
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { addListeningSeconds, questWithListening } from './listening'
import { HunterDb } from './db'
import { DexieProgressRepository } from './progress-repository'
import { createQuestDay, LISTENING_TARGET_SEC } from '../domain/game/game'
import { dayStart } from '../domain/srs/scheduler'
import { uuidv7 } from '../lib/uuidv7'

let repo: DexieProgressRepository

beforeEach(() => {
  repo = new DexieProgressRepository(new HunterDb(`hunter-listen-test-${uuidv7()}`))
})

describe('addListeningSeconds', () => {
  it('создаёт день при первом прослушивании и накапливает секунды', async () => {
    await addListeningSeconds(repo, 30, new Date('2026-03-01T10:00:00Z'))
    await addListeningSeconds(repo, 15, new Date('2026-03-01T10:05:00Z'))
    const dayIso = dayStart(new Date('2026-03-01T10:05:00Z')).toISOString()
    const row = await repo.getQuestDay(dayIso)
    expect(row?.slots.listening).toEqual({ done: 45, target: LISTENING_TARGET_SEC })
  })

  it('запись дня без слота listening (старые данные) — дозаполняется, не падает', async () => {
    const dayIso = dayStart(new Date('2026-03-02T09:00:00Z')).toISOString()
    const legacy = createQuestDay(dayIso, 5)
    await repo.putQuestDay({ ...legacy, slots: { ...legacy.slots, listening: undefined } } as never)
    await addListeningSeconds(repo, 60, new Date('2026-03-02T09:01:00Z'))
    const row = await repo.getQuestDay(dayIso)
    expect(row?.slots.listening.done).toBe(60)
  })

  it('невалидные секунды игнорируются', async () => {
    await addListeningSeconds(repo, 0)
    await addListeningSeconds(repo, -5)
    await addListeningSeconds(repo, Number.NaN)
    const dayIso = dayStart(new Date()).toISOString()
    expect(await repo.getQuestDay(dayIso)).toBeNull() // дня не создали
  })

  it('ручная отметка «вне приложения» добивает цель дня', async () => {
    const now = new Date('2026-03-03T12:00:00Z')
    await addListeningSeconds(repo, 120, now)
    await addListeningSeconds(repo, LISTENING_TARGET_SEC, now)
    const dayIso = dayStart(now).toISOString()
    const row = await repo.getQuestDay(dayIso)
    expect(row?.slots.listening.done).toBe(120 + LISTENING_TARGET_SEC)
  })
})

describe('questWithListening', () => {
  it('строка без слота получает цель input-трека; со слотом — не трогается', () => {
    const dayIso = dayStart(new Date()).toISOString()
    const legacy = { ...createQuestDay(dayIso, 0) }
    const without = { ...legacy, slots: { ...legacy.slots, listening: undefined } } as never
    expect(questWithListening(without).slots.listening).toEqual({
      done: 0,
      target: LISTENING_TARGET_SEC,
    })
    const filled = questWithListening(legacy)
    expect(filled).toBe(legacy)
  })
})
