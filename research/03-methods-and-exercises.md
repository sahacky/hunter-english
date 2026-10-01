# Ресёрч, часть 3: упражнения, проверка ответов, нагрузка, доп. материалы

Дата: 2026-09-27. Продолжение [02-decisions-and-research.md](02-decisions-and-research.md).

---

## 1. Нагрузка карточками: сколько новых в день реально потянуть

Правило из мануала Anki: **N новых карточек в день дают ≈ 10×N повторов в день** в устоявшемся режиме. 20 новых в день выходят примерно в 200 повторов в день.

Средняя скорость около 6–8 секунд на карточку:

| Новых карточек в день | Повторов в день | Время на повторы |
|---|---|---|
| 10 | ~100 | ~12–15 мин |
| **15** | **~150** | **~18–20 мин** |
| 20 | ~200 | ~25–27 мин |
| 30 | ~300 | ~40 мин (это уже больше половины часа) |

Retention в FSRS держим **0,90** (дефолт). Выше 0,95 нагрузка растёт очень резко.

**Решение для часа в день: 15 новых карточек в день**, из них ~10 слов и ~5 фраз/грамматических конструкций.
- На одно слово поначалу **1 карточка** (EN→RU + звук). Обратная (RU→EN с вводом) включается, когда слово «созрело» (интервал ≥ 7 дней). Так нагрузка не удваивается.
- Защита от завала: если вчера пропустил, **новые карточки автоматически урезаются**, пока долг повторов не рассосётся. В Anki это частая причина бросить: «зашёл после недели, а там 800 карточек».

Скорректированный темп по словам (10 слов в день):
- 721 разговорное слово: ~2,5 мес.
- 2 800 (NGSL): ~9 мес.
- 5 000: ~16 мес.

### Обновлённый ежедневный час (заменяет §11 из 01-research)

| Блок | Мин | Что |
|---|---|---|
| 1. Повторение | ~20 | все карточки на сегодня (слова + фразы) |
| 2. Урок грамматики | 15 | правило, потом 20–30 фраз RU→EN |
| 3. Новые слова | 8 | 10 слов во фразах |
| 4. Слух | 8 | диктант |
| 5. Речь | 7 | shadowing + ответ на вопрос в микрофон |
| 6. Бонус | 2–5 | цитата дня, разговорник |

Если повторов мало (первые недели), освободившееся время уходит на урок и слух.

---

## 2. Каталог упражнений

Собрано из Duolingo, Бебриса, Puzzle English и Anki. Отмечено, какой навык тренирует упражнение и какому методу из 01-research соответствует.

| # | Упражнение | Навык | Метод | Уровень |
|---|---|---|---|---|
| 1 | **Карточка** (EN→RU, открыть ответ, оценить Again/Hard/Good/Easy) | лексика, узнавание | SRS | все |
| 2 | **Переведи фразу** RU→EN, ввод текстом | грамматика, построение | production (Бебрис) | все |
| 3 | **Скажи фразу** RU→EN голосом | говорение | production + речь | все |
| 4 | **Собери фразу из слов** (word bank, перемешанные слова) | порядок слов | облегчённый production | E–D (новичкам проще, чем ввод) |
| 5 | **Диктант**: прослушай и напиши | аудирование, орфография | dictation | все |
| 6 | **Повтори за диктором** (shadowing) в микрофон | произношение, беглость | shadowing | все |
| 7 | **Заполни пропуск** в фразе (cloze), в т.ч. в цитате из сериала | грамматика, лексика в контексте | recall | все |
| 8 | **Выбери правильный перевод** из 3–4 | понимание | recognition | E–D (разогрев) |
| 9 | **Найди пары** (5 слов EN ↔ 5 RU) | лексика, быстро | recognition | E–C |
| 10 | **Найди ошибку** («He live in London» → исправь) | грамматика, ловушки для русских | error correction | D+ |
| 11 | **Ответь на вопрос** голосом (Where do you live? → I live in…) | диалог | output | D+ |
| 12 | **Диалог-сценка** (разговорник): реплики собеседника озвучены, ты отвечаешь | разговор в ситуации | output + input | D+ |
| 13 | **Поставь глагол в нужное время** (время выбирается по маркерам yesterday / already / now) | времена | production | C+ |
| 14 | **Трансформация**: «I work» → вопрос → отрицание → прошедшее | грамматика | drill | все |

**Как это ложится в урок:** в начале лёгкие упражнения (8, 9, 4), в середине основные (2, 3, 14), в конце слух и речь (5, 6) и в финале цитата (7). Сложность внутри урока растёт.

---

## 3. Проверка ответов: чтобы не бесило

Главный риск упражнений с вводом: правильный ответ засчитан как неверный. Правила:

1. **Нормализация перед сравнением:** регистр, лишние пробелы, конечная точка/знак, типографские кавычки и апострофы (’ → ').
2. **Сокращения эквивалентны:** `I'm` = `I am`, `don't` = `do not`, `it's` = `it is`, `can't` = `cannot` = `can not`.
3. **Несколько правильных вариантов** у каждой фразы: «Я иду домой» = `I'm going home` / `I am going home` / `I'm going to go home`(?). Варианты храним в данных урока.
4. **Опечатки:** Левенштейн ≤ 1 для слов из 4–7 букв, ≤ 2 для 8+. Засчитываем, но **подсвечиваем опечатку**. Исключения, где опечатка меняет смысл: a/an/the, in/on/at, is/are/was, he/she и т.п. Там только точное совпадение.
5. **Разбор ошибки:** показываем diff по словам (лишнее, пропущено, не то слово) и, если ошибка типовая, короткую подсказку: «после he/she/it глагол получает -s».
6. **Голос:** распознанный текст проверяем мягче (распознавание само ошибается). Сравниваем по словам, засчитываем при ≥ 80–85% совпадения, подсвечиваем несовпавшие.
7. Кнопка **«Я был прав»**: пользователь может оспорить проверку, фраза помечается для правки вариантов.

---

## 4. Ловушки для русскоговорящих

Отдельный сквозной модуль. Встраивается в уроки как «⚠️ Ловушка», плюс упражнение «Найди ошибку». Собрано из статьи УрФУ (Nagaev & Panasenkov, 2025), топа-25 от 4lang.ru и топа-10 от ACE.

| Ловушка | Неправильно | Правильно | Тема/ранг |
|---|---|---|---|
| Пропуск to be | I hungry. She doctor. | I'm hungry. She's a doctor. | to be (E) |
| Предлог с home | I go **to** home. ← *твой пример из первого сообщения* | I go home. | E |
| -s в 3-м лице | He live here. | He live**s** here. | Present Simple (E) |
| Отрицание без do | I no speak English. | I don't speak English. | E |
| agree как прилагательное | I'm agree. / Are you agree? | I agree. / Do you agree? | E–D |
| Артикли | The Russia. I have brother. | Russia. I have **a** brother. | E–D |
| Двойное отрицание | I don't know nothing. | I don't know anything. | D |
| didn't + прошедшая форма | I didn't went. | I didn't go. | Past Simple (D) |
| feel myself | I feel myself good. | I feel good. | D |
| wait без for | I'm waiting my friend. | I'm waiting **for** my friend. | D |
| say / tell | Say me. | Tell me. | D |
| interesting / interested | I'm interesting in music. | I'm interested in music. | D |
| do / make mistakes | do a mistake | make a mistake | D |
| Неисчисляемые | advices, informations, moneys | advice, information, money | D |
| people | peoples, this people | people, these people | D |
| Present Perfect vs Past | I saw this film before. | I've seen this film before. | C–B |
| will после if | If it will rain, I… | If it rains, I… | C |
| want that | I want that he comes. | I want him to come. | C |
| Порядок в вопросе | Where you live? | Where do you live? | E–D |
| Косвенный вопрос | Tell me where is the station? | Tell me where the station is. | B |
| Запятая перед that | I think, that… | I think that… | пунктуация |
| very перед глаголом | I very like it. | I like it very much. | D (дополнение из параллельного ресёрча) |
| despite of | Despite of the rain… | Despite the rain… / In spite of the rain… | B (ЛТ-23, M20) |
| сленг в формальном контексте | I'm gonna submit the report… | I'm going to submit the report… | S — регистр (ЛТ-24, M20) |
| ложные друзья EN-RU | This topic is very actual. | This topic is very topical. | B — лексика (ЛТ-25, M20) |
| explain + адресат без to | Explain me this. | Explain this **to** me. | D (ЛТ-26, дополнение из параллельного ресёрча 2026-10-01) |
| предлог с last/next/this | **In** last week I was in Rome. | Last week I was in Rome. | D (ЛТ-27, дополнение из параллельного ресёрча) |
| согласование времён в косвенной речи | She said she **will** come. | She said she **would** come. | B (ЛТ-28, дополнение из параллельного ресёрча) |
| since/for без перфекта | I'm here **since** Monday. | I'**ve been** here since Monday. | C–B (ЛТ-29, дополнение из параллельного ресёрча) |
| to после модального | Can you **to** help me? | Can you help me? | E–D (ЛТ-30, дополнение из параллельного ресёрча) |
| двойная степень сравнения | It's **more** better. | It's **much** better. | C (ЛТ-31, дополнение из параллельного ресёрча) |

---

## 5. Слух: внешние материалы (раздел «Ресурсы» по рангам)

Упражнения на слух в приложении озвучены синтезом речи. Живую речь берём по внешним ссылкам, с привязкой к рангу:

| Ранг | Ресурс | Что это |
|---|---|---|
| E | **English Comprehensible Input for ESL Beginners** (YouTube), **EnglishSponge** A0 | медленная речь с картинками для абсолютных новичков |
| E–D | **Dreaming English** (YouTube) | comprehensible input по уровням |
| E–D | **Бебрис «Английский до автоматизма»** | ссылка на видео по теме текущего урока (маппинг урок → видео) |
| D–C | **Podcasts in English** (beginner, 30 эпизодов; elementary, 200) | короткие подкасты до 5 мин со скриптами |
| C–B | **British Council LearnEnglish Podcasts** (A2–B1) | со скриптами и упражнениями, британский английский |
| C–B | **BBC Learning English** (6 Minute English и др.) | британский английский |
| B+ | Сериалы с английскими субтитрами (начать с Supernatural и Stranger Things: простая речь) | погружение |
| все | **YouGlish**, **PlayPhrase.me**, **Yarn** | как слово/фраза звучит у носителей |

---

## 6. Практика речи без собеседника

1. **Базово (бесплатно, в браузере):** «ответь на вопрос» и диалоги-сценки из разговорника. Реплики собеседника озвучены, твой ответ распознаётся и сверяется с набором допустимых ответов.
2. **Опционально, позже: AI-собеседник.** Исследования 2025 года (Mondly, LLM как партнёр по диалогу): AI-боты **улучшают говорение и снижают страх говорить**.
   - Реализация: ролевая сценка «ты в отеле, я администратор» через Claude API.
   - Ключ API держим на сервере (Supabase Edge Function), в браузер он не попадает.
   - Разговор ограничиваем текущим уровнем: только изученная лексика и грамматика, исправления в конце.
   - Минус: платно (копейки за сессию на дешёвой модели, но нужен API-ключ). Решим, когда дойдём.

---

## 7. Замер прогресса

- **Словарный запас:** после каждых ~500 слов мини-тест по мотивам **Vocabulary Levels Test** (Paul Nation): случайная выборка из пройденных частотных полос. Результат в формате «ты знаешь ~X слов → ~Y% разговорной речи».
- **Врата рангов** (экзамены из 02-research): грамматика + лексика + слух + речь.
- **Внешняя сверка** для интереса: vocabularysize.com (Paul Nation), с уровня B.

---

## 8. Ещё источники цитат

| Источник | Что есть | Для чего |
|---|---|---|
| **Wikiquote** (по сезонам) | Supernatural S1 ~620 строк, Breaking Bad S1 ~285 | основа по сериалам |
| **IMDb → Quotes** (по эпизодам) | цитаты из **английского дубляжа** аниме (например, FMA: *«Humankind cannot gain anything without first giving something in return…»*) | аниме: FMA, AoT, Berserk, JJK, Solo Leveling |
| **Polygon «100 best video game quotes» (2026)** | *«Stay awhile, and listen»*, *«I used to be an adventurer like you. Then I took an arrow in the knee»* и др. | колода «Игры» |
| Мемы | «I'm gonna do what's called a pro gamer move», «This is fine» и т.п. | колода «Мемы» (разговорный язык) |

Только короткие реплики с указанием источника (см. 01-research §8).

---

## 9. Шаблон урока (сводка из частей 1–3)

```
Урок N: <тема>  (ранг, ~15 мин)
 1. Правило        — 1 экран, по-русски, 3–5 примеров, ⚠️ ловушка для русских
 2. Разогрев       — выбери перевод / найди пары (3–5 заданий)
 3. Построение     — 20–30 фраз RU→EN по нарастающей (ввод/word bank/голос)
 4. Слух           — диктант 5 фраз урока
 5. Речь           — shadowing 3–5 фраз + 1–2 «ответь на вопрос»
 6. Из сериала     — 2–3 цитаты на тему урока (cloze + озвучка + ссылка на клип)
 7. В колоду       — новые слова и ключевые фразы уходят в SRS
 → XP, прогресс ранга; каждые ~5 уроков повторение, каждые ~10 контрольная
 → ссылка «Видео по теме» (Бебрис)
```

## Источники (часть 3)

- Anki Manual, deck options (нагрузка, retention, симулятор): https://docs.ankiweb.net/deck-options.html
- Nagaev & Panasenkov, Typical Grammar Mistakes… (УрФУ, 2025): https://elar.urfu.ru/bitstream/10995/143365/1/978-5-91256-740-7_2025_059.pdf
- 4lang.ru, топ-25 ошибок: https://4lang.ru/english/learning/typical-mistakes
- ACE, 10 типичных ошибок: https://www.english-language.ru/articles/tips/10-tipichnyix-oshibok-v-anglijskom-yazyike,-kotoryie-dopuskayut-russki/
- Duolingo exercise types: https://duolingo.fandom.com/wiki/Exercise
- linguado (правила опечаток по Левенштейну): https://github.com/t-recx/linguado/
- AI-боты и говорение (2025): https://ideas.repec.org/a/pal/palcom/v12y2025i1d10.1057_s41599-025-05550-z.html
- Paul Nation, vocabulary tests: https://www.wgtn.ac.nz/lals/resources/paul-nations-resources/vocabulary-tests · https://vocabularysize.com/
- BBC Learning English podcasts: https://www.bbc.co.uk/learningenglish/podcasts
- British Council podcasts: https://learnenglish.britishcouncil.org/general-english/audio-series/podcasts
- Podcasts in English: https://www.podcastsinenglish.com/
- CI Method English A0: https://cimethodenglish.com/en/levels/a0
- IMDb FMA quotes (пример): https://www.imdb.com/title/tt0793867/quotes/
- Polygon, 100 best video game quotes: https://www.polygon.com/best-video-game-quotes/
