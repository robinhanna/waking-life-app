// Entry: router, data load, top-bar buttons, service worker registration.
import { seedFromCircled } from "./store.js";
import { renderTimetable } from "./views/timetable.js";
import { renderLineup }    from "./views/lineup.js";
import { renderFavourites } from "./views/favourites.js";
import { renderInfo }      from "./views/info.js";
import { openShareSheet }  from "./components/share-sheet.js";
import { openAddEventForm } from "./components/add-event-form.js";

const TABS = {
  timetable:  renderTimetable,
  lineup:     renderLineup,
  favourites: renderFavourites,
  info:       renderInfo,
};

const $view = document.getElementById("view");
const $tabs = document.getElementById("tabs");
let DATA = null;

async function loadData() {
  const res = await fetch("data/lineup.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`lineup.json HTTP ${res.status}`);
  return res.json();
}

function currentTab() {
  const slug = (location.hash || "#timetable").slice(1);
  return slug in TABS ? slug : "timetable";
}

function mount(tab) {
  if (!DATA) return;
  $view.innerHTML = "";
  $view.append(TABS[tab](DATA));
  for (const a of $tabs.querySelectorAll("a")) {
    if (a.dataset.tab === tab) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  window.scrollTo({ top: 0 });
}

window.addEventListener("hashchange", () => mount(currentTab()));

// Re-render current view when favourites or user events change, so dependent
// sections (timetable colour, favourites list) update.
let rerenderQueued = false;
const requestRerender = () => {
  if (rerenderQueued) return;
  rerenderQueued = true;
  queueMicrotask(() => { rerenderQueued = false; mount(currentTab()); });
};
document.addEventListener("favs:changed", requestRerender);
document.addEventListener("userevents:changed", requestRerender);

// Top-bar buttons
document.getElementById("btn-share").addEventListener("click", () => openShareSheet());
document.getElementById("btn-add").addEventListener("click", () => DATA && openAddEventForm(DATA));

(async () => {
  try {
    DATA = await loadData();
    seedFromCircled(DATA.events);
    mount(currentTab());
  } catch (err) {
    $view.innerHTML = `<p class="empty">Couldn't load line-up: ${err.message}</p>`;
    console.error(err);
  }
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW reg failed", e));
  });
}
