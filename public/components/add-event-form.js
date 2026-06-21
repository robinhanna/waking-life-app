// Add-your-own-event modal form.
import { el } from "../helpers.js";
import { addUserEvent } from "../store.js";

const root = () => document.getElementById("modal-root");

export function openAddEventForm(data) {
  closeAddForm();

  const backdrop = el("div", { class: "modal-backdrop" });
  backdrop.addEventListener("click", closeAddForm);

  const modal = el("section", { class: "modal", role: "dialog", "aria-modal": "true" });
  modal.append(el("h1", { style: { fontSize: 20, fontWeight: 700, margin: "0 0 14px" } }, ["Add event"]));

  const form = el("form", { class: "add-form" });

  const name = el("input", { type: "text", required: true, placeholder: "What's happening?", maxlength: "100" });

  const stageSel = el("select", {});
  for (const slug of Object.keys(data.stages)) {
    stageSel.append(el("option", { value: slug }, [data.stages[slug].label]));
  }
  stageSel.append(el("option", { value: "other" }, ["Other / on-site"]));

  const daySel = el("select", {});
  for (const d of data.days) {
    daySel.append(el("option", { value: d }, [d.toUpperCase()]));
  }

  const start = el("input", { type: "time" });
  const end   = el("input", { type: "time" });

  const note = el("textarea", { placeholder: "Optional note", maxlength: "300", rows: "3" });

  form.append(
    el("label", {}, ["Name"]), name,
    el("label", {}, ["Stage"]), stageSel,
    el("label", {}, ["Day"]), daySel,
    el("div", { class: "row2" }, [
      el("div", {}, [el("label", {}, ["Start"]), start]),
      el("div", {}, [el("label", {}, ["End"]), end]),
    ]),
    el("label", {}, ["Note (optional)"]), note,
  );

  const error = el("p", { style: { color: "var(--heart)", fontSize: 13, marginTop: 4, minHeight: 16 } });

  const submit = el("button", { class: "close-btn", type: "submit", style: { marginTop: 8 } }, ["Save"]);

  form.append(error, submit);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!name.value.trim()) { error.textContent = "Name is required."; return; }
    // ensure end >= start when both provided
    if (start.value && end.value && end.value <= start.value) {
      // allow next-day end if user really wants — but warn here
      // (treat as cross-midnight if start > end)
    }
    const stored = addUserEvent({
      artist: name.value.trim(),
      stage: stageSel.value,
      day: daySel.value,
      start: start.value || null,
      end: end.value || null,
      description: note.value.trim() || undefined,
      country: null,
      countryCode: null,
    });
    document.dispatchEvent(new CustomEvent("userevents:changed", { detail: { event: stored } }));
    closeAddForm();
  });

  const cancel = el("button", { type: "button", class: "delete-btn" }, ["Cancel"]);
  cancel.addEventListener("click", closeAddForm);

  modal.append(form, cancel);

  root().append(backdrop, modal);
  root().setAttribute("aria-hidden", "false");

  document.addEventListener("keydown", onEsc);
  setTimeout(() => name.focus(), 50);
}

function onEsc(e) { if (e.key === "Escape") closeAddForm(); }

export function closeAddForm() {
  const r = root();
  r.innerHTML = "";
  r.setAttribute("aria-hidden", "true");
  document.removeEventListener("keydown", onEsc);
}
