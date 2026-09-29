import { describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { ToastHost } from './ToastHost'
import { showToast } from '../lib/toast'

// Implements: plan://M10#10.5 — тосты «Системы»

describe('ToastHost', () => {
  it('showToast рендерит сообщение', () => {
    const { getByText } = render(<ToastHost />)
    act(() => {
      showToast('Квест дня выполнен')
    })
    expect(getByText('Квест дня выполнен')).toBeInTheDocument()
  })

  it('тост скрывается автоматически (4с)', () => {
    vi.useFakeTimers()
    try {
      const { queryByText } = render(<ToastHost />)
      act(() => {
        showToast('Ранг повышен')
      })
      expect(queryByText('Ранг повышен')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(4100)
      })
      expect(queryByText('Ранг повышен')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('в стеке не больше 4 тостов', () => {
    const { container } = render(<ToastHost />)
    act(() => {
      for (let i = 0; i < 6; i++) showToast(`тост ${i}`)
    })
    const toasts = container.querySelectorAll('.toast')
    expect(toasts).toHaveLength(4)
    expect(toasts[0]).toHaveTextContent('тост 2')
    expect(toasts[3]).toHaveTextContent('тост 5')
  })
})
