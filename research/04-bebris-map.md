# Карта курса Бебриса «Английский язык до автоматизма» и сопоставление с нашей программой

Дата: 2026-09-27. Продолжение [01-research.md](01-research.md) (§2 и §5), [02-decisions-and-research.md](02-decisions-and-research.md) (ранги E→S), [03-methods-and-exercises.md](03-methods-and-exercises.md) (§5 и §9, «Видео по теме»).

Плейлист: https://www.youtube.com/playlist?list=PLD6SPjEPomaustGSgYNsn3V62BTQeH85X

**Как делалось.** Взяли список из 1033 видео (`yt-dlp --flat-playlist`), скачали русские авто-субтитры для 153 видео и по первым ~15 минутам текста (английские слова, которые встречаются чаще всего, и фрагмент, где автор объявляет тему) определили тему урока. Описания видео не помогли: у всех один и тот же рекламный текст (English Galaxy, книги, соцсети), темы там нет.

**Пометки о проверке** (столбец «Как проверено»):
- **С**: тема определена по субтитрам;
- **Н**: тема написана в названии видео (например, «Past Simple отрицание didn't»);
- **Н+С**: есть и в названии, и подтверждено субтитрами;
- **П**: предположение (по соседним урокам или по общей логике блока), по субтитрам не проверено.

Авто-субтитры плохо распознают английскую речь (например, «Will not» может превратиться в «won't класс в»), поэтому тему определяли по смыслу русских объяснений и примеров. Разбивка на лексику внутри урока приблизительная.

**Охват:**
- Часть 1: субтитрами проверены **все теоретические уроки 1–63** и уроки 94–106. Блоки «Правильные глаголы» (64–78) и «Неправильные глаголы» (79–93) определены по названиям, выборочно подтверждены субтитрами. Из уроков-повторений 108–132 проверены 4. Урок 107 не скачался.
- Часть 2: взят каждый 5-й урок и все уроки с темой в названии, всего ~80 уроков. Блоки 2.2–2.10 и 2.24–2.44 скачать не удалось (429), см. «Не охвачено».
- YouTube начал отвечать **HTTP 429** примерно на 130-м скачивании. Повторные попытки не прошли, поэтому 25 видео остались без субтитров (список в конце).

---

## 1. Структура курса

Всего **1033 видео, ~310 часов** (в среднем 18 минут на видео, большинство 17–30 минут, «Супер-тренажёр» длится 11,9 ч).

| Часть | Видео | Длительность | Состав |
|---|---|---|---|
| **Часть 1** (уроки 1–132; в плейлисте № 1–551) | 551 | ~166 ч | 93 урока-теории (31,8 ч) · 61 «Практика» (22 ч) · 20 «Упражнения» (5,3 ч) · 39 «Повторение» (13,1 ч) · **338 «Контрольных» (94 ч)** |
| **Часть 2** (уроки 1–481; № 552–1032) | 481 | ~132 ч | 422 урока (115 ч) · 59 «Итоговых контрольных» (16,9 ч) |
| **Супер-тренажёр** (№ 1033) | 1 | 11,9 ч | сводный тренажёр «английский с нуля» |

**Типы видео:**
- **Урок (теория).** Одно правило плюс 30–60 фраз RU→EN с разбором. В ч.2 теория и практика совмещены в одном видео.
- **Практика / Упражнения.** Та же тема: только фразы на перевод, 1–3 видео на урок.
- **Повторение.** Сводные повторения перед контрольной, лексика, диктант слов.
- **Контрольная.** Большие серии фраз на перевод по всему пройденному материалу, по 3–8 видео на каждый урок-повторение. Больше половины первой части (338 из 551 видео, 94 ч) это контрольные.
- **Итоговая контрольная** (ч.2, уроки 423–481). Фразы на перевод по материалу обеих частей (автор говорит о «1200 предложениях»).

### Блоки части 1 (проверено)

| Уроки | № в плейлисте | Блок | Как проверено |
|---|---|---|---|
| 1–21 | 1–50 | **Present Simple**: +, −, ?, спецвопросы; want/like/need/would like; «правило двух глаголов» | С (все теоретические уроки) |
| 22–25 | 51–68 | Повторение + 14 контрольных | С |
| 26–34 | 69–92 | **to be** (am/is/are): +, −, ?, спецвопросы; so/such; a/an | С |
| 35–48 | 93–162 | Повторение (Present Simple + to be) + 40 контрольных | С (выборочно) |
| 49–63 | 163–208 | **Future Simple (will)**: +, −, ?, спецвопросы; be able to / manage to; глаголы с предлогами; лексика | С |
| 64–78 | 209–250 | **Правильные глаголы** (180 штук по 20 за урок): Past Simple, утверждение | Н (+С выборочно) |
| 79–93 | 251–290 | **Неправильные глаголы** (100 штук по 10 за урок) + «Упражнения» | Н (+С выборочно) |
| 94–107 | 291–326 | **Past Simple**: didn't, Did…?, спецвопрос, was/were, wasn't/weren't | Н+С |
| 108–132 | 327–551 | Большое повторение (25 уроков) + **200 контрольных** | Н, С выборочно (4 урока) |

**Вывод:** первая часть охватывает только 4 темы: Present Simple, to be, Future Simple, Past Simple. Present Continuous, can, have got, there is/are, much/many, сравнений и Present Perfect в ней нет (по всем проверенным теоретическим урокам 1–63 и 94–106).

### Блоки части 2 (выборка ~80 уроков)

| Уроки ч.2 | № в плейлисте | Блок | Как проверено |
|---|---|---|---|
| 1–~25 | 552–~576 | **Present Continuous** (still, these days), глаголы состояния | С (уроки 1, 11, 16, 21); 2–10 не скачаны |
| ~26–45 | ~577–596 | Не охвачено (429). Судя по соседним урокам, это Past Continuous (урок 36 про него) и, **вероятно**, введение в Present Perfect | С (урок 36) + **П** |
| 46–~191 | 597–742 | **Интенсив «неправильные глаголы + лексика»** в смешанных временах (Past Simple / Present Perfect / Past Continuous / will), по несколько новых глаголов и выражений за урок (found, finish, drive, let, mislead, remain, declare, consist of…) | С (каждый 5-й) |
| 193 | 744 | «ВСЕ ВРЕМЕНА»: обзор 12 времён | Н+С |
| 196–~211 | 747–~762 | Future Continuous, Present Perfect Continuous, Future Perfect | С |
| 216–~241 | 767–~792 | **Пассивный залог** во всех временах | С |
| 246–266 | 797–817 | Разное: have/have got, any/no/lots of, косвенная речь, повторение, разделительные вопросы | С |
| 269–293 | 820–844 | **Предлоги** (в основном управление: afraid of, depend on, full of, lack of) | Н+С |
| 293–306 | 844–857 | **Модальные глаголы**: can/be able to/might, could, should, must have done, модальные + пассив | Н+С |
| 307–335 | 858–886 | **Условные предложения** 1/2/3/смешанные, wish; продвинутые конструкции: have smth done, get used to, feel like, there's no point in, инверсия, усилители | С (каждый 3-й) |
| 336–422 | 887–973 | **Фразовые глаголы** (87 уроков) | Н+С |
| 423–481 | 974–1032 | **Итоговые контрольные** | Н+С |
| — | 1033 | Супер-тренажёр 11,9 ч | Н |

Сам автор в уроке 2.193 делит времена по важности так: «основные 6» (Present/Past/Future Simple, Present/Past Continuous, Present Perfect), затем Past Perfect и Present Perfect Continuous, остальные «редко используются, достаточно знать образование». Это совпадает с нашими «8 основными» из 01-research §4 (С).

---

## 2. Таблица: урок Бебриса → тема → CEFR → наш ранг

Ранги по 02-decisions: E = A0→A1, D = A1, C = A2, B = B1, A = B2, S = C1. Ранг присваивали **по нашей программе** (где тема стоит у нас), а не по месту у Бебриса. Поэтому Future Simple и Past Simple стоят в C, хотя у него они в первой части.

Тип: Т = теория/урок, Повт = повторение, К = контрольная, ИК = итоговая контрольная, Тр = тренажёр. Номер урока: «1.26» = часть 1, урок 26.

### 2.1. Часть 1 (все теоретические уроки + выборка повторений)

Контрольные (338 видео) в таблицу не включены: в них нет новых тем, только перевод фраз по всему пройденному.

| # в плейлисте | Урок | Тип | Тема | CEFR | Ранг | Как проверено |
|---|---|---|---|---|---|---|
| [1](https://www.youtube.com/watch?v=Hp9wUEDasY4) | 1.1 | Т | Present Simple: утверждение с I/we/you/they (I work, I know it); слова внутри фраз | A1 | E | С |
| [3](https://www.youtube.com/watch?v=nXI9CN5a6ew) | 1.2 | Т | Present Simple: he/she/it + -s (he works, she lives) | A1 | E | С |
| [5](https://www.youtube.com/watch?v=GCNEqFJM3GA) | 1.3 | Т | Present Simple: чтение окончания -s ([s]/[z]/[ɪz]), goes/does, -y→-ies; often | A1 | E | С |
| [7](https://www.youtube.com/watch?v=1nkoP6NosxU) | 1.4 | Т | Present Simple: подлежащее-существительное → какое местоимение (my boss = he, this lesson = it) | A1 | E | С |
| [9](https://www.youtube.com/watch?v=nPXmJZx60K0) | 1.5 | Повт | Повторение + указательные this/these/that/those | A1 | E | С |
| [13](https://www.youtube.com/watch?v=g54X7P-QMQ8) | 1.6 | Т | I want / I want to do (после первой контрольной) | A1 | E | С |
| [15](https://www.youtube.com/watch?v=006VR_z3iYc) | 1.7 | Т | I like / she likes («мне нравится» = I like) | A1 | E | С |
| [17](https://www.youtube.com/watch?v=8O2JICbDthQ) | 1.8 | Т | Present Simple: отрицание don't | A1 | E | С |
| [19](https://www.youtube.com/watch?v=82Z289SJSYA) | 1.9 | Т | don't / doesn't | A1 | E | С |
| [21](https://www.youtube.com/watch?v=RQL8lICKsiA) | 1.10 | Т | need to + «правило двух глаголов» (глагол + to + глагол) | A1 | E | С |
| [23](https://www.youtube.com/watch?v=IsKSfWnkqiE) | 1.11 | Т | Present Simple с he/she + глаголы с предлогами (pay for, agree with) | A1 | E | С |
| [24](https://www.youtube.com/watch?v=RT7Iy7OZcos) | 1.12 | Т | «Правило двух глаголов»: want to, would like to, need to | A1 | E | С |
| [25](https://www.youtube.com/watch?v=3k4L-qZs-_0) | 1.13 | Т | Порядок слов в предложении (word order) | A1 | E | С |
| [32](https://www.youtube.com/watch?v=s2mDQEUY9ac) | 1.14 | Т | Present Simple: общий вопрос Do you…? | A1 | E | С |
| [34](https://www.youtube.com/watch?v=IlSNy49QRm0) | 1.15 | Т | Does he/she…? | A1 | E | С |
| [36](https://www.youtube.com/watch?v=2Yr6DvVRe-I) | 1.16 | Т | Does + подлежащее-существительное (Does this lesson seem useful?) | A1 | E | С |
| [38](https://www.youtube.com/watch?v=_z9rz35ks2A) | 1.17 | Т | Трансформации: одно предложение в +/−/? | A1 | E | С |
| [40](https://www.youtube.com/watch?v=a7FIdktMwS8) | 1.18 | Т | Специальные вопросы (Where do you live?) | A1 | E | С |
| [43](https://www.youtube.com/watch?v=AcLZcx9p5-E) | 1.19 | Т | Спецвопросы what/where/why/how + вопрос к подлежащему (Who motivates you?) | A1–A2 | E | С |
| [46](https://www.youtube.com/watch?v=88QDbO4V2t0) | 1.20 | Т | Спецвопросы с существительными (Where does your father work?) | A1 | E | С |
| [48](https://www.youtube.com/watch?v=mfsalx6Nojs) | 1.21 | Т | Вопрос к подлежащему без do (What helps you?) | A2 | D | С |
| [51](https://www.youtube.com/watch?v=WDYiEj2FA4g) | 1.22 | Повт | Повторение: утверждение, отрицание, вопрос | A1 | E | С |
| [52](https://www.youtube.com/watch?v=sCoR5lhOEJU) | 1.23 | Повт | Повторение + would like / I'd like (a cup of tea) | A1 | E | С |
| [53](https://www.youtube.com/watch?v=SAUuT11ya5U) | 1.24 | Повт | Повторение фраз; место наречий (very well, often) | A1 | E | С |
| [54](https://www.youtube.com/watch?v=_EGF9l9808w) | 1.25 | Повт | Повторение лексики, диктант | A1 | E | С |
| [69](https://www.youtube.com/watch?v=bB4K-WblSIk) | 1.26 | Т | to be: am/is/are (I'm happy, we're at home) | A1 | E | С |
| [71](https://www.youtube.com/watch?v=EmmoAPtgllA) | 1.27 | Т | to be + прилагательное/существительное; a/an; the best | A1 | E | С |
| [74](https://www.youtube.com/watch?v=3pvq0lHmLXM) | 1.28 | Т | so / such (so interesting, such a beautiful girl) | A2 | D | С |
| [76](https://www.youtube.com/watch?v=lHGmAktrPd4) | 1.29 | Т | is/are с существительными (this video is / these videos are) | A1 | E | С |
| [79](https://www.youtube.com/watch?v=9omB2YuL1Z8) | 1.30 | Т | to be: отрицание (isn't, aren't) | A1 | E | С |
| [82](https://www.youtube.com/watch?v=mRQMPhB6c_Y) | 1.31 | Т | to be: вопрос (Are you happy?) | A1 | E | С |
| [85](https://www.youtube.com/watch?v=TLJa6rBI6pE) | 1.32 | Т | to be: вопросы с существительными (Is his father a businessman?) | A1 | E | С |
| [88](https://www.youtube.com/watch?v=sQ6HMW37Xh4) | 1.33 | Т | to be: спецвопросы (Where is he?) | A1 | E | С |
| [90](https://www.youtube.com/watch?v=XXPzbMBNzrY) | 1.34 | Т | to be: спецвопросы (What's your name? How are you?) | A1 | E | С |
| [93](https://www.youtube.com/watch?v=Lm2qTz13GYQ) | 1.35 | Повт | Повторение Present Simple + to be; a/an перед прилагательным | A1 | E | С |
| [96](https://www.youtube.com/watch?v=AV2-0chexqQ) | 1.38 | Повт | Повторение лексики (afraid of, lucky, abroad…) | A1–A2 | E | С |
| [113](https://www.youtube.com/watch?v=s8VJa3pR9sc) | 1.39 | Повт | Повторение Present Simple (+ глагол enjoy) | A1 | E | С |
| [117](https://www.youtube.com/watch?v=gBZZJf-ErmA) | 1.43 | Повт | Спецвопросы: когда do/does, когда to be | A1 | E | С |
| [122](https://www.youtube.com/watch?v=vQ1UIDyBXbc) | 1.48 | Повт | Диктант 100 слов перед контрольной | A1–A2 | E | С |
| [163](https://www.youtube.com/watch?v=4Tt_XQw5Q9k) | 1.49 | Т | Future Simple: will + глагол, I'll | A1–A2 | C | С |
| [165](https://www.youtube.com/watch?v=JQqGSOoY6oE) | 1.50 | Т | Future Simple: утверждение, сложные предложения | A2 | C | С |
| [167](https://www.youtube.com/watch?v=aWv9LlHCdhQ) | 1.51 | Т | Future Simple: отрицание won't | A2 | C | С |
| [169](https://www.youtube.com/watch?v=nCbGwDXql3k) | 1.52 | Т | won't с подлежащим-существительным | A2 | C | С |
| [171](https://www.youtube.com/watch?v=H2WstZIjwDw) | 1.53 | Т | Future Simple: вопрос Will you…? | A2 | C | С |
| [173](https://www.youtube.com/watch?v=eS6-1Ajt4go) | 1.54 | Т | Will + подлежащее-существительное | A2 | C | С |
| [175](https://www.youtube.com/watch?v=TNpl9twtT_Q) | 1.55 | Т | Future Simple: спецвопрос; will be able to / manage to | A2 | C | С |
| [177](https://www.youtube.com/watch?v=TmdM0stXU7s) | 1.56 | Т | Future Simple: спецвопросы (Why will…?) | A2 | C | С |
| [179](https://www.youtube.com/watch?v=dreip9BSJg4) | 1.57 | Повт | Повторение Future Simple | A2 | C | С |
| [180](https://www.youtube.com/watch?v=32OxKF-FoNw) | 1.58 | Повт | Трансформации +/−/? в Future Simple | A2 | C | С |
| [181](https://www.youtube.com/watch?v=hUWh15C6Pqk) | 1.59 | Повт | Спецвопросы, how many / how much | A2 | C | С |
| [182](https://www.youtube.com/watch?v=2bsDP-r-RGk) | 1.60 | Т | Глаголы с предлогами (depend on, lead to, react to, pay for) | A2–B1 | C | С |
| [183](https://www.youtube.com/watch?v=Brq2IJQBygo) | 1.61 | Повт | Лексика перед контрольной (despite, enough, approach) | B1 | B | С |
| [184](https://www.youtube.com/watch?v=5dBY5fTdMhc) | 1.62 | Повт | Лексика перед контрольной | B1 | B | С |
| [185](https://www.youtube.com/watch?v=136_ZkikgA4) | 1.63 | Повт | Лексика перед контрольной | B1 | B | С |
| [209](https://www.youtube.com/watch?v=oE0epGjQEyc) | 1.64 | Т | Правильные глаголы 1–20: Past Simple (-ed), утверждение | A2 | C | Н+С |
| [211](https://www.youtube.com/watch?v=wnGpdPYIeoI) | 1.65 | Т | Правильные глаголы 21–40 | A2 | C | Н |
| [213](https://www.youtube.com/watch?v=EIzfWhKDqis) | 1.66 | Т | Правильные глаголы 41–60 | A2 | C | Н |
| [215](https://www.youtube.com/watch?v=DhMK1F2uW1Q) | 1.67 | Т | Правильные глаголы 61–80 | A2 | C | Н |
| [217](https://www.youtube.com/watch?v=rlhuGvO_WBI) | 1.68 | Т | Правильные глаголы 81–100 | A2 | C | Н |
| [219](https://www.youtube.com/watch?v=XhOp3G3LdzI) | 1.69 | Т | Правильные глаголы 101–120 | A2 | C | Н |
| [221](https://www.youtube.com/watch?v=R0xhMzzIFQo) | 1.70 | Т | Правильные глаголы 121–140 | A2 | C | Н |
| [223](https://www.youtube.com/watch?v=eSt2lMEhR-8) | 1.71 | Т | Правильные глаголы 141–160 | A2 | C | Н |
| [225](https://www.youtube.com/watch?v=ih_p3n6fT68) | 1.72 | Т | Правильные глаголы 161–180 | A2 | C | Н |
| [227](https://www.youtube.com/watch?v=PLxFmdAyIaY) | 1.73 | Т | Правильные глаголы, повторение (advise, refuse, prepare) | A2 | C | Н+С |
| [251](https://www.youtube.com/watch?v=oAziZ0eLy68) | 1.79 | Т | Неправильные глаголы 1–10 (be, go, make, have, do…) | A2 | C | Н+С |
| [253](https://www.youtube.com/watch?v=sxmNTfmhs9k) | 1.80 | Т | Неправильные глаголы 11–20 | A2 | C | Н |
| [255](https://www.youtube.com/watch?v=M6eOW9wdWDU) | 1.81 | Т | Неправильные глаголы 21–30 | A2 | C | Н |
| [257](https://www.youtube.com/watch?v=RsJ0IsBjcsE) | 1.82 | Т | Неправильные глаголы 31–40 | A2 | C | Н |
| [259](https://www.youtube.com/watch?v=8ZG2wN_mIw0) | 1.83 | Т | Неправильные глаголы 41–50 | A2 | C | Н |
| [261](https://www.youtube.com/watch?v=WjA4X6mPnZE) | 1.84 | Т | Неправильные глаголы 51–60 | A2 | C | Н |
| [263](https://www.youtube.com/watch?v=Dtws-e2jZzI) | 1.85 | Т | Неправильные глаголы 61–70 | A2 | C | Н |
| [265](https://www.youtube.com/watch?v=r95WvAeOuLg) | 1.86 | Т | Неправильные глаголы 71–80 | A2 | C | Н |
| [267](https://www.youtube.com/watch?v=ZaFJwEvUmWQ) | 1.87 | Т | Неправильные глаголы 81–90 | A2 | C | Н |
| [269](https://www.youtube.com/watch?v=xX5_E8M6zs4) | 1.88 | Т | Неправильные глаголы 91–100 | A2 | C | Н |
| [271](https://www.youtube.com/watch?v=BSmoM5QeY7g) | 1.89 | Повт | Неправильные глаголы: повторение (feed, hold, become, fly, catch) | A2 | C | Н+С |
| [291](https://www.youtube.com/watch?v=g8ZbFeoUhb0) | 1.94 | Т | Past Simple: отрицание didn't | A2 | C | Н+С |
| [293](https://www.youtube.com/watch?v=MzvC6xfF4i0) | 1.95 | Т | Past Simple: вопрос Did…? | A2 | C | Н+С |
| [295](https://www.youtube.com/watch?v=IJxWAVRX0Dw) | 1.96 | Т | Past Simple: спецвопрос (Where did you go?) | A2 | C | Н+С |
| [297](https://www.youtube.com/watch?v=073mRqaAExA) | 1.97 | Т | was / were | A1–A2 | C | Н+С |
| [299](https://www.youtube.com/watch?v=oakvMzl5AXo) | 1.98 | Т | was / were с существительными | A1–A2 | C | Н+С |
| [301](https://www.youtube.com/watch?v=GHSqzsRcMF8) | 1.99 | Т | wasn't / weren't (+ be proud of) | A2 | C | Н+С |
| [303](https://www.youtube.com/watch?v=ZHzzf7xPdNA) | 1.100 | Т | wasn't / weren't | A2 | C | Н |
| [305](https://www.youtube.com/watch?v=tJQ-vMO-qV8) | 1.101 | Т | was/were: вопрос | A2 | C | Н |
| [307](https://www.youtube.com/watch?v=p8ycpsyRp0M) | 1.102 | Т | was/were: спецвопрос | A2 | C | Н+С |
| [309](https://www.youtube.com/watch?v=Qp42X6-4S9w) | 1.103 | Т | Спецвопрос с подлежащим-существительным (Where was our teacher?) | A2 | C | Н+С |
| [311](https://www.youtube.com/watch?v=Ol4La1-di8o) | 1.104 | Т | Past Simple vs Present Simple; правильные/неправильные | A2 | C | С |
| [312](https://www.youtube.com/watch?v=JNRpC7pqVMo) | 1.105 | Т | Past Simple: +/−/? трансформации | A2 | C | С |
| [313](https://www.youtube.com/watch?v=T2rNu1NNnzU) | 1.106 | Т | Исключение: вопрос к подлежащему в прошедшем (What helped you?) | A2 | C | С |
| [314](https://www.youtube.com/watch?v=mdt3OoadgRs) | 1.107 | Т | Past Simple (субтитры не скачаны — 429) | A2 | C | Н |
| [327](https://www.youtube.com/watch?v=HAT-BbvXUxo) | 1.108 | Повт | Повторение Present Simple | A1 | E | С |
| [335](https://www.youtube.com/watch?v=ejGM6xAXcQs) | 1.116 | Повт | Повторение: tend to, sounds/smells like, местоимения | A2 | D | С |
| [340](https://www.youtube.com/watch?v=ntgd4E3fh3Y) | 1.121 | Повт | Маркеры времени: Present Simple vs Past Simple | A2 | C | С |
| [351](https://www.youtube.com/watch?v=CdrBvqZRuoQ) | 1.132 | Повт | Лексика перед большой контрольной | A2–B1 | C | С |

### 2.2. Часть 2 (выборка)

| # в плейлисте | Урок | Тип | Тема | CEFR | Ранг | Как проверено |
|---|---|---|---|---|---|---|
| [552](https://www.youtube.com/watch?v=6Y-aBWo-xFk) | 2.1 | Т | Вступление к части 2 (обзор плейлистов канала), Present Continuous | A1–A2 | D | С (частично) |
| [562](https://www.youtube.com/watch?v=Dt6YcGWfAq8) | 2.11 | Т | Present Continuous: still, these days (I'm still waiting) | A1 | D | С |
| [567](https://www.youtube.com/watch?v=VNoNT1ao4O0) | 2.16 | Т | Глаголы состояния без Continuous (belong, sound, contain) | A2–B1 | C | С |
| [572](https://www.youtube.com/watch?v=VZ4sZGdG1L0) | 2.21 | Т | Present Continuous (Progressive): утверждение | A1 | D | С |
| [587](https://www.youtube.com/watch?v=nag2dLag6Mw) | 2.36 | Т | Past Continuous vs Past Simple (I was waiting when she saw me) | A2 | C | С |
| [597](https://www.youtube.com/watch?v=sABn1YHelKw) | 2.46 | Т | Интенсив неправильных глаголов: found/founded, was founded, offer | A2–B1 | C | С |
| [602](https://www.youtube.com/watch?v=e9vi3UqDrNc) | 2.51 | Т | Неправильные глаголы + Present Perfect (already, never, ever: I've never driven) | A2–B1 | C | С |
| [607](https://www.youtube.com/watch?v=Nztz_W8aEw4) | 2.56 | Т | Лексика: enjoy doing, increase/decrease, water the flowers | A2–B1 | C | С |
| [612](https://www.youtube.com/watch?v=wSuNvEBsqk0) | 2.61 | Т | I've always wanted…, pay/paid, if | B1 | B | С |
| [617](https://www.youtube.com/watch?v=LBnXzY3pz6g) | 2.66 | Т | as … as possible | A2–B1 | C | С |
| [622](https://www.youtube.com/watch?v=SkDiQtjFm00) | 2.71 | Т | had to (должен был), exchange | A2 | C | С |
| [627](https://www.youtube.com/watch?v=YyybAN8abio) | 2.76 | Т | let smb do, invent | A2–B1 | C | С |
| [632](https://www.youtube.com/watch?v=Edx-q4GSYKw) | 2.81 | Т | Приставки mis-/over- (misspell, mislead, overtake) | B1–B2 | B | С |
| [637](https://www.youtube.com/watch?v=fNZOGDWS1bI) | 2.86 | Т | Past Continuous + Present/Past Perfect в контексте | B1 | B | С |
| [642](https://www.youtube.com/watch?v=LB-FLaeeVTY) | 2.91 | Т | Неправильные глаголы: remain, smile | A2–B1 | C | С |
| [647](https://www.youtube.com/watch?v=UxX1Ca2w7iY) | 2.96 | Т | continue doing, лексика | B1 | B | С |
| [652](https://www.youtube.com/watch?v=Zkc-HfcTxYg) | 2.101 | Т | 3-я форма неправильных глаголов (Have you ever driven…?), push, emphasis | B1 | B | С |
| [657](https://www.youtube.com/watch?v=gCCiksORLrE) | 2.106 | Т | Лексика: treat unfairly, light/lit, should | B1 | B | С |
| [662](https://www.youtube.com/watch?v=Z0U4jE0b5kE) | 2.111 | Т | Лексика: declare, refer to, ask | B1 | B | С |
| [682](https://www.youtube.com/watch?v=1aSBuFMUQxg) | 2.131 | Т | Лексика в разных временах (decrease the price, hasn't informed) | B1 | B | С |
| [697](https://www.youtube.com/watch?v=AdsiHDc3Gdc) | 2.146 | Т | Тема не определена (субтитры нечитаемые) | ? | ? | — |
| [707](https://www.youtube.com/watch?v=t6IQQpOFxEg) | 2.156 | Т | Лексика: divide, join, for several reasons | B1 | B | С |
| [712](https://www.youtube.com/watch?v=tP_4PCmJbvs) | 2.161 | Т | appreciate, unfasten; may/might | B1 | B | С |
| [717](https://www.youtube.com/watch?v=vGMflOrXBzY) | 2.166 | Т | devote oneself to, consist of, insist on | B1–B2 | B | С |
| [722](https://www.youtube.com/watch?v=lKoNDD5IM9s) | 2.171 | Т | would like to expand; as thoroughly as | B1 | B | С |
| [727](https://www.youtube.com/watch?v=QV88kLOVW2c) | 2.176 | Т | I wouldn't trust him, lost password, spoil | B1 | B | С |
| [732](https://www.youtube.com/watch?v=3P53WrN-qHc) | 2.181 | Т | as far as I remember; just broke down | B1 | B | С |
| [737](https://www.youtube.com/watch?v=v4lfH41hB70) | 2.186 | Т | mislead, hurt feelings, already made | B1 | B | С |
| [742](https://www.youtube.com/watch?v=Sjg1M5T4NVg) | 2.191 | Т | Спецвопросы в разных временах (What were they talking about?) | B1 | B | С |
| [744](https://www.youtube.com/watch?v=fhiXo0tmZTM) | 2.193 | Т | ВСЕ ВРЕМЕНА: обзор 12 времён, что пройдено и что важнее | B1 | B | Н+С |
| [747](https://www.youtube.com/watch?v=6k6QwYL6NzA) | 2.196 | Т | Future Continuous (she'll be cooking while…) | B2 | A | С |
| [752](https://www.youtube.com/watch?v=IxjdanDgqWE) | 2.201 | Т | Present Perfect Continuous (he's been working) | B1 | B | С |
| [762](https://www.youtube.com/watch?v=JSHrZuAy9uo) | 2.211 | Т | Perfect Continuous + Future Perfect (I've been learning for a year; he'll have…) | B2 | A | С |
| [767](https://www.youtube.com/watch?v=lx-HhzfqGVM) | 2.216 | Т | Пассивный залог: в каких временах бывает, is made in | B1 | B | С |
| [772](https://www.youtube.com/watch?v=_QTpE9YRIog) | 2.221 | Т | Пассив: Future Simple (When will it be done?) | B1–B2 | B | С |
| [777](https://www.youtube.com/watch?v=k30PW6j0i50) | 2.226 | Т | Пассив: Continuous/Perfect (is being criticised, has been) | B2 | A | С |
| [782](https://www.youtube.com/watch?v=QgvQcvK-lso) | 2.231 | Т | Пассив: будущее/перфект, by whom | B2 | A | С |
| [787](https://www.youtube.com/watch?v=yvdUvIO4Wio) | 2.236 | Т | Пассив: Past Simple (was shortened, were minimised) | B1 | B | С |
| [792](https://www.youtube.com/watch?v=lKy85mitOPo) | 2.241 | Т | Пассив: Past Perfect (it was said the problem had been solved) | B2 | A | С |
| [797](https://www.youtube.com/watch?v=0vQxLfCmYfI) | 2.246 | Т | have / have got / has | A1 | E | С |
| [802](https://www.youtube.com/watch?v=cpNfQQm8ppk) | 2.251 | Т | any / no / lots of (I don't have any questions) | A1–A2 | D | С |
| [807](https://www.youtube.com/watch?v=62kfQH0uwIU) | 2.256 | Т | Косвенная речь, согласование времён (He said he was busy) | B1 | B | С |
| [812](https://www.youtube.com/watch?v=GEorr2nlRyw) | 2.261 | Повт | Повторение перед контрольной (there is/are…) | A2–B1 | C | С (частично) |
| [817](https://www.youtube.com/watch?v=HGwwoQB0BIA) | 2.266 | Т | prefer, работа над собой; разделительный вопрос (…, don't you?) | B1 | B | С |
| [820](https://www.youtube.com/watch?v=qjb3rtyG8po) | 2.269 | Т | Предлоги после прилагательных: fond of, afraid of, keen on, good at | A2–B1 | C | Н+С |
| [824](https://www.youtube.com/watch?v=zMMSBNL4S4Q) | 2.273 | Т | Предлоги: pay for, depend on, crazy about, look for | A2–B1 | C | Н+С |
| [828](https://www.youtube.com/watch?v=b4axnYorr1o) | 2.277 | Т | Предлоги в выражениях: for a while, for instance, disappointed in | B1 | B | Н+С |
| [832](https://www.youtube.com/watch?v=KauDR8zhnUg) | 2.281 | Т | Предлоги: associate with, full of | B1 | B | Н+С |
| [836](https://www.youtube.com/watch?v=w1exWPiXJnE) | 2.285 | Т | Предлоги: lack of, connected with, dissatisfied with | B1–B2 | B | Н+С |
| [840](https://www.youtube.com/watch?v=6pY3oKwsuVo) | 2.289 | Т | Предлоги/выражения: to put it shortly | B2 | A | Н+С |
| [844](https://www.youtube.com/watch?v=5mFaI_cnaB8) | 2.293 | Т | Модальные: can, be able to, might; после модального — без to | A2 | C | С |
| [845](https://www.youtube.com/watch?v=y8pcQGaMKI0) | 2.294 | Т | could (прошедшее и «мог бы»); can be done | A2–B1 | C | Н+С |
| [848](https://www.youtube.com/watch?v=RIPD00DDXEk) | 2.297 | Т | must have done, may have done (перфектный инфинитив) | B2 | A | Н+С |
| [851](https://www.youtube.com/watch?v=H4-rXitQBN8) | 2.300 | Т | should, needn't, could | B1 | B | Н+С |
| [854](https://www.youtube.com/watch?v=eE_sqWpL-lo) | 2.303 | Т | Модальные + пассив (must have been ignored), be able to | B2 | A | Н+С |
| [857](https://www.youtube.com/watch?v=zCiBUcG3RQc) | 2.306 | Т | Модальные + пассив (it needs to be done) | B2 | A | Н+С |
| [858](https://www.youtube.com/watch?v=MC0EPmPnTH8) | 2.307 | Т | Условные предложения 1-го типа (if + Present Simple → will) | B1 | B | С |
| [861](https://www.youtube.com/watch?v=a2NXNeUKhcU) | 2.310 | Т | Условные 3-го типа (if I had studied, I would have passed) | B2 | A | С |
| [864](https://www.youtube.com/watch?v=tuchsCyihk0) | 2.313 | Т | must/have to в будущем и в пассиве (will have to be…) | B2 | A | С |
| [867](https://www.youtube.com/watch?v=V5PCgdjBQf8) | 2.316 | Т | Условные 1-го и 2-го типа (if I had more free time, I would…) | B1 | B | С |
| [870](https://www.youtube.com/watch?v=EEMmcyY2nvc) | 2.319 | Т | Условные 3-го/смешанного типа, wish | B2 | A | С |
| [873](https://www.youtube.com/watch?v=cTtcmycgs9o) | 2.322 | Т | Усилители: highly likely, deeply disappointed | B2 | A | С |
| [876](https://www.youtube.com/watch?v=M_yHSraY7do) | 2.325 | Т | Лексика: moving story, controversial | B2 | A | С |
| [879](https://www.youtube.com/watch?v=dmbTKXB2SNY) | 2.328 | Т | have difficulty (in) doing; each of us / none of us | B1–B2 | B | С |
| [882](https://www.youtube.com/watch?v=i2cHBmDAuHk) | 2.331 | Т | there is no point in doing; he or she; инверсия (Little do they know) | C1 | S | С |
| [885](https://www.youtube.com/watch?v=NzG1Hio8rO0) | 2.334 | Т | feel like doing; have something done (had her hair cut); get used to | B1–B2 | B | С |
| [887](https://www.youtube.com/watch?v=fGxRBo8Prko) | 2.336 | Т | Фразовые глаголы: wake up, check in/out, log in, break down; место частицы | B1 | B | Н+С |
| [895](https://www.youtube.com/watch?v=HkFu9dLvRfQ) | 2.344 | Т | Фразовые: look up, get down, dress up | B1–B2 | B | Н+С |
| [905](https://www.youtube.com/watch?v=6rFJkFq5f0s) | 2.354 | Т | Фразовые: cross out, turn out to be, get down to business | B2 | A | Н+С |
| [915](https://www.youtube.com/watch?v=_8uTU-rGo3s) | 2.364 | Т | Фразовые: fall through, be up to | B2 | A | Н+С |
| [930](https://www.youtube.com/watch?v=dkBIfciHgew) | 2.379 | Т | Фразовые: eat out, go by, look forward to | B1–B2 | B | Н+С |
| [945](https://www.youtube.com/watch?v=ynmDfdQn0Fc) | 2.394 | Т | Фразовые: get back to, cope with, run away | B1–B2 | B | Н+С |
| [960](https://www.youtube.com/watch?v=RUOA1dO9iiw) | 2.409 | Т | Фразовые: dwell on, figure out, come across | B2 | A | Н+С |
| [973](https://www.youtube.com/watch?v=as42O7HqnPA) | 2.422 | К | Контрольная по фразовым глаголам (заключительная часть) | B2 | A | Н+С |
| [974](https://www.youtube.com/watch?v=zijCu60S4QM) | 2.423 | ИК | Итоговая контрольная 1 (материал обеих частей) | B2–C1 | A | Н+С |
| [990](https://www.youtube.com/watch?v=uPa4RrF6KRo) | 2.439 | ИК | Итоговая контрольная | B2–C1 | A | Н+С |
| [1010](https://www.youtube.com/watch?v=qTKKaE7-8A4) | 2.459 | ИК | Итоговая контрольная | B2–C1 | A | Н+С |
| [1032](https://www.youtube.com/watch?v=Vn0w_PdX5Ss) | 2.481 | ИК | Итоговая контрольная (последняя) | B2–C1 | A | Н+С |
| [1033](https://www.youtube.com/watch?v=yT-Tlhe7hKk) | — | Тр | Супер-тренажёр (11,9 ч), субтитры не скачаны | все | — | Н |

---

## 3. Порядок грамматики у Бебриса и сравнение с нашим скелетом

### 3.1. Последовательность у Бебриса (по проверенным урокам)

1. Present Simple: + (I/we/you/they, затем he/she/it, чтение -s) → this/that → want / like → − (don't/doesn't) → need to / would like, «правило двух глаголов» → порядок слов → ? (do/does) → спецвопросы → вопрос к подлежащему. *(1.1–1.21)*
2. to be: am/is/are → so/such, a/an, the best → − → ? → спецвопросы. *(1.26–1.34)*
3. Future Simple (will): + → − → ? → спецвопросы, be able to / manage to → глаголы с предлогами. *(1.49–1.63)*
4. Past Simple: 180 правильных глаголов → 100 неправильных → didn't → Did…? → спецвопрос → was/were (+, −, ?, спецвопрос) → сравнение с Present Simple. *(1.64–1.107)*
5. Present Continuous → глаголы состояния → Past Continuous → (вероятно) Present Perfect. *(2.1–2.45, частично П)*
6. Долгий интенсив «неправильные глаголы + лексика» во всех пройденных временах. *(2.46–2.191)*
7. Обзор 12 времён → Future Continuous → Present Perfect Continuous → Future Perfect. *(2.193–2.211)*
8. Пассив во всех временах. *(2.216–2.241)*
9. have/have got → some/any/no → косвенная речь → разделительные вопросы. *(2.246–2.266)*
10. Предлоги (управление) → модальные → условные 1/2/3 + wish → продвинутые конструкции (have smth done, get used to, инверсия). *(2.269–2.335)*
11. Фразовые глаголы → итоговые контрольные. *(2.336–2.481)*

### 3.2. Наш скелет (01-research §5) против Бебриса

| Тема | У нас | У Бебриса | Разница |
|---|---|---|---|
| to be | A1, **первая тема** | 1.26, после 21 урока Present Simple | у него позже |
| Present Simple | A1 | 1.1–1.21 (самый подробный блок курса) | совпадает, у него очень глубоко |
| Present Continuous | A1 (ранг D) | **только ч.2** (2.1–2.21), после Past Simple и will | у него сильно позже |
| can | A1 | **ч.2, 2.293** (в 1.55 только be able to / manage to) | у него сильно позже |
| have got | A1 | ч.2, 2.246 | у него сильно позже |
| there is/are | A1 | в выборке отдельного урока нет (упоминается в повторении 2.261, П) | не найдено |
| артикли | A1 | только мини-правила внутри уроков (1.27, 1.35), без отдельного блока | у него слабее |
| множественное число, притяжательные, числа/время/даты, повелительное | A1 | в выборке не встретилось | **нет у него** (или не охвачено) |
| предлоги места/времени in/on/at | A1 | блок предлогов в ч.2 (2.269–2.293) в основном про управление (afraid of, depend on), не про место/время | у него иначе и позже |
| Future: will | A2 | 1.49–1.63, **раньше Past Simple** | у него раньше |
| be going to | A2 | в проверенных уроках **не встретилось** | не найдено |
| Past Simple (+ ~100 неправильных) | A2 | 1.64–1.107: 180 правильных + 100 неправильных глаголов | совпадает, у него очень подробно |
| сравнения (bigger, the biggest) | A2 | только the best (1.27) и as … as possible (2.66); отдельного урока не найдено | не найдено |
| much/many/some/any | A2 | how many (1.59), any/no/lots of (2.251) | у него позже |
| must/have to/should | A2 | ч.2, 2.293–2.306, сразу с перфектом и пассивом | у него позже и сложнее |
| Present Perfect | A2 базово / B1 | в контексте с 2.51; введение, **вероятно**, в 2.26–2.45 (П) | примерно совпадает |
| Past Continuous | A2 | 2.36 | совпадает (чуть позже) |
| наречия частотности, like + -ing / want to | A2 | often/always в 1.3/1.24; want to/like/need to в 1.6–1.12 («правило двух глаголов») | у него раньше |
| Present Perfect Continuous, Past Perfect | B1 | 2.201; Past Perfect в контексте (2.86, 2.241) | совпадает |
| условные 0/1/2 | B1 | 2.307–2.316 | совпадает |
| пассив | B1 базово / B2 все формы | 2.216–2.241, сразу все формы | у него сразу целиком |
| косвенная речь | B1 | 2.256 | совпадает |
| used to | B1 | не встретилось (есть get used to в 2.334) | не найдено |
| relative clauses (who/which/that) | B1 | не встретилось | **нет в выборке** |
| фразовые глаголы | B1 (топ-100) | 2.336–2.422 (87 уроков) | у него больше |
| герундий/инфинитив | B1 | частями: «правило двух глаголов» (1.10–1.12), continue doing, feel like doing | нет отдельного урока (в выборке) |
| 3-е условное, wish, модальные в прошедшем | B2 | 2.297, 2.310, 2.319 | совпадает |
| остальные времена | B2 | 2.196–2.211 | совпадает |
| инверсия | B2 обзорно | 2.331 | совпадает |
| пунктуация | мини-модуль | не встретилось | **нет у него** |

**Итоги сравнения:**
- **У него раньше:** will (до Past Simple), вопрос к подлежащему, «правило двух глаголов» (want/need/would like to), глаголы с предлогами.
- **У него позже:** to be (после Present Simple), Present Continuous, can, have got, модальные, some/any: всё это во второй части, то есть после ~550 видео.
- **Нет у нас:** массовая отработка словаря глаголов (180 правильных + 100 неправильных по 10–20 за урок), интенсив лексики в смешанных временах (2.46–2.191), продвинутые конструкции (have smth done, there's no point in, усилители highly/deeply), огромный объём контрольных.
- **Нет у него (в охваченной выборке):** be going to, there is/are отдельным уроком, сравнения прилагательных, числа/время/даты, повелительное наклонение, притяжательный падеж, used to, relative clauses, пунктуация. Нет и ситуаций путешествия (отель, дорога, магазин), слуха (диктант по речи) и произношения, кроме чтения -s.

Для A0 и цели «путешествия» наш порядок логичнее (to be → Present Simple → Present Continuous → can уже на первом месяце). У Бебриса до Present Continuous и can нужно пройти ~550 видео. Поэтому видео привязываем **по теме, а не по порядку курса**.

---

## 4. Рекомендация: «Видео по теме» для наших уроков

Принципы:
- к уроку привязываем **1 теоретическое видео + 1 видео практики** (если есть), не больше. Видео длинные (20–30 мин), а у нас 1 час в день;
- для рангов E–C берём часть 1: она медленная и подробная, и все её уроки проверены по субтитрам;
- к блокам ранга D–C с Present Continuous, can и модальными видео из ч.2 давать с пометкой «сложнее, по желанию»: в них больше незнакомой лексики;
- **контрольные** (338 + 59 видео) хорошо подходят как «экзамен-данж» перед Вратами ранга (например, контрольные 1.35–1.38 к Вратам D по Present Simple + to be), но это опция, не основное;
- ссылки давать на `watch?v=ID` (при желании с `&list=PLD6SPjEPomaustGSgYNsn3V62BTQeH85X`).

| Наш ранг | Наша тема (урок) | Урок Бебриса | Видео (# в плейлисте → ссылка) | Комментарий |
|---|---|---|---|---|
| E | to be: am/is/are (Я счастлив, Мы дома) | 1.26 + практика | [69](https://www.youtube.com/watch?v=bB4K-WblSIk), [70](https://www.youtube.com/watch?v=Dym4N0hq15Q) | **У Бебриса to be идёт после Present Simple** (урок 26), у нас раньше; видео подходят как есть |
| E | to be: отрицание и вопрос | 1.30, 1.31, 1.32 | [79](https://www.youtube.com/watch?v=9omB2YuL1Z8), [80](https://www.youtube.com/watch?v=rN-IiOXyCTo), [82](https://www.youtube.com/watch?v=mRQMPhB6c_Y), [83](https://www.youtube.com/watch?v=ieTxQ0bvSuQ), [85](https://www.youtube.com/watch?v=TLJa6rBI6pE), [86](https://www.youtube.com/watch?v=0fwM9aTQK_c) |  |
| E | to be: спецвопросы (Where is…? What's your name?) | 1.33, 1.34 | [88](https://www.youtube.com/watch?v=sQ6HMW37Xh4), [89](https://www.youtube.com/watch?v=D5Et9y_L_70), [90](https://www.youtube.com/watch?v=XXPzbMBNzrY), [91](https://www.youtube.com/watch?v=tdNnrY5vj1M) | удобно для разговорника: What's your name, Where are you from |
| E | this/these/that/those; is/are с существительными | 1.5, 1.29 | [9](https://www.youtube.com/watch?v=nPXmJZx60K0), [76](https://www.youtube.com/watch?v=lHGmAktrPd4), [77](https://www.youtube.com/watch?v=bU8V9lQPr3s) |  |
| E | Present Simple: утверждение I/we/you/they | 1.1 + практика | [1](https://www.youtube.com/watch?v=Hp9wUEDasY4), [2](https://www.youtube.com/watch?v=jMCOyUgKhqU) | лучшее стартовое видео курса |
| E | Present Simple: he/she/it + -s, чтение -s | 1.2, 1.3, 1.4 | [3](https://www.youtube.com/watch?v=nXI9CN5a6ew), [4](https://www.youtube.com/watch?v=7MnnYT9hWLg), [5](https://www.youtube.com/watch?v=GCNEqFJM3GA), [7](https://www.youtube.com/watch?v=1nkoP6NosxU) |  |
| E | Present Simple: отрицание don't/doesn't | 1.8, 1.9 | [17](https://www.youtube.com/watch?v=8O2JICbDthQ), [18](https://www.youtube.com/watch?v=-bdj0TgQCp4), [19](https://www.youtube.com/watch?v=82Z289SJSYA), [20](https://www.youtube.com/watch?v=eIn2z55aSXg) |  |
| E | Present Simple: вопрос Do/Does | 1.14, 1.15, 1.16 | [32](https://www.youtube.com/watch?v=s2mDQEUY9ac), [33](https://www.youtube.com/watch?v=5Hqg_P_eVJM), [34](https://www.youtube.com/watch?v=IlSNy49QRm0), [36](https://www.youtube.com/watch?v=2Yr6DvVRe-I) |  |
| E | Вопросительные слова, спецвопросы | 1.18–1.20 | [40](https://www.youtube.com/watch?v=a7FIdktMwS8), [43](https://www.youtube.com/watch?v=AcLZcx9p5-E), [46](https://www.youtube.com/watch?v=88QDbO4V2t0) |  |
| E | want / like / need / would like (разговорник: заказать, попросить) | 1.6, 1.7, 1.10, 1.12, 1.23 | [13](https://www.youtube.com/watch?v=g54X7P-QMQ8), [15](https://www.youtube.com/watch?v=006VR_z3iYc), [21](https://www.youtube.com/watch?v=RQL8lICKsiA), [24](https://www.youtube.com/watch?v=RT7Iy7OZcos), [52](https://www.youtube.com/watch?v=sCoR5lhOEJU) | очень полезно для путешествий: I'd like a cup of tea |
| E | Порядок слов, наречия частотности | 1.13, 1.24; 1.3 (often) | [25](https://www.youtube.com/watch?v=3k4L-qZs-_0), [53](https://www.youtube.com/watch?v=SAUuT11ya5U) |  |
| E | Артикли a/an/the (мини-правило) | 1.27, 1.35 | [71](https://www.youtube.com/watch?v=EmmoAPtgllA), [93](https://www.youtube.com/watch?v=Lm2qTz13GYQ) | у Бебриса артикли только мини-правилами по ходу; отдельного блока в охваченной выборке нет |
| E→D | have / have got | 2.246 | [797](https://www.youtube.com/watch?v=0vQxLfCmYfI) | у Бебриса очень поздно (ч.2), у нас A1 |
| D | Present Continuous | 2.11, 2.21 (+2.1) | [562](https://www.youtube.com/watch?v=Dt6YcGWfAq8), [572](https://www.youtube.com/watch?v=VZ4sZGdG1L0) | у Бебриса только во 2-й части, после Past Simple и will; уроки 2.2–2.10 не проверены |
| D | Глаголы состояния (не бывают в Continuous) | 2.16 | [567](https://www.youtube.com/watch?v=VNoNT1ao4O0) |  |
| D | some/any/no, much/many | 2.251; 1.59 (how many) | [802](https://www.youtube.com/watch?v=cpNfQQm8ppk), [181](https://www.youtube.com/watch?v=hUWh15C6Pqk) |  |
| C | Future Simple (will): + | 1.49, 1.50 | [163](https://www.youtube.com/watch?v=4Tt_XQw5Q9k), [164](https://www.youtube.com/watch?v=4SdYPqvsbps), [165](https://www.youtube.com/watch?v=JQqGSOoY6oE) | у Бебриса will раньше Past Simple |
| C | will: отрицание и вопрос | 1.51–1.54 | [167](https://www.youtube.com/watch?v=aWv9LlHCdhQ), [169](https://www.youtube.com/watch?v=nCbGwDXql3k), [171](https://www.youtube.com/watch?v=H2WstZIjwDw), [173](https://www.youtube.com/watch?v=eS6-1Ajt4go) |  |
| C | will: спецвопросы; be able to / manage to | 1.55, 1.56 | [175](https://www.youtube.com/watch?v=TNpl9twtT_Q), [177](https://www.youtube.com/watch?v=TmdM0stXU7s) |  |
| C | Past Simple: правильные глаголы (-ed) | 1.64 (+1.65–1.73) | [209](https://www.youtube.com/watch?v=oE0epGjQEyc), [210](https://www.youtube.com/watch?v=FPqjEaeN72U) | блок из 15 уроков по 20 глаголов, можно давать как доп.словарь |
| C | Past Simple: неправильные глаголы | 1.79 (+1.80–1.93) | [251](https://www.youtube.com/watch?v=oAziZ0eLy68), [252](https://www.youtube.com/watch?v=tf01dDZA4PI) | 100 глаголов по 10 за урок, есть видео «Упражнения» |
| C | Past Simple: didn't / Did…? / спецвопрос | 1.94, 1.95, 1.96 | [291](https://www.youtube.com/watch?v=g8ZbFeoUhb0), [292](https://www.youtube.com/watch?v=pIR__InufC0), [293](https://www.youtube.com/watch?v=MzvC6xfF4i0), [295](https://www.youtube.com/watch?v=IJxWAVRX0Dw) |  |
| C | was / were: +, −, ? | 1.97–1.102 | [297](https://www.youtube.com/watch?v=073mRqaAExA), [299](https://www.youtube.com/watch?v=oakvMzl5AXo), [301](https://www.youtube.com/watch?v=GHSqzsRcMF8), [305](https://www.youtube.com/watch?v=tJQ-vMO-qV8), [307](https://www.youtube.com/watch?v=p8ycpsyRp0M) |  |
| C | Past Simple vs Present Simple, маркеры времени | 1.104, 1.121 | [311](https://www.youtube.com/watch?v=Ol4La1-di8o), [340](https://www.youtube.com/watch?v=ntgd4E3fh3Y) |  |
| C | Вопрос к подлежащему (Who/What helps you? What happened?) | 1.21, 1.106 | [48](https://www.youtube.com/watch?v=mfsalx6Nojs), [313](https://www.youtube.com/watch?v=T2rNu1NNnzU) |  |
| C | Модальные: can / could / be able to / might | 2.293, 2.294 | [844](https://www.youtube.com/watch?v=5mFaI_cnaB8), [845](https://www.youtube.com/watch?v=y8pcQGaMKI0) | у Бебриса модальные только в ч.2; can у нас в A1, привязывать как доп. видео |
| C | must / have to / should | 2.300 (+2.313) | [851](https://www.youtube.com/watch?v=H4-rXitQBN8), [864](https://www.youtube.com/watch?v=tuchsCyihk0) | уровень видео выше A2 (с пассивом), давать как «для продвинутых» |
| C | Past Continuous | 2.36 | [587](https://www.youtube.com/watch?v=nag2dLag6Mw) |  |
| C | Глаголы с предлогами (depend on, pay for, look for) | 1.60, 2.273 | [182](https://www.youtube.com/watch?v=2bsDP-r-RGk), [824](https://www.youtube.com/watch?v=zMMSBNL4S4Q) |  |
| C | as … as possible; сравнения | 2.66 | [617](https://www.youtube.com/watch?v=LBnXzY3pz6g) | отдельного урока по bigger/the biggest в выборке не найдено |
| B | Present Perfect (already, never, ever) | 2.51, 2.101 (контекст) | [602](https://www.youtube.com/watch?v=e9vi3UqDrNc), [652](https://www.youtube.com/watch?v=Zkc-HfcTxYg) | **урок-введение в Present Perfect не найден** (вероятно ч.2 уроки 26–45, не скачаны) |
| B | Present Perfect Continuous | 2.201 | [752](https://www.youtube.com/watch?v=IxjdanDgqWE) |  |
| B | Условные 0/1/2 | 2.307, 2.316 | [858](https://www.youtube.com/watch?v=MC0EPmPnTH8), [867](https://www.youtube.com/watch?v=V5PCgdjBQf8) |  |
| B | Пассив (базово) | 2.216, 2.236 | [767](https://www.youtube.com/watch?v=lx-HhzfqGVM), [787](https://www.youtube.com/watch?v=yvdUvIO4Wio) |  |
| B | Косвенная речь | 2.256 | [807](https://www.youtube.com/watch?v=62kfQH0uwIU) |  |
| B | Фразовые глаголы (топ-100) | 2.336 и далее (87 уроков) | [887](https://www.youtube.com/watch?v=fGxRBo8Prko), [895](https://www.youtube.com/watch?v=HkFu9dLvRfQ), [930](https://www.youtube.com/watch?v=dkBIfciHgew), [945](https://www.youtube.com/watch?v=ynmDfdQn0Fc) | привязывать выборочно к нашим фразовым глаголам из PHaVE |
| B | Предлоги после прилагательных (afraid of, good at) | 2.269 | [820](https://www.youtube.com/watch?v=qjb3rtyG8po) |  |
| B | Разделительные вопросы | 2.266 | [817](https://www.youtube.com/watch?v=HGwwoQB0BIA) |  |
| A | Future Continuous, Future Perfect | 2.196, 2.211 | [747](https://www.youtube.com/watch?v=6k6QwYL6NzA), [762](https://www.youtube.com/watch?v=JSHrZuAy9uo) |  |
| A | Пассив во всех временах | 2.221, 2.226, 2.231, 2.241 | [772](https://www.youtube.com/watch?v=_QTpE9YRIog), [777](https://www.youtube.com/watch?v=k30PW6j0i50), [782](https://www.youtube.com/watch?v=QgvQcvK-lso), [792](https://www.youtube.com/watch?v=lKy85mitOPo) |  |
| A | Модальные в прошедшем (must have done) | 2.297, 2.303 | [848](https://www.youtube.com/watch?v=RIPD00DDXEk), [854](https://www.youtube.com/watch?v=eE_sqWpL-lo) |  |
| A | 3-е условное, смешанные, wish | 2.310, 2.319 | [861](https://www.youtube.com/watch?v=a2NXNeUKhcU), [870](https://www.youtube.com/watch?v=EEMmcyY2nvc) |  |
| A | have something done, get used to, feel like doing | 2.334 | [885](https://www.youtube.com/watch?v=NzG1Hio8rO0) |  |
| S | Инверсия, усилители (highly likely) | 2.331, 2.322 | [882](https://www.youtube.com/watch?v=i2cHBmDAuHk), [873](https://www.youtube.com/watch?v=cTtcmycgs9o) |  |

**Готовые наборы контрольных для Врат:**
- Врата D (Present Simple + to be): контрольные к урокам 1.35–1.48, № 97–162 в плейлисте;
- Врата C (will + Past Simple): контрольные к урокам 1.57–1.63 (№ 186–208) и 1.108–1.132 (№ 352–551);
- Врата B/A: итоговые контрольные ч.2 (№ 974–1032).

---

## 5. Не охвачено (HTTP 429)

YouTube перестал отдавать субтитры примерно после 130 запросов, повторные попытки тоже получили 429. Для этих видео тема **не проверена**:

- [314](https://www.youtube.com/watch?v=mdt3OoadgRs) — УРОК 107 Past Simple прошедшее время в английском языке
- [553](https://www.youtube.com/watch?v=7wN6Zi_KUE8) — ЧАСТЬ 2 УРОК 2
- [554](https://www.youtube.com/watch?v=8AbGUAK9lFY) — ЧАСТЬ 2 УРОК 3
- [555](https://www.youtube.com/watch?v=wmx8-shCavQ) — ЧАСТЬ 2 УРОК 4
- [556](https://www.youtube.com/watch?v=b5p_jAGlS_U) — ЧАСТЬ 2 УРОК 5
- [557](https://www.youtube.com/watch?v=Z3XpJfJbo5o) — ЧАСТЬ 2 УРОК 6
- [558](https://www.youtube.com/watch?v=mOy4ovI0uVA) — ЧАСТЬ 2 УРОК 7
- [575](https://www.youtube.com/watch?v=T6ZshkOzC20) — ЧАСТЬ 2 УРОК 24
- [576](https://www.youtube.com/watch?v=AvLgysmpY3w) — ЧАСТЬ 2 УРОК 25
- [577](https://www.youtube.com/watch?v=ooke6PBRcfg) — ЧАСТЬ 2 УРОК 26
- [578](https://www.youtube.com/watch?v=6fBL9ISy-co) — ЧАСТЬ 2 УРОК 27
- [580](https://www.youtube.com/watch?v=ztw1hFitLPk) — ЧАСТЬ 2 УРОК 29
- [582](https://www.youtube.com/watch?v=0Ux7ikp5oU0) — ЧАСТЬ 2 УРОК 31
- [585](https://www.youtube.com/watch?v=OvtrUyXDpF4) — ЧАСТЬ 2 УРОК 34
- [590](https://www.youtube.com/watch?v=pD3c0_f-_AE) — ЧАСТЬ 2 УРОК 39
- [592](https://www.youtube.com/watch?v=16L1uNFYPqs) — ЧАСТЬ 2 УРОК 41
- [595](https://www.youtube.com/watch?v=Rw27Qs2JOYI) — ЧАСТЬ 2 УРОК 44
- [667](https://www.youtube.com/watch?v=hDo-ksJ1vCA) — ЧАСТЬ 2 УРОК 116
- [672](https://www.youtube.com/watch?v=DQ6i0kfwZsc) — ЧАСТЬ 2 УРОК 121
- [677](https://www.youtube.com/watch?v=nMYs6du8Xq4) — ЧАСТЬ 2 УРОК 126
- [687](https://www.youtube.com/watch?v=971qeC8FV38) — ЧАСТЬ 2 УРОК 136
- [692](https://www.youtube.com/watch?v=OheAtXhdvck) — ЧАСТЬ 2 УРОК 141
- [702](https://www.youtube.com/watch?v=YaTRJuFGZs0) — ЧАСТЬ 2 УРОК 151
- [757](https://www.youtube.com/watch?v=F3e4Y2XSlfk) — ЧАСТЬ 2 УРОК 206
- [1033](https://www.youtube.com/watch?v=yT-Tlhe7hKk) — СУПЕР ТРЕНАЖЕР АНГЛИЙСКИЙ С НУЛЯ

Кроме того, **не проверялись** по субтитрам: уроки ч.1 65–72, 74–78, 80–88, 90–93 и 100–101 (тема из названия, Н), повторения ч.1 109–131 кроме 116 и 121 (тема «повторение» из названия), все «Практики», «Упражнения» и «Контрольные» (в них нет новых тем), 4 из каждых 5 уроков ч.2 в блоках без темы в названии.
