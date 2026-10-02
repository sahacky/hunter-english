# CREDITS — источники данных и компонентов

Учебные данные в `data/` публикуются под **CC BY-SA 4.0** (см. `data/README.md`), код — под MIT (см. `LICENSE`).

## Словарные списки

| Источник                                                 | Лицензия     | Ссылка                                       |
| -------------------------------------------------------- | ------------ | -------------------------------------------- |
| NGSL 1.2 / NGSL-Spoken 1.2 (Browne, Culligan & Phillips) | CC BY-SA 4.0 | https://www.newgeneralservicelist.com/       |
| FrequencyWords / OpenSubtitles 2018 (hermitdave)         | MIT          | https://github.com/hermitdave/FrequencyWords |

Производные словарные данные в `data/words/` — CC BY-SA 4.0 (ShareAlike
Wiktionary/NGSL). Уровни CEFR в `data/words/` выведены агентом из частотных
рангов NGSL (самостоятельная производная работа); разметка Oxford 3000/5000
не используется и не публикуется.

## Переводы и примеры

| Источник                                  | Лицензия     | Ссылка               |
| ----------------------------------------- | ------------ | -------------------- |
| Wiktionary через kaikki.org (wiktextract) | CC BY-SA 4.0 | https://kaikki.org/  |
| Tatoeba                                   | CC BY 2.0 FR | https://tatoeba.org/ |

## Голос

| Источник                   | Лицензия                         |
| -------------------------- | -------------------------------- |
| Piper voice `cori` (en_GB) | датасет public domain (LibriVox) |
| Piper voices repo + piper-tts | MIT (rhasspy/piper-voices, OHF-voice/piper1-gpl) |
| Kokoro `bm_george`         | Apache 2.0                       |

## Цитаты

Короткие цитаты из произведений приводятся в объёме право цитирования, с указанием источника
(Wikiquote, IMDb — ручная выборка, подборки Polygon, Know Your Meme). Видео и аудио из
произведений не распространяются; для прослушивания оригинала — внешние ссылки (PlayPhrase.me, Yarn, YouGlish).

## Шрифты и иконки

| Источник                                             | Лицензия |
| ---------------------------------------------------- | -------- |
| Nunito (self-host: `public/fonts/`, woff2 variable)  | SIL OFL (https://fonts.google.com/specimen/Nunito) |
| Tektur, Onest, Russo One, Golos Text, JetBrains Mono | SIL OFL  |
| lucide-icons                                         | MIT      |

## Не входит в репозиторий

- Oxford 3000/5000 (© Oxford University Press) — только локальная сверка уровней.
- Oxford CEFR-разметка слов — только внутренний пайплайн; в `data/` попадают уровни из открытых источников.
