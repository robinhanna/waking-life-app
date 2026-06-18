import { seedFromCircled } from "./store.js";
import { renderNow, renderStages, renderTime, renderSearch } from "./views.js";

const TABS = {
  now:     { label: "Now",    render: renderNow },
  stages:  { label: "Stages", render: renderStages },
  time:    { label: "Time",   render: renderTime },
  search:  { label: "Search", render: renderSearch },
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
  const slug = (location.hash || "#now").slice(1);
  return TABS[slug] ? slug : "now";
}

function mount(tab) {
  if (!DATA) return;
  $view.innerHTML = "";
  $view.append(TABS[tab].render(DATA));
  for (const a of $tabs.querySelectorAll("a")) {
    a.toggleAttribute("aria-current", a.dataset.tab === tab);
    if (a.dataset.tab === tab) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  window.scrollTo({ top: 0 });
}

window.addEventListener("hashchange", () => mount(currentTab()));

// Rerender current view when favourites change so dependent sections update.
let favRerenderQueued = false;
document.addEventListener("favs:changed", () => {
  if (favRerenderQueued) return;
  favRerenderQueued = true;
  queueMicrotask(() => {
    favRerenderQueued = false;
    if (currentTab() === "now") mount("now");
  });
});

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

// Register service worker for offline.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW reg failed", e));
  });
}
