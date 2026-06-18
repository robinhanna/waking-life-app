# Waking Life 2026 — personal line-up PWA

A static, installable Progressive Web App for browsing the Waking Life festival line-up offline on a phone. Built as plain HTML/CSS/JS — no build step, no framework.

Source data lives in `public/data/lineup.json`, derived from the paper booklet (screenshots in `input/`).

---

## Run locally

```bash
cd public
python3 -m http.server 8000
# open http://localhost:8000 on the laptop
# or http://<laptop-LAN-ip>:8000 on the phone (same Wi-Fi)
```

On the phone: open in Safari → Share → **Add to Home Screen**. The PWA caches everything offline after first load.

## Deploy to GitHub Pages

1. Create a new repo, e.g. `waking-life-app`.
2. Add this folder; commit; push.
3. Repo Settings → Pages → Source: **Deploy from a branch** → Branch: `main` → Folder: `/public`. Save.
4. Wait a minute for the URL — it'll be `https://<your-user>.github.io/waking-life-app/`.
5. Open that URL on any phone, Add to Home Screen, done. Friends use the same URL; their favourites stay private (localStorage).

## Updating the line-up

Edit `public/data/lineup.json`. Schema:

```jsonc
{
  "festival": "Waking Life 2026",
  "days": ["tue", "wed", "thu", "fri", "sat", "sun", "mon"],
  "stages": {
    "cochilo": { "label": "Cochilo" }
  },
  "events": [
    {
      "id": "thu-1900-cochilo-holy-tongue",   // stable kebab-case slug
      "artist": "Holy Tongue",
      "stage": "cochilo",                      // matches a key in stages
      "day": "thu",                            // tue|wed|thu|fri|sat|sun|mon
      "start": "19:00",                        // HH:MM, 24h, null for untimed
      "end": "20:00",                          // ditto, null for untimed
      "description": "Psychedelic dub-dance.", // optional
      "circled": true,                         // optional — seeds as favourite on first load
      "when": "Tuesday only"                   // optional, for untimed events
    }
  ]
}
```

Bump `VERSION` in `public/sw.js` whenever you change the schema or the shell files so the service worker drops the old cache.

## Favourites & notes

Stored in `localStorage["wakinglife.favs"]` as `{ [eventId]: { note: string } }`. Per device, no sync. Tap heart to favourite; pencil to add a note (who recommended it, why).

## File map

```
public/
├── index.html              shell, tab bar, meta tags
├── app.css                 dark theme, mobile-first
├── app.js                  entry: data load, hash router, SW register
├── views.js                renderNow / renderStages / renderTime / renderSearch
├── store.js                favourites + notes (localStorage)
├── manifest.webmanifest    PWA manifest
├── sw.js                   service worker (cache-first shell, SWR for data)
├── icons/                  PNGs for install
└── data/lineup.json        the actual line-up
```
