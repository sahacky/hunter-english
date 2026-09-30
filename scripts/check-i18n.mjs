#!/usr/bin/env node
// Implements: plan://M18 — GAP-9 specs/09 §4.9 (TC-I18N-01): сверка ключей ru/en.
// Пустые списки = ок; любой расхожий ключ — ошибка (шаг CI).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dir = dirname(fileURLToPath(import.meta.url))
const read = (name) => JSON.parse(readFileSync(join(dir, '..', 'src', 'locales', name), 'utf8'))

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? flatten(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )

const ru = new Set(flatten(read('ru.json')))
const en = new Set(flatten(read('en.json')))
const onlyRu = [...ru].filter((key) => !en.has(key))
const onlyEn = [...en].filter((key) => !ru.has(key))

if (onlyRu.length > 0 || onlyEn.length > 0) {
  console.error('только ru:', onlyRu)
  console.error('только en:', onlyEn)
  process.exit(1)
}
console.log(`i18n: ru/en синхронны (${ru.size} ключей)`)
