// Favourites — filter by genre, sort by time/stage/genre, calendar export.
import {
  el, stageMeta, dayIndex, groupBy, uniq, DAY_LABEL,
} from "../helpers.js";
import { favouriteIds, getUserEvents } from "../store.js";
import { renderEventRow } from "../components/event-row.js";
import { downloadIcs, googleCalendarUrl } from "../calendar.js";

let sortMode = "time";          // "time" | "stage" | "genre"
let activeGenres = new Set();   // multi-select filter

export function renderFavourites(data) {
  const root = el("section", { class: "fav-view" });
  root.append(el("h1", { class: "view-title" }, ["Favourites"]));

  const all = [...data.events, ...getUserEvents()];
  const favSet = new Set(favouriteIds());
  let favs = all.filter(e => favSet.has(e.id));

  if (!favs.length) {
    root.append(el("p", { class: "empty" }, [
      "Tap the heart on any event to favourite it.",
    ]));
    return root;
  }

  // Filter chip row
  const genres = uniq(favs.flatMap(e => e.genres ?? [])).sort();
  if (genres.length) {
    const chips = el("div", { class: "chips" });
    for (const g of genres) {
      const chip = el("button", {
        class: "chip",
        type: "button",
        "aria-pressed": activeGenres.has(g) ? "true" : "false",
      }, [g]);
      chip.addEventListener("click", () => {
        if (activeGenres.has(g)) activeGenres.delete(g);
        else activeGenres.add(g);
        const fresh = renderFavourites(data);
        root.replaceWith(fresh);
      });
      chips.append(chip);
    }
    root.append(chips);
  }

  if (activeGenres.size) {
    favs = favs.filter(e =>
      (e.genres ?? []).some(g => activeGenres.has(g)));
  }

  // Sort segmented + export button
  const sortBtns = el("div", { class: "segmented" });
  const mkSort = (mode, label) => {
    const b = el("button", {
      type: "button",
      "aria-pressed": sortMode === mode ? "true" : "false",
    }, [label]);
    b.addEventListener("click", () => {
      sortMode = mode;
      const fresh = renderFavourites(data);
      root.replaceWith(fresh);
    });
    return b;
  };
  sortBtns.append(
    mkSort("time", "Time"),
    mkSort("stage", "Stage"),
    mkSort("genre", "Genre"),
  );
  root.append(el("div", { style: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", margin: "6px 0 12px",
  } }, [sortBtns]));

  // Render
  if (sortMode === "time") {
    favs.sort(byDayTime(data));
    const byDay = groupBy(favs, e => e.day);
    for (const day of data.days) {
      const list = byDay.get(day);
      if (!list) continue;
      root.append(el("h3", { class: "group" }, [DAY_LABEL[day] ?? day]));
      for (const e of list) root.append(renderEventRow(data, e, { showNote: true }));
    }
  } else if (sortMode === "stage") {
    const grouped = groupBy(favs, e => e.stage);
    const stages = Object.keys(data.stages).concat(
      Array.from(new Set(favs.map(e => e.stage))).filter(s => !(s in data.stages)),
    );
    for (const slug of stages) {
      const list = grouped.get(slug);
      if (!list?.length) continue;
      list.sort(byDayTime(data));
      const meta = stageMeta(data, slug);
      root.append(el("h3", { class: "group" }, [meta.label]));
      for (const e of list) root.append(renderEventRow(data, e, { showNote: true }));
    }
  } else { // genre
    const grouped = new Map();
    for (const e of favs) {
      for (const g of (e.genres?.length ? e.genres : ["—"])) {
        if (!grouped.has(g)) grouped.set(g, []);
        grouped.get(g).push(e);
      }
    }
    const orderedGenres = Array.from(grouped.keys()).sort();
    for (const g of orderedGenres) {
      grouped.get(g).sort(byDayTime(data));
      root.append(el("h3", { class: "group" }, [g]));
      for (const e of grouped.get(g)) root.append(renderEventRow(data, e, { showNote: true }));
    }
  }

  // Export bar
  const exportBar = el("div", { style: {
    display: "flex", gap: 8, margin: "20px 0 0", flexWrap: "wrap",
  } });
  const timedFavs = favs.filter(e => e.start && e.end);
  const icsBtn = el("button", {
    type: "button",
    style: { flex: 1, padding: "12px", borderRadius: 10, background: "var(--bg-elev)", fontSize: 14 },
  }, [`⬇ Download .ics (${timedFavs.length})`]);
  icsBtn.addEventListener("click", () => downloadIcs(data, timedFavs));
  const gcalBtn = el("button", {
    type: "button",
    style: { flex: 1, padding: "12px", borderRadius: 10, background: "var(--bg-elev)", fontSize: 14 },
  }, ["📅 Add each to Google Calendar"]);
  gcalBtn.addEventListener("click", () => {
    if (timedFavs.length > 6 && !confirm(`This will open ${timedFavs.length} tabs. Continue?`)) return;
    for (const e of timedFavs) window.open(googleCalendarUrl(data, e), "_blank", "noopener");
  });
  exportBar.append(icsBtn, gcalBtn);
  root.append(exportBar);

  return root;
}

function byDayTime(data) {
  return (a, b) => {
    const di = dayIndex(data, a.day) - dayIndex(data, b.day);
    if (di !== 0) return di;
    if (a.start && b.start) return a.start.localeCompare(b.start);
    if (a.start) return -1;
    if (b.start) return 1;
    return a.artist.localeCompare(b.artist);
  };
}
