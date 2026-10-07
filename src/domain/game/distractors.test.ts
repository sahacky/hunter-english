// Implements: plan://distractor-quality#D1 — тесты подбора дистракторов Врат.
import { describe, expect, it } from 'vitest'
import { loadWordNotes, loadWordRanks } from '../../content/words'
import { pickDistractors, scoreDistractor, type DistractorCandidate } from './distractors'

const cand = (entityId: string, en: string, ru: string): DistractorCandidate => ({
  entityId,
  en,
  ru,
})

const seeded = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

describe('scoreDistractor', () => {
  it('похожий (часть речи + ранг + написание + перевод) выше случайного', () => {
    const ranks = new Map([
      ['watch-verb', 500],
      ['catch-verb', 520],
      ['kitchen-noun', 510],
    ])
    const target = cand('watch-verb', 'watch', 'смотреть; часы')
    const similar = scoreDistractor(target, cand('catch-verb', 'catch', 'ловить, смотреть'), ranks)
    const random = scoreDistractor(target, cand('kitchen-noun', 'kitchen', 'кухня'), ranks)
    expect(similar).toBeGreaterThan(random)
    // компоненты: часть речи (+2) + окно ранга + написание watch/catch + «смотреть»
    expect(similar).toBeGreaterThanOrEqual(2 + 2 * (1 - 20 / 300) + 2.5 * (3 / 5) + 1.5 - 0.01)
  })

  it('далёкий ранг не даёт бонуса ранга', () => {
    const ranks = new Map([
      ['water-noun', 300],
      ['river-noun', 1200],
    ])
    const score = scoreDistractor(
      cand('water-noun', 'water', 'вода'),
      cand('river-noun', 'river', 'река'),
      ranks,
    )
    // только часть речи (×2): написание water/river ~0.2 — ниже порога, перевод не пересекается
    expect(score).toBeCloseTo(2)
  })
})

describe('pickDistractors', () => {
  const ranks = new Map([
    ['house-noun', 400],
    ['horse-noun', 410],
    ['mouse-noun', 420],
    ['home-noun', 430],
    ['tree-noun', 440],
    ['spoon-noun', 450],
    ['sky-noun', 2000],
  ])
  const target = cand('house-noun', 'house', 'дом')
  const candidates = [
    cand('horse-noun', 'horse', 'лошадь'),
    cand('mouse-noun', 'mouse', 'мышь'),
    cand('home-noun', 'home', 'дом'),
    cand('tree-noun', 'tree', 'дерево'),
    cand('spoon-noun', 'spoon', 'ложка'),
    cand('sky-noun', 'sky', 'небо'),
  ]

  it('исключает дублиkat перевода и саму цель, даёт count штук', () => {
    const picked = pickDistractors(target, candidates, ranks, 3, seeded(7))
    expect(picked).toHaveLength(3)
    expect(picked.map((c) => c.en)).not.toContain('house')
    expect(picked.map((c) => c.ru)).not.toContain('дом')
  })

  it('похожие по написанию попадают в выборку: лучший всегда, прочие — из окна', () => {
    const picked = pickDistractors(target, candidates, ranks, 3, seeded(7))
    // horse (написание 4/5, лучший скор) — гарантирован; mouse (3/5) — рядом
    const pickedEn = picked.map((c) => c.en)
    expect(pickedEn).toContain('horse')
    expect(pickedEn).toContain('mouse')
  })

  it('детерминизм: один rng — один результат', () => {
    expect(pickDistractors(target, candidates, ranks, 3, seeded(42))).toEqual(
      pickDistractors(target, candidates, ranks, 3, seeded(42)),
    )
  })

  it('маленький пул — сколько есть', () => {
    const picked = pickDistractors(
      target,
      [cand('horse-noun', 'horse', 'лошадь')],
      ranks,
      3,
      seeded(1),
    )
    expect(picked).toHaveLength(1)
  })

  it('пустой пул — пустой результат', () => {
    expect(pickDistractors(target, [], ranks, 3, seeded(1))).toEqual([])
  })
})

describe('pickDistractors на реальных данных (E-полоса)', () => {
  it('дистракторы в основном той же части речи и не совпадают с целью', async () => {
    const [notes, ranks] = await Promise.all([loadWordNotes(), loadWordRanks()])
    const band = notes.filter((n) => (ranks.get(n.entityId) ?? Infinity) <= 721)
    const targets = band.slice(400, 410) // середина полосы, не самые частотные
    let samePos = 0
    let total = 0
    for (const note of targets) {
      const picked = pickDistractors(
        note,
        band.filter((n) => n.id !== note.id),
        ranks,
        3,
        seeded(3),
      )
      expect(picked).toHaveLength(3)
      expect(picked.map((c) => c.en)).not.toContain(note.en)
      for (const c of picked) {
        total += 1
        if (
          c.entityId.slice(c.entityId.lastIndexOf('-') + 1) ===
          note.entityId.slice(note.entityId.lastIndexOf('-') + 1)
        )
          samePos += 1
      }
    }
    // прежний slice давал бы ~0% совпадений части речи; скоринг — большинство
    expect(samePos / total).toBeGreaterThan(0.6)
  })
})
