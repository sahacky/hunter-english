import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

// ---------------------------------------------------------------------------
// Конфигурация видов данных. Новый kind = запись здесь + схема в data/schemas.
// ---------------------------------------------------------------------------
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = join(ROOT, 'data')
const SCHEMAS_DIR = join(DATA_DIR, 'schemas')

/** kind из обёртки → имя схемы сущности в data/schemas/ */
const KIND_TO_SCHEMA = {
  words: 'word',
  phrases: 'phrase',
  lessons: 'lesson',
  exercises: 'exercise',
  quotes: 'quote',
  phrasebook: 'phrasebook_dialog',
  traps: 'trap',
}

/** каталог data/<dir>/ → единственный допустимый kind его файлов */
const DIR_TO_KIND = {
  words: 'words',
  phrases: 'phrases',
  quotes: 'quotes',
  phrasebook: 'phrasebook',
}

/** каталог lessons: различаем уроки и упражнения по имени файла */
const LESSONS_DIR = 'lessons'
const LESSON_FILE_RE = /^lessons-.+\.json$/
const EXERCISE_FILE_RE = /^exercises-.+\.json$/

/** файлы/каталоги, не являющиеся учебными данными */
const SKIPPED = new Set(['schemas', 'raw', 'manifest.json'])

const errors = []
const infos = []

function fail(path, message) {
  errors.push(`${path} — ${message}`)
}

function listDataFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (SKIPPED.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...listDataFiles(full))
    else if (entry.endsWith('.json')) out.push(full)
  }
  return out
}

function loadSchema(name) {
  const file = join(SCHEMAS_DIR, `${name}.schema.json`)
  if (!existsSync(file)) fail(file, `не найдена схема ${name}.schema.json`)
  return JSON.parse(readFileSync(file, 'utf8'))
}

/** ожидаемый kind файла по его расположению; строка-ошибка, если расположение неизвестно */
function expectedKind(relPath) {
  const parts = relPath.split(sep)
  if (parts.length === 1) return { kind: 'traps' } // data/traps.json — единственный файл в корне data/
  const [dir, file] = parts
  if (dir === LESSONS_DIR) {
    if (LESSON_FILE_RE.test(file)) return { kind: 'lessons' }
    if (EXERCISE_FILE_RE.test(file)) return { kind: 'exercises' }
    return { error: `имя должно быть lessons-*.json или exercises-*.json` }
  }
  const kind = DIR_TO_KIND[dir]
  return kind
    ? { kind }
    : { error: `неизвестный каталог data/${dir}/ — добавьте его в DIR_TO_KIND` }
}

/** рекурсивно собрать значения полей audio: [{instancePath, file}] */
function collectAudio(value, instancePath, out = []) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectAudio(item, `${instancePath}/${i}`, out))
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'audio') {
        if (typeof child === 'string')
          out.push({ instancePath: `${instancePath}/audio`, file: child })
        else if (child && typeof child === 'object')
          for (const [locale, file] of Object.entries(child))
            if (typeof file === 'string')
              out.push({ instancePath: `${instancePath}/audio/${locale}`, file })
      } else {
        collectAudio(child, `${instancePath}/${key}`, out)
      }
    }
  }
  return out
}

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out)
  else if (value && typeof value === 'object')
    for (const child of Object.values(value)) collectStrings(child, out)
  return out
}

const ajv = new Ajv({ allErrors: true })
addFormats(ajv)
const validateEnvelope = ajv.compile(loadSchema('envelope'))
const validators = Object.fromEntries(
  Object.entries(KIND_TO_SCHEMA).map(([kind, schema]) => [kind, ajv.compile(loadSchema(schema))]),
)

const dataFiles = listDataFiles(DATA_DIR).sort()

if (dataFiles.length === 0) {
  console.log('нет файлов данных')
  process.exit(0)
}

// --- Проход 1: обёртка + схема kind + сбор id для кросс-ссылок -------------
const parsed = []
const ids = { phrases: new Set(), exercises: new Set(), traps: new Set() }

for (const file of dataFiles) {
  const relPath = relative(ROOT, file)
  let doc
  try {
    doc = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    fail(relPath, `невалидный JSON: ${e.message}`)
    continue
  }

  if (!validateEnvelope(doc)) {
    for (const err of validateEnvelope.errors) {
      fail(relPath, `обёртка${err.instancePath} ${err.message}`)
    }
    continue
  }

  const expect = expectedKind(relative(DATA_DIR, file))
  if (expect.error) {
    fail(relPath, expect.error)
    continue
  }
  if (doc.kind !== expect.kind) {
    fail(
      relPath,
      `поле kind="${doc.kind}" не соответствует расположению (ожидалось "${expect.kind}")`,
    )
    continue
  }
  if (!KIND_TO_SCHEMA[doc.kind]) {
    fail(relPath, `неизвестный kind "${doc.kind}" — добавьте его в KIND_TO_SCHEMA`)
    continue
  }

  const validateItem = validators[doc.kind]
  doc.items.forEach((item, index) => {
    if (validateItem(item)) return
    for (const err of validateItem.errors) {
      fail(`${relPath}#/items/${index}${err.instancePath}`, err.message)
    }
  })

  parsed.push({ relPath, kind: doc.kind, items: doc.items })
  for (const item of doc.items) {
    if (typeof item?.id === 'string') {
      const bucket = { phrases: 'phrases', exercises: 'exercises', traps: 'traps' }[doc.kind]
      if (bucket) ids[bucket].add(item.id)
    }
  }
}

// --- Проход 2: кросс-ссылки -------------------------------------------------
const checkPhraseRef = (refPath, phraseId) => {
  if (!ids.phrases.has(phraseId))
    fail(refPath, `фраза "${phraseId}" не найдена в data/phrases/phrases-*.json`)
}
const checkTrapRef = (refPath, trapId) => {
  if (!ids.traps.has(trapId)) fail(refPath, `ловушка "${trapId}" не найдена в data/traps.json`)
}

for (const { relPath, kind, items } of parsed) {
  items.forEach((item, index) => {
    const base = `${relPath}#/items/${index}`
    if (kind === 'lessons') {
      for (const [i, ex] of (item.exercises ?? []).entries()) {
        if (!ids.exercises.has(ex.id))
          fail(
            `${base}/exercises/${i}/id`,
            `упражнение "${ex.id}" не найдено в data/lessons/exercises-*.json`,
          )
      }
      for (const [i, phraseId] of (item.grammar_point?.phrase_ids ?? []).entries()) {
        checkPhraseRef(`${base}/grammar_point/phrase_ids/${i}`, phraseId)
      }
      if (typeof item.grammar_point?.trap_id === 'string')
        checkTrapRef(`${base}/grammar_point/trap_id`, item.grammar_point.trap_id)
      if (typeof item.trap_id === 'string') checkTrapRef(`${base}/trap_id`, item.trap_id)
    }
    if (kind === 'exercises') {
      const payload = item.payload ?? {}
      if (typeof payload.phrase_id === 'string')
        checkPhraseRef(`${base}/payload/phrase_id`, payload.phrase_id)
      if (typeof payload.source_phrase_id === 'string')
        checkPhraseRef(`${base}/payload/source_phrase_id`, payload.source_phrase_id)
      for (const [i, step] of (payload.steps ?? []).entries()) {
        if (typeof step.phrase_id === 'string')
          checkPhraseRef(`${base}/payload/steps/${i}/phrase_id`, step.phrase_id)
      }
      if (typeof payload.trap_id === 'string')
        checkTrapRef(`${base}/payload/trap_id`, payload.trap_id)
    }
    for (const { instancePath, file } of collectAudio(item, base)) {
      if (!existsSync(join(ROOT, file)))
        fail(instancePath, `файл аудио "${file}" не найден на диске`)
    }
  })
}

// data/traps.json отсутствует, но на ловушки кто-то ссылается — битые ссылки
if (!ids.traps.size && parsed.some(({ kind }) => kind === 'lessons' || kind === 'exercises')) {
  const refsTrap = parsed.some(({ kind, items }) =>
    kind === 'lessons'
      ? items.some(
          (l) => typeof l.trap_id === 'string' || typeof l.grammar_point?.trap_id === 'string',
        )
      : kind === 'exercises' && items.some((e) => typeof e.payload?.trap_id === 'string'),
  )
  if (refsTrap)
    fail('data/traps.json', 'файл ловушек отсутствует, но на trap_id есть ссылки в данных')
}

// --- Манифест (информативно, не фейл) ---------------------------------------
const manifestFile = join(DATA_DIR, 'manifest.json')
if (existsSync(manifestFile)) {
  const known = new Set(collectStrings(JSON.parse(readFileSync(manifestFile, 'utf8'))))
  for (const { relPath } of parsed) {
    if (!known.has(relPath))
      infos.push(`${relPath} отсутствует в data/manifest.json (манифест перегенерируется)`)
  }
}

// --- Итог --------------------------------------------------------------------
for (const info of infos) console.warn(`info: ${info}`)
if (errors.length > 0) {
  console.error(`Ошибок валидации: ${errors.length} (файлов данных: ${parsed.length})`)
  for (const message of errors) console.error(message)
  process.exit(1)
}
console.log(`OK: файлов данных ${parsed.length}, ошибок нет`)
