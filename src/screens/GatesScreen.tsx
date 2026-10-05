// Implements: plan://M7#7.6 — Врата E→D /#/gates/E-D (specs/04 §3, specs/07 §2.1).
// intro (чеклист-рекомендация) → exam (4 секции из данных ранга E) → result
// (каждая секция ≥80% и сумма ≥85%; провал — слабые секции + кулдаун 72ч;
// пересдача — только слабые секции). Фидбэк на заданиях остаётся (упрощение M7,
// «слепой режим» — M8). Контент генерируется в рантайме (решение M7#1).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ChooseTranslationExercise,
  InputCheckExercise,
  VoiceExercise,
} from '../components/lesson/ExerciseView'
import { FreeOutputTask } from '../components/lesson/FreeOutputTask'
import type { ExerciseItem, PhraseItem } from '../content/lessons'
import { loadLessons, loadPhrases } from '../content/lessons'
import { createFirstCards, loadWordNotes, loadWordRanks } from '../content/words'
import { cooldownPassed, judgeGate, NEXT_RANK } from '../domain/game/game'
import { GATES, type GateRouteId } from '../domain/game/gates'
import type { Rank } from '../domain/game/types'
import type { GateAttempt, GateSectionScore } from '../domain/game/types'
import type { ProgressRepository } from '../domain/progress'
import { DexieProgressRepository } from '../data/progress-repository'
import { showToast } from '../lib/toast'

interface GatesScreenProps {
  repo?: ProgressRepository
}

// intro → exam → (S-FINAL: монолог-ритуал 60 сек, Q1.5) → result
type Phase = { kind: 'intro' } | { kind: 'exam' } | { kind: 'monologue' } | { kind: 'result' }

interface ExamItem {
  section: 'vocab' | 'grammar' | 'listening' | 'speaking'
  exercise: ExerciseItem
  phrase: PhraseItem | null
}

function seededPick<T>(items: T[], count: number, seedKey: string): T[] {
  let hash = 0
  for (const ch of seedKey) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  const pool = [...items]
  const out: T[] = []
  let state = Math.abs(hash) || 1
  while (out.length < count && pool.length > 0) {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    const index = state % pool.length
    out.push(pool[index])
    pool.splice(index, 1)
  }
  return out
}

function mkExercise(
  id: string,
  type: string,
  payload: Record<string, unknown>,
  xp: number,
): ExerciseItem {
  return {
    id,
    type,
    payload: { kind: type, ...payload },
    answer: { normalization: 'default', typo: type === 'choose_translation' ? 'exact' : 'allow' },
    meta: { skill: 'grammar', xp },
  }
}

/** Сборка экзамена из данных ранга (решение M7#1: рантайм-генерация).
 * Пул фраз — из уроков ранга входа (v2: Past Simple ушёл в D с фразами ph-c-*,
 * префиксы больше не отражают состав ранга — plan://curriculum-review#V.5). */
async function buildExam(
  attemptSeed: string,
  fromRank: Rank,
  wordsMaxRank: number,
): Promise<ExamItem[]> {
  const [allWordNotes, phrases, lessons, wordRanks] = await Promise.all([
    loadWordNotes(),
    loadPhrases(),
    loadLessons(),
    loadWordRanks(),
  ])
  // лексика секции — только изучаемые полосы ранга входа (game://gate-content,
  // ревью M12 М-6): суб-полоса (Infinity) в экзамен не попадает
  const wordNotes = allWordNotes.filter(
    (note) => (wordRanks.get(note.entityId) ?? 0) <= wordsMaxRank,
  )
  const rankPhraseIds = new Set(
    lessons
      .filter((lesson) => lesson.rank === fromRank)
      .flatMap((lesson) => lesson.grammar_point.phrase_ids),
  )
  const rankPhrases = phrases.filter((phrase) => rankPhraseIds.has(phrase.id))
  const items: ExamItem[] = []
  // Лексика 20: RU → выбор EN из заметок слов
  const words = seededPick(wordNotes, 20, `vocab-${attemptSeed}`)
  words.forEach((note, index) => {
    const distractors = wordNotes.filter((w) => w.id !== note.id).slice(index, index + 3)
    const options = seededPick(
      [note.en, ...distractors.map((d) => d.en)],
      4,
      `opt-${attemptSeed}-${index}`,
    )
    const exercise = mkExercise(
      `gate-v-${index}`,
      'choose_translation',
      {
        prompt: note.ru,
        options,
        correct: options.indexOf(note.en),
      },
      1,
    )
    items.push({ section: 'vocab', exercise, phrase: null })
  })
  // Грамматика 20: перевод фраз
  const grammar = seededPick(rankPhrases, 20, `grammar-${attemptSeed}`)
  grammar.forEach((phrase, index) => {
    const exercise = mkExercise(
      `gate-g-${index}`,
      'translate',
      {
        prompt_ru: phrase.translation_ru,
        phrase_id: phrase.id,
      },
      2,
    )
    items.push({ section: 'grammar', exercise, phrase })
  })
  // Слух 15: диктант
  const listening = seededPick(rankPhrases, 15, `listening-${attemptSeed}`)
  listening.forEach((phrase, index) => {
    const exercise = mkExercise(`gate-l-${index}`, 'dictation', { phrase_id: phrase.id }, 3)
    items.push({ section: 'listening', exercise, phrase })
  })
  // Речь 10: скажи фразу
  const speaking = seededPick(rankPhrases, 10, `speaking-${attemptSeed}`)
  speaking.forEach((phrase, index) => {
    const exercise = mkExercise(
      `gate-s-${index}`,
      'speak',
      {
        prompt_ru: phrase.translation_ru,
        phrase_id: phrase.id,
      },
      4,
    )
    items.push({ section: 'speaking', exercise, phrase })
  })
  return items
}

const SECTION_ORDER: ExamItem['section'][] = ['vocab', 'grammar', 'listening', 'speaking']

/** Попытка сдана: все секции ≥80% и сумма ≥85% по сохранённым оценкам. */
function passedExam(attempt: GateAttempt): boolean {
  if (!attempt.finished_at || attempt.scores.length === 0) return false
  return judgeGate(attempt.scores).passed
}

export default function GatesScreen({ repo: repoProp }: GatesScreenProps) {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const defaultRepo = useMemo(() => new DexieProgressRepository(), [])
  const repo = repoProp ?? defaultRepo
  const [phase, setPhase] = useState<Phase | null>(null)
  const [items, setItems] = useState<ExamItem[]>([])
  const [index, setIndex] = useState(0)
  const [scores, setScores] = useState<GateSectionScore[]>([])
  const [wordsKnown, setWordsKnown] = useState(0)
  const [lessonsDone, setLessonsDone] = useState(0)
  const [lessonsTotal, setLessonsTotal] = useState(0)
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null)
  const [verdict, setVerdict] = useState<{ passed: boolean; total: number; weak: string[] } | null>(
    null,
  )
  const correctRef = useRef({ vocab: 0, grammar: 0, listening: 0, speaking: 0 })

  const gateId = (params.id ?? 'E-D').toUpperCase()
  // Конфиг Врат вынесен в домен (общий с панелью Врат на /#/ranks)
  const gate = GATES[gateId as GateRouteId]
  const valid = gate !== undefined

  useEffect(() => {
    let alive = true
    async function load() {
      if (!valid) {
        setPhase({ kind: 'intro' })
        return
      }
      const now = new Date()
      await repo.ensureCards(createFirstCards(await loadWordNotes(), now))
      const cards = await repo.getAllCards()
      setWordsKnown(cards.filter((card) => card.deck === 'words' && card.state === 2).length)
      const lessons = (await loadLessons()).filter((lesson) => lesson.rank === gate.from)
      let done = 0
      for (const lesson of lessons) {
        const row = await repo.getLessonProgress(lesson.id)
        if (row?.status === 'completed') done += 1
      }
      setLessonsDone(done)
      setLessonsTotal(lessons.length)
      const attempt = await repo.getGateAttempt(gate.attemptId)
      if (attempt?.finished_at && attempt.passed.length >= 0 && !passedExam(attempt)) {
        // провал любой попытки → кулдаун 72ч (game://gate-cooldown); сданные секции сохранены
        setCooldownUntil(attempt.finished_at)
      }
      if (alive) setPhase({ kind: 'intro' })
    }
    void load().catch(() => {
      if (alive) setPhase({ kind: 'intro' })
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateId])

  const startExam = useCallback(
    async (sections: ExamItem['section'][]) => {
      const seed = `${gateId}-${Date.now()}`
      const exam = await buildExam(seed, gate.from, gate.wordsMaxRank)
      const filtered = exam.filter((item) => sections.includes(item.section))
      correctRef.current = { vocab: 0, grammar: 0, listening: 0, speaking: 0 }
      setItems(filtered)
      setIndex(0)
      setScores([])
      setVerdict(null)
      setPhase({ kind: 'exam' })
      // прошлые сданные секции сохраняются для пересдачи (game://gate-retry-sections)
      const previous = await repo.getGateAttempt(gate.attemptId)
      await repo.putGateAttempt({
        gate: gate.attemptId,
        started_at: new Date().toISOString(),
        finished_at: null,
        passed: previous?.passed ?? [],
        scores: previous?.scores ?? [],
      })
    },
    [gateId, repo],
  )

  const finishExam = useCallback(
    async (finalScores: GateSectionScore[]) => {
      const result = judgeGate(finalScores)
      setVerdict({
        passed: result.passed,
        total: result.total,
        weak: result.weakSections.map((s) => s.section),
      })
      // S-FINAL: перед вердиктом — финальный монолог 60 сек без сверки (Q1.5);
      // на счёт не влияет (самопроверка в экзамене не считается, ревью M7#М9)
      setPhase(gate.final ? { kind: 'monologue' } : { kind: 'result' })
      const finishedAt = new Date().toISOString()
      await repo.putGateAttempt({
        gate: gate.attemptId,
        started_at: finishedAt,
        finished_at: finishedAt,
        passed: result.passed
          ? []
          : finalScores
              .filter((s) => s.correct / Math.max(1, s.total) >= 0.8)
              .map((s) => s.section),
        scores: finalScores,
      })
      if (result.passed) {
        const stats = await repo.getStats()
        const nextRank = NEXT_RANK[stats.rank]
        if (stats.rank === gate.from) {
          await repo.putStats({
            ...stats,
            rank: nextRank,
            xp: stats.xp + 200, // game://gate-win
            gates_history: [
              ...stats.gates_history,
              // Финал ранг не повышает — история помечается особым id (specs/07 §2)
              { gate: gate.attemptId, passed_at: finishedAt, score: result.total },
            ],
            updated_at: finishedAt,
          })
          // решение M10#2; Финал — свой тост
          /* istanbul ignore next — Финал: дисплей-ветки (полный проход экзамена — веха S4, M19-прецедент) */
          showToast(gate.final ? t('toast.finalPassed') : t('toast.rankUp', { rank: nextRank }))
        }
      }
    },
    [repo],
  )

  const current = items[index]
  const currentSection = current?.section

  const handleAnswer = useCallback(
    (outcome: string) => {
      /* istanbul ignore next @preserve — защитный гард: onAnswer доступен только у активного задания */
      if (!current) return
      // самопроверка не считается в экзамене (ревью M7#М9): только распознанный/ввод
      const ok = outcome === 'correct' || outcome === 'disputed'
      if (ok) correctRef.current[current.section] += 1
    },
    [current],
  )

  const handleNext = useCallback(() => {
    const nextIndex = index + 1
    if (nextIndex < items.length) {
      setIndex(nextIndex)
      return
    }
    const finalScores = SECTION_ORDER.map((section) => {
      const sectionItems = items.filter((item) => item.section === section)
      return { section, correct: correctRef.current[section], total: sectionItems.length }
    }).filter((score) => score.total > 0)
    setScores(finalScores)
    void finishExam(finalScores)
  }, [index, items, finishExam])

  if (!valid) {
    return (
      <section className="panel">
        <h2>{t('notFound.title')}</h2>
        <p className="dim">{t('gates.notFound')}</p>
      </section>
    )
  }
  if (!phase) {
    return (
      <section className="panel">
        <p className="dim">{t('common.loading')}</p>
      </section>
    )
  }
  if (phase.kind === 'intro') {
    const wordsOk = wordsKnown >= gate.wordsTarget
    const lessonsOk = lessonsDone >= gate.lessonsOkAt
    const cooldown = cooldownUntil !== null && !cooldownPassed(cooldownUntil, new Date())
    return (
      <section className="panel gates-panel">
        <h2>
          {gate.final ? t('gates.titleFinal') : t('gates.title', { from: gate.from, to: gate.to })}
        </h2>
        {/* plan://ux-feedback-2#U.1 — строка-легенда: что такое Врата */}
        <p className="dim">
          {gate.final
            ? t('gates.legendFinal')
            : t('gates.legend', { from: gate.from, to: gate.to })}
        </p>
        <ul className="gates-checklist">
          <li className={wordsOk ? 'dash-quest-done' : undefined}>
            {t('gates.check.words', { known: wordsKnown, target: gate.wordsTarget })}{' '}
            {wordsOk ? '☑' : '☐'}
          </li>
          <li className={lessonsOk ? 'dash-quest-done' : undefined}>
            {t('gates.check.lessons', { done: lessonsDone, total: lessonsTotal, rank: gate.from })}{' '}
            {lessonsOk ? '☑' : '☐'}
          </li>
        </ul>
        {!wordsOk && !lessonsOk && <p className="dim">{t('gates.check.hint')}</p>}
        {cooldown && (
          <p className="lesson-trap">
            {t('gates.cooldown', {
              time: new Date(cooldownUntil!).toLocaleString(),
            })}
          </p>
        )}
        <div className="lesson-actions">
          <button
            type="button"
            className="srs-btn srs-btn-good"
            disabled={cooldown}
            onClick={() => void startExam(['vocab', 'grammar', 'listening', 'speaking'])}
          >
            {t('gates.enter')}
          </button>
        </div>
      </section>
    )
  }
  if (phase.kind === 'monologue') {
    return (
      <section className="panel gates-panel">
        <h2>{t('gates.titleFinal')}</h2>
        <FreeOutputTask
          seconds={60}
          checklistRu={t('gates.monologue.checklist', { returnObjects: true }) as string[]}
          promptEn={t('gates.monologue.prompt')}
          situationRu={t('gates.monologue.situation')}
          onAnswer={() => {
            /* монолог-ритуал: на счёт экзамена не влияет (ревью M7#М9) */
          }}
          onNext={() => setPhase({ kind: 'result' })}
        />
      </section>
    )
  }
  if (phase.kind === 'result') {
    return (
      <section className="panel gates-panel">
        <h2>{verdict?.passed ? t('gates.passed') : t('gates.failed')}</h2>
        <ul className="gates-scores">
          {scores.map((score) => (
            <li key={score.section}>
              {t(`gates.sections.${score.section}`)}:{' '}
              {score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0}%
            </li>
          ))}
          <li>{t('gates.total', { total: verdict?.total ?? 0 })}</li>
        </ul>
        {verdict?.passed ? (
          /* istanbul ignore next — Финал: дисплей-ветки (полный проход экзамена — веха S4, M19-прецедент) */
          <p>{gate.final ? t('gates.finalPassed') : t('gates.rankUp', { rank: gate.to })}</p>
        ) : (
          <p className="dim">{t('gates.retryHint')}</p>
        )}
        <div className="lesson-actions">
          {!verdict?.passed && verdict && verdict.weak.length > 0 && (
            <button
              type="button"
              className="srs-btn"
              onClick={() => void startExam(SECTION_ORDER.filter((s) => verdict.weak.includes(s)))}
            >
              {t('gates.retryWeak')}
            </button>
          )}
          {!verdict?.passed && verdict && verdict.weak.length === 0 && (
            <p className="dim">{t('gates.totalFailHint')}</p>
          )}
        </div>
      </section>
    )
  }

  // exam
  const sectionIndex = SECTION_ORDER.indexOf(currentSection ?? 'vocab')
  return (
    <section className="panel gates-panel">
      <header>
        <h2>
          {/* istanbul ignore next — Финал: заголовок экзамена (полный проход — веха S4) */}
          {gate.final ? t('gates.titleFinal') : t('gates.title', { from: gate.from, to: gate.to })}
        </h2>
        <p className="dim">
          {t('gates.sectionProgress', {
            section: t(`gates.sections.${currentSection ?? 'vocab'}`),
            index: sectionIndex + 1,
            total: SECTION_ORDER.length,
          })}{' '}
          · {index + 1}/{items.length}
        </p>
      </header>
      {current && current.exercise.type === 'choose_translation' && (
        <ChooseTranslationExercise
          key={current.exercise.id}
          exercise={current.exercise}
          phrase={current.phrase}
          trap={null}
          onAnswer={(outcome) => handleAnswer(outcome)}
          onDispute={() => {
            /* istanbul ignore next @preserve — choose не вызывает onDispute: исход известен сразу */
            return undefined
          }}
          onNext={handleNext}
        />
      )}
      {current && current.exercise.type === 'translate' && (
        <InputCheckExercise
          key={current.exercise.id}
          mode="translate"
          exercise={current.exercise}
          phrase={current.phrase}
          trap={null}
          onAnswer={(outcome) => handleAnswer(outcome)}
          onDispute={() => undefined}
          onNext={handleNext}
        />
      )}
      {current && current.exercise.type === 'dictation' && (
        <InputCheckExercise
          key={current.exercise.id}
          mode="dictation"
          exercise={current.exercise}
          phrase={current.phrase}
          trap={null}
          onAnswer={(outcome) => handleAnswer(outcome)}
          onDispute={() => undefined}
          onNext={handleNext}
        />
      )}
      {current && current.exercise.type === 'speak' && (
        <VoiceExercise
          key={current.exercise.id}
          mode="speak"
          exercise={current.exercise}
          phrase={current.phrase}
          trap={null}
          onAnswer={(outcome) => handleAnswer(outcome)}
          onDispute={() => {
            /* istanbul ignore next @preserve — все пути finish() в VoiceExercise зовут onNext сразу, спор недостижим */
            return undefined
          }}
          onNext={handleNext}
        />
      )}
    </section>
  )
}
