import {
  isFavourite, toggleFavourite, getNote, setNote, favouriteIds,
} from "./store.js";

// ───── helpers ─────────────────────────────────────────────────────────────

const DAY_LABEL = {
  tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday",  sat: "Saturday",  sun: "Sunday", mon: "Monday",
};

const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v !== null && v !== undefined && v !== false) {
      node.setAttribute(k, v === true ? "" : v);
    }
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
};

function stageLabel(data, slug) {
  return data.stages[slug]?.label ?? slug;
}

function dayIndex(data, day) {
  const i = data.days.indexOf(day);
  return i === -1 ? 99 : i;
}

function sortByDayTime(data, events) {
  return [...events].sort((a, b) => {
    const di = dayIndex(data, a.day) - dayIndex(data, b.day);
    if (di !== 0) return di;
    if (a.start && b.start) return a.start.localeCompare(b.start);
    if (a.start) return -1;
    if (b.start) return 1;
    return a.artist.localeCompare(b.artist);
  });
}

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

// ───── event row ────────────────────────────────────────────────────────────

export function renderEventRow(data, event) {
  const fav = isFavourite(event.id);

  const row = el("article", {
    class: `event${fav ? " is-fav" : ""}`,
    "data-id": event.id,
  });

  const actions = el("div", { class: "event-actions" });
  const heart = el("button", {
    class: `heart${fav ? " is-on" : ""}`,
    "aria-label": fav ? "Remove favourite" : "Add favourite",
    title: fav ? "Favourited" : "Favourite",
  }, [fav ? "♥" : "♡"]);
  const pencil = el("button", {
    class: "pencil",
    "aria-label": "Edit note",
    title: "Add note",
  }, ["✎"]);
  actions.append(heart, pencil);

  const body = el("div", { class: "event-body" });

  const meta = el("div", { class: "event-meta" });
  meta.append(
    el("span", { class: "event-time" }, [formatTime(event)]),
    el("span", { class: "event-stage" }, [
      `${stageLabel(data, event.stage)} · ${DAY_LABEL[event.day] ?? event.day}`,
    ]),
  );

  const artist = el("div", { class: "event-artist" }, [event.artist]);

  const children = [meta, artist];
  if (event.description) {
    children.push(el("div", { class: "event-desc" }, [event.description]));
  }
  if (fav) {
    const note = getNote(event.id);
    if (note) children.push(el("div", { class: "event-note" }, [note]));
  }

  body.append(...children);
  body.addEventListener("click", (e) => {
    if (e.target.closest(".heart") || e.target.closest(".pencil")) return;
    row.classList.toggle("is-open");
  });

  heart.addEventListener("click", () => {
    const nowFav = toggleFavourite(event.id);
    rerenderRow(row, data, event);
    // Notify the current view so favourite-dependent sections (Now) update.
    document.dispatchEvent(new CustomEvent("favs:changed", { detail: { id: event.id, fav: nowFav } }));
  });

  pencil.addEventListener("click", () => openNoteInput(row, body, data, event));

  row.append(actions, body);
  return row;
}

function rerenderRow(oldRow, data, event) {
  const fresh = renderEventRow(data, event);
  oldRow.replaceWith(fresh);
}

function openNoteInput(row, body, data, event) {
  // Replace any existing note display with an input.
  body.querySelector(".event-note")?.remove();
  body.querySelector(".event-note-input")?.remove();

  const input = el("input", {
    type: "text",
    placeholder: "Add note (who recommended, why, …)",
    maxlength: "200",
    value: getNote(event.id) || "",
  });

  const wrap = el("div", { class: "event-note-input" }, [input]);
  body.append(wrap);
  input.focus();

  const commit = () => {
    setNote(event.id, input.value);
    rerenderRow(row, data, event);
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") rerenderRow(row, data, event);
  });
  input.addEventListener("blur", commit);
}

function formatTime(event) {
  if (event.start && event.end) return `${event.start} – ${event.end}`;
  if (event.start) return event.start;
  if (event.when) return event.when;
  return "Ongoing";
}

// ───── NOW ──────────────────────────────────────────────────────────────────

export function renderNow(data) {
  const root = el("section");
  root.append(el("h1", { class: "view-title" }, ["Now"]));

  const now = new Date();
  const today = currentDay(data, now);
  const minutes = now.getHours() * 60 + now.getMinutes();

  const timed = data.events.filter(e => e.start && e.day === today);
  const live = timed.filter(e => inWindow(minutes, e.start, e.end));
  const upNext = timed
    .filter(e => !inWindow(minutes, e.start, e.end) && toMin(e.start) > minutes && toMin(e.start) <= minutes + 180)
    .sort((a, b) => a.start.localeCompare(b.start));

  if (live.length) {
    root.append(el("h2", { class: "section" }, [
      el("span", { class: "live-dot" }), "Live now",
    ]));
    for (const e of live) root.append(renderEventRow(data, e));
  }

  if (upNext.length) {
    root.append(el("h2", { class: "section" }, ["Up next"]));
    for (const e of upNext) root.append(renderEventRow(data, e));
  }

  // Favourites grouped by day
  const favIds = new Set(favouriteIds());
  const favs = data.events.filter(e => favIds.has(e.id));
  root.append(el("h2", { class: "section" }, ["Your favourites"]));
  if (!favs.length) {
    root.append(el("p", { class: "empty" }, ["Tap the heart on any event to favourite it."]));
  } else {
    const byDay = groupBy(sortByDayTime(data, favs), e => e.day);
    for (const day of data.days) {
      if (!byDay.has(day)) continue;
      root.append(el("h3", { class: "day" }, [DAY_LABEL[day] ?? day]));
      for (const e of byDay.get(day)) root.append(renderEventRow(data, e));
    }
  }

  return root;
}

function currentDay(data, date) {
  // Maps real weekday to one of data.days; falls back to first day in data.
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const slug = map[date.getDay()];
  return data.days.includes(slug) ? slug : data.days[0];
}

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const DEFAULT_DURATION_MIN = 60;

function inWindow(minNow, start, end) {
  const s = toMin(start);
  let e = end ? toMin(end) : s + DEFAULT_DURATION_MIN;
  if (e < s) e += 24 * 60; // crosses midnight
  const adjustedNow = minNow < s ? minNow + 24 * 60 : minNow;
  return adjustedNow >= s && adjustedNow < e;
}

// ───── STAGES ───────────────────────────────────────────────────────────────

let stageFilter = null;

export function renderStages(data) {
  const root = el("section");
  root.append(el("h1", { class: "view-title" }, ["Stages"]));

  const chips = el("div", { class: "chips" });
  const eventCounts = new Map();
  for (const e of data.events) eventCounts.set(e.stage, (eventCounts.get(e.stage) ?? 0) + 1);
  const slugs = Object.keys(data.stages).filter(s => (eventCounts.get(s) ?? 0) > 0);
  if (stageFilter && !slugs.includes(stageFilter)) stageFilter = null;
  const activeSlug = stageFilter ?? slugs[0];

  for (const slug of slugs) {
    const chip = el("button", {
      class: "chip",
      "aria-pressed": slug === activeSlug ? "true" : "false",
    }, [data.stages[slug].label]);
    chip.addEventListener("click", () => {
      stageFilter = slug;
      mountStages(data, root);
    });
    chips.append(chip);
  }
  root.append(chips);

  const events = sortByDayTime(
    data,
    data.events.filter(e => e.stage === activeSlug),
  );

  if (!events.length) {
    root.append(el("p", { class: "empty" }, ["No events on this stage."]));
    return root;
  }

  const byDay = groupBy(events, e => e.day);
  for (const day of data.days) {
    if (!byDay.has(day)) continue;
    root.append(el("h3", { class: "day" }, [DAY_LABEL[day] ?? day]));
    for (const e of byDay.get(day)) root.append(renderEventRow(data, e));
  }
  return root;
}

function mountStages(data, oldRoot) {
  const fresh = renderStages(data);
  oldRoot.replaceWith(fresh);
}

// ───── TIME ─────────────────────────────────────────────────────────────────

export function renderTime(data) {
  const root = el("section");
  root.append(el("h1", { class: "view-title" }, ["By time"]));

  const events = sortByDayTime(
    data,
    data.events.filter(e => e.start),
  );

  if (!events.length) {
    root.append(el("p", { class: "empty" }, ["No timed events."]));
    return root;
  }

  const byDay = groupBy(events, e => e.day);
  for (const day of data.days) {
    if (!byDay.has(day)) continue;
    root.append(el("h3", { class: "day" }, [DAY_LABEL[day] ?? day]));
    for (const e of byDay.get(day)) root.append(renderEventRow(data, e));
  }
  return root;
}

// ───── SEARCH ───────────────────────────────────────────────────────────────

export function renderSearch(data) {
  const root = el("section");
  root.append(el("h1", { class: "view-title" }, ["Search"]));

  const wrap = el("div", { class: "search-wrap" });
  const input = el("input", {
    type: "search",
    placeholder: "Search artists, stages, descriptions…",
    autocomplete: "off",
    autocorrect: "off",
    autocapitalize: "off",
    spellcheck: "false",
  });
  wrap.append(input);
  root.append(wrap);

  const results = el("div", { class: "results" });
  root.append(results);

  const update = () => {
    const q = input.value.trim().toLowerCase();
    results.innerHTML = "";
    if (!q) {
      results.append(el("p", { class: "empty" }, ["Type to search."]));
      return;
    }
    const matches = data.events.filter(e => {
      const hay = [
        e.artist,
        stageLabel(data, e.stage),
        e.description ?? "",
        DAY_LABEL[e.day] ?? "",
        getNote(e.id),
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
    if (!matches.length) {
      results.append(el("p", { class: "empty" }, ["No matches."]));
      return;
    }
    for (const e of sortByDayTime(data, matches)) {
      results.append(renderEventRow(data, e));
    }
  };

  input.addEventListener("input", update);
  update();
  setTimeout(() => input.focus(), 0);
  return root;
}
