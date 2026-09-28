// Implements: plan://M5#5.1 — типы домена проверки ответов (specs/02 §4, §4.5–§4.7)
// Чистый TS без знания о хранилище и React (архитектурный «шов», PLANS → M5).

/** Вердикт проверки: «верно», «верно с опечаткой», «неверно», «не расслышало» (голос, §4.8). */
export type VerdictKind = 'correct' | 'correct_typo' | 'wrong' | 'retry'

/**
 * Статус слова в diff-подсветке (specs/02 §4.5):
 * match — совпало, typo — опечатка (рядом правильное написание),
 * extra — лишнее слово (зачёркнуто), missing — пропущенное («+»).
 */
export type DiffStatus = 'match' | 'typo' | 'extra' | 'missing'

/** Элемент выравнивания ответа с эталоном. */
export interface DiffToken {
  status: DiffStatus
  /** Слово пользователя (match/typo/extra). */
  word?: string
  /** Слово эталона: правильное написание для typo, пропущенное для missing. */
  ref?: string
}

/**
 * Задание проверки — данные из контента (specs/05 §2/§3) в логических псевдонимах
 * specs/02 §3: `accepted` = variants[] фразы (или gap_answers cloze), ловушка — из traps.json.
 */
export interface CheckTask {
  /** Эталоны и допустимые варианты ответа (минимум — text_en). */
  accepted: string[]
  /**
   * Номер ловушки каталога (ЛТ-06/ЛТ-17/ЛТ-19): для них «верно с опечаткой»
   * превращается в «неверно» (specs/02 §4.7 — артикль/вспом. глагол меняют смысл).
   */
  trapLtId?: string | null
  /** Явно запрещённый паттерн ловушки (`traps.wrong_en`, напр. «I go to home») — §4.3. */
  trapWrong?: string | null
  /**
   * `answer.typo === 'exact'` из данных (specs/05 §3): опечатки не прощаются
   * вовсе — слова проверяются точным совпадением (cloze-пропуски, выбор).
   */
  exactTypos?: boolean
  /**
   * `answer.speech_threshold` из данных (specs/05 §3): базовый порог мягкой
   * голосовой проверки (specs/02 §4.8); для длинных фраз действует 0.80.
   */
  speechThreshold?: number
}

/** Результат проверки одного задания. */
export interface CheckResult {
  verdict: VerdictKind
  /** Выравнивание с лучшим эталоном — для diff-подсветки (§4.5). */
  diff: DiffToken[]
  /** Эталонный вариант, с которым сравнивали. */
  ref: string
  /** Сработал явно запрещённый паттерн ловушки (§4.3) — показать правило ловушки. */
  trapTriggered: boolean
}

/** Режим проверки: текст (§4.4) или распознанная речь (§4.8). */
export type CheckMode = 'text' | 'voice'

/**
 * Запись для кнопки «Я был прав» (specs/02 §4.6): попадает в очередь правки вариантов
 * (таблица `disputes` через ProgressRepository) и в экспорт для ручного разбора данных.
 */
export interface DisputeRecord {
  phraseId: string
  userAnswer: string
  expectedVariant: string
  date: string
}
