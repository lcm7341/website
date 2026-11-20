// tiny self-hosted analytics for leviminton.com
// no dependencies, runs on plain node 20+
//
//   POST /api/t       the site sends events here (public)
//   GET  /api/stats   numbers for the /dev dashboard (needs DEV_PANEL_TOKEN)
//
// event types: view (page opened), click, leave (time on page + scroll depth),
// perf (load timing), error (js errors on the site)
//
// events are appended to one jsonl file per month in DATA_DIR and kept in memory
// for querying.
//
// privacy: nothing is stored on the visitor's device. a visitor is a hash of
// ip + user agent + a random salt that only lives in memory and is replaced every
// day, so the same person gets a new id each day and nobody (me included) can turn
// an id back into an ip or follow someone across days. raw ips are never written.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const DATA_DIR = path.resolve(process.env.DATA_DIR || "./analytics-data");
const TOKEN = process.env.DEV_PANEL_TOKEN || "";
const KEEP_DAYS = Number(process.env.KEEP_DAYS || 400);

if (TOKEN.length < 16) {
  console.error("DEV_PANEL_TOKEN must be set (16+ chars)");
  process.exit(1);
}
fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------- storage ----------

const DAY = 86400000;
const HOUR = 3600000;
const events = [];

function load() {
  const cutoff = Date.now() - KEEP_DAYS * DAY;
  const files = fs.readdirSync(DATA_DIR).filter((f) => /^events-\d{4}-\d{2}\.jsonl$/.test(f)).sort();
  for (const f of files) {
    for (const line of fs.readFileSync(path.join(DATA_DIR, f), "utf8").split("\n")) {
      if (!line) continue;
      try {
        const e = JSON.parse(line);
        if (e.ts >= cutoff) events.push(e);
      } catch {
        // a half-written line from a crash, skip it
      }
    }
  }
  events.sort((a, b) => a.ts - b.ts);
  console.log(`loaded ${events.length} events from ${files.length} file(s)`);
}

function save(e) {
  events.push(e);
  const file = path.join(DATA_DIR, `events-${new Date(e.ts).toISOString().slice(0, 7)}.jsonl`);
  fs.appendFile(file, JSON.stringify(e) + "\n", (err) => err && console.error("write failed", err));
}

// drop old events from memory once a day (files stay on disk)
setInterval(() => {
  const cutoff = Date.now() - KEEP_DAYS * DAY;
  let i = 0;
  while (i < events.length && events[i].ts < cutoff) i++;
  if (i) events.splice(0, i);
}, DAY).unref();

// ---------- ip hashing + rate limit ----------

// older versions kept a long-lived salt on disk, which would make old hashes reversible
fs.rmSync(path.join(DATA_DIR, "salt"), { force: true });

let salt = { day: "", value: "" };
function dailySalt() {
  const day = new Date().toISOString().slice(0, 10);
  if (salt.day !== day) {
    salt = { day, value: crypto.randomBytes(32).toString("hex") };
    visits.clear();
  }
  return salt.value;
}
const hash = (...parts) => crypto.createHash("sha256").update([dailySalt(), ...parts].join("|")).digest("hex").slice(0, 16);

// a visit ends after 30 minutes of nothing
const VISIT_GAP = 30 * 60000;
const visits = new Map(); // visitor hash -> { id, last }
function visitFor(visitor, now) {
  let x = visits.get(visitor);
  if (!x || now - x.last > VISIT_GAP) visits.set(visitor, (x = { id: crypto.randomBytes(8).toString("hex"), last: now }));
  x.last = now;
  return x.id;
}
setInterval(() => {
  const cut = Date.now() - VISIT_GAP;
  for (const [k, x] of visits) if (x.last < cut) visits.delete(k);
}, 10 * 60000).unref();

const hits = new Map(); // ip hash -> [windowStart, count]
function limited(key) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || now - h[0] > 60000) {
    hits.set(key, [now, 1]);
    return false;
  }
  return ++h[1] > 180;
}
setInterval(() => hits.clear(), 10 * 60000).unref();

// ---------- user agent ----------

const BOT =
  /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|curl|wget|python|go-http|java\/|phantom|puppeteer|playwright/i;

function parseUa(ua) {
  const os = /iphone|ipad|ipod/i.test(ua)
    ? "iOS"
    : /android/i.test(ua)
      ? "Android"
      : /windows/i.test(ua)
        ? "Windows"
        : /mac os x|macintosh/i.test(ua)
          ? "macOS"
          : /cros/i.test(ua)
            ? "ChromeOS"
            : /linux/i.test(ua)
              ? "Linux"
              : "Other";
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /opr\/|opera/i.test(ua)
      ? "Opera"
      : /firefox|fxios/i.test(ua)
        ? "Firefox"
        : /chrome|crios/i.test(ua)
          ? "Chrome"
          : /safari/i.test(ua)
            ? "Safari"
            : "Other";
  return { os, browser };
}

// ---------- collecting ----------

const str = (v, max) => (typeof v === "string" ? v.slice(0, max).trim() : "");
const int = (v, lo, hi) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined;
};
const ID = /^[a-z0-9-]{6,40}$/i;
const SITE = /(^|\.)leviminton\.com$/;

function parseRef(r) {
  if (!r) return null;
  try {
    const u = new URL(r);
    const host = u.hostname.replace(/^www\./, "");
    if (SITE.test(host) || !/^https?:$/.test(u.protocol)) return null;
    return { host, url: (host + u.pathname).replace(/\/$/, "").slice(0, 200) };
  } catch {
    return null;
  }
}

function clickKind(h) {
  if (!h) return "btn";
  if (/^(mailto|tel):/i.test(h)) return "out";
  try {
    const u = new URL(h, "https://leviminton.com");
    return SITE.test(u.hostname.replace(/^www\./, "")) ? "in" : "out";
  } catch {
    return "in";
  }
}

const TYPES = new Set(["view", "click", "leave", "perf", "error"]);

function collect(body, req) {
  const ua = str(req.headers["user-agent"], 400);
  if (!ua || BOT.test(ua)) return;
  const ip = req.headers["x-real-ip"] || req.socket.remoteAddress || "";
  const visitor = hash(ip, ua);
  if (limited(visitor)) return;

  let d;
  try {
    d = JSON.parse(body);
  } catch {
    return;
  }
  if (!TYPES.has(d.t)) return;
  const p = str(d.p, 200);
  if (!p.startsWith("/") || p.startsWith("/dev")) return;

  const { os, browser } = parseUa(ua);
  const w = Number(d.w) || 0;
  const now = Date.now();
  const e = {
    ts: now,
    t: d.t,
    v: visitor,
    s: visitFor(visitor, now),
    p,
    os,
    br: browser,
    dv: w && w < 760 ? "phone" : w && w < 1100 ? "tablet" : "desktop",
  };
  if (ID.test(d.id)) e.id = d.id;

  if (d.t === "view") {
    const ref = parseRef(str(d.r, 500));
    if (ref) {
      e.r = ref.host;
      e.ru = ref.url;
    }
    for (const k of ["us", "um", "uc"]) {
      const val = str(d[k], 80);
      if (val) e[k] = val.toLowerCase();
    }
    const tz = str(d.tz, 60);
    if (/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(tz)) e.tz = tz;
    const lg = str(d.lg, 20);
    if (/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/i.test(lg)) e.lg = lg;
  } else if (d.t === "click") {
    e.l = str(d.l, 120).replace(/\s+/g, " ") || "(no label)";
    const h = str(d.h, 300);
    if (h) e.h = h;
    e.k = clickKind(h);
  } else if (d.t === "leave") {
    e.d = int(d.d, 0, 6 * HOUR) ?? 0;
    e.sd = int(d.sd, 0, 100) ?? 0;
  } else if (d.t === "perf") {
    const lt = int(d.lt, 1, 120000);
    if (!lt) return;
    e.lt = lt;
    const fcp = int(d.fcp, 1, 120000);
    if (fcp) e.fcp = fcp;
  } else if (d.t === "error") {
    e.m = str(d.m, 300) || "(unknown error)";
    const src = str(d.src, 200);
    if (src) e.src = src;
  }
  save(e);
}

// ---------- stats helpers ----------

class Counter {
  constructor() {
    this.map = new Map();
  }
  add(key, visitor, n = 1) {
    let x = this.map.get(key);
    if (!x) this.map.set(key, (x = { count: 0, vs: new Set() }));
    x.count += n;
    if (visitor) x.vs.add(visitor);
    return x;
  }
  top(limit, extra = () => ({})) {
    return [...this.map.entries()]
      .map(([key, x]) => ({ key, count: x.count, visitors: x.vs.size, ...extra(key, x) }))
      .sort((a, b) => b.visitors - a.visitors || b.count - a.count)
      .slice(0, limit);
  }
}

const median = (xs) => quantile(xs, 0.5);
function quantile(xs, q) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  return Math.round(s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo));
}

// splits events into sessions with their page views stitched to leave/perf data
function buildSessions(list) {
  const sessions = new Map();
  const viewsById = new Map();
  for (const e of list) {
    let s = sessions.get(e.s);
    if (!s) {
      sessions.set(
        e.s,
        (s = { id: e.s, v: e.v, start: e.ts, end: e.ts, dv: e.dv, os: e.os, br: e.br, views: [], clicks: [], errors: [], events: [] }),
      );
    }
    s.end = Math.max(s.end, e.ts);
    if (e.t === "view") {
      const view = { ts: e.ts, p: e.p, id: e.id, d: null, sd: null, lt: null };
      s.views.push(view);
      if (e.id) viewsById.set(e.id, view);
      if (s.views.length === 1 || !s.r) {
        if (e.r) Object.assign(s, { r: e.r, ru: e.ru });
        if (e.us) Object.assign(s, { us: e.us, um: e.um, uc: e.uc });
      }
      if (e.tz && !s.tz) s.tz = e.tz;
      if (e.lg && !s.lg) s.lg = e.lg;
      s.events.push({ ts: e.ts, t: "view", p: e.p, id: e.id });
    } else if (e.t === "click") {
      s.clicks.push(e);
      s.events.push({ ts: e.ts, t: "click", p: e.p, l: e.l, h: e.h, k: e.k });
    } else if (e.t === "error") {
      s.errors.push(e);
      s.events.push({ ts: e.ts, t: "error", p: e.p, m: e.m });
    }
  }
  // leave + perf are attached to the view they belong to
  for (const e of list) {
    if (!e.id) continue;
    const view = viewsById.get(e.id);
    if (!view) continue;
    if (e.t === "leave") {
      view.d = Math.max(view.d ?? 0, e.d);
      view.sd = Math.max(view.sd ?? 0, e.sd);
    } else if (e.t === "perf") {
      view.lt = e.lt;
      view.fcp = e.fcp;
    }
  }
  for (const s of sessions.values()) {
    const timed = s.views.filter((v) => v.d != null);
    const active = timed.reduce((a, v) => a + v.d, 0);
    s.duration = Math.max(s.end - s.start, active);
    s.bounce = s.views.length <= 1 && s.clicks.length === 0;
  }
  return sessions;
}

function summarize(list) {
  const sessions = buildSessions(list);
  const visitors = new Set();
  let views = 0;
  let clicks = 0;
  for (const e of list) {
    visitors.add(e.v);
    if (e.t === "view") views++;
    else if (e.t === "click") clicks++;
  }
  const ss = [...sessions.values()].filter((s) => s.views.length);
  const bounces = ss.filter((s) => s.bounce).length;
  return {
    sessionsMap: sessions,
    totals: {
      visitors: visitors.size,
      views,
      sessions: ss.length,
      clicks,
      bounceRate: ss.length ? Math.round((bounces / ss.length) * 100) : null,
      avgDuration: ss.length ? Math.round(ss.reduce((a, s) => a + s.duration, 0) / ss.length) : null,
      pagesPerVisit: ss.length ? Math.round((views / ss.length) * 10) / 10 : null,
    },
  };
}

// ---------- stats ----------

function stats(days, tzOffsetMin) {
  const now = Date.now();
  const shift = -tzOffsetMin * 60000; // viewer's local time = utc + shift
  const localDay = (ts) => Math.floor((ts + shift) / DAY);
  const todayStart = localDay(now) * DAY - shift;
  const hourly = days === 1;

  const from = days > 0 ? todayStart - (days - 1) * DAY : events.length ? events[0].ts : now;
  const span = now - from;
  const inRange = events.filter((e) => e.ts >= from);
  const prev = days > 0 ? events.filter((e) => e.ts >= from - span && e.ts < now - span) : null;

  const cur = summarize(inRange);
  const before = prev ? summarize(prev).totals : null;
  const sessions = [...cur.sessionsMap.values()].filter((s) => s.views.length || s.clicks.length);


  // ----- time series, hourly for today, daily otherwise
  const bucketMs = hourly ? HOUR : DAY;
  const firstBucket = hourly ? todayStart : localDay(from) * DAY - shift;
  // today stops at the current hour instead of drawing the rest of the day as zeros
  const nBuckets = hourly ? Math.floor((now - todayStart) / HOUR) + 1 : Math.max(1, Math.round((todayStart - firstBucket) / DAY) + 1);
  const buckets = Array.from({ length: nBuckets }, (_, i) => ({
    t: firstBucket + i * bucketMs,
    vs: new Set(),
    views: 0,
    sessions: 0,
    clicks: 0,
    dur: 0,
    bounces: 0,
  }));
  const bucketOf = (ts) => buckets[Math.min(nBuckets - 1, Math.max(0, Math.floor((ts - firstBucket) / bucketMs)))];
  for (const e of inRange) {
    const b = bucketOf(e.ts);
    b.vs.add(e.v);
    if (e.t === "view") b.views++;
    else if (e.t === "click") b.clicks++;
  }
  for (const s of sessions) {
    const b = bucketOf(s.start);
    b.sessions++;
    b.dur += s.duration;
    if (s.bounce) b.bounces++;
  }
  const series = buckets.map((b) => ({
    t: b.t,
    visitors: b.vs.size,
    views: b.views,
    sessions: b.sessions,
    clicks: b.clicks,
    avgDuration: b.sessions ? Math.round(b.dur / b.sessions) : 0,
    bounceRate: b.sessions ? Math.round((b.bounces / b.sessions) * 100) : 0,
  }));

  // ----- pages, entries, exits, flows
  const pages = new Map();
  const page = (p) => {
    let x = pages.get(p);
    if (!x) pages.set(p, (x = { path: p, views: 0, vs: new Set(), time: [], scroll: [], entries: 0, exits: 0, bounces: 0, load: [] }));
    return x;
  };
  const flows = new Counter();
  for (const s of sessions) {
    s.views.forEach((v, i) => {
      const x = page(v.p);
      x.views++;
      x.vs.add(s.v);
      if (v.d != null) x.time.push(v.d);
      if (v.sd != null) x.scroll.push(v.sd);
      if (v.lt) x.load.push(v.lt);
      if (i > 0 && s.views[i - 1].p !== v.p) flows.add(`${s.views[i - 1].p}\u0000${v.p}`, s.v);
    });
    if (s.views.length) {
      page(s.views[0].p).entries++;
      page(s.views.at(-1).p).exits++;
      if (s.bounce) page(s.views[0].p).bounces++;
    } else {
      // a session that only clicked (eg came back to a tab), count nothing extra
    }
  }
  const pageRows = [...pages.values()]
    .map((x) => ({
      path: x.path,
      views: x.views,
      visitors: x.vs.size,
      avgTime: x.time.length ? Math.round(x.time.reduce((a, b) => a + b, 0) / x.time.length) : null,
      avgScroll: x.scroll.length ? Math.round(x.scroll.reduce((a, b) => a + b, 0) / x.scroll.length) : null,
      entries: x.entries,
      exits: x.exits,
      bounceRate: x.entries ? Math.round((x.bounces / x.entries) * 100) : null,
      exitRate: x.views ? Math.round((x.exits / x.views) * 100) : null,
      load: median(x.load),
    }))
    .sort((a, b) => b.visitors - a.visitors || b.views - a.views);

  // ----- clicks
  const clicks = new Map();
  for (const s of sessions) {
    for (const c of s.clicks) {
      const key = `${c.l}\u0000${c.h || ""}`;
      let x = clicks.get(key);
      if (!x) clicks.set(key, (x = { label: c.l, href: c.h || "", kind: c.k || clickKind(c.h), count: 0, vs: new Set(), on: new Counter() }));
      x.count++;
      x.vs.add(s.v);
      x.on.add(c.p, s.v);
    }
  }
  const clickRows = [...clicks.values()]
    .map((x) => ({ label: x.label, href: x.href, kind: x.kind, count: x.count, visitors: x.vs.size, on: x.on.top(3).map((r) => r.key) }))
    .sort((a, b) => b.visitors - a.visitors || b.count - a.count);

  // ----- sources, audience
  const referrers = new Counter();
  const refUrls = new Counter();
  const campaigns = new Counter();
  const devices = new Counter();
  const browsers = new Counter();
  const oses = new Counter();
  const zones = new Counter();
  const langs = new Counter();
  for (const s of sessions) {
    referrers.add(s.r || "(direct)", s.v);
    if (s.ru) refUrls.add(s.ru, s.v);
    if (s.us || s.uc) campaigns.add([s.us, s.um, s.uc].filter(Boolean).join(" / "), s.v);
    devices.add(s.dv, s.v);
    browsers.add(s.br, s.v);
    oses.add(s.os, s.v);
    zones.add(s.tz || "(unknown)", s.v);
    if (s.lg) langs.add(s.lg, s.v);
  }

  // ----- activity heatmap: page views by weekday x hour in the viewer's timezone
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const e of inRange) {
    if (e.t !== "view") continue;
    const local = new Date(e.ts + shift);
    heat[(local.getUTCDay() + 6) % 7][local.getUTCHours()]++;
  }

  // ----- performance
  const allViews = sessions.flatMap((s) => s.views.map((v) => ({ ...v, dv: s.dv })));
  const loads = allViews.filter((v) => v.lt).map((v) => v.lt);
  const fcps = allViews.filter((v) => v.fcp).map((v) => v.fcp);
  const loadByDevice = ["desktop", "tablet", "phone"]
    .map((dv) => {
      const xs = allViews.filter((v) => v.dv === dv && v.lt).map((v) => v.lt);
      return { key: dv, median: median(xs), p75: quantile(xs, 0.75), n: xs.length };
    })
    .filter((r) => r.n);

  // ----- errors
  const errs = new Map();
  for (const s of sessions) {
    for (const e of s.errors) {
      const key = `${e.m}\u0000${e.src || ""}`;
      let x = errs.get(key);
      if (!x) errs.set(key, (x = { message: e.m, src: e.src || "", count: 0, vs: new Set(), last: 0, pages: new Set(), browsers: new Set() }));
      x.count++;
      x.vs.add(s.v);
      x.last = Math.max(x.last, e.ts);
      x.pages.add(e.p);
      x.browsers.add(e.br);
    }
  }
  const errorRows = [...errs.values()]
    .map((x) => ({ message: x.message, src: x.src, count: x.count, visitors: x.vs.size, last: x.last, pages: [...x.pages], browsers: [...x.browsers] }))
    .sort((a, b) => b.last - a.last)
    .slice(0, 30);

  // ----- live: anyone with activity in the last 5 minutes
  const liveCut = now - 5 * 60000;
  const live = new Map();
  for (let i = events.length - 1; i >= 0 && events[i].ts >= liveCut; i--) {
    const e = events[i];
    if (live.has(e.v)) continue;
    live.set(e.v, { v: e.v.slice(0, 8), p: e.p, ts: e.ts, dv: e.dv, br: e.br, os: e.os, s: e.s });
  }
  const allSessions = buildSessions(events.filter((e) => e.ts >= liveCut - 6 * HOUR));
  const liveRows = [...live.values()].map((x) => {
    const s = allSessions.get(x.s);
    return { ...x, s: undefined, since: s?.start ?? x.ts, pages: s?.views.length ?? 0, r: s?.r || "", tz: s?.tz || "" };
  });

  // ----- visit log
  const recent = sessions
    .sort((a, b) => b.end - a.end)
    .slice(0, 150)
    .map((s) => {
      const byId = new Map(s.views.filter((v) => v.id).map((v) => [v.id, v]));
      return {
        id: s.id,
        v: s.v.slice(0, 8),
        start: s.start,
        end: s.end,
        duration: s.duration,
        dv: s.dv,
        os: s.os,
        br: s.br,
        r: s.r || "",
        ru: s.ru || "",
        campaign: [s.us, s.um, s.uc].filter(Boolean).join(" / "),
        tz: s.tz || "",
        lg: s.lg || "",
        views: s.views.length,
        clicks: s.clicks.length,
        errors: s.errors.length,
        bounce: s.bounce,
        events: s.events.slice(-100).map((e) => {
          const v = e.id ? byId.get(e.id) : null;
          return v ? { ...e, id: undefined, d: v.d, sd: v.sd, lt: v.lt } : { ...e, id: undefined };
        }),
      };
    });

  // ----- all-time records, for the high score strip
  const records = { bestDay: null, longest: null, mostPages: null, mostClicks: null };
  {
    const perDay = new Map();
    for (const e of events) {
      const k = localDay(e.ts);
      let set = perDay.get(k);
      if (!set) perDay.set(k, (set = new Set()));
      set.add(e.v);
    }
    for (const [k, set] of perDay) {
      if (!records.bestDay || set.size > records.bestDay.visitors) records.bestDay = { t: k * DAY - shift, visitors: set.size };
    }
    for (const s of buildSessions(events).values()) {
      if (!s.views.length) continue;
      if (!records.longest || s.duration > records.longest.value) records.longest = { value: s.duration, t: s.start };
      if (!records.mostPages || s.views.length > records.mostPages.value) records.mostPages = { value: s.views.length, t: s.start };
      if (!records.mostClicks || s.clicks.length > records.mostClicks.value) records.mostClicks = { value: s.clicks.length, t: s.start };
    }
  }

  const totals = cur.totals;
  return {
    generated: now,
    days,
    hourly,
    totals,
    previous: before,
    records,
    series,
    pages: pageRows.slice(0, 40),
    entries: [...pageRows].filter((r) => r.entries).sort((a, b) => b.entries - a.entries).slice(0, 15),
    exits: [...pageRows].filter((r) => r.exits).sort((a, b) => b.exits - a.exits).slice(0, 15),
    flows: flows.top(20).map((r) => {
      const [fromP, toP] = r.key.split("\u0000");
      return { from: fromP, to: toP, count: r.count, visitors: r.visitors };
    }),
    clicks: clickRows.slice(0, 50),
    referrers: referrers.top(25),
    refUrls: refUrls.top(25),
    campaigns: campaigns.top(20),
    devices: devices.top(5),
    browsers: browsers.top(10),
    os: oses.top(10),
    zones: zones.top(25),
    langs: langs.top(15),
    heat,
    perf: { median: median(loads), p75: quantile(loads, 0.75), fcp: median(fcps), n: loads.length, byDevice: loadByDevice },
    errors: errorRows,
    errorCount: errorRows.reduce((a, r) => a + r.count, 0),
    live: liveRows,
    recent,
  };
}

// ---------- http ----------

function authed(req) {
  const got = Buffer.from((req.headers.authorization || "").replace(/^Bearer /, ""));
  const want = Buffer.from(TOKEN);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

function send(res, code, body) {
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");

  if (req.method === "POST" && url.pathname === "/api/t") {
    let body = "";
    let tooBig = false;
    req.on("data", (c) => {
      body += c;
      if (body.length > 4096) {
        tooBig = true;
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!tooBig) collect(body, req);
      res.writeHead(204).end();
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/stats") {
    if (!authed(req)) return send(res, 401, { error: "bad token" });
    const days = Math.max(0, Math.min(3650, Number(url.searchParams.get("days") ?? 7) || 0));
    const tz = Math.max(-840, Math.min(840, Number(url.searchParams.get("tz")) || 0));
    try {
      return send(res, 200, stats(days, tz));
    } catch (err) {
      console.error(err);
      return send(res, 500, { error: "stats failed" });
    }
  }

  if (url.pathname === "/api/health") return send(res, 200, { ok: true, events: events.length });

  send(res, 404, { error: "not found" });
});

load();
server.listen(PORT, HOST, () => console.log(`analytics listening on ${HOST}:${PORT}`));
