// Implements: plan://teaching-quality#Q3.1 — обратный цикл EN→RU→EN
// (Lampariello, research/10 01 §2 №9): услышал фразу урока EN → пересказал RU
// → построил EN снова по-своему. Три самопроверки, expected[] не проверяется,
// исход self_reported (XP по правилу самопроверки B-27).

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ExerciseOutcome } from '../../domain/lesson/types'
import type { PhraseItem } from '../../content/lessons'
import { AudioButtons } from './ExerciseView'

type RetellStage = 'listen' | 'ru' | 'en'

export interface RetellTaskProps {
  /** Фраза урока (payload.phrase_id). */
  phrase: PhraseItem | null
  onAnswer: (outcome: ExerciseOutcome, attempts: number) => void
  onNext: () => void
}

/** Микротип повторений: аудио EN → RU-пересказ → EN по-своему (Q3.1). */
export function RetellTask({ phrase, onAnswer, onNext }: RetellTaskProps) {
  const { t } = useTranslation()
  const [stage, setStage] = useState<RetellStage>('listen')
  const [finished, setFinished] = useState(false)

  const finish = () => {
    setFinished(true)
    onAnswer('self_reported', 1)
    onNext()
  }

  if (!phrase) {
    return (
      <div className="lesson-exercise">
        <p className="dim">{t('lesson.retell.noPhrase')}</p>
        <div className="lesson-actions">
          <button type="button" className="srs-btn srs-btn-good" onClick={onNext}>
            {t('lesson.next')} <kbd>⏎</kbd>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="lesson-exercise lesson-retell">
      <p className="lesson-quote-src dim">{t('lesson.retell.title')}</p>
      {stage === 'listen' && (
        <>
          <p className="dim">{t('lesson.retell.listenHint')}</p>
          <AudioButtons text={phrase.text_en} src={phrase.audio?.en_gb} limitPlays={3} />
          <div className="lesson-actions">
            <button type="button" className="srs-btn srs-btn-good" onClick={() => setStage('ru')}>
              {t('lesson.retell.toListenDone')}
            </button>
          </div>
        </>
      )}
      {stage === 'ru' && (
        <>
          <p className="lesson-prompt" lang="ru">
            {t('lesson.retell.ruPrompt')}
          </p>
          <p className="dim">{t('lesson.retell.selfCheckHint')}</p>
          <div className="lesson-actions">
            <button type="button" className="srs-btn srs-btn-good" onClick={() => setStage('en')}>
              {t('lesson.saidIt')}
            </button>
          </div>
          <p className="dim">{t('lesson.retell.ruRef', { ru: phrase.translation_ru })}</p>
        </>
      )}
      {stage === 'en' && (
        <>
          <p className="lesson-prompt" lang="en">
            {t('lesson.retell.enPrompt')}
          </p>
          <p className="dim">{t('lesson.retell.selfCheckHint')}</p>
          <div className="lesson-actions">
            <button
              type="button"
              className="srs-btn srs-btn-good"
              disabled={finished}
              onClick={finish}
            >
              {t('lesson.saidItFree')}
            </button>
          </div>
          <p className="dim">{t('lesson.retell.enRef', { en: phrase.text_en })}</p>
        </>
      )}
    </div>
  )
}
