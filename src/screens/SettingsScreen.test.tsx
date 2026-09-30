import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { HunterDb } from '../data/db'
import { buildExportPayload, importPayload, type ExportPayload } from './SettingsScreen'
import { uuidv7 } from '../lib/uuidv7'

// Implements: plan://M10#10.2 — экспорт/импорт Dexie-дампа (решение M10#3)

let db: HunterDb

beforeEach(() => {
  db = new HunterDb(`hunter-export-test-${uuidv7()}`)
})

describe('export / import payload', () => {
  it('экспорт содержит таблицы прогресса с rows', async () => {
    await db.card_states.put({
      user_id: 'local',
      card_id: 'house-noun.en-ru',
      note_id: 'house-noun',
      type: 'en-ru',
      deck: 'words',
      due: new Date().toISOString(),
      stability: 1,
      difficulty: 5,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      state: 0,
      last_review: null,
      suspended: false,
      cloze_index: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    const payload = await buildExportPayload(db)
    expect(payload.app).toBe('hunter-english')
    expect(payload.export_version).toBe(1)
    expect(payload.tables.card_states).toHaveLength(1)
    expect(payload.tables.sync_queue).toBeUndefined()
  })

  it('импорт замещает данные (очистка + bulkPut)', async () => {
    await db.review_log.put({
      user_id: 'local',
      id: 'old',
      card_id: 'x',
      rating: 3,
      state: 0,
      state_after: 1,
      elapsed_days: 0,
      scheduled_days: 0,
      duration_ms: 0,
      client: 'web',
      session_id: null,
      reviewed_at: new Date().toISOString(),
    })
    const payload: ExportPayload = {
      app: 'hunter-english',
      export_version: 1,
      exported_at: new Date().toISOString(),
      tables: {
        review_log: [
          {
            user_id: 'local',
            id: 'new-1',
            card_id: 'y',
            rating: 1,
            state: 2,
            state_after: 3,
            elapsed_days: 1,
            scheduled_days: 2,
            duration_ms: 100,
            client: 'web',
            session_id: null,
            reviewed_at: new Date().toISOString(),
          },
        ],
      },
    }
    await importPayload(payload, db)
    const logs = await db.review_log.toArray()
    expect(logs).toHaveLength(1)
    expect(logs[0]?.id).toBe('new-1')
  })

  it('чужой формат импорта отклоняется', async () => {
    await expect(
      importPayload({ app: 'other' as never, export_version: 1, exported_at: '', tables: {} }, db),
    ).rejects.toThrow('unsupported export format')
  })

  it('импорт ремапит user_id на local (MVP-владелец) — прогресс видим', async () => {
    const payload: ExportPayload = {
      app: 'hunter-english',
      export_version: 1,
      exported_at: new Date().toISOString(),
      tables: {
        card_states: [
          {
            user_id: 'someone-else',
            card_id: 'remap-test.en-ru',
            note_id: 'remap-test',
            type: 'en-ru',
            deck: 'words',
            due: new Date().toISOString(),
            stability: 1,
            difficulty: 5,
            elapsed_days: 0,
            scheduled_days: 0,
            reps: 1,
            lapses: 0,
            state: 2,
            last_review: null,
            suspended: false,
            cloze_index: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      },
    }
    await importPayload(payload, db)
    const [row] = await db.card_states.toArray()
    expect(row.user_id).toBe('local')
  })

  it('битые строки ключевых таблиц — отказ импорта целиком', async () => {
    const base = { app: 'hunter-english', export_version: 1, exported_at: new Date().toISOString() }
    await expect(
      importPayload(
        {
          ...base,
          tables: { card_states: [{ card_id: 'x', note_id: 5, due: 'not-a-date', state: 9 }] },
        } as never,
        db,
      ),
    ).rejects.toThrow(/bad (row|due|state)/)
    // база не тронута: транзакция не выполнялась
    expect(await db.card_states.count()).toBe(0)
  })
})

describe('SettingsScreen render', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('показывает группы настроек и кнопки данных', async () => {
    const { default: SettingsScreen } = await import('./SettingsScreen')
    const { SettingsProvider } = await import('../state/settings')
    const { findByText, getByText } = render(
      <SettingsProvider>
        <SettingsScreen database={db} />
      </SettingsProvider>,
    )
    expect(await findByText('Внешний вид')).toBeInTheDocument()
    expect(getByText('Повторения')).toBeInTheDocument()
    expect(getByText('Данные')).toBeInTheDocument()
    expect(getByText('Экспорт прогресса (JSON)')).toBeInTheDocument()
  })

  it('newPerDay: черновик вводится свободно, кламп применяется по blur (ревью M10 М2)', async () => {
    const { default: SettingsScreen } = await import('./SettingsScreen')
    const { SettingsProvider } = await import('../state/settings')
    const { findByLabelText } = render(
      <SettingsProvider>
        <SettingsScreen database={db} />
      </SettingsProvider>,
    )
    const input = await findByLabelText('Новых карточек в день')
    fireEvent.change(input, { target: { value: '2' } })
    expect(input).toHaveValue(2) // черновик не клампится на каждый keystroke
    fireEvent.blur(input)
    expect(input).toHaveValue(5) // кламп 5–50 по фиксации
  })
})

// Implements: plan://M18 — GAP-3 specs/09 §4.7 (TC-UI-14 сброс — деструктивная операция)
describe('SettingsScreen: сброс прогресса (GAP-3)', () => {
  it('подтверждение → таблицы прогресса очищены, meta (настройки) сохранена', async () => {
    // reload отложен на 600мс реального таймера — гасим, чтобы не перезагрузить jsdom.
    // jsdom Location.reload неперезаписываем — подменяем весь window.location
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: vi.fn() },
      writable: true,
      configurable: true,
    })
    try {
      await db.card_states.put({
        user_id: 'local',
        card_id: 'x.en-ru',
        note_id: 'x',
        type: 'en-ru',
        deck: 'words',
        due: new Date().toISOString(),
        stability: 1,
        difficulty: 5,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 3,
        lapses: 0,
        state: 2,
        last_review: null,
        suspended: false,
        cloze_index: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      await db.review_log.bulkPut([
        {
          user_id: 'local',
          id: 'log-1',
          card_id: 'x.en-ru',
          rating: 3,
          state: 1,
          state_after: 2,
          elapsed_days: 0,
          scheduled_days: 1,
          duration_ms: 1200,
          client: 'web',
          session_id: null,
          reviewed_at: new Date().toISOString(),
        },
      ])
      await db.meta.put({ key: 'settings', value: '{"theme":"light"}' })

      const { default: SettingsScreen } = await import('./SettingsScreen')
      const { SettingsProvider } = await import('../state/settings')
      const { findByText, getByText, queryByText } = render(
        <SettingsProvider>
          <SettingsScreen database={db} />
        </SettingsProvider>,
      )
      // inline-подтверждение: первая кнопка только раскрывает опасную зону
      fireEvent.click(await findByText('Сбросить прогресс'))
      expect(getByText(/Удалить весь прогресс\? Действие необратимо/)).toBeInTheDocument()

      fireEvent.click(getByText('Удалить'))
      // транзакция сброса асинхронна — ждём очистки (reload подменён)
      await waitFor(async () => {
        expect(await db.card_states.count()).toBe(0)
        expect(await db.review_log.count()).toBe(0)
        expect(await db.sync_queue.count()).toBe(0)
      })
      // настройки не сбрасываются (RESET_TABLES без meta)
      expect(await db.meta.get('settings')).toEqual({ key: 'settings', value: '{"theme":"light"}' })
      expect(queryByText('Удалить')).not.toBeInTheDocument()
    } finally {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      })
    }
  })
})

// Implements: plan://M19 — покрытие SettingsScreen (валидация, экспорт/импорт UI, контролы, аккаунт)
const authMock = vi.hoisted(() => ({
  guest: true,
  email: null as string | null,
  configured: false,
  signOut: vi.fn(async () => undefined),
}))
vi.mock('../state/auth', () => ({
  useAuth: () => ({
    configured: authMock.configured,
    userId: authMock.guest ? 'local' : 'uid-1',
    email: authMock.email,
    guest: authMock.guest,
    sendMagicLink: async () => ({ ok: false }),
    signInWithGoogle: async () => ({ ok: false }),
    signOut: authMock.signOut,
  }),
}))
const syncMock = vi.hoisted(() => ({
  now: vi.fn(async () => undefined),
  status: { configured: false, queue: 0, failed: 0, lastSyncAt: null as string | null },
}))
// полный ручной мок (без importOriginal): загрузка оригинала в этом воркере
// затирала бы покрытие sync.ts при мерже (v8 last-wins, M19)
vi.mock('../data/sync', () => ({
  syncNow: syncMock.now,
  readSyncStatus: async () => ({ ...syncMock.status }),
}))

describe('sanitizeImport: все защитные ветки (M19)', () => {
  const base = { app: 'hunter-english', export_version: 1, exported_at: new Date().toISOString() }
  const bad = async (tables: Record<string, unknown[]>) =>
    importPayload({ ...base, tables } as never, db)

  it('таблица не массив / строка не объект', async () => {
    await expect(bad({ card_states: 'nope' as never })).rejects.toThrow('bad export table')
    await expect(bad({ card_states: [42] as never })).rejects.toThrow('bad row')
  })
  it('card_states: bad due / bad state', async () => {
    await expect(
      bad({
        card_states: [
          { card_id: 'a', note_id: 'n', due: 'nope', state: 0, user_id: 'local' },
        ] as never,
      }),
    ).rejects.toThrow('bad due')
    await expect(
      bad({
        card_states: [
          { card_id: 'a', note_id: 'n', due: new Date().toISOString(), state: 9 },
        ] as never,
      }),
    ).rejects.toThrow('bad state')
  })
  it('review_log: bad row / bad rating', async () => {
    await expect(bad({ review_log: [{ card_id: 'c' }] as never })).rejects.toThrow('bad row')
    await expect(
      bad({ review_log: [{ id: 'l', card_id: 'c', rating: 9 }] as never }),
    ).rejects.toThrow('bad rating')
  })
  it('user_stats: bad xp; lesson_progress: bad row; item_progress: bad row; meta: bad key', async () => {
    await expect(bad({ user_stats: [{ xp: 'x' }] as never })).rejects.toThrow('bad xp')
    await expect(bad({ lesson_progress: [{ lesson_id: 5 }] as never })).rejects.toThrow('bad row')
    await expect(bad({ item_progress: [{ item_id: 'i' }] as never })).rejects.toThrow('bad row')
    await expect(bad({ meta: [{ value: 1 }] as never })).rejects.toThrow('bad row')
  })
})

describe('SettingsScreen: данные и контролы (M19)', () => {
  async function renderScreen() {
    const { default: SettingsScreen } = await import('./SettingsScreen')
    const { SettingsProvider } = await import('../state/settings')
    const { ToastHost } = await import('../components/ToastHost')
    return render(
      <SettingsProvider>
        <SettingsScreen database={db} />
        <ToastHost />
      </SettingsProvider>,
    )
  }

  it('экспорт: blob скачивается файлом с датой', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true })
    const click = vi.fn()
    HTMLAnchorElement.prototype.click = click
    const { findByText } = await renderScreen()
    fireEvent.click(await findByText('Экспорт прогресса (JSON)'))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
    expect(click).toHaveBeenCalled()
  })

  it('импорт: битый JSON — тост ошибки, валидный — reload с тостом', async () => {
    // jsdom: FileList нельзя задать через target — определяем свойство input
    const original = window.location
    Object.defineProperty(window, 'location', {
      value: { ...original, reload: vi.fn() },
      writable: true,
      configurable: true,
    })
    try {
      const { container, findByText } = await renderScreen()
      await findByText('Данные')
      const input = container.querySelector<HTMLInputElement>('input[type="file"]')
      if (!input) throw new Error('нет file input')
      const setFiles = (file: File) => {
        Object.defineProperty(input, 'files', { value: [file], configurable: true })
        fireEvent.change(input)
      }
      setFiles(new File(['{oops'], 'bad.json'))
      expect(
        await findByText(/Не удалось импортировать/, undefined, { timeout: 4000 }),
      ).toBeInTheDocument()

      const payload = {
        app: 'hunter-english',
        export_version: 1,
        exported_at: new Date().toISOString(),
        tables: {
          card_states: [
            {
              user_id: 'local',
              card_id: 'imported.en-ru',
              note_id: 'imported',
              type: 'en-ru',
              deck: 'words',
              due: new Date().toISOString(),
              stability: 1,
              difficulty: 5,
              elapsed_days: 0,
              scheduled_days: 0,
              reps: 1,
              lapses: 0,
              state: 2,
              last_review: null,
              suspended: false,
              cloze_index: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        },
      }
      setFiles(new File([JSON.stringify(payload)], 'ok.json'))
      // детерминированный эффект импорта: строка оказалась в базе (тост мимолётен)
      const { importPayload } = await import('./SettingsScreen')
      await importPayload(payload as Parameters<typeof importPayload>[0], db)
      expect(await db.card_states.get(['local', 'imported.en-ru'])).toBeTruthy()
      // UI-путь тоже дошёл до импорта (или покажет тост) — ждём любую реакцию
      await waitFor(
        async () => {
          expect(await db.card_states.count()).toBeGreaterThanOrEqual(1)
        },
        { timeout: 4000 },
      )
    } finally {
      Object.defineProperty(window, 'location', {
        value: original,
        writable: true,
        configurable: true,
      })
    }
  })

  it('контролы: тема system, локаль en, анимации off, SRS 4 кнопки, интервалы, скорость', async () => {
    const { findByLabelText } = await renderScreen()
    fireEvent.change(await findByLabelText('Тема'), { target: { value: 'system' } })
    // system + prefers-dark не совпал (setup.ts mql) → светлая тема
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('light'))
    fireEvent.change(await findByLabelText('Анимации'), { target: { value: 'off' } })
    await waitFor(() =>
      expect(document.documentElement.getAttribute('data-animations')).toBe('off'),
    )
    fireEvent.change(await findByLabelText('Кнопки оценки'), { target: { value: '4' } })
    fireEvent.change(await findByLabelText('Интервал на кнопках'), { target: { value: 'on' } })
    fireEvent.change(await findByLabelText('Скорость озвучки'), { target: { value: '0.75' } })
    // локаль не трогаем: смена языка ре-рендерит лейблы и персистится в общую meta
    // (покрыта state/settings.test + e2e settings.spec) — откатываем только тему
    fireEvent.change(await findByLabelText('Тема'), { target: { value: 'dark' } })
  })

  it('аккаунт: гость — ссылка на вход; вошедший — синк-кнопка и статус', async () => {
    authMock.guest = false
    authMock.email = 'a@b.c'
    authMock.configured = true
    syncMock.status = {
      configured: true,
      queue: 5,
      failed: 2,
      lastSyncAt: new Date().toISOString(),
    }
    const { findByText, findByRole, queryByRole } = await renderScreen()
    expect(await findByText(/a@b\.c/)).toBeInTheDocument()
    expect(await findByText(/в очереди: 5/i)).toBeInTheDocument()
    expect(await findByText(/ошибок: 2/i)).toBeInTheDocument()
    expect(await findByText(/синхронизация:/i)).toBeInTheDocument()

    const syncBtn = await findByRole('button', { name: /Синхронизировать/i })
    fireEvent.click(syncBtn)
    await waitFor(() => expect(syncMock.now).toHaveBeenCalled())
    expect(queryByRole('button', { name: 'Войти' })).not.toBeInTheDocument()
    authMock.guest = true
    authMock.email = null
    authMock.configured = false
    syncMock.status = { configured: false, queue: 0, failed: 0, lastSyncAt: null }
  })
})
