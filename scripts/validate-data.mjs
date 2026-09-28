import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

// ---------------------------------------------------------------------------
// Конфигурация видов данных. Новый kind = запись здесь + схема в data/schemas.
// ---------------------------------------------------------------------------
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = resolve(process.argv[2] ?? join(ROOT, 'data'))
const SCHEMAS_DIR = join(ROOT, 'data', 'schemas')

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

function fail(path, message) {
  errors.push(`${path} — ${message}`)
}

/** сообщение об ошибке JSON.parse без содержимого файла (только позиция) */
function describeJsonError(e) {
  const m = /position (\d+)/i.exec(e.message)
  return m ? `невалидный JSON (позиция ${m[1]})` : 'невалидный JSON'
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
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    console.error(`${relative(ROOT, file)} — схема не найдена`)
    process.exit(1)
  }
  try {
    return JSON.parse(text)
  } catch (e) {
    console.error(`${relative(ROOT, file)} — ${describeJsonError(e)}`)
    process.exit(1)
  }
}

/** ожидаемый kind файла по его расположению; строка-ошибка, если расположение неизвестно */
function expectedKind(relPath) {
  const parts = relPath.split(sep)
  if (parts.length === 1)
    return parts[0] === 'traps.json'
      ? { kind: 'traps' }
      : { error: 'неизвестный файл в data/ — в корне допустим только traps.json' }
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
/** id → { at: 'файл#/items/i', kind } — глобальная уникальность по всем kind */
const idOwner = new Map()

/** регистрирует id; повтор в любом файле — ошибка */
function registerId(id, at, kind) {
  const prev = idOwner.get(id)
  if (prev) {
    fail(at, `дубликат id "${id}" — уже объявлен в ${prev.at}`)
    return
  }
  idOwner.set(id, { at, kind })
}

const refExists = (kind, id) => idOwner.get(id)?.kind === kind

for (const file of dataFiles) {
  const relPath = relative(ROOT, file)
  let doc
  try {
    doc = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    fail(relPath, describeJsonError(e))
    continue
  }

  if (!Array.isArray(doc) && typeof doc === 'object' && doc !== null && doc.schema_version !== 1) {
    fail(
      relPath,
      `schema_version ${doc.schema_version} не поддерживается: поддерживается только 1 (миграция по specs/05 §7)`,
    )
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

  const validateItem = validators[doc.kind]
  doc.items.forEach((item, index) => {
    if (typeof item?.id === 'string') registerId(item.id, `${relPath}#/items/${index}`, doc.kind)
    if (validateItem(item)) return
    for (const err of validateItem.errors) {
      fail(`${relPath}#/items/${index}${err.instancePath}`, err.message)
    }
  })

  parsed.push({
    relPath,
    dataRel: relative(DATA_DIR, file).split(sep).join('/'),
    kind: doc.kind,
    schemaVersion: doc.schema_version,
    itemsCount: doc.items.length,
    items: doc.items,
  })
}

// --- Проход 2: кросс-ссылки -------------------------------------------------
const checkPhraseRef = (refPath, phraseId) => {
  if (!refExists('phrases', phraseId))
    fail(refPath, `фраза "${phraseId}" не найдена в data/phrases/phrases-*.json`)
}
const checkTrapRef = (refPath, trapId) => {
  if (!refExists('traps', trapId)) fail(refPath, `ловушка "${trapId}" не найдена в data/traps.json`)
}

// Известные главы разговорника (specs/05 §0: topic = имя файла в data/phrasebook/).
// Каталога нет до M8 — проверка пассивна; quotes_topic — тег темы подбора цитат
// (реестр тем появится с разговорником M8, пока проверяется схемой).
const phrasebookTopics = new Set(
  existsSync(join(DATA_DIR, 'phrasebook'))
    ? readdirSync(join(DATA_DIR, 'phrasebook'))
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace(/\.json$/, ''))
    : [],
)

for (const { relPath, kind, items } of parsed) {
  items.forEach((item, index) => {
    const base = `${relPath}#/items/${index}`
    if (kind === 'lessons') {
      for (const [i, ex] of (item.exercises ?? []).entries()) {
        if (!refExists('exercises', ex.id))
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
      if (
        phrasebookTopics.size > 0 &&
        typeof item.phrasebook_topic === 'string' &&
        !phrasebookTopics.has(item.phrasebook_topic)
      )
        fail(
          `${base}/phrasebook_topic`,
          `глава разговорника "${item.phrasebook_topic}" не найдена в data/phrasebook/`,
        )
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
      const abs = resolve(ROOT, file)
      if (!abs.startsWith(ROOT + sep)) {
        fail(instancePath, `путь аудио "${file}" выходит за пределы репозитория`)
        continue
      }
      let st
      try {
        st = statSync(abs)
      } catch {
        fail(instancePath, `файл аудио "${file}" не найден на диске`)
        continue
      }
      if (!st.isFile()) fail(instancePath, `"${file}" не является обычным файлом`)
    }
  })
}

// data/traps.json отсутствует, но на ловушки кто-то ссылается — битые ссылки
if (
  !parsed.some(({ kind }) => kind === 'traps') &&
  parsed.some(({ kind }) => kind === 'lessons' || kind === 'exercises')
) {
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

// --- Манифест: каждый файл данных учтён, каждая запись существует -----------
const manifestFile = join(DATA_DIR, 'manifest.json')
const manifestRel = relative(ROOT, manifestFile)
let manifest = null
try {
  manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
} catch (e) {
  fail(
    manifestRel,
    e?.code === 'ENOENT'
      ? 'файл не найден — перегенерируйте data/manifest.json'
      : describeJsonError(e),
  )
}

if (manifest) {
  const entries = manifest.files
  if (!Array.isArray(entries)) {
    fail(manifestRel, 'ожидался массив files')
  } else {
    const byPath = new Map()
    for (const [i, entry] of entries.entries()) {
      if (!entry || typeof entry !== 'object' || typeof entry.path !== 'string') {
        fail(manifestRel, `files[${i}] — запись без поля path`)
        continue
      }
      byPath.set(entry.path, entry)
    }

    for (const { relPath, dataRel, kind, schemaVersion, itemsCount } of parsed) {
      const entry = byPath.get(dataRel)
      if (!entry) {
        fail(relPath, 'отсутствует в data/manifest.json')
        continue
      }
      if (entry.kind !== kind) fail(relPath, `в манифесте kind="${entry.kind}", в файле "${kind}"`)
      if (entry.schema_version !== schemaVersion)
        fail(
          relPath,
          `в манифесте schema_version=${entry.schema_version}, в файле ${schemaVersion}`,
        )
      if (entry.items !== itemsCount)
        fail(relPath, `в манифесте items=${entry.items}, в файле ${itemsCount}`)
    }

    for (const path of byPath.keys()) {
      if (!existsSync(join(DATA_DIR, path)))
        fail(`${manifestRel}#files`, `запись "${path}" без файла на диске`)
    }
  }
}

// --- Итог --------------------------------------------------------------------
if (errors.length > 0) {
  console.error(`Ошибок валидации: ${errors.length} (файлов данных: ${parsed.length})`)
  for (const message of errors) console.error(message)
  process.exit(1)
}

let quotesReady = 0
for (const { kind, items } of parsed) {
  if (kind !== 'quotes') continue
  for (const item of items) {
    const top = item?.auto_vocab?.top1000
    if (typeof top === 'number' && top >= 0.9) quotesReady += 1
  }
}
console.log(`${quotesReady} цитат готовы к показу (top1000 ≥ 0.9)`)
console.log(`OK: файлов данных ${parsed.length}, ошибок нет`)
