// Continuous horizontal timeline. One row per stage, full festival width.
// Day pills scroll the viewport to that day's anchor; they do NOT re-render.
import {
  el, DAY_SHORT_LABEL, DAY_ANCHOR_HOUR,
  totalFestivalMinutes, nowMinutesFromEpoch, todayDaySlug, stageMeta,
} from "../helpers.js";
import { renderEventBlock } from "../components/event-block.js";
import { getUserEvents } from "../store.js";

const MINUTE_W = 1.4;            // pixels per minute (kept in sync with CSS)
let nowLineInterval = null;

export function renderTimetable(data) {
  const root = el("section", { class: "tt-view" });

  // ─── Day pill bar ─────────────────────────────────────────────────────
  const dayBar = el("div", { class: "tt-day-bar" });
  const dayBtns = new Map();

  const nowBtn = el("button", {
    class: "tt-day", type: "button", "data-anchor": "now",
  }, ["Now"]);
  dayBar.append(nowBtn);

  for (const d of data.days) {
    const btn = el("button", {
      class: "tt-day", type: "button",
      "aria-pressed": "false",
    }, [DAY_SHORT_LABEL[d] ?? d]);
    dayBar.append(btn);
    dayBtns.set(d, btn);
  }
  root.append(dayBar);

  // ─── Gather all events (data + user) ──────────────────────────────────
  const all = [...data.events, ...getUserEvents()];
  const timed = all.filter(e => e.start);

  // Active stages: data.stages key order, then anything else found.
  const stagesInUse = new Set(timed.map(e => e.stage));
  const orderedStages = Object.keys(data.stages).filter(s => stagesInUse.has(s));
  const extras = Array.from(stagesInUse).filter(s => !orderedStages.includes(s));
  const stages = [...orderedStages, ...extras];

  if (!stages.length) {
    root.append(el("p", { class: "empty" }, ["Nothing scheduled."]));
    return root;
  }

  const totalMin = totalFestivalMinutes(data);
  const totalW = totalMin * MINUTE_W;

  // ─── Scroller + grid ──────────────────────────────────────────────────
  const scroller = el("div", { class: "tt-scroller" });
  const grid = el("div", {
    class: "tt-grid",
    style: { width: `calc(var(--label-w) + ${totalW}px)` },
  });

  // Corner + axis
  grid.append(el("div", { class: "tt-axis-corner" }));
  const axis = el("div", { class: "tt-axis", style: { width: `${totalW}px` } });

  for (let day = 0; day < data.days.length; day++) {
    const daySlug = data.days[day];
    const dayLeft = day * 24 * 60 * MINUTE_W;
    // Day boundary marker + label
    axis.append(el("div", {
      class: "tt-axis-day",
      style: { left: `${dayLeft}px` },
    }, [`${DAY_SHORT_LABEL[daySlug]} · ${shortDate(data.dayDates?.[daySlug])}`]));
    // Hour ticks within the day
    for (let h = 0; h <= 24; h++) {
      const left = (day * 24 * 60 + h * 60) * MINUTE_W;
      const isDay = h === 0;
      const isMajor = h % 6 === 0;
      if (isDay) continue;       // day boundary already drawn
      axis.append(el("div", {
        class: `tt-axis-tick${isMajor ? " major" : ""}`,
        style: { left: `${left}px` },
      }, [`${String(h).padStart(2, "0")}`]));
    }
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

  // Now line — only when current time is within festival window
  const nowLine = el("div", { class: "tt-now-line" });
  grid.append(nowLine);
  placeNowLine(data, nowLine);
  if (nowLineInterval) clearInterval(nowLineInterval);
  nowLineInterval = setInterval(() => placeNowLine(data, nowLine), 60_000);

  scroller.append(grid);
  root.append(scroller);

  // ─── Day pill scroll handlers ────────────────────────────────────────
  const scrollToMinute = (mins) => {
    const target = mins * MINUTE_W - scroller.clientWidth / 3;
    scroller.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  };
  const scrollToDay = (day) => {
    const di = data.days.indexOf(day);
    if (di < 0) return;
    scrollToMinute(di * 24 * 60 + DAY_ANCHOR_HOUR * 60);
    markActive(day);
  };
  const NOW_RESERVED = 78;  // px of pill-bar real estate reserved for the sticky Now pill

  const scrollPillIntoView = (btn) => {
    if (!btn) return;
    const barW = dayBar.clientWidth;
    const barScroll = dayBar.scrollLeft;
    const btnLeft = btn.offsetLeft;
    const btnRight = btnLeft + btn.offsetWidth;
    const margin = 12;
    if (btnLeft < barScroll + NOW_RESERVED + margin) {
      dayBar.scrollTo({ left: Math.max(0, btnLeft - NOW_RESERVED - margin), behavior: "smooth" });
    } else if (btnRight > barScroll + barW - margin) {
      dayBar.scrollTo({ left: btnRight - barW + margin, behavior: "smooth" });
    }
  };

  const markActive = (day) => {
    let activeBtn = null;
    for (const [slug, btn] of dayBtns) {
      const isOn = slug === day;
      btn.setAttribute("aria-pressed", isOn ? "true" : "false");
      if (isOn) activeBtn = btn;
    }
    nowBtn.setAttribute("aria-pressed", day === null ? "true" : "false");
    if (activeBtn) scrollPillIntoView(activeBtn);
  };

  for (const [d, btn] of dayBtns) btn.addEventListener("click", () => scrollToDay(d));

  // Scroll-spy: as the user scrolls horizontally, light up the pill of the
  // day under the viewport centre. Falls back to "Now" if the centre is
  // within 30 minutes of the live red line.
  let pendingFrame = false;
  scroller.addEventListener("scroll", () => {
    if (pendingFrame) return;
    pendingFrame = true;
    requestAnimationFrame(() => {
      pendingFrame = false;
      const labelW = 88;        // matches --label-w
      const centreMins = (scroller.scrollLeft + scroller.clientWidth / 2 - labelW) / MINUTE_W;
      const clamped = Math.max(0, Math.min(totalMin, centreMins));
      const now = nowMinutesFromEpoch(data);
      if (now != null && now >= 0 && now <= totalMin && Math.abs(clamped - now) < 30) {
        markActive(null);
        return;
      }
      const dayIdx = Math.min(data.days.length - 1, Math.max(0, Math.floor(clamped / 1440)));
      markActive(data.days[dayIdx]);
    });
  });

  const scrollToNow = () => {
    const now = nowMinutesFromEpoch(data);
    if (now == null || now < 0 || now > totalMin) {
      // Outside festival: fall back to today's-day-slug or first day.
      const today = todayDaySlug(data);
      scrollToDay(today ?? data.days[0]);
      return;
    }
    scrollToMinute(now);
    markActive(null);
  };
  nowBtn.addEventListener("click", scrollToNow);

  // Initial scroll: prefer Now if within festival; else today's anchor; else first day.
  requestAnimationFrame(() => {
    const now = nowMinutesFromEpoch(data);
    if (now != null && now >= 0 && now <= totalMin) {
      scrollToMinute(now);
      markActive(null);
    } else {
      const today = todayDaySlug(data);
      scrollToDay(today ?? data.days[1] ?? data.days[0]);
    }
  });

  return root;
}

function placeNowLine(data, line) {
  const total = totalFestivalMinutes(data);
  const mins = nowMinutesFromEpoch(data);
  if (mins == null || mins < 0 || mins > total) {
    line.style.display = "none";
    return;
  }
  line.style.display = "block";
  line.style.left = `calc(var(--label-w) + ${mins * MINUTE_W}px)`;
}

function shortDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]}`;
}
