// Favourites + notes store. Persists to localStorage.
//
// Shape on disk: { [eventId]: { note: string } }
// Empty note is fine — presence of the key means "favourited".

const KEY = "wakinglife.favs";

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Migrate legacy array shape, if ever present.
    if (Array.isArray(parsed)) {
      const map = {};
      for (const id of parsed) map[id] = { note: "" };
      write(map);
      return map;
    }
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(map) {
  localStorage.setItem(KEY, JSON.stringify(map));
}

let cache = null;

function load() {
  if (cache === null) cache = read() ?? {};
  return cache;
}

export function seedFromCircled(events) {
  // Only seeds if storage has never been written.
  if (localStorage.getItem(KEY) !== null) return;
  const seed = {};
  for (const e of events) if (e.circled) seed[e.id] = { note: "" };
  cache = seed;
  write(cache);
}

export function isFavourite(id) {
  return Object.prototype.hasOwnProperty.call(load(), id);
}

export function toggleFavourite(id) {
  const map = load();
  if (id in map) delete map[id];
  else map[id] = { note: "" };
  write(map);
  return id in map;
}

export function getNote(id) {
  const map = load();
  return map[id]?.note ?? "";
}

export function setNote(id, text) {
  const map = load();
  if (!(id in map)) return; // notes only exist on favourites
  map[id] = { note: text.trim() };
  write(map);
}

export function favouriteIds() {
  return Object.keys(load());
}
