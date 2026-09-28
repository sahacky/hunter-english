// Implements: plan://M5#5.2 — типы домена урока (specs/02 §2, §5; specs/06 §3)
// Чистый TS без знания о хранилище и React (архитектурный «шов», PLANS → M5).

/** Статус урока на пути — specs/02 §5. В БД хранятся только in_progress/completed/review_due (specs/06 §3). */
export type LessonStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'review_due'

/** Статус записи в lesson_progress (specs/06 §3 — check constraint). */
export type StoredLessonStatus = 'in_progress' | 'completed' | 'review_due'

/**
 * Блоки шаблона урока (specs/02 §2): 1 Правило → 2 Разогрев → 3 Построение →
 * 4 Слух → 5 Речь → 6 Из сериала → 7 В колоду. Шаг 7 заданий не имеет.
 */
export type StepKind = 'rule' | 'warmup' | 'build' | 'listening' | 'speaking' | 'quotes' | 'deck'

/** Шаг урока: задания в порядке следования внутри шага. */
export interface LessonStep {
  /** 1–7 по шаблону. */
  index: number
  kind: StepKind
  exerciseIds: string[]
}

/**
 * Исход задания для XP (specs/02 §3): первая попытка — полный XP, верно со второй — 50%,
 * подсказка/пропуск — 0; спорный ответ («Я был прав») и самопроверка речи — полный XP.
 */
export type ExerciseOutcome =
  'correct' | 'correct_retry' | 'hint' | 'skip' | 'disputed' | 'self_reported'

/** Результат одного задания урока. */
export interface ExerciseResult {
  attempts: number
  outcome: ExerciseOutcome
}

/** Счёт шага: сколько заданий отвечено и сколько верно с первой попытки. */
export interface StepScore {
  stepIndex: number
  /** Всего заданий в шаге. */
  total: number
  /** Отвечено (включая «неверно» и «пропуск» — они двигают урок дальше, specs/02 §3). */
  answered: number
  /** Верно с первой попытки (correct/disputed/self_reported). */
  firstTryCorrect: number
}

/**
 * Чекпоинт урока — specs/02 §5 (`{lessonId, stepIndex, passIndex, scores[], srsEnqueued[]}`).
 * Единица сохранения — отдельное задание: результат пишется сразу после вердикта.
 */
export interface LessonCheckpoint {
  /** Текущий проход (0-based). Уроки ранга E — 1 проход (specs/02 §2). */
  passIndex: number
  /** Текущий шаг (1–7). */
  stepIndex: number
  scores: StepScore[]
  /** Сущности (слова/фразы), отправленные в колоду на шаге 7. */
  srsEnqueued: string[]
  /** Число завершённых проходов. */
  passesDone: number
  /** Исходы заданий текущего прохода (exerciseId → результат). */
  results: Record<string, ExerciseResult>
}

/** Запись lesson_progress — зеркало specs/06 §3 (db://table-lesson_progress). */
export interface LessonProgress {
  lesson_id: string
  status: StoredLessonStatus
  /** 0–100 — точность прохода, завершившего урок (specs/06 §3 score). */
  score: number | null
  checkpoint: LessonCheckpoint
  completed_at: string | null
  updated_at: string
}

/** Статистика SRS по фразам урока — для критерия «пройден» (specs/02 §2, §5). */
export interface SrsLessonStats {
  /** Всего фраз урока в колоде. */
  total: number
  /** «Выучено»: интервал ≥ 7 дней. */
  learned: number
  /** «Просело»: интервалы упали ниже 7 дней после зачисления. */
  lapsed: number
}
