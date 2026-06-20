// Info / about page. Minimal copy, version, debug reset.
import { el } from "../helpers.js";
import { clearFavourites } from "../store.js";

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

  // Update section
  const update = el("div", { style: { marginTop: 32, borderTop: "1px solid var(--border)", paddingTop: 18 } });
  update.append(el("h2", { class: "section" }, ["Update"]));
  update.append(el("p", { style: { color: "var(--fg-mute)", fontSize: 13, margin: "0 0 10px" } },
    ["Force a fresh fetch if the app looks out of date."]));
  const updateBtn = el("button", {
    type: "button",
    style: { padding: "10px 14px", borderRadius: 10, background: "var(--accent)", color: "var(--gold-ink)", fontWeight: 600, fontSize: 14 },
  }, ["Update app now"]);
  updateBtn.addEventListener("click", async () => {
    updateBtn.disabled = true;
    updateBtn.textContent = "Updating…";
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } finally {
      location.reload();
    }
  });
  update.append(updateBtn);
  root.append(update);

  // Reset section
  const reset = el("div", { style: { marginTop: 32, borderTop: "1px solid var(--border)", paddingTop: 18 } });
  reset.append(el("h2", { class: "section" }, ["Reset"]));

  const clearBtn = el("button", {
    type: "button",
    style: { padding: "10px 14px", borderRadius: 10, background: "transparent", color: "var(--heart)", fontSize: 14 },
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
