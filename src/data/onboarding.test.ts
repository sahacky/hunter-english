// Implements: plan://onboarding#O.7, plan://curriculum-review#P.2 — флаг онбординга
// и память о применении вердикта: недоступное/повреждённое хранилище
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getPlacementInfo,
  isOnboarded,
  markOnboarded,
  ONBOARDING_KEY,
  PLACEMENT_INFO_KEY,
  savePlacementInfo,
} from './onboarding'

const getter = vi.spyOn(Storage.prototype, 'getItem')
const setter = vi.spyOn(Storage.prototype, 'setItem')

afterEach(() => {
  getter.mockReset()
  setter.mockReset()
  localStorage.removeItem(ONBOARDING_KEY)
  localStorage.removeItem(PLACEMENT_INFO_KEY)
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

describe('placement info (P.2)', () => {
  it('savePlacementInfo → getPlacementInfo: ранг + режим применения', async () => {
    expect(await getPlacementInfo()).toBeNull()
    await savePlacementInfo('D', 'start_at_rank')
    const info = await getPlacementInfo()
    expect(info).toMatchObject({ rank: 'D', mode: 'start_at_rank' })
    expect(typeof info!.appliedAt).toBe('string')
  })

  it('повреждённые/невалидные данные → null (не ломаем дашборд)', async () => {
    localStorage.setItem(PLACEMENT_INFO_KEY, '{not json')
    expect(await getPlacementInfo()).toBeNull()
    localStorage.setItem(PLACEMENT_INFO_KEY, JSON.stringify({ rank: 'S', mode: 'hack' }))
    expect(await getPlacementInfo()).toBeNull()
    localStorage.setItem(
      PLACEMENT_INFO_KEY,
      JSON.stringify({ rank: 'D', mode: 'waive', appliedAt: 42 }),
    )
    expect(await getPlacementInfo()).toBeNull()
  })

  it('запрещённое хранилище: null без исключения, save не бросает', async () => {
    getter.mockImplementation(() => {
      throw new Error('denied')
    })
    setter.mockImplementation(() => {
      throw new Error('denied')
    })
    expect(await getPlacementInfo()).toBeNull()
    await expect(savePlacementInfo('C', 'waive')).resolves.toBeUndefined()
  })
})
