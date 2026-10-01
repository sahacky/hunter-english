// Implements: plan://travel-vocab#V.5 — лоадер и группировка мини-словаря
import { describe, expect, it } from 'vitest'
import { groupVocabByTopic, loadTravelVocab, VOCAB_TOPICS, type TravelVocabEntry } from './vocab'

describe('loadTravelVocab', () => {
  it('data/vocab/travel.json: записи на месте, темы известны, аудио-пути валидны', async () => {
    const entries = await loadTravelVocab()
    expect(entries.length).toBeGreaterThanOrEqual(400)
    const known = new Set<string>(VOCAB_TOPICS)
    for (const entry of entries) {
      expect(known.has(entry.topic), `неизвестная тема: ${entry.topic}`).toBe(true)
      expect(entry.en.length).toBeGreaterThan(0)
      expect(entry.ru.length).toBeGreaterThan(0)
      // существование файлов аудио проверяет validate:data (шаг CI)
      if (entry.audio) expect(entry.audio).toMatch(/^audio\/(words|vocab)\/cori\/[a-z0-9-]+\.opus$/)
    }
  })
})

describe('groupVocabByTopic', () => {
  it('канонический порядок тем, внутри — порядок файла', () => {
    const entries: TravelVocabEntry[] = [
      { topic: 'airport', en: 'gate', ru: 'выход' },
      { topic: 'politeness', en: 'hello', ru: 'привет' },
      { topic: 'airport', en: 'gate 2', ru: 'выход 2' },
    ]
    const groups = groupVocabByTopic(entries)
    expect(groups.map((group) => group.topic)).toEqual(['politeness', 'airport'])
    expect(groups[1]!.words.map((word) => word.en)).toEqual(['gate', 'gate 2'])
  })

  it('неизвестная тема уходит в конец по алфавиту', () => {
    const entries: TravelVocabEntry[] = [
      { topic: 'zebra', en: 'z', ru: 'з' },
      { topic: 'airport', en: 'gate', ru: 'выход' },
      { topic: 'alpha-extra', en: 'a', ru: 'а' },
    ]
    expect(groupVocabByTopic(entries).map((group) => group.topic)).toEqual([
      'airport',
      'alpha-extra',
      'zebra',
    ])
  })
})
