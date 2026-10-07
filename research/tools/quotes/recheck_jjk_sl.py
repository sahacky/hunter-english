#!/usr/bin/env python3
"""Сверка 13 цитат JJK/SL с дубляжом/субтитрами (план: «13 цитат JJK/SL —
ручная сверка», PLANS «Ожидает внешних событий», закрыто 2026-10-07).

Вердикты ресёрча (2 параллельных агента, источники в confidence каждой записи):
- JJK 0010/0011/0012 — текст уточнён (запятые, «type of girls»);
- JJK 0013 — смысл подтверждён, дословно не верифицирован (пометка);
- JJK 0014 — спикер ошибочен: Gojo, не Nanami (ошибка агрегаторов);
- JJK 0015 — эпизод 5, не 23;
- JJK 0016 — не найдена ни в одном источнике (вероятно, выдумана) — УДАЛЕНА;
- SL 0009/0011/0012 — подтверждены;
- SL 0010 — официальный слоган «Only I level up» (Webnovel), не фанатский
  «I alone level up»;
- SL 0013 — «A mere insect» репликой не является; заменена на дословную
  «You can talk even though you're just an insect.» (S2E12, субтитры);
- SL 0014 — не найдена в транскриптах S1–S2; заменена на дословную реплику
  эп. 7 «If I'm the only one in the world who can level up, that's a
  different story.»;
- SL 0015 — сохранён (рендеринг Screen Rant) с пометкой про официальный слоган.

После скрипта: перегенерировать аудио изменённых (список data/raw/quotes-recheck.list),
удалить audio/quotes/cori/q-jujutsu-kaisen-0016.opus, build_manifest.py, validate:data.
Однократный запуск (правки по факту сверы, не идемпотентен).
"""
import json
import re
import urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
NGSL = REPO / "data/raw/ngsl/NGSL_12_stats.csv"

with NGSL.open(encoding="utf-8", newline="") as f:
    rows = list(__import__("csv").reader(f))
TOP = {row[0].strip().lower() for row in rows[1:1001] if row}


def top1000(text: str) -> float:
    words = re.findall(r"[a-z']+", text.lower())
    return round(sum(1 for w in words if w in TOP) / len(words), 2)


def playphrase(text: str) -> str:
    return "https://www.playphrase.me/#/search?q=" + urllib.parse.quote(text)


def apply(doc: dict, qid: str, **fields) -> None:
    for item in doc["items"]:
        if item["id"] == qid:
            item.update(fields)
            return
    raise SystemExit(f"не найдена цитата {qid}")


jjk = json.loads((REPO / "data/quotes/jujutsu-kaisen.json").read_text(encoding="utf-8"))
sl = json.loads((REPO / "data/quotes/solo-leveling.json").read_text(encoding="utf-8"))

CHECKED = "проверено 2026-10-07"

# --- Jujutsu Kaisen ---
t = "Don't worry, I'm the strongest."
apply(jjk, "q-jujutsu-kaisen-0010", text=t, translation_ru="Не волнуйся, я сильнейший.",
      confidence=f"{CHECKED}: офиц. EN-аккаунт JJK + дубляж (Kaiji Tang), эп. 7",
      link_playphrase=playphrase(t))

t = "Stand proud, you're strong."
apply(jjk, "q-jujutsu-kaisen-0011", text=t, translation_ru="Гордись, ты силён.",
      season_episode="Sukuna → Jogo (эп. 40 / S2E16, субтитры)",
      confidence=f"{CHECKED}: фандом Episode 40 (дословно); эпизод был указан неверно (17)",
      link_playphrase=playphrase(t))

t = "What type of girls do you like?"
apply(jjk, "q-jujutsu-kaisen-0012", text=t, translation_ru="Какого типа девушки тебе нравятся?",
      season_episode="Todo → Юдзи (эп. 15, Goodwill Event)",
      grammar_tags=["what type of…", "Present Simple вопрос"],
      confidence=f"{CHECKED}: фандом Episode 15 (к Юдзи); вариант «What kind of woman is your type?» — вопрос Мегуми в эп. 8 (см. q-jujutsu-kaisen-0006)",
      link_playphrase=playphrase(t), auto_vocab={"top1000": top1000(t)})

apply(jjk, "q-jujutsu-kaisen-0013",
      confidence=f"частично {CHECKED}: смысл подтверждён (фандом Wasuke/Episode 1), дословная формулировка дубляжа не верифицирована")

apply(jjk, "q-jujutsu-kaisen-0014", speaker="Gojo → Megumi",
      season_episode="Gojo (эп. 23, тренировка Мегуми, субтитры)",
      confidence=f"{CHECKED}: фандом гл. 58/эп. 23 — реплика Годжо (атрибуция Nanami — ошибка агрегаторов); концовка «…things» вероятна, но не подтверждена")

apply(jjk, "q-jujutsu-kaisen-0015", season_episode="Megumi (эп. 5)",
      confidence=f"{CHECKED}: фандом-галерея Мегуми — дословно; эпизод был указан неверно (23)")

jjk["items"] = [q for q in jjk["items"] if q["id"] != "q-jujutsu-kaisen-0016"]

# --- Solo Leveling ---
apply(sl, "q-solo-leveling-0009",
      text="I'm going to protect my family, even if it means turning all the hunters in the world against me.",
      confidence=f"{CHECKED}: фандом (webtoon гл. 148, Liu Zhigang) + независимые посты")

t = "Only I level up"
apply(sl, "q-solo-leveling-0010", text=t, translation_ru="Только я прокачиваюсь.",
      season_episode="Слоган франшизы (офиц. англ. название новеллы на Webnovel)",
      grammar_tags=["фокус-вынесение Only I", "phrasal level up"],
      confidence=f"{CHECKED}: Wikipedia + фандом (публикационная история): офиц. «Only I Level Up»; «I alone level up» — фанатский перевод",
      link_playphrase=playphrase(t), auto_vocab={"top1000": top1000(t)})

apply(sl, "q-solo-leveling-0011",
      confidence=f"{CHECKED}: субтитры S1E1 (subslikescript) + фандом-эпитет")

apply(sl, "q-solo-leveling-0012",
      confidence=f"{CHECKED}: системное окно (webtoon гл. 10–11, on-screen S1E2/E3) — 3+ независимых источника")

t = "You can talk even though you're just an insect."
apply(sl, "q-solo-leveling-0013", text=t,
      translation_ru="Ты умеешь говорить, хоть ты и всего лишь насекомое.",
      season_episode="Jinwoo → Король муравьёв (эп. S2E12, субтитры)",
      grammar_tags=["even though (уступка)", "just + существительное"],
      confidence=f"{CHECKED}: полный транскрипт S2E12 (subslikescript); «A mere insect» — пересказ фандома, репликой не является",
      link_playphrase=playphrase(t), auto_vocab={"top1000": top1000(t)})

t = "If I'm the only one in the world who can level up, that's a different story."
apply(sl, "q-solo-leveling-0014", text=t,
      translation_ru="Если я единственный в мире, кто может прокачиваться, — это совсем другая история.",
      season_episode="Jinwoo (эп. 7, субтитры)",
      grammar_tags=["if + Present Simple (реальное условие)", "the only one who…", "can + инфинитив"],
      confidence=f"{CHECKED}: фандом Episode 7; прежний текст «Don't worry about me. I'm stronger than yesterday» не найден в транскриптах S1–S2 — заменён",
      link_playphrase=playphrase(t), auto_vocab={"top1000": top1000(t)})

apply(sl, "q-solo-leveling-0015",
      note="⚠ официальный вариант слогана — «Only I level up» (см. q-solo-leveling-0010); здесь рендеринг Screen Rant")

for name, doc in [("jujutsu-kaisen", jjk), ("solo-leveling", sl)]:
    p = REPO / "data/quotes" / f"{name}.json"
    p.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

regen = [
    ("q-jujutsu-kaisen-0010", "Don't worry, I'm the strongest."),
    ("q-jujutsu-kaisen-0011", "Stand proud, you're strong."),
    ("q-jujutsu-kaisen-0012", "What type of girls do you like?"),
    ("q-solo-leveling-0010", "Only I level up"),
    ("q-solo-leveling-0013", "You can talk even though you're just an insect."),
    ("q-solo-leveling-0014", "If I'm the only one in the world who can level up, that's a different story."),
]
(REPO / "data/raw/quotes-recheck.list").write_text(
    "".join(f"{i}\t{t}\n" for i, t in regen), encoding="utf-8")
print(f"цитаты обновлены: JJK {len(jjk['items'])}, SL {len(sl['items'])}; аудио-лист: 6 записей")
