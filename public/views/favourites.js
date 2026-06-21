// Favourites — sort by time/stage/artists, calendar export.
import {
  el, stageMeta, dayIndex, groupBy, DAY_LABEL,
} from "../helpers.js";
import { favouriteIds, getUserEvents } from "../store.js";
import { renderEventRow } from "../components/event-row.js";
import { downloadIcs } from "../calendar.js";

let sortMode = "time";              // "time" | "stage" | "artists"
const expandedFavStages = new Set(); // accordion state for "stage" mode

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

  // Calendar export — always at the top.
  const timedFavs = favs.filter(e => e.start && e.end);
  if (timedFavs.length) {
    const calBtn = el("button", {
      type: "button",
      class: "cal-top-btn",
    }, ["Add to your calendar"]);
    calBtn.addEventListener("click", () => downloadIcs(data, timedFavs));
    root.append(calBtn);
  }

  // Sort segmented
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
    mkSort("artists", "Artists"),
  );
  root.append(el("div", { style: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", margin: "6px 0 12px",
  } }, [sortBtns]));

  // Render
  if (sortMode === "time") {
    favs.sort(byDayTime(data));
    const timed = favs.filter(e => e.start);
    const timeless = favs.filter(e => !e.start);
    const byDay = groupBy(timed, e => e.day);
    for (const day of data.days) {
      const list = byDay.get(day);
      if (!list) continue;
      root.append(el("h3", { class: "group" }, [DAY_LABEL[day] ?? day]));
      for (const e of list) root.append(renderEventRow(data, e, { showNote: true }));
    }
    if (timeless.length) {
      timeless.sort((a, b) => a.artist.localeCompare(b.artist));
      root.append(el("h3", { class: "group" }, ["Timeless"]));
      for (const e of timeless) root.append(renderEventRow(data, e, { showNote: true }));
    }
  } else if (sortMode === "stage") {
    // Accordion — same shape as Lineup.
    const grouped = groupBy(favs, e => e.stage);
    const stageOrder = Object.keys(data.stages).concat(
      Array.from(new Set(favs.map(e => e.stage))).filter(s => !(s in data.stages)),
    );
    for (const stageSlug of stageOrder) {
      const list = grouped.get(stageSlug);
      if (!list?.length) continue;
      list.sort(byDayTime(data));
      const meta = stageMeta(data, stageSlug);
      const open = expandedFavStages.has(stageSlug);

      const header = el("button", {
        class: `accordion-row${open ? " is-open" : ""}`,
        type: "button",
        "aria-expanded": open ? "true" : "false",
      });
      header.append(
        el("span", { class: "stage-dot", style: { background: meta.color } }),
        el("span", { class: "accordion-label" }, [meta.label]),
        el("span", { class: "accordion-count" }, [String(list.length)]),
        el("span", { class: "accordion-caret", "aria-hidden": "true" }, ["›"]),
      );
      header.addEventListener("click", () => {
        if (expandedFavStages.has(stageSlug)) expandedFavStages.delete(stageSlug);
        else expandedFavStages.add(stageSlug);
        const fresh = renderFavourites(data);
        root.replaceWith(fresh);
      });
      root.append(header);

      if (open) {
        const body = el("div", { class: "accordion-body" });
        for (const e of list) body.append(renderEventRow(data, e, { showNote: true }));
        root.append(body);
      }
    }
  } else { // artists
    favs.sort((a, b) =>
      a.artist.localeCompare(b.artist, undefined, { sensitivity: "base" })
      || (a.start ?? "").localeCompare(b.start ?? ""));
    for (const e of favs) root.append(renderEventRow(data, e, { showNote: true }));
  }

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
