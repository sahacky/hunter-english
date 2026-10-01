// Implements: plan://onboarding#O.7 — флаг онбординга: недоступное хранилище
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isOnboarded, markOnboarded, ONBOARDING_KEY } from './onboarding'

const getter = vi.spyOn(Storage.prototype, 'getItem')
const setter = vi.spyOn(Storage.prototype, 'setItem')

afterEach(() => {
  getter.mockReset()
  setter.mockReset()
  localStorage.removeItem(ONBOARDING_KEY)
})

describe('onboarding flag', () => {
  it('по умолчанию не пройден; markOnboarded ставит флаг', async () => {
    expect(await isOnboarded()).toBe(false)
    await markOnboarded()
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('1')
    expect(await isOnboarded()).toBe(true)
  })

  it('запрещённое хранилище: isOnboarded → true (не блокируем вход), markOnboarded не бросает', async () => {
    getter.mockImplementation(() => {
      throw new Error('denied')
    })
    setter.mockImplementation(() => {
      throw new Error('denied')
    })
    expect(await isOnboarded()).toBe(true)
    await expect(markOnboarded()).resolves.toBeUndefined()
  })
})
