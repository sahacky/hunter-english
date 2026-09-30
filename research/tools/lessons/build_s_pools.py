#!/usr/bin/env python3
"""Пулы уроков S1 «Эмфаза и стиль» (S-01…S-06) — план M20#20.2. specs/01 §10."""

S01 = [
    ("Not only did we lose the map, but we also lost the tent.", "Мы не только потеряли карту, но и палатку.", None),
    ("No sooner had the bell rung than the students vanished.", "Не успел прозвенеть звонок, как ученики исчезли.", None),
    ("Hardly had I sat down when the phone rang.", "Едва я сел, как зазвонил телефон.", None),
    ("Not until midnight did he finally call.", "Только в полночь он наконец позвонил.", None),
    ("Only then did I understand the truth.", "Только тогда я понял правду.", None),
    ("Never have I seen such chaos.", "Никогда я не видел такого хаоса.", None),
    ("Little did she suspect the surprise party.", "Она и не подозревала о вечеринке-сюрпризе.", None),
    ("So loud was the music that we left.", "Настолько громкой была музыка, что мы ушли.", None),
    ("So beautiful was the view that we stopped.", "Настолько прекрасным был вид, что мы остановились.", None),
    ("Neither do I.", "Я тоже (не).", None),
    ("Nor do I believe a word of it.", "И я в это ни за что не поверю.", None),
    ("Not only is she brilliant, but she is also kind.", "Она не только блестяща, но и добра.", None),
    ("No sooner said than done.", "Сказано — сделано.", None),
    ("Hardly a day goes by without a new message.", "Не проходит и дня без нового сообщения.", None),
    ("Not once did he mention the price.", "Ни разу он не упомянул цену.", None),
    ("Only later did we realise our mistake.", "Только позже мы осознали нашу ошибку.", None),
    ("Never again will I trust that website.", "Никогда больше я не буду доверять тому сайту.", None),
    ("Rarely does the train arrive on time.", "Редко поезд приходит вовремя.", None),
    ("Seldom have I heard such nonsense.", "Редко я слышал такой вздор.", None),
    ("In no way is this acceptable.", "Это никоим образом не приемлемо.", None),
    ("Under no circumstances should you sign it.", "Ни при каких обстоятельствах не подписывай это.", None),
    ("At no point did she lose her temper.", "Она ни разу не потеряла самообладание.", None),
    ("Not only did we finish early, but we also saved money.", "Мы не только закончили рано, но и сэкономили деньги.", None),
    ("No sooner had the show started than the power went out.", "Не успело шоу начаться, как отключилось электричество.", None),
    ("Hardly had we arrived when the storm began.", "Едва мы прибыли, как начался шторм.", None),
    ("Only now do I see the whole picture.", "Только сейчас я вижу всю картину.", None),
    ("Never before had technology moved this fast.", "Никогда прежде технологии не двигались так быстро.", None),
    ("So strange was his answer that nobody replied.", "Таким странным был его ответ, что никто не ответил.", None),
    ("Not a single word did she say.", "Она не сказала ни единого слова.", None),
    ("Never have I felt more alive.", "Ещё никогда я не чувствовал себя настолько живым.", None),
    ("Never again!", "Никогда больше!", None),
    ("Not a chance.", "Ни за что.", None),
    ("Here comes the train.", "Вот идёт поезд.", None),
    ("Down came the rain.", "И хлынул дождь.", None),
    ("Off we went!", "И мы отправились!", None),
]

S02 = [
    ("The flight was overbooked.", "Рейс был перепродан.", None),
    ("We took the red-eye to London.", "Мы взяли ночной рейс на Лондон.", None),
    ("We booked at the last minute.", "Мы забронировали в последний момент.", None),
    ("Let's hit the road early.", "Выедем пораньше.", None),
    ("A guided tour won't break the bank.", "Экскурсия не разорит.", None),
    ("We arrived just in time to check in.", "Мы пришли как раз вовремя на регистрацию.", None),
    ("I always suffer from jet lag.", "Я всегда страдаю от джетлага.", None),
    ("Total culture shock, honestly.", "Полный культурный шок, честно.", None),
    ("We prefer places off the beaten track.", "Мы предпочитаем места вдали от проторённых маршрутов.", None),
    ("We travel light, always.", "Мы путешествуем налегке, всегда.", None),
    ("We're on a tight budget.", "У нас ограниченный бюджет.", None),
    ("Let's call it a day.", "Давай закончим на сегодня.", None),
    ("Sorry, we're running late.", "Извините, мы опаздываем.", None),
    ("You'll get the hang of the metro.", "Ты освоишь метро.", None),
    ("Can I take a rain check on dinner?", "Можно отложить ужин на другой раз?", None),
    ("I'm feeling a bit under the weather.", "Я чувствую себя неважно.", None),
    ("Climbing here is a piece of cake.", "Подниматься здесь — проще простого.", None),
    ("Museums are not my cup of tea.", "Музеи — не моё.", None),
    ("It was a once-in-a-lifetime trip.", "Это была поездка всей жизни.", None),
    ("The deadline is around the corner.", "Крайний срок не за горами.", None),
    ("In the long run, it saves money.", "В долгосрочной перспективе это экономит деньги.", None),
    ("Coffee helps me stay on the go.", "Кофе помогает мне быть в движении.", None),
    ("Our plans hit a snag at the border.", "На границе наши планы дали сбой.", None),
    ("Book now or you'll miss the boat.", "Бронируй сейчас, иначе упустишь шанс.", None),
    ("We had to bite the bullet and pay.", "Пришлось собраться с духом и заплатить.", None),
    ("Keep an eye on your bag.", "Следи за сумкой.", None),
    ("We made a detour to the coast.", "Мы сделали крюк до побережья.", None),
    ("Dinner at eight sounds like a plan.", "Ужин в восемь звучит как план.", None),
    ("I got cold feet before the flight.", "Я занервничал перед рейсом.", None),
    ("The city grew on me.", "Город мне понравился со временем.", None),
    ("We were worn out by noon.", "К полудню мы выдохлись.", None),
    ("When in doubt, book ahead.", "Сомневаешься — бронируй заранее.", None),
    ("Red-eye, please.", "Ночной рейс, пожалуйста.", None),
    ("Around the corner.", "Не за горами.", None),
]

S03 = [
    ("She might well be right.", "Она вполне может быть права.", None),
    ("He can't have been at home.", "Не может быть, чтобы он был дома.", None),
    ("You needn't have worried.", "Мог бы и не волноваться — зря волновался.", None),
    ("They may well change their minds.", "Они вполне могут передумать.", None),
    ("We should have read the reviews.", "Нам следовало почитать отзывы.", None),
    ("He must have left already.", "Должно быть, он уже ушёл.", None),
    ("We might as well walk.", "Можем с тем же успехом пойти пешком.", None),
    ("I'd rather stay in tonight.", "Я бы лучше остался дома сегодня.", None),
    ("You'd better hurry up.", "Тебе лучше поторопиться.", None),
    ("She couldn't have asked for more.", "Она и большего желать не могла.", None),
    ("They needn't have paid extra.", "Могли и не платить дополнительно — зря заплатили.", None),
    ("You might have told me!", "Мог бы и сказать мне!", None),
    ("He can't have finished so fast.", "Не может быть, что он закончил так быстро.", None),
    ("I may well be wrong.", "Возможно, я и неправ.", None),
    ("We'd better not be late.", "Лучше нам не опаздывать.", None),
    ("She must have mixed up the dates.", "Должно быть, она перепутала даты.", None),
    ("You needn't have brought anything.", "Мог бы ничего и не приносить.", None),
    ("I'd rather not say.", "Я бы предпочёл не говорить.", None),
    ("They might as well have stayed home.", "Могли с тем же успехом остаться дома.", None),
    ("He should have double-checked the booking.", "Ему следовало перепроверить бронь.", None),
    ("It can't have been easy for them.", "Наверняка им было непросто.", None),
    ("You might well ask.", "Вполне резонный вопрос.", None),
    ("We may as well get started.", "Можем уж начинать.", None),
    ("I'd sooner quit than cheat.", "Я скорее уйду, чем буду жульничать.", None),
    ("She ought to have apologised.", "Ей следовало извиниться.", None),
    ("He couldn't have heard us from there.", "Оттуда он не мог нас слышать.", None),
    ("You must have been exhausted.", "Ты, должно быть, был измотан.", None),
    ("They should have seen it coming.", "Они должны были это предвидеть.", None),
    ("I needn't have rushed.", "Зря я торопился.", None),
    ("It might well snow tonight.", "Вполне может выпасть снег сегодня вечером.", None),
    ("You had better believe it.", "Можешь не сомневаться.", None),
    ("None of it can have been true.", "Ничто из этого не могло быть правдой.", None),
    ("Might as well.", "Чем чёрт не шутит.", None),
    ("Better not risk it.", "Лучше не рисковать.", None),
]

S04 = [
    ("However, we decided to go.", "Однако мы решили пойти.", None),
    ("Nevertheless, the show went on.", "Тем не менее шоу продолжилось.", None),
    ("The north is rich, whereas the south is poor.", "Север богат, тогда как юг беден.", None),
    ("Despite the rain, the match went ahead.", "Несмотря на дождь, матч состоялся.", None),
    ("In spite of the traffic, we made it.", "Несмотря на пробки, мы успели.", None),
    ("Although it was late, nobody left.", "Хотя было поздно, никто не ушёл.", None),
    ("Even though she knew the risk, she agreed.", "Даже зная риск, она согласилась.", None),
    ("He's loud; nevertheless, everyone likes him.", "Он громкий; тем не менее все его любят.", None),
    ("The plan was risky; however, it worked.", "План был рискованным; однако он сработал.", None),
    ("I like tea, whereas she prefers coffee.", "Я люблю чай, тогда как она предпочитает кофе.", None),
    ("Despite being tired, they kept walking.", "Несмотря на усталость, они продолжали идти.", None),
    ("Therefore, we need a backup plan.", "Следовательно, нам нужен запасной план.", None),
    ("Moreover, the tickets are refundable.", "Более того, билеты возвратные.", None),
    ("The food was bland; the service, however, was excellent.", "Еда была пресной; сервис, однако, был отличным.", None),
    ("Nonetheless, it's worth a try.", "Тем не менее, стоит попробовать.", None),
    ("On the other hand, flying saves time.", "С другой стороны, самолёт экономит время.", None),
    ("Consequently, prices went up.", "В результате цены выросли.", None),
    ("Despite the delay, the mood stayed high.", "Несмотря на задержку, настроение оставалось отличным.", None),
    ("Whereas I walk, he drives everywhere.", "Тогда как я хожу, он везде ездит.", None),
    ("Furthermore, there's no service charge.", "Кроме того, нет платы за обслуживание.", None),
    ("It was expensive; still, we bought it.", "Это было дорого; и всё же мы купили.", None),
    ("Though small, the flat feels airy.", "Хоть и маленькая, квартира кажется просторной.", None),
    ("All the same, I'd rather wait.", "Тем не менее, я бы предпочёл подождать.", None),
    ("Despite the cost, quality comes first.", "Несмотря на цену, качество — прежде всего.", None),
    ("Hence the delay, apparently.", "Отсюда, видимо, и задержка.", None),
    ("Even so, the trip was worth it.", "Даже так, поездка того стоила.", None),
    ("In contrast, our rivals cut corners.", "Напротив, конкуренты экономят на качестве.", None),
    ("Meanwhile, back home, life went on.", "Тем временем дома жизнь шла своим чередом.", None),
    ("Instead of complaining, act.", "Вместо того чтобы жаловаться, действуй.", None),
    ("Admittedly, the first version was rough.", "Признаю, первая версия была сырой.", None),
    ("Granted, it takes practice.", "Согласен, это требует практики.", None),
    ("After all, we're only human.", "В конце концов, мы всего лишь люди.", None),
    ("Granted.", "Согласен.", None),
    ("After all.", "В конце концов.", None),
]

S05 = [
    ("I'm gonna be late.", "Я опоздаю.", None),
    ("What are you gonna do?", "И что ты будешь делать?", None),
    ("I wanna go home.", "Я хочу домой.", None),
    ("I gotta go.", "Мне пора бежать.", None),
    ("She ain't coming.", "Она не придёт.", None),
    ("You gotta be kidding me.", "Ты издеваешься.", None),
    ("Nothing's gonna change.", "Ничего не изменится.", None),
    ("We're gonna make it.", "Мы успеем.", None),
    ("I dunno what you mean.", "Не знаю, о чём ты.", None),
    ("Gimme a second.", "Дай секунду.", None),
    ("Wanna grab a coffee?", "Хочешь взять кофе?", None),
    ("He's gonna regret this.", "Он пожалеет об этом.", None),
    ("Ain't nobody got time for that.", "Ни у кого нет на это времени.", None),
    ("I'm not gonna lie, it was rough.", "Не буду врать, было тяжело.", None),
    ("You wanna bet?", "Спорим?", None),
    ("Gotta run, see you.", "Побежал, до встречи.", None),
    ("Whatcha doing?", "Чем занимаешься?", None),
    ("Kinda busy right now.", "Как бы занят сейчас.", None),
    ("Sorta funny, actually.", "Как бы смешно, вообще-то.", None),
    ("C'mon, we're late.", "Да ладно, мы опаздываем.", None),
    ("Outta my way!", "С дороги!", None),
    ("Lemme think about it.", "Дай мне подумать.", None),
    ("I'm gonna grab some shut-eye.", "Я пойду вздремну.", None),
    ("Nope, not gonna happen.", "Неа, этого не будет.", None),
    ("Yeah, I'm down.", "Да, я за.", None),
    ("It's gonna cost ya.", "Это тебе влетит в копеечку.", None),
    ("Dunno, maybe tomorrow.", "Не знаю, может, завтра.", None),
    ("She's kinda upset with you.", "Она на тебя слегка обижена.", None),
    ("I'm wiped out, honestly.", "Я вымотан, честно.", None),
    ("Hang on a sec.", "Погоди секунду.", None),
]

# Повторение №25 — микс S-01…S-05 (тексты переиспользуются, id сквозные — прецедент M16)
S06 = [
    ("No sooner had we left than it started to rain.", "Не успели мы выйти, как начался дождь.", None),
    ("Only then did I understand the truth.", "Только тогда я понял правду.", None),
    ("Neither do I.", "Я тоже (не).", None),
    ("Rarely does the train arrive on time.", "Редко поезд приходит вовремя.", None),
    ("Under no circumstances should you sign it.", "Ни при каких обстоятельствах не подписывай это.", None),
    ("Never have I felt more alive.", "Ещё никогда я не чувствовал себя настолько живым.", None),
    ("The flight was overbooked.", "Рейс был перепродан.", None),
    ("Let's call it a day.", "Давай закончим на сегодня.", None),
    ("Museums are not my cup of tea.", "Музеи — не моё.", None),
    ("Keep an eye on your bag.", "Следи за сумкой.", None),
    ("When in doubt, book ahead.", "Сомневаешься — бронируй заранее.", None),
    ("Our plans hit a snag at the border.", "На границе наши планы дали сбой.", None),
    ("You needn't have worried.", "Мог бы и не волноваться — зря волновался.", None),
    ("She might well be right.", "Она вполне может быть права.", None),
    ("You'd better hurry up.", "Тебе лучше поторопиться.", None),
    ("He must have left already.", "Должно быть, он уже ушёл.", None),
    ("I'd rather not say.", "Я бы предпочёл не говорить.", None),
    ("It can't have been easy for them.", "Наверняка им было непросто.", None),
    ("Nevertheless, the show went on.", "Тем не менее шоу продолжилось.", None),
    ("Despite the rain, the match went ahead.", "Несмотря на дождь, матч состоялся.", None),
    ("I like tea, whereas she prefers coffee.", "Я люблю чай, тогда как она предпочитает кофе.", None),
    ("Consequently, prices went up.", "В результате цены выросли.", None),
    ("Instead of complaining, act.", "Вместо того чтобы жаловаться, действуй.", None),
    ("I wanna go home.", "Я хочу домой.", None),
    ("I gotta go.", "Мне пора бежать.", None),
    ("You gotta be kidding me.", "Ты издеваешься.", None),
    ("Gimme a second.", "Дай секунду.", None),
    ("Hang on a sec.", "Погоди секунду.", None),
]

RULE_S01 = """**Инверсия продвинутая — эмфаза.**
После отрицательных/ограничительных наречий — вопросительный порядок слов:
**Not only did he** apologise… / **No sooner had we** left **than**… /
**Hardly had I** sat down **when**… / **Not until midnight did** he call.
**Only then did** I understand. / **Under no circumstances should** you sign it.
So + прилагательное вперёд: **So loud was the music** that…
Ответ-согласие: **Neither do I. / Nor do I.**"""

RULE_S02 = """**Идиомы путешественника.**
Идиому учи целиком, смысл не складывается из слов:
**red-eye** — ночной рейс; **overbooked** — перепродан;
**at the last minute** — в последний момент; **hit the road** — отправиться в путь;
**break the bank** — разорить; **jet lag** — сбой биоритмов после перелёта;
**off the beaten track** — вдали от туристов; **travel light** — налегке;
**call it a day** — закругляться; **take a rain check** — перенести на потом;
**under the weather** — неважно себя чувствовать; **a piece of cake** — проще простого;
**miss the boat** — упустить шанс; **bite the bullet** — собраться с духом;
**better safe than sorry** — лучше перестраховаться."""

RULE_S03 = """**Тонкости модальных: догадки и упрёки.**
Степень уверенности о прошлом: **must have** done (наверняка) → **might/may well have** done (возможно) → **can't have** done (исключено).
**needn't have** done — делал, но было зря: You **needn't have worried**.
**should have** done — упрёк: He **should have** double-checked.
**might as well** — не хуже чем: We **might as well** walk.
**would rather / 'd sooner** — предпочитаю: I**'d rather** stay in.
**had better ('d better)** — совет с оттенком угрозы: You**'d better** hurry."""

RULE_S04 = """**Продвинутые связки.**
Противопоставление: **however**, **nevertheless**, **nonetheless**, **all the same**, **even so** — «тем не менее».
Сопоставление: **whereas** — тогда как: The north is rich, **whereas** the south is poor.
Уступка: **despite / in spite of** + существительное или герундий (НЕ «despite of»):
**Despite the rain** / **Despite being tired**. Хотя = **although / even though / though**.
Следствие: **therefore / consequently / hence**. Добавка: **moreover / furthermore**."""

RULE_S05 = """**Разговорное сжатие: gonna / wanna / gotta / ain't.**
На слух обязательно, на письме — только в переписке с друзьями (ЛТ-24).
**gonna** = going to: I'**m gonna** be late. **wanna** = want to: I **wanna** go home.
**gotta** = have got to: I **gotta** go. **ain't** = am/is/are not: She **ain't** coming.
Сжатия: **dunno** = don't know, **gimme** = give me, **lemme** = let me,
**kinda/sorta** = kind of / sort of, **outta** = out of, **whatcha** = what are you.
В деловом письме: going to, want to, have to, is not."""

RULE_S06 = """**Повторение №25: эмфаза и стиль.**
Инверсия: No sooner had we left… / Neither do I. / So loud was the music…
Идиомы: red-eye, call it a day, bite the bullet, better safe than sorry.
Модальные оттенки: needn't have worried, must have left, 'd rather, 'd better.
Связки: whereas, despite (без of!), nevertheless. Сленг на слух: gonna, gotta, gimme."""


LESSONS_S1 = [
    {
        "id": "les-s-01", "module": "mod-s-1",
        "title": "Инверсия продвинутая: Not only…, No sooner…",
        "gp_id": "gp-s-01", "gp_title": "Эмфаза: наречие вперёд — порядок слов как в вопросе",
        "rule_md": RULE_S01,
        "phrases": S01,
        "rule_cloze": [
            ("No sooner ___ the bell rung than the students vanished.", ["had"]),
            ("Not only ___ we lose the map, but we also lost the tent.", ["did"]),
            ("Neither ___ I.", ["do", "am", "have"]),
        ],
        "quotes": [("q-solo-leveling-0005", "survive"), ("q-solo-leveling-0015", "alone")],
        "trap_id": "trap-question-word-order",
        "vocab_band": {"list": "subtitles", "from": 4001, "to": 4060},
        "phrasebook_topic": None,
        "quotes_topic": "emphatic",
        "bebris_video": {"lesson": "2.331", "playlist_index": 882, "youtube_id": "i2cHBmDAuHk", "title": None},
        "answer_question": [
            ("Did you only lose the map?", "Not only did we lose the map, but we also lost the tent.")
        ],
        "find_error": [
            ("No sooner the bell had rung than the students vanished.", "No sooner had the bell rung than the students vanished.")
        ],
        "verb_tense": [
            ("Hardly ___ I sat down when the phone rang.", "форма", ["had"]),
            ("Not until midnight ___ he finally call.", "форма", ["did"]),
            ("So loud ___ the music that we left.", "форма", ["was"]),
        ],
    },
    {
        "id": "les-s-02", "module": "mod-s-1",
        "title": "Идиомы путешественника (топ-50)",
        "gp_id": "gp-s-02", "gp_title": "Идиома — цельная единица, не дословный перевод",
        "rule_md": RULE_S02,
        "phrases": S02,
        "rule_cloze": [
            ("The flight was ___. (перепродан)", ["overbooked"]),
            ("Let's ___ it a day.", ["call"]),
            ("We had to bite the ___ and pay.", ["bullet"]),
        ],
        "quotes": [("q-breaking-bad-0016", "lightly"), ("q-game-of-thrones-0013", "debts")],
        "trap_id": "trap-do-make",
        "vocab_band": {"list": "subtitles", "from": 4061, "to": 4120},
        "phrasebook_topic": "idioms",
        "quotes_topic": "idioms",
        "bebris_video": None,
        "answer_question": [("Are we still on for dinner at eight?", "Dinner at eight sounds like a plan.")],
        "find_error": [("Museums are not my cup of the tea.", "Museums are not my cup of tea.")],
        "verb_tense": [
            ("We ___ the red-eye to London. (взяли)", "форма", ["took", "have taken"]),
            ("Our plans ___ a snag at the border. (застряли на)", "форма", ["hit"]),
            ("The city ___ on me. (понравился со временем)", "форма", ["grew"]),
        ],
    },
    {
        "id": "les-s-03", "module": "mod-s-1",
        "title": "Тонкости модальных: might well, can't have been, needn't have",
        "gp_id": "gp-s-03", "gp_title": "Догадки о прошлом и упрёки",
        "rule_md": RULE_S03,
        "phrases": S03,
        "rule_cloze": [
            ("You needn't have ___. (волноваться)", ["worried"]),
            ("She might ___ be right.", ["well", "just"]),
            ("He can't ___ been at home.", ["have"]),
        ],
        "quotes": [("q-jujutsu-kaisen-0014", "risking"), ("q-jujutsu-kaisen-0011", "proud")],
        "trap_id": None,
        "vocab_band": {"list": "subtitles", "from": 4121, "to": 4180},
        "phrasebook_topic": None,
        "quotes_topic": "modals",
        "bebris_video": None,
        "answer_question": [("Did I need to worry about the test?", "You needn't have worried.")],
        "find_error": [("She must has mixed up the dates.", "She must have mixed up the dates.")],
        "verb_tense": [
            ("He ___ have left already. (должно быть)", "форма", ["must"]),
            ("You ___ have told me! (мог бы)", "форма", ["might", "could"]),
            ("She ___ to have apologised. (следовало)", "форма", ["ought"]),
        ],
    },
    {
        "id": "les-s-04", "module": "mod-s-1",
        "title": "Продвинутые связки: however, nevertheless, whereas, despite",
        "gp_id": "gp-s-04", "gp_title": "Дискурс: противопоставление и уступка",
        "rule_md": RULE_S04,
        "phrases": S04,
        "rule_cloze": [
            ("___ the rain, the match went ahead.", ["Despite"]),
            ("I like tea, ___ she prefers coffee.", ["whereas", "while"]),
            ("It was expensive; ___, we bought it. (всё же)", ["still", "even so"]),
        ],
        "quotes": [("q-berserk-0004", "alone"), ("q-berserk-0014", "worry")],
        "trap_id": "trap-despite-of",
        "vocab_band": {"list": "subtitles", "from": 4181, "to": 4240},
        "phrasebook_topic": None,
        "quotes_topic": "discourse",
        "bebris_video": None,
        "answer_question": [("Was the match cancelled because of rain?", "Despite the rain, the match went ahead.")],
        "find_error": [("Despite of the rain, the match went ahead.", "Despite the rain, the match went ahead.")],
        "verb_tense": [
            ("The north ___ rich, whereas the south is poor. (является)", "форма", ["is"]),
            ("Prices ___ up, consequently. (выросли)", "форма", ["went", "have gone"]),
            ("Despite ___ tired, they kept walking. (быть)", "форма", ["being"]),
        ],
    },
    {
        "id": "les-s-05", "module": "mod-s-1",
        "title": "Разговорное сжатие: gonna/wanna/gotta/ain't",
        "gp_id": "gp-s-05", "gp_title": "Сленг на слух — полные формы на письме",
        "rule_md": RULE_S05,
        "phrases": S05,
        "rule_cloze": [
            ("I'm ___ be late.", ["gonna"]),
            ("___ a second. (сленг: дай)", ["Gimme"]),
            ("She ___ coming.", ["ain't", "isn't"]),
        ],
        "quotes": [("q-memy-0007", "Nah"), ("q-igry-0007", "again")],
        "trap_id": "trap-slang-register",
        "vocab_band": {"list": "subtitles", "from": 4241, "to": 4300},
        "phrasebook_topic": None,
        "quotes_topic": "slang",
        "bebris_video": None,
        "answer_question": [("Can we make it on time?", "We're gonna make it.")],
        "find_error": [("I gonna be late.", "I'm gonna be late.")],
        "verb_tense": [
            ("Nothing's ___ to change. (going)", "форма", ["going"]),
            ("I ___ know what you mean. (полная форма dunno)", "форма", ["don't"]),
            ("You ___ be kidding me. (полная форма gotta)", "форма", ["have got to"]),
        ],
    },
    {
        "id": "les-s-06", "module": "mod-s-1",
        "title": "Повторение №25",
        "gp_id": "gp-s-06", "gp_title": "Микс модуля «Эмфаза и стиль»",
        "rule_md": RULE_S06,
        "phrases": S06,
        "rule_cloze": [
            ("___ do I.", ["Neither", "Nor"]),
            ("Let's ___ it a day.", ["call"]),
            ("I'm ___ be late.", ["gonna"]),
        ],
        "quotes": [("q-solo-leveling-0005", "survive"), ("q-breaking-bad-0016", "lightly")],
        "trap_id": "trap-despite-of",
        "vocab_band": {"list": "subtitles", "from": 4301, "to": 4360},
        "phrasebook_topic": "idioms",
        "quotes_topic": "mixed",
        "bebris_video": None,
        "answer_question": [("Should I sign the contract right now?", "Under no circumstances should you sign it.")],
        "find_error": [("He must has left already.", "He must have left already.")],
        "verb_tense": [
            ("Rarely ___ the train arrive on time.", "форма", ["does"]),
            ("The city ___ on me. (понравился со временем)", "форма", ["grew"]),
            ("Nothing's ___ to change.", "форма", ["going"]),
        ],
    },
]
