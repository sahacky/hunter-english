# Ресёрч, часть 5: цитаты по тайтлам. Сколько их есть и насколько они простые

Проверяю, можно ли собрать короткие англоязычные реплики по каждому любимому тайтлу для колоды «Цитаты» и раздела «Цитаты» в уроках. Смотрю, какие есть источники и какой в них объём, насколько прост язык и с какого ранга (E…S) реплики можно показывать. К каждому тайтлу собраны образцы.

Опирается на: 01-research §6 (слова) и §8 (цитаты), 02-decisions §4 (источники, ранги), 03-methods §8 (источники цитат).
Все образцы (180 шт.) лежат в [`data/quotes-sample.json`](data/quotes-sample.json). 2026-10-01: 20 записям добавлено поле `translation_ru` (слияние по text/title из внешнего ресёрча `study_eng/research/05-universes-quotes.md`); полная база с переводами — [`data/quotes-ru-merged.json`](data/quotes-ru-merged.json) (299 записей, 151 с `translation_ru`).

---

## 0. Как считал

**Данные.** Скачал raw-вики Wikiquote (55 страниц, `action=raw`): все сезоны Supernatural (1–15), GoT (1–8), Breaking Bad (1–5), Stranger Things (1–5), страницы The 100, Black Mirror, три фильма LOTR, восемь фильмов Star Wars, Berserk (anime), FMA (2003), FMA: Brotherhood, Attack on Titan. Страницы Solo Leveling и Jujutsu Kaisen в Wikiquote нет. JJK упоминается только на сборной странице «Fictional last words…».

**Парсер** (`wq.py`) понимает три формата строк:
- `:'''Имя''': текст` (Supernatural, GoT, BB, ST, The 100, BM, FMA);
- `'''Имя:''' текст` (AoT);
- `* текст` под заголовком-персонажем `== Obi-Wan Kenobi ==` (Star Wars, LOTR, раздел манги Berserk).

Номер эпизода берётся из заголовков вида `== ''Pilot'' [1.01] ==`. Вики-разметка, ремарки `[...]`, `(To Clarke)`, `<ref>` и шаблоны вычищаются. Разделы Cast / About / Taglines / External links пропускаются.

**«Пригодная короткая реплика»**: от 3 до 15 слов, не больше 2 предложений, законченная (оканчивается на `.!?`, не обрывается на `--`), и это не голое междометие («Huh?», «Yeah.»).

**Частотность.** Взял два списка:
- **NGSL 1.2** (2 809 лемм, CC). Словоформы брал из `NGSL_12_lemmatized_for_research.csv`, ранг лемм из `NGSL_12_stats.csv`.
- **FrequencyWords en_50k** (субтитры OpenSubtitles 2018, MIT).

Ранг слова считается как лучший из двух. «Топ-1000» значит ранг ≤ 1000 хотя бы в одном списке, «топ-3000» так же с порогом 3000. Имена собственные (слово с заглавной не в начале предложения и имена говорящих) не считаются. Клитики `'s 't 'm 're 've 'll 'd` считаются известными.

**Грубая оценка ранга реплики** = максимум из «ранга по словам» и «ранга по грамматике»:
- по словам: E, если все слова из топ-1000 и в реплике ≤ 8 слов; D, если ≥ 90% слов из топ-1000 и ≤ 15 слов; C, если ≥ 95% слов из топ-3000; иначе B;
- по грамматике (regex-теггер `grammar.py`): to be, Present Simple и повелительное наклонение дают E; can, Present Continuous и have дают D; Past Simple, will, going to, should/must и пассив дают C; Present Perfect и would/if дают B.

Теггер ошибается примерно в 10–20% случаев: не отличает `-ed`-прилагательное от прошедшего времени, путает `'s` = is и has. Для отбора кандидатов этого хватает, для финальной разметки нужна ручная проверка.

Скрипты и сырые данные лежали во временной папке сессии (scratchpad): `wq.py` (парсер и метрики), `grammar.py` (теггер), `build_sample.py` (сборка JSON). Если нужны, их стоит перенести в `tools/quotes/`.

---

## 1. Сводная таблица

«Реплик» означает все распарсенные строки. «Коротких» значит реплик, пригодных по фильтру выше. «Покрытие» — доля слов из топ-1000 и топ-3000 на случайной выборке из 100 коротких реплик (по токенам, без имён). В колонках E / D / C / B+ указано, сколько коротких реплик автоматически попало в каждый ранг.

| Тайтл | Источники | Реплик (коротких) | Покрытие топ-1000 / топ-3000 | E / D / C / B+ (авто) | Ранги | Вердикт |
|---|---|---|---|---|---|---|
| **Supernatural** | Wikiquote, 15 страниц по сезонам | 6 019 (3 168) | 91% / 95% | 772 / 570 / 991 / 835 | **E–S** | ✅ лучший источник: много, просто, разговорно. Сезоны 12–15 почти пустые (30–85 строк) |
| **Game of Thrones** | Wikiquote, 8 сезонов | 5 543 (2 946) | 90% / 97% | 595 / 483 / 1 009 / 859 | **E–S** | ✅ много. Язык «средневековый» (my lord, ser), лексика чуть выше, но коротких простых реплик сотни |
| **Breaking Bad** | Wikiquote, 5 сезонов | 2 841 (1 225) | 93% / 96% | 324 / 242 / 391 / 268 | **E–S** | ✅ самый простой бытовой язык. Главные мемные фразы («I am the one who knocks», «Say my name») сидят внутри длинных монологов, их нужно вырезать фрагментом |
| **Stranger Things** | Wikiquote, 5 сезонов (S1 тонкий) | 1 503 (741) | 92% / 96% | 220 / 129 / 222 / 170 | **E–S** | ✅ подростковый разговорный. Много мата и сленга, нужен фильтр |
| **The 100** | Wikiquote, 1 страница на весь сериал | 291 (164) | 93% / 97% | 44 / 28 / 59 / 33 | E–B | 🟡 мало, но просто. Хватит на 20–30 карточек |
| **Black Mirror** | Wikiquote, 1 страница | 484 (234) | 87% / 93% | 61 / 34 / 73 / 66 | D–S | 🟡 британский разговорный, мат, лексика сложнее. Реплики сильно завязаны на контекст |
| **LOTR (фильмы)** | Wikiquote (3 фильма) + IMDb (~50 цитат на фильм видно без JS) | 619 (309) | 88% / 94% | 59 / 46 / 103 / 101 | D–S | 🟡 архаичный стиль (shall, do not fear). Самых известных строк («You shall not pass», «One does not simply…») **в теле Wikiquote нет**, они есть на IMDb |
| **Star Wars** | Wikiquote (8 фильмов; ещё Clone Wars, Rebels и др. не считал) | 1 233 (696) | 90% / 96% | 157 / 125 / 236 / 178 | **E–S** | ✅ много коротких культовых реплик уровня E («I am your father», «I know») |
| **Berserk** | Wikiquote (манга + аниме 1997) + IMDb (11 цитат) | 309 (96) | 88% / 95% | 21 / 16 / 32 / 27 | D–S | 🟡 мало, тон мрачный, философский. Половина из **перевода манги**, а не из дубляжа |
| **FMA / Brotherhood** | Wikiquote, 2 большие страницы по эпизодам | 4 130 (1 907) | 93% / 97% | 409 / 351 / 624 / 523 | **E–S** | ✅ неожиданно богато. Страница FMA 2003 местами с опечатками (любительская расшифровка), лучше опираться на Brotherhood |
| **Attack on Titan** | Wikiquote (заглушка, 18 реплик), IMDb (~11), фан-сайты | 18 (5) | — | — | D–B | 🔴 мало. Собирать вручную, примерно 20–30 шт. |
| **Jujutsu Kaisen** | Wikiquote нет, IMDb 0; статьи-подборки (Screen Rant, ComicBook ~25 фраз), Fandom (разделы Quotes у части персонажей) | ~25–40 | ~85–90% (оценка по образцам) | — | C–S (единичные D) | 🔴 только ручная курация. Есть разночтения манга / сабы / дубляж |
| **Solo Leveling** | Wikiquote нет, IMDb 0, в Fandom разделов Quotes нет; Screen Rant (~10 фраз) | ~10–20 | — | — | C–B (единичные D) | 🔴 очень мало, реплики короткие («Arise.», «Exchange.»). Годится для геймификации (названия ачивок), колоду не набрать |
| **Игры** | Polygon «100 greatest video game quotes» (2026), Wikiquote: страницы игр (BioShock, Fallout, Portal 2, Undertale, God of War 2018, Mass Effect, RDR2, TLoU и др.) | 100 (Polygon) + сотни на Wikiquote | высокое для культовых фраз | — | E–B | ✅ культовых простых фраз хватает на 30–60 карточек |
| **Мемы** | Know Your Meme (страницы мемов), первоисточники (фильмы, аниме) | десятки | высокое | — | E–C | ✅ 30–50 фраз. Часть с намеренно «сломанной» грамматикой, их даём как «найди ошибку» |

**Главный вывод по простоте.** У всех тайтлов с Wikiquote-страницами **90–93% слов реплик входят в топ-1000**, а 95–97% в топ-3000. Английский в сериалах лексически простой: мешают не слова, а грамматика (Past/Perfect/would), скорость и сленг. Поэтому:
- **ранг E–D (A0–A1).** Есть около **4 700 авто-кандидатов** по всем Wikiquote-тайтлам (E+D коротких), из них ~4 100 в пяти крупнейших (Supernatural, GoT, FMA, BB, ST). После ручного отсева (контекст, мат, бессмысленные обрывки, дубли) реально останется **15–25%**, то есть 700–1 100;
- **ранг C+.** Там основная масса: примерно 60% коротких реплик требуют Past Simple / will / modal или лексики B1.

«Тяжелее» других по лексике LOTR, Black Mirror и Berserk: 86–88% слов в топ-1000. Их реплики E-уровня в основном «служебные» («It's a long way.», «Nothing is certain.»).

---

## 2. По тайтлам

Значки: ⚠ — текст взят не из Wikiquote/Polygon (статья-подборка, IMDb, фан-вики), его нужно сверить с дубляжом или субтитрами. «Фрагмент» означает дословную часть более длинной реплики. Ранг в образцах выставлен вручную с учётом грамматики, в JSON рядом лежит авто-покрытие `auto_vocab.top1000`.

### 2.1 Supernatural

- **Источник:** `https://en.wikiquote.org/wiki/Supernatural_(season_N)`, N = 1…15. Сезоны 1–11 по 500–1 200 строк вики-текста, сезоны 12–15 почти пустые (85 / 41 / 30 / 58 строк).
- **Объём:** 6 019 реплик, 1 494 блока-диалога, 3 168 коротких. Авто-E/D: 1 342.
- **Язык:** бытовой американский разговорный. Короткие реплики, много to be, can, Present Simple и повелительного наклонения. Идеально для E–D. Сленг: dude, gonna, jerk/bitch, idjit. Ругательства: son of a bitch, повторяется десятки раз.
- **Вердикт:** основной тайтл колоды. На старт можно взять 60–100 карточек.

| # | Реплика | Кто · где | Грамматика | Ранг |
|---|---|---|---|---|
| 1 | I can't do this alone. | Dean · S01E01 «Pilot» | can/can't | E |
| 2 | Yes, you can! <br>*ответ на предыдущую реплику* | Sam · S01E01 «Pilot» | can/can't, short answer | E |
| 3 | Yeah... Well, I don't want to. | Dean · S01E01 «Pilot» | Present Simple (negative), want to | E |
| 4 | Sorry, I can't hear you. The music's too loud. | Dean · S01E01 «Pilot» | can/can't, to be, too + adj | D |
| 5 | I want to find Dad. | Sam · S01E08 «Bugs» | want to + verb | E |
| 6 | It doesn't matter what he wants. | Sam · S01E10 «Asylum» | Present Simple (3rd person, negative) | D |
| 7 | Don't test me. | Bobby · S04E21 «When the Levee Breaks» | Imperative (negative) | E |
| 8 | I know. Believe me, I know. | Dean · S08E20 «Pac-Man Fever» | Present Simple, Imperative | E |
| 9 | That's not the point. | Sam · S05E05 «Fallen Idols» | to be (negative) | E |
| 10 | Is he working a job? <br>*job = «дело» охотников (сленг сериала)* | Sam · S04E10 «Heaven and Hell» | Present Continuous (question) | D |
| 11 | I just want you to understand. | Samuel · S06E10 «Caged Heat» | want + object + to | D |
| 12 | You don't mean that. We're--we're family. | Sam · S03E16 «No Rest for the Wicked» | Present Simple (negative), to be | E |
| 13 | Dude, this is sweet! I never get to work jobs like this. <br>*разговорное: dude, sweet* | Dean · S02E11 «Playthings» | to be, Present Simple, adverb never | D |
| 14 | Saving people, hunting things. The family business. <br>*фрагмент: Кроули цитирует девиз братьев; оригинал Дина — S01E02, внутри длинного монолога* | Crowley · S08E22 «Clip Show» | -ing form (gerund), noun phrase | D |

### 2.2 Game of Thrones

- **Источник:** `Game_of_Thrones/Season_1…8`, по 630–1 030 строк на сезон. Эпизоды размечены `[1.01]`.
- **Объём:** 5 543 реплики, 2 946 коротких. Авто-E/D: 1 078.
- **Язык:** слова простые (90% в топ-1000), но много обращений (my lord, Your Grace, ser), имён и мест. Грамматика часто will / shall / must. Знаковые фразы короткие: «Winter is coming» (формально Present Continuous!), «You know nothing, Jon Snow», «Hold the door!», «Not today».
- **Вердикт:** ✅ 50–80 карточек. Удобно для Present Simple и to be.

| # | Реплика | Кто · где | Грамматика | Ранг |
|---|---|---|---|---|
| 1 | He won't be a boy forever. And winter is coming. <br>*«Winter is coming» — отдельная карточка-фрагмент* | Ned Stark · S01E01 «Winter is Coming» | will/won't, Present Continuous (future meaning) | C |
| 2 | You know nothing, Jon Snow. | Ygritte · S02E07 «A Man Without Honor» | Present Simple | E |
| 3 | What do we say to the god of death? <br>*пара с «Not today.»* | Syrio Forel · S01E08 «The Pointy End» | Present Simple (question), wh-question | D |
| 4 | Not today. | Arya Stark · S01E08 «The Pointy End» | short answer | E |
| 5 | Hold the door! | Meera Reed · S06E05 «The Door» | Imperative | E |
| 6 | I'm not a Stark. <br>*фрагмент более длинной реплики* | Jon Snow · S01E01 «Winter is Coming» | to be (negative) | E |
| 7 | My family stays with me. | Stannis Baratheon · S05E09 «The Dance of Dragons» | Present Simple (3rd person -s) | E |
| 8 | Do you love your children? | Cersei Lannister · S01E07 «You Win or You Die» | Present Simple (question) | E |
| 9 | But I'm hungry. | Arya Stark · S03E10 «Mhysa» | to be + adjective | E |
| 10 | There's nothing to forgive. | Jon Snow · S06E04 «Book of the Stranger» | there is | D |
| 11 | What do you want? | Cersei Lannister · S01E05 «The Wolf and the Lion» | wh-question, Present Simple | E |
| 12 | The Lannisters send their regards. <br>*regards — слово уровня B1* | Roose Bolton · S03E09 «The Rains of Castamere» | Present Simple | C |
| 13 | You might be surprised. A Lannister always pays his debts. | Tyrion Lannister · S04E07 «Mockingbird» | might, Present Simple + always | C |

### 2.3 Breaking Bad

- **Источник:** `Breaking_Bad_(season_1…5)`, по 400–1 240 строк.
- **Объём:** 2 841 реплика, 1 225 коротких. Авто-E/D: 566.
- **Язык:** самый высокий процент простых слов (93% в топ-1000). Много бытовых вопросов («How much is this?», «What's your name?», «Why are you here?»): прямая польза для путешествий. Культовые фразы живут внутри длинных монологов, поэтому нужен режим «фрагмент реплики».
- **Вердикт:** ✅ 40–60 карточек.

| # | Реплика | Кто · где | Грамматика | Ранг |
|---|---|---|---|---|
| 1 | That's right. Now... say my name. | Walter · S05E07 «Say My Name» | Imperative, to be | E |
| 2 | I am not in danger, Skyler. I am the danger! <br>*фрагмент длинного монолога* | Walter · S04E06 «Cornered» | to be (negative), articles a/the | D |
| 3 | I am the one who knocks! <br>*фрагмент того же монолога* | Walter · S04E06 «Cornered» | to be, relative clause who | C |
| 4 | We need a plan. | Walter · S02E02 «Grilled» | Present Simple, need | E |
| 5 | It's over. We're safe. | Walter · S04E13 «Face Off» | to be | E |
| 6 | I won. | Walter · S04E13 «Face Off» | Past Simple (irregular) | C |
| 7 | I did it for me. I liked it. I was good at it. <br>*фрагмент реплики* | Walter · S05E16 «Felina» | Past Simple, was | C |
| 8 | You're damn right. <br>*грубоватое: damn* | Walter · S02E07 «Negro Y Azul» | to be | E |
| 9 | Don't touch them! | Walter · S02E01 «Seven-Thirty-Seven» | Imperative (negative) | E |
| 10 | I want you to handle it. | Walter · S02E05 «Breakage» | want + object + to | D |
| 11 | What's your name? <br>*полезно для путешествий* | Tuco · S01E06 «Crazy Handful of Nothin» | wh-question, to be | E |
| 12 | Why are you here? | Jesse · S01E01 «Pilot» | wh-question, to be | E |
| 13 | How much is this? <br>*фраза путешественника* | Walter · S05E08 «Gliding Over All» | How much, to be | E |
| 14 | Yes, I have it. | Lydia · S05E08 «Gliding Over All» | have | E |

### 2.4 Stranger Things

- **Источник:** `Stranger_Things/Season_1…5`. S1 тонкий (172 строки), S2 и S5 богаче.
- **Объём:** 1 503 реплики, 741 короткая. Авто-E/D: 349.
- **Язык:** подростковый американский 80-х. Очень простые вопросы («What are you doing?», «What is your problem?»), много shit / ass / bitchin', обрывов и крика капсом. Одиннадцатая говорит ломаным английским («You lie. Why do you lie?»), для A0 это даже удобно.
- **Вердикт:** ✅ 30–50 карточек, обязательно с фильтром мата.

| # | Реплика | Кто · где | Грамматика | Ранг |
|---|---|---|---|---|
| 1 | Friends don't lie. <br>*фрагмент реплики* | Lucas · S02E05 «Chapter Five: Dig Dug» | Present Simple (negative) | E |
| 2 | SHE'S OUR FRIEND AND SHE'S CRAZY! <br>*фрагмент; в источнике капсом* | Dustin · S01E06 «Chapter Six: The Monster» | to be, possessive our | E |
| 3 | I love you, Jonathan Byers. | Nancy · S05E06 «Chapter Six: Escape from Camazotz» | Present Simple | E |
| 4 | It's not that bad. | Max · S02E02 «Chapter Two: Trick or Treat, Freak» | to be (negative) | E |
| 5 | I... I don't understand. <br>*фраза путешественника* | Becky Ives · S02E05 «Chapter Five: Dig Dug» | Present Simple (negative) | E |
| 6 | You don't believe me. | Lucas · S02E05 «Chapter Five: Dig Dug» | Present Simple (negative) | E |
| 7 | What are you doing here? | Eddie · S04E02 «Chapter Two: Vecna's Curse» | Present Continuous (question) | D |
| 8 | Please don't leave me, El. Please don't do this. | Mike · S05E08 «Chapter Eight: The Rightside Up» | Imperative (negative), please | E |
| 9 | I want to hear it. | Suzie · S03E08 «Chapter Eight: The Battle of Starcourt» | want to | E |
| 10 | What is your problem?! | Joyce · S03E05 «Chapter Five: The Flayed» | wh-question, to be | E |
| 11 | You lie. Why do you lie? I dump your ass! <br>*грубое: ass; ломаный английский Одиннадцатой* | Eleven · S03E02 «Chapter Two: The Mall Rats» | Present Simple, question with do | D |
| 12 | And I’m not a kid anymore. <br>*фрагмент реплики* | Will · S05E03 «Chapter Three: The Turnbow Trap» | to be (negative), anymore | E |

### 2.5 The 100

- **Источник:** одна страница `The_100_(TV_series)`, внутри все сезоны с эпизодами.
- **Объём:** 291 реплика, 164 короткие. Авто-E/D: 72.
- **Язык:** простой (93% в топ-1000), но цитат мало. Есть ритуальная фраза «May we meet again», её удобно дать отдельной карточкой (may как пожелание).
- **Вердикт:** 🟡 20–30 карточек.

| # | Реплика | Кто · где | Грамматика | Ранг |
|---|---|---|---|---|
| 1 | We're back, Bitches! <br>*грубое* | Octavia Blake · S01E01 «Pilot» | to be | E |
| 2 | May we meet again. <br>*ритуальная фраза сериала* | Clarke Griffin and Bellamy Blake · S05E13 «Damocles, Part 2» | may (wish) | D |
| 3 | We're not alone. | Clarke Griffin · S01E01 «Pilot» | to be (negative) | E |
| 4 | This is Earth. Everything's Toxic. | Finn Collins · S01E03 «Earth Kills» | to be, everything + is | D |
| 5 | I trust him, Clarke. | Octavia Blake · S01E09 «Unity Day» | Present Simple | E |
| 6 | Your fight is over. | Octavia Blake · S04E10 «Die All, Die Merrily» | to be | E |
| 7 | I'm the Commander. No one fights for me. | Lexa · S03E04 «Watch the Thrones» | to be, Present Simple (3rd person) | E |
| 8 | I'm just trying to keep us alive. | Clarke Griffin · S01E09 «Unity Day» | Present Continuous | D |
| 9 | Earth, Clarke. You get to go to Earth. | Abigail Griffin · S01E01 «Pilot» | Present Simple, get to | D |
| 10 | They dropped us on the wrong damn mountain. <br>*грубоватое: damn* | Clarke Griffin · S01E01 «Pilot» | Past Simple | C |
| 11 | My sister... my responsibility. | Bellamy Blake · S02E16 «Blood Must Have Blood, Part 2» | possessive my | D |

### 2.6 Black Mirror

- **Источник:** одна страница `Black_Mirror`, внутри эпизоды `[S.EE]`.
- **Объём:** 484 реплики, 234 короткие. Авто-E/D: 95.
- **Язык:** британский, с матом («Fuck you next Wednesday!» и т.п.). Лексика сложнее (87% в топ-1000): humiliation, clockage, merits. Реплики сильно зависят от контекста серии.
- **Вердикт:** 🟡 15–25 карточек, в основном D–C.

| # | Реплика | Кто · где | Грамматика | Ранг |
|---|---|---|---|---|
| 1 | It's not stuff. It's truth. | Bing · S01E02 «Fifteen Million Merits» | to be | E |
| 2 | I'm sorry, I can't help you. | Martin · S01E01 «The National Anthem» | can/can't, to be | E |
| 3 | You don't know that. | Michael · S01E01 «The National Anthem» | Present Simple (negative) | E |
| 4 | Everything happens for a reason. | Coach · S04E04 «Hang the DJ» | Present Simple (3rd person -s) | D |
| 5 | It doesn't work like that. | Gwendolyn · S02E03 «The Waldo Moment» | Present Simple (3rd person, negative) | E |
| 6 | Is that a problem? | Cooper · S03E02 «Playtest» | to be (question) | E |
| 7 | Maybe you're old. | Blue · S03E06 «Hated in the Nation» | to be | E |
| 8 | I can't believe there's two of you! <br>*разговорное there's two (норма: there are)* | Rachel · S04E06 «Black Museum» | can't believe, there is | D |
| 9 | You can make friends with people. | DCI Kano · S04E06 «Black Museum» | can | E |
| 10 | Yeah, well, you aren't you, are you? | Martha · S02E01 «Be Right Back» | to be, tag question | C |
| 11 | I know people. We love humiliation. We can't not laugh. <br>*humiliation — B2* | Jane · S01E01 «The National Anthem» | Present Simple, can't | C |

### 2.7 The Lord of the Rings (фильмы)

- **Источники:**
  - Wikiquote: `The_Lord_of_the_Rings:_The_Fellowship_of_the_Ring`, `…_The_Two_Towers`, `…_The_Return_of_the_King`. Формат смешанный: `*` под персонажем плюс диалоги;
  - IMDb Quotes по фильмам (tt0120737 и др.): через r.jina.ai видно ~50 цитат на фильм. Там есть «You shall not pass!» и «One does not simply walk into Mordor…», которых нет в теле Wikiquote (первая есть только в подписи к картинке).
- **Объём:** 619 реплик, 309 коротких. Авто-E/D: 105.
- **Язык:** архаичный и возвышенный (shall, do not fear, bow to no one). Лексика самая «книжная» из всех (86–88% в топ-1000). Зато много коротких реплик с can / cannot и to be.
- **Вердикт:** 🟡 20–30 карточек, в основном D–C. Хорош для «красивых» цитат дня.

| # | Реплика | Кто · где | Грамматика | Ранг |
|---|---|---|---|---|
| 1 | Fly, you fools! | Gandalf the Grey · The Fellowship of the Ring | Imperative | D |
| 2 | I will take the Ring to Mordor. Though... I do not know the way. | Frodo · The Fellowship of the Ring | will, Present Simple (negative) | C |
| 3 | We had one, yes. What about second breakfast? | Pippin · The Fellowship of the Ring | Past Simple (had), What about...? | C |
| 4 | Sam... I'm glad you're with me. | Frodo · The Fellowship of the Ring | to be + adjective | E |
| 5 | I cannot do this alone. <br>*перекличка с Supernatural S01E01* | Frodo · The Fellowship of the Ring | can/cannot | E |
| 6 | I can't carry it for you...BUT I CAN CARRY YOU! <br>*фрагмент реплики* | Samwise · The Return of the King | can/can't | D |
| 7 | I do not fear death. | Aragorn · The Return of the King | Present Simple (negative) | D |
| 8 | Even the smallest person can change the course of the future. | Galadriel · The Fellowship of the Ring | can, superlative | C |
| 9 | Nothing is certain. | Elrond · The Return of the King | to be | D |
| 10 | My friends...you bow to no one. | Aragorn · The Return of the King | Present Simple | D |
| 11 | It's a long way. <br>*фраза путешественника* | Aragorn · The Two Towers | to be | E |
| 12 | I'm on your side, Mr. Frodo. | Samwise · The Return of the King | to be, prepositions | E |
| 13 | I'm glad to be with you, Samwise Gamgee, here at the end of all things. | Frodo · The Return of the King | to be + adjective, to-infinitive | C |

### 2.8 Star Wars

- **Источник:** Wikiquote по фильмам: `Star_Wars_(film)`, `The_Empire_Strikes_Back`, `Return_of_the_Jedi`, эпизоды I–III, VII–VIII. Формат `*` под персонажем. Есть ещё страницы Clone Wars по сезонам, Rebels, Rogue One, Mandalorian и др., их не считал.
- **Объём:** 1 233 реплики, 696 коротких. Авто-E/D: 282.
- **Язык:** короткие культовые фразы уровня E («I am your father», «I love you. — I know.», «It's a trap!»). У Йоды «перевёрнутый» порядок слов («Rest, I need.»), такие лучше не давать новичку как образец или помечать.
- **Вердикт:** ✅ 30–50 карточек.

| # | Реплика | Кто · где | Грамматика | Ранг |
|---|---|---|---|---|
| 1 | May the Force be with you. | Han Solo · Star Wars (1977) | may (wish) | D |
| 2 | No. I am your father. | Vader · The Empire Strikes Back | to be | E |
| 3 | I love you. <br>*пара с «I know.»* | Leia · The Empire Strikes Back | Present Simple | E |
| 4 | I know. | Han · The Empire Strikes Back | Present Simple | E |
| 5 | No! Try not. Do... or do not. There is no try. | Yoda · The Empire Strikes Back | Imperative, there is | D |
| 6 | I have a very bad feeling about this. <br>*повторяется во всех фильмах* | Luke Skywalker · Star Wars (1977) | have | D |
| 7 | Use the Force, Luke. | Obi-Wan Kenobi · Star Wars (1977) | Imperative | E |
| 8 | The Force is strong with this one. | Darth Vader · Star Wars (1977) | to be | E |
| 9 | That is why you fail. | Yoda · The Empire Strikes Back | Present Simple, that is why | D |
| 10 | It's a trap! <br>*мем* | Ackbar · Return of the Jedi | to be, article a | D |
| 11 | That boy is our last hope. | Obi-Wan · The Empire Strikes Back | to be | E |
| 12 | He's my father. | Luke · Return of the Jedi | to be | E |
| 13 | Never tell me the odds! <br>*odds — B2* | Han · The Empire Strikes Back | Imperative (never) | C |
| 14 | Search your feelings. You know it to be true. | Vader · The Empire Strikes Back | Imperative, Present Simple | C |

### 2.9 Berserk

- **Источники:**
  - Wikiquote `Berserk_(anime)`: две части. «Quotes From Manga» — перевод манги, персонажи Guts, Griffith и др. «Quotes From 1997 Anime» — по сериям, английский дубляж/сабы;
  - IMDb tt0318871: 11 цитат (аниме 1997).
- **Объём:** 309 реплик, из них коротких только 96. Авто-E/D: 37.
- **Язык:** мрачно-философский. Много would rather, if-clauses и абстрактной лексики (providence, forsake, atone). Короткие простые реплики в основном в боевых и бытовых сценах аниме.
- **Вердикт:** 🟡 15–20 карточек. Ранг D–B, для E почти ничего нет.

| # | Реплика | Кто · где | Грамматика | Ранг |
|---|---|---|---|---|
| 1 | Do whatever you want now. But if you disturb me, I'll kill you. <br>*перевод манги, не дубляж* | Guts · Wikiquote, раздел манги | Imperative, First Conditional | B |
| 2 | I'd rather fight for my life than live it. <br>*раздел манги* | Guts · раздел манги | would rather | B |
| 3 | In the end the winner is still the last man standing. <br>*раздел манги* | Guts · раздел манги | to be, last | C |
| 4 | When you meet your God, tell him to leave me alone. <br>*раздел манги* | Guts · раздел манги | Imperative, when-clause | C |
| 5 | A dream... It's something you do for yourself, not for others. <br>*раздел манги* | Griffith · раздел манги | to be, Present Simple | D |
| 6 | Alright! Let's have a drink. | Guts · аниме 1997 «Bonfire of Dreams» | Let's | E |
| 7 | From now on, he is a member of the Hawks! | Griffith · аниме 1997 «First Battle» | to be | D |
| 8 | You know nothing about women! | Casca · аниме 1997 «Prepared For Death» | Present Simple | E |
| 9 | Casca! It's me. Guts! | Guts · аниме 1997 «The Advent» | to be | E |
| 10 | Who the hell are you? <br>*грубоватое: the hell* | Guts · аниме 1997 «The Advent» | wh-question, to be | E |
| 11 | What kind of a man is he? — Griffith? I don't know. ⚠ <br>*мини-диалог из двух реплик, IMDb* | Guts / Judeau · аниме 1997 | wh-question, Present Simple (negative) | E |
| 12 | Every sword belongs in its sheath. ⚠ <br>*фрагмент реплики, IMDb; sheath — редкое слово* | Guts · аниме 1997 | Present Simple (3rd person -s) | C |

### 2.10 Fullmetal Alchemist / Brotherhood

- **Источники:**
  - Wikiquote `Fullmetal_Alchemist_(anime)` (2003) и `Fullmetal_Alchemist:_Brotherhood_(anime)`: огромные страницы (~220 КБ каждая), по эпизодам `[1.01]…[1.64]`, текст англ. дубляжа;
  - IMDb по эпизодам: на уровне тайтла (tt1355642) цитат 0, возможно, есть у отдельных эпизодов (не проверял).
- **Объём:** 4 130 реплик, 1 907 коротких. Авто-E/D: 760. Правда, ~150 из них это «Brother!» / «Brother...» Альфонса, фильтр по уникальности обязателен.
- **Язык:** простой (93% в топ-1000). Много коротких эмоциональных реплик и повелительного наклонения. Ключевые термины (equivalent exchange, alchemy, transmutation) уровня B2, их учим как «слова вселенной». На странице FMA 2003 встречаются опечатки расшифровки («of we don't help each other», «eh same person»), такие реплики не брать.
- **Вердикт:** ✅ 40–60 карточек, лучше из Brotherhood.

| # | Реплика | Кто · где | Грамматика | Ранг |
|---|---|---|---|---|
| 1 | Humankind cannot gain anything without first giving something in return. <br>*фрагмент вступления (FMA 2003 и Brotherhood)* | Alphonse · вступление | can/cannot, without + -ing | C |
| 2 | DON'T CALL ME LITTLE! <br>*фрагмент; в источнике капсом* | Edward · Brotherhood S01E01 «Fullmetal Alchemist» | Imperative (negative) | E |
| 3 | I'm his younger brother, Alphonse. <br>*фрагмент* | Alphonse Elric · Brotherhood S01E01 | to be, comparative younger | E |
| 4 | Stand up and walk. Keep moving forward. You've got two good legs. <br>*фрагмент* | Edward · Brotherhood S01E03 «City of Heresy» | Imperative, have got | D |
| 5 | Brother, you don't understand. | Alphonse · FMA 2003 E47 «Sealing the Homunculus» | Present Simple (negative) | E |
| 6 | I'm sorry, brother. | Alphonse · Brotherhood E20 «Father Before the Grave» | to be | E |
| 7 | Brother, I could never... I could never hate you! | Alphonse · FMA 2003 E24 «Bonding Memories» | could | C |
| 8 | Is it from my brother? Is he okay? | Alphonse · FMA 2003 E41 «Holy Mother» | to be (question) | E |
| 9 | Equivalent exchange! <br>*ключевой термин (B2-лексика)* | Edward · Brotherhood E64 «Journey's End» | noun phrase | C |
| 10 | What a nasty thing to do. | Edward · Brotherhood E01 | What a ...! | D |
| 11 | Water freezes, water boils. Either way, you're just as dead. <br>*фрагмент* | Isaac · Brotherhood E01 | Present Simple (3rd person -s) | C |
| 12 | Brother, please do something. | Alphonse · FMA 2003 E42 «His Name is Unknown» | Imperative, please | E |

### 2.11 Attack on Titan

- **Источники:**
  - Wikiquote `Attack_on_Titan`: заглушка (tv-stub), 18 реплик. Разделы по аркам манги/аниме, неясно, перевод манги это или дубляж;
  - IMDb tt2560140: ~11 цитат, из них 3 «Theme Song», это **текст песни, не брать**;
  - фан-сайты (attackontitan.nl/en/quotes): тематические подборки, но формулировки похожи на пересказ. Например, «Devote your heart» вместо дубляжного «Dedicate your hearts!». Как первоисточник не годится, только как список «что искать»;
  - Fandom: разделов Quotes у персонажей нет.
- **Язык:** короткие лозунги («Fight!», «Give up on your dreams and die!»), лексика простая.
- **Вердикт:** 🔴 ручная сборка 20–30 реплик: сверка по субтитрам Crunchyroll/дубляжу, для проверки звучания PlayPhrase/Yarn.

| # | Реплика | Кто · где | Грамматика | Ранг |
|---|---|---|---|---|
| 1 | Give up on your dreams and die! | Levi, to Erwin · Wikiquote, «Return to Shiganshina» | Imperative, phrasal verb give up | D |
| 2 | Someone who can't sacrifice anything, can't ever change anything. | Armin · Wikiquote | can/can't, relative clause who | C |
| 3 | Because I was born into this world! | Eren · Wikiquote | was born | C |
| 4 | Sorry, that was a strange thing to ask. | Erwin · Wikiquote, «Female Titan» | Past Simple (was) | C |
| 5 | Who’s the real enemy here? | Erwin · Wikiquote, «Female Titan» | wh-question, to be | D |
| 6 | I just keep moving forward. Until I destroy my enemies. ⚠ | Eren Jaeger · IMDb | Present Simple, until-clause | D |
| 7 | This world is cruel... But it's also very beautiful. ⚠ | Mikasa Ackermann · IMDb | to be, adverbs also/very | D |
| 8 | Fight! ⚠ <br>*«Tatakae» в англ. версии* | Eren Jaeger · IMDb | Imperative | E |
| 9 | May I please have some of that Potato? ⚠ <br>*сцена Саши с картошкой; вежливая просьба, полезно в кафе* | «Soldier» · IMDb | May I...? (polite request) | D |
| 10 | You're a disease! ⚠ | Eren Jaeger · IMDb | to be, article a | E |
| 11 | I'll stay alive to keep his memory alive. ⚠ | Eren Jaeger · IMDb | will, to-infinitive of purpose | C |

### 2.12 Jujutsu Kaisen

- **Источники:** Wikiquote нет, IMDb tt12343534 — 0 цитат. Есть подборки: Screen Rant «15 Best JJK Quotes» и «20 Greatest Gojo Quotes», ComicBook «10 Best JJK Quotes», jujutsu-kaisen.fandom.com (раздел Quotes есть у части персонажей, например у Yuji Itadori 7 цитат со ссылками на главу и эпизод; у Gojo, Nanami, Megumi, Sukuna нет).
- **Проблема:** цитаты ходят в трёх переводах: официальный перевод манги Viz, субтитры Crunchyroll и английский дубляж. Самый известный мем «Nah, I'd win» имеет, по Know Your Meme, «запутанную историю перевода».
- **Язык:** короткие мемные фразы простые («We're the strongest.», «What kind of woman is your type?»). Пафосные длинные (Heaven and Earth…, про Six Eyes) тянут на B.
- **Вердикт:** 🔴 ручная курация 20–30 штук с пометкой «версия перевода». Для A0 подходят единицы.

| # | Реплика | Кто · где | Грамматика | Ранг |
|---|---|---|---|---|
| 1 | Nah, I'd win. ⚠ <br>*мем; спорная история перевода (KYM)* | Satoru Gojo · манга, гл. 221 | would ('d) | C |
| 2 | Throughout Heaven and Earth, I alone am the honored one. ⚠ | Satoru Gojo · аниме S2 | to be | B |
| 3 | Love is the most twisted curse of all. ⚠ | Satoru Gojo · Jujutsu Kaisen 0 | to be, superlative | C |
| 4 | You cryin'? ⚠ <br>*англ. дубляж по ComicBook; разговорное опущение are* | Satoru Gojo · аниме S2E1 «Hidden Inventory» | Present Continuous (разговорный) | D |
| 5 | We're the strongest. ⚠ | Satoru Gojo · аниме S2 | to be, superlative | E |
| 6 | What kind of woman is your type? ⚠ | Aoi Todo | wh-question, to be | D |
| 7 | Being a child is not a sin. ⚠ | Kento Nanami | -ing subject, to be (negative) | C |
| 8 | Itadori, you've got it from here. ⚠ | Kento Nanami · аниме S2 (Шибуя) | have got | C |
| 9 | Smart people usually don't brag about being smart. ⚠ <br>*Fandom, перевод манги* | Yuji Itadori · гл. 87 / эп. 32 | Present Simple (negative), usually, about + -ing | C |

### 2.13 Solo Leveling

- **Источники:** Wikiquote нет. IMDb tt21209876 — 0 цитат. В Fandom (solo-leveling.fandom.com) разделов Quotes нет. Остаются Screen Rant «Jinwoo's 10 Best Quotes» и ACDB (страница Jinwoo, текст через Jina не извлёкся). Реплики Системы («Daily Quest», «You have become a Player») в источниках с проверяемым текстом не нашёл, в образцы не включал.
- **Язык:** фразы очень короткие («Arise.», «Exchange.», «On to the next target.»), но слова не бытовые.
- **Вердикт:** 🔴 колоду не собрать. Зато тайтл отлично ложится на **геймификацию**: ранги E…S, «Врата», «Daily Quest», ачивки «Arise», «I alone level up». Это наши собственные названия, а не цитаты, так что юридических рисков нет. Для колоды 10–15 фраз после сверки с дубляжом.

Регистр ниже нормализован: в статье заголовки набраны Title Case.

| # | Реплика | Кто · где | Грамматика | Ранг |
|---|---|---|---|---|
| 1 | Arise. ⚠ <br>*arise — книжное слово, но ключевое для фанатов* | Sung Jinwoo · фирменная фраза | Imperative | C |
| 2 | I've been leveling up this whole time. ⚠ | Sung Jinwoo | Present Perfect Continuous | B |
| 3 | On to the next target. ⚠ | Sung Jinwoo · S2, финал | prepositional phrase | D |
| 4 | Fancy that. A talking bug. ⚠ | Sung Jinwoo · S2, Чеджу | -ing adjective | C |
| 5 | Because it's only the strong who survive! ⚠ | Sung Jinwoo | to be, the + adjective, who | C |
| 6 | I'm borrowing this girl. ⚠ | Sung Jinwoo · S2 | Present Continuous | D |
| 7 | Is it OK if I take all of these magic beasts? ⚠ <br>*полезная конструкция для путешествий* | Sung Jinwoo · S2, красные врата | Is it OK if...? (permission) | D |
| 8 | I don't even need to get angry to kill filth like you. ⚠ | Sung Jinwoo · S1 | Present Simple (negative), to-infinitive | C |

### 2.14 Колода «Игры»

- **Источники:** Polygon «The 100 greatest video game quotes of all time» (обновлён в 2026, у каждой фразы указаны игра и персонаж). На Wikiquote есть страницы многих игр: BioShock (40 КБ), Fallout (44 КБ), Portal 2 (34 КБ), Undertale (43 КБ), God of War 2018 (39 КБ), The Last of Us (16 КБ), Mass Effect, RDR2, Dark Souls, Witcher 3, Skyrim (маленькие). Страницы Portal (1) нет.
- **Язык:** культовые фразы короткие и императивные: «Hey! Listen!», «Get over here!», «Stay awhile, and listen.», «Don't be sorry. Be better.» Отлично подходят для E–D.
- **Вердикт:** ✅ 30–60 карточек. «All your base are belong to us» — классический пример **сломанной** грамматики, даём как упражнение «найди ошибку».

| # | Реплика | Кто · где | Грамматика | Ранг |
|---|---|---|---|---|
| 1 | It's dangerous to go alone! Take this. | старик · The Legend of Zelda (1986) | to be + adj + to-infinitive, Imperative | D |
| 2 | Stay awhile, and listen. | Deckard Cain · Diablo (1996) | Imperative | D |
| 3 | I used to be an adventurer like you. Then I took an arrow in the knee. | стражники · Skyrim (2011) | used to, Past Simple | C |
| 4 | The cake is a lie. | надпись на стене · Portal (2007) | to be | D |
| 5 | Thank you Mario! But our princess is in another castle! | Toad · Super Mario Bros. (1985) | to be, preposition in | D |
| 6 | Don't be sorry. Be better. | Kratos · God of War (2018) | Imperative (be), comparative | E |
| 7 | Ah shit, here we go again. <br>*грубое: shit* | CJ · GTA: San Andreas (2004) | here we go | E |
| 8 | Despite everything, it's still you. | Undertale (2015) | to be, despite | C |
| 9 | War. War never changes. | рассказчик · Fallout | Present Simple (3rd person -s), never | D |
| 10 | Praise the sun! <br>*praise — B1* | Solaire · Dark Souls (2011) | Imperative | C |
| 11 | Hey! Listen! | Navi · Zelda: Ocarina of Time (1998) | Imperative | E |
| 12 | Do a barrel roll! | Peppy · Star Fox 64 (1997) | Imperative | C |
| 13 | Get over here! | Scorpion · Mortal Kombat (1992) | Imperative, phrasal verb | E |
| 14 | You died. | экран смерти · Souls-серия | Past Simple | C |
| 15 | You have died of dysentery. | The Oregon Trail | Present Perfect | B |
| 16 | Hi! I like shorts! They're comfy and easy to wear! | Youngster · Pokémon | Present Simple, adj + to-infinitive | D |

### 2.15 Колода «Мемы»

- **Источники:** Know Your Meme. Проверил, что страницы существуют: this-is-fine, one-does-not-simply-walk-into-mordor, im-gonna-do-whats-called-a-pro-gamer-move, how-do-you-do-fellow-kids, is-this-a-pigeon, people-die-if-they-are-killed, nah-id-win. Ещё первоисточники: IMDb, Wikiquote, Polygon.
- **Аниме-мемы на английском:** «Is this a pigeon?», «People die if they are killed» (Fate/stay night), «Nah, I'd win» (JJK). Японские («Omae wa mou shindeiru», «Nani?!») для колоды английского не годятся.
- **Вердикт:** ✅ 30–50 фраз. Хороши для разговорного слоя (gonna, fellow kids). Картинки мемов в репо **не кладём**, только текст и ссылку.

| # | Реплика | Кто · где | Грамматика | Ранг |
|---|---|---|---|---|
| 1 | This is fine. | собака · веб-комикс Gunshow (K.C. Green) | to be | E |
| 2 | One does not simply walk into Mordor. <br>*в теле Wikiquote нет, есть на IMDb (фрагмент реплики Боромира)* | Boromir · LOTR: FotR | Present Simple (negative, 3rd person) | C |
| 3 | I'm gonna do what's called a pro gamer move. <br>*разговорное gonna* | мем (KYM) | going to (gonna) | C |
| 4 | How do you do, fellow kids? | Steve Buscemi · 30 Rock | How do you do (формула) | D |
| 5 | Is this a pigeon? <br>*аниме-мем* | The Brave Fighter of Sun Fighbird | to be (question) | E |
| 6 | People die if they are killed. ⚠ <br>*аниме-мем; точную формулировку в переводе уточнить* | Shirou Emiya · Fate/stay night | Zero Conditional, Passive | B |
| 7 | Nah, I'd win. ⚠ <br>*аниме-мем, дублирует JJK* | Satoru Gojo · JJK, гл. 221 | would ('d) | C |
| 8 | It's over, Anakin! I have the high ground! <br>*в Wikiquote капсом с «!!!!», регистр нормализован* | Obi-Wan · Star Wars: Episode III | to be, have | D |
| 9 | All your base are belong to us. <br>*анти-пример: «найди ошибку»* | CATS · Zero Wing (1991) | сломанная грамматика | C |
| 10 | Press 'F' to pay respects. | Call of Duty: Advanced Warfare (2014) | Imperative, to-infinitive of purpose | C |

---

## 3. Юридическое

| Что | Риск | Как делаем |
|---|---|---|
| Короткие реплики (1–2 предложения) со ссылкой на тайтл и эпизод | низкий | Fair use (США) и ст. 1274 ГК РФ: цитирование в учебных целях «в объёме, оправданном целью цитирования» с указанием автора и источника. Всегда пишем тайтл, сезон/эпизод и ссылку на страницу Wikiquote/IMDb |
| Много цитат из одного произведения (Supernatural 100+, FMA 60+) | средний | Ограничиваем: **не больше ~40–60 на тайтл в публичном репо** и не больше ~5 на эпизод. Берём разрозненные реплики, а не целые сцены |
| Целые диалоги/сцены подряд | средний-высокий | Максимум обмен из 2–3 реплик («I love you. — I know.») |
| Wikiquote как подборка | низкий | Текст Wikiquote распространяется по CC BY-SA, но **сами реплики принадлежат правообладателям**, лицензия их «не отмывает». Wikiquote указываем как источник подборки (атрибуция), массово страницы не копируем |
| IMDb | средний (ToS) | Conditions of Use IMDb запрещают автоматический сбор (scraping / data mining). Используем **только вручную** как справочник для сверки, парсер на IMDb не пишем |
| Статьи Screen Rant / ComicBook / Polygon | низкий, если брать только саму цитату | Комментарии и тексты статей не копируем, берём только реплику. Ссылка на статью нужна как «где нашли», первоисточником указываем игру или тайтл |
| Fandom-вики | низкий | Текст по CC BY-SA. Цитаты — тот же случай, что и с Wikiquote |
| **Тексты песен** (OP/ED аниме, «Theme Song» на IMDb AoT) | **высокий** | Не берём вообще: музыкальные издатели активно защищают тексты |
| Картинки мемов, скриншоты, аудио/видео-клипы | **высокий** | В репо не кладём. Озвучка синтезом, «послушать в оригинале» даём ссылкой на PlayPhrase/Yarn/YouGlish (см. 01-research §8) |
| Мат и оскорбления | не юридический, а продуктовый | Флаг `profanity` и фильтр в настройках, по умолчанию скрываем самое грубое |

---

## 4. Пайплайн сбора (рекомендация)

**Шаг 1. Выгрузка.** Скрипт тянет raw-вики со страниц Wikiquote по списку `titles.yaml` (тайтл → список страниц: сезоны, фильмы):
- `https://en.wikiquote.org/w/index.php?title=PAGE&action=raw`;
- пауза ~1 с между запросами и свой User-Agent;
- кэш в `data/raw/` (в .gitignore);
- обновление раз в несколько месяцев.

Найти страницы можно через `w/api.php?action=query&list=search&srsearch=intitle:...`.

**Шаг 2. Парсинг** в формат `{title, page, episode, speaker, text, block_id}`:
- понимает три формата строк (`:'''X''':`, `'''X:'''`, `* ` под заголовком-персонажем);
- эпизод берёт из заголовка `[S.EE]`;
- чистит ссылки `[[w:..|..]]`, `''`, `'''`, `<ref>`, `{{…}}`, ремарки `[…]`, `(To X)`;
- `block_id` (разделитель `<hr>` или пустая строка) нужен, чтобы брать пары реплик «вопрос — ответ».

**Шаг 3. Нарезка фрагментов.** Длинную реплику режем на предложения. Кандидатом становится каждое предложение или пара соседних предложений ≤ 15 слов. Так вытаскиваются «Say my name.», «I am the one who knocks!» и «Friends don't lie.» из монологов. В карточке помечаем `fragment: true`.

**Шаг 4. Фильтры (автоматика):**
- длина 3–15 слов, ≤ 2 предложений, законченная пунктуация, без `--` в конце, не голое междометие;
- дедупликация по нормализованному тексту: «Brother!» ×150, «Son of a bitch!» ×20;
- флаг `profanity` по словарю (fuck, shit, bitch, ass, damn, hell…);
- **покрытие словаря:** доля слов из NGSL и частотного списка (ранги 1000 / 3000). Лемматизацию лучше делать через spaCy/simplemma, а не через таблицу форм;
- **грамматический теггер:** для прототипа хватит regex (как в `grammar.py`), для продакшена spaCy (`tag_`/`morph`: VBD = Past Simple, have + VBN = Perfect, MD = модальные, be + VBG = Continuous, be + VBN = пассив). Выход: `grammar_tags` и `min_rank`;
- `est_rank = max(ранг_по_словам, ранг_по_грамматике)`;
- **персональный фильтр в приложении:** показываем цитату, только если пользователь знает ≥ 90% её слов (правило из 02-decisions §4).

**Шаг 5. Ручная курация** (без неё никак: ~75–85% авто-кандидатов отваливаются):
- понятна ли реплика без контекста серии;
- интересна ли она или узнаваема фанатом;
- нет ли спойлера (особенно AoT, GoT, BB) — флаг `spoiler: true` и сезон;
- нет ли опечатки расшифровки (FMA 2003) — сверка с PlayPhrase/Yarn или субтитрами;
- русский перевод и 1 строка «что тут за грамматика».

Удобный интерфейс для этого: CSV/таблица с колонками «взять / не брать / фрагмент» или маленькая админка. На кандидата уходит ~10–15 секунд, 1 000 кандидатов — это примерно 3–4 часа.

**Шаг 6. Аниме и игры без Wikiquote** (AoT, JJK, Solo Leveling, часть мемов): ручной список «что искать» (из подборок Screen Rant, Polygon, KYM), затем сверка точного текста по дубляжу/субтитрам через PlayPhrase/Yarn (там же ссылка «послушать»). Поле `translation_version`: dub / sub / manga.

**Формат хранения:** `content/quotes/<title>.json` (или .yaml) с полями из `quotes-sample.json` плюс `fragment`, `profanity`, `spoiler`, `ru`, `words` (леммы для связи с карточками слов).

---

## 5. Сколько реалистично набрать на старте

| Тайтл | Авто-кандидатов E+D (коротких) | Реально после курации (старт) |
|---|---|---|
| Supernatural | 1 342 | 60–100 |
| Game of Thrones | 1 078 | 50–80 |
| FMA / Brotherhood | 760 | 40–60 |
| Breaking Bad | 566 | 40–60 |
| Stranger Things | 349 | 30–50 |
| Star Wars | 282 | 30–50 |
| LOTR | 105 | 20–30 |
| Black Mirror | 95 | 15–25 |
| The 100 | 72 | 20–30 |
| Berserk | 37 | 15–20 |
| Attack on Titan | — (вручную) | 20–30 |
| Jujutsu Kaisen | — (вручную) | 20–30 |
| Solo Leveling | — (вручную) | 10–15 |
| Игры | — (Polygon + Wikiquote) | 30–60 |
| Мемы | — (KYM) | 30–50 |
| **Итого** | ~4 700 (+ C/B ещё ~6 800) | **≈ 450–700** |

- **На старте (MVP)** хватит **~300 цитат**: по 20–40 на крупные тайтлы и по 10–15 на мелкие. Этого достаточно, чтобы в каждом уроке рангов E–D было 3–5 фраз «из любимого» (5 фраз × ~60 уроков).
- **Для рангов E–D** реалистично **~400–500** хороших цитат. Остальное пойдёт в C и выше: чем больше грамматики знает пользователь, тем больше открывается цитат (это само по себе мотивирует).
- Цитаты неравномерны по тайтлам. Supernatural, GoT, BB и FMA закрывают ~70% объёма, аниме-новинки (JJK, Solo Leveling) дают единицы. Их стоит использовать для геймификации и «цитаты дня», а не как основу уроков.

---

## Источники (часть 5)

- Wikiquote (en): страницы по сезонам и фильмам (см. §2), API `w/api.php?action=query&list=search`, raw-выгрузка `index.php?action=raw`.
- IMDb Quotes: tt0120737 (LOTR: FotR), tt0318871 (Berserk 1997), tt2560140 (AoT), tt12343534 (JJK), tt21209876 (Solo Leveling), tt1355642 (FMA:B); чтение через r.jina.ai. IMDb Conditions of Use — запрет на автоматический сбор.
- NGSL 1.2: newgeneralservicelist.com (`NGSL_12_stats.csv`, `NGSL_12_lemmatized_for_research.csv`).
- hermitdave/FrequencyWords, `content/2018/en/en_50k.txt`, MIT.
- Polygon, «The 100 greatest video game quotes of all time»: https://www.polygon.com/best-video-game-quotes/
- Screen Rant: https://screenrant.com/best-jujutsu-kaisen-quotes/ , https://screenrant.com/solo-leveling-best-jinwoo-quotes/
- ComicBook: https://comicbook.com/anime/news/best-jujutsu-kaisen-quotes-ranked/
- Jujutsu Kaisen Wiki (Fandom): https://jujutsu-kaisen.fandom.com/wiki/Yuji_Itadori (раздел Quotes)
- Know Your Meme: страницы, перечисленные в §2.15.
- attackontitan.nl/en/quotes: фан-подборка, только как список «что искать».
- ГК РФ ст. 1274 (свободное использование, цитирование в учебных целях).
