// Calendar export: Google Calendar URL + ICS download.

function pad(n) { return String(n).padStart(2, "0"); }

// Build a local-time datetime string yyyymmddThhmmss (no UTC suffix).
// We treat times as TZID=Europe/Lisbon (set on the VEVENT) for ICS,
// and naive-local for Google Calendar with ctz parameter.
function localDt(dateIso, hhmm, addDays = 0) {
  const [y, m, d] = dateIso.split("-").map(Number);
  const [hh, mm] = (hhmm || "00:00").split(":").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + addDays, hh, mm));
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    "00"
  );
}

function startEndDt(data, event) {
  const date = data.dayDates?.[event.day];
  if (!date || !event.start) return null;
  const sMin = toMin(event.start);
  const eMin = toMin(event.end || event.start);
  // If end <= start, crosses midnight: end is next day.
  const endDayShift = (eMin <= sMin) ? 1 : 0;
  return {
    start: localDt(date, event.start),
    end:   localDt(date, event.end || event.start, endDayShift),
  };
}

function toMin(hhmm) { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }

function stageLabel(data, slug) { return data.stages[slug]?.label ?? slug; }

// ICS escaping per RFC 5545: backslash, semicolon, comma, newline.
function ics(s = "") {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function vevent(data, event) {
  const dt = startEndDt(data, event);
  if (!dt) return null;
  const tzid = data.timezone || "Europe/Lisbon";
  const uid = `${event.id}@wakinglife.local`;
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${localDt("2026-06-01", "00:00")}Z`,
    `DTSTART;TZID=${tzid}:${dt.start}`,
    `DTEND;TZID=${tzid}:${dt.end}`,
    `SUMMARY:${ics(event.artist)}`,
    `LOCATION:${ics(stageLabel(data, event.stage) + ", Waking Life")}`,
    event.description ? `DESCRIPTION:${ics(event.description)}` : null,
    "END:VEVENT",
  ].filter(Boolean);
  return lines.join("\r\n");
}

// Minimal Europe/Lisbon VTIMEZONE — WEST (UTC+1) covers June.
const VTIMEZONE_LISBON = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Lisbon",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0000",
  "TZOFFSETTO:+0100",
  "DTSTART:19960331T010000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "TZNAME:WEST",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0000",
  "DTSTART:19961027T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "TZNAME:WET",
  "END:STANDARD",
  "END:VTIMEZONE",
].join("\r\n");

export function buildIcs(data, events) {
  const veVents = events.map(e => vevent(data, e)).filter(Boolean);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Waking Life Personal App//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    VTIMEZONE_LISBON,
    ...veVents,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(data, events, filename = "waking-life-favourites.ics") {
  const text = buildIcs(data, events);
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 100);
}
