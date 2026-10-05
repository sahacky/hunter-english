// Implements: specs/04 §3 (game://gates) — конфиг Врат, общий для /#/ranks и /#/gates.
// Вынесено из GatesScreen при объединении разделов «Ранги и Врата» (фидбей разработчика:
// «слишком большой хедер» — один пункт навигации, список Врат на /#/ranks).

import type { GateId, Rank } from './types'

/** id Врат в маршруте (/#/gates/:id) — не путать с GateId (ключ попытки). */
export type GateRouteId = 'E-D' | 'D-C' | 'C-B' | 'B-A' | 'A-S' | 'S-FINAL'

export interface GateConfig {
  from: Rank
  to: Rank
  /** ключ попытки в item_progress: целевой ранг, для Финала — 'S-FINAL' (plan://M20#20.4) */
  attemptId: GateId
  wordsTarget: number
  lessonsOkAt: number
  /** лексика секции — только полосы ранга входа (game://gate-content) */
  wordsMaxRank: number
  final?: boolean
}

/** Порядок панели Врат на /#/ranks: повышения E→S, затем Финал. */
export const GATE_ORDER: GateRouteId[] = ['E-D', 'D-C', 'C-B', 'B-A', 'A-S', 'S-FINAL']

export const GATES: Record<GateRouteId, GateConfig> = {
  'E-D': {
    from: 'E',
    to: 'D',
    attemptId: 'D',
    wordsTarget: 300,
    lessonsOkAt: 5,
    wordsMaxRank: 2809,
  },
  'D-C': {
    from: 'D',
    to: 'C',
    attemptId: 'C',
    wordsTarget: 1000,
    lessonsOkAt: 20,
    wordsMaxRank: 1960,
  },
  'C-B': {
    from: 'C',
    to: 'B',
    attemptId: 'B',
    wordsTarget: 1800,
    lessonsOkAt: 10,
    wordsMaxRank: 2809,
  },
  'B-A': {
    from: 'B',
    to: 'A',
    attemptId: 'A',
    wordsTarget: 2800,
    lessonsOkAt: 15,
    wordsMaxRank: 2809,
  },
  'A-S': {
    from: 'A',
    to: 'S',
    attemptId: 'S',
    wordsTarget: 4000,
    lessonsOkAt: 22,
    wordsMaxRank: 2809,
  },
  // Финальное испытание (specs/07 §2 S-FINAL): ранг не повышает, чеклист — весь ранг S
  'S-FINAL': {
    from: 'S',
    to: 'S',
    attemptId: 'S-FINAL',
    wordsTarget: 5000,
    lessonsOkAt: 15,
    // весь NGSL-датасет (суб-полоса в экзамен не попадает — ревью M12 М-6)
    wordsMaxRank: 2810,
    final: true,
  },
}
