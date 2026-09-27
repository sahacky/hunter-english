"""Very rough regex grammar tagger for short quotes -> (tags, min CEFR-ish rank)."""
import re
IRREG = set("""was were did had said went got made knew thought took saw came gave told found felt left kept let began seemed brought wrote sat stood lost paid met ran heard meant put set became fell forgot forgave broke chose drove ate flew fought hid hit hurt led lay rode rose sang sold sent shot shut slept spoke spent stole struck swore threw understood woke won wore""".split())
RANK_ORDER = {"E": 0, "D": 1, "C": 2, "B": 3}
RULES = [
    # (tag, regex, rank)
    ("present perfect", r"\b(have|has|haven't|hasn't|i've|you've|we've|they've|he's been|she's been|it's been)\s+(\w+ly\s+)?(been|done|got|gotten|seen|\w+ed|made|lost|gone|come|known|taken|given|found|become|had|heard|forgotten|broken|chosen|won|left|said|told)\b", "B"),
    ("passive", r"\b(is|are|was|were|be|been|being)\s+(\w+ly\s+)?(\w+ed|born|done|made|taken|given|known|seen|killed|lost|broken|chosen|forgotten)\b(?!\s+(to|of))", "C"),
    ("conditional/would", r"\b(would|wouldn't|i'd|you'd|he'd|she'd|we'd|they'd)\b|\bif\b", "B"),
    ("modal should/must", r"\b(should|shouldn't|must|mustn't)\b", "C"),
    ("will future", r"\b(will|won't|i'll|you'll|he'll|she'll|we'll|they'll|it'll|shall)\b", "C"),
    ("going to", r"\b(going to|gonna)\b", "C"),
    ("past continuous", r"\b(was|were)\s+\w+ing\b", "C"),
    ("past simple", r"\b(\w+ed|%s)\b" % "|".join(sorted(IRREG)), "C"),
    ("present continuous", r"\b(am|is|are|'m|'re|i'm|you're|we're|they're|he's|she's|it's)\s+(not\s+)?\w+ing\b", "D"),
    ("can", r"\b(can|can't|cannot)\b", "D"),
    ("have got / have", r"\b(have|has|got)\b", "D"),
    ("question word", r"^(what|who|where|why|how|when|which)\b", "D"),
    ("imperative", r"^(don't\s+)?(go|come|run|get|give|take|let|look|stop|leave|tell|help|wait|listen|shut|use|say|do|be|keep|stay|kill|hold|move|call|fly|follow|trust|find|show|bring|remember|forget|watch|make|put|try|sit|stand|open)\b", "E"),
    ("to be", r"\b(am|is|are|i'm|you're|we're|they're|he's|she's|it's|that's|there's|what's|isn't|aren't)\b", "E"),
    ("present simple", r"\b(do|don't|does|doesn't)\b|\b(i|you|we|they)\s+(\w+)\b", "E"),
]
def tag(text):
    t = text.lower().replace("’", "'")
    t_s = re.sub(r"^[^a-z]+", "", t)
    tags, rank = [], "E"
    for name, rx, r in RULES:
        if re.search(rx, t_s if rx.startswith("^") else t):
            if name == "past simple" and re.search(r"\b(need|feed|speed|bleed|seed|indeed|red|bed|shed|hundred|sacred|wicked|naked|sacred|kindred)\b", t) and not re.search(r"\b\w+ed\b(?<!need)(?<!indeed)", t):
                continue
            tags.append(name)
            if RANK_ORDER[r] > RANK_ORDER[rank]:
                rank = r
    return tags, rank
