// Reusable event row for list views (Lineup, Favourites, Search results).
import { el, DAY_SHORT_LABEL, stageMeta, fmtTime } from "../helpers.js";
import { isFavourite, toggleFavourite, getNote } from "../store.js";
import { openDetail } from "./detail-modal.js";

export function renderEventRow(data, event, { showNote = false } = {}) {
  const fav = isFavourite(event.id);
  const stage = stageMeta(data, event.stage);

  const row = el("article", {
    class: `event-row${fav ? " is-fav" : ""}${event.userAdded ? " is-user" : ""}`,
    "data-id": event.id,
    role: "button",
    tabindex: "0",
  });

  const heart = el("button", {
    class: "heart-mini",
    type: "button",
    "aria-label": fav ? "Remove favourite" : "Add favourite",
  }, [fav ? "♥" : "♡"]);
  heart.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFavourite(event.id);
    document.dispatchEvent(new CustomEvent("favs:changed", { detail: { id: event.id } }));
  });

  const body = el("div", { class: "row-body" });

  const meta = el("div", { class: "meta" }, [
    el("span", { class: "stage-dot", style: { background: stage.color } }),
    el("span", {}, [stage.label]),
    el("span", {}, ["·"]),
    el("span", {}, [DAY_SHORT_LABEL[event.day] ?? event.day]),
    event.start ? el("span", {}, [`· ${fmtTime(event.start)}${event.end ? `–${fmtTime(event.end)}` : ""}`]) : null,
    event.userAdded ? el("span", { class: "chip subtle" }, ["yours"]) : null,
  ].filter(Boolean));

  const artist = el("div", { class: "artist" }, [event.artist]);
  body.append(meta, artist);

  if (event.description) {
    body.append(el("div", { class: "desc" }, [event.description]));
  }

  if (showNote) {
    const note = getNote(event.id);
    if (note) body.append(el("div", { class: "note" }, [note]));
  }

  row.append(heart, body);

  const open = (e) => {
    if (e?.target && e.target.closest(".heart-mini")) return;
    openDetail(data, event);
  };
  row.addEventListener("click", open);
  row.addEventListener("keydown", (e) => {
    if (e.target.closest(".heart-mini")) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
  });

  return row;
}
