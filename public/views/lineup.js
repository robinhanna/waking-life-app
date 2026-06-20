// Lineup — three modes: A–Z, By stage (accordion), Untimed.
// Plus: live search with "Did you mean" Levenshtein suggestion and a genre chip filter.
import {
  el, stageMeta, dayIndex, groupBy, uniq, DAY_LABEL, levenshtein,
} from "../helpers.js";
import { renderEventRow } from "../components/event-row.js";
import { getUserEvents } from "../store.js";

let mode = "alpha";              // "alpha" | "stage" | "untimed"
let searchQuery = "";
const activeGenres = new Set();
const expandedStages = new Set(); // accordion state for "stage" mode

export function renderLineup(data) {
  const root = el("section", { class: "lineup-view" });
  root.append(el("h1", { class: "view-title" }, ["Lineup"]));

  // ─── Search input ────────────────────────────────────────────────────
  const searchWrap = el("div", { class: "search-wrap" });
  const searchInput = el("input", {
    type: "search",
    placeholder: "Search artists, stages, descriptions…",
    autocomplete: "off",
    autocorrect: "off",
    autocapitalize: "off",
    spellcheck: "false",
    value: searchQuery,
  });
  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value;
    rerender();
  });
  searchWrap.append(searchInput);

  const didYouMean = el("div", { class: "did-you-mean" });
  searchWrap.append(didYouMean);
  root.append(searchWrap);

  // ─── Mode toggle ─────────────────────────────────────────────────────
  const modeBtns = el("div", { class: "segmented", role: "tablist" });
  const mk = (m, label) => {
    const b = el("button", {
      type: "button",
      "aria-pressed": mode === m ? "true" : "false",
    }, [label]);
    b.addEventListener("click", () => { mode = m; rerender(); });
    return b;
  };
  modeBtns.append(mk("alpha", "A–Z"), mk("stage", "By stage"), mk("untimed", "Untimed"));
  root.append(el("div", { style: { margin: "0 0 12px" } }, [modeBtns]));

  // ─── Build the working event set ─────────────────────────────────────
  const all = [...data.events, ...getUserEvents()];

  // Genre chip filter — chips populated from the current mode's relevant set.
  let pool = all;
  if (mode === "untimed") pool = all.filter(e => !e.start);
  else pool = all.filter(e => e.start);   // timed-only for alpha + stage

  const genres = uniq(pool.flatMap(e => e.genres ?? [])).sort();
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
        rerender();
      });
      chips.append(chip);
    }
    root.append(chips);
  }

  // Apply search + genre filter
  const matches = pool.filter(e => matchesQuery(e, data, searchQuery))
                      .filter(e => matchesGenres(e, activeGenres));

  // "Did you mean" only when query non-empty and no matches
  if (searchQuery.trim() && !matches.length) {
    const suggestion = suggestArtist(searchQuery, all);
    if (suggestion) {
      const link = el("button", { type: "button", class: "dym-link" }, [suggestion]);
      link.addEventListener("click", () => {
        searchQuery = suggestion;
        searchInput.value = suggestion;
        rerender();
      });
      didYouMean.append("Did you mean ", link, "?");
    }
  }

  // ─── Render per mode ─────────────────────────────────────────────────
  if (!matches.length) {
    root.append(el("p", { class: "empty" }, [searchQuery ? "No matches." : "Nothing here yet."]));
    return root;
  }

  if (mode === "alpha") {
    matches.sort((a, b) =>
      a.artist.localeCompare(b.artist, undefined, { sensitivity: "base" }));
    for (const e of matches) root.append(renderEventRow(data, e));

  } else if (mode === "stage") {
    const grouped = groupBy(matches, e => e.stage);
    const stageOrder = Object.keys(data.stages).concat(
      uniq(matches.map(e => e.stage)).filter(s => !(s in data.stages)),
    );

    // If a search is active, auto-expand stages with matches
    const autoOpen = !!searchQuery.trim();

    for (const stageSlug of stageOrder) {
      const list = grouped.get(stageSlug);
      if (!list?.length) continue;
      list.sort(byDayTime(data));
      const meta = stageMeta(data, stageSlug);
      const open = autoOpen || expandedStages.has(stageSlug);

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
        if (expandedStages.has(stageSlug)) expandedStages.delete(stageSlug);
        else expandedStages.add(stageSlug);
        rerender();
      });
      root.append(header);

      if (open) {
        const body = el("div", { class: "accordion-body" });
        for (const e of list) body.append(renderEventRow(data, e));
        root.append(body);
      }
    }

  } else { // untimed
    const grouped = groupBy(matches, e => e.stage);
    const stageOrder = Object.keys(data.stages).concat(
      uniq(matches.map(e => e.stage)).filter(s => !(s in data.stages)),
    );
    for (const stageSlug of stageOrder) {
      const list = grouped.get(stageSlug);
      if (!list?.length) continue;
      list.sort((a, b) => a.artist.localeCompare(b.artist));
      const meta = stageMeta(data, stageSlug);
      root.append(el("h3", { class: "group" }, [meta.label]));
      if (meta.intro) {
        root.append(el("p", { class: "stage-intro" }, [meta.intro]));
      }
      for (const e of list) root.append(renderEventRow(data, e));
    }
  }

  function rerender() {
    const fresh = renderLineup(data);
    root.replaceWith(fresh);
  }

  return root;
}

// ─── helpers ────────────────────────────────────────────────────────────

function matchesQuery(event, data, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const stageLabel = (data.stages[event.stage]?.label ?? event.stage).toLowerCase();
  const hay = [
    event.artist,
    event.description ?? "",
    stageLabel,
    (event.genres ?? []).join(" "),
  ].join(" ").toLowerCase();
  return hay.includes(q);
}

function matchesGenres(event, set) {
  if (!set.size) return true;
  return (event.genres ?? []).some(g => set.has(g));
}

function suggestArtist(query, events) {
  const q = query.trim();
  if (q.length < 2) return null;
  const threshold = Math.max(3, Math.ceil(q.length * 0.3));
  let best = null;
  let bestDist = Infinity;
  for (const e of events) {
    const dist = levenshtein(q, e.artist);
    if (dist < bestDist) { bestDist = dist; best = e.artist; }
  }
  return bestDist <= threshold ? best : null;
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
