import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "@fontsource/vt323";
import gd_cube from "../assets/my_cube.png";
import { setOptOut } from "../analytics.js";
import Space from "../Space.jsx";
import { Heatmap, PixelIcon, SegmentBar, Sparkline, TrafficChart } from "./charts.jsx";
import { DEVICE_COLORS, SERIES, ago, compact, dateTime, duration, fmt, langName, ms, pct, time, timeSec, zoneName } from "./format.js";
import "./Dev.css";

// private analytics dashboard, not linked anywhere. data comes from server/analytics.mjs
// on `npm run dev` it skips the password and talks to the local analytics server
const LOCAL = import.meta.env.DEV;
const LOCAL_TOKEN = "local-dev-token-0000";
const TOKEN_KEY = "lm.devtoken";
const RANGES = [
  [1, "Today"],
  [7, "7D"],
  [30, "30D"],
  [90, "90D"],
  [0, "All"],
];
const RANGE_NAME = { 1: "today", 7: "the last 7 days", 30: "the last 30 days", 90: "the last 90 days", 0: "all time" };
const PREV_NAME = { 1: "yesterday", 7: "previous 7 days", 30: "previous 30 days", 90: "previous 90 days" };

export default function Dev() {
  const [token, setToken] = useState(() => (LOCAL ? LOCAL_TOKEN : localStorage.getItem(TOKEN_KEY) || ""));
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    document.title = "Analytics · leviminton.com";
    document.body.classList.add("dash-body");
    return () => {
      document.title = "Levi's Website";
      document.body.classList.remove("dash-body");
    };
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stats?days=${days}&tz=${new Date().getTimezoneOffset()}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setError(LOCAL ? "Local analytics server has a different password. Start it with npm run analytics." : "Wrong password.");
        return;
      }
      if (!res.ok) throw new Error(`server said ${res.status}`);
      setData(await res.json());
      setError("");
    } catch (e) {
      setError(
        LOCAL ? `Can't reach the local analytics server (${e.message}). Run: npm run analytics` : `Couldn't load stats (${e.message}).`,
      );
    } finally {
      setLoading(false);
    }
  }, [token, days]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!token) {
    return (
      <Login
        error={error}
        onLogin={(t) => {
          localStorage.setItem(TOKEN_KEY, t);
          setOptOut(true); // my own visits shouldn't count
          setError("");
          setToken(t);
        }}
      />
    );
  }

  return (
    <div className="dash">
      <Space sun={false} />
      <header className="dash-head">
        <Link to="/" className="dash-brand" title="Back to the site">
          <img src={gd_cube} alt="" />
          <span>
            <b>Levi&apos;s Analytics</b>
            <small>leviminton.com{LOCAL && " · LOCAL COPY"}</small>
          </span>
        </Link>

        <div className="dash-ranges" role="group" aria-label="Date range">
          {RANGES.map(([d, label]) => (
            <button key={d} type="button" className={d === days ? "on" : ""} aria-pressed={d === days} onClick={() => setDays(d)}>
              {label}
            </button>
          ))}
        </div>

        <div className="dash-actions">
          <span className={data?.live.length ? "live-pill live-pill-on" : "live-pill"}>
            <i />
            {data ? `${data.live.length} ON SITE` : "…"}
          </span>
          <button type="button" className="ghost-btn" onClick={load} disabled={loading} title="Refresh now">
            {loading ? "LOADING" : "REFRESH"}
            {data && !loading && <small>{ago(data.generated, now)}</small>}
          </button>
          {!LOCAL && (
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                localStorage.removeItem(TOKEN_KEY);
                setToken("");
                setData(null);
              }}
            >
              Log out
            </button>
          )}
        </div>
      </header>

      {error && <div className="dash-error">{error}</div>}
      {!data && !error && <div className="dash-loading">Loading…</div>}
      {data && <Dashboard data={data} now={now} />}
    </div>
  );
}

function Login({ onLogin, error }) {
  const [value, setValue] = useState("");
  return (
    <div className="dash dash-login-wrap">
      <Space sun={false} />
      <form
        className="dash-login"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onLogin(value.trim());
        }}
      >
        <div className="dash-login-bar">PASSWORD.EXE</div>
        <img src={gd_cube} alt="" />
        <h1>Levi&apos;s Analytics</h1>
        <p>who goes there?</p>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          autoComplete="current-password"
          placeholder="Password"
          aria-label="Password"
        />
        {error && <div className="dash-error">{error}</div>}
        <button type="submit">LET ME IN</button>
        <Link to="/">← back to the site</Link>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Dashboard({ data, now }) {
  const { totals: t, previous: p, days } = data;
  const series = useMemo(
    () =>
      data.series.map((d) => {
        const date = new Date(d.t);
        return {
          ...d,
          label: data.hourly
            ? date.toLocaleTimeString([], { hour: "numeric" })
            : date.toLocaleDateString([], { month: "short", day: "numeric" }),
          long: data.hourly
            ? `${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – ${new Date(d.t + 3600000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
            : date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
        };
      }),
    [data],
  );
  const pick = (k) => series.map((d) => d[k]);
  const prevName = PREV_NAME[days];

  return (
    <main className="dash-main">
      <section className="kpis">
        <Kpi hero label="Visitors" value={fmt(t.visitors)} cur={t.visitors} prev={p?.visitors} spark={pick("visitors")} prevName={prevName}>
          <span className="kpi-sub">{days === 1 ? "unique today" : "unique per day, added up"}</span>
        </Kpi>
        <Kpi label="Page views" value={compact(t.views)} cur={t.views} prev={p?.views} spark={pick("views")} prevName={prevName} />
        <Kpi label="Visits" value={compact(t.sessions)} cur={t.sessions} prev={p?.sessions} spark={pick("sessions")} prevName={prevName} />
        <Kpi label="Avg visit length" value={duration(t.avgDuration)} cur={t.avgDuration} prev={p?.avgDuration} spark={pick("avgDuration")} prevName={prevName} />
        <Kpi label="Bounce rate" value={pct(t.bounceRate)} cur={t.bounceRate} prev={p?.bounceRate} spark={pick("bounceRate")} prevName={prevName} upIsBad points />
        <Kpi label="Clicks" value={compact(t.clicks)} cur={t.clicks} prev={p?.clicks} spark={pick("clicks")} prevName={prevName}>
          <span className="kpi-sub">{t.pagesPerVisit ?? "–"} pages per visit</span>
        </Kpi>
      </section>

      <Records r={data.records} />

      <div className="grid">
        <Card className="span-8" icon="traffic" title="Traffic" sub={`Visitors and page views, ${data.hourly ? "by hour" : "by day"}`} legend>
          <TrafficChart series={series} label="Traffic" />
        </Card>
        <Card className="span-4" icon="live" title="Live now" sub="Active in the last 5 minutes" badge={data.live.length}>
          <Live rows={data.live} now={now} />
        </Card>

        <Card className="span-7" icon="pages" title="Pages" sub={`What people opened ${RANGE_NAME[days]}`}>
          <Pages data={data} />
        </Card>
        <Card className="span-5" icon="heat" title="When people visit" sub="Page views by weekday and hour, your time">
          <Heatmap heat={data.heat} />
        </Card>

        <Card className="span-7" icon="clicks" title="Clicks" sub="Every link and button people pressed">
          <Clicks rows={data.clicks} />
        </Card>
        <Card className="span-5" icon="paths" title="Paths" sub="Where people went next">
          <Flows rows={data.flows} />
        </Card>

        <Card className="span-4" icon="sources" title="Sources" sub="How people found the site">
          <Sources data={data} />
        </Card>
        <Card className="span-4" icon="location" title="Location" sub="From the visitor's timezone and language">
          <Location data={data} />
        </Card>
        <Card className="span-4" icon="devices" title="Devices">
          <Devices data={data} />
        </Card>

        <Card className="span-6" icon="speed" title="Speed" sub="Full page load on first visit">
          <Speed data={data} />
        </Card>
        <Card className="span-6" icon="errors" title="Errors" sub="JavaScript errors visitors ran into" badge={data.errorCount || null} badgeBad>
          <Errors rows={data.errors} now={now} />
        </Card>

        <Card className="span-12" icon="log" title="Visit log" sub="Every visit, newest first. Click one to replay it">
          <VisitLog rows={data.recent} />
        </Card>
      </div>
    </main>
  );
}

function Kpi({ label, value, cur, prev, spark, prevName, upIsBad = false, points = false, hero = false, children }) {
  let delta = null;
  if (prev != null && cur != null) {
    if (points) delta = { text: `${Math.abs(cur - prev)} pts`, dir: Math.sign(cur - prev) };
    else if (prev > 0) delta = { text: `${Math.abs(Math.round(((cur - prev) / prev) * 100))}%`, dir: Math.sign(cur - prev) };
    else if (cur > 0) delta = { text: "new", dir: 1 };
  }
  const good = delta && delta.dir !== 0 && (delta.dir > 0) !== upIsBad;
  return (
    <div className={hero ? "kpi kpi-hero" : "kpi"}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {delta && (
        <span className={delta.dir === 0 ? "delta" : good ? "delta delta-good" : "delta delta-bad"} title={`vs ${prevName}`}>
          {delta.dir > 0 ? "▲" : delta.dir < 0 ? "▼" : "■"} {delta.text} <small>vs {prevName}</small>
        </span>
      )}
      {children}
      <Sparkline values={spark} />
    </div>
  );
}

// all-time bests, shown like a high score table
function Records({ r }) {
  const day = (t) => new Date(t).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  const items = [
    ["Best day", r.bestDay && `${fmt(r.bestDay.visitors)} visitors`, r.bestDay && day(r.bestDay.t)],
    ["Longest visit", r.longest && duration(r.longest.value), r.longest && day(r.longest.t)],
    ["Most pages", r.mostPages && `${fmt(r.mostPages.value)} in one visit`, r.mostPages && day(r.mostPages.t)],
    ["Most clicks", r.mostClicks && `${fmt(r.mostClicks.value)} in one visit`, r.mostClicks && day(r.mostClicks.t)],
  ];
  return (
    <section className="records" aria-label="All-time records">
      <span className="records-title">
        <PixelIcon name="trophy" size={18} />
        HIGH SCORES
      </span>
      {items.map(([label, value, when]) => (
        <span key={label} className="record">
          <small>{label}</small>
          <b>{value ?? "–"}</b>
          <em>{when ?? ""}</em>
        </span>
      ))}
    </section>
  );
}

function Card({ icon, title, sub, className = "", badge, badgeBad, legend, children }) {
  return (
    <section className={`card ${className}`}>
      <header className="card-head">
        <div>
          <h2>
            <PixelIcon name={icon} />
            {title}
            {badge != null && <span className={badgeBad ? "badge badge-bad" : "badge"}>{badge}</span>}
          </h2>
          {sub && <p>{sub}</p>}
        </div>
        {legend && (
          <div className="legend">
            <span>
              <i style={{ background: SERIES.visitors }} />
              Visitors
            </span>
            <span>
              <i style={{ background: SERIES.views }} />
              Page views
            </span>
          </div>
        )}
      </header>
      {children}
    </section>
  );
}

function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([k, label]) => (
        <button key={k} type="button" role="tab" aria-selected={k === value} className={k === value ? "on" : ""} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  );
}

const Empty = ({ children = "Nothing yet" }) => <p className="empty">{children}</p>;

// a table whose first column has a bar behind it, scaled to the first number column
function BarTable({ rows, cols, name, barOf, limit = 10 }) {
  const [all, setAll] = useState(false);
  if (!rows.length) return <Empty />;
  const max = Math.max(1, ...rows.map(barOf));
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <>
      <table className="bt">
        <thead>
          <tr>
            <th />
            {cols.map(([h]) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i}>
              <td className="bt-name">
                <span className="bt-bar" style={{ width: `${(barOf(r) / max) * 100}%` }} />
                <span className="bt-text">{name(r)}</span>
              </td>
              {cols.map(([h, get]) => (
                <td key={h}>{get(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > limit && (
        <button type="button" className="more" onClick={() => setAll(!all)}>
          {all ? "Show less" : `Show all ${rows.length}`}
        </button>
      )}
    </>
  );
}

const Path = ({ p }) => <code className="path">{p}</code>;

// ---------- cards ----------

function Live({ rows, now }) {
  if (!rows.length) return <Empty>Nobody right now</Empty>;
  return (
    <ul className="live">
      {rows.map((r) => (
        <li key={r.v}>
          <i className="led" />
          <div>
            <Path p={r.p} />
            <small>
              {r.dv} · {r.br} on {r.os}
              {r.tz && ` · ${zoneName(r.tz).city}`}
              {r.r && ` · from ${r.r}`}
            </small>
          </div>
          <span className="live-time">
            {duration(now - r.since)}
            <small>{r.pages} pages</small>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Pages({ data }) {
  const [tab, setTab] = useState("all");
  return (
    <>
      <Tabs
        tabs={[
          ["all", "All pages"],
          ["entry", "Landing"],
          ["exit", "Exit"],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "all" && (
        <BarTable
          rows={data.pages}
          name={(r) => <Path p={r.path} />}
          barOf={(r) => r.visitors}
          cols={[
            ["Visitors", (r) => fmt(r.visitors)],
            ["Views", (r) => fmt(r.views)],
            ["Avg time", (r) => duration(r.avgTime)],
            ["Scrolled", (r) => pct(r.avgScroll)],
          ]}
        />
      )}
      {tab === "entry" && (
        <BarTable
          rows={data.entries}
          name={(r) => <Path p={r.path} />}
          barOf={(r) => r.entries}
          cols={[
            ["Landings", (r) => fmt(r.entries)],
            ["Bounce", (r) => pct(r.bounceRate)],
          ]}
        />
      )}
      {tab === "exit" && (
        <BarTable
          rows={data.exits}
          name={(r) => <Path p={r.path} />}
          barOf={(r) => r.exits}
          cols={[
            ["Exits", (r) => fmt(r.exits)],
            ["Exit rate", (r) => pct(r.exitRate)],
          ]}
        />
      )}
    </>
  );
}

function Clicks({ rows }) {
  const [tab, setTab] = useState("all");
  const shown = rows.filter((r) => tab === "all" || r.kind === tab);
  return (
    <>
      <Tabs
        tabs={[
          ["all", "All"],
          ["in", "On the site"],
          ["out", "Outbound"],
          ["btn", "Buttons"],
        ]}
        value={tab}
        onChange={setTab}
      />
      <BarTable
        rows={shown}
        barOf={(r) => r.visitors}
        name={(r) => (
          <>
            <span className={`kind kind-${r.kind}`}>{r.kind === "out" ? "↗" : r.kind === "btn" ? "●" : "→"}</span>
            <b className="click-label">{r.label}</b>
            {r.href && <span className="click-href">{r.href}</span>}
            <span className="click-on">on {r.on.join(", ")}</span>
          </>
        )}
        cols={[
          ["Visitors", (r) => fmt(r.visitors)],
          ["Clicks", (r) => fmt(r.count)],
        ]}
      />
    </>
  );
}

function Flows({ rows }) {
  if (!rows.length) return <Empty>Nobody has gone past one page yet</Empty>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ol className="flows">
      {rows.slice(0, 12).map((r, i) => (
        <li key={i}>
          <span className="flow-bar" style={{ width: `${(r.count / max) * 100}%` }} />
          <Path p={r.from} />
          <span className="flow-arrow">→</span>
          <Path p={r.to} />
          <span className="flow-n">{fmt(r.count)}</span>
        </li>
      ))}
    </ol>
  );
}

function Sources({ data }) {
  const [tab, setTab] = useState("ref");
  return (
    <>
      <Tabs
        tabs={[
          ["ref", "Sites"],
          ["url", "Exact links"],
          ["utm", "Campaigns"],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "ref" && (
        <BarTable rows={data.referrers} name={(r) => r.key} barOf={(r) => r.visitors} cols={[["Visitors", (r) => fmt(r.visitors)]]} limit={8} />
      )}
      {tab === "url" && (
        <BarTable rows={data.refUrls} name={(r) => <Path p={r.key} />} barOf={(r) => r.visitors} cols={[["Visitors", (r) => fmt(r.visitors)]]} limit={8} />
      )}
      {tab === "utm" &&
        (data.campaigns.length ? (
          <BarTable rows={data.campaigns} name={(r) => r.key} barOf={(r) => r.visitors} cols={[["Visitors", (r) => fmt(r.visitors)]]} limit={8} />
        ) : (
          <Empty>
            None yet. Share links like <code className="path">leviminton.com/?ref=discord</code> to see them here
          </Empty>
        ))}
    </>
  );
}

function Location({ data }) {
  const [tab, setTab] = useState("tz");
  return (
    <>
      <Tabs
        tabs={[
          ["tz", "Timezone"],
          ["lang", "Language"],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "tz" ? (
        <BarTable
          rows={data.zones}
          name={(r) => {
            const z = zoneName(r.key);
            return (
              <>
                {z.city} {z.region && <span className="dim">{z.region}</span>}
              </>
            );
          }}
          barOf={(r) => r.visitors}
          cols={[["Visitors", (r) => fmt(r.visitors)]]}
          limit={8}
        />
      ) : (
        <BarTable
          rows={data.langs}
          name={(r) => (
            <>
              {langName(r.key)} <span className="dim">{r.key}</span>
            </>
          )}
          barOf={(r) => r.visitors}
          cols={[["Visitors", (r) => fmt(r.visitors)]]}
          limit={8}
        />
      )}
    </>
  );
}

function Devices({ data }) {
  const [tab, setTab] = useState("br");
  const total = data.devices.reduce((a, r) => a + r.visitors, 0);
  const rows = { br: data.browsers, os: data.os }[tab];
  return (
    <>
      <SegmentBar rows={data.devices} colors={DEVICE_COLORS} total={total} />
      <Tabs
        tabs={[
          ["br", "Browser"],
          ["os", "System"],
        ]}
        value={tab}
        onChange={setTab}
      />
      <BarTable rows={rows} name={(r) => r.key} barOf={(r) => r.visitors} cols={[["Visitors", (r) => fmt(r.visitors)]]} limit={6} />
    </>
  );
}

function Speed({ data }) {
  const { perf } = data;
  if (!perf.n) return <Empty>No load timings yet</Empty>;
  const rating = perf.median < 1500 ? ["good", "Fast"] : perf.median < 3500 ? ["warn", "OK"] : ["bad", "Slow"];
  const slow = [...data.pages].filter((r) => r.load).sort((a, b) => b.load - a.load).slice(0, 5);
  return (
    <div className="speed">
      <div className="speed-figs">
        <div>
          <span className="fig">{ms(perf.median)}</span>
          <span className="fig-label">
            median load <span className={`status status-${rating[0]}`}>{rating[1]}</span>
          </span>
        </div>
        <div>
          <span className="fig">{ms(perf.p75)}</span>
          <span className="fig-label">75% load within</span>
        </div>
        <div>
          <span className="fig">{ms(perf.fcp)}</span>
          <span className="fig-label">first paint</span>
        </div>
      </div>
      <div className="speed-split">
        <div>
          <h3>By device</h3>
          {perf.byDevice.map((r) => (
            <div key={r.key} className="kv">
              <span>
                <i className="swatch" style={{ background: DEVICE_COLORS[r.key] }} />
                {r.key}
              </span>
              <b>{ms(r.median)}</b>
            </div>
          ))}
        </div>
        <div>
          <h3>Slowest landing pages</h3>
          {slow.map((r) => (
            <div key={r.path} className="kv">
              <Path p={r.path} />
              <b>{ms(r.load)}</b>
            </div>
          ))}
        </div>
      </div>
      <p className="note">From {fmt(perf.n)} first visits</p>
    </div>
  );
}

function Errors({ rows, now }) {
  if (!rows.length)
    return (
      <div className="all-clear">
        <span className="status status-good">✓ All clear</span>
        <p>No JavaScript errors in this range</p>
      </div>
    );
  return (
    <ul className="errors">
      {rows.map((r, i) => (
        <li key={i}>
          <span className="status status-bad">✕ {fmt(r.count)}×</span>
          <div>
            <code className="err-msg">{r.message}</code>
            <small>
              {r.src && `${r.src} · `}
              {r.pages.join(", ")} · {r.browsers.join(", ")} · {fmt(r.visitors)} visitor{r.visitors === 1 ? "" : "s"} · last {ago(r.last, now)}
            </small>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------- visit log ----------

function VisitLog({ rows }) {
  const [open, setOpen] = useState(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(25);

  const shown = rows.filter((s) => {
    if (filter === "engaged" && s.bounce) return false;
    if (filter === "bounced" && !s.bounce) return false;
    if (filter === "errors" && !s.errors) return false;
    if (!q) return true;
    const hay = `${s.v} ${s.r} ${s.ru} ${s.campaign} ${s.tz} ${s.br} ${s.os} ${s.dv} ${s.events.map((e) => `${e.p} ${e.l ?? ""}`).join(" ")}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div className="log">
      <div className="log-tools">
        <input type="search" placeholder="Search pages, clicks, sources, visitor id…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Tabs
          tabs={[
            ["all", "All"],
            ["engaged", "Engaged"],
            ["bounced", "Bounced"],
            ["errors", "Had errors"],
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>
      {!shown.length && <Empty>No visits match</Empty>}
      <ul className="visits">
        {shown.slice(0, limit).map((s) => {
          const isOpen = open === s.id;
          return (
            <li key={s.id} className={isOpen ? "visit visit-open" : "visit"}>
              <button type="button" className="visit-row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.id)}>
                <span className="caret">{isOpen ? "▾" : "▸"}</span>
                <span className="v-when">
                  {dateTime(s.start)}
                  <small>{duration(s.duration)}</small>
                </span>
                <span className="v-who">
                  <span className="dot" style={{ background: DEVICE_COLORS[s.dv] }} />
                  <b>#{s.v}</b>
                  <small>
                    {s.br} · {s.os}
                    {s.tz && ` · ${zoneName(s.tz).city}`}
                  </small>
                </span>
                <span className="v-from">{s.campaign || s.r || "direct"}</span>
                <span className="v-path">
                  {s.events
                    .filter((e) => e.t === "view")
                    .map((e) => e.p)
                    .slice(0, 4)
                    .join(" → ")}
                  {s.views > 4 && " → …"}
                </span>
                <span className="v-stats">
                  {s.views}
                  <small>views</small>
                  {s.clicks}
                  <small>clicks</small>
                  {s.errors > 0 && <span className="status status-bad">✕ {s.errors}</span>}
                </span>
              </button>
              {isOpen && <Replay s={s} />}
            </li>
          );
        })}
      </ul>
      {shown.length > limit && (
        <button type="button" className="more" onClick={() => setLimit(limit + 50)}>
          Show more ({shown.length - limit} left)
        </button>
      )}
    </div>
  );
}

function Replay({ s }) {
  const t0 = s.start;
  return (
    <div className="replay">
      <dl className="replay-facts">
        <div>
          <dt>Visitor</dt>
          <dd>#{s.v} (changes daily)</dd>
        </div>
        <div>
          <dt>Came from</dt>
          <dd>{s.ru || s.r || "Direct / unknown"}</dd>
        </div>
        {s.campaign && (
          <div>
            <dt>Campaign</dt>
            <dd>{s.campaign}</dd>
          </div>
        )}
        <div>
          <dt>Device</dt>
          <dd>
            {s.dv} · {s.br} on {s.os}
          </dd>
        </div>
        <div>
          <dt>Where</dt>
          <dd>
            {s.tz || "unknown timezone"}
            {s.lg && ` · ${langName(s.lg)}`}
          </dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>
            {time(s.start)} – {time(s.end)} · {duration(s.duration)}
          </dd>
        </div>
      </dl>
      <ol className="timeline">
        {s.events.map((e, i) => (
          <li key={i} className={`ev ev-${e.t}`}>
            <span className="ev-t" title={timeSec(e.ts)}>
              +{duration(e.ts - t0)}
            </span>
            <span className="ev-icon" aria-hidden="true">
              {e.t === "view" ? "◉" : e.t === "click" ? (e.k === "out" ? "↗" : "▸") : "✕"}
            </span>
            <span className="ev-body">
              {e.t === "view" && (
                <>
                  Opened <Path p={e.p} />
                  {(e.d != null || e.sd != null || e.lt) && (
                    <span className="ev-meta">
                      {e.d != null && `stayed ${duration(e.d)}`}
                      {e.sd != null && ` · scrolled ${e.sd}%`}
                      {e.lt && ` · loaded in ${ms(e.lt)}`}
                    </span>
                  )}
                </>
              )}
              {e.t === "click" && (
                <>
                  Clicked <b>{e.l}</b>
                  {e.h && <span className="ev-meta">{e.h}</span>}
                </>
              )}
              {e.t === "error" && (
                <>
                  Error <code className="err-msg">{e.m}</code>
                </>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
