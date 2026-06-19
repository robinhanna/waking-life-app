// Horizontal-scroll CSS-grid timeline.
import {
  el, DAY_LABEL, DAY_SHORT_LABEL, DAY_START_HOUR, DAY_END_HOUR,
  blockRange, todayDaySlug, stageMeta, nowMinutesSinceDayStart,
} from "../helpers.js";
import { renderEventBlock } from "../components/event-block.js";
import { getUserEvents } from "../store.js";

let selectedDay = null;
let nowLineInterval = null;

const MINUTE_W = 1.4;    // pixels per minute — kept in sync with CSS --minute-w

export function renderTimetable(data) {
  if (selectedDay == null) {
    selectedDay = todayDaySlug(data) ?? data.days[1] ?? data.days[0];
  }
  if (!data.days.includes(selectedDay)) selectedDay = data.days[0];

  const root = el("section", { class: "tt-view" });

  // Day pill bar
  const dayBar = el("div", { class: "tt-day-bar" });
  for (const d of data.days) {
    const btn = el("button", {
      class: "tt-day",
      type: "button",
      "aria-pressed": d === selectedDay ? "true" : "false",
    }, [
      DAY_SHORT_LABEL[d] ?? d,
    ]);
    btn.addEventListener("click", () => {
      selectedDay = d;
      const fresh = renderTimetable(data);
      root.replaceWith(fresh);
    });
    dayBar.append(btn);
  }
  root.append(dayBar);

  // All timed events for the selected day, including user-added ones
  const all = [...data.events, ...getUserEvents()];
  const timed = all.filter(e => e.day === selectedDay && e.start);

  // Active stages: those with at least one event on this day. Keep stage order
  // from data.stages, then any extra (e.g. user "Other" stage).
  const activeStages = data.days ? Object.keys(data.stages).filter(s =>
    timed.some(e => e.stage === s),
  ) : [];
  const extraStages = Array.from(new Set(timed.map(e => e.stage)))
    .filter(s => !activeStages.includes(s));
  const stages = [...activeStages, ...extraStages];

  if (!stages.length) {
    root.append(el("p", { class: "empty" }, ["Nothing scheduled this day."]));
    return root;
  }

  const totalMin = (DAY_END_HOUR - DAY_START_HOUR) * 60;
  const totalW = totalMin * MINUTE_W;

  const scroller = el("div", { class: "tt-scroller" });
  const grid = el("div", { class: "tt-grid", style: { width: `calc(var(--label-w) + ${totalW}px)` } });

  // Axis row
  grid.append(el("div", { class: "tt-axis-corner" }));

  const axis = el("div", { class: "tt-axis", style: { width: `${totalW}px` } });
  for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) {
    const left = (h - DAY_START_HOUR) * 60 * MINUTE_W;
    const hourLabel = h % 24;
    axis.append(el("div", {
      class: `tt-axis-tick${h % 6 === 0 ? " major" : ""}`,
      style: { left: `${left}px` },
    }, [`${String(hourLabel).padStart(2, "0")}`]));
  }
  grid.append(axis);

  // Stage rows
  for (const stage of stages) {
    const meta = stageMeta(data, stage);
    grid.append(el("div", { class: "tt-label" }, [meta.label]));
    const lane = el("div", { class: "tt-lane", style: { width: `${totalW}px` } });
    for (const ev of timed.filter(e => e.stage === stage)) {
      const block = renderEventBlock(data, ev, MINUTE_W);
      if (block) lane.append(block);
    }
    grid.append(lane);
  }

  // Now-line
  const isToday = todayDaySlug(data) === selectedDay;
  if (isToday) {
    const nowLine = el("div", { class: "tt-now-line" });
    placeNowLine(nowLine);
    grid.append(nowLine);
    if (nowLineInterval) clearInterval(nowLineInterval);
    nowLineInterval = setInterval(() => placeNowLine(nowLine), 60_000);
    // Auto-scroll to now horizontally on first render
    setTimeout(() => {
      const x = Math.max(0, nowMinutesSinceDayStart() * MINUTE_W - 120);
      scroller.scrollLeft = x;
    }, 0);
  }

  scroller.append(grid);
  root.append(scroller);

  return root;
}

function placeNowLine(line) {
  const mins = nowMinutesSinceDayStart();
  if (mins < 0 || mins > (DAY_END_HOUR - DAY_START_HOUR) * 60) {
    line.style.display = "none";
    return;
  }
  line.style.display = "block";
  line.style.left = `calc(var(--label-w) + ${mins * MINUTE_W}px)`;
}
