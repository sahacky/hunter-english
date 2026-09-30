#!/usr/bin/env python3
"""Пулы уроков S3 «Свободная речь и точность» (S-11…S-15) — план M20#20.4. specs/01 §10."""

S11 = [
    ("That's a tough one.", "Сложный вопрос.", None),
    ("Let me think for a second.", "Дай подумать секунду.", None),
    ("The way I see it, it's freedom.", "Как я это вижу, это свобода.", None),
    ("If you ask me, it's overrated.", "Если спросишь меня, это переоценено.", None),
    ("To be honest, I haven't decided.", "Честно говоря, я не решил.", None),
    ("It depends on the price.", "Зависит от цены.", None),
    ("Off the top of my head, ten.", "Навскидку — десять.", None),
    ("I'd say it's worth it.", "Я бы сказал, оно того стоит.", None),
    ("Frankly, I don't buy it.", "Откровенно говоря, я в это не верю.", None),
    ("That's a fair point.", "Справедливо.", None),
    ("You've got a point there.", "Тут ты прав.", None),
    ("I see it differently.", "Я вижу это иначе.", None),
    ("Correct me if I'm wrong.", "Поправь меня, если я не прав.", None),
    ("As far as I know, yes.", "Насколько я знаю, да.", None),
    ("In a nutshell, it's chaos.", "Если коротко, это хаос.", None),
    ("Long story short, we stayed.", "Короче говоря, мы остались.", None),
    ("Speaking of which, did you book?", "Кстати, ты забронировал?", None),
    ("That reminds me of home.", "Это напоминает мне дом.", None),
    ("Come to think of it, you're right.", "Подумав, ты прав.", None),
    ("It's hard to put into words.", "Трудно выразить словами.", None),
    ("I'm on the fence about it.", "Я пока сомневаюсь.", None),
    ("That's not how I'd put it.", "Я бы так не сказал.", None),
    ("If I had to choose, the mountains.", "Если выбирать, горы.", None),
    ("Don't get me wrong, I like it.", "Не пойми неправильно, мне нравится.", None),
    ("Let's agree to disagree.", "Давай останемся каждый при своём.", None),
    ("What it boils down to is time.", "Суть сводится ко времени.", None),
    ("I was getting to that.", "Я как раз к этому шёл.", None),
    ("Where do you stand on this?", "На какой ты стороне в этом вопросе?", None),
    ("That's beside the point.", "Это не по существу.", None),
    ("At the end of the day, it's your call.", "В итоге решать тебе.", None),
]

S12 = [
    ("You know what I mean.", "Ты понимаешь, о чём я.", None),
    ("It's sort of complicated.", "Это как бы сложно.", None),
    ("I kind of expected it.", "Я как бы ожидал этого.", None),
    ("I mean, why not?", "Ну, почему бы и нет?", None),
    ("It was, like, three in the morning.", "Было, типа, три утра.", None),
    ("Actually, that works better.", "Вообще, так даже лучше.", None),
    ("Basically, nothing changed.", "По сути, ничего не изменилось.", None),
    ("To be fair, we were warned.", "Справедливости ради, нас предупреждали.", None),
    ("At the end of the day, it's a job.", "В конечном счёте, это работа.", None),
    ("If that makes sense.", "Если так можно сказать.", None),
    ("Or something like that.", "Или что-то в этом духе.", None),
    ("You see, it's not about money.", "Понимаешь, дело не в деньгах.", None),
    ("I guess you're right.", "Наверное, ты прав.", None),
    ("No worries, take your time.", "Без проблем, не спеши.", None),
    ("Fair enough.", "Справедливо.", None),
    ("Mind you, the food was great.", "Между прочим, еда была отличная.", None),
    ("Anyway, where were we?", "В общем, на чём мы остановились?", None),
    ("By the way, I found a flat.", "Кстати, я нашёл квартиру.", None),
    ("It's not bad, to be honest.", "В принципе неплохо, честно.", None),
    ("All of a sudden, the lights died.", "Вдруг свет погас.", None),
    ("In the meantime, order a pizza.", "А пока закажи пиццу.", None),
    ("As I was saying, the bus is faster.", "Как я говорил, автобус быстрее.", None),
    ("That said, the view is priceless.", "Тем не менее, вид бесценен.", None),
    ("Come to think of it, I'm hungry.", "Кстати, я голоден.", None),
    ("Apparently, it's normal here.", "Судя по всему, здесь это нормально.", None),
    ("Honestly, I forgot.", "Честно, я забыл.", None),
    ("Frankly, that's nonsense.", "Откровенно, это чепуха.", None),
    ("You know, it might work.", "Знаешь, это может сработать.", None),
    ("Like I said, no rush.", "Как я уже сказал, не торопись.", None),
    ("In other words, we're stuck.", "Другими словами, мы застряли.", None),
]

S13 = [
    ("This topic is very topical.", "Эта тема очень актуальна.", None),
    ("The actual cost was lower.", "Фактическая цена была ниже.", None),
    ("He pretends to be busy.", "Он притворяется занятым.", None),
    ("She applied for a visa.", "Она подала заявку на визу.", None),
    ("I sympathise with you.", "Я тебе сочувствую.", None),
    ("He has a soft spot for cats.", "Он питает слабость к кошкам.", None),
    ("Her complexion is pale.", "У неё бледный цвет лица.", None),
    ("Kids, dinner's ready!", "Дети, ужин готов!", None),
    ("Children should be in bed by nine.", "Детям следует спать к девяти.", None),
    ("Please assist the customer.", "Пожалуйста, помогите клиенту.", None),
    ("Can you help me real quick?", "Можешь быстро помочь?", None),
    ("We require the original documents.", "Мы требуем оригиналы документов.", None),
    ("We need the originals, just scan them.", "Нам нужны оригиналы, просто отсканируй.", None),
    ("The concert commenced at eight.", "Концерт начался в восемь.", None),
    ("The show started late, as usual.", "Шоу началось поздно, как обычно.", None),
    ("Permit me to introduce myself.", "Позвольте представиться.", None),
    ("Hi, I'm Dima.", "Привет, я Дима.", None),
    ("It's a brilliant idea.", "Это блестящая идея.", None),
    ("The data is accurate, not approximate.", "Данные точные, а не приблизительные.", None),
    ("Don't treat it as a pretext.", "Не считай это отговоркой.", None),
    ("Could you clarify the fee?", "Не могли бы вы уточнить гонорар?", None),
    ("How much do I owe you?", "Сколько я тебе должен?", None),
    ("I appreciate your assistance.", "Я ценю вашу помощь.", None),
    ("Thanks a million!", "Спасибо огромное!", None),
    ("Regards, Anna.", "С уважением, Анна.", None),
    ("Later!", "Пока!", None),
    ("The article is topical for our region.", "Статья актуальна для нашего региона.", None),
    ("It was an actual emergency.", "Это была настоящая чрезвычайная ситуация.", None),
]

S14 = [
    ("That's a tough one.", "Сложный вопрос.", None),
    ("Let me think for a second.", "Дай подумать секунду.", None),
    ("The way I see it, it's freedom.", "Как я это вижу, это свобода.", None),
    ("I'd say it's worth it.", "Я бы сказал, оно того стоит.", None),
    ("Frankly, I don't buy it.", "Откровенно говоря, я в это не верю.", None),
    ("In a nutshell, it's chaos.", "Если коротко, это хаос.", None),
    ("Long story short, we stayed.", "Короче говоря, мы остались.", None),
    ("I'm on the fence about it.", "Я пока сомневаюсь.", None),
    ("Let's agree to disagree.", "Давай останемся каждый при своём.", None),
    ("At the end of the day, it's your call.", "В итоге решать тебе.", None),
    ("You know what I mean.", "Ты понимаешь, о чём я.", None),
    ("It's sort of complicated.", "Это как бы сложно.", None),
    ("To be fair, we were warned.", "Справедливости ради, нас предупреждали.", None),
    ("No worries, take your time.", "Без проблем, не спеши.", None),
    ("Fair enough.", "Справедливо.", None),
    ("Anyway, where were we?", "В общем, на чём мы остановились?", None),
    ("All of a sudden, the lights died.", "Вдруг свет погас.", None),
    ("That said, the view is priceless.", "Тем не менее, вид бесценен.", None),
    ("In other words, we're stuck.", "Другими словами, мы застряли.", None),
    ("This topic is very topical.", "Эта тема очень актуальна.", None),
    ("The actual cost was lower.", "Фактическая цена была ниже.", None),
    ("He pretends to be busy.", "Он притворяется занятым.", None),
    ("Please assist the customer.", "Пожалуйста, помогите клиенту.", None),
    ("It's a brilliant idea.", "Это блестящая идея.", None),
    ("Don't treat it as a pretext.", "Не считай это отговоркой.", None),
    ("It was an actual emergency.", "Это была настоящая чрезвычайная ситуация.", None),
    ("I binge-watched the whole season.", "Я проглотил весь сезон за раз.", None),
    ("Measures are being taken.", "Меры принимаются.", None),
    ("Had I known, I would have called.", "Если бы я знал, я бы позвонил.", None),
    ("It is believed that the house is haunted.", "Считается, что в доме живёт призрак.", None),
]

S15 = [
    ("The scene takes place at dawn.", "Сцена происходит на рассвете.", None),
    ("It foreshadows the ending.", "Это предвещает финал.", None),
    ("The pacing feels deliberate.", "Темп ощущается намеренным.", None),
    ("It's open to interpretation.", "Это оставляет простор для трактовки.", None),
    ("The tension builds slowly.", "Напряжение нарастает медленно.", None),
    ("It mirrors the opening scene.", "Это зеркалит начальную сцену.", None),
    ("Read between the lines.", "Читай между строк.", None),
    ("The dialogue does the heavy lifting.", "Диалог делает основную работу.", None),
    ("It's a study in restraint.", "Это этюд сдержанности.", None),
    ("The framing tells the story.", "Кадр рассказывает историю.", None),
    ("Nothing here is accidental.", "Здесь ничего случайного.", None),
    ("The silence speaks louder.", "Молчание говорит громче.", None),
    ("It subverts the trope.", "Это ломает штамп.", None),
    ("Watch the background characters.", "Следи за персонажами на фоне.", None),
    ("The music carries the emotion.", "Музыка несёт эмоцию.", None),
    ("It's deliberately ambiguous.", "Это намеренно двусмысленно.", None),
    ("The stakes shift midway.", "Ставки меняются на середине.", None),
    ("Notice the recurring motif.", "Заметь повторяющийся мотив.", None),
    ("The payoff lands in the last shot.", "Отдача приходит в последнем кадре.", None),
    ("It rewards a second watch.", "Он вознаграждает второй просмотр.", None),
    ("The subtext is the story.", "Подтекст и есть история.", None),
    ("Every glance is loaded.", "Каждый взгляд многозначителен.", None),
    ("The ending reframes everything.", "Финал переосмысляет всё.", None),
    ("Cinema of few words.", "Кинематограф немногих слов.", None),
]

RULE_S11 = """**Free talk: капсула импровизации.** <!-- REVIEW: спека S-11 требует «7 мин непрерывной речи» — таймер свободной речи за границами движка; реализована импровизация answer_question без подготовки -->
Функции, которыми держат разговор, когда нечего ответить:
Тянуть время: **That's a tough one. / Let me think for a second. / Off the top of my head…**
Мнение: **The way I see it… / If you ask me… / I'm on the fence about it.**
Уступить или удержать: **That's a fair point. / That's not how I'd put it. / Let's agree to disagree.**
Сжать: **In a nutshell… / Long story short… / What it boils down to is…**
Здесь нет «правильного» ответа — только твоя позиция."""

RULE_S12 = """**Дискурс-маркеры носителей.**
Слова-связки, на которых держится живая речь:
**You know what I mean.** — понимаешь, о чём я. **sort of / kind of** — как бы.
**I mean…** — ну, то есть. **Actually…** — вообще-то. **Basically…** — по сути.
**To be fair…** — справедливости ради. **At the end of the day…** — в конечном счёте.
**Fair enough.** — справедливо. **No worries.** — без проблем. **Mind you…** — между прочим.
**That said…** — тем не менее. **Apparently…** — судя по всему. **Like I said…** — как я уже говорил.
Не переводятся дословно — ловятся на слух и вставляются в свою речь."""

RULE_S13 = """**False friends и стилистические регистры.**
Ложные друзья (ЛТ-25): **actual** = фактический, реальный (актуальный = **topical**).
**pretend** = притворяться (претендовать = **apply for**). **sympathy** = сочувствие (симпатия = **a soft spot**).
**pretext** = отговорка (предлог = **preposition**).
Регистры: детям и друзьям — **kids, help, need, start, Later!**;
в документах и вежливо — **children, assist, require, commence, Regards**.
Смысл один — окраска разная."""

RULE_S14 = """**Повторение №27 + большой диктант.**
Free talk: tough one, fair point, on the fence, agree to disagree.
Маркеры: sort of, actually, fair enough, that said, in other words.
Точность: actual/topical, pretend/pretext, assist/help.
Большой диктант: быстрые фразы из сериалов — слушай два раза, пиши сразу."""

RULE_S15 = """**Разбор сцены: колода цитат.** <!-- REVIEW: литеральная «кликабельная читалка» эпизода — отдельная будущая механика (specs/01 §10 «перспектива»); в M20 — разбор-колода на механиках M11 -->
Десять цитат-сцен + словарь кинокритика:
**foreshadow** — предвещать; **open to interpretation** — простор для трактовки;
**read between the lines** — читать между строк; **subvert the trope** — ломать штамп;
**deliberately ambiguous** — намеренно двусмысленно; **recurring motif** — повторяющийся мотив;
**the payoff** — отдача, кульминационная награда; **subtext** — подтекст.
Смотри сцену дважды: **It rewards a second watch.**"""


LESSONS_S3 = [
    {
        "id": "les-s-11", "module": "mod-s-3",
        "title": "Free talk: капсула импровизации",
        "gp_id": "gp-s-11", "gp_title": "Держать разговор без подготовки",
        "rule_md": RULE_S11,
        "phrases": S11,
        "rule_cloze": [
            ("___ a tough one.", ["That's"]),
            ("I'm on the ___ about it.", ["fence"]),
            ("In a ___, it's chaos.", ["nutshell"]),
        ],
        "quotes": [("q-igry-0002", "awhile"), ("q-igry-0006", "better")],
        "trap_id": None,
        "vocab_band": {"list": "subtitles", "from": 4601, "to": 4700},
        "phrasebook_topic": None,
        "quotes_topic": "improv",
        "bebris_video": None,
        "answer_question": [
            ("What's your take on solo travel?", "The way I see it, it's freedom."),
            ("Beach or mountains?", "If I had to choose, the mountains."),
            ("Is the trip worth the money?", "I'd say it's worth it."),
            ("Are you for or against remote work?", "I'm on the fence about it."),
        ],
        "find_error": [("Lets agree to disagree.", "Let's agree to disagree.")],
        "verb_tense": [
            ("That ___ me of home. (напоминает)", "форма", ["reminds"]),
            ("I was ___ to that. (шёл к этому)", "форма", ["getting"]),
            ("What it ___ down to is time.", "форма", ["boils"]),
        ],
    },
    {
        "id": "les-s-12", "module": "mod-s-3",
        "title": "Дискурс-маркеры носителей",
        "gp_id": "gp-s-12", "gp_title": "Связки живой речи",
        "rule_md": RULE_S12,
        "phrases": S12,
        "rule_cloze": [
            ("It's ___ of complicated.", ["sort"]),
            ("___, that works better.", ["Actually"]),
            ("If that ___ sense.", ["makes"]),
        ],
        "quotes": [("q-memy-0004", "fellow"), ("q-memy-0001", "fine")],
        "trap_id": None,
        "vocab_band": {"list": "subtitles", "from": 4701, "to": 4760},
        "phrasebook_topic": None,
        "quotes_topic": "discourse",
        "bebris_video": None,
        "answer_question": [("Can I send the file tomorrow?", "No worries, take your time.")],
        "find_error": [("At the end of the day its a job.", "At the end of the day, it's a job.")],
        "verb_tense": [
            ("I ___ of expected it. (полная форма kinda)", "форма", ["kind"]),
            ("All of a sudden, the lights ___. (погасли)", "форма", ["died"]),
            ("As I ___ saying, the bus is faster.", "форма", ["was"]),
        ],
    },
    {
        "id": "les-s-13", "module": "mod-s-3",
        "title": "False friends и стилистические регистры",
        "gp_id": "gp-s-13", "gp_title": "actual ≠ актуальный; kids ≠ children",
        "rule_md": RULE_S13,
        "phrases": S13,
        "rule_cloze": [
            ("This topic is very ___.", ["topical"]),
            ("He ___ to be busy.", ["pretends"]),
            ("I ___ with you. (сочувствую)", ["sympathise"]),
        ],
        "quotes": [],
        "trap_id": "trap-false-friends",
        "vocab_band": {"list": "subtitles", "from": 4761, "to": 4820},
        "phrasebook_topic": None,
        "quotes_topic": None,
        "bebris_video": None,
        "answer_question": [("Was it a real emergency?", "It was an actual emergency.")],
        "find_error": [("This topic is very actual.", "This topic is very topical.")],
        "verb_tense": [
            ("The actual cost ___ lower. (была)", "форма", ["was"]),
            ("She ___ for a visa. (подала заявку)", "форма", ["applied"]),
            ("The concert ___ at eight. (начался, формально)", "форма", ["commenced"]),
        ],
    },
    {
        "id": "les-s-14", "module": "mod-s-3",
        "title": "Повторение №27 + большой диктант",
        "gp_id": "gp-s-14", "gp_title": "Микс S3 + диктант на скорости",
        "rule_md": RULE_S14,
        "phrases": S14,
        "rule_cloze": [
            ("I'm on the ___ about it.", ["fence"]),
            ("___ enough.", ["Fair"]),
            ("This topic is very ___.", ["topical"]),
        ],
        "quotes": [("q-breaking-bad-0002", "danger"), ("q-jujutsu-kaisen-0015", "hero")],
        "trap_id": "trap-false-friends",
        "vocab_band": {"list": "subtitles", "from": 4821, "to": 4880},
        "phrasebook_topic": None,
        "quotes_topic": "mixed",
        "bebris_video": None,
        "dict_count": 9,
        "answer_question": [("So, is the deal worth it?", "I'd say it's worth it.")],
        "find_error": [("He pretend to be busy.", "He pretends to be busy.")],
        "verb_tense": [
            ("All of a sudden, the lights ___. (погасли)", "форма", ["died"]),
            ("The actual cost ___ lower. (была)", "форма", ["was"]),
            ("She ___ for a visa. (подала заявку)", "форма", ["applied"]),
        ],
    },
    {
        "id": "les-s-15", "module": "mod-s-3",
        "title": "Разбор сцены: колода цитат",
        "gp_id": "gp-s-15", "gp_title": "Язык кинокритика + cloze по сценам",
        "rule_md": RULE_S15,
        "phrases": S15,
        "rule_cloze": [
            ("It ___ the ending.", ["foreshadows"]),
            ("Read between the ___.", ["lines"]),
            ("The subtext is the ___.", ["story"]),
        ],
        "quotes": [
            ("q-lord-of-the-rings-0020", "dangerous"),
            ("q-lord-of-the-rings-0013", "end"),
            ("q-lord-of-the-rings-0004", "glad"),
            ("q-berserk-0006", "drink"),
            ("q-berserk-0013", "cry"),
            ("q-attack-on-titan-0007", "cruel"),
            ("q-attack-on-titan-0006", "forward"),
            ("q-solo-leveling-0003", "target"),
            ("q-black-mirror-0027", "carrot"),
            ("q-berserk-0027", "painstakingly"),
        ],
        "trap_id": None,
        "vocab_band": {"list": "subtitles", "from": 4881, "to": 5000},
        "phrasebook_topic": None,
        "quotes_topic": "scenes",
        "bebris_video": None,
        "answer_question": [("Why rewatch it?", "It rewards a second watch.")],
        "find_error": [("It's open to interpretations.", "It's open to interpretation.")],
        "verb_tense": [
            ("The scene ___ place at dawn.", "форма", ["takes"]),
            ("The tension ___ slowly.", "форма", ["builds"]),
            ("It ___ the opening scene.", "форма", ["mirrors"]),
        ],
    },
]
