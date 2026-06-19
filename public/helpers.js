// Shared helpers used across views and components.

export const DAY_LABEL = {
  tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday",  sat: "Saturday",  sun: "Sunday", mon: "Monday",
};

export const DAY_SHORT_LABEL = {
  tue: "Tue", wed: "Wed", thu: "Thu",
  fri: "Fri", sat: "Sat", sun: "Sun", mon: "Mon",
};

// Earliest hour shown on the timetable for any day. Festival days run
// late, so a day really starts ~10:00 and goes through to ~10:00 next morning.
export const DAY_START_HOUR = 10;
export const DAY_END_HOUR = 34;   // 24 + 10 = 10:00 next morning

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

// Return effective start/end in minutes relative to the day's start (DAY_START_HOUR * 60).
// Events that begin before DAY_START_HOUR are treated as belonging to the previous day
// (the booking already places them under the right day per the source). Events that
// continue past midnight have their end shifted by +24h if it's smaller than start.
export function blockRange(event) {
  const startMin = toMin(event.start);
  let endMin = toMin(event.end);
  if (startMin == null) return null;
  if (endMin == null) endMin = startMin + 60;   // 60-min default for missing end
  if (endMin < startMin) endMin += 24 * 60;
  // Express in "minutes since DAY_START_HOUR of this day".
  const base = DAY_START_HOUR * 60;
  let s = startMin - base;
  let e = endMin   - base;
  // If start is before DAY_START_HOUR (e.g. 07:00 morning sets), wrap into the previous
  // day's tail by adding 24h. But the source already assigns those to the next day's tab,
  // so most cases just need a forward shift if the day "officially" begins later.
  if (s < 0) { s += 24 * 60; e += 24 * 60; }
  return { startCol: s, endCol: e };
}

export function nowMinutesSinceDayStart() {
  const now = new Date();
  const total = now.getHours() * 60 + now.getMinutes();
  let mins = total - DAY_START_HOUR * 60;
  if (mins < 0) mins += 24 * 60;
  return mins;
}

export function todayDaySlug(data) {
  // Map current date to one of data.days using dayDates if present.
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  for (const [day, date] of Object.entries(data.dayDates ?? {})) {
    if (date === iso) return day;
  }
  // If before 10am, today is yesterday's festival day (late-night).
  const yesterday = new Date(today.getTime() - 24 * 3600 * 1000)
    .toISOString().slice(0, 10);
  if (today.getHours() < DAY_START_HOUR) {
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
