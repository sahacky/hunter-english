"""Build research/data/quotes-sample.json.

Wikiquote entries are looked up in utterances.json by exact substring, so the text
is guaranteed to be verbatim from the source (after wiki-markup/stage-direction cleanup).
External entries (IMDb, articles, Polygon, KYM) are typed in from the fetched pages.
"""
import json, os, re, sys, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import wq  # noqa: E402

OUT = "/home/tol/projects/study_eng/research/data/quotes-sample.json"
U = json.load(open(os.path.join(HERE, "utterances.json"), encoding="utf-8"))

def wq_url(fname):
    page = fname[:-4]
    page = page.replace("__", ":_")
    page = re.sub(r"^(Game_of_Thrones|Stranger_Things)_Season_", r"\1/Season_", page)
    return "https://en.wikiquote.org/wiki/" + urllib.parse.quote(page, safe="/:_()")

# (title, exact substring, speaker-hint or None, grammar tags, est_rank, note)
W = [
    # --- Supernatural
    ("Supernatural", "I can't do this alone.", "Dean", ["can/can't"], "E", ""),
    ("Supernatural", "Yes, you can!", "Sam", ["can/can't", "short answer"], "E", "ответ на предыдущую реплику"),
    ("Supernatural", "Yeah... Well, I don't want to.", "Dean", ["Present Simple (negative)", "want to"], "E", ""),
    ("Supernatural", "Sorry, I can't hear you. The music's too loud.", "Dean", ["can/can't", "to be", "too + adj"], "D", ""),
    ("Supernatural", "I want to find Dad.", "Sam", ["want to + verb"], "E", ""),
    ("Supernatural", "It doesn't matter what he wants.", "Sam", ["Present Simple (3rd person, negative)"], "D", ""),
    ("Supernatural", "Don't test me.", "Bobby", ["Imperative (negative)"], "E", ""),
    ("Supernatural", "I know. Believe me, I know.", "Dean", ["Present Simple", "Imperative"], "E", ""),
    ("Supernatural", "That's not the point.", "Sam", ["to be (negative)"], "E", ""),
    ("Supernatural", "Is he working a job?", "Sam", ["Present Continuous (question)"], "D", "job = «дело» охотников (сленг сериала)"),
    ("Supernatural", "I just want you to understand.", "Samuel", ["want + object + to"], "D", ""),
    ("Supernatural", "You don't mean that. We're--we're family.", "Sam", ["Present Simple (negative)", "to be"], "E", ""),
    ("Supernatural", "Dude, this is sweet! I never get to work jobs like this.", "Dean", ["to be", "Present Simple", "adverb never"], "D", "разговорное: dude, sweet"),
    ("Supernatural", "\"Saving people, hunting things. The family business.\"", "Crowley", ["-ing form (gerund)", "noun phrase"], "D", "Кроули цитирует девиз братьев; оригинальная реплика Дина — S01E02, внутри длинного монолога"),
    # --- Game of Thrones
    ("Game of Thrones", "He won't be a boy forever. And winter is coming.", "Ned Stark", ["will/won't", "Present Continuous (future meaning)"], "C", "«Winter is coming» — отдельная карточка-фрагмент"),
    ("Game of Thrones", "You know nothing, Jon Snow.", "Ygritte", ["Present Simple"], "E", ""),
    ("Game of Thrones", "What do we say to the god of death?", "Syrio Forel", ["Present Simple (question)", "wh-question"], "D", "пара с «Not today.»"),
    ("Game of Thrones", "Not today.", "Arya Stark", ["short answer"], "E", ""),
    ("Game of Thrones", "Hold the door!", "Meera Reed", ["Imperative"], "E", ""),
    ("Game of Thrones", "I'm not a Stark.", "Jon Snow", ["to be (negative)"], "E", ""),
    ("Game of Thrones", "My family stays with me.", "Stannis Baratheon", ["Present Simple (3rd person -s)"], "E", ""),
    ("Game of Thrones", "Do you love your children?", "Cersei Lannister", ["Present Simple (question)"], "E", ""),
    ("Game of Thrones", "But I'm hungry.", "Arya Stark", ["to be + adjective"], "E", ""),
    ("Game of Thrones", "There's nothing to forgive.", "Jon Snow", ["there is"], "D", ""),
    ("Game of Thrones", "What do you want?", "Cersei Lannister", ["wh-question", "Present Simple"], "E", ""),
    ("Game of Thrones", "The Lannisters send their regards.", "Roose Bolton", ["Present Simple"], "C", "regards — слово уровня B1"),
    ("Game of Thrones", "You might be surprised. A Lannister always pays his debts.", "Tyrion Lannister", ["might", "Present Simple + always"], "C", ""),
    # --- Breaking Bad
    ("Breaking Bad", "That's right. Now... say my name.", "Walter", ["Imperative", "to be"], "E", ""),
    ("Breaking Bad", "I am not in danger, Skyler. I am the danger!", "Walter", ["to be (negative)", "articles a/the"], "D", "фрагмент длинного монолога S04E06"),
    ("Breaking Bad", "I am the one who knocks!", "Walter", ["to be", "relative clause who"], "C", "фрагмент того же монолога"),
    ("Breaking Bad", "We need a plan.", "Walter", ["Present Simple", "need"], "E", ""),
    ("Breaking Bad", "It's over. We're safe.", "Walter", ["to be"], "E", ""),
    ("Breaking Bad", "I won.", "Walter", ["Past Simple (irregular)"], "C", ""),
    ("Breaking Bad", "I did it for me. I liked it. I was good at it.", "Walter", ["Past Simple", "was"], "C", "фрагмент реплики S05E16"),
    ("Breaking Bad", "You're damn right.", "Walter", ["to be"], "E", "грубоватое: damn"),
    ("Breaking Bad", "Don't touch them!", "Walter", ["Imperative (negative)"], "E", ""),
    ("Breaking Bad", "I want you to handle it.", "Walter", ["want + object + to"], "D", ""),
    ("Breaking Bad", "What's your name?", "Tuco", ["wh-question", "to be"], "E", "полезно для путешествий"),
    ("Breaking Bad", "Why are you here?", "Jesse", ["wh-question", "to be"], "E", ""),
    ("Breaking Bad", "How much is this?", "Walter", ["How much", "to be"], "E", "фраза путешественника"),
    ("Breaking Bad", "Yes, I have it.", "Lydia", ["have"], "E", ""),
    # --- Stranger Things
    ("Stranger Things", "\"Friends don't lie.\"", "Lucas", ["Present Simple (negative)"], "E", "фрагмент реплики S02E05"),
    ("Stranger Things", "SHE'S OUR FRIEND AND SHE'S CRAZY!", "Dustin", ["to be", "possessive our"], "E", "фрагмент; в источнике капсом"),
    ("Stranger Things", "I love you, Jonathan Byers.", "Nancy", ["Present Simple"], "E", ""),
    ("Stranger Things", "It's not that bad.", "Max", ["to be (negative)"], "E", ""),
    ("Stranger Things", "I... I don't understand.", "Becky Ives", ["Present Simple (negative)"], "E", "фраза путешественника"),
    ("Stranger Things", "You don't believe me.", "Lucas", ["Present Simple (negative)"], "E", ""),
    ("Stranger Things", "What are you doing here?", "Eddie", ["Present Continuous (question)"], "D", ""),
    ("Stranger Things", "Please don't leave me, El. Please don't do this.", "Mike", ["Imperative (negative)", "please"], "E", ""),
    ("Stranger Things", "I want to hear it.", "Suzie", ["want to"], "E", ""),
    ("Stranger Things", "What is your problem?!", "Joyce", ["wh-question", "to be"], "E", ""),
    ("Stranger Things", "You lie. Why do you lie? I dump your ass!", "Eleven", ["Present Simple", "question with do"], "D", "грубое: ass; ломаный английский Одиннадцатой"),
    ("Stranger Things", "And I’m not a kid anymore.", "Will", ["to be (negative)", "anymore"], "E", "фрагмент реплики S05E03"),
    # --- The 100
    ("The 100", "We're back, Bitches!", "Octavia Blake", ["to be"], "E", "грубое"),
    ("The 100", "May we meet again.", "Clarke Griffin and Bellamy Blake", ["may (wish)"], "D", "ритуальная фраза сериала"),
    ("The 100", "We're not alone.", "Clarke Griffin", ["to be (negative)"], "E", ""),
    ("The 100", "This is Earth. Everything's Toxic.", "Finn Collins", ["to be", "everything + is"], "D", ""),
    ("The 100", "I trust him, Clarke.", "Octavia Blake", ["Present Simple"], "E", ""),
    ("The 100", "Your fight is over.", "Octavia Blake", ["to be"], "E", ""),
    ("The 100", "I'm the Commander. No one fights for me.", "Lexa", ["to be", "Present Simple (3rd person)"], "E", ""),
    ("The 100", "I'm just trying to keep us alive.", "Clarke Griffin", ["Present Continuous"], "D", ""),
    ("The 100", "Earth, Clarke. You get to go to Earth.", "Abigail Griffin", ["Present Simple", "get to"], "D", ""),
    ("The 100", "They dropped us on the wrong damn mountain.", "Clarke Griffin", ["Past Simple"], "C", "грубоватое: damn"),
    ("The 100", "My sister... my responsibility.", "Bellamy Blake", ["possessive my"], "D", ""),
    # --- Black Mirror
    ("Black Mirror", "It's not stuff. It's truth.", "Bing", ["to be"], "E", ""),
    ("Black Mirror", "I'm sorry, I can't help you.", "Martin", ["can/can't", "to be"], "E", ""),
    ("Black Mirror", "You don't know that.", "Michael", ["Present Simple (negative)"], "E", ""),
    ("Black Mirror", "Everything happens for a reason.", "Coach", ["Present Simple (3rd person -s)"], "D", ""),
    ("Black Mirror", "It doesn't work like that.", "Gwendolyn", ["Present Simple (3rd person, negative)"], "E", ""),
    ("Black Mirror", "Is that a problem?", "Cooper", ["to be (question)"], "E", ""),
    ("Black Mirror", "Maybe you're old.", "Blue", ["to be"], "E", ""),
    ("Black Mirror", "I can't believe there's two of you!", "Rachel", ["can't believe", "there is"], "D", "разговорное there's two (норма: there are)"),
    ("Black Mirror", "You can make friends with people.", "DCI Kano", ["can"], "E", ""),
    ("Black Mirror", "Yeah, well, you aren't you, are you?", "Martha", ["to be", "tag question"], "C", ""),
    ("Black Mirror", "I know people. We love humiliation. We can't not laugh.", "Jane", ["Present Simple", "can't"], "C", "humiliation — B2"),
    # --- Lord of the Rings
    ("Lord of the Rings", "Fly, you fools!", "Gandalf the Grey", ["Imperative"], "D", ""),
    ("Lord of the Rings", "I will take the Ring to Mordor. Though... I do not know the way.", "Frodo", ["will", "Present Simple (negative)"], "C", ""),
    ("Lord of the Rings", "We had one, yes. What about second breakfast?", "Pippin", ["Past Simple (had)", "What about...?"], "C", ""),
    ("Lord of the Rings", "Sam... I'm glad you're with me.", "Frodo", ["to be + adjective"], "E", ""),
    ("Lord of the Rings", "I cannot do this alone.", "Frodo", ["can/cannot"], "E", "перекличка с Supernatural S01E01"),
    ("Lord of the Rings", "I can't carry it for you...BUT I CAN CARRY YOU!", "Samwise", ["can/can't"], "D", "фрагмент реплики"),
    ("Lord of the Rings", "I do not fear death.", "Aragorn", ["Present Simple (negative)"], "D", ""),
    ("Lord of the Rings", "Even the smallest person can change the course of the future.", "Galadriel", ["can", "superlative"], "C", ""),
    ("Lord of the Rings", "Nothing is certain.", "Elrond", ["to be"], "D", ""),
    ("Lord of the Rings", "My friends...you bow to no one.", "Aragorn", ["Present Simple"], "D", ""),
    ("Lord of the Rings", "It's a long way.", "Aragorn", ["to be"], "E", "фраза путешественника"),
    ("Lord of the Rings", "I'm on your side, Mr. Frodo.", "Samwise", ["to be", "prepositions"], "E", ""),
    ("Lord of the Rings", "I'm glad to be with you, Samwise Gamgee, here at the end of all things.", "Frodo", ["to be + adjective", "to-infinitive"], "C", ""),
    # --- Star Wars
    ("Star Wars", "May the Force be with you.", "Han Solo", ["may (wish)"], "D", ""),
    ("Star Wars", "No. I am your father.", "Vader", ["to be"], "E", ""),
    ("Star Wars", "I love you.", "Leia", ["Present Simple"], "E", "пара с «I know.»"),
    ("Star Wars", "I know.", "Han", ["Present Simple"], "E", ""),
    ("Star Wars", "No! Try not. Do... or do not. There is no try.", "Yoda", ["Imperative", "there is"], "D", ""),
    ("Star Wars", "I have a very bad feeling about this.", "Luke Skywalker", ["have"], "D", "повторяется во всех фильмах"),
    ("Star Wars", "Use the Force, Luke.", "Obi-Wan Kenobi", ["Imperative"], "E", ""),
    ("Star Wars", "The Force is strong with this one.", "Darth Vader", ["to be"], "E", ""),
    ("Star Wars", "That is why you fail.", "Yoda", ["Present Simple", "that is why"], "D", ""),
    ("Star Wars", "It's a trap!", "Ackbar", ["to be", "article a"], "D", "мем"),
    ("Star Wars", "That boy is our last hope.", "Obi-Wan", ["to be"], "E", ""),
    ("Star Wars", "He's my father.", "Luke", ["to be"], "E", ""),
    ("Star Wars", "Never tell me the odds!", "Han", ["Imperative (never)"], "C", "odds — B2"),
    ("Star Wars", "Search your feelings. You know it to be true.", "Vader", ["Imperative", "Present Simple"], "C", ""),
    # --- Berserk
    ("Berserk", "Do whatever you want now. But if you disturb me, I'll kill you.", "Guts", ["Imperative", "First Conditional"], "B", "раздел манги (перевод манги, не дубляж)"),
    ("Berserk", "I'd rather fight for my life than live it.", "Guts", ["would rather"], "B", "раздел манги"),
    ("Berserk", "In the end the winner is still the last man standing.", "Guts", ["to be", "superlative/last"], "C", "раздел манги"),
    ("Berserk", "When you meet your God, tell him to leave me alone.", "Guts", ["Imperative", "when-clause"], "C", "раздел манги"),
    ("Berserk", "A dream... It's something you do for yourself, not for others.", "Griffith", ["to be", "Present Simple"], "D", "раздел манги"),
    ("Berserk", "Alright! Let's have a drink.", "Guts", ["Let's"], "E", "аниме 1997, серия «Bonfire of Dreams»"),
    ("Berserk", "From now on, he is a member of the Hawks!", "Griffith", ["to be"], "D", "аниме 1997, «First Battle»"),
    ("Berserk", "You know nothing about women!", "Casca", ["Present Simple"], "E", "аниме 1997"),
    ("Berserk", "Casca! It's me. Guts!", "Guts", ["to be"], "E", "аниме 1997, «The Advent»"),
    ("Berserk", "Who the hell are you?", "Guts", ["wh-question", "to be"], "E", "грубоватое: the hell"),
    # --- FMA / FMA:B
    ("FMA / FMA:B", "Humankind cannot gain anything without first giving something in return.", "Alphonse", ["can/cannot", "without + -ing"], "C", "фрагмент вступления (FMA 2003 и Brotherhood)"),
    ("FMA / FMA:B", "DON'T CALL ME LITTLE!", "Edward", ["Imperative (negative)"], "E", "Brotherhood; в источнике капсом"),
    ("FMA / FMA:B", "I'm his younger brother, Alphonse.", "Alphonse Elric", ["to be", "comparative younger"], "E", "Brotherhood 1.01, фрагмент"),
    ("FMA / FMA:B", "Stand up and walk. Keep moving forward. You've got two good legs.", "Edward", ["Imperative", "have got"], "D", "Brotherhood 1.03, фрагмент"),
    ("FMA / FMA:B", "Brother, you don't understand.", "Alphonse", ["Present Simple (negative)"], "E", "FMA 2003"),
    ("FMA / FMA:B", "I'm sorry, brother.", "Alphonse", ["to be"], "E", "Brotherhood"),
    ("FMA / FMA:B", "Brother, I could never... I could never hate you!", "Alphonse", ["could"], "C", "FMA 2003"),
    ("FMA / FMA:B", "Is it from my brother? Is he okay?", "Alphonse", ["to be (question)"], "E", "FMA 2003"),
    ("FMA / FMA:B", "Equivalent exchange!", "Edward", ["noun phrase"], "C", "Brotherhood; ключевой термин (B2-лексика)"),
    ("FMA / FMA:B", "What a nasty thing to do.", "Edward", ["What a ...!"], "D", "Brotherhood 1.01"),
    ("FMA / FMA:B", "Water freezes, water boils. Either way, you're just as dead.", "Isaac", ["Present Simple (3rd person -s)"], "C", "Brotherhood 1.01"),
    ("FMA / FMA:B", "Brother, please do something.", "Alphonse", ["Imperative", "please"], "E", "FMA 2003"),
    # --- Attack on Titan (Wikiquote part)
    ("Attack on Titan", "Give up on your dreams and die!", "Levi, to Erwin", ["Imperative", "phrasal verb give up"], "D", ""),
    ("Attack on Titan", "Someone who can't sacrifice anything, can't ever change anything.", "Armin", ["can/can't", "relative clause who"], "C", ""),
    ("Attack on Titan", "Because I was born into this world!", "Eren", ["was born"], "C", ""),
    ("Attack on Titan", "Sorry, that was a strange thing to ask.", "Erwin", ["Past Simple (was)"], "C", ""),
    ("Attack on Titan", "Who’s the real enemy here?", "Erwin", ["wh-question", "to be"], "D", ""),
]

def find(title, sub, speaker):
    cands = [x for x in U if x["title"] == title and sub in x["text"]]
    if speaker:
        c2 = [x for x in cands if speaker.lower() in x["speaker"].lower()]
        cands = c2 or cands
    return cands[0] if cands else None

out, missing = [], []
for title, sub, spk, tags, rank, note in W:
    x = find(title, sub, spk)
    if not x:
        missing.append((title, sub))
        continue
    se = x["episode"] or x["section"]
    if title == "Berserk":
        se = ("манга: раздел «%s»" % x["section"]) if x["section"] in ("Guts", "Griffith", "Judeau", "Skull Knight", "Narrator") else ("аниме 1997: «%s»" % x["section"])
    if title in ("Lord of the Rings", "Star Wars"):
        se = x["file"][:-4].replace("__", ": ").replace("_", " ")
    item = {"title": title, "source_url": wq_url(x["file"]), "season_episode": se,
            "speaker": x["speaker"], "text": sub.strip('"') if sub.startswith('"') and sub.endswith('"') and sub.count('"') == 2 else sub,
            "grammar_tags": tags, "est_rank": rank,
            "auto_vocab": {"top1000": round(wq.coverage(sub)["top1000"], 2) if wq.coverage(sub) else None},
            "confidence": "verbatim (Wikiquote)"}
    if sub != x["text"]:
        item["note"] = note if note.startswith("фрагмент") else ("фрагмент более длинной реплики. " + note).strip()
    elif note:
        item["note"] = note
    out.append(item)

IMDB_AOT = "https://www.imdb.com/title/tt2560140/quotes/"
IMDB_BERSERK = "https://www.imdb.com/title/tt0318871/quotes/"
SR_JJK = "https://screenrant.com/best-jujutsu-kaisen-quotes/"
CB_JJK = "https://comicbook.com/anime/news/best-jujutsu-kaisen-quotes-ranked/"
FANDOM_YUJI = "https://jujutsu-kaisen.fandom.com/wiki/Yuji_Itadori"
SR_SL = "https://screenrant.com/solo-leveling-best-jinwoo-quotes/"
POLY = "https://www.polygon.com/best-video-game-quotes/"
KYM = "https://knowyourmeme.com/memes/"
UNVER = "уточнить по дубляжу/субтитрам: текст взят из статьи-подборки, заголовки там в Title Case — регистр нормализован"

EXT = [
    # title, url, season_episode, speaker, text, tags, rank, confidence, note
    ("Attack on Titan", IMDB_AOT, "", "Eren Jaeger", "I just keep moving forward. Until I destroy my enemies.", ["Present Simple", "until-clause"], "D", "IMDb (англ. дубляж/сабы, пользовательский ввод)", ""),
    ("Attack on Titan", IMDB_AOT, "", "Mikasa Ackermann", "This world is cruel... But it's also very beautiful.", ["to be", "adverbs also/very"], "D", "IMDb", ""),
    ("Attack on Titan", IMDB_AOT, "", "Eren Jaeger", "Fight!", ["Imperative"], "E", "IMDb", "«Tatakae» в англ. версии"),
    ("Attack on Titan", IMDB_AOT, "", "Soldier", "May I please have some of that Potato?", ["May I...? (polite request)"], "D", "IMDb", "сцена Саши с картошкой; вежливая просьба — полезно в кафе"),
    ("Attack on Titan", IMDB_AOT, "", "Eren Jaeger", "You're a disease!", ["to be", "article a"], "E", "IMDb", ""),
    ("Attack on Titan", IMDB_AOT, "", "Eren Jaeger", "I'll stay alive to keep his memory alive.", ["will", "to-infinitive of purpose"], "C", "IMDb", ""),
    ("Berserk", IMDB_BERSERK, "аниме 1997", "Guts / Judeau", "What kind of a man is he? — Griffith? I don't know.", ["wh-question", "Present Simple (negative)"], "E", "IMDb", "мини-диалог из двух реплик"),
    ("Berserk", IMDB_BERSERK, "аниме 1997", "Guts", "Every sword belongs in its sheath.", ["Present Simple (3rd person -s)"], "C", "IMDb", "фрагмент реплики; sheath — редкое слово"),
    ("Jujutsu Kaisen", SR_JJK, "манга, гл. 221 (в аниме — позже)", "Satoru Gojo", "Nah, I'd win.", ["would ('d)"], "C", "статья Screen Rant; " + UNVER, "мем; у фразы спорная история перевода — см. KYM nah-id-win"),
    ("Jujutsu Kaisen", SR_JJK, "аниме S2", "Satoru Gojo", "Throughout Heaven and Earth, I alone am the honored one.", ["to be"], "B", "статья Screen Rant; " + UNVER, ""),
    ("Jujutsu Kaisen", SR_JJK, "Jujutsu Kaisen 0", "Satoru Gojo", "Love is the most twisted curse of all.", ["to be", "superlative"], "C", "Screen Rant + ComicBook; " + UNVER, ""),
    ("Jujutsu Kaisen", CB_JJK, "аниме S2E1 «Hidden Inventory»", "Satoru Gojo", "You cryin'?", ["Present Continuous (разговорный, без are)"], "D", "ComicBook (указан англ. дубляж); " + UNVER, "разговорное опущение are"),
    ("Jujutsu Kaisen", CB_JJK, "аниме S2", "Satoru Gojo", "We're the strongest.", ["to be", "superlative"], "E", "ComicBook; " + UNVER, ""),
    ("Jujutsu Kaisen", CB_JJK, "", "Aoi Todo", "What kind of woman is your type?", ["wh-question", "to be"], "D", "ComicBook; " + UNVER, ""),
    ("Jujutsu Kaisen", CB_JJK, "", "Kento Nanami", "Being a child is not a sin.", ["-ing subject", "to be (negative)"], "C", "ComicBook; " + UNVER, ""),
    ("Jujutsu Kaisen", CB_JJK, "аниме S2 (Шибуя)", "Kento Nanami", "Itadori, you've got it from here.", ["have got"], "C", "ComicBook; " + UNVER, ""),
    ("Jujutsu Kaisen", FANDOM_YUJI, "гл. 87 / эп. 32", "Yuji Itadori", "Smart people usually don't brag about being smart.", ["Present Simple (negative)", "adverb usually", "about + -ing"], "C", "Jujutsu Kaisen Wiki (Fandom), раздел Quotes — перевод манги", ""),
    ("Solo Leveling", SR_SL, "аниме, фирменная фраза", "Sung Jinwoo", "Arise.", ["Imperative"], "C", "Screen Rant; " + UNVER, "arise — книжное слово, но ключевое для фанатов"),
    ("Solo Leveling", SR_SL, "аниме", "Sung Jinwoo", "I've been leveling up this whole time.", ["Present Perfect Continuous"], "B", "Screen Rant; " + UNVER, ""),
    ("Solo Leveling", SR_SL, "аниме S2 (финал)", "Sung Jinwoo", "On to the next target.", ["prepositional phrase"], "D", "Screen Rant; " + UNVER, ""),
    ("Solo Leveling", SR_SL, "аниме S2 (Чеджу)", "Sung Jinwoo", "Fancy that. A talking bug.", ["-ing adjective"], "C", "Screen Rant; " + UNVER, ""),
    ("Solo Leveling", SR_SL, "аниме", "Sung Jinwoo", "Because it's only the strong who survive!", ["to be", "the + adjective", "relative clause who"], "C", "Screen Rant; " + UNVER, ""),
    ("Solo Leveling", SR_SL, "аниме S2", "Sung Jinwoo", "I'm borrowing this girl.", ["Present Continuous"], "D", "Screen Rant; " + UNVER, ""),
    ("Solo Leveling", SR_SL, "аниме S2 (красные врата)", "Sung Jinwoo", "Is it OK if I take all of these magic beasts?", ["Is it OK if...? (permission)"], "D", "Screen Rant; " + UNVER, "полезная конструкция для путешествий"),
    ("Solo Leveling", SR_SL, "аниме S1", "Sung Jinwoo", "I don't even need to get angry to kill filth like you.", ["Present Simple (negative)", "to-infinitive"], "C", "Screen Rant; " + UNVER, ""),
    # --- Games (Polygon, 2026)
    ("Игры", POLY, "The Legend of Zelda (1986)", "old man", "It's dangerous to go alone! Take this.", ["to be + adj + to-infinitive", "Imperative"], "D", "Polygon (топ-100)", ""),
    ("Игры", POLY, "Diablo (1996)", "Deckard Cain", "Stay awhile, and listen.", ["Imperative"], "D", "Polygon", ""),
    ("Игры", POLY, "The Elder Scrolls V: Skyrim (2011)", "стражники", "I used to be an adventurer like you. Then I took an arrow in the knee.", ["used to", "Past Simple"], "C", "Polygon", ""),
    ("Игры", POLY, "Portal (2007)", "надпись на стене", "The cake is a lie.", ["to be"], "D", "Polygon", ""),
    ("Игры", POLY, "Super Mario Bros. (1985)", "Toad", "Thank you Mario! But our princess is in another castle!", ["to be", "prepositions in"], "D", "Polygon", ""),
    ("Игры", POLY, "God of War (2018)", "Kratos", "Don't be sorry. Be better.", ["Imperative (be)", "comparative better"], "E", "Polygon", ""),
    ("Игры", POLY, "Grand Theft Auto: San Andreas (2004)", "CJ", "Ah shit, here we go again.", ["here we go"], "E", "Polygon", "грубое: shit"),
    ("Игры", POLY, "Undertale (2015)", "Frisk", "Despite everything, it's still you.", ["to be", "despite"], "C", "Polygon", ""),
    ("Игры", POLY, "Fallout (серия)", "рассказчик", "War. War never changes.", ["Present Simple (3rd person -s)", "never"], "D", "Polygon", ""),
    ("Игры", POLY, "Dark Souls (2011)", "Solaire", "Praise the sun!", ["Imperative"], "C", "Polygon", "praise — B1"),
    ("Игры", POLY, "The Legend of Zelda: Ocarina of Time (1998)", "Navi", "Hey! Listen!", ["Imperative"], "E", "Polygon", ""),
    ("Игры", POLY, "Star Fox 64 (1997)", "Peppy", "Do a barrel roll!", ["Imperative"], "C", "Polygon", ""),
    ("Игры", POLY, "Mortal Kombat (1992)", "Scorpion", "Get over here!", ["Imperative", "phrasal verb"], "E", "Polygon", ""),
    ("Игры", POLY, "Souls-серия", "экран смерти", "You died.", ["Past Simple"], "C", "Polygon", ""),
    ("Игры", POLY, "The Oregon Trail", "игра", "You have died of dysentery.", ["Present Perfect"], "B", "Polygon", ""),
    ("Игры", POLY, "Pokémon", "Youngster", "Hi! I like shorts! They're comfy and easy to wear!", ["Present Simple", "to be + adj + to-infinitive"], "D", "Polygon", ""),
    # --- Memes (Know Your Meme pages checked to exist; wording = meme wording)
    ("Мемы", KYM + "this-is-fine", "веб-комикс Gunshow (K.C. Green)", "собака", "This is fine.", ["to be"], "E", "KYM", ""),
    ("Мемы", KYM + "one-does-not-simply-walk-into-mordor", "LOTR: Братство Кольца", "Boromir", "One does not simply walk into Mordor.", ["Present Simple (negative, 3rd person)"], "C", "KYM + IMDb (tt0120737)", "в Wikiquote-странице фильма этой строки нет, есть на IMDb"),
    ("Мемы", KYM + "im-gonna-do-whats-called-a-pro-gamer-move", "", "", "I'm gonna do what's called a pro gamer move.", ["going to (gonna)"], "C", "KYM", "разговорное gonna"),
    ("Мемы", KYM + "how-do-you-do-fellow-kids", "30 Rock", "Steve Buscemi", "How do you do, fellow kids?", ["How do you do (формула)"], "D", "KYM", ""),
    ("Мемы", KYM + "is-this-a-pigeon", "аниме The Brave Fighter of Sun Fighbird", "", "Is this a pigeon?", ["to be (question)"], "E", "KYM / Wikipedia", "аниме-мем"),
    ("Мемы", KYM + "people-die-if-they-are-killed", "Fate/stay night (англ. фан-перевод)", "Shirou Emiya", "People die if they are killed.", ["Zero Conditional", "Passive"], "B", "KYM", "аниме-мем; точная формулировка в оригинальном переводе — уточнить"),
    ("Мемы", KYM + "nah-id-win", "Jujutsu Kaisen, гл. 221", "Satoru Gojo", "Nah, I'd win.", ["would ('d)"], "C", "KYM", "аниме-мем, дублирует JJK"),
    ("Мемы", "https://en.wikiquote.org/wiki/Star_Wars:_Episode_III_%E2%80%93_Revenge_of_the_Sith", "Star Wars: Episode III", "Obi-Wan", "It's over, Anakin! I have the high ground!", ["to be", "have"], "D", "Wikiquote (Episode III, в капсе) + мем", ""),
    ("Мемы", POLY, "Zero Wing (1991)", "CATS", "All your base are belong to us.", ["анти-пример: сломанная грамматика"], "C", "Polygon (#14)", "показывать как «найди ошибку»"),
    ("Мемы", POLY, "Call of Duty: Advanced Warfare (2014)", "подсказка", "Press 'F' to pay respects.", ["Imperative", "to-infinitive of purpose"], "C", "Polygon", ""),
]

for t, url, se, spk, text, tags, rank, conf, note in EXT:
    it = {"title": t, "source_url": url, "season_episode": se, "speaker": spk, "text": text,
          "grammar_tags": tags, "est_rank": rank,
          "auto_vocab": {"top1000": round(wq.coverage(text)["top1000"], 2) if wq.coverage(text) else None},
          "confidence": conf}
    if note:
        it["note"] = note
    out.append(it)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
from collections import Counter
print("written", len(out), "missing", missing)
print(Counter(x["title"] for x in out))
print(Counter(x["est_rank"] for x in out))
