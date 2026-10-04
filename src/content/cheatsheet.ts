// Implements: plan://teaching-quality#cheat-sheet — «Шпаргалка пройденного»
// (идея разработчика 2026-10-04, решение: свёрнутый блок на /#/srs, без новой
// вкладки). Выжимка правил завершённых уроков из готового `rule_md` — новых
// данных не заводим: строка «Формула:» Q-фазы (Q1.1) — готовый кандидат,
// для рангов до ревизии — фолбэк на первую строку правила.
import { loadLessons, lessonToCourseId, COURSE_RANKS, type LessonItem } from './lessons'
import type { LessonProgress } from '../domain/lesson/types'
import type { ProgressRepository } from '../domain/progress'

/** Одна строка шпаргалки: урок + выжимка правила + ловушка (если есть). */
export interface CheatEntry {
  /** Слаг курса `E-01` (как на «Программе»). */
  courseId: string
  title: string
  /** «Формула: сигнал → форма» либо первая содержательная строка rule_md. */
  summary: string
  /** Строка «⚠️ Ловушка …» из rule_md; null — ловушки нет. */
  trap: string | null
}

/** Правила завершённых уроков одного ранга (порядок курса specs/01 §1). */
export interface CheatGroup {
  rank: LessonItem['rank']
  entries: CheatEntry[]
}

/** Ограничение выжимки — блок «пробежать глазами», не учебник (идея из PLANS). */
const MAX_SUMMARY = 160

const stripBold = (line: string): string => line.replace(/\*\*/g, '').trim()

/**
 * Выжимка правила: строка «Формула: …» (Q-фаза, метка Q1.1) без префикса;
 * иначе первая непустая строка rule_md без «⚠» (живой пример = суть правила
 * в рангах до ревизии). Длинные строки обрезаются с «…».
 */
export function ruleSummary(ruleMd: string): string {
  const lines = ruleMd.split('\n').map(stripBold)
  const formula = lines.find((line) => line.startsWith('Формула:'))
  const base = formula
    ? formula.slice('Формула:'.length).trim()
    : (lines.find((line) => line.length > 0 && !line.startsWith('⚠')) ?? '')
  return base.length > MAX_SUMMARY ? `${base.slice(0, MAX_SUMMARY - 1).trimEnd()}…` : base
}

/** Строка ловушки «⚠️ …» из rule_md (без `**`); null — ловушки нет. */
export function ruleTrapLine(ruleMd: string): string | null {
  const line = ruleMd.split('\n').find((raw) => stripBold(raw).startsWith('⚠'))
  return line ? stripBold(line) : null
}

/** Пройденный урок: completed/review_due (isLessonPassed, specs/02 §5). */
function isPassed(progress: LessonProgress | null): boolean {
  return progress?.status === 'completed' || progress?.status === 'review_due'
}

/**
 * Группы правил завершённых уроков по рангам E→S; внутри ранга — порядок
 * `loadLessons()` (поле `order` программы v2). Пустые ранги не попадают в список.
 */
export function buildCheatGroups(
  lessons: readonly LessonItem[],
  progress: readonly (LessonProgress | null)[],
): CheatGroup[] {
  const byRank = new Map<LessonItem['rank'], CheatEntry[]>()
  lessons.forEach((lesson, i) => {
    if (!isPassed(progress[i] ?? null)) return
    const entry: CheatEntry = {
      courseId: lessonToCourseId(lesson.id),
      title: lesson.title,
      summary: ruleSummary(lesson.grammar_point.rule_md),
      trap: ruleTrapLine(lesson.grammar_point.rule_md),
    }
    const bucket = byRank.get(lesson.rank)
    if (bucket) bucket.push(entry)
    else byRank.set(lesson.rank, [entry])
  })
  return COURSE_RANKS.filter((rank) => byRank.has(rank)).map((rank) => ({
    rank,
    entries: byRank.get(rank)!,
  }))
}

/** Шпаргалка одним чтением: уроки курса + чекпоинты (аналог PathScreen). */
export async function loadCheatSheet(repo: ProgressRepository): Promise<CheatGroup[]> {
  const lessons = await loadLessons()
  const progress = await repo.getManyLessonProgress(lessons.map((lesson) => lesson.id))
  return buildCheatGroups(lessons, progress)
}
