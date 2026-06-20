#!/usr/bin/env python3
"""
Merge data sources into a single public/data/lineup.json.

Sources, in priority order per stage:

  - wakinglife.app — 8 music stages (cochilo, floresta, outro lado, praia,
    apuro, moonscreen, mimo, tudo bem?). Bundle is at /assets/index-*.js.
  - jornr94.github.io/Waking-Life-Timetable ("slay") — Suna stage only.
  - v1 public/data/lineup.json (booklet transcription) — camps, art
    installations, (some) performances (all untimed). Carries `circled: true`
    seeds forward via slug matching.

Re-run any time upstream refreshes:
    python3 scripts/merge_data.py
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "lineup.json"
V1 = ROOT / "public" / "data" / "lineup.json"  # read self if exists for circled seeds

WLAPP_INDEX = "https://wakinglife.app/"
SLAY_URL = "https://jornr94.github.io/Waking-Life-Timetable/"

DAY_SHORT = {
    "tuesday":   "tue",
    "wednesday": "wed",
    "thursday":  "thu",
    "friday":    "fri",
    "saturday":  "sat",
    "sunday":    "sun",
    "monday":    "mon",
}
DAY_DATES = {
    "tue": "2026-06-16",
    "wed": "2026-06-17",
    "thu": "2026-06-18",
    "fri": "2026-06-19",
    "sat": "2026-06-20",
    "sun": "2026-06-21",
    "mon": "2026-06-22",
}

STAGES = {
    "cochilo":          {"label": "Cochilo",          "color": "#E8D9A8", "kind": "live"},
    "floresta":         {"label": "Floresta",         "color": "#A8D49B", "kind": "club"},
    "outro-lado":       {"label": "Outro lado",       "color": "#9BB89B", "kind": "club"},
    "praia":            {"label": "Praia",            "color": "#9BC4E8", "kind": "club"},
    "apuro":            {"label": "Apuro",            "color": "#E89B9B", "kind": "performance"},
    "moonscreen":       {"label": "Moonscreen",       "color": "#D89BC8", "kind": "cinema"},
    "mimo":             {"label": "Mimo",             "color": "#E8BC8A", "kind": "live"},
    "tudo-bem":         {"label": "Tudo Bem?",        "color": "#C49BE8", "kind": "workshop"},
    "suna":             {"label": "Suna",             "color": "#D89B9B", "kind": "workshop"},
    "camping": {
        "label": "Creative camps",
        "color": "#B8A788",
        "kind": "ongoing",
        "intro": (
            "Campiriñas para todas! Creative Camps are thematic bairros that add refreshing, "
            "weird & funky participatory spaces on the campsite. Driven by individuals or small "
            "collectives, they are experimental, temporary spaces for campsite vibe elevation, "
            "investigation and transmutation. Take a whirl.."
        ),
    },
    "art-installation": {
        "label": "Art installations",
        "color": "#9AAFAB",
        "kind": "ongoing",
        "intro": (
            "Material inventions drawing out immaterial reactions. Whether in canopies, dusty "
            "corners or the lake's edge, the terrain is laden with artistic booby traps. Try not "
            "to get ensnared."
        ),
    },
    "performances": {
        "label": "(some) performances",
        "color": "#C9B080",
        "kind": "ongoing",
        "intro": (
            "If you keep your eyes wide shut you might catch a glimpse of a performance or two, "
            "a sizzle, a spark, and collision with the fantastical may include you if you're in "
            "the right place at the right time. Where does the line blur between the performer "
            "and the audience? You can't have FOMO if you don't know when you're missing in action.."
        ),
    },
}


# ─── Booklet items: untimed entries for camps / art / performances ──────────
#
# Source: input/IMG_1533_art.jpeg through IMG_1541_some performances.jpeg.
# Each row is (artist, description). The booklet groups them by section heading.

BOOKLET_CAMPING = [
    ("Venga Bingo", "You've never played bingo like this. A night full of drag, performances, sass, and punk, hosted by our iconic Venga Girls. Come for the game, stay for the drama, and win sexy prizes!"),
    ("A Mesa", "A growing table, rotating DIY workshops, weird materials, and good company. Weaving, animating, sewing, synthesising, tarot-making, incense-rolling and more. Find a seat, something's always happening."),
    ("Cloud 9 on 7 Heaven", "A living apple tree suspended in a white dreamworld. No gatekeepers, no agenda. Come lie down and remember you're made of mud."),
    ("Costura Armada", "Sew, repair, upcycle… Drop off your textile leftovers while you're at it. Repair is radical, and honestly quite satisfying."),
    ("Cramp Camp", "Free period care, herbal tea, a cool breeze, and zero shame. Also: a parade. You'll know it when you see it."),
    ("Cubko's Lab", "Old PVC banners become handmade pouches and bags, one-of-a-kind and built for dancing. Your hands do the work, your imagination does the rest."),
    ("Daydream Assembly", "Listen to your body, then sew it a little, friend. Take it, leave it, or give it away… you decide where your cushion goes pushin'."),
    ("Draw for Your Life", "Daily sessions, live models, themed nights. Full permission to look intensely at another human being."),
    ("Dusty Dusk", "Live, improvised, unplanned. Music that emerges from the day and disappears into the night. Curious ears and spontaneous collaborators welcome!"),
    ("Eden Cinema", "Banned films. Fake candles. Strange conversations. Find it if you can."),
    ("Entre Mãos", "A haircut as a conscious ritual. Trust the hands, surrender the hair, leave somehow different."),
    ("Gratitude Cleanse", "Write what you're grateful for, bless some sad-looking plants, bring them to the lake, wash each other's hands, make incense to take home. Mona holds the space. The rest is magic."),
    ("Ham-nafas Animation Workshop", "Make a tiny animation, add it to everyone else's, and receive the collective film at the end. In Farsi, ham-nafas means sharing the same breath, so inhale."),
    ("Huritao", "Create a self-portrait on a tile from foraged materials. Hang it on the wall, and become part of a collective class picture."),
    ("Improv Mojo Dojo", "Paint with everything you've ever lived through, in coordination with others. Beginners, advanced, and the curious are all welcome in this open fruit-salad activity. Just try it out, or come and watch."),
    ("Loom Room", "A 4x4m loom, lots of weird materials, zero instructions. Come weave something into existence."),
    ("Moon Shack", "Moon Shack, baby, moon shack! Confess to the moon, get a wish, and pass it around. She's listening."),
    ("Nave del Sonido", "Mess around on synths, record it on a cassette, keep the tape. Like a sound photograph, but cooler and slightly noisier."),
    ("Parallel Truths", "Whisper something into a plant. The rest is hard to explain."),
    ("Pieces Chess Club", "Chess, but social. Music, fun, and a few surprises from a club that's taken over Lisbon, London, Oslo, and now Crato."),
    ("Samara Pod", "A womb-like pod abandoned in the undergrowth by persons or civilisations unknown. Scientists are taking notes. You should probably go inside."),
    ("Tarot Craft Lab", "Make your own tarot cards. Intuition required, art skills not so much."),
    ("Tarot Sanctuary", "A one-to-one therapeutic tarot reading in a softly held space. Not to predict your future, but to help you understand your present. Also roaming the festival for a one-card hit if you feel called."),
    ("Tinctorium Plant Lab", "A witches' kitchen where the plants finally tell you their secrets. Come after dark too, some of them glow."),
    ("Tranquilo Toss", "Pétanque. Sun. Maybe pastis. Definitely new friends."),
    ("Waky's Vault", "Craft your own little container from bamboo and cork. For butts, treasures, or honestly whatever :)"),
    ("Weaving Worlds", "Add your thread to a collective tapestry growing all week long. Weavever you go you are part of the pattern."),
    ("Whimsical Theatre", "Improv, movement, character: step outside yourself for a bit. Unscripted, ungovernable."),
]

BOOKLET_ART = [
    ("Bus stop", "Sunburn Gaze. A lost urban artefact. A stage for the inspired. A space for social encounters and strange visions. What happens in the bus stop, no one talks about. But the lights keep flickering as if something weird will happen tonight."),
    ("Call your grandma", "minipops. A side-quest where embracing old technology and forgotten traditions will surface questions that only your elders have an answer to."),
    ("CALMA", "Mopets off-grid. CALMA. If you are lucky you will find CALMA in the deep wilderness of the terrain… a hidden space to rest your spirit & lounge in nature at daytime and catch performative surprises & light art at night…"),
    ("Chandeliers", "Parker Heyl. Two kinetic Chandeliers inspired by the 1875 work of mathematician Harry Hart. They echo the complexity of digital imagery, yet these sculptures achieve a physical object aura by using purely analog and mechanical technologies."),
    ("Cold Sauna", "Service Continu. A sensory refuge, this 'cold sauna' cooling effect extends the lake's cooling effect through a simple closed-loop water system. Lake water is pumped to create a gentle artificial rain, cooling the space. Filtered light, dampened sound, and reclaimed materials create a low-tech, reversible retreat for rest and reset."),
    ("Fugazmente", "Guardians of Words. A curated sanctuary of textual spirituality and poetry with spirit. Join the Guardians of Words to explore the cosmos by peeking into new perspectives through the bewildering spell of language."),
    ("KäasKäde", "JeJoMaDe. A platform by the waterfront where people can chill, wonder and be pleasantly confused. A confusing mix of harbour & cheese, many options to hang & sit, swing, nibble & crawl."),
    ("OvO", "Oliver Ellmers. Reimagining OvO as a darker, more minimal parametric sculpture. The design is generative in approach, using light, reflection and refraction to continuously reshape the space. It's intended as a calm but uncanny place to reset and drift through a more cinematic mood."),
    ("Midsummer Mouramas", "Cella Collective. These lakeside structures turn local ecology, geology and folklore, into spaces for contemplative bathing and soaking. These dwellings house the 'Enchanted Moura' and they invite you to enjoy the threshold between land and water, waiting and becoming."),
    ("Mimo Smellscape", "Vlenser. Scent slips past logic, straight into memory, into feeling — at Mimo, we follow this invisible thread. Locally gathered, constantly shifting, smell is our guide. No labels, no hierarchy — but sensation rewiring perception, dissolving limits, and pulling you deep into the olfactory subconscious."),
    ("Mudança", "Echo Studios. Mudança is inspired by butterfly evolution, structures across water reflect each phase. Visitors move through a living narrative. Strangers breathe together, less alone in change. Something shifts and loosens. We leave differently than we arrived, gently rearranged, not new, not whole."),
    ("Piñata", "Robin Jae. Here, blind violence is rewarded, for a piñata is completed by its destruction! These days the game is performed for thrills and rewards. Yet, if the piñata is made to be a demon, or a spirit, its destruction becomes a symbolic gesture. O' brave warrior, your prize awaits… Come! Conquer! Liberate spirit!"),
    ("WWW - WakingLife Wide Web", "ARAS, Coletivo Giria, Louise. A participatory crochet installation developed through workshops involving both residents of Crato and festival crew. Young and old and local and not, are invited to contribute with crochet 'granny squares' that will be assembled into a shared textile structure creating the intimate, cosy, colourful 'Crocave'."),
    ("you me we", "Christian Wolf. Experience your body, experience embodiment in time and space, with your next one. Reflect, realize, create, be in the now."),
    ("casa marmelada", "We are the stone house, you are the milk, drawn from the silence of granite and silk. A psychedelic picnic for the soul unfolds in the cottage no one can control. Casa Marmelada is open… then not, a door that remembers what footsteps forgot. We lure you with stories, then send you along, you'll leave with a new tune, a different song. No beans will we spill, not a secret, nor clue — just sneaky-peek knowing between us and you. So come to the edge of the nearly-unseen: the stone house is pouring from places between."),
]

BOOKLET_PERFORMANCES = [
    ("Morada Aberta: Onde o Gesto Cura (closing performance)", "Tânia Dinis. Three interconnected moments, unfolding across languages, spaces and temporalities. Drawing from personal memory and the landscapes of North Portugal, Alto Minho and Galiza, this expanded cinema work follows working women — guardians of ancestral knowledge tied to land, sea and natural cycles. Between documentary and fiction, it traces the invisible gestures that sustain communities and keep sacred knowledge alive."),
    ("A Quiet Spirit", "CALMA. A durational performance where a sculptural element is slowly transformed into a living wind chime. Through gentle movement, sound and light, the space is subtly activated. What emerges is a fleeting, poetic moment, and a resonance that remains beyond the night."),
    ("Die Höhle", "c.a.l.perspectives. Installations of inhabitable camera obscura, offering direct contact with the natural phenomenon that makes photography possible. Enter into relationship with the upside down, and an archaeological experience of the image."),
    ("EMBARCAÇÃO-ENTIDADE", "Brittany Maton, Eleni Giannopoulou & others. A floating masquerade without a schedule. Part ritual, part hallucination, part boat. Somewhere between folklore, science-fiction, and the weird."),
    ("L'Opéra du Villageois", "Zora Snake and Wilfried Nakeu. A burial and liberation ritual. L'Opéra du Villageois denounces the European museums that harbour looted art in their collections and conjures up the spirit of the stolen objects. Snake reclaims everything that thecolonial powers have plundered over the past centuries: the gold, the salt, the history. But their spirits are not dead…"),
    ("La Belleza es Asquerosa", "Asquito Eso. A body both fragile and fierce, shapeshifting and endlessly reborn. A striptease unfolds not to seduce but to speak out. Here sensuality trembles with rage and anger undresses itself slowly. This body, improbably, beautiful, grotesque, defiant, wears its rawness like myth."),
    ("Miranda & the Andacondas present 'Judge not lest ye be judged'", "Knetterbar. Knetterbar is a condensed microcarnival — a portal of kaos & magic where time bends and joyfulness grooves through surreal scenes. Hosted by Miranda from the Multiverse and her highly professional this-year-not-so-randomly assigned assistants. Expect hijinks, volcanic dances, disco sound massages and mystery snacks. Reality? Maybe. Fun? Definitely."),
    ("Silêncio não é Silencioso", "Azuru. Shhhhhhhhhhhhhhhhhhhhhhhhhhhhh."),
    ("Soft Cryptogamic Drifts", "M.O.S.S.S. (Moving Observations on Surviving Soft Skills) & Landcare Club. Enter the long now, armed with affective tools and tear into small breaches in reality. With cryptogamics as our kin, bryophytes, lichens, seaweed, fungi, ferns, we play with the invisible and kneel before mystery."),
    ("Song for the Lake", "nitamortei + maud gyssels. Which human, inhuman, past and future voices can be heard in interaction with the lake as a source of histories, narratives and rituals? Its movement is circular. Consider it a looping song, an invitation to wade in the shallow waters."),
    ("Tuning folk, Tuning folks, Tuning forks", "RÆV. (Vera & Eva Maria). Equipped with tuning forks and other instruments, the Tuning Folk roam around, finding depleted souls, and nurturing them back to life."),
    ("Water Bearer", "Riley Davidson & Hadrien Daigneault-Roy. A response to the announcement from hydrologists of a global water bankruptcy, the performance treats water as precious alchemical matter, resonating at the core of our flesh. Quicksilver and tears, rivers and prayer."),
]

# Default attribution day for untimed entries — they appear on the same day regardless,
# but `day` is required by the schema. Use Wednesday for camping/art (festival opens),
# Sunday for performances (Morada Aberta is the Sun → Mon closing performance).
BOOKLET_DAY = {
    "camping": "wed",
    "art-installation": "wed",
    "performances": "sun",
}

# L'Opéra du Villageois is circled in the booklet — preserve the favourite seed.
BOOKLET_CIRCLED = {"L'Opéra du Villageois"}


def build_booklet_events() -> list[dict]:
    out = []
    sources = [
        ("camping", BOOKLET_CAMPING),
        ("art-installation", BOOKLET_ART),
        ("performances", BOOKLET_PERFORMANCES),
    ]
    for stage, items in sources:
        for artist, desc in items:
            ev = {
                "id": event_id("untimed", None, stage, artist),
                "artist": artist,
                "stage": stage,
                "day": BOOKLET_DAY[stage],
                "start": None,
                "end": None,
                "description": desc,
                "genres": [],
                "country": None,
                "countryCode": None,
            }
            if artist == "Venga Bingo":
                ev["when"] = "Tuesday only"
                ev["day"] = "tue"
            if artist in BOOKLET_CIRCLED:
                ev["circled"] = True
            out.append(ev)
    return out


UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"


def fetch(url: str) -> str:
    print(f"  GET {url}", file=sys.stderr)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", errors="replace")


def stage_slug(name: str) -> str:
    s = name.strip().lower()
    s = s.replace("?", "")
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"[^a-z0-9-]", "", s)
    return s


def artist_slug(name: str) -> str:
    s = name.strip().lower()
    # strip accents
    s = (s.replace("á","a").replace("à","a").replace("â","a").replace("ã","a").replace("ä","a")
           .replace("é","e").replace("è","e").replace("ê","e").replace("ë","e")
           .replace("í","i").replace("ì","i").replace("î","i").replace("ï","i")
           .replace("ó","o").replace("ò","o").replace("ô","o").replace("õ","o").replace("ö","o")
           .replace("ú","u").replace("ù","u").replace("û","u").replace("ü","u")
           .replace("ñ","n").replace("ç","c").replace("ß","ss")
           .replace("’","'").replace("&","and").replace("–","-").replace("—","-"))
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def event_id(day: str, start: str | None, stage: str, artist: str) -> str:
    a = artist_slug(artist)
    if start:
        return f"{day}-{start.replace(':','')}-{stage}-{a}"
    return f"{stage}-{a}"


def split_genres(raw: str) -> list[str]:
    if not raw:
        return []
    parts = re.split(r"[/,]+", raw)
    seen, out = set(), []
    for p in parts:
        p = p.strip()
        if not p or p.lower() in seen:
            continue
        seen.add(p.lower())
        out.append(p)
    return out


# ─── 1. wakinglife.app extraction ─────────────────────────────────────────────

def extract_wlapp(bundle_js: str) -> list[dict]:
    """Find every event-shaped object in the bundle. Tolerant: keys may appear
    in any order, optional ones may be missing."""

    def find_object_at(idx: int) -> str | None:
        """Walk forward from idx (which is at '{') matching brace depth,
        skipping over string literals so internal braces don't confuse us."""
        if bundle_js[idx] != "{":
            return None
        depth = 0
        i = idx
        in_str = False
        esc = False
        while i < len(bundle_js):
            ch = bundle_js[i]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
            else:
                if ch == '"':
                    in_str = True
                elif ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        return bundle_js[idx : i + 1]
            i += 1
        return None

    def get_str(obj: str, key: str) -> str | None:
        m = re.search(rf'(?:^|[,{{]){re.escape(key)}:"((?:[^"\\]|\\.)*)"', obj)
        return unescape_js(m.group(1)) if m else None

    out = []
    seen_obj_starts = set()
    # Anchor on `{name:"..."` — every event starts this way per the bundle.
    for m in re.finditer(r'\{name:"', bundle_js):
        start = m.start()
        if start in seen_obj_starts:
            continue
        obj = find_object_at(start)
        if not obj:
            continue
        seen_obj_starts.add(start)

        # Must look like an event: needs stage + day OR start/begin time
        if "stage:" not in obj or "day:" not in obj:
            continue

        name  = get_str(obj, "name")
        stage = get_str(obj, "stage")
        day   = get_str(obj, "day")
        if not (name and stage and day):
            continue

        # Skip nested objects that contain other event-like braces inside
        # (defensive — shouldn't trigger for flat event records)
        if "{name:" in obj[1:]:
            continue

        begin = get_str(obj, "begin") or get_str(obj, "start")
        end   = get_str(obj, "end")
        genre = get_str(obj, "genre") or ""
        country = get_str(obj, "country") or ""
        code  = get_str(obj, "countryCode") or ""
        desc  = get_str(obj, "description") or ""

        stage_s = stage_slug(stage)
        day_s = DAY_SHORT.get(day.lower())
        if not day_s or stage_s not in STAGES:
            continue

        out.append({
            "id": event_id(day_s, begin, stage_s, name),
            "artist": name,
            "stage": stage_s,
            "day": day_s,
            "start": begin if begin else None,
            "end": end if end else None,
            "description": desc.strip(),
            "genres": split_genres(genre),
            "country": country or None,
            "countryCode": code or None,
        })
    return out


def unescape_js(s: str) -> str:
    return (s.replace('\\"', '"')
             .replace("\\'", "'")
             .replace("\\\\", "\\")
             .replace("\\n", "\n")
             .replace("\\u0026", "&"))


def find_bundle_url(html: str) -> str | None:
    m = re.search(r'src="(/assets/index-[A-Za-z0-9_-]+\.js)"', html)
    return m.group(1) if m else None


# ─── 2. slay (suna) extraction ────────────────────────────────────────────────

def hours_to_hhmm(h: float) -> str:
    # decimal hours, may be > 24 (e.g. 25.5 = 01:30 next morning).
    h_mod = h % 24
    hh = int(h_mod)
    mm = int(round((h_mod - hh) * 60))
    if mm == 60:
        hh = (hh + 1) % 24
        mm = 0
    return f"{hh:02d}:{mm:02d}"


def extract_slay_stage(slay_html: str, stage_id: str, *, default_genres=None) -> list[dict]:
    """Extract all E("<stage_id>",...) events from slay HTML."""
    out = []
    pattern = re.compile(
        rf'E\("{re.escape(stage_id)}","(\w+)",([\d.]+),([\d.]+),"((?:[^"\\]|\\.)*)","((?:[^"\\]|\\.)*)"'
        r'(?:,\{[^}]*\})?\)',
    )
    for m in pattern.finditer(slay_html):
        day_full, start_h, end_h, title, desc = m.groups()
        day_s = DAY_SHORT.get(day_full.lower())
        if not day_s:
            continue
        start = hours_to_hhmm(float(start_h))
        end = hours_to_hhmm(float(end_h))
        # Genre defaulting: suna = Workshop/Play party by duration; moonscreen = Cinema.
        if default_genres is not None:
            genres = list(default_genres)
        elif stage_id == "suna":
            genres = ["Workshop"] if not float(end_h) - float(start_h) >= 4 else ["Play party"]
        else:
            genres = []
        out.append({
            "id": event_id(day_s, start, stage_id, title),
            "artist": unescape_js(title),
            "stage": stage_id,
            "day": day_s,
            "start": start,
            "end": end,
            "description": unescape_js(desc).strip(),
            "genres": genres,
            "country": None,
            "countryCode": None,
        })
    return out


def extract_suna(slay_html: str) -> list[dict]:
    return extract_slay_stage(slay_html, "suna")


def extract_moonscreen_slay(slay_html: str) -> list[dict]:
    return extract_slay_stage(slay_html, "moonscreen", default_genres=["Cinema"])


# ─── 3. v1 untimed carryover ──────────────────────────────────────────────────

UNTIMED_STAGES = {"camping", "art-installation", "performances"}


def load_v1_untimed() -> list[dict]:
    if not V1.exists():
        return []
    try:
        d = json.loads(V1.read_text())
    except Exception:
        return []
    out = []
    for e in d.get("events", []):
        if e.get("stage") in UNTIMED_STAGES and not e.get("start"):
            out.append({
                "id": e["id"],
                "artist": e["artist"],
                "stage": e["stage"],
                "day": e.get("day", "tue"),
                "start": None,
                "end": None,
                "description": e.get("description", ""),
                "genres": [],
                "country": None,
                "countryCode": None,
                "when": e.get("when"),
            })
    return out


def load_v1_circled_artists() -> set[str]:
    """Return set of artist-name-slugs that were circled in v1, so we can
    re-mark matching v2 events as circled even though IDs changed."""
    if not V1.exists():
        return set()
    try:
        d = json.loads(V1.read_text())
    except Exception:
        return set()
    return {artist_slug(e["artist"]) for e in d.get("events", []) if e.get("circled")}


# ─── merge ────────────────────────────────────────────────────────────────────

def dedupe(events: Iterable[dict]) -> list[dict]:
    seen, out = {}, []
    for e in events:
        if e["id"] in seen:
            # prefer the one with a non-empty description
            if not seen[e["id"]].get("description") and e.get("description"):
                seen[e["id"]] = e
            continue
        seen[e["id"]] = e
        out.append(e)
    return [seen[e["id"]] for e in out]


def main() -> int:
    # 1. wakinglife.app (everything EXCEPT moonscreen — slay has fresher Moonscreen)
    index_html = fetch(WLAPP_INDEX)
    bundle_path = find_bundle_url(index_html)
    if not bundle_path:
        print("! could not find wakinglife.app bundle URL", file=sys.stderr)
        return 1
    bundle_js = fetch(f"https://wakinglife.app{bundle_path}")
    wlapp_all = extract_wlapp(bundle_js)
    wlapp = [e for e in wlapp_all if e["stage"] != "moonscreen"]
    print(f"  wakinglife.app: {len(wlapp)} events (dropped {len(wlapp_all) - len(wlapp)} moonscreen)", file=sys.stderr)

    # 2. slay → suna + moonscreen
    slay_html = fetch(SLAY_URL)
    suna = extract_suna(slay_html)
    moonscreen = extract_moonscreen_slay(slay_html)
    print(f"  slay (suna):    {len(suna)} events", file=sys.stderr)
    print(f"  slay (moon):    {len(moonscreen)} events", file=sys.stderr)

    # 3. Booklet untimed (camps / art / performances) — baked in, replaces v1 untimed.
    untimed = build_booklet_events()
    print(f"  booklet untimed:{len(untimed)} events", file=sys.stderr)

    # combine + dedupe
    all_events = dedupe(wlapp + suna + moonscreen + untimed)

    # mark circled from v1 artist-slug set
    circled_slugs = load_v1_circled_artists()
    n_circled = 0
    for e in all_events:
        if artist_slug(e["artist"]) in circled_slugs:
            e["circled"] = True
            n_circled += 1
    print(f"  circled seeds:  {n_circled}", file=sys.stderr)

    # drop stages with zero events from the stages map
    active_stages = {e["stage"] for e in all_events}
    stages_out = {k: v for k, v in STAGES.items() if k in active_stages}

    # sort by day order, then start, then artist
    day_order = list(DAY_DATES.keys())
    def sort_key(e):
        d = day_order.index(e["day"]) if e["day"] in day_order else 99
        s = e["start"] or "99:99"
        return (d, s, e["artist"].lower())
    all_events.sort(key=sort_key)

    out_obj = {
        "festival": "Waking Life 2026",
        "days": day_order,
        "dayDates": DAY_DATES,
        "timezone": "Europe/Lisbon",
        "stages": stages_out,
        "events": all_events,
    }

    OUT.write_text(json.dumps(out_obj, ensure_ascii=False, indent=2) + "\n")
    print(f"  wrote {OUT.relative_to(ROOT)} — {len(all_events)} events, "
          f"{len(stages_out)} stages, {n_circled} circled", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
