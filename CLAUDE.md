# Waking Life — Project Instructions

Festival lineup and timetable app for personal use on iPhone. Delivered as a Progressive Web App (PWA) — built in HTML/CSS/JS or React, served locally or via simple hosting, installed via Safari "Add to Home Screen". Works offline.

---

## Memory

At session start, read MEMORY.md in this directory.
If it does not exist, create it using the stub in `~/.claude/CLAUDE.md`.
Write any session memory worth keeping to MEMORY.md before the session ends.

---

## Stack

- **Format:** PWA (Progressive Web App)
- **Target:** iPhone Safari — "Add to Home Screen" install
- **Framework:** TBD — decide before first build session
- **Offline:** Required — festival = no reliable signal

---

## Project context

Waking Life is a festival. This app displays the lineup and timetable as a booklet-style interface for Robin's personal use. Source data (artists, stages, times) lives in `input/`.

---

## Rules

- Mobile-first layout — design for iPhone screen size from the start; desktop is secondary
- Offline-first — all data must be available without a network connection
- No backend — static data only; no server, no database
- Keep it simple — this is a personal tool, not a product; avoid over-engineering
