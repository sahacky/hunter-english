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
