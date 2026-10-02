#!/usr/bin/env node
// Implements: plan://curriculum-review#M.2 — валидатор внешних ссылок цитат.
// Проверяет:
//  - link_playphrase: формат (https://www.playphrase.me/#/search?q=…) и что
//    декодированный запрос совпадает с текстом цитаты (нормализация); клик-
//    контент PlayPhrase автоматически не проверить (SPA + bot-protection) —
//    совпадение текста лучшая доступная прокси-проверка;
//  - link_video (опц.): YouTube — существование видео через oEmbed (200/404);
//  - достижимость домена playphrase.me (один запрос на прогон).
// Отчёт: список проблем + сводка; ненулевой exit при битых ссылках.
// Сеть в CI НЕ гоняется (флейки) — запуск вручную: npm run validate:links
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const QUOTES_DIR = join(process.cwd(), 'data', 'quotes')

const normalize = (s) =>
  s
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Декодированный запрос playphrase-ссылки (hash-часть #/search?q=…). */
function playphraseQuery(url) {
  const hash = url.split('#')[1] ?? ''
  const match = /[?&]q=([^&]*)/.exec(hash)
  if (!match) return null
  try {
    return decodeURIComponent(match[1].replace(/\+/g, '%20'))
  } catch {
    return null
  }
}

async function headOk(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    return res.ok
  } catch {
    return false
  }
}

async function youtubeExists(url) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    )
    if (res.status === 401 || res.status === 403) return 'unknown' // embedding disabled, но видео есть/нет неоднозначно
    return res.ok ? 'ok' : 'broken'
  } catch {
    return 'unknown'
  }
}

const files = readdirSync(QUOTES_DIR).filter((f) => f.endsWith('.json'))
const problems = []
const warnings = []
let checked = 0
let withVideo = 0

const playphraseAlive = await headOk('https://www.playphrase.me/')

for (const file of files) {
  const doc = JSON.parse(readFileSync(join(QUOTES_DIR, file), 'utf8'))
  for (const item of doc.items ?? []) {
    checked += 1
    const lp = item.link_playphrase
    if (typeof lp !== 'string') continue
    if (!lp.startsWith('https://www.playphrase.me/#/search?q=')) {
      problems.push(`${file}#${item.id}: неожидаемый формат link_playphrase: ${lp}`)
      continue
    }
    const query = playphraseQuery(lp)
    if (query === null) {
      problems.push(`${file}#${item.id}: не удалось декодировать q= из ${lp}`)
      continue
    }
    if (normalize(query) !== normalize(item.text ?? '')) {
      warnings.push(
        `${file}#${item.id}: запрос ссылки ≠ текст цитаты: "${query}" vs "${item.text}"`,
      )
    }
    const video = item.link_video
    if (typeof video === 'string') {
      withVideo += 1
      if (
        !/^https:\/\/(www\.)?(youtube\.com\/watch\?|[ym]\.)?/.test(video) ||
        !/youtu/.test(video)
      ) {
        problems.push(`${file}#${item.id}: link_video ожидается YouTube-URL, получено: ${video}`)
        continue
      }
      const status = await youtubeExists(video)
      if (status === 'broken')
        problems.push(`${file}#${item.id}: YouTube-видео недоступно (404): ${video}`)
      if (status === 'unknown')
        warnings.push(
          `${file}#${item.id}: YouTube oEmbed недоступен/ограничен — проверить вручную: ${video}`,
        )
    }
  }
}

if (!playphraseAlive)
  warnings.push('домен playphrase.me недоступен (сеть/бот-щит) — проверь вручную в браузере')

console.log(
  `validate:links: цитат ${checked}, playphrase ${checked} шт. (формат+текст${playphraseAlive ? ', домен жив' : ', ДОМЕН НЕ ОТВЕЧАЕТ'}), link_video ${withVideo} шт.`,
)
if (warnings.length > 0) {
  console.log(`warnings: ${warnings.length}`)
  for (const w of warnings.slice(0, 20)) console.log(`  ⚠ ${w}`)
  if (warnings.length > 20) console.log(`  … и ещё ${warnings.length - 20}`)
}
if (problems.length > 0) {
  console.error(`ОШИБКИ: ${problems.length}`)
  for (const p of problems) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log('OK: битых ссылок нет')
