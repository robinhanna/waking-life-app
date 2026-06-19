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
    "camping":          {"label": "Creative camps",   "color": "#B8A788", "kind": "ongoing"},
    "art-installation": {"label": "Art installations","color": "#9AAFAB", "kind": "ongoing"},
    "performances":     {"label": "(some) performances","color": "#C9B080","kind": "ongoing"},
}


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


def extract_suna(slay_html: str) -> list[dict]:
    out = []
    # E("suna","Friday",16,17.5,"Title","facilitator/description"[,{femme:1}])
    pattern = re.compile(
        r'E\("suna","(\w+)",([\d.]+),([\d.]+),"((?:[^"\\]|\\.)*)","((?:[^"\\]|\\.)*)"'
        r'(?:,\{[^}]*\})?\)',
    )
    for m in pattern.finditer(slay_html):
        day_full, start_h, end_h, title, desc = m.groups()
        day_s = DAY_SHORT.get(day_full.lower())
        if not day_s:
            continue
        start = hours_to_hhmm(float(start_h))
        end = hours_to_hhmm(float(end_h))
        out.append({
            "id": event_id(day_s, start, "suna", title),
            "artist": unescape_js(title),
            "stage": "suna",
            "day": day_s,
            "start": start,
            "end": end,
            "description": unescape_js(desc).strip(),
            "genres": ["Workshop"] if not float(end_h) - float(start_h) >= 4 else ["Play party"],
            "country": None,
            "countryCode": None,
        })
    return out


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
    # 1. wakinglife.app
    index_html = fetch(WLAPP_INDEX)
    bundle_path = find_bundle_url(index_html)
    if not bundle_path:
        print("! could not find wakinglife.app bundle URL", file=sys.stderr)
        return 1
    bundle_js = fetch(f"https://wakinglife.app{bundle_path}")
    wlapp = extract_wlapp(bundle_js)
    print(f"  wakinglife.app: {len(wlapp)} events", file=sys.stderr)

    # 2. slay → suna only
    slay_html = fetch(SLAY_URL)
    suna = extract_suna(slay_html)
    print(f"  slay (suna):    {len(suna)} events", file=sys.stderr)

    # 3. v1 untimed
    untimed = load_v1_untimed()
    print(f"  v1 untimed:     {len(untimed)} events", file=sys.stderr)

    # combine + dedupe
    all_events = dedupe(wlapp + suna + untimed)

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
