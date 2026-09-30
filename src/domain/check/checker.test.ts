// Implements: plan://M5#5.1 — unit-тесты алгоритма проверки (specs/02 §4.3–§4.8)
import { describe, expect, it } from 'vitest'
import { alignWords, countTypos, countWrong } from './align'
import { checkText, judge, judgeDictation, judgeVoice, STRICT_TYPO_TRAPS } from './checker'
import { compareWords, levenshtein, typoLimit } from './levenshtein'
import type { CheckTask } from './types'

function task(accepted: string[], extra: Partial<CheckTask> = {}): CheckTask {
  return { accepted, ...extra }
}

describe('levenshtein (specs/02 §4.4)', () => {
  it('считает расстояние вставок/удалений/замен', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('same', 'same')).toBe(0)
    expect(levenshtein('cat', '')).toBe(3)
  })

  it('typoLimit: ≤3 букв — 0, ≤7 — 1, 8+ — 2', () => {
    expect(typoLimit('cat')).toBe(0)
    expect(typoLimit('does')).toBe(1)
    expect(typoLimit('teacher')).toBe(1)
    expect(typoLimit('beautiful')).toBe(2)
  })

  it('compareWords: исключения не прощают опечаток', () => {
    expect(compareWords('in', 'im')).toBe('mismatch')
    expect(compareWords('he', 'she')).toBe('mismatch')
    expect(compareWords('is', 'iz')).toBe('mismatch')
  })

  it('compareWords: обычные слова допускают опечатку в пределах лимита', () => {
    expect(compareWords('techer', 'teacher')).toBe('typo')
    expect(compareWords('teacherrr', 'teacher')).toBe('mismatch')
  })
})

describe('alignWords (specs/02 §4.5)', () => {
  it('помечает совпадения и опечатки', () => {
    const diff = alignWords(['the', 'techer', 'is', 'here'], ['the', 'teacher', 'is', 'here'])
    expect(countTypos(diff)).toBe(1)
    expect(countWrong(diff)).toBe(0)
    expect(diff[1]).toEqual({ status: 'typo', word: 'techer', ref: 'teacher' })
  })

  it('лишнее слово — extra (одна ошибка)', () => {
    const diff = alignWords(['i', 'go', 'to', 'home'], ['i', 'go', 'home'])
    expect(countWrong(diff)).toBe(1)
    expect(diff.map((t) => t.status)).toEqual(['match', 'match', 'extra', 'match'])
    expect(diff[2]).toEqual({ status: 'extra', word: 'to' })
  })

  it('неверная замена разворачивается в extra + missing', () => {
    const diff = alignWords(['they', 'is', 'here'], ['they', 'are', 'here'])
    expect(countWrong(diff)).toBe(2)
    expect(diff[1]).toEqual({ status: 'extra', word: 'is' })
    expect(diff[2]).toEqual({ status: 'missing', word: 'are' })
  })

  it('пропущенные слова в конце фразы', () => {
    const diff = alignWords(['i', 'go'], ['i', 'go', 'home', 'now'])
    expect(countWrong(diff)).toBe(2)
    expect(diff[2]).toEqual({ status: 'missing', word: 'home' })
  })
})

describe('checkText (specs/02 §4.4)', () => {
  it('точное совпадение — correct', () => {
    const result = checkText("I'm hungry", task(["I'm hungry", 'I am hungry']))
    expect(result.verdict).toBe('correct')
    expect(result.trapTriggered).toBe(false)
  })

  it('регистр, пунктуация и пробелы не влияют', () => {
    const result = checkText('  i am hungry.  ', task(['I am hungry']))
    expect(result.verdict).toBe('correct')
  })

  it('сокращения эквивалентны без дублей в вариантах', () => {
    expect(checkText('I do not know', task(["I don't know"])).verdict).toBe('correct')
    expect(checkText('I cannot swim', task(["I can't swim"])).verdict).toBe('correct')
    expect(checkText('I can not swim', task(["I can't swim"])).verdict).toBe('correct')
  })

  it('gonna засчитывается только при going to-варианте', () => {
    expect(checkText('I am gonna be late', task(["I'm going to be late"])).verdict).toBe('correct')
    expect(checkText('I am gonna be late', task(['I want to be late'])).verdict).toBe('wrong')
  })

  it('выбирает лучший из вариантов', () => {
    const result = checkText('I am going home now', task(["I'm going home", 'I am going home now']))
    expect(result.verdict).toBe('correct')
    expect(result.ref).toBe('I am going home now')
  })

  it('опечатка 4–7 букв засчитывается с подсветкой (correct_typo)', () => {
    const result = checkText('The techer is here', task(['The teacher is here']))
    expect(result.verdict).toBe('correct_typo')
    const typo = result.diff.find((t) => t.status === 'typo')
    expect(typo?.word).toBe('techer')
    expect(typo?.ref).toBe('teacher')
  })

  it('у коротких слов опечатки нет: 3 буквы — только точное', () => {
    expect(checkText('the kat is here', task(['the cat is here'])).verdict).toBe('wrong')
  })

  it('опечатка в слове-исключении — ошибка', () => {
    expect(checkText('They is here', task(['They are here'])).verdict).toBe('wrong')
    expect(checkText('I an here', task(['I am here'])).verdict).toBe('wrong')
  })

  it('две опечатки в словах допустимы, три — нет', () => {
    const twoTypos = checkText('wonderful parck', task(['wonderfull parkk']))
    expect(twoTypos.verdict).toBe('correct_typo')
    const threeTypos = checkText('She makez guod coffea', task(['She makes good coffee']))
    expect(threeTypos.verdict).toBe('wrong')
  })

  it('разница длиннее 2 слов — сразу неверно, но diff строится', () => {
    const result = checkText('I go', task(['I want to go home now']))
    expect(result.verdict).toBe('wrong')
    expect(countWrong(result.diff)).toBeGreaterThan(0)
  })

  it('полностью неверный ответ — wrong с лучшим эталоном', () => {
    const result = checkText('Я не знаю', task(["I don't know", 'I do not know']))
    expect(result.verdict).toBe('wrong')
    expect(result.ref).toBe("I don't know")
  })
})

describe('ловушки (specs/02 §4.3, §4.7)', () => {
  it('явный запрещённый паттерн — неверно, даже если похоже на опечатку', () => {
    const result = judge('He live here', task(['He lives here'], { trapWrong: 'He live here' }))
    expect(result.verdict).toBe('wrong')
    expect(result.trapTriggered).toBe(true)
  })

  it('явный паттерн сверяется и с раскрытием сокращений (ЛТ-08)', () => {
    // «I did not went» = «I didn't went» по §4.2 — запрещённый паттерн ловушки → wrong.
    const result = judge(
      'I did not went',
      task(["I didn't go"], {
        trapWrong: "I didn't went",
      }),
    )
    expect(result.verdict).toBe('wrong')
    expect(result.trapTriggered).toBe(true)
  })

  it('паттерн не совпал — обычный вердикт без флага', () => {
    const result = judge('He lives here', task(['He lives here'], { trapWrong: 'He live here' }))
    expect(result.verdict).toBe('correct')
    expect(result.trapTriggered).toBe(false)
  })

  it('строгие ловушки ЛТ-06/17/19 превращают correct_typo в wrong', () => {
    expect(STRICT_TYPO_TRAPS.has('ЛТ-06')).toBe(true)
    const strict = judge('I have a brothe', task(['I have a brother'], { trapLtId: 'ЛТ-06' }))
    expect(strict.verdict).toBe('wrong')
    const lenient = checkText('I have a brothe', task(['I have a brother']))
    expect(lenient.verdict).toBe('correct_typo')
  })

  it('ЛТ-17: опечатка у rains не прощается', () => {
    const result = judge(
      'If it rainss, I stay home',
      task(['If it rains, I stay home'], { trapLtId: 'ЛТ-17' }),
    )
    expect(result.verdict).toBe('wrong')
  })

  it('ЛТ-19: точный ответ со строгой ловушкой остаётся correct', () => {
    const result = judge('Where do you live?', task(['Where do you live?'], { trapLtId: 'ЛТ-19' }))
    expect(result.verdict).toBe('correct')
  })
})

describe('judgeVoice (specs/02 §4.8)', () => {
  it('порог 0.85: 6 из 7 слов — correct', () => {
    const result = judgeVoice('I want to go home now', task(['I want to go home now please']))
    expect(result.verdict).toBe('correct')
  })

  it('ниже порога — retry (не ошибка)', () => {
    const result = judgeVoice('I want go home now', task(['I want to go home now please']))
    expect(result.verdict).toBe('retry')
  })

  it('длинная фраза (>8 слов): порог 0.80', () => {
    const ref = 'my family stays with me in the big city every summer'
    const result = judgeVoice('my family stays with me in the big city every', task([ref]))
    expect(result.verdict).toBe('correct')
  })

  it('сокращения раскрываются и в голосе', () => {
    const result = judgeVoice('I cannot swim', task(["I can't swim"]))
    expect(result.verdict).toBe('correct')
  })

  it('артикли исключаются из обеих сторон (решение M6#2)', () => {
    // «give me map» против «Give me the map»: знаменатель без артикля → 3/3 → correct.
    const dropped = judgeVoice('give me map', task(['Give me the map']))
    expect(dropped.verdict).toBe('correct')
    const full = judgeVoice('give me the map', task(['Give me the map']))
    expect(full.verdict).toBe('correct')
    // diff согласован с вердиктом: принятый ответ без красных missing-артиклей
    const missing = dropped.diff.filter((t) => t.status === 'missing')
    expect(missing).toEqual([])
  })

  it('speech_threshold из данных переопределяет базовый порог', () => {
    // 5 из 6 слов = 0.83: дефолт 0.85 — retry, порог 0.8 из данных — correct
    const ref = 'i want to go home now'
    const strict = judgeVoice('want to go home now', task([ref]))
    expect(strict.verdict).toBe('retry')
    const lenient = judgeVoice('want to go home now', task([ref], { speechThreshold: 0.8 }))
    expect(lenient.verdict).toBe('correct')
  })

  it('judge в режиме voice уходит в голосовую проверку', () => {
    const result = judge('I cannot swim', task(["I can't swim"]), 'voice')
    expect(result.verdict).toBe('correct')
  })
})

describe('judge — сводный вердикт (specs/02 §4.7)', () => {
  it('текст по умолчанию: correct_typo без строгой ловушки проходит', () => {
    const result = judge('The techer is here', task(['The teacher is here']))
    expect(result.verdict).toBe('correct_typo')
  })

  it('неверный ответ возвращает diff и эталон', () => {
    const result = judge('I go to home', task(['I go home']))
    expect(result.verdict).toBe('wrong')
    expect(result.ref).toBe('I go home')
  })
})

// Implements: plan://M18 — GAP-3 specs/09 §4.1 (TC-CHK-07, TC-CHK-10)
describe('exactTypos: typo=exact — опечатка не прощается (specs/02 §4.4)', () => {
  it('точное совпадение → correct', () => {
    expect(judge('finished', task(['finished'], { exactTypos: true })).verdict).toBe('correct')
  })

  it('одна опечатка → wrong (cloze/verb_tense)', () => {
    expect(judge('finshed', task(['finished'], { exactTypos: true })).verdict).toBe('wrong')
  })

  it('без флага та же опечатка → correct_typo', () => {
    expect(judge('finshed', task(['finished'])).verdict).toBe('correct_typo')
  })
})

describe('judgeDictation: пропущенные артикли ≤2 прощаются (specs/02 §4.4 диктант)', () => {
  it('один пропущенный артикль → correct_typo', () => {
    const verdict = judgeDictation('house is big', task(['The house is big']))
    expect(verdict.verdict).toBe('correct_typo')
  })

  it('два пропущенных артикля → correct_typo', () => {
    const verdict = judgeDictation('I see dog in park', task(['I see a dog in the park']))
    expect(verdict.verdict).toBe('correct_typo')
  })

  it('три пропущенных артикля → wrong (лимит ≤2)', () => {
    const verdict = judgeDictation('cat on mat in hall', task(['The cat on the mat in the hall']))
    expect(verdict.verdict).toBe('wrong')
  })

  it('пропущенное знаменательное слово → wrong (артикли ни при чём)', () => {
    const verdict = judgeDictation('The house is', task(['The house is big']))
    expect(verdict.verdict).toBe('wrong')
  })
})

// M19: хвостовые ветки checker
describe('checker: хвосты (M19)', () => {
  it('judgeDictation: строгий вердикт не-wrong возвращается как есть', () => {
    const verdict = judgeDictation('The house is big', task(['The house is big']))
    expect(verdict.verdict).toBe('correct')
  })

  it('judgeVoice: эталон из одних артиклей пропускается (continue, без крэша)', () => {
    // знаменатель пуст → эффективных токенов нет; хотя бы один валидный ref нужен
    const verdict = judgeVoice('the a', task(['the a', 'house']))
    expect(['correct', 'correct_typo', 'wrong']).toContain(verdict.verdict)
  })
})
