// Implements: plan://first-lessons-a0#V3 — пре-урок E-00 «Азбука и первые слова».
// Пропускаемый экран до первого урока: алфавит с озвучкой + тренажёр набора
// базовых слов (печатание вводится до E-01). Без XP/SRS/чекпоинтов — вход
// с карточки на /#/path, выход — «Пропустить» или «Начать урок E-01».
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { BASICS_LETTERS, BASICS_WORDS, basicsAudioSrc } from '../content/basics'
import { checkText } from '../domain/check/checker'
import type { CheckTask } from '../domain/check/types'
import { speak } from '../lib/tts'

export default function BasicsScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [wordIndex, setWordIndex] = useState(0)
  const [value, setValue] = useState('')
  const [result, setResult] = useState<'ok' | 'bad' | null>(null)

  const finished = wordIndex >= BASICS_WORDS.length
  const word = finished ? null : BASICS_WORDS[wordIndex]!

  const check = () => {
    /* istanbul ignore next @preserve — защитная гарда: пустой ввод/готовый
       результат блокированы disabled-кнопкой и отсутствием формы */
    if (!word || !value.trim() || result === 'ok') return
    const task: CheckTask = { accepted: [word.en], exactTypos: false }
    const verdict = checkText(value, task)
    setResult(verdict.verdict === 'correct' || verdict.verdict === 'correct_typo' ? 'ok' : 'bad')
  }

  const next = () => {
    setWordIndex((index) => index + 1)
    setValue('')
    setResult(null)
  }

  return (
    <section className="panel basics-panel">
      <header className="lesson-head">
        <h2>{t('basics.title')}</h2>
        <p className="dim">{t('basics.sub')}</p>
      </header>

      <h3>{t('basics.alphabet')}</h3>
      <ul className="basics-alphabet">
        {BASICS_LETTERS.map(({ letter, name }) => (
          <li key={letter}>
            <button
              type="button"
              className="basics-letter"
              onClick={() =>
                speak(letter, { src: basicsAudioSrc(`letter-${letter.toLowerCase()}`) })
              }
            >
              <span className="basics-letter-glyph">{letter}</span>
              <span className="basics-letter-name dim">{name}</span>
            </button>
          </li>
        ))}
      </ul>

      <h3>{t('basics.words')}</h3>
      {finished ? (
        <div className="basics-word" role="status">
          <p className="lesson-verdict-ok">{t('basics.done')}</p>
          <div className="lesson-actions">
            <button
              type="button"
              className="srs-btn srs-btn-good"
              onClick={() => navigate('/lesson/E-01')}
            >
              {t('basics.finish')}
            </button>
          </div>
        </div>
      ) : (
        <div className="basics-word">
          <p className="basics-word-en" lang="en">
            {word?.en}
            <button
              type="button"
              className="srs-btn"
              aria-label={t('basics.play')}
              onClick={() => word && speak(word.en, { src: basicsAudioSrc(`word-${word.en}`) })}
            >
              🔊
            </button>
          </p>
          <p className="dim" lang="ru">
            {word?.ru}
          </p>
          <p className="dim">{t('basics.typePrompt')}</p>
          <form
            className="lesson-input-row"
            onSubmit={(event) => {
              event.preventDefault()
              if (result === 'bad' || finished) next()
              else check()
            }}
          >
            <input
              className="lesson-input"
              lang="en"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              disabled={result === 'ok'}
            />
            {!result && (
              <button type="submit" className="srs-btn srs-btn-good" disabled={!value.trim()}>
                {t('basics.check')} <kbd>⏎</kbd>
              </button>
            )}
          </form>
          {result === 'ok' && (
            <div className="lesson-actions" role="status">
              <p className="lesson-verdict-ok">{t('basics.correct')}</p>
              <button type="button" className="srs-btn srs-btn-good" onClick={next}>
                {t('basics.next')} <kbd>⏎</kbd>
              </button>
            </div>
          )}
          {result === 'bad' && (
            <div className="lesson-actions" role="status">
              <p className="lesson-verdict-bad">
                {t('basics.wrong')} <span lang="en">{word?.en}</span>
              </p>
              <button type="button" className="srs-btn srs-btn-good" onClick={next}>
                {t('basics.next')} <kbd>⏎</kbd>
              </button>
            </div>
          )}
        </div>
      )}

      <div className="lesson-actions basics-footer">
        <button type="button" className="srs-btn" onClick={() => navigate('/path')}>
          {t('basics.skip')}
        </button>
      </div>
    </section>
  )
}
