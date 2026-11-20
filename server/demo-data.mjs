// fills a local analytics data folder with ~60 days of made-up traffic so the /dev dashboard
// has something to show on `npm run dev`. replaces the events-*.jsonl files in that folder.
//   node server/demo-data.mjs ./analytics-data
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.argv[2] || "./analytics-data");
fs.mkdirSync(dir, { recursive: true });
for (const f of fs.readdirSync(dir)) if (/^events-.*\.jsonl$/.test(f)) fs.rmSync(path.join(dir, f));

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const weighted = (pairs) => {
  const total = pairs.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[0][0];
};
const id = () => Math.floor(rand() * 2 ** 52).toString(36).padStart(10, "0");

const projects = [
  ["echo-2-2", "Echo 2.2", 10],
  ["echo-2-1", "Echo 2.1", 5],
  ["glint", "Glint", 7],
  ["impossible-levels-list", "Impossible Levels List", 6],
  ["weft", "weft", 4],
  ["medminder", "MedMinder", 2],
  ["texlang", "TeXLang", 2],
  ["imgui-to-img", "imgui-to-img", 2],
  ["cryptography-workshop", "Cryptography Workshop", 1],
  ["wordlebot", "WordleBot", 2],
];
const files = ["HOW_IT_WORKS.TXT", "FEATURES.TXT", "HARDEST.TXT", "LEARNED.TXT", "RELEASE.MP4", "SCREEN.PNG"];
const outbound = [
  ["GitHub.URL", "https://github.com/"],
  ["Download.URL", "https://github.com/releases/"],
  ["Discord.URL", "https://discord.gg/"],
  ["Website.URL", "https://impossiblelevels.com"],
];
const sources = [
  [null, 30],
  [{ r: "google.com", ru: "google.com" }, 18],
  [{ r: "github.com", ru: "github.com/leviminton" }, 12],
  [{ r: "discord.com", ru: "discord.com/channels" }, 10],
  [{ r: "youtube.com", ru: "youtube.com/watch" }, 7],
  [{ r: "reddit.com", ru: "reddit.com/r/geometrydash/comments" }, 6],
  [{ r: "x.com", ru: "x.com" }, 3],
  [{ r: "bing.com", ru: "bing.com" }, 2],
  [{ us: "discord", um: "", uc: "" }, 5],
  [{ us: "youtube", um: "video", uc: "echo-release" }, 3],
];
const places = [
  ["America/Chicago", "en-US", 18],
  ["America/New_York", "en-US", 16],
  ["America/Los_Angeles", "en-US", 10],
  ["Europe/London", "en-GB", 7],
  ["Europe/Berlin", "de-DE", 6],
  ["Europe/Paris", "fr-FR", 4],
  ["America/Sao_Paulo", "pt-BR", 5],
  ["Asia/Tokyo", "ja-JP", 3],
  ["Asia/Manila", "en-PH", 3],
  ["Australia/Sydney", "en-AU", 3],
  ["America/Mexico_City", "es-MX", 3],
  ["Europe/Warsaw", "pl-PL", 2],
  ["Asia/Kolkata", "en-IN", 2],
];
const machines = [
  [{ dv: "desktop", os: "Windows", br: "Chrome", sc: "1920×1080", w: 1900 }, 30],
  [{ dv: "desktop", os: "Windows", br: "Edge", sc: "1920×1080", w: 1900 }, 6],
  [{ dv: "desktop", os: "Windows", br: "Firefox", sc: "2560×1440", w: 2500 }, 6],
  [{ dv: "desktop", os: "macOS", br: "Safari", sc: "1512×982", w: 1500 }, 7],
  [{ dv: "desktop", os: "macOS", br: "Chrome", sc: "1440×900", w: 1400 }, 6],
  [{ dv: "desktop", os: "Linux", br: "Firefox", sc: "1920×1080", w: 1900 }, 4],
  [{ dv: "phone", os: "iOS", br: "Safari", sc: "393×852", w: 393 }, 18],
  [{ dv: "phone", os: "Android", br: "Chrome", sc: "412×915", w: 412 }, 14],
  [{ dv: "tablet", os: "iOS", br: "Safari", sc: "820×1180", w: 820 }, 4],
  [{ dv: "tablet", os: "Android", br: "Chrome", sc: "800×1280", w: 800 }, 2],
];

const DAY = 86400000;
const now = Date.now();
const out = [];
const visitors = [];

for (let d = 60; d >= 0; d--) {
  const dayStart = Math.floor((now - d * DAY) / DAY) * DAY;
  const weekday = new Date(dayStart).getUTCDay();
  const spike = d === 12 ? 3.2 : d === 11 ? 1.8 : 1; // a release day
  const n = Math.round((14 + (60 - d) * 0.25 + rand() * 10) * (weekday === 0 || weekday === 6 ? 1.3 : 1) * spike);
  for (let k = 0; k < n; k++) {
    // returning visitors come back sometimes
    let who = null; // ids reset daily on the real server, so no returning visitors here
    if (!who) {
      const place = weighted(places.map((p) => [p, p[2]]));
      who = { v: id(), m: weighted(machines), tz: place[0], lg: place[1] };
      visitors.push(who);
    }
    // evening-heavy hours, utc shifted so it reads right in us time
    const near = (h, c) => Math.min(Math.abs(h - c), 24 - Math.abs(h - c));
    const hour = weighted(Array.from({ length: 24 }, (_, h) => [h, 1 + 6 * Math.exp(-(near(h, 2) ** 2) / 8) + 3 * Math.exp(-(near(h, 20) ** 2) / 8)]));
    let ts = dayStart + hour * 3600000 + rand() * 3600000;
    if (ts > now - 60000) ts = now - 60000 - rand() * 3000000;
    const s = id();
    const src = weighted(sources);
    const { m } = who;
    const base = { v: who.v, s, os: m.os, br: m.br, dv: m.dv };

    const views = [];
    const view = (p, first) => {
      const vid = id();
      const e = { ts, t: "view", p, ...base, id: vid };
      if (first) {
        Object.assign(e, { tz: who.tz, lg: who.lg });
        if (src) Object.assign(e, src);
      }
      out.push(e);
      views.push(e);
      if (first) {
        const lt = Math.round((m.dv === "phone" ? 1400 : 700) + rand() * (m.dv === "phone" ? 2600 : 1200) + (p === "/" ? 400 : 0));
        out.push({ ts: ts + lt, t: "perf", p, ...base, id: vid, lt, fcp: Math.round(lt * 0.45) });
      }
      return vid;
    };
    const leave = (vid, p, dur, sd) => out.push({ ts: ts + dur, t: "leave", p, ...base, id: vid, d: dur, sd });
    const click = (p, l, h) => {
      ts += 2000 + rand() * 20000;
      const k = !h ? "btn" : h.startsWith("http") ? "out" : "in";
      out.push({ ts, t: "click", p, ...base, l, ...(h ? { h } : {}), k });
    };

    // the journey
    const landing = weighted([["/", 70], ["/stuff", 12], ["/stuff/echo-2-2", 8], ["/stuff/glint", 6], ["/stuff/impossible-levels-list", 4]]);
    let p = landing;
    let vid = view(p, true);
    let steps = 0;
    while (steps++ < 8) {
      const stay = Math.round(4000 + rand() * (p === "/" ? 40000 : 90000));
      const keepGoing = rand() < (steps === 1 ? 0.62 : 0.55);
      if (!keepGoing) {
        leave(vid, p, stay, p === "/" ? Math.round(40 + rand() * 60) : 100);
        if (p.startsWith("/stuff/") && rand() < 0.35) {
          const [l, h] = pick(outbound);
          click(p, l, h + (l === "GitHub.URL" ? p.split("/")[2] : ""));
        }
        break;
      }
      if (p === "/") {
        click(p, "My Stuff", "/stuff");
        leave(vid, p, stay, Math.round(50 + rand() * 50));
        ts += 500;
        p = "/stuff";
      } else if (p === "/stuff") {
        const pr = weighted(projects.map((x) => [x, x[2]]));
        click(p, pr[1], `/stuff/${pr[0]}`);
        leave(vid, p, stay, 100);
        ts += 500;
        p = `/stuff/${pr[0]}`;
      } else {
        // poke at files, then go back or leave
        const pokes = Math.floor(rand() * 4);
        for (let i = 0; i < pokes; i++) click(p, pick(files), "");
        if (rand() < 0.5) {
          click(p, "← My Stuff", "/stuff");
          leave(vid, p, stay, 100);
          ts += 500;
          p = "/stuff";
        } else {
          const [l, h] = pick(outbound);
          click(p, l, h + (l === "GitHub.URL" ? p.split("/")[2] : ""));
          leave(vid, p, stay, 100);
          break;
        }
      }
      ts += 300;
      vid = view(p, false);
    }

    if (rand() < 0.02) {
      out.push({ ts: ts + 1000, t: "error", p: views.at(-1).p, ...base, m: pick(["ResizeObserver loop completed with undelivered notifications.", "TypeError: Cannot read properties of null (reading 'getContext')", "Unhandled promise: Failed to fetch"]), src: pick(["index-BEDS_AJ9.js:41:2210", "", "HorizonLevel.jsx:212:18"]) });
    }
    visitors.length > 400 && visitors.splice(0, 50);
  }
}

// a few people on the site right now
for (let i = 0; i < 3; i++) {
  const m = weighted(machines);
  const place = weighted(places.map((p) => [p, p[2]]));
  const base = { v: id(), s: id(), os: m.os, br: m.br, dv: m.dv };
  const t0 = now - (60 + rand() * 200) * 1000;
  out.push({ ts: t0, t: "view", p: "/", ...base, id: id(), tz: place[0], lg: place[1] });
  out.push({ ts: t0 + 9000, t: "click", p: "/", ...base, l: "My Stuff", h: "/stuff", k: "in" });
  out.push({ ts: t0 + 9500, t: "view", p: i === 0 ? "/stuff/echo-2-2" : "/stuff", ...base, id: id() });
}

out.sort((a, b) => a.ts - b.ts);
const byMonth = {};
for (const e of out) (byMonth[new Date(e.ts).toISOString().slice(0, 7)] ??= []).push(JSON.stringify(e));
for (const [mon, lines] of Object.entries(byMonth)) fs.writeFileSync(path.join(dir, `events-${mon}.jsonl`), lines.join("\n") + "\n");
console.log(`wrote ${out.length} demo events to ${dir}`);
