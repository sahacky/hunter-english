// Implements: plan://M8#8.1 — разговорник: /#/phrasebook (список) и
// /#/phrasebook/:situation (фразы + диалог-сценка чтением с текстовым вводом —
// решение M8#1). Проверка реплик — домен checker (specs/02 §4).

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { judge, judgeVoice } from '../domain/check/checker'
import type { CheckResult } from '../domain/check/types'
import { loadPhrasebook, SITUATIONS, type PhrasebookDialog } from '../content/phrasebook'
import { FeedbackPlate } from '../components/lesson/ExerciseView'
import { speak } from '../lib/tts'
import { cancelListening, isSpeechSupported, listenOnce } from '../lib/speech'

export function PhrasebookScreen() {
  const { t } = useTranslation()
  const [dialogs, setDialogs] = useState<PhrasebookDialog[] | null>(null)

  useEffect(() => {
    let alive = true
    void loadPhrasebook()
      .then((value) => {
        if (alive) setDialogs(value)
      })
      .catch(() => {
        if (alive) setDialogs([])
      })
    return () => {
      alive = false
    }
  }, [])

  if (!dialogs) {
    return (
      <section className="panel">
        <p className="dim">{t('common.loading')}</p>
      </section>
    )
  }
  return (
    <section className="panel">
      <h2>{t('phrasebook.title')}</h2>
      <ul className="pb-list">
        {SITUATIONS.map((situation) => {
          const count = dialogs.filter((dialog) => dialog.topic === situation.id).length
          const available = count > 0
          return (
            <li key={situation.id}>
              <a
                className={`pb-card ${available ? '' : 'pb-locked'}`}
                href={`#/phrasebook/${situation.id}`}
                aria-disabled={!available}
              >
                {t(`phrasebook.situations.${situation.id}`)}
                <span className="dim">
                  {' '}
                  [{situation.minRank}] {available ? '' : ` · ${t('phrasebook.locked')}`}
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

type LineState = 'pending' | 'passed' | 'revealed'

export function PhrasebookSituationScreen() {
  const { t } = useTranslation()
  const params = useParams<{ situation: string }>()
  const [dialogs, setDialogs] = useState<PhrasebookDialog[] | null>(null)
  const [lineIndex, setLineIndex] = useState(0)
  const [dialogIndex, setDialogIndex] = useState(0)
  const [value, setValue] = useState('')
  const [result, setResult] = useState<CheckResult | null>(null)
  const [lineState, setLineState] = useState<LineState>('pending')
  const [listening, setListening] = useState(false)

  useEffect(() => {
    let alive = true
    void loadPhrasebook().then((value) => {
      if (alive) setDialogs(value)
    })
    return () => {
      alive = false
      cancelListening() // микрофон освобождается при уходе с экрана
    }
  }, [])

  const situation = params.situation ?? ''
  const situationDialogs = useMemo(
    () => (dialogs ?? []).filter((dialog) => dialog.topic === situation),
    [dialogs, situation],
  )
  const dialog = situationDialogs[dialogIndex]
  const line = dialog?.lines[lineIndex]
  const isUser = line !== undefined && dialog !== undefined && line.role === dialog.user_role

  if (!dialogs) {
    return (
      <section className="panel">
        <p className="dim">{t('common.loading')}</p>
      </section>
    )
  }
  if (!dialog) {
    return (
      <section className="panel">
        <h2>{t('notFound.title')}</h2>
        <p className="dim">{t('phrasebook.notFound')}</p>
      </section>
    )
  }

  const check = () => {
    if (!line?.accepted) return
    const verdict = judge(value, { accepted: line.accepted })
    setResult(verdict)
    if (verdict.verdict === 'correct' || verdict.verdict === 'correct_typo') {
      setLineState('passed')
    }
  }

  // Голосовой ответ (plan://M10#10.7, M8-решение 1 → M10): judgeVoice по accepted[],
  // мягкая проверка §4.8; фолбэк текстом остаётся
  const answerByVoice = async () => {
    if (!line?.accepted || listening) return
    setListening(true)
    try {
      const heard = await listenOnce({})
      const verdict = judgeVoice(heard, { accepted: line.accepted })
      setResult(verdict)
      if (verdict.verdict === 'correct' || verdict.verdict === 'correct_typo') {
        setLineState('passed')
      }
    } catch {
      // нет речи / ошибка микрофона — остаёмся на текстовом вводе (best effort)
    } finally {
      setListening(false)
    }
  }

  const nextLine = () => {
    setResult(null)
    setValue('')
    setLineState('pending')
    if (lineIndex + 1 < dialog.lines.length) {
      setLineIndex(lineIndex + 1)
    } else if (dialogIndex + 1 < situationDialogs.length) {
      setDialogIndex(dialogIndex + 1)
      setLineIndex(0)
    } else {
      setDialogIndex(-2) // завершено
    }
  }

  if (dialogIndex === -2) {
    return (
      <section className="panel">
        <h2>{t('phrasebook.doneTitle')}</h2>
        <p className="dim">{t('phrasebook.doneText')}</p>
      </section>
    )
  }

  return (
    <section className="panel lesson-panel">
      <header className="lesson-head">
        <h2 lang="ru">{dialog.situation_ru}</h2>
        <p className="dim">
          {t('phrasebook.dialogProgress', {
            current: dialogIndex + 1,
            total: situationDialogs.length,
          })}
        </p>
      </header>
      {line && (
        <div className="pb-line">
          <p className={`pb-bubble ${isUser ? 'pb-bubble-user' : ''}`} lang="en">
            {lineState === 'revealed' || !isUser ? line.text_en : '…'}
            <button type="button" className="srs-btn" onClick={() => speak(line.text_en)}>
              🔊
            </button>
          </p>
          {!isUser && (
            <p className="dim" lang="ru">
              {line.translation_ru}
            </p>
          )}
          {isUser && line.accepted && lineState === 'pending' && (
            <>
              <p className="dim" lang="ru">
                {line.translation_ru}
              </p>
              <form
                className="lesson-input-row"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (result) nextLine()
                  else if (value.trim()) check()
                }}
              >
                <input
                  className="lesson-input"
                  lang="en"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  disabled={lineState !== 'pending'}
                />
                {!result && (
                  <button type="submit" className="srs-btn srs-btn-good" disabled={!value.trim()}>
                    {t('lesson.check')} <kbd>⏎</kbd>
                  </button>
                )}
              </form>
              {isSpeechSupported() && (
                <button
                  type="button"
                  className="srs-btn"
                  disabled={listening}
                  onClick={() => void answerByVoice()}
                >
                  🎤 {listening ? t('lesson.listening') : t('phrasebook.answerByVoice')}
                </button>
              )}
              <button type="button" className="srs-btn" onClick={() => setLineState('revealed')}>
                {t('phrasebook.showAnswer')}
              </button>
            </>
          )}
          {result && <FeedbackPlate result={result} showReference={false} phrase={null} />}
          {(lineState === 'passed' || lineState === 'revealed' || !isUser) && (
            <div className="lesson-actions">
              <button type="button" className="srs-btn srs-btn-good" onClick={nextLine}>
                {t('lesson.next')} <kbd>⏎</kbd>
              </button>
            </div>
          )}
        </div>
      )}
      <p className="dim">
        <a href="#/phrasebook">← {t('phrasebook.back')}</a>
      </p>
    </section>
  )
}

export default PhrasebookScreen
