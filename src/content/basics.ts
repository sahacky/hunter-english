// Implements: plan://first-lessons-a0#V3 — данные пре-урока «Азбука и первые слова».
// Аудио: audio/basics/<голос>/<ключ>.opus — голос из смеси 10 по FNV-1a хэшу
// (то же правило в research/tools/audio/gen_basics_audio.py — списки синхронны!).

/** Список голосов — ПО СОРТИРОВКЕ, как в генераторе (sorted(VOICE_MAP)). */
const VOICES = [
  'aria',
  'ava',
  'emily',
  'emma',
  'jenny',
  'libby',
  'maisie',
  'michelle',
  'natasha',
  'sonia',
] as const

function fnv1a(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export function basicsAudioSrc(key: string): string {
  const voice = VOICES[fnv1a(key) % VOICES.length]
  return `audio/basics/${voice}/${key.toLowerCase().replace(/ /g, '-')}.opus`
}

/** Буква + русское название (британское чтение названий). */
export interface BasicsLetter {
  letter: string
  name: string
}

export const BASICS_LETTERS: BasicsLetter[] = [
  { letter: 'A', name: 'эй' },
  { letter: 'B', name: 'би' },
  { letter: 'C', name: 'си' },
  { letter: 'D', name: 'ди' },
  { letter: 'E', name: 'и' },
  { letter: 'F', name: 'эф' },
  { letter: 'G', name: 'джи' },
  { letter: 'H', name: 'эйч' },
  { letter: 'I', name: 'ай' },
  { letter: 'J', name: 'джей' },
  { letter: 'K', name: 'кей' },
  { letter: 'L', name: 'эл' },
  { letter: 'M', name: 'эм' },
  { letter: 'N', name: 'эн' },
  { letter: 'O', name: 'оу' },
  { letter: 'P', name: 'пи' },
  { letter: 'Q', name: 'кью' },
  { letter: 'R', name: 'ар' },
  { letter: 'S', name: 'эс' },
  { letter: 'T', name: 'ти' },
  { letter: 'U', name: 'ю' },
  { letter: 'V', name: 'ви' },
  { letter: 'W', name: 'дабл-ю' },
  { letter: 'X', name: 'экс' },
  { letter: 'Y', name: 'уай' },
  { letter: 'Z', name: 'зед' },
]

/** Первые слова для тренажёра набора (порядок = прогрессия урока E-01). */
export interface BasicsWord {
  en: string
  ru: string
}

export const BASICS_WORDS: BasicsWord[] = [
  { en: 'hello', ru: 'привет' },
  { en: 'hi', ru: 'привет' },
  { en: 'good', ru: 'хороший' },
  { en: 'morning', ru: 'утро' },
  { en: 'day', ru: 'день' },
  { en: 'I', ru: 'я' },
  { en: 'you', ru: 'ты / вы' },
  { en: 'he', ru: 'он' },
  { en: 'she', ru: 'она' },
  { en: 'it', ru: 'это / оно' },
  { en: 'we', ru: 'мы' },
  { en: 'they', ru: 'они' },
  { en: 'am', ru: 'форма be (я)' },
  { en: 'is', ru: 'форма be (он/она/оно)' },
  { en: 'are', ru: 'форма be (ты/мы/вы/они)' },
  { en: 'my', ru: 'мой' },
  { en: 'your', ru: 'твой / ваш' },
  { en: 'his', ru: 'его' },
  { en: 'her', ru: 'её' },
  { en: 'name', ru: 'имя' },
  { en: 'girl', ru: 'девочка' },
  { en: 'boy', ru: 'мальчик' },
  { en: 'man', ru: 'мужчина' },
  { en: 'woman', ru: 'женщина' },
  { en: 'friend', ru: 'друг' },
  { en: 'yes', ru: 'да' },
  { en: 'no', ru: 'нет' },
  { en: 'and', ru: 'и' },
  { en: 'please', ru: 'пожалуйста' },
  { en: 'thank you', ru: 'спасибо' },
]
