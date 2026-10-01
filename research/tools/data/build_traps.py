#!/usr/bin/env python3
"""Сборка data/traps.json — каталог ловушек русскоязычных (plan://M3#3.6).

Источник: research/03-methods-and-exercises.md §4 (ЛТ-01…ЛТ-31, таблица «Неправильно/Правильно/Тема»).
ЛТ-23–25 добавлены в M20 (данные правились напрямую — синхронизированы обратно в билдер),
ЛТ-26–31 — из параллельного ресёрча study_eng (2026-10-01).
Контракт полей: id (^trap-[a-z0-9-]+$), lt_id (^ЛТ-[0-9]{2}$), title_ru, wrong_en, right_en,
explanation_ru, tags — все обязательны (схема trap, добавляемая в specs/05). Обёртка файла —
specs/05 §0: {schema_version, kind: "traps", items}.
Запуск из корня репозитория: python3 research/tools/data/build_traps.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "data/traps.json"

# (lt_id, slug, title_ru, wrong_en, right_en, explanation_ru, тема)
TRAPS = [
    ("ЛТ-01", "no-to-be", "Пропуск to be",
     "I hungry. She doctor.", "I'm hungry. She's a doctor.",
     "В русском связка «есть/является» опускается, в английском to be в настоящем времени обязателен всегда. "
     "Не забудь и неопределённый артикль перед профессией: She's a doctor.",
     "to be"),
    ("ЛТ-02", "to-home", "Предлог с home",
     "I go to home.", "I go home.",
     "Home здесь наречие («куда?»), поэтому предлог to не нужен. Сравни: at home («где?»).",
     "prepositions"),
    ("ЛТ-03", "third-person-s", "-s в 3-м лице",
     "He live here.", "He lives here.",
     "В Present Simple после he/she/it к глаголу добавляется окончание -s.",
     "present-simple"),
    ("ЛТ-04", "no-do-negative", "Отрицание без do",
     "I no speak English.", "I don't speak English.",
     "Отрицание в Present/Past Simple строится через вспомогательный do/does/did + not. "
     "Простое «no» перед глаголом по-английски не работает.",
     "do-support"),
    ("ЛТ-05", "im-agree", "agree как прилагательное",
     "I'm agree.", "I agree.",
     "Agree — это глагол («соглашаться»), связка to be не нужна. Вопрос: Do you agree?",
     "verbs"),
    ("ЛТ-06", "articles", "Артикли",
     "The Russia. I have brother.", "Russia. I have a brother.",
     "Названия стран (почти все) используются без the, а исчисляемое существительное в единственном числе "
     "требует артикля a/an.",
     "articles"),
    ("ЛТ-07", "double-negative", "Двойное отрицание",
     "I don't know nothing.", "I don't know anything.",
     "В английском на одну мысль — только одно отрицание: not … anything, а не not … nothing.",
     "negation"),
    ("ЛТ-08", "didnt-past", "didn't + прошедшая форма",
     "I didn't went.", "I didn't go.",
     "Прошедшее время уже выражено вспомогательным did, поэтому смысловой глагол возвращается в начальную форму.",
     "past-simple"),
    ("ЛТ-09", "feel-myself", "feel myself",
     "I feel myself good.", "I feel good.",
     "В значении «чувствовать себя» feel — не возвратный глагол: I feel good, без myself.",
     "verbs"),
    ("ЛТ-10", "wait-for", "wait без for",
     "I'm waiting my friend.", "I'm waiting for my friend.",
     "Глагол wait требует предлог for перед тем, кого/чего ждём: wait for somebody/something.",
     "prepositions"),
    ("ЛТ-11", "said-me", "say / tell",
     "Say me.", "Tell me.",
     "«Скажи мне» — tell me (у tell адресат идёт сразу после глагола). Say адресата без to не берёт: say something, say to me.",
     "verbs-of-speech"),
    ("ЛТ-12", "interested", "interesting / interested",
     "I'm interesting in music.", "I'm interested in music.",
     "Interested — «заинтересованный в чём-то», interesting — «интересный». «I'm interesting» значит «я интересный (человек)».",
     "adjectives"),
    ("ЛТ-13", "do-make", "do / make",
     "do a mistake", "make a mistake",
     "Выбор между do и make определяется устойчивым сочетанием, а не русским «делать»: make a mistake, make plans, но do homework.",
     "collocations"),
    ("ЛТ-14", "uncountable-plurals", "Неисчисляемые существительные",
     "advices, informations, moneys", "advice, information, money",
     "Advice, information, money — неисчисляемые и формы множественного числа не образуют. "
     "Количество выражаем через some / a piece of.",
     "nouns"),
    ("ЛТ-15", "people", "people",
     "peoples, this people", "people, these people",
     "People — уже множественное число («люди»): these people, people are. Peoples означает «народы».",
     "nouns"),
    ("ЛТ-16", "present-perfect", "Present Perfect vs Past Simple",
     "I saw this film before.", "I've seen this film before.",
     "Если важен опыт «когда-то до настоящего момента» (маркеры before, ever, already) — Present Perfect. "
     "Past Simple требует конкретного времени в прошлом.",
     "present-perfect"),
    ("ЛТ-17", "if-will", "will после if",
     "If it will rain, I…", "If it rains, I…",
     "В придаточном условия (if/when) будущее время не ставится: вместо will — Present Simple.",
     "conditionals"),
    ("ЛТ-18", "want-that", "want that",
     "I want that he comes.", "I want him to come.",
     "После want используется оборот want somebody to do something (объектный падеж + инфинитив), "
     "а не придаточное с that.",
     "infinitive"),
    ("ЛТ-19", "question-word-order", "Порядок слов в вопросе",
     "Where you live?", "Where do you live?",
     "В вопросе перед подлежащим нужен вспомогательный do/does/did: Where do you live?",
     "questions"),
    ("ЛТ-20", "indirect-question", "Косвенный вопрос",
     "Tell me where is the station?", "Tell me where the station is.",
     "В косвенном вопросе порядок слов прямой, как в утверждении, — без вспомогательного does/do и без вопросительного знака.",
     "questions"),
    ("ЛТ-21", "comma-that", "Запятая перед that",
     "I think, that…", "I think that…",
     "В отличие от русского «я думаю, что…», перед союзом that в английском запятая не ставится.",
     "punctuation"),
    ("ЛТ-22", "very-like", "very перед глаголом",
     "I very like it.", "I like it very much.",
     "Very усиливает только прилагательные и наречия, не глаголы. С глаголом — very much в конце или усиленный синоним: I really like it.",
     "adverbs"),
    ("ЛТ-23", "despite-of", "despite of",
     "Despite of the rain, we went out.", "Despite the rain, we went out.",
     "Despite используется без of: despite the traffic. Синоним с of — in spite of: in spite of the traffic.",
     "connectors"),
    ("ЛТ-24", "slang-register", "сленг в формальном контексте",
     "I'm gonna submit the report to the committee.",
     "I'm going to submit the report to the committee.",
     "gonna/wanna/gotta/ain't — только в разговорной речи. В письмах, документах и на экзамене — полные формы.",
     "register"),
    ("ЛТ-25", "false-friends", "ложные друзья EN-RU",
     "This topic is very actual.", "This topic is very topical.",
     "Ложные друзья: actual = фактический, реальный (актуальный = topical). pretend = притворяться (претендовать = apply for/claim).",
     "false-friends"),
    ("ЛТ-26", "explain-to", "explain + адресат без to",
     "Explain me this.", "Explain this to me.",
     "Explain требует адресата через to: explain something to somebody. По той же модели describe и suggest. А tell и ask — наоборот, без to: tell me, ask me.",
     "verbs"),
    ("ЛТ-27", "prep-last-next", "предлог с last/next/this",
     "In last week I was in Rome.", "Last week I was in Rome.",
     "С last, next, this, every предлоги не нужны: last week, next month, this year, every day. Предлог in — с месяцами и годами: in May, in 2026.",
     "prepositions"),
    ("ЛТ-28", "sequence-of-tenses", "согласование времён в косвенной речи",
     "She said she will come.", "She said she would come.",
     "В косвенной речи после прошедшего (said) будущее сдвигается на шаг назад: will → would, can → could, have → had.",
     "verbs-of-speech"),
    ("ЛТ-29", "since-present-perfect", "since/for без перфекта",
     "I'm here since Monday.", "I've been here since Monday.",
     "«До сих пор» с since/for — это Present Perfect (Continuous), не Present Simple: I've been here since Monday. Сравни: I am here (сейчас).",
     "present-perfect"),
    ("ЛТ-30", "modal-no-to", "to после модального",
     "Can you to help me?", "Can you help me?",
     "После модального глагола (can, must, should, may) инфинитив без to. To нужен после want/need/like и в конструкции have to.",
     "infinitive"),
    ("ЛТ-31", "double-comparative", "двойная степень сравнения",
     "It's more better.", "It's much better.",
     "Две степени сравнения сразу нельзя: more не добавляется к -er или к исключениям. Усиление — much/far: much better, far more interesting.",
     "adjectives"),
]


def main():
    items = []
    for lt_id, slug, title_ru, wrong, right, expl, topic in TRAPS:
        items.append({
            "id": f"trap-{slug}",
            "lt_id": lt_id,
            "title_ru": title_ru,
            "wrong_en": wrong,
            "right_en": right,
            "explanation_ru": expl,
            "tags": ["trap", topic],
        })
    OUT.write_text(
        json.dumps({"schema_version": 1, "kind": "traps", "items": items},
                   ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8")
    print(f"записей: {len(items)} → {OUT}")
    assert all(re.match(r"^trap-[a-z0-9-]+$", x["id"]) for x in items)
    assert all(re.match(r"^ЛТ-[0-9]{2}$", x["lt_id"]) for x in items)
    assert len({x["id"] for x in items}) == len(items)
    assert len({x["lt_id"] for x in items}) == len(items)


if __name__ == "__main__":
    main()
