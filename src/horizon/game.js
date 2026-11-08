// the little gd level on the horizon. everything is in "units": one cube = 1, ground is y 0

export const SPEED = 10.4; // gd normal speed, units/s
const GRAVITY = 100;
const JUMP_V = 21; // ~2.2 high, ~4.4 long. orbs use it too
const SPIN = 430; // deg/s in the air
export const SIM_DT = 1 / 240;

const SPIKE_PAD = 0.03; // so cubes never even graze a spike
const ORB_REACH = 1;
const STEP_UP = 0.35; // lips on the my stuff text this small get slid over, taller ones are walls

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function shuffle(list, r) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// rounds of structures back to back. each round has every structure once, shuffled
function buildLevel(length, seed, keepClear) {
  const r = rng(seed);
  const blocks = []; // { x, y0, w, h }, y0 > 0 = floating
  const spikes = []; // { x, base }
  const orbs = []; // { id, x, y }

  const spikeRow = (x, n, base = 0) => {
    for (let i = 0; i < n; i++) spikes.push({ x: x + i, base });
  };

  const structures = [
    { w: 1, place: (x) => spikeRow(x, 1) },
    { w: 2, place: (x) => spikeRow(x, 2) },
    { w: 3, place: (x) => spikeRow(x, 3) },
    { w: 5, place: (x) => blocks.push({ x, y0: 0, w: 5, h: 1 }) },
    {
      w: 8,
      place: (x) => {
        blocks.push({ x, y0: 0, w: 8, h: 1 });
        spikeRow(x + 5, 1, 1);
      },
    },
    {
      w: 9, // stairs
      place: (x) => {
        blocks.push({ x, y0: 0, w: 5, h: 1 });
        blocks.push({ x: x + 5, y0: 0, w: 4, h: 2 });
      },
    },
    {
      w: 13, // floating blocks over spikes
      place: (x) => {
        for (let i = 0; i < 3; i++) blocks.push({ x: x + i * 5, y0: 1, w: 3, h: 0.5 });
        spikeRow(x, 13);
      },
    },
    {
      w: 6, // orb over a spike row
      place: (x) => {
        spikeRow(x, 6);
        orbs.push({ id: orbs.length, x: x + 2.8, y: 2.3 });
      },
    },
  ];

  let x = 6;
  let round = [];
  let prev = null;
  for (;;) {
    if (round.length === 0) {
      round = shuffle(structures.slice(), r);
      if (round[0] === prev) round.push(round.shift());
    }
    // leave a run up before the label and a landing after. squeeze in something smaller if it fits
    let pick = 0;
    if (keepClear && x < keepClear[1] + 4) {
      pick = round.findIndex((s) => s.w <= keepClear[0] - 5 - x);
      if (pick < 0) {
        x = Math.ceil(keepClear[1] + 5);
        continue;
      }
    }
    const s = round.splice(pick, 1)[0];
    if (x + 19 > length) break; // room for a run up after wrapping around
    s.place(x);
    x += s.w + 6 + Math.floor(r() * 4);
    prev = s;
  }

  return { blocks, spikes, orbs, length };
}

const overlapsX = (x, b) => x + 1 > b.x + 0.02 && x < b.x + b.w - 0.02;

// height of the my stuff text under a cube, or null
export function surfaceAt(level, x) {
  const sf = level.surface;
  if (!sf) return null;
  const i0 = Math.max(0, Math.floor((x + 0.1 - sf.x0) * sf.res));
  const i1 = Math.min(sf.h.length, Math.ceil((x + 0.9 - sf.x0) * sf.res));
  let h = -1;
  for (let i = i0; i < i1; i++) if (sf.h[i] > h) h = sf.h[i];
  return h >= 0 ? h : null;
}

function supported(level, c) {
  if (c.y === 0 || c.onSurface) return true;
  return level.blocks.some((b) => overlapsX(c.x, b) && Math.abs(b.y0 + b.h - c.y) < 1e-6);
}

function hitsSpike(c, s) {
  const x0 = c.x - SPIKE_PAD, x1 = c.x + 1 + SPIKE_PAD;
  const lo = Math.max(x0, s.x), hi = Math.min(x1, s.x + 1);
  if (hi <= lo || c.y + 1 + SPIKE_PAD <= s.base) return false;
  // tallest bit of the triangle under the cube
  const peak = s.x + 0.5;
  const u = lo <= peak && hi >= peak ? 0.5 : Math.abs(peak - lo) < Math.abs(peak - hi) ? lo - s.x : hi - s.x;
  return c.y - SPIKE_PAD < s.base + 2 * Math.min(u, 1 - u);
}

function hitsBlockSide(c, b) {
  return c.x + 0.95 > b.x && c.x + 0.05 < b.x + b.w && c.y + 0.95 > b.y0 && c.y + 0.05 < b.y0 + b.h;
}

// moves a cube by dt, returns true if it died
function advance(level, c, dt) {
  const prevY = c.y;
  c.x += SPEED * dt;

  const sh = surfaceAt(level, c.x);
  if (c.grounded) {
    if (c.onSurface) {
      if (sh === null) {
        c.onSurface = false;
        c.grounded = false;
      } else c.y = sh;
    } else if (sh !== null && sh > c.y) {
      if (sh - c.y > STEP_UP) return true;
      c.y = sh;
      c.onSurface = true;
    }
  }

  if (c.grounded && !supported(level, c)) c.grounded = false;

  if (!c.grounded) {
    c.vy -= GRAVITY * dt;
    c.y += c.vy * dt;
    c.rot += SPIN * dt;

    if (c.vy <= 0) {
      let land = c.y <= 0 ? 0 : null;
      for (const b of level.blocks) {
        const top = b.y0 + b.h;
        if (overlapsX(c.x, b) && top <= prevY + 1e-6 && top >= c.y) land = Math.max(land ?? top, top);
      }
      let onSurface = false;
      if (sh !== null && c.y <= sh && prevY >= sh - STEP_UP && (land === null || sh >= land)) {
        land = sh;
        onSurface = true;
      }
      if (land !== null) {
        c.y = land;
        c.vy = 0;
        c.grounded = true;
        c.onSurface = onSurface;
        c.rot = Math.round(c.rot / 90) * 90; // land flat like gd
        c.used = new Set();
      }
    }

    for (const o of level.orbs) {
      if (c.used.has(o.id)) continue;
      const dx = c.x + 0.5 - o.x, dy = c.y + 0.5 - o.y;
      if (dx * dx + dy * dy < ORB_REACH * ORB_REACH) {
        c.vy = JUMP_V;
        c.grounded = false;
        c.used.add(o.id);
      }
    }
  }

  return level.spikes.some((s) => hitsSpike(c, s)) || level.blocks.some((b) => hitsBlockSide(c, b));
}

const clone = (c) => ({ ...c, used: new Set(c.used) });

// walk `delay` units, jump, and see if it lands alive
function survivesJump(level, c, delay) {
  const s = clone(c);
  let moved = 0;
  let jumped = false;
  while (moved < delay + 12) {
    if (!jumped && moved >= delay && s.grounded) {
      s.vy = JUMP_V;
      s.grounded = false;
      jumped = true;
    }
    if (advance(level, s, SIM_DT)) return false;
    moved += SPEED * SIM_DT;
    if (jumped && s.grounded && moved > delay + 0.3) return true;
  }
  return true;
}

// if something deadly is coming up, find every take off spot that clears it and jump in the
// middle of that window (like a player would, instead of on the last frame). null = nothing ahead
function planJump(level, c) {
  const s = clone(c);
  let hit = null;
  for (let d = 0; d < 7; d += SPEED * SIM_DT) {
    if (advance(level, s, SIM_DT)) {
      hit = d;
      break;
    }
  }
  if (hit === null) return null;

  let hi = null, lo = null;
  for (let d = Math.max(0, hit - 0.04); d >= 0; d -= 0.04) {
    if (survivesJump(level, c, d)) {
      hi ??= d;
      lo = d;
    } else if (hi !== null) break;
  }
  return hi === null ? c.x : c.x + (lo + hi) / 2;
}

export function makeCube(x) {
  return { x, y: 0, vy: 0, rot: 0, grounded: true, onSurface: false, used: new Set(), planX: null, checkAt: 0 };
}

function tick(level, c, dt) {
  if (c.grounded) {
    // planning is heavy, only look every half unit
    if (c.planX === null && c.x >= c.checkAt) {
      c.planX = planJump(level, c);
      c.checkAt = c.x + 0.5;
    }
    if (c.planX !== null && c.x >= c.planX) {
      c.vy = JUMP_V;
      c.grounded = false;
      c.planX = null;
    }
  } else c.planX = null;
  return advance(level, c, dt);
}

export function update(level, c, dt) {
  tick(level, c, dt);
  if (c.x > level.length) {
    c.x -= level.length;
    c.checkAt = 0;
    if (c.planX !== null) c.planX -= level.length;
  }
}

function playable(level) {
  const c = makeCube(1);
  for (let moved = 0; moved < level.length - 2; moved += SPEED * SIM_DT) {
    if (tick(level, c, SIM_DT)) return false;
  }
  return true;
}

// first seed whose level a test cube can beat
export function generate(length, surface) {
  let keepClear = null;
  if (surface) {
    const ink = [...surface.h.keys()].filter((i) => surface.h[i] >= 0);
    keepClear = [surface.x0 + ink[0] / surface.res, surface.x0 + (ink.at(-1) + 1) / surface.res];
  }
  for (let seed = 2026; seed < 2046; seed++) {
    const level = buildLevel(length, seed, keepClear);
    level.surface = surface;
    if (playable(level)) return level;
  }
  return { blocks: [], spikes: [], orbs: [], surface, length };
}
