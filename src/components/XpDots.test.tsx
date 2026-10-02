// Implements: plan://theme-daylight#D.6 — XP-точки: aria-прогресс и заполнение сегментов
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { XpDots } from './XpDots'

describe('XpDots', () => {
  it('0% — нет заполненных сегментов, aria-valuenow=0', () => {
    render(<XpDots percent={0} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '0')
    expect(bar.querySelectorAll('.dash-dot.on')).toHaveLength(0)
    expect(bar.querySelectorAll('.dash-dot')).toHaveLength(8)
  })

  it('50% — половина сегментов заполнена', () => {
    render(<XpDots percent={50} />)
    expect(screen.getByRole('progressbar').querySelectorAll('.dash-dot.on')).toHaveLength(4)
  })

  it('значение клампится в 0–100 и сегменты настраиваются', () => {
    const { container, rerender } = render(<XpDots percent={120} segments={4} />)
    expect(container.querySelectorAll('.dash-dot')).toHaveLength(4)
    expect(container.querySelectorAll('.dash-dot.on')).toHaveLength(4)
    rerender(<XpDots percent={-10} segments={4} />)
    expect(container.querySelectorAll('.dash-dot.on')).toHaveLength(0)
  })
})
