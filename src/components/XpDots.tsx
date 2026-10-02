// Implements: plan://theme-daylight#D.4 — XP-прогресс сегментами-точками вместо
// неоновой полосы (specs/08 §1a «Прогресс: точки-сегменты или кольцо»).
export function XpDots({ percent, segments = 8 }: { percent: number; segments?: number }) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)))
  const on = Math.round((clamped / 100) * segments)
  return (
    <div
      className="dash-xp-bar"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className={i < on ? 'dash-dot on' : 'dash-dot'} />
      ))}
    </div>
  )
}
