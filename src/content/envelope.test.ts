// Implements: plan://M18 — GAP-7 specs/09 §4.6 (TC-CONT-06)
import { describe, expect, it } from 'vitest'
import { assertEnvelope } from './envelope'

describe('assertEnvelope: runtime-гвард контент-чанков', () => {
  it('корректный envelope проходит', () => {
    expect(() =>
      assertEnvelope({ schema_version: 1, kind: 'words' }, 'words', 'data/words #0'),
    ).not.toThrow()
  })

  it('чужой kind — понятная ошибка (не белый экран)', () => {
    expect(() =>
      assertEnvelope({ schema_version: 1, kind: 'phrases' }, 'words', 'data/words #0'),
    ).toThrow(/ожидался words schema_version 1/)
  })

  it('другая версия схемы — ошибка (рассинхрон деплоя)', () => {
    expect(() =>
      assertEnvelope({ schema_version: 2, kind: 'words' }, 'words', 'data/words #0'),
    ).toThrow(/получен words v2/)
  })

  it('пустой файл — ошибка', () => {
    expect(() => assertEnvelope(undefined, 'words', 'data/words #0')).toThrow(/пустой файл/)
  })
})
