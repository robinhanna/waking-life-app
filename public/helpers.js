// Shared helpers used across views and components.

export const DAY_LABEL = {
  tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday",  sat: "Saturday",  sun: "Sunday", mon: "Monday",
};

export const DAY_SHORT_LABEL = {
  tue: "Tue", wed: "Wed", thu: "Thu",
  fri: "Fri", sat: "Sat", sun: "Sun", mon: "Mon",
};

// Continuous-timeline constants.
// Day-pill anchor clock hour — where the viewport scrolls when you tap a day.
export const DAY_ANCHOR_HOUR = 12;

export const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "style" && typeof v === "object") {
      for (const [prop, val] of Object.entries(v)) {
        if (val == null) continue;
        if (prop.startsWith("--")) node.style.setProperty(prop, String(val));
        else node.style[prop] = val;
      }
    }
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
};

export const toMin = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const fmtTime = (hhmm) => hhmm || "";

export function dayIndex(data, day) {
  const i = data.days.indexOf(day);
  return i === -1 ? 99 : i;
}

// ─── Continuous timeline geometry ──────────────────────────────────────────

// Minutes from festival epoch (start of data.days[0] at 00:00 local).
// e.g. for festival 16–22 Jun, epoch = Tue 16 Jun 00:00. An event on
// "wed" at 14:00 returns (1 * 1440 + 14*60) = 2280.
export function minutesFromEpoch(data, day, hhmm) {
  const di = dayIndex(data, day);
  const mins = toMin(hhmm);
  return di * 24 * 60 + (mins ?? 0);
}

// Returns { startMin, endMin } from festival epoch for a timed event.
// Cross-midnight events have endMin shifted by +24h. Null for untimed events.
export function eventRange(data, event) {
  if (!event.start) return null;
  const startMin = minutesFromEpoch(data, event.day, event.start);
  let endMin;
  if (event.end) {
    const endClock = toMin(event.end);
    const startClock = toMin(event.start);
    endMin = endClock <= startClock
      ? minutesFromEpoch(data, event.day, event.end) + 24 * 60
      : minutesFromEpoch(data, event.day, event.end);
  } else {
    endMin = startMin + 60;     // 60-min default for missing end
  }
  return { startMin, endMin };
}

export function totalFestivalMinutes(data) {
  return data.days.length * 24 * 60;
}

// Current real time as minutes-from-epoch. Negative before festival, > total
// after festival, used to position the now-line on the continuous timeline.
export function nowMinutesFromEpoch(data) {
  if (!data.dayDates || !data.days.length) return null;
  const firstDay = data.days[0];
  const epochIso = data.dayDates[firstDay];
  if (!epochIso) return null;
  const epoch = new Date(`${epochIso}T00:00:00`);
  const now = new Date();
  return Math.round((now.getTime() - epoch.getTime()) / 60000);
}

// Which day is "today" (or yesterday if it's late-night).
export function todayDaySlug(data) {
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  for (const [day, date] of Object.entries(data.dayDates ?? {})) {
    if (date === iso) return day;
  }
  const yesterday = new Date(today.getTime() - 24 * 3600 * 1000)
    .toISOString().slice(0, 10);
  if (today.getHours() < DAY_ANCHOR_HOUR) {
    for (const [day, date] of Object.entries(data.dayDates ?? {})) {
      if (date === yesterday) return day;
    }
  }
  return null;
}

export function stageMeta(data, slug) {
  return data.stages[slug] ?? { label: slug, color: "#444" };
}

export function groupBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

export function uniq(arr) { return Array.from(new Set(arr)); }

export function flagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "";
  const base = 0x1F1E6;
  const code = countryCode.toUpperCase();
  return String.fromCodePoint(base + code.charCodeAt(0) - 65, base + code.charCodeAt(1) - 65);
}

// ─── Levenshtein distance for "Did you mean" suggestions ────────────────────

export function levenshtein(a, b) {
  a = (a || "").toLowerCase();
  b = (b || "").toLowerCase();
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const cur  = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(
        cur[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}
