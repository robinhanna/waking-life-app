// Single event block on the timetable grid.
import { el, blockRange, stageMeta, fmtTime } from "../helpers.js";
import { isFavourite } from "../store.js";
import { openDetail } from "./detail-modal.js";

export function renderEventBlock(data, event, minuteW) {
  const range = blockRange(event);
  if (!range) return null;
  const fav = isFavourite(event.id);
  const stage = stageMeta(data, event.stage);

  const left = range.startCol * minuteW;
  const width = Math.max(36, (range.endCol - range.startCol) * minuteW - 2);

  const block = el("button", {
    class: `tt-block${fav ? " is-fav" : ""}${event.userAdded ? " is-user" : ""}`,
    style: {
      left:  `${left}px`,
      width: `${width}px`,
      "--block": stage.color,
    },
    "data-id": event.id,
    type: "button",
    "aria-label": `${event.artist}, ${stage.label}, ${event.start || "tba"}`,
  });

  block.append(
    el("span", { class: "time" }, [
      event.start ? `${fmtTime(event.start)}${event.end ? `–${fmtTime(event.end)}` : ""}` : "TBA",
    ]),
    el("span", { class: "name" }, [event.artist]),
    el("span", { class: "star", "aria-hidden": "true" }, ["★"]),
  );

  block.addEventListener("click", () => openDetail(data, event));
  return block;
}
