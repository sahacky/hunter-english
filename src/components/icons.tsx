// Implements: plan://M9#9.2 — 24px иконки таб-бара (specs/08 §2: 24px навигация).
// currentColor — активность ссылки управляет цветом.

export function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" strokeLinejoin="round" />
    </svg>
  )
}

export function CardsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="7" width="12" height="14" rx="2" />
      <path d="M8 3.5h9a2 2 0 012 2V17" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function GatesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 4l8 6.4h-3.4L12 8.1l-4.6 2.3H4L12 4z" />
      <path d="M12 12.2l8 6.4h-3.4L12 16.3l-4.6 2.3H4l8-6.4z" opacity="0.6" />
    </svg>
  )
}

export function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path
        d="M12 5.5C10.5 4 8 3.5 5 3.8v14c3-.3 5.5.2 7 1.7 1.5-1.5 4-2 7-1.7v-14c-3-.3-5.5.2-7 1.7z"
        strokeLinejoin="round"
      />
      <path d="M12 5.5v14" />
    </svg>
  )
}

export function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path
        d="M12 2.8l1 2.4 2.6-.6 1.1 2.4 2.5.8-.7 2.5 1.7 2-1.7 2 .7 2.5-2.5.8-1.1 2.4-2.6-.6-1 2.4-1-2.4-2.6.6-1.1-2.4-2.5-.8.7-2.5-1.7-2 1.7-2-.7-2.5 2.5-.8 1.1-2.4 2.6.6 1-2.4z"
        strokeLinejoin="round"
      />
    </svg>
  )
}
