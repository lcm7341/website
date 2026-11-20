import { useLayoutEffect, useRef, useState } from "react";
import { compact, fmt, SERIES } from "./format.js";

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// a clean step so the four gridlines land on round whole numbers
function niceStep(max) {
  const raw = Math.max(1, max) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) {
    const step = m * pow;
    if (step >= raw && Number.isInteger(step)) return step;
  }
  return 10 * pow;
}

const snap = (v) => Math.round(v) + 0.5; // 1px lines land on whole pixels

function linePath(pts) {
  return pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
}

// ---------- little pixel icons, drawn by hand on an 8x8 grid ----------

const ICONS = {
  traffic: ["........", "......##", "......##", "...##.##", "...##.##", "##.##.##", "##.##.##", "########"],
  live: ["........", "..####..", ".#....#.", "#..##..#", "#..##..#", ".#....#.", "..####..", "........"],
  pages: [".#####..", ".#...##.", ".#....#.", ".#.##.#.", ".#....#.", ".#.##.#.", ".#....#.", ".######."],
  heat: ["########", "#.#.#.##", "########", "##.#.#.#", "########", "#.##.#.#", "########", "........"],
  clicks: ["#.......", "##......", "#.#.....", "#..#....", "#...#...", "#..###..", "#.#.....", ".#......"],
  paths: ["........", "##....#.", "##.....#", "##.#####", "##.....#", "##....#.", "........", "........"],
  sources: ["..###...", ".#...#..", "#.....#.", "#.....#.", ".#...#..", "..####..", "......##", ".......#"],
  location: ["..####..", ".#.##.#.", "#..##..#", "########", "#..##..#", ".#.##.#.", "..####..", "........"],
  devices: ["########", "#......#", "#......#", "#......#", "########", "...##...", "..####..", "........"],
  speed: ["....##..", "...##...", "..##....", ".######.", "....##..", "...##...", "..##....", ".##....."],
  errors: ["..#..#..", "...##...", ".######.", "#.####.#", ".######.", "#.####.#", ".######.", "..#..#.."],
  log: [".######.", "#......#", ".#.##.#.", ".#....#.", ".#.##.#.", ".#....#.", "#......#", ".######."],
  trophy: ["#.####.#", "#.####.#", ".######.", "..####..", "...##...", "...##...", "..####..", ".######."],
};

export function PixelIcon({ name, color = "currentColor", size = 16 }) {
  const rows = ICONS[name];
  if (!rows) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true" className="pixel-icon">
      {rows.flatMap((row, y) => [...row].map((c, x) => (c === "#" ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={color} /> : null)))}
    </svg>
  );
}

// ---------- sparkline as a row of little columns ----------

export function Sparkline({ values }) {
  const [ref, w] = useWidth();
  const h = 30;
  const n = values.length;
  const max = Math.max(1, ...values);
  const gap = 1;
  const bw = n ? Math.max(1, Math.floor((w - gap * (n - 1)) / n)) : 0;
  return (
    <div ref={ref} className="spark" aria-hidden="true">
      {w > 0 && n > 0 && (
        <svg width={w} height={h} shapeRendering="crispEdges">
          {values.map((v, i) => {
            const bh = v ? Math.max(2, Math.round((v / max) * (h - 2))) : 1;
            return <rect key={i} x={i * (bw + gap)} y={h - bh} width={bw} height={bh} fill={i === n - 1 ? SERIES.visitors : "#2c356f"} />;
          })}
        </svg>
      )}
    </div>
  );
}

// ---------- main traffic chart: visitors (area) + page views (line), one axis ----------

export function TrafficChart({ series, label }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const h = 280;
  const m = { l: 44, r: 16, t: 16, b: 30 };
  const iw = Math.max(1, w - m.l - m.r);
  const ih = h - m.t - m.b;
  const n = series.length;
  const step = niceStep(Math.max(1, ...series.map((d) => Math.max(d.views, d.visitors))));
  const max = step * 4;
  const x = (i) => m.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v) => m.t + ih - (v / max) * ih;
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step);

  const vis = series.map((d, i) => [x(i), y(d.visitors)]);
  const views = series.map((d, i) => [x(i), y(d.views)]);
  // every point when there's room, otherwise ~6 evenly spaced
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 70))));
  const xTicks = n <= 1 ? [0] : [...new Set([...Array.from({ length: Math.ceil(n / every) }, (_, i) => i * every).filter((i) => n - 1 - i >= every / 2 || i === 0), n - 1])];

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - m.l;
    setHover(Math.max(0, Math.min(n - 1, Math.round(n === 1 ? 0 : (px / iw) * (n - 1)))));
  };

  const tip = hover != null ? series[hover] : null;
  const tipLeft = tip ? Math.min(Math.max(x(hover), 95), w - 95) : 0;
  const marker = (cx, cy, fill) => <rect x={Math.round(cx) - 4} y={Math.round(cy) - 4} width="8" height="8" fill={fill} className="marker" />;

  return (
    <div ref={ref} className="traffic">
      {w > 0 && (
        <svg width={w} height={h} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={`${label}: visitors and page views over time`}>
          <defs>
            {/* ordered dither instead of a gradient: a few lit pixels per 4x4 cell */}
            <pattern id="dither" width="4" height="4" patternUnits="userSpaceOnUse">
              <rect x="0" y="0" width="2" height="2" fill={SERIES.visitors} opacity="0.55" />
              <rect x="2" y="2" width="2" height="2" fill={SERIES.visitors} opacity="0.3" />
            </pattern>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={w - m.r} y1={snap(y(t))} y2={snap(y(t))} className={t === 0 ? "axis-base" : "axis-grid"} />
              <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="axis-text">
                {compact(t)}
              </text>
            </g>
          ))}
          {xTicks.map((i) => (
            <text key={i} x={x(i)} y={h - 8} textAnchor={i === 0 && n > 1 ? "start" : i === n - 1 && n > 1 ? "end" : "middle"} className="axis-text">
              {series[i].label}
            </text>
          ))}
          <path d={`${linePath(vis)}L${vis.at(-1)[0]},${y(0)}L${vis[0][0]},${y(0)}Z`} fill="url(#dither)" opacity="0.5" />
          <path d={linePath(views)} fill="none" stroke={SERIES.views} strokeWidth="2" strokeLinejoin="miter" />
          <path d={linePath(vis)} fill="none" stroke={SERIES.visitors} strokeWidth="2" strokeLinejoin="miter" />
          {tip && (
            <g shapeRendering="crispEdges">
              <line x1={snap(x(hover))} x2={snap(x(hover))} y1={m.t} y2={y(0)} className="crosshair" />
              {marker(x(hover), y(tip.views), SERIES.views)}
              {marker(x(hover), y(tip.visitors), SERIES.visitors)}
            </g>
          )}
          {n === 1 && (
            <g shapeRendering="crispEdges">
              {marker(x(0), y(series[0].views), SERIES.views)}
              {marker(x(0), y(series[0].visitors), SERIES.visitors)}
            </g>
          )}
          <rect x={m.l} y={m.t} width={iw} height={ih} fill="transparent" />
        </svg>
      )}
      {tip && (
        <div className="tooltip" style={{ left: tipLeft, top: 8 }}>
          <div className="tooltip-title">{tip.long}</div>
          <div className="tooltip-row">
            <i style={{ background: SERIES.visitors }} /> Visitors <b>{fmt(tip.visitors)}</b>
          </div>
          <div className="tooltip-row">
            <i style={{ background: SERIES.views }} /> Page views <b>{fmt(tip.views)}</b>
          </div>
          <div className="tooltip-row muted">
            Visits <b>{fmt(tip.sessions)}</b>
          </div>
          <div className="tooltip-row muted">
            Clicks <b>{fmt(tip.clicks)}</b>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- weekday x hour heatmap, five steps of one green ----------

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hourName = (h) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
const HEAT = ["#151a3f", "#163a24", "#1d5a20", "#2a7f22", "#3fa824", "#86dc4f"];
const heatStep = (v, max) => (v ? 1 + Math.min(4, Math.floor((v / max) * 5 - 1e-9)) : 0);

export function Heatmap({ heat }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...heat.flat());
  const busiest = heat.flatMap((row, d) => row.map((v, hr) => ({ v, d, hr }))).sort((a, b) => b.v - a.v)[0];
  return (
    <div className="heat">
      <div className="heat-grid" onMouseLeave={() => setHover(null)}>
        {heat.map((row, d) => (
          <div className="heat-row" key={d}>
            <span className="heat-day">{DAYS[d]}</span>
            {row.map((v, hr) => (
              <span
                key={hr}
                className={hover && hover.d === d && hover.hr === hr ? "heat-cell heat-cell-on" : "heat-cell"}
                style={{ background: HEAT[heatStep(v, max)] }}
                onMouseEnter={() => setHover({ d, hr, v })}
                aria-label={`${DAYS[d]} ${hourName(hr)}: ${v} page views`}
              />
            ))}
          </div>
        ))}
        <div className="heat-row heat-hours">
          <span className="heat-day" />
          {Array.from({ length: 24 }, (_, hr) => (
            <span key={hr} className="heat-hour">
              {hr % 6 === 0 ? hourName(hr) : ""}
            </span>
          ))}
        </div>
      </div>
      <div className="heat-foot">
        {hover ? (
          <span>
            {DAYS[hover.d]} {hourName(hover.hr)}–{hourName((hover.hr + 1) % 24)} · <b>{fmt(hover.v)}</b> page views
          </span>
        ) : busiest?.v ? (
          <span>
            Busiest: <b>{DAYS[busiest.d]} around {hourName(busiest.hr)}</b>
          </span>
        ) : (
          <span>No page views yet</span>
        )}
        <span className="heat-legend">
          less
          {HEAT.slice(1).map((c) => (
            <i key={c} style={{ background: c }} />
          ))}
          more
        </span>
      </div>
    </div>
  );
}

// ---------- one whole split into parts (device mix) ----------

export function SegmentBar({ rows, colors, total }) {
  const [hover, setHover] = useState(null);
  if (!total) return null;
  return (
    <div className="seg">
      <div className="seg-bar" role="img" aria-label={rows.map((r) => `${r.key} ${Math.round((r.visitors / total) * 100)}%`).join(", ")}>
        {rows.map((r) => {
          const share = r.visitors / total;
          return (
            <span
              key={r.key}
              className="seg-part"
              style={{ flexGrow: r.visitors, background: colors[r.key] ?? "#5b6573" }}
              onMouseEnter={() => setHover(r.key)}
              onMouseLeave={() => setHover(null)}
              title={`${r.key}: ${fmt(r.visitors)} (${Math.round(share * 100)}%)`}
            >
              {share >= 0.12 && `${Math.round(share * 100)}%`}
            </span>
          );
        })}
      </div>
      <div className="seg-legend">
        {rows.map((r) => (
          <span key={r.key} className={hover === r.key ? "seg-key seg-key-on" : "seg-key"}>
            <i style={{ background: colors[r.key] ?? "#5b6573" }} />
            {r.key} <b>{fmt(r.visitors)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
