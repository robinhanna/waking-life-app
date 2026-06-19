// localStorage stores for favourites (with notes) and user-added events.
//
// Favourites shape: { [eventId]: { note: string } }
// User events: array of full event objects, each marked `userAdded: true`.

const FAV_KEY  = "wakinglife.favs";
const USER_KEY = "wakinglife.userEvents";

// ───── favourites ─────────────────────────────────────────────────────────

function readFavs() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const map = {};
      for (const id of parsed) map[id] = { note: "" };
      writeFavs(map);
      return map;
    }
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
function writeFavs(map) { localStorage.setItem(FAV_KEY, JSON.stringify(map)); }

let favCache = null;
function favs() {
  if (favCache === null) favCache = readFavs() ?? {};
  return favCache;
}

export function seedFromCircled(events) {
  if (localStorage.getItem(FAV_KEY) !== null) return;
  const seed = {};
  for (const e of events) if (e.circled) seed[e.id] = { note: "" };
  favCache = seed;
  writeFavs(favCache);
}

export function clearFavourites() {
  favCache = {};
  writeFavs(favCache);
}

export function reseedFavourites(events) {
  // wipe storage, then seed
  localStorage.removeItem(FAV_KEY);
  favCache = null;
  seedFromCircled(events);
}

export function isFavourite(id)   { return Object.prototype.hasOwnProperty.call(favs(), id); }
export function toggleFavourite(id) {
  const m = favs();
  if (id in m) delete m[id];
  else m[id] = { note: "" };
  writeFavs(m);
  return id in m;
}
export function setFavourite(id, on) {
  const m = favs();
  if (on && !(id in m)) m[id] = { note: "" };
  if (!on && (id in m)) delete m[id];
  writeFavs(m);
}
export function getNote(id)         { return favs()[id]?.note ?? ""; }
export function setNote(id, text)   {
  const m = favs();
  if (!(id in m)) m[id] = { note: "" };
  m[id] = { note: (text || "").trim() };
  writeFavs(m);
}
export function favouriteIds()      { return Object.keys(favs()); }

// ───── user events ────────────────────────────────────────────────────────

function readUserEvents() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function writeUserEvents(list) { localStorage.setItem(USER_KEY, JSON.stringify(list)); }

let userCache = null;
function userList() {
  if (userCache === null) userCache = readUserEvents();
  return userCache;
}

export function getUserEvents() { return userList().slice(); }

export function addUserEvent(event) {
  const list = userList();
  // ensure id, mark userAdded
  const stamped = {
    ...event,
    id: event.id || `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    userAdded: true,
    addedAt: new Date().toISOString(),
  };
  list.push(stamped);
  writeUserEvents(list);
  return stamped;
}

export function deleteUserEvent(id) {
  const list = userList().filter(e => e.id !== id);
  userCache = list;
  writeUserEvents(list);
  // also drop favourite + note
  setFavourite(id, false);
}
