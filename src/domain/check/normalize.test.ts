// Implements: plan://M5#5.1 — unit-тесты нормализации и сокращений (specs/02 §4.1–§4.2)
import { describe, expect, it } from 'vitest'
import { expandTokens, normalize, tokenize } from './normalize'

describe('normalize (specs/02 §4.1)', () => {
  it('приводит регистр и обрезает пробелы', () => {
    expect(normalize('  I AM Hungry ')).toBe('i am hungry')
  })

  it('схлопывает лишние пробелы', () => {
    expect(normalize('I   am\t hungry')).toBe('i am hungry')
  })

  it('приводит типографские апострофы к прямому', () => {
    expect(normalize('I’m hungry')).toBe("i'm hungry")
    expect(normalize('can´t')).toBe("can't")
    expect(normalize('don`t')).toBe("don't")
  })

  it('приводит кавычки к двойной', () => {
    expect(normalize('«привет»')).toBe('"привет"')
    expect(normalize('“hi”')).toBe('"hi"')
  })

  it('снимает конечные знаки пунктуации', () => {
    expect(normalize('I am hungry.')).toBe('i am hungry')
    expect(normalize('Where do you live?!')).toBe('where do you live')
    expect(normalize('I think, that…')).toBe('i think, that')
  })

  it('не трогает внутреннюю пунктуацию', () => {
    expect(normalize("I'm fine, thanks")).toBe("i'm fine, thanks")
  })
})

describe('tokenize', () => {
  it('снимает пунктуацию вокруг слов, сохраняя апострофы', () => {
    expect(tokenize("He said: 'go!'")).toEqual(['he', 'said', 'go'])
  })

  it('сохраняет дефис внутри слова', () => {
    expect(tokenize('Check-in, please.')).toEqual(['check-in', 'please'])
  })

  it('возвращает пустой массив для пустой строки', () => {
    expect(tokenize('   ')).toEqual([])
  })
})

describe('expandTokens (specs/02 §4.2)', () => {
  it("раскрывает I'm = I am и don't = do not", () => {
    expect(expandTokens(tokenize("I'm hungry"))).toEqual(['i', 'am', 'hungry'])
    expect(expandTokens(tokenize("I don't know"))).toEqual(['i', 'do', 'not', 'know'])
  })

  it("даёт тройную эквивалентность can't = cannot = can not", () => {
    const expanded = expandTokens(tokenize("I can't swim"))
    expect(expanded).toEqual(['i', 'can', 'not', 'swim'])
    expect(expandTokens(tokenize('I cannot swim'))).toEqual(expanded)
    expect(expandTokens(tokenize('I can not swim'))).toEqual(expanded)
  })

  it('раскрывает won’t, включая типографский апостроф', () => {
    expect(expandTokens(tokenize('I won’t go'))).toEqual(['i', 'will', 'not', 'go'])
  })

  it('не трогает притяжательные (John’s не в словаре)', () => {
    expect(expandTokens(tokenize("John's book"))).toEqual(["john's", 'book'])
  })

  it('раскрывает gonna в going to', () => {
    expect(expandTokens(tokenize('I gonna go'))).toEqual(['i', 'going', 'to', 'go'])
  })
})
