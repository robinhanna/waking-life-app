# Waking Life — Project Memory

## Global Memory

Read ~/.claude/CLAUDE.md for memory rules and topic files.

## Status

- **v2 shipped** locally as commit `78275cb`. Horizontal-scroll timeline + Lineup + Favourites + Info tabs, full-screen Fusion-style detail modal, genre-filtered favourites, Google Calendar URLs + .ics export, share sheet with QR, user-added events. 303 events across 12 stages, 27 booklet-circled seeded as favourites.
- v1 retained as commit `22b872b` for context.
- Run locally: `cd public && python3 -m http.server 8765`, open `http://<lan-ip>:8765` on the phone (currently 10.210.4.0).
- Deploy: GitHub Pages — push to a public repo, set Pages source to `main /public`. Not yet done.

## Reference: Shallow Bunny

The reference app is at `https://shallowbunny.com/lineup/<festival>` (e.g. `…/skalar-festival-2026`). Stack: React + React Router + i18n, Vite-built, `manifest.webmanifest`. Favourites in localStorage. Tabs: Now / Stages (+ per-stage) / Search. We copied the UX shape, not the build.

## Data quirks

- Mimo has 1 scheduled event in wakinglife.app's bundle (Glossy Mario, Fri 10:00–13:00). The user fills the rest via the **Add event** feature.
- Suna events sourced from slay use decimal-hour times — converted to HH:MM in the merge script.
- 54 untimed booklet entries (camps, art installations, untimed performances) live in the same events array with `start`/`end` = null.
- Tudo Bem? workshops keep a 60-min default duration on the timetable when `end` is null.
- A few descriptions are imperfect — re-run `scripts/merge_data.py` whenever upstream wakinglife.app refreshes.

## React rewrite is not blocked

Schema (`data/lineup.json`), localStorage key (`wakinglife.favs`), hash routes (`#now/#stages/#time/#search`), and manifest are all framework-agnostic. A React/Vite rewrite reuses them as-is; favourites carry over because the storage key stays the same.
