#!/usr/bin/env python3
"""Сборка data/words/*.json из сырья M3 (specs/05 §1, план://M3#3.4).

Вход (data/raw/, в git не коммитится):
  ngsl/NGSL_12_stats.csv         — NGSL 1.2: лемма → частотный ранг (2809 строк)
  ngsl/NGSL-Spoken_12_stats.csv  — NGSL-Spoken: лемма → разговорный ранг (721 строка)
  kaikki/words/<lemma>.jsonl     — словарные статьи Wiktionary (kaikki.org):
                                   переводы на уровне записи, поле translations
  kaikki/target_words_full.txt   — union-список целевых лемм (создаётся
                                   build_target_words.py --full)
  tatoeba/examples.json          — индекс примеров lemma → {en, ru}
  ../data/quotes-ru-merged.json  — фолбэк примеров из цитат

Выход (фиксированные диапазоны freq_rank_ngsl, имена стабильны при пересборках):
  words-0001-0500.json, words-0501-1000.json, words-1001-1500.json,
  words-1501-2000.json, words-2001-2400.json, words-2401-2809.json
  words-spoken-only.json           — леммы только NGSL-Spoken (sentinel-ранги)
Каждый файл ≤ ~300 КБ (цель specs/05 §0); id всегда "<лемма>-<pos>".

Правила (решения plan://M3#M3, обновлены по итогам AITS-ревью):
  - одна запись = одна часть речи; id ВСЕГДА "<лемма>-<pos>" (стабильность
    card_id в M4: набор POS в kaikki-дампе может измениться при пере-скачке);
  - CEFR выводится ТОЛЬКО из частотного ранга (1–500 A1, 501–1000 A2,
    1001–2000 B1, 2001+ B2). Oxford-разметка в пайплайне НЕ используется:
    публиковать её запрещено (Watch out в WAL);
  - курация: CURATED_SINGLE — функциональные леммы получают ровно одну запись
    с главной POS; CURATED_TR — ручные переводы для частотных (лемма, POS);
    CURATED_DROP — отбраковка джанк-POS. Спека 05 §8: топ-1000 кураируется;
    полный per-POS разбор — M8;
  - лемма без перевода или без примера в data/words не попадает (отчёт
    дублируется в data/raw/build_words_report.txt);
  - freq_rank_ngsl у spoken-only лемм: sentinel 100000+spoken_rank, файл
    words-spoken-only.json, CEFR — по разговорному рангу;
  - теги: ngsl, spoken-top719, irregular-verb; фразовые глаголы — материал
    уроков M5+ (тегов phrasal-* здесь нет).
"""
import csv
import json
import re
import unicodedata
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "data/raw"
OUT = ROOT / "data/words"
REPORT = RAW / "build_words_report.txt"

# Фиксированные диапазоны рангов для файлов (стабильные имена, ≤300 КБ)
CHUNKS = [(1, 500), (501, 1000), (1001, 1500), (1501, 2000), (2001, 2400), (2401, 2809)]
SENTINEL_BASE = 100000

POS_MAP = {
    "noun": "noun",
    "verb": "verb",
    "adj": "adjective",
    "adv": "adverb",
    "prep": "preposition",
    "pron": "pronoun",
    "conj": "conjunction",
    "interj": "interjection",
    "intj": "interjection",
    "det": "determiner",
    "num": "noun",
    "postp": "adverb",
    "phrase": "phrase",
}
IRREGULAR_VERBS = set("""be have do say go get make know think take see come want look use
find give tell work call try ask need feel become leave put mean keep let begin seem help
talk turn start show hear play run move like live believe hold bring happen write provide
sit stand lose pay meet include continue set learn change lead understand watch follow stop
create speak read spend grow open walk win teach offer remember love consider appear buy
wait serve die send expect build stay fall cut reach kill remain suggest raise pass sell
require report decide pull return explain hope develop carry break receive agree support hit
produce eat cover catch draw choose cause point listen realize drive argue bend bind bite
blow burn burst cling creep deal dig dive dream flee fly forbid forget forgive freeze grind
hang hide hurt kneel knit lay lend lie light ride ring rise shake shave shear shed shine
shoot shrink shut sing sink sleep slide sling slit sow speed spell spill spin spit split
spread spring steal stick sting stink strike string strive swear sweep swim swing tear
thrive throw thrust tread undergo wake wear weave wed weep wet wind wring awake beat
mistake forsake overtake undertake arise""".split())

# Курация: функциональные и супергастотные леммы — ровно одна запись с главной POS,
# ручными главными переводами и примером (спека 05 §8 «топ-1000 — вручную»,
# регистр курса — «ты», простые travel-фразы). Формат: lemma: (pos, [переводы], en, ru).
CURATED_SINGLE = {
    "a": ("determiner", ["неопределённый артикль; один, какой-то"], "I have a question.", "У меня есть вопрос."),
    "the": ("determiner", ["определённый артикль; этот, тот самый"], "The hotel is near the airport.", "Отель рядом с аэропортом."),
    "and": ("conjunction", ["и", "а"], "Tea and coffee, please.", "Чай и кофе, пожалуйста."),
    "or": ("conjunction", ["или"], "Cash or card?", "Наличными или картой?"),
    "but": ("conjunction", ["но", "однако"], "I am tired but happy.", "Я устал, но счастлив."),
    "if": ("conjunction", ["если"], "If you need help, call me.", "Если нужна помощь, позвони мне."),
    "because": ("conjunction", ["потому что", "так как"], "I stay here because it is cheap.", "Я остаюсь здесь, потому что здесь дёшево."),
    "i": ("pronoun", ["я"], "I am from Russia.", "Я из России."),
    "you": ("pronoun", ["ты", "вы"], "You speak English very well.", "Ты очень хорошо говоришь по-английски."),
    "he": ("pronoun", ["он"], "He is my brother.", "Он мой брат."),
    "she": ("pronoun", ["она"], "She works at the hotel.", "Она работает в отеле."),
    "it": ("pronoun", ["это", "он", "она"], "It is on the table.", "Это на столе."),
    "we": ("pronoun", ["мы"], "We are tourists.", "Мы туристы."),
    "they": ("pronoun", ["они"], "They are open until ten.", "Они открыты до десяти."),
    "this": ("pronoun", ["это", "этот"], "This is my seat.", "Это моё место."),
    "that": ("pronoun", ["тот", "это", "что"], "I like that idea.", "Мне нравится та идея."),
    "be": ("verb", ["быть", "находиться", "являться"], "Where is the toilet?", "Где туалет?"),
    "have": ("verb", ["иметь", "у меня есть (конструкция have got)"], "Do you have a map of the city?", "У тебя есть карта города?"),
    "do": ("verb", ["делать", "выполнять"], "What do you do?", "Чем ты занимаешься?"),
    "say": ("verb", ["говорить", "сказать"], "Say it again, please.", "Скажи это ещё раз, пожалуйста."),
    "go": ("verb", ["идти", "ехать", "ходить"], "Let's go to the city centre.", "Пойдём в центр города."),
    "can": ("verb", ["мочь", "уметь"], "Can you help me?", "Ты можешь мне помочь?"),
    "will": ("verb", ["вспомогательный глагол будущего времени; волеизъявление"], "I will call a taxi.", "Я вызову такси."),
    "of": ("preposition", ["указывает на принадлежность и связь (родительный падеж)"], "A cup of tea, please.", "Чашку чая, пожалуйста."),
    "to": ("preposition", ["к, в, до (направление); частица перед инфинитивом"], "I go to the station.", "Я иду на станцию."),
    "in": ("preposition", ["в", "внутри"], "The keys are in the bag.", "Ключи в сумке."),
    "on": ("preposition", ["на"], "The ticket is on the table.", "Билет на столе."),
    "at": ("preposition", ["у, при, в (точка в пространстве или времени)"], "Meet me at the entrance.", "Встреть меня у входа."),
    "for": ("preposition", ["для, за, на (цель, получатель)"], "This letter is for you.", "Это письмо для тебя."),
    "with": ("preposition", ["с, вместе с"], "Pay with a card.", "Заплатить картой."),
    "from": ("preposition", ["из, от, с"], "I am from Moscow.", "Я из Москвы."),
    "about": ("preposition", ["о, об, про"], "Tell me about your trip.", "Расскажи мне о своей поездке."),
    "not": ("adverb", ["не"], "It is not expensive.", "Это не дорого."),
    "no": ("determiner", ["нет", "никакой"], "No problem.", "Без проблем."),
    "yes": ("interjection", ["да"], "Yes, that is right.", "Да, это верно."),
    "here": ("adverb", ["здесь", "сюда"], "Come here, please.", "Подойди сюда, пожалуйста."),
    "there": ("adverb", ["там", "туда"], "The museum is there.", "Музей вон там."),
    "now": ("adverb", ["сейчас", "теперь"], "I need a room now.", "Мне сейчас нужна комната."),
    "then": ("adverb", ["затем", "тогда"], "First the museum, then lunch.", "Сначала музей, потом обед."),
    "very": ("adverb", ["очень"], "Thank you very much.", "Большое спасибо."),
    "well": ("adverb", ["хорошо"], "You know the city well.", "Ты хорошо знаешь этот город."),
    "so": ("adverb", ["так", "поэтому", "итак"], "So, what is the plan?", "Итак, каков план?"),
    "all": ("determiner", ["все", "всё"], "All the seats are taken.", "Все места заняты."),
    "some": ("determiner", ["несколько", "какой-то", "немного"], "I need some water.", "Мне нужно немного воды."),
    "any": ("determiner", ["любой", "какой-нибудь"], "Do you have any questions?", "У тебя есть какие-нибудь вопросы?"),
    "every": ("determiner", ["каждый", "всякий"], "Every train stops here.", "Каждый поезд останавливается здесь."),
    "what": ("pronoun", ["что", "какой"], "What time is it?", "Который час?"),
    "when": ("adverb", ["когда"], "When does the bus leave?", "Когда отправляется автобус?"),
    "where": ("adverb", ["где", "куда"], "Where is the exit?", "Где выход?"),
    "who": ("pronoun", ["кто", "который"], "Who is calling?", "Кто звонит?"),
    "why": ("adverb", ["почему", "зачем"], "Why is it closed?", "Почему закрыто?"),
    "how": ("adverb", ["как", "каким образом"], "How much is it?", "Сколько это стоит?"),
    "one": ("noun", ["один", "один (человек/предмет)"], "One ticket, please.", "Один билет, пожалуйста."),
    "two": ("noun", ["два"], "Two coffees, please.", "Два кофе, пожалуйста."),
    "three": ("noun", ["три"], "The room is on the third floor.", "Комната на третьем этаже."),
    "four": ("noun", ["четыре"], "We stay for four days.", "Мы остаёмся на четыре дня."),
    "five": ("noun", ["пять"], "It costs five euros.", "Это стоит пять евро."),
    "six": ("noun", ["шесть"], "The shop opens at six.", "Магазин открывается в шесть."),
    "seven": ("noun", ["семь"], "The train leaves at seven.", "Поезд отправляется в семь."),
    "eight": ("noun", ["восемь"], "It is eight o'clock.", "Сейчас восемь часов."),
    "nine": ("noun", ["девять"], "We land at nine.", "Мы приземляемся в девять."),
    "ten": ("noun", ["десять"], "The hotel closes at ten.", "Отель закрывается в десять."),
    "eleven": ("noun", ["одиннадцать"], "The flight is at eleven.", "Рейс в одиннадцать."),
    "twelve": ("noun", ["двенадцать"], "Lunch is at twelve.", "Обед в двенадцать."),
    "twenty": ("noun", ["двадцать"], "It is twenty degrees outside.", "На улице двадцать градусов."),
    "hundred": ("noun", ["сто", "сотня"], "The hotel is a hundred years old.", "Отелю сто лет."),
    "thousand": ("noun", ["тысяча"], "The city has a thousand years of history.", "У города тысяча лет истории."),
    "million": ("noun", ["миллион"], "A million people live here.", "Здесь живёт миллион человек."),
    # Fallback-переводы: слова без русской секции в Wiktionary (дроп пайплайна)
    "could": ("verb", ["мог (вежливая просьба, прошедшее от can)"], "Could you speak more slowly?", "Не мог бы ты говорить помедленнее?"),
    "would": ("verb", ["бы (вежливая форма)"], "Would you like some tea?", "Не хочешь ли чаю?"),
    "should": ("verb", ["следует, стоит"], "You should book in advance.", "Стоит бронировать заранее."),
    "may": ("verb", ["можно, возможно"], "May I come in?", "Можно войти?"),
    "must": ("verb", ["должен, обязан"], "You must show your passport.", "Ты должен показать паспорт."),
    "mom": ("noun", ["мама"], "My mom makes great soup.", "Моя мама готовит отличный суп."),
    "hello": ("interjection", ["привет", "здравствуйте"], "Hello, do you speak English?", "Здравствуйте, вы говорите по-английски?"),
    "hi": ("interjection", ["привет"], "Hi, how are you?", "Привет, как дела?"),
    "okay": ("adverb", ["ладно, хорошо, окей"], "Okay, I understand.", "Ладно, я понимаю."),
    "photo": ("noun", ["фотография", "фото"], "Can you take a photo of us?", "Можешь нас сфотографировать?"),
    "neighbor": ("noun", ["сосед", "соседка"], "My neighbor has a dog.", "У моего соседа есть собака."),
    "favorite": ("adjective", ["любимый"], "What is your favorite food?", "Какая у тебя любимая еда?"),
    "exam": ("noun", ["экзамен"], "I have an English exam on Monday.", "У меня экзамен по английскому в понедельник."),
    "ad": ("noun", ["объявление", "реклама"], "I saw an ad for a cheap hotel.", "Я видел объявление о дешёвом отеле."),
    "household": ("noun", ["домашнее хозяйство", "семья (домочадцы)"], "The whole household helps with dinner.", "Всё хозяйство помогает готовить ужин."),
    "labor": ("noun", ["труд", "работа"], "This work is hard labor.", "Эта работа — тяжёлый труд."),
    "humor": ("noun", ["юмор"], "I like British humor.", "Мне нравится британский юмор."),
    "ago": ("adverb", ["тому назад"], "We arrived two days ago.", "Мы приехали два дня назад."),
    "upon": ("preposition", ["на (книжн., = on)"], "Once upon a time there was a hunter.", "Однажды давным-давно жил охотник."),
    "whilst": ("conjunction", ["в то время как (= while, книжн.)"], "He read whilst she slept.", "Он читал, пока она спала."),
    "anymore": ("adverb", ["больше (не)"], "I do not live here anymore.", "Я здесь больше не живу."),
    "alright": ("adjective", ["в порядке, нормально"], "Are you alright?", "Ты в порядке?"),
    "elsewhere": ("adverb", ["где-то в другом месте"], "The hotel is full, look elsewhere.", "Отель полон, поищи в другом месте."),
    "possibly": ("adverb", ["возможно"], "Can you possibly help me?", "Не мог бы ты мне помочь?"),
    "potentially": ("adverb", ["потенциально"], "This is potentially dangerous.", "Это потенциально опасно."),
    "regardless": ("adverb", ["несмотря ни на что"], "We go regardless of the weather.", "Мы идём, несмотря на погоду."),
    "relate": ("verb", ["рассказывать", "относиться (к)"], "I cannot relate to this story.", "Я не могу отнести эту историю к себе."),
    "engage": ("verb", ["занимать(ся), вовлекать"], "We engage a guide for the tour.", "Мы нанимаем гида для экскурсии."),
    "vary": ("verb", ["различаться, меняться"], "Prices vary by season.", "Цены различаются в зависимости от сезона."),
    "adviser": ("noun", ["советник", "консультант"], "Ask the travel adviser about visas.", "Спроси консультанта по путешествиям о визах."),
    "catalog": ("noun", ["каталог"], "The museum has a free catalog.", "В музее бесплатный каталог."),
    "cite": ("verb", ["цитировать", "ссылаться"], "You must cite your sources.", "Ты должен указывать источники."),
    "criteria": ("noun", ["критерии"], "What are the criteria for the exam?", "Каковы критерии экзамена?"),
    "depress": ("verb", ["угнетать, подавлять"], "Rainy days depress me.", "Дождливые дни меня угнетают."),
    "dramatically": ("adverb", ["драматично, резко"], "Prices fell dramatically.", "Цены резко упали."),
    "representation": ("noun", ["представление", "представительство"], "The map is a representation of the city.", "Карта — это представление города."),
    "situate": ("verb", ["располагать(ся)"], "The hotel is situated near the sea.", "Отель расположен у моря."),
    "specify": ("verb", ["указывать, уточнять"], "Please specify your room number.", "Пожалуйста, укажи номер комнаты."),
    "statistic": ("noun", ["статистический показатель", "статистика"], "One statistic says it all.", "Одна цифра говорит обо всём."),
    "totally": ("adverb", ["полностью, совершенно"], "The flight was totally full.", "Рейс был полностью заполнен."),
    "typically": ("adverb", ["обычно, как правило"], "It is typically quiet here.", "Здесь обычно тихо."),
    "underlie": ("verb", ["лежать в основе"], "Simple rules underlie the language.", "В основе языка лежат простые правила."),
}

# Ручные главные переводы для частотных (лемма, POS) — заменяют мусорные
# первые glossи Wiktionary. Переводы — главные значения, регистр курса: «ты».
CURATED_TR = {
    ("water", "noun"): ["вода"],
    ("water", "verb"): ["поливать"],
    ("map", "noun"): ["карта"],
    ("left", "adjective"): ["левый"],
    ("like", "verb"): ["нравиться", "любить"],
    ("like", "preposition"): ["как", "подобно"],
    ("like", "noun"): ["лайк"],
    ("train", "noun"): ["поезд"],
    ("bus", "noun"): ["автобус"],
    ("cheap", "adjective"): ["дешёвый", "дешёвая"],
    ("still", "adverb"): ["всё ещё", "всё же"],
    ("even", "adverb"): ["даже"],
    ("right", "adjective"): ["правый", "правильный"],
    ("right", "noun"): ["право"],
    ("book", "verb"): ["бронировать", "заказывать"],
    ("plane", "noun"): ["самолёт"],
    ("fine", "adjective"): ["хороший", "отличный"],
    ("fine", "noun"): ["штраф"],
    ("party", "noun"): ["вечеринка", "партия (политическая)"],
    ("case", "noun"): ["случай", "чемодан", "дело"],
    ("second", "noun"): ["секунда", "момент"],
    ("second", "adjective"): ["второй"],
    ("mean", "verb"): ["значить", "иметь в виду"],
    ("mean", "adjective"): ["подлый", "средний"],
    ("lie", "verb"): ["лгать", "лежать"],
    ("lie", "noun"): ["ложь"],
    ("match", "noun"): ["спичка", "матч"],
    ("match", "verb"): ["соответствовать", "сочетаться"],
    ("band", "noun"): ["группа (музыкальная)", "полоса", "диапазон"],
    ("suit", "noun"): ["костюм"],
    ("suit", "verb"): ["подходить", "устраивать"],
    ("bay", "noun"): ["залив", "ниша"],
    ("capital", "noun"): ["столица", "заглавная буква", "капитал"],
    ("capital", "adjective"): ["заглавный", "капитальный"],
    ("patient", "noun"): ["пациент", "больной"],
    ("patient", "adjective"): ["терпеливый"],
    ("novel", "noun"): ["роман (книга)"],
    ("novel", "adjective"): ["новый", "оригинальный"],
    ("wave", "noun"): ["волна"],
    ("wave", "verb"): ["махать", "машировать"],
    ("palm", "noun"): ["ладонь", "пальма"],
    ("date", "noun"): ["дата", "свидание", "финик"],
    ("date", "verb"): ["назначать дату", "встречаться"],
    ("board", "noun"): ["доска", "борт (посадка на транспорт)"],
    ("board", "verb"): ["садиться (в транспорт)", "boarding pass — посадочный талон"],
    ("check", "noun"): ["проверка", "чек"],
    ("check", "verb"): ["проверять"],
    ("land", "verb"): ["приземляться", "высаживаться"],
    ("land", "noun"): ["земля", "земельный участок"],
    ("trip", "noun"): ["поездка", "путешествие"],
    ("light", "noun"): ["свет", "светофор", "огонёк"],
    ("light", "adjective"): ["светлый", "лёгкий"],
    ("light", "verb"): ["зажигать", "освещать"],
    ("kind", "noun"): ["вид", "сорт"],
    ("kind", "adjective"): ["добрый"],
    ("bear", "verb"): ["нести", "терпеть", "родить"],
    ("bear", "noun"): ["медведь"],
    ("front", "noun"): ["передняя часть", "фронт"],
    ("cool", "adjective"): ["классный", "прохладный"],
    ("season", "noun"): ["сезон", "время года"],
    ("sport", "noun"): ["спорт"],
}

# Отбраковка джанк-POS (редкие/сленговые омонимы частотных лемм)
CURATED_DROP = {
    ("still", "noun"),      # «перегонный куб»
    ("even", "noun"),       # архаичное «вечер»
    ("even", "verb"),
    ("even", "adjective"),
    ("make", "noun"),       # «марка, модель»
    ("time", "verb"),       # «хронометрировать»
    ("say", "noun"),        # «голос»
    ("very", "noun"),
    ("very", "adjective"),
    ("well", "noun"),       # «колодец»
    ("well", "adjective"),
    ("well", "verb"),
    ("well", "interjection"),
    ("so", "conjunction"),
    ("far", "noun"),
    ("far", "verb"),
    ("leave", "noun"),      # «отпуск» (leave-verb важнее для A0)
    ("try", "noun"),        # «попытка»
    ("group", "verb"),      # «группировать»
    ("level", "adjective"), # «ровный»
    ("level", "verb"),
    ("class", "verb"),      # «классифицировать»
    ("class", "adjective"),
    ("do", "noun"),         # «вечеринка»
    ("friend", "verb"),     # «зафрендить»
    ("high", "noun"),       # «приход, балдёж»
    ("high", "adverb"),
    ("second", "verb"),     # «командировать, поддержать»
    ("it", "noun"),
    ("a", "noun"),          # буква «а»
    ("a", "adverb"),
    ("the", "adverb"),
    ("bus", "verb"),
    ("may", "noun"),        # «май» (may-verb «мочь» важнее)
    ("must", "noun"),
    ("should", "noun"),
    ("could", "noun"),
    ("would", "noun"),
}

COMBINING_ACUTE = "\u0301"


def strip_accents_ru(s: str) -> str:
    s = unicodedata.normalize("NFC", s).replace(COMBINING_ACUTE, "")
    return unicodedata.normalize("NFC", s).strip()


def read_ranks(p: Path) -> dict:
    ranks = {}
    with p.open(encoding="utf-8-sig") as f:
        for r in csv.reader(f):
            if not r or r[0].lower() == "lemma":
                continue
            try:
                ranks[r[0].strip().lower()] = int(r[1])
            except ValueError:
                continue
    return ranks


def cefr_from_rank(rank: int) -> str:
    """CEFR выводится из частотного ранга — единственный источник уровней
    в публикуемых данных (Oxford-разметка не публикуется)."""
    if rank <= 500:
        return "A1"
    if rank <= 1000:
        return "A2"
    if rank <= 2000:
        return "B1"
    return "B2"


def kaikki_translations(lemma: str):
    """[(pos_mapped, [переводы ru])] по всем подходящим статьям леммы."""
    p = RAW / f"kaikki/words/{lemma}.jsonl"
    if not p.exists() or p.stat().st_size == 0:
        return []
    per_pos = {}
    with p.open(encoding="utf-8") as f:
        for line in f:
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue
            if d.get("lang_code") != "en" and d.get("lang") != "English":
                continue
            pos = POS_MAP.get(d.get("pos", ""))
            if not pos:
                continue
            rus = []
            for t in d.get("translations", []):
                if t.get("code") == "ru" or t.get("lang") == "Russian":
                    w = strip_accents_ru(t.get("word", ""))
                    if w and w not in rus:
                        rus.append(w)
            if rus:
                per_pos.setdefault(pos, [])
                for w in rus:
                    if w not in per_pos[pos]:
                        per_pos[pos].append(w)
    return list(per_pos.items())


def load_examples():
    p = RAW / "tatoeba/examples.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return {}


def quotes_fallback_examples():
    src = ROOT / "research/data/quotes-ru-merged.json"
    if not src.exists():
        return []
    return json.loads(src.read_text(encoding="utf-8"))


def sub_ranks() -> dict[str, int]:
    """Ранги субтитровых лемм (M11): en_50k по порядку частоты, минус NGSL/Spoken.

    Слово получает ранг 1..N в порядке убывания субтитровой частоты; суммарный
    объём датасета ограничен ~5000 (target_words_sub5000.txt, best effort —
    решение M11#5: токены без kaikki-перевода отсеиваются дальше по пайплайну).
    """
    src = RAW / "kaikki/target_words_sub5000.txt"
    if not src.exists():
        return {}
    ngsl = set(read_ranks(RAW / "ngsl/NGSL_12_stats.csv"))
    spoken = set(read_ranks(RAW / "ngsl/NGSL-Spoken_12_stats.csv"))
    seen = ngsl | spoken
    ranks = {}
    with (RAW / "frequencywords/en_50k.txt").open(encoding="utf-8") as f:
        for line in f:
            parts = line.split()
            if len(parts) != 2:
                continue
            word = parts[0].lower()
            if not re.fullmatch(r"[a-z][a-z'-]*", word):
                continue
            if word in seen:
                continue
            ranks[word] = len(ranks) + 1
            seen.add(word)
            if len(ranks) >= 2200:
                break
    return ranks


def main():
    sub_targets = sub_ranks()
    # полный набор: NGSL+Spoken (target_words_full) + субтитровые (sub5000)
    targets = (RAW / "kaikki/target_words_full.txt").read_text(encoding="utf-8").split()
    targets += [w for w in sub_targets if w not in set(targets)]
    ngsl_rank = read_ranks(RAW / "ngsl/NGSL_12_stats.csv")
    spoken_rank = read_ranks(RAW / "ngsl/NGSL-Spoken_12_stats.csv")
    examples = load_examples()
    quotes = quotes_fallback_examples()

    dropped_no_tr = []
    dropped_no_ex = []
    spoken_only = []
    sub_items = []
    entries = OrderedDict()

    for lemma in targets:
        curated_example = None
        if lemma in CURATED_SINGLE:
            pos, trs, ex_en, ex_ru = CURATED_SINGLE[lemma]
            pairs = [(pos, list(trs))]
            curated_example = (ex_en, ex_ru)
        else:
            pairs = kaikki_translations(lemma)
        # курация: ручные переводы, отбраковка POS
        curated = []
        for pos, trs in pairs:
            if (lemma, pos) in CURATED_DROP:
                continue
            if (lemma, pos) in CURATED_TR:
                trs = list(CURATED_TR[(lemma, pos)])
            if trs:
                curated.append((pos, trs[:3]))
        if not curated:
            dropped_no_tr.append(lemma)
            continue

        s_rank = spoken_rank.get(lemma)
        n_rank = ngsl_rank.get(lemma)
        is_spoken_only = n_rank is None and s_rank is not None
        if is_spoken_only:
            spoken_only.append(lemma)
            n_rank = SENTINEL_BASE + s_rank
        sub_rank = sub_targets.get(lemma)
        is_sub = n_rank is None and s_rank is None and sub_rank is not None

        ex = examples.get(lemma)
        if curated_example:
            example_en, example_ru = curated_example
        elif ex:
            example_en, example_ru = ex["en"], ex["ru"]
        else:
            pat = re.compile(rf"\b{re.escape(lemma)}\b", re.IGNORECASE)
            q = next((x for x in quotes if pat.search(x.get("text", "")) and x.get("translation_ru")), None)
            if q:
                example_en, example_ru = q["text"], q["translation_ru"]
            else:
                dropped_no_ex.append(lemma)
                continue
        example_ru = strip_accents_ru(example_ru)

        rank_for_cefr = s_rank if is_spoken_only and s_rank else (sub_rank if is_sub else n_rank)
        for pos, trs in curated:
            lvl = cefr_from_rank(rank_for_cefr)
            tags = ["subtitles"] if is_sub else ["ngsl"]
            if not is_sub and s_rank is not None:
                tags.append("spoken-top719")
            if pos == "verb" and lemma in IRREGULAR_VERBS:
                tags.append("irregular-verb")
            e = OrderedDict(
                lemma=lemma,
                part_of_speech=pos,
                translation_ru=trs,
                cefr_level=lvl,
            )
            if is_sub:
                e["freq_rank_sub"] = sub_rank
            else:
                e["freq_rank_ngsl"] = n_rank
            if s_rank is not None:
                e["freq_rank_spoken"] = s_rank
            e.update(tags=tags, example_en=example_en, example_ru=example_ru)
            entries[(lemma, pos)] = e

    # id всегда <лемма>-<pos> (стабильность card_id, specs/05 §1)
    words = []
    for (lemma, pos), e in entries.items():
        wid = f"{lemma}-{pos}"
        item = OrderedDict(id=wid, **e, audio=OrderedDict(en_gb=f"audio/words/cori/{wid}.opus"))
        words.append(item)

    # Чистим выход от прошлых сборок (протухшие чанки с иными именами)
    OUT.mkdir(parents=True, exist_ok=True)
    for p in OUT.glob("*.json"):
        p.unlink()

    ngsl_ranked = [w for w in words if "freq_rank_ngsl" in w]
    by_rank = sorted((w for w in ngsl_ranked if w["freq_rank_ngsl"] < SENTINEL_BASE),
                     key=lambda x: x["freq_rank_ngsl"])
    spoken_only_items = [w for w in ngsl_ranked if w["freq_rank_ngsl"] >= SENTINEL_BASE]
    spoken_only_items.sort(key=lambda x: x.get("freq_rank_spoken", 10**6))
    sub_out = sorted((w for w in words if "freq_rank_sub" in w), key=lambda x: x["freq_rank_sub"])

    lines = []

    def dump(name, items):
        p = OUT / name
        p.write_text(
            json.dumps(OrderedDict(schema_version=1, kind="words", items=items),
                       ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
        line = f"{name}: {len(items)} записей, {p.stat().st_size // 1024} КБ"
        print(line)
        lines.append(line)

    for lo, hi in CHUNKS:
        chunk = [w for w in by_rank if lo <= w["freq_rank_ngsl"] <= hi]
        if chunk:
            dump(f"words-{lo:04d}-{hi:04d}.json", chunk)
    if spoken_only_items:
        dump("words-spoken-only.json", spoken_only_items)
    # Субтитровая полоса 2807–5000 (решение M3#5): имя фиксировано, состав —
    # лучшие по частоте токены вне NGSL с переводом и примером (best effort)
    if sub_out:
        dump("words-2807-5000.json", sub_out)

    total = len(words)
    summary = [
        f"ИТОГО: {total} записей из {len(targets)} целевых лемм",
        f"без перевода/курации: {len(dropped_no_tr)} -> {', '.join(dropped_no_tr)}",
        f"без примера: {len(dropped_no_ex)} -> {', '.join(dropped_no_ex)}",
        f"spoken-only (sentinel {SENTINEL_BASE}+spoken_rank): {len(spoken_only)}",
        f"subtitles (freq_rank_sub, M11): {len(sub_out)}",
    ]
    print("\n".join(summary))
    (RAW / "build_words_report.txt").write_text("\n".join(lines + [""] + summary) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
