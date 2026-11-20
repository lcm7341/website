// chart colors, validated with the dataviz palette checker on the #0c0f29 panel color
export const SERIES = { visitors: "#3fa824", views: "#9085e9" };
export const DEVICE_COLORS = { desktop: "#3987e5", phone: "#d95926", tablet: "#199e70" };

export const fmt = (n) => (n == null ? "–" : Math.round(n).toLocaleString());

export function compact(n) {
  if (n == null) return "–";
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(0)}K`;
  return Math.round(n).toLocaleString();
}

export function duration(ms) {
  if (ms == null) return "–";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

export const ms = (v) => (v == null ? "–" : v < 1000 ? `${v} ms` : `${(v / 1000).toFixed(2)} s`);

export const time = (ts) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
export const timeSec = (ts) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });

export function dateTime(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const t = time(ts);
  if (d.toDateString() === today.toDateString()) return `Today ${t}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${t}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${t}`;
}

export function ago(ts, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

// "America/Chicago" -> "Chicago" with the region as a hint
export function zoneName(tz) {
  if (!tz || tz === "(unknown)") return { city: "Unknown", region: "" };
  const parts = tz.split("/");
  return { city: parts.at(-1).replace(/_/g, " "), region: parts.length > 1 ? parts[0].replace(/_/g, " ") : "" };
}

let langNames;
export function langName(code) {
  try {
    langNames ??= new Intl.DisplayNames(["en"], { type: "language" });
    return langNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export const pct = (v) => (v == null ? "–" : `${v}%`);
