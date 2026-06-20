// Info / about page. Origin story, install instructions, contact, controls.
import { el } from "../helpers.js";
import { clearFavourites } from "../store.js";

const VERSION = "v2.4";

export function renderInfo(data) {
  const root = el("section", { class: "info-view" });
  root.append(el("h1", { class: "view-title" }, ["Info"]));

  // ─── Why this exists ─────────────────────────────────────────────────
  const why = el("section", { class: "info-section" });
  why.append(el("h2", { class: "section" }, ["Why this exists"]));
  why.append(el("p", { class: "info-body" }, [
    "I wanted an app for Waking Life. Started building one. Then found out two people already had — the unofficial wakinglife.app and the slay timetable — and they're both good. So this one is the sum of what theirs taught me, plus the bits I missed: notes you can scribble next to any act, favourites that actually change colour on the timeline, an option to add the impromptu sets you only stumble across on site, and a calendar export so your Apple Watch nudges you on the way to the next one.",
  ]));
  root.append(why);

  // ─── Thanks ──────────────────────────────────────────────────────────
  const thanks = el("section", { class: "info-section" });
  thanks.append(el("h2", { class: "section" }, ["Thanks"]));
  thanks.append(el("p", { class: "info-body" }, [
    "Big nod to the people behind the unofficial wakinglife.app and the slay timetable. Most of the data here started in their hands. Their work is the reason this didn't need a month of transcription.",
  ]));
  root.append(thanks);

  // ─── Install ─────────────────────────────────────────────────────────
  const install = el("section", { class: "info-section" });
  install.append(el("h2", { class: "section" }, ["Install on your iPhone"]));
  install.append(el("p", { class: "info-body" }, [
    "You'll want it on the home screen so it works offline at the lake.",
  ]));

  install.append(el("h3", { class: "info-subhead" }, ["Safari"]));
  install.append(el("ol", { class: "info-steps" }, [
    el("li", {}, ["Open this page in Safari."]),
    el("li", {}, ["Tap the Share button at the bottom (square with the arrow)."]),
    el("li", {}, ["Tap “Add to Home Screen”, then Add."]),
  ]));

  install.append(el("h3", { class: "info-subhead" }, ["Chrome"]));
  install.append(el("ol", { class: "info-steps" }, [
    el("li", {}, ["Open this page in Chrome."]),
    el("li", {}, ["Tap the share icon next to the URL."]),
    el("li", {}, ["Tap “Add to Home Screen”, then Add."]),
  ]));
  root.append(install);

  // ─── Offline ─────────────────────────────────────────────────────────
  const offline = el("section", { class: "info-section" });
  offline.append(el("h2", { class: "section" }, ["Offline"]));
  offline.append(el("p", { class: "info-body" }, [
    "Once you've installed it, the whole timetable lives on your phone. Cell signal at the festival is what you'd expect. The app doesn't care.",
  ]));
  root.append(offline);

  // ─── Contact ─────────────────────────────────────────────────────────
  const contact = el("section", { class: "info-section" });
  contact.append(el("h2", { class: "section" }, ["Get in touch"]));
  const p = el("p", { class: "info-body" });
  p.append(
    "Bugs, ideas, an act I'm missing — drop me a line at ",
    el("a", { href: "mailto:robin@robinhanna.de", class: "info-link" }, ["robin@robinhanna.de"]),
    ".",
  );
  contact.append(p);
  root.append(contact);

  // ─── Update ──────────────────────────────────────────────────────────
  const update = el("section", { class: "info-section info-section-divider" });
  update.append(el("h2", { class: "section" }, ["Update"]));
  update.append(el("p", { class: "info-body" }, [
    "Tap “Update app now” if anything looks out of date. If you opened this in a regular browser tab rather than the installed app, a normal page refresh works too.",
  ]));
  const updateBtn = el("button", {
    type: "button",
    class: "info-btn-primary",
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

  // ─── Reset ───────────────────────────────────────────────────────────
  const reset = el("section", { class: "info-section info-section-divider" });
  reset.append(el("h2", { class: "section" }, ["Reset"]));
  const clearBtn = el("button", {
    type: "button",
    class: "info-btn-danger",
  }, ["Clear all favourites"]);
  clearBtn.addEventListener("click", () => {
    if (confirm("Clear all favourites and notes?")) {
      clearFavourites();
      document.dispatchEvent(new CustomEvent("favs:changed"));
    }
  });
  reset.append(clearBtn);
  root.append(reset);

  // ─── Version footer ──────────────────────────────────────────────────
  root.append(el("p", { class: "info-version" }, [
    `${VERSION} · ${data.events.length} events · ${Object.keys(data.stages).length} stages`,
  ]));

  return root;
}
