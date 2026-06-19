// Share sheet — copy URL, QR code, system share.
import { el } from "../helpers.js";
import qrcode from "../vendor/qrcode.mjs";

const root = () => document.getElementById("modal-root");

function buildQrSvg(text, modules = 4) {
  // Try increasing typeNumber until the text fits.
  for (let tn = 4; tn <= 12; tn++) {
    try {
      const qr = qrcode(tn, "M");
      qr.addData(text);
      qr.make();
      return qr.createSvgTag({ scalable: true });
    } catch { /* try next */ }
  }
  return `<div style="padding:30px;color:#333">QR failed</div>`;
}

export function openShareSheet() {
  closeShare();
  const url = location.href.split("#")[0];   // share the base, not the current tab hash

  const backdrop = el("div", { class: "modal-backdrop" });
  backdrop.addEventListener("click", closeShare);

  const modal = el("section", { class: "modal center", role: "dialog", "aria-modal": "true" });

  modal.append(el("h1", { style: { fontSize: 18, fontWeight: 700, margin: "0 0 6px" } }, ["Share"]));
  modal.append(el("p", { style: { fontSize: 13, color: "var(--fg-mute)", margin: "0 0 6px" } },
    ["Scan or copy."]));

  const qrWrap = el("div", { class: "qr" });
  qrWrap.innerHTML = buildQrSvg(url);

  const body = el("div", { class: "share-body" }, [
    qrWrap,
    el("div", { class: "url" }, [url]),
  ]);

  const row = el("div", { class: "row" });
  const copyBtn = el("button", { type: "button" }, ["Copy link"]);
  copyBtn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(url); copyBtn.textContent = "Copied"; }
    catch { copyBtn.textContent = "Copy failed"; }
    setTimeout(() => { copyBtn.textContent = "Copy link"; }, 1500);
  });
  const shareBtn = el("button", { type: "button" },
    [navigator.share ? "System share" : "—"]);
  if (navigator.share) {
    shareBtn.addEventListener("click", async () => {
      try { await navigator.share({ title: "Waking Life 2026", url }); } catch { /* user cancelled */ }
    });
  } else {
    shareBtn.disabled = true;
    shareBtn.style.opacity = "0.4";
  }
  row.append(copyBtn, shareBtn);
  body.append(row);

  const closeBtn = el("button", {
    class: "close-btn", type: "button",
    style: { marginTop: 12 },
  }, ["Close"]);
  closeBtn.addEventListener("click", closeShare);

  modal.append(body, closeBtn);

  root().append(backdrop, modal);
  root().setAttribute("aria-hidden", "false");

  document.addEventListener("keydown", onEsc);
}

function onEsc(e) { if (e.key === "Escape") closeShare(); }

export function closeShare() {
  const r = root();
  r.innerHTML = "";
  r.setAttribute("aria-hidden", "true");
  document.removeEventListener("keydown", onEsc);
}
