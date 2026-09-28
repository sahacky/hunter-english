#!/usr/bin/env python3
"""Сборка пилотного контента ранга E — модуль E1 (E-01…E-05), plan://M5#5.4.

Вход: фразовые пулы ниже (ручная курация по specs/01 §5 + шаблон урока specs/02 §2),
цитаты из data/quotes/*.json (est_rank E).
Выход:
  data/phrases/phrases-e.json      — фразы (specs/05 §2)
  data/lessons/exercises-e.json    — упражнения (specs/05 §3), авто-вывод из фраз
  data/lessons/lessons-e.json      — уроки (specs/05 §4)
  data/raw/phrase_audio_e1.tsv     — список "id<TAB>текст" для gen_audio.py

Детерминированность: random.Random(SEED) — пересборка даёт те же файлы.
Нумерация: ph-e-NNNN и ex-e-NNNN сквозная в порядке уроков.
"""
import json
import random
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
DATA = REPO / "data"
SEED = 20260928

# --------------------------------------------------------------------------
# Пулы фраз: (text_en, translation_ru, variants|None)
# --------------------------------------------------------------------------
E01 = [
    ("Hello!", "Привет!", None),
    ("Hi!", "Привет!", None),
    ("Good morning!", "Доброе утро!", None),
    ("Good afternoon!", "Добрый день!", None),
    ("Good evening!", "Добрый вечер!", None),
    ("Good night!", "Доброй ночи!", None),
    ("Nice to meet you.", "Приятно познакомиться.", None),
    ("See you later.", "До встречи.", None),
    ("Welcome to Moscow.", "Добро пожаловать в Москву.", None),
    ("I am Ivan.", "Я Иван.", None),
    ("My name is Anna.", "Меня зовут Анна.", None),
    ("I am from Russia.", "Я из России.", None),
    ("She is from Japan.", "Она из Японии.", None),
    ("He is from Canada.", "Он из Канады.", None),
    ("We are from Russia.", "Мы из России.", None),
    ("They are from Spain.", "Они из Испании.", None),
    ("You are my friend.", "Ты мой друг.", None),
    ("We are friends.", "Мы друзья.", None),
    ("They are students.", "Они студенты.", None),
    ("I am new here.", "Я здесь новенький.", None),
    ("This is my friend.", "Это мой друг.", None),
    ("This is Anna.", "Это Анна.", None),
    ("He is Ivan.", "Он Иван.", None),
    ("She is Anna.", "Она Анна.", None),
    ("It is late.", "Уже поздно.", None),
    ("It is okay.", "Всё в порядке.", None),
    ("Everything is fine.", "Всё хорошо.", None),
    ("I am fine, thanks.", "Я в порядке, спасибо.", None),
    ("I am okay.", "Я в порядке.", None),
    ("You are right.", "Ты прав.", None),
    ("You are wrong.", "Ты не прав.", None),
    ("I am here.", "Я здесь.", None),
    ("We are here.", "Мы здесь.", None),
    ("They are here.", "Они здесь.", None),
    ("I am ready.", "Я готов.", None),
    ("You are late.", "Ты опаздываешь.", None),
    ("Life is good.", "Жизнь хороша.", None),
    ("My English is basic.", "Мой английский базовый.", None),
    ("I am 25 years old.", "Мне 25 лет.", None),
    ("I am glad to be here.", "Я рад быть здесь.", None),
    ("Moscow is my city.", "Москва — мой город.", None),
    ("Russia is my country.", "Россия — моя страна.", None),
    ("Thank you very much.", "Большое спасибо.", None),
]

E02 = [
    ("I am a student.", "Я студент.", None),
    ("I am a teacher.", "Я учитель.", None),
    ("He is a doctor.", "Он врач.", None),
    ("She is a doctor.", "Она врач.", None),
    ("I am an engineer.", "Я инженер.", None),
    ("She is an artist.", "Она художница.", None),
    ("He is a good doctor.", "Он хороший врач.", None),
    ("It is a big city.", "Это большой город.", None),
    ("It is a small town.", "Это маленький город.", None),
    ("This is a good idea.", "Это хорошая идея.", None),
    ("It is a bad idea.", "Это плохая идея.", None),
    ("I am busy.", "Я занят.", None),
    ("I am free today.", "Я сегодня свободен.", None),
    ("This city is big.", "Этот город большой.", None),
    ("This coffee is good.", "Этот кофе хороший.", None),
    ("My city is beautiful.", "Мой город красивый.", None),
    ("My friend is funny.", "Мой друг весёлый.", None),
    ("I am happy.", "Я счастлив.", None),
    ("I am sad.", "Мне грустно.", None),
    ("He is angry.", "Он злится.", None),
    ("She is kind.", "Она добрая.", None),
    ("It is cold today.", "Сегодня холодно.", None),
    ("It is hot today.", "Сегодня жарко.", None),
    ("It is easy.", "Это легко.", None),
    ("It is difficult.", "Это сложно.", None),
    ("English is easy.", "Английский лёгкий.", None),
    ("My phone is old.", "Мой телефон старый.", None),
    ("My phone is new.", "Мой телефон новый.", None),
    ("We are ready.", "Мы готовы.", None),
    ("You are beautiful.", "Ты красивая.", None),
    ("He is a good friend.", "Он хороший друг.", None),
    ("I am an only child.", "Я единственный ребёнок.", None),
    ("It is an apple.", "Это яблоко.", None),
    ("It is an old house.", "Это старый дом.", None),
    ("It is a new house.", "Это новый дом.", None),
    ("I have a brother.", "У меня есть брат.", None),
    ("I have a sister.", "У меня есть сестра.", None),
    ("I have a question.", "У меня есть вопрос.", None),
    ("I have an idea.", "У меня есть идея.", None),
    ("You are a good student.", "Ты хороший студент.", None),
    ("It is a secret.", "Это секрет.", None),
    ("I am serious.", "Я серьёзен.", None),
    ("This is an emergency.", "Это чрезвычайная ситуация.", None),
]

E03 = [
    ("I am not a teacher.", "Я не учитель.", None),
    ("I am not a doctor.", "Я не врач.", None),
    ("He is not a doctor.", "Он не врач.", None),
    ("She is not a student.", "Она не студентка.", None),
    ("It is not true.", "Это неправда.", None),
    ("It is not a problem.", "Это не проблема.", None),
    ("It is not easy.", "Это нелегко.", None),
    ("It is not difficult.", "Это несложно.", None),
    ("This is not my phone.", "Это не мой телефон.", None),
    ("This is not my room.", "Это не моя комната.", None),
    ("I am not busy.", "Я не занят.", None),
    ("I am not tired.", "Я не устал.", None),
    ("He is not here.", "Его здесь нет.", None),
    ("She is not here.", "Её здесь нет.", None),
    ("They are not here.", "Их здесь нет.", None),
    ("We are not ready.", "Мы не готовы.", None),
    ("You are not right.", "Ты не прав.", None),
    ("You are not wrong.", "Ты и не ошибаешься.", None),
    ("My mother is a teacher.", "Моя мама — учительница.", None),
    ("My father is a doctor.", "Мой папа — врач.", None),
    ("My brother is a student.", "Мой брат — студент.", None),
    ("My sister is an artist.", "Моя сестра — художница.", None),
    ("My parents are doctors.", "Мои родители — врачи.", None),
    ("My family is big.", "Моя семья большая.", None),
    ("My family is not big.", "Моя семья небольшая.", None),
    ("I have no brothers.", "У меня нет братьев.", None),
    ("I am not from Moscow.", "Я не из Москвы.", None),
    ("He is not from Russia.", "Он не из России.", None),
    ("We are not late.", "Мы не опаздываем.", None),
    ("It is not cold today.", "Сегодня не холодно.", None),
    ("It is not hot.", "Не жарко.", None),
    ("I am not angry.", "Я не злой.", None),
    ("She is not sad.", "Она не грустит.", None),
    ("My name is not Anna.", "Меня зовут не Анна.", None),
    ("This is not a good idea.", "Это не лучшая идея.", None),
    ("Money is not a problem.", "Деньги — не проблема.", None),
    ("I am not sure.", "Я не уверен.", None),
    ("It is not far.", "Это недалеко.", None),
    ("It is not expensive.", "Это недорого.", None),
    ("We are not from Spain.", "Мы не из Испании.", None),
    ("They are not friends.", "Они не друзья.", None),
    ("My mother is not old.", "Моя мама не старая.", None),
    ("I am not ready.", "Я не готов.", None),
    ("Sorry, we are not open.", "Извините, мы закрыты.", None),
]

E04 = [
    ("Are you Ivan?", "Ты Иван?", None),
    ("Are you a student?", "Ты студент?", None),
    ("Are you a doctor?", "Ты врач?", None),
    ("Are you from Russia?", "Ты из России?", None),
    ("Are you from Moscow?", "Ты из Москвы?", None),
    ("Are you busy?", "Ты занят?", None),
    ("Are you tired?", "Ты устал?", None),
    ("Are you hungry?", "Ты голоден?", None),
    ("Are you thirsty?", "Ты хочешь пить?", None),
    ("Are you happy?", "Ты счастлив?", None),
    ("Are you okay?", "Ты в порядке?", None),
    ("Are you ready?", "Ты готов?", None),
    ("Are you sure?", "Ты уверен?", None),
    ("Are you cold?", "Тебе холодно?", None),
    ("Are you free today?", "Ты сегодня свободен?", None),
    ("Is he your friend?", "Он твой друг?", None),
    ("Is she your sister?", "Она твоя сестра?", None),
    ("Is it true?", "Это правда?", None),
    ("Is it far?", "Это далеко?", None),
    ("Is it expensive?", "Это дорого?", None),
    ("Is it okay?", "Это нормально?", None),
    ("Is this your phone?", "Это твой телефон?", None),
    ("Is that a problem?", "Это проблема?", None),
    ("Am I right?", "Я прав?", None),
    ("Am I late?", "Я опаздываю?", None),
    ("Are we late?", "Мы опаздываем?", None),
    ("Are they here?", "Они здесь?", None),
    ("Are your parents here?", "Твои родители здесь?", None),
    ("Is your mother a teacher?", "Твоя мама учительница?", None),
    ("Yes, I am.", "Да.", None),
    ("No, I am not.", "Нет.", None),
    ("Yes, he is.", "Да.", None),
    ("No, she is not.", "Нет.", None),
    ("Yes, we are.", "Да.", None),
    ("No, they are not.", "Нет.", None),
    ("Yes, it is.", "Да.", None),
    ("No, it is not.", "Нет.", None),
    ("I am hungry.", "Я голоден.", None),
    ("I am thirsty.", "Я хочу пить.", None),
    ("I am tired.", "Я устал.", None),
    ("She is tired, but she is happy.", "Она устала, но счастлива.", None),
    ("Excuse me, are you Anna?", "Извините, вы Анна?", None),
    ("Are you open?", "Вы работаете?", None),
    ("Is it a good idea?", "Это хорошая идея?", None),
]

E05 = [
    ("How are you?", "Как дела?", None),
    ("How is it going?", "Как дела?", None),
    ("I am fine, thank you.", "Хорошо, спасибо.", None),
    ("I am very well, thanks.", "Отлично, спасибо.", None),
    ("Not bad.", "Неплохо.", None),
    ("So-so.", "Так себе.", None),
    ("And you?", "А ты?", None),
    ("What is your name?", "Как тебя зовут?", None),
    ("Good to see you.", "Рад тебя видеть.", None),
    ("Long time no see.", "Давно не виделись.", None),
    ("Have a good day.", "Хорошего дня.", None),
    ("It is nice here.", "Здесь приятно.", None),
    ("I am from Russia, and you?", "Я из России, а ты?", None),
    ("My name is Ivan. What is your name?", "Меня зовут Иван. Как тебя зовут?", None),
    ("Are you new here?", "Ты здесь новенький?", None),
    ("Is your family big?", "Твоя семья большая?", None),
    ("My family is not big.", "Моя семья небольшая.", None),
    ("This is my mother.", "Это моя мама.", None),
    ("This is my friend Dima.", "Это мой друг Дима.", None),
    ("Hello, my name is Anna. I am from Kazan.", "Здравствуй, меня зовут Анна. Я из Казани.", None),
    ("I am not a teacher, I am a doctor.", "Я не учитель, я врач.", None),
    ("Is your brother a student?", "Твой брат студент?", None),
    ("Yes, he is a student.", "Да, он студент.", None),
    ("No, he is not a student, he is a doctor.", "Нет, он не студент, он врач.", None),
    ("I am not hungry, I am thirsty.", "Я не голоден, я хочу пить.", None),
    ("It is not expensive, it is cheap.", "Это недорого, это дёшево.", None),
    ("My phone is old, but it is okay.", "Мой телефон старый, но с ним всё в порядке.", None),
    ("Today is good.", "Сегодня хороший день.", None),
    ("I am happy today.", "Я сегодня счастлив.", None),
    ("We are tired, but we are happy.", "Мы устали, но довольны.", None),
    ("Is Moscow big?", "Москва большая?", None),
    ("Yes, it is big and beautiful.", "Да, большая и красивая.", None),
    ("Are you sure it is true?", "Ты уверен, что это правда?", None),
    ("It is a secret.", "Это секрет.", None),
    ("Life is not easy, but it is interesting.", "Жизнь непроста, но интересна.", None),
    ("My city is old and beautiful.", "Мой город старый и красивый.", None),
    ("Is your sister an artist?", "Твоя сестра художница?", None),
    ("No, she is an engineer.", "Нет, она инженер.", None),
    ("Are your friends students?", "Твои друзья студенты?", None),
    ("Yes, they are.", "Да.", None),
    ("No, they are not.", "Нет.", None),
    ("Is it far from here?", "Это далеко отсюда?", None),
    ("I am here with my friend.", "Я здесь с другом.", None),
    ("Everything is okay.", "Всё в порядке.", None),
]

# --------------------------------------------------------------------------
# Правила и метаданные уроков (specs/01 §5)
# --------------------------------------------------------------------------
RULE_E01 = """По-русски «я — Иван» можно сказать без глагола. По-английски — нельзя: нужен глагол-связка **to be**.

- **I am** Ivan. — Я Иван.
- **He / She / It is** from Canada. — Он из Канады.
- **You / We / They are** friends. — Мы друзья.

Сокращения: I am = I'm, he is = he's, we are = we're.

⚠️ Ловушка ЛТ-01: «I hungry» — так нельзя! Нужен am/is/are: I'm hungry."""

RULE_E02 = """После to be можно ставить прилагательное или существительное: I am **tired**. She is a **doctor**.

Перед одним исчисляемым существительным нужен артикль **a**: I am a student. He is a good doctor.

Перед гласным звуком — **an**: She is an artist. It is an old house.

⚠️ Ловушка ЛТ-06: «I have brother» — нельзя! Артикль обязателен: I have **a** brother."""

RULE_E03 = """Отрицание с to be — частица **not** после глагола:

- I am **not** a teacher. (сокращение только I'm not)
- He / She / It **is not** = **isn't** here.
- You / We / They **are not** = **aren't** ready.

Семья: mother, father, brother, sister, parents, family.

Множественное число без артикля: My parents are doctors. My friends are students."""

RULE_E04 = """Вопрос с to be: глагол выходит на первое место.

- **Are** you tired? **Are** they here?
- **Is** she your sister? **Is** it true?
- **Am** I late?

Краткие ответы — глагол, не повторяем всё: Yes, I am. / No, I'm not. Yes, it is. / No, it isn't.

Состояния: hungry, thirsty, tired, busy, cold, happy."""

RULE_E05 = """Повторение E-01…E-04 — коротко:

- **+**: I am Ivan. She is a doctor. We are friends.
- **−**: I am not tired. He isn't here. They aren't ready.
- **?**: Are you hungry? Is it true? Am I late? — Yes, I am. / No, it isn't.
- Артикль: a student, an artist, a big city.

Small talk: How are you? — I'm fine, thanks. And you?"""

LESSONS = [
    {
        "id": "les-e-01", "module": "mod-e-1",
        "title": "to be: am / is / are. Знакомство",
        "gp_id": "gp-e-01", "gp_title": "Глагол to be в настоящем времени",
        "rule_md": RULE_E01,
        "phrases": E01,
        "rule_cloze": [
            ("I ___ Ivan.", ["am"]),
            ("She ___ from Japan.", ["is"]),
            ("We ___ friends.", ["are"]),
        ],
        "quotes": [("q-star-wars-0002", "am"), ("q-star-wars-0008", "is")],
        "trap_id": "trap-no-to-be",
        "vocab_band": {"list": "ngsl-spoken", "from": 1, "to": 60},
        "phrasebook_topic": None,
        "quotes_topic": "greetings",
        "bebris_video": {"lesson": "1.26", "playlist_index": 69, "youtube_id": "bB4K-WblSIk", "title": None},
    },
    {
        "id": "les-e-02", "module": "mod-e-1",
        "title": "to be + прилагательное / существительное. Артикль a / an",
        "gp_id": "gp-e-02", "gp_title": "to be + свойство; артикль a/an",
        "rule_md": RULE_E02,
        "phrases": E02,
        "rule_cloze": [
            ("I am ___ student.", ["a"]),
            ("She is ___ artist.", ["an"]),
            ("It is ___ big city.", ["a"]),
        ],
        "quotes": [("q-fma-fma-b-0003", "brother"), ("q-fma-fma-b-0006", "sorry")],
        "trap_id": "trap-articles",
        "vocab_band": {"list": "ngsl-spoken", "from": 61, "to": 120},
        "phrasebook_topic": None,
        "quotes_topic": "family",
        "bebris_video": {"lesson": "1.27", "playlist_index": 71, "youtube_id": "EmmoAPtgllA", "title": None},
    },
    {
        "id": "les-e-03", "module": "mod-e-1",
        "title": "to be: отрицание isn't / aren't",
        "gp_id": "gp-e-03", "gp_title": "Отрицание с to be",
        "rule_md": RULE_E03,
        "phrases": E03,
        "rule_cloze": [
            ("He ___ not here.", ["is"]),
            ("They ___ not ready.", ["are"]),
            ("It is ___ true.", ["not"]),
        ],
        "quotes": [("q-game-of-thrones-0006", "not"), ("q-game-of-thrones-0004", "Not")],
        "trap_id": "trap-articles",
        "vocab_band": {"list": "ngsl-spoken", "from": 121, "to": 180},
        "phrasebook_topic": None,
        "quotes_topic": "family",
        "bebris_video": {"lesson": "1.30", "playlist_index": 79, "youtube_id": "9omB2YuL1Z8", "title": None},
    },
    {
        "id": "les-e-04", "module": "mod-e-1",
        "title": "to be: вопрос Are you…? + краткие ответы",
        "gp_id": "gp-e-04", "gp_title": "Вопрос с to be и краткие ответы",
        "rule_md": RULE_E04,
        "phrases": E04,
        "rule_cloze": [
            ("___ you busy?", ["Are"]),
            ("___ she your sister?", ["Is"]),
            ("___ I late?", ["Am"]),
        ],
        "quotes": [("q-black-mirror-0006", "Is"), ("q-fma-fma-b-0008", "Is")],
        "trap_id": None,
        "vocab_band": {"list": "ngsl-spoken", "from": 181, "to": 240},
        "phrasebook_topic": None,
        "quotes_topic": "questions",
        "bebris_video": {"lesson": "1.31", "playlist_index": 82, "youtube_id": "mRQMPhB6c_Y", "title": None},
        "answer_question": [("Are you tired?", "Yes, I am.")],
    },
    {
        "id": "les-e-05", "module": "mod-e-1",
        "title": "Повторение №1 (E-01…E-04) + мини-контроль",
        "gp_id": "gp-e-05", "gp_title": "Повторение: to be +, −, ?; Small talk",
        "rule_md": RULE_E05,
        "phrases": E05,
        "rule_cloze": [
            ("I ___ from Russia.", ["am"]),
            ("___ you tired?", ["Are"]),
            ("It ___ not a problem.", ["is"]),
        ],
        "quotes": [("q-star-wars-0011", "is"), ("q-black-mirror-0001", "not")],
        "trap_id": None,
        "vocab_band": None,
        "phrasebook_topic": None,
        "quotes_topic": "small-talk",
        "bebris_video": None,
        "answer_question": [("How are you?", "I am fine, thank you.")],
    },
]

# Выбор фраз для производных шагов (индексы внутри пула урока)
WB_COUNT, TR_COUNT, SP_EVERY = 8, 16, 4  # построение: 8 word-bank + 16 перевод + speak каждая 4-я
DICT_COUNT, SHADOW_COUNT = 5, 4
WARMUP_CHOOSE = 4
MATCH_PAIRS = 5

rng = random.Random(SEED)


def load_quote(quote_id: str) -> dict:
    for fp in sorted((DATA / "quotes").glob("*.json")):
        for item in json.loads(fp.read_text(encoding="utf-8"))["items"]:
            if item["id"] == quote_id:
                return item
    raise SystemExit(f"цитата {quote_id} не найдена")


def build():
    phrases_out, exercises_out, lessons_out = [], [], []
    audio_rows = []
    ph_n = 0
    ex_n = 0

    def next_ex() -> str:
        nonlocal ex_n
        ex_n += 1
        return f"ex-e-{ex_n:04d}"

    for spec in LESSONS:
        lesson_phrase_ids = []
        lesson_phrase_items = []
        for en, ru, variants in spec["phrases"]:
            ph_n += 1
            pid = f"ph-e-{ph_n:04d}"
            lesson_phrase_ids.append(pid)
            item = {
                "id": pid,
                "text_en": en,
                "translation_ru": ru,
                "grammar_point_id": spec["gp_id"],
                "variants": variants if variants else [en],
                "audio": {"en_gb": f"audio/phrases/cori/{pid}.opus"},
            }
            phrases_out.append(item)
            lesson_phrase_items.append(item)
            audio_rows.append((pid, en))

        def phrase_by_text(text: str):
            for item in lesson_phrase_items:
                if item["text_en"] == text:
                    return item
            raise SystemExit(f"фраза {text!r} не найдена в пуле {spec['id']}")

        lesson_exercises = []

        # --- Шаг 1: правило — cloze на понимание -----------------------------
        for text, answers in spec["rule_cloze"]:
            eid = next_ex()
            exercises_out.append({
                "id": eid, "type": "cloze",
                "payload": {"kind": "cloze", "text_with_gap": text, "gap_answers": answers},
                "answer": {"normalization": "default", "typo": "exact"},
                "meta": {"skill": "grammar", "xp": 2},
            })
            lesson_exercises.append({"id": eid})

        # --- Шаг 2: разогрев — choose_translation + match_pairs --------------
        short = [p for p in lesson_phrase_items if 1 <= len(p["text_en"].split()) <= 4]
        rng.shuffle(short)
        for target in short[:WARMUP_CHOOSE]:
            pool = [p["text_en"] for p in short if p is not target][:3]
            options = pool + [target["text_en"]]
            correct = len(options) - 1
            rng.shuffle(options)
            correct = options.index(target["text_en"])
            eid = next_ex()
            exercises_out.append({
                "id": eid, "type": "choose_translation",
                "payload": {"kind": "choose_translation", "prompt": target["translation_ru"],
                            "options": options, "correct": correct},
                "answer": {"normalization": "default", "typo": "exact"},
                "meta": {"skill": "words", "xp": 1},
            })
            lesson_exercises.append({"id": eid})
        pairs = short[WARMUP_CHOOSE:WARMUP_CHOOSE + MATCH_PAIRS]
        if len(pairs) < MATCH_PAIRS:
            pairs = short[:MATCH_PAIRS]
        eid = next_ex()
        exercises_out.append({
            "id": eid, "type": "match_pairs",
            "payload": {"kind": "match_pairs",
                        "pairs": [{"en": p["text_en"], "ru": p["translation_ru"]} for p in pairs]},
            "answer": {"normalization": "default", "typo": "exact"},
            "meta": {"skill": "words", "xp": 1},
        })
        lesson_exercises.append({"id": eid})

        # --- Шаг 3: построение — word_bank → translate, speak каждая 4-я -----
        build_pool = [p for p in lesson_phrase_items
                      if p["text_en"] not in {q for q, _ in spec["quotes"]}]
        rng.shuffle(build_pool)
        build_pool = build_pool[: WB_COUNT + TR_COUNT]
        for i, target in enumerate(build_pool):
            eid = next_ex()
            if i < WB_COUNT:
                tokens = target["text_en"].replace("!", "").replace("?", "").replace(".", "")
                tokens = [t for t in tokens.split() if t]
                distractors = []
                for other in build_pool:
                    if other is target or len(distractors) >= 2:
                        continue
                    for w in other["text_en"].split():
                        if w not in tokens and w.isalpha() and len(w) > 2 and w not in distractors:
                            distractors.append(w)
                            break
                all_tokens = tokens + distractors
                rng.shuffle(all_tokens)
                exercises_out.append({
                    "id": eid, "type": "word_bank",
                    "payload": {"kind": "word_bank", "prompt_ru": target["translation_ru"],
                                "phrase_id": target["id"], "tokens": all_tokens},
                    "answer": {"normalization": "default", "typo": "allow"},
                    "meta": {"skill": "grammar", "xp": 2},
                })
            elif (i - WB_COUNT) % SP_EVERY == SP_EVERY - 1:
                exercises_out.append({
                    "id": eid, "type": "speak",
                    "payload": {"kind": "speak", "prompt_ru": target["translation_ru"],
                                "phrase_id": target["id"]},
                    "answer": {"normalization": "default", "typo": "allow", "speech_threshold": 0.85},
                    "meta": {"skill": "speaking", "xp": 4},
                })
            else:
                exercises_out.append({
                    "id": eid, "type": "translate",
                    "payload": {"kind": "translate", "prompt_ru": target["translation_ru"],
                                "phrase_id": target["id"]},
                    "answer": {"normalization": "default", "typo": "allow"},
                    "meta": {"skill": "grammar", "xp": 2},
                })
            lesson_exercises.append({"id": eid})

        # --- Шаг 4: слух — диктант -------------------------------------------
        dict_pool = sorted(lesson_phrase_items, key=lambda p: len(p["text_en"].split()))
        dict_pool = [p for p in dict_pool if 3 <= len(p["text_en"].split()) <= 6][: DICT_COUNT * 2]
        rng.shuffle(dict_pool)
        for target in dict_pool[:DICT_COUNT]:
            eid = next_ex()
            exercises_out.append({
                "id": eid, "type": "dictation",
                "payload": {"kind": "dictation", "phrase_id": target["id"]},
                "answer": {"normalization": "default", "typo": "allow"},
                "meta": {"skill": "listening", "xp": 3},
            })
            lesson_exercises.append({"id": eid})

        # --- Шаг 5: речь — shadowing + answer_question ------------------------
        shadow_pool = [p for p in lesson_phrase_items if 2 <= len(p["text_en"].split()) <= 5]
        rng.shuffle(shadow_pool)
        for target in shadow_pool[:SHADOW_COUNT]:
            eid = next_ex()
            exercises_out.append({
                "id": eid, "type": "shadowing",
                "payload": {"kind": "shadowing", "phrase_id": target["id"]},
                "answer": {"normalization": "default", "typo": "allow", "speech_threshold": 0.85},
                "meta": {"skill": "speaking", "xp": 3},
            })
            lesson_exercises.append({"id": eid})
        for question_en, answer_text in spec.get("answer_question", []):
            target = phrase_by_text(answer_text)
            eid = next_ex()
            exercises_out.append({
                "id": eid, "type": "answer_question",
                "payload": {"kind": "answer_question", "question_en": question_en,
                            "phrase_id": target["id"]},
                "answer": {"normalization": "default", "typo": "allow", "speech_threshold": 0.85},
                "meta": {"skill": "speaking", "xp": 4},
            })
            lesson_exercises.append({"id": eid})

        # --- Шаг 6: из сериала — cloze в цитатах ------------------------------
        for quote_id, gap_word in spec["quotes"]:
            q = load_quote(quote_id)
            text = q["text"]
            if gap_word not in text:
                raise SystemExit(f"слово {gap_word!r} не найдено в цитате {quote_id}: {text!r}")
            eid = next_ex()
            exercises_out.append({
                "id": eid, "type": "cloze",
                "payload": {
                    "kind": "cloze",
                    "text_with_gap": text.replace(gap_word, "___", 1),
                    "gap_answers": [gap_word],
                    "quote": {"title": q["title"], "season_episode": q["season_episode"]},
                },
                "answer": {"normalization": "default", "typo": "exact",
                           "hint_ru": "Вспомни цитату из урока"},
                "meta": {"skill": "grammar", "xp": 2},
            })
            lesson_exercises.append({"id": eid})

        lessons_out.append({
            "id": spec["id"],
            "rank": "E",
            "module": spec["module"],
            "title": spec["title"],
            "grammar_point": {
                "id": spec["gp_id"],
                "title_ru": spec["gp_title"],
                "rule_md": spec["rule_md"],
                "phrase_ids": lesson_phrase_ids[:5],
                "trap_id": spec["trap_id"],
            },
            "vocab_band": spec["vocab_band"],
            "phrasebook_topic": spec["phrasebook_topic"],
            "trap_id": spec["trap_id"],
            "quotes_topic": spec["quotes_topic"],
            "exercises": lesson_exercises,
            "bebris_video": spec["bebris_video"],
        })

    (DATA / "phrases").mkdir(exist_ok=True)
    (DATA / "phrases" / "phrases-e.json").write_text(
        json.dumps({"schema_version": 1, "kind": "phrases", "items": phrases_out},
                   ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (DATA / "lessons").mkdir(exist_ok=True)
    (DATA / "lessons" / "exercises-e.json").write_text(
        json.dumps({"schema_version": 1, "kind": "exercises", "items": exercises_out},
                   ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (DATA / "lessons" / "lessons-e.json").write_text(
        json.dumps({"schema_version": 1, "kind": "lessons", "items": lessons_out},
                   ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    raw = DATA / "raw"
    raw.mkdir(exist_ok=True)
    (raw / "phrase_audio_e1.tsv").write_text(
        "".join(f"{pid}\t{text}\n" for pid, text in audio_rows), encoding="utf-8")

    per_lesson = {spec["id"]: len(spec["phrases"]) for spec in LESSONS}
    print(f"фраз: {len(phrases_out)} {per_lesson}")
    print(f"упражнений: {len(exercises_out)}; уроков: {len(lessons_out)}")
    print(f"аудио-список: {raw / 'phrase_audio_e1.tsv'}")


if __name__ == "__main__":
    build()
