// sends page views, clicks, time on page, scroll depth, load time and js errors to
// server/analytics.mjs, shown on /dev.
// no cookies and nothing saved on the visitor's device: the server tells visitors apart
// with a hash that resets every day (see the top of server/analytics.mjs).
// the only thing ever stored is lm.notrack, set on my own browser when I log into /dev

const OPT_OUT = "lm.notrack";

// id for one page view, so time on page can be matched to it. never stored
const rid = () => crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

function optedOut() {
  try {
    return localStorage.getItem(OPT_OUT) === "1";
  } catch {
    return false;
  }
}

export function setOptOut(on) {
  try {
    if (on) localStorage.setItem(OPT_OUT, "1");
    else localStorage.removeItem(OPT_OUT);
  } catch {
    // ignore
  }
}

function send(data, path = location.pathname) {
  if (optedOut() || path.startsWith("/dev")) return;
  const body = JSON.stringify({
    ...data,
    p: path,
    w: window.innerWidth,
  });
  // text/plain keeps it a simple request, and sendBeacon survives page unloads
  const blob = new Blob([body], { type: "text/plain" });
  if (!navigator.sendBeacon?.("/api/t", blob)) {
    fetch("/api/t", { method: "POST", body, keepalive: true }).catch(() => {});
  }
}

// ---------- the page currently open: active time + scroll depth ----------

let page = null; // { id, path, active, visibleSince, scroll, sent }

function scrollDepth() {
  const doc = document.documentElement;
  const total = Math.max(doc.scrollHeight, document.body?.scrollHeight ?? 0);
  if (total <= window.innerHeight) return 100;
  return Math.min(100, Math.round(((window.scrollY + window.innerHeight) / total) * 100));
}

function activeMs() {
  if (!page) return 0;
  return page.active + (page.visibleSince ? performance.now() - page.visibleSince : 0);
}

function sendLeave() {
  if (!page) return;
  send({ t: "leave", id: page.id, d: Math.round(activeMs()), sd: page.scroll }, page.path);
}

let firstView = true;

export function trackView() {
  const path = location.pathname;
  if (page?.path === path) return; // StrictMode runs effects twice
  sendLeave();
  page = {
    id: rid(),
    path,
    active: 0,
    visibleSince: document.visibilityState === "visible" ? performance.now() : null,
    scroll: 0,
  };
  requestAnimationFrame(() => page && (page.scroll = Math.max(page.scroll, scrollDepth())));

  const data = { t: "view", id: page.id };
  if (firstView) {
    // only the first view carries where they came from and who they are
    const q = new URLSearchParams(location.search);
    Object.assign(data, {
      r: document.referrer,
      us: q.get("utm_source") || q.get("ref") || "",
      um: q.get("utm_medium") || "",
      uc: q.get("utm_campaign") || "",
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      lg: navigator.language || "",
    });
    reportLoad(page.id, path);
  }
  firstView = false;
  send(data);
}

function reportLoad(viewId, path) {
  const go = () =>
    setTimeout(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const fcp = performance.getEntriesByName("first-contentful-paint")[0];
      if (!nav || !nav.loadEventEnd) return;
      send({ t: "perf", id: viewId, lt: Math.round(nav.loadEventEnd), fcp: fcp ? Math.round(fcp.startTime) : 0 }, path);
    }, 0);
  if (document.readyState === "complete") go();
  else window.addEventListener("load", go, { once: true });
}

// ---------- clicks ----------

function labelFor(el) {
  const text =
    el.dataset.track ||
    el.getAttribute("aria-label") ||
    el.textContent.trim() ||
    el.querySelector("img[alt]")?.alt ||
    el.getAttribute("title") ||
    el.tagName.toLowerCase();
  return text.replace(/\s+/g, " ").slice(0, 120);
}

// ---------- wiring, call once ----------

export function startTracking() {
  // an older version saved ids on the visitor's device, clean those up
  try {
    localStorage.removeItem("lm.vid");
    sessionStorage.removeItem("lm.sid");
  } catch {
    // storage blocked, nothing to clean
  }

  const onClick = (e) => {
    const el = e.target.closest?.("a, button, [data-track]");
    if (!el) return;
    send({ t: "click", l: labelFor(el), h: el.tagName === "A" ? el.getAttribute("href") || "" : "" });
  };

  let pending = false;
  const onScroll = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      if (page) page.scroll = Math.max(page.scroll, scrollDepth());
    });
  };

  const onVisibility = () => {
    if (!page) return;
    if (document.visibilityState === "hidden") {
      if (page.visibleSince) page.active += performance.now() - page.visibleSince;
      page.visibleSince = null;
      sendLeave(); // might be the last chance, the server keeps the biggest value
    } else if (!page.visibleSince) {
      page.visibleSince = performance.now();
    }
  };

  let errorsSent = 0;
  const report = (m, src) => {
    if (errorsSent++ >= 5) return;
    send({ t: "error", m: String(m).slice(0, 300), src });
  };
  const onError = (e) => report(e.message || "error", e.filename ? `${e.filename.split("/").pop()}:${e.lineno}:${e.colno}` : "");
  const onRejection = (e) => report(`Unhandled promise: ${e.reason?.message ?? e.reason}`, "");

  // capture phase so clicks are recorded before a link navigates away
  document.addEventListener("click", onClick, true);
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", sendLeave);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    document.removeEventListener("click", onClick, true);
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", sendLeave);
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
