// Info / about page. Minimal copy, version, debug reset.
import { el } from "../helpers.js";
import { reseedFavourites, clearFavourites } from "../store.js";

const VERSION = "v2.0";

export function renderInfo(data) {
  const root = el("section", { class: "info-view" });
  root.append(el("h1", { class: "view-title" }, ["Info"]));

  root.append(el("p", { style: { fontSize: 15, marginTop: 4 } },
    ["Unofficial personal timetable for Waking Life 2026."]));
  root.append(el("p", { style: { color: "var(--fg-mute)", fontSize: 14 } },
    ["No phones on the dance floor."]));

  // Version + counts
  const counts = el("p", { style: { color: "var(--fg-dim)", fontSize: 13, marginTop: 18 } }, [
    `${VERSION} · ${data.events.length} events · ${Object.keys(data.stages).length} stages`,
  ]);
  root.append(counts);

  // Reset section
  const reset = el("div", { style: { marginTop: 32, borderTop: "1px solid var(--border)", paddingTop: 18 } });
  reset.append(el("h2", { class: "section" }, ["Reset"]));

  const reseedBtn = el("button", {
    type: "button",
    style: { padding: "10px 14px", borderRadius: 10, background: "var(--bg-elev)", color: "var(--fg)", fontSize: 14 },
  }, ["Re-seed favourites from booklet"]);
  reseedBtn.addEventListener("click", () => {
    if (confirm("Replace your current favourites with the original booklet circles? Notes will be wiped too.")) {
      reseedFavourites(data.events);
      document.dispatchEvent(new CustomEvent("favs:changed"));
    }
  });
  reset.append(reseedBtn);

  const clearBtn = el("button", {
    type: "button",
    style: { padding: "10px 14px", borderRadius: 10, background: "transparent", color: "var(--heart)", fontSize: 14, marginLeft: 8 },
  }, ["Clear all favourites"]);
  clearBtn.addEventListener("click", () => {
    if (confirm("Clear all favourites and notes?")) {
      clearFavourites();
      document.dispatchEvent(new CustomEvent("favs:changed"));
    }
  });
  reset.append(clearBtn);

  root.append(reset);

  return root;
}
