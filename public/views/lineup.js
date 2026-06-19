// Lineup — flat artist list. Sort by name (default) or by stage.
import { el, stageMeta, dayIndex, groupBy } from "../helpers.js";
import { renderEventRow } from "../components/event-row.js";
import { getUserEvents } from "../store.js";

let sortMode = "alpha";  // "alpha" | "stage"

export function renderLineup(data) {
  const root = el("section", { class: "lineup-view" });
  root.append(el("h1", { class: "view-title" }, ["Lineup"]));

  // Sort segmented control
  const sortBtns = el("div", { class: "segmented", role: "tablist" });
  const mk = (mode, label) => {
    const b = el("button", {
      type: "button",
      "aria-pressed": sortMode === mode ? "true" : "false",
    }, [label]);
    b.addEventListener("click", () => {
      sortMode = mode;
      const fresh = renderLineup(data);
      root.replaceWith(fresh);
    });
    return b;
  };
  sortBtns.append(mk("alpha", "A–Z"), mk("stage", "By stage"));
  root.append(el("div", { style: { margin: "0 0 14px" } }, [sortBtns]));

  const events = [...data.events, ...getUserEvents()];

  if (sortMode === "alpha") {
    events.sort((a, b) => a.artist.localeCompare(b.artist, undefined, { sensitivity: "base" }));
    for (const e of events) root.append(renderEventRow(data, e));
  } else {
    const stages = Object.keys(data.stages);
    const extras = Array.from(new Set(events.map(e => e.stage))).filter(s => !stages.includes(s));
    const order = [...stages, ...extras];
    const grouped = groupBy(events, e => e.stage);
    for (const stageSlug of order) {
      const list = grouped.get(stageSlug);
      if (!list?.length) continue;
      list.sort((a, b) => {
        const di = dayIndex(data, a.day) - dayIndex(data, b.day);
        if (di !== 0) return di;
        if (a.start && b.start) return a.start.localeCompare(b.start);
        if (a.start) return -1;
        if (b.start) return 1;
        return a.artist.localeCompare(b.artist);
      });
      const meta = stageMeta(data, stageSlug);
      const header = el("h3", { class: "group" }, [
        el("span", { class: "stage-dot", style: {
          background: meta.color, display: "inline-block",
          width: 10, height: 10, borderRadius: 2, marginRight: 8,
          verticalAlign: "middle",
        }}),
        meta.label,
      ]);
      root.append(header);
      for (const e of list) root.append(renderEventRow(data, e));
    }
  }

  return root;
}
