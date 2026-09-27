"""Parse Wikiquote raw wikitext into utterances and score vocabulary simplicity.

Usage: python3 wq.py            -> summary table + writes utterances.json
"""
import csv, json, os, random, re, sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")

# ---------- frequency lists ----------
def load_freq():
    rank = {}
    with open(os.path.join(HERE, "en_50k.txt"), encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            w = line.split(" ")[0]
            rank.setdefault(w, i)
    return rank

def load_ngsl():
    lemma_rank = {}
    with open(os.path.join(HERE, "ngsl_stats.csv"), encoding="utf-8") as f:
        for row in csv.DictReader(f):
            lemma_rank[row["Lemma"].strip().lower()] = int(row["SFI Rank"])
    form_rank = {}
    with open(os.path.join(HERE, "ngsl_research.csv"), encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            forms = [x.strip().lower() for x in line.split(",") if x.strip()]
            r = lemma_rank.get(forms[0])
            if r is None:
                continue
            for fm in forms:
                form_rank[fm] = min(form_rank.get(fm, 10**6), r)
    return form_rank

FREQ = load_freq()
NGSL = load_ngsl()
CLITICS = {"s", "t", "m", "re", "ve", "ll", "d"}

def word_rank(w):
    """Best (lowest) rank among NGSL lemma rank and subtitle-frequency rank."""
    if w in CLITICS:
        return 1
    return min(NGSL.get(w, 10**6), FREQ.get(w, 10**6))

TOKEN = re.compile(r"[A-Za-z]+")

def tokens(text):
    """Return list of (word_lower, is_proper) with contractions split."""
    out = []
    t = text.replace("’", "'")
    for m in TOKEN.finditer(t):
        w = m.group(0)
        start = m.start()
        prev = t[:start].rstrip()
        sent_start = (not prev) or prev[-1] in ".!?\"'-:;—…(" or prev.endswith("...")
        proper = w[0].isupper() and not sent_start and w != "I" and not w.isupper()
        out.append((w.lower(), proper))
    return out

def coverage(text, names=frozenset()):
    toks = [(w, p) for w, p in tokens(text)]
    content = [w for w, p in toks if not p and w not in names]
    if not content:
        return None
    r = [word_rank(w) for w in content]
    n = len(r)
    return {
        "n": n,
        "top1000": sum(x <= 1000 for x in r) / n,
        "top3000": sum(x <= 3000 for x in r) / n,
        "rare": [w for w, x in zip(content, r) if x > 3000],
    }

from grammar import tag as gtag, RANK_ORDER

def est_rank(text, names=frozenset()):
    """max(vocab rank, grammar rank)."""
    v = vocab_rank(text, names)
    if v is None:
        return None
    g = gtag(text)[1]
    return max(v, g, key=lambda r: RANK_ORDER[r])

def vocab_rank(text, names=frozenset()):
    c = coverage(text, names)
    if c is None:
        return None
    nw = len(tokens(text))
    if c["top1000"] == 1 and nw <= 8:
        return "E"
    if c["top1000"] >= 0.9 and nw <= 15:
        return "D"
    if c["top3000"] >= 0.95:
        return "C"
    return "B"

# ---------- wikitext parsing ----------
SKIP_SECTIONS = re.compile(r"^(cast|external links|see also|about|reviews?|quotes? about|taglines?|references|notes|sources|dialogue about|criticism|voice cast|misattributed|disputed)", re.I)

def clean(text):
    t = re.sub(r"<ref[^>]*/>", "", text)
    t = re.sub(r"<ref[^>]*>.*?</ref>", "", t)
    t = re.sub(r"<[^>]+>", "", t)
    for _ in range(3):
        t = re.sub(r"\{\{[^{}]*\}\}", "", t)
    t = re.sub(r"\[\[(?:File|Image):[^\]]*\]\]", "", t, flags=re.I)
    t = re.sub(r"\[\[[^\]|]*\|([^\]]*)\]\]", r"\1", t)
    t = re.sub(r"\[\[([^\]]*)\]\]", r"\1", t)
    t = re.sub(r"\[https?://\S+\s*([^\]]*)\]", r"\1", t)
    t = t.replace("'''", "").replace("''", "")
    t = re.sub(r"\[[^\]]*\]", "", t)          # stage directions
    t = re.sub(r"^\s*\((?:to|To)[^)]*\)\s*", "", t)  # (To Clarke)
    t = re.sub(r"\s+", " ", t).strip()
    return t

EP = re.compile(r"\[(\d+)\.(\d+)\]")

def parse(path, title):
    utts = []
    section = ""
    ep = ""
    skip = False
    block = 0
    with open(path, encoding="utf-8") as f:
        for raw in f:
            line = raw.rstrip("\n")
            h = re.match(r"^(=+)\s*(.*?)\s*=+\s*$", line)
            if h:
                section = clean(h.group(2))
                m = EP.search(h.group(2))
                if m:
                    ep = f"S{int(m.group(1)):02d}E{int(m.group(2)):02d}"
                    ep_title = clean(EP.sub("", h.group(2)))
                    ep = f"{ep} «{ep_title}»"
                skip = bool(SKIP_SECTIONS.match(section))
                block += 1
                continue
            if skip:
                continue
            if line.startswith("<hr") or not line.strip():
                block += 1
                continue
            speaker, text = None, None
            m = re.match(r"^:+\s*'''(.+?)'''\s*:?\s*(.*)$", line)
            m2 = re.match(r"^'''(.+?)'''\s*(.*)$", line)
            m3 = re.match(r"^\*(?!\*)\s*(.*)$", line)
            if m:
                speaker, text = m.group(1), m.group(2)
            elif m2 and (m2.group(1).endswith(":") or m2.group(2).startswith(":")):
                speaker, text = m2.group(1), m2.group(2).lstrip(":")
            elif m3:
                speaker, text = section, m3.group(1)
            else:
                continue
            speaker = clean(speaker).rstrip(":").strip()
            text = clean(text)
            if not text or len(text) < 2:
                continue
            utts.append({"title": title, "file": os.path.basename(path), "episode": ep,
                         "section": section, "speaker": speaker, "text": text, "block": block})
    return utts

TITLES = {
    "Supernatural": [f"Supernatural_(season_{i})" for i in range(1, 16)],
    "Game of Thrones": [f"Game_of_Thrones_Season_{i}" for i in range(1, 9)],
    "Breaking Bad": [f"Breaking_Bad_(season_{i})" for i in range(1, 6)],
    "The 100": ["The_100_(TV_series)"],
    "Stranger Things": [f"Stranger_Things_Season_{i}" for i in range(1, 6)],
    "Black Mirror": ["Black_Mirror"],
    "Lord of the Rings": ["The_Lord_of_the_Rings__The_Fellowship_of_the_Ring", "The_Lord_of_the_Rings__The_Two_Towers", "The_Lord_of_the_Rings__The_Return_of_the_King"],
    "Star Wars": ["Star_Wars_(film)", "The_Empire_Strikes_Back", "Return_of_the_Jedi", "Star_Wars__Episode_I_–_The_Phantom_Menace", "Star_Wars__Episode_II_–_Attack_of_the_Clones", "Star_Wars__Episode_III_–_Revenge_of_the_Sith", "Star_Wars__The_Force_Awakens", "Star_Wars__The_Last_Jedi"],
    "Berserk": ["Berserk_(anime)"],
    "FMA / FMA:B": ["Fullmetal_Alchemist_(anime)", "Fullmetal_Alchemist__Brotherhood_(anime)"],
    "Attack on Titan": ["Attack_on_Titan"],
}

def nwords(t):
    return len(tokens(t))

def nsent(t):
    return len([s for s in re.split(r"(?<=[.!?])\s+", t) if s.strip()])

INTERJ = re.compile(r"^(huh|what|yeah|yes|no|okay|ok|oh|hey|hmm|uh|um|ah|right|sorry|thanks|well|wait|really|why|sure|fine)\W*$", re.I)

def usable(x):
    t = x["text"]
    return (3 <= x["nw"] <= 15 and nsent(t) <= 2 and x["cov1000"] is not None
            and t[-1] in ".!?" and not re.search(r"(--|–|—)$", t) and not t.startswith("...")
            and not INTERJ.match(t) and "(" not in t)

def main():
    random.seed(42)
    allu = []
    rows = []
    for title, files in TITLES.items():
        u = []
        for fn in files:
            p = os.path.join(RAW, fn + ".txt")
            if os.path.exists(p):
                u += parse(p, title)
        names = set()
        for x in u:
            for w, _ in tokens(x["speaker"]):
                names.add(w)
        names -= {"the", "of", "a", "and", "man", "girl", "boy", "king", "old", "young", "mr", "mrs", "lord", "lady", "sir", "doctor", "father", "mother"}
        for x in u:
            x["nw"] = nwords(x["text"])
            c = coverage(x["text"], frozenset(names))
            x["cov1000"] = round(c["top1000"], 3) if c else None
            x["cov3000"] = round(c["top3000"], 3) if c else None
            x["rare"] = c["rare"] if c else []
            x["est_rank"] = est_rank(x["text"], frozenset(names))
        for x in u:
            x["grammar_tags"] = gtag(x["text"])[0]
        short = [x for x in u if usable(x)]
        sample = random.sample(short, min(100, len(short)))
        def avg(key, xs):
            return sum(x[key] for x in xs) / len(xs) if xs else 0
        # token-weighted coverage on sample
        tok = sum(coverage(x["text"], frozenset(names))["n"] for x in sample) or 1
        t1 = sum(coverage(x["text"], frozenset(names))["top1000"] * coverage(x["text"], frozenset(names))["n"] for x in sample) / tok
        t3 = sum(coverage(x["text"], frozenset(names))["top3000"] * coverage(x["text"], frozenset(names))["n"] for x in sample) / tok
        rk = defaultdict(int)
        for x in short:
            rk[x["est_rank"]] += 1
        blocks = len({(x["file"], x["block"]) for x in u})
        rows.append((title, len(files), len(u), blocks, len(short), t1, t3, rk["E"], rk["D"], rk["C"], rk["B"]))
        allu += u
    hdr = ("title", "pages", "utterances", "blocks", "short<=15w", "tok%top1000(sample100)", "tok%top3000", "E", "D", "C", "B")
    print("\t".join(hdr))
    for r in rows:
        print("\t".join(str(round(v * 100, 1)) if isinstance(v, float) else str(v) for v in r))
    with open(os.path.join(HERE, "utterances.json"), "w", encoding="utf-8") as f:
        json.dump(allu, f, ensure_ascii=False, indent=0)

if __name__ == "__main__":
    main()
