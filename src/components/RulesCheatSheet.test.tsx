// Implements: plan://teaching-quality#cheat-sheet — тесты блока шпаргалки
import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RulesCheatSheet from './RulesCheatSheet'
import type { CheatGroup } from '../content/cheatsheet'
import type { ProgressRepository } from '../domain/progress'
import '../i18n'

vi.mock('../content/cheatsheet', () => ({
  loadCheatSheet: vi.fn(),
}))

import { loadCheatSheet } from '../content/cheatsheet'

const GROUPS: CheatGroup[] = [
  {
    rank: 'E',
    entries: [
      {
        courseId: 'E-01',
        title: 'to be: am / is / are',
        summary: 'кто + am / is / are',
        trap: "⚠️ Ловушка: ❌ I hungry → ✔ I'm hungry.",
      },
      { courseId: 'E-02', title: 'Артикль', summary: 'a / an + существительное', trap: null },
    ],
  },
]

const mockLoad = vi.mocked(loadCheatSheet)

// jsdom не эмулирует <details>: open ставим руками и диспетчим toggle (React 19 ловит)
function detailsNode() {
  return screen.getByText('📖 Шпаргалка пройденного').closest('details') as HTMLDetailsElement
}

function setOpen(open: boolean) {
  const details = detailsNode()
  details.open = open
  fireEvent(details, new Event('toggle'))
}

function expand() {
  setOpen(true)
}

describe('RulesCheatSheet', () => {
  it('свёрнут по умолчанию — контент не грузится до раскрытия', () => {
    renderSheet()
    expect(screen.queryByText('Ранг E')).toBeNull()
    // закрытие до раскрытия — ранний выход без загрузки
    setOpen(false)
    expect(mockLoad).not.toHaveBeenCalled()
  })

  it('раскрытие грузит группы и показывает записи (формула + ловушка)', async () => {
    mockLoad.mockResolvedValue(GROUPS)
    renderSheet()
    expand()
    await screen.findByText('Ранг E')
    expect(screen.getByText('E-01 · to be: am / is / are')).toBeTruthy()
    expect(screen.getByText('кто + am / is / are')).toBeTruthy()
    expect(screen.getByText("⚠️ Ловушка: ❌ I hungry → ✔ I'm hungry.")).toBeTruthy()
    expect(mockLoad).toHaveBeenCalledTimes(1)
    // повторное раскрытие после готовности — без повторной загрузки
    setOpen(false)
    expand()
    expect(mockLoad).toHaveBeenCalledTimes(1)
  })

  it('нет завершённых уроков — пустое состояние', async () => {
    mockLoad.mockResolvedValue([])
    renderSheet()
    expand()
    await screen.findByText('Пока пусто: пройди первый урок — правило появится здесь.')
  })

  it('ошибка загрузки — текст ошибки, повторное раскрытие пробует снова', async () => {
    mockLoad.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(GROUPS)
    renderSheet()
    expand()
    await screen.findByText(/Проверь хранилище/)
    setOpen(false)
    expand()
    await waitFor(() => expect(screen.getByText('Ранг E')).toBeTruthy())
    expect(mockLoad).toHaveBeenCalledTimes(2)
  })

  it('без инъекции — дефолтный Dexie-репозиторий', async () => {
    mockLoad.mockResolvedValue([])
    render(<RulesCheatSheet />)
    expand()
    await screen.findByText(/Пока пусто/)
  })
})

function renderSheet(repo?: ProgressRepository) {
  return render(<RulesCheatSheet repo={repo} />)
}
