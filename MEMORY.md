# Waking Life — Project Memory

## Global Memory

Read ~/.claude/CLAUDE.md for memory rules and topic files.

## Status

- v1 shipped locally as commit `22b872b`. Vanilla HTML/CSS/JS PWA in `public/`. 299 events, 42 pre-seeded favourites (booklet circles), 11 active stages.
- Run locally: `cd public && python3 -m http.server 8765`, open `http://<lan-ip>:8765` on the phone.
- Deploy: GitHub Pages — push to a public repo, set Pages source to `main /public`. Not yet done.

## Reference: Shallow Bunny

The reference app is at `https://shallowbunny.com/lineup/<festival>` (e.g. `…/skalar-festival-2026`). Stack: React + React Router + i18n, Vite-built, `manifest.webmanifest`. Favourites in localStorage. Tabs: Now / Stages (+ per-stage) / Search. We copied the UX shape, not the build.

## Data quirks

- `tudo-bem` workshops have `start` but no `end` in the booklet — UI assumes 60 min for "live now" detection; rest of the views just show the start time.
- `mimo` and `casa-marmelada` have intro pages but no scheduled events; their chips are hidden from the Stages tab.
- One Shackleton praia entry has a "?" mark in the booklet (transcriber flagged it as uncertain).

## React rewrite is not blocked

Schema (`data/lineup.json`), localStorage key (`wakinglife.favs`), hash routes (`#now/#stages/#time/#search`), and manifest are all framework-agnostic. A React/Vite rewrite reuses them as-is; favourites carry over because the storage key stays the same.
