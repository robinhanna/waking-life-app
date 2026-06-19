// Full-screen event detail sheet, modelled on the Fusion app pattern.
import { el, stageMeta, DAY_LABEL, fmtTime, flagEmoji } from "../helpers.js";
import {
  isFavourite, toggleFavourite, setFavourite,
  getNote, setNote, deleteUserEvent,
} from "../store.js";
import { googleCalendarUrl, downloadIcs } from "../calendar.js";

const root = () => document.getElementById("modal-root");

export function openDetail(data, event) {
  closeModal();   // close any existing
  const stage = stageMeta(data, event.stage);

  const backdrop = el("div", { class: "modal-backdrop" });
  backdrop.addEventListener("click", closeModal);

  const modal = el("section", { class: "modal", role: "dialog", "aria-modal": "true" });

  const heart = el("button", {
    class: `heart${isFavourite(event.id) ? " is-on" : ""}`,
    "aria-label": "Toggle favourite",
    type: "button",
  }, [isFavourite(event.id) ? "♥" : "♡"]);
  heart.addEventListener("click", () => {
    const on = toggleFavourite(event.id);
    heart.classList.toggle("is-on", on);
    heart.textContent = on ? "♥" : "♡";
    document.dispatchEvent(new CustomEvent("favs:changed", { detail: { id: event.id } }));
  });

  const titleWrap = el("div", { class: "title-wrap" });
  titleWrap.append(
    el("h1", {}, [event.artist]),
    el("div", { class: "meta" }, [
      el("span", { class: "stage-dot", style: { background: stage.color } }),
      el("span", {}, [stage.label]),
      el("span", {}, ["·"]),
      el("span", {}, [DAY_LABEL[event.day] ?? event.day]),
      event.start ? el("span", {}, [`· ${fmtTime(event.start)}${event.end ? `–${fmtTime(event.end)}` : ""}`]) : null,
    ].filter(Boolean)),
  );

  const head = el("div", { class: "modal-head" }, [heart, titleWrap]);
  modal.append(head);

  if (event.genres?.length) {
    modal.append(el("div", { class: "genres" },
      event.genres.map(g => el("span", { class: "chip subtle" }, [g]))));
  }

  if (event.description) {
    modal.append(el("p", { class: "description" }, [event.description]));
  }

  if (event.country) {
    const f = flagEmoji(event.countryCode);
    modal.append(el("p", { class: "country" }, [`From ${event.country}${f ? " " + f : ""}`]));
  }

  // Notes block — saving toggles favourite on automatically.
  const ta = el("textarea", {
    maxlength: "500",
    placeholder: "Who recommended it, why, notes for later…",
  });
  ta.value = getNote(event.id);
  const savedFlag = el("span", { class: "saved" });
  const saveBtn = el("button", { class: "save", type: "button" }, ["Save"]);

  const persistNote = () => {
    const text = ta.value;
    if (text.trim() && !isFavourite(event.id)) {
      setFavourite(event.id, true);
      heart.classList.add("is-on");
      heart.textContent = "♥";
      document.dispatchEvent(new CustomEvent("favs:changed", { detail: { id: event.id } }));
    }
    setNote(event.id, text);
    savedFlag.textContent = "Saved";
    setTimeout(() => { savedFlag.textContent = ""; }, 1400);
  };
  saveBtn.addEventListener("click", persistNote);
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); persistNote(); }
  });

  modal.append(el("div", { class: "notes-block" }, [
    el("label", {}, ["Your notes"]),
    ta,
    el("div", { class: "row" }, [saveBtn, savedFlag]),
  ]));

  // Calendar buttons (only for timed events)
  if (event.start && event.end) {
    const gcal = el("a", {
      class: "cal-btn",
      href: googleCalendarUrl(data, event),
      target: "_blank",
      rel: "noopener noreferrer",
    }, ["📅 Google Calendar"]);
    const ics = el("button", { class: "cal-btn", type: "button" }, ["⬇ .ics file"]);
    ics.addEventListener("click", () => downloadIcs(data, [event], `${event.artist}.ics`));
    modal.append(el("div", { class: "cal-row" }, [gcal, ics]));
  }

  const closeBtn = el("button", { class: "close-btn", type: "button" }, ["Close"]);
  closeBtn.addEventListener("click", closeModal);
  modal.append(closeBtn);

  if (event.userAdded) {
    const del = el("button", { class: "delete-btn", type: "button" }, ["Delete this entry"]);
    del.addEventListener("click", () => {
      if (confirm("Delete this user-added event?")) {
        deleteUserEvent(event.id);
        document.dispatchEvent(new CustomEvent("userevents:changed"));
        closeModal();
      }
    });
    modal.append(del);
  }

  root().append(backdrop, modal);
  root().setAttribute("aria-hidden", "false");

  document.addEventListener("keydown", onEsc);
}

function onEsc(e) { if (e.key === "Escape") closeModal(); }

export function closeModal() {
  const r = root();
  r.innerHTML = "";
  r.setAttribute("aria-hidden", "true");
  document.removeEventListener("keydown", onEsc);
}
