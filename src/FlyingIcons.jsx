import { useEffect, useRef } from "react";
import shipImg from "./assets/gd/ship.png";
import ballImg from "./assets/gd/ball.png";
import ufoDomeImg from "./assets/gd/ufo_dome.png";
import ufoBodyImg from "./assets/gd/ufo_body.png";
import waveImg from "./assets/gd/wave.png";
import swingImg from "./assets/gd/swing.png";
import cubeImg from "./assets/my_cube.png";
import fireImg from "./assets/gd/fireBoost.png";
import streakImg from "./assets/gd/streak_03.png";

// every few seconds one of my icons flies across the sky the way it does in gd 2.2.
// physics, trails, particles and vehicle layouts are ported from gd 2.2081 (windows): numbers come
// from the decomp in ~/Documents/gd-pathfinder/notes and the constants in gd22.exe, so they're
// in gd units (one block = 30) and run at gd's 240 steps per second.

const MAIN = [16, 236, 0]; // color 1
const SECONDARY = [61, 155, 0]; // color 2, tints the regular trail
const rgb = ([r, g, b], a = 1) => `rgba(${r},${g},${b},${a})`;

const STEP = 1 / 240;
const X_STEP = 1.29825; // 0.9 * 5.77 * 0.25, normal speed
const JDT = 0.225; // dt * 0.9, what updateJump and the y integration use
const G = 0.958199024; // fly / ball gravity
const FALLING = G + G; // playerIsFallingBugged: "not rising faster than 2g"

// images are uhd renders: 120px = one block = 30 units. the renders are cropped to their pixels, so
// ox/oy is where the crop's center sits from gd's sprite anchor (uhd px, y up), worked out from the
// layer offsets in Resources/icons/<icon>-uhd.plist
const IMG = {
  ship: { src: shipImg, w: 189, h: 105, ox: 9, oy: -7 },
  ball: { src: ballImg, w: 152, h: 152 },
  ufoDome: { src: ufoDomeImg, w: 160, h: 137, oy: 28 },
  ufoBody: { src: ufoBodyImg, w: 160, h: 137, oy: 28 },
  wave: { src: waveImg, w: 96, h: 74 },
  swing: { src: swingImg, w: 171, h: 154, ox: -2 },
  cube: { src: cubeImg, w: 128, h: 128 },
  fire: { src: fireImg, w: 48, h: 64 },
};
const MODES = ["ship", "ball", "ufo", "wave", "swing"];

// particle systems, from the .plist files plus PlayerObject::init's overrides
// (angles in cocos degrees, 0 = right, 90 = up; colors rgb 0-1; gravity y up)
const DRAG = { max: 30, life: 0.3, lifeVar: 0.15, size: 4, sizeVar: 3, speed: 75, speedVar: 20, angle: 90, angleVar: 45, gx: 0, gy: -300, posVarX: 1, posVarY: 5 };
const TRAILING = { ...DRAG, speed: 75 * 0.2, speedVar: 20 * 0.2, posVarX: 0, posVarY: 2, from: [1, 0.392, 0], to: [1, 0, 0] };
const SHIP_CLICK = { ...DRAG, speed: 150, speedVar: 40, angleVar: 90, size: 6, sizeVar: 4.5, posVarX: 0, posVarY: 2, from: [1, 0.745, 0], to: [1, 0, 0] };
const GROUND = { ...DRAG, from: MAIN.map((c) => c / 255), to: [0, 0, 0] };
const SWING_BURST = { max: 10, life: 0.14, lifeVar: 0.04, size: 4, sizeVar: 2, speed: 200, speedVar: 50, angle: 0, angleVar: 10, gx: 0, gy: 0, posVarX: 2, posVarY: 2, from: [1, 0.392, 0], to: [1, 0, 0] };

// where things sit on each vehicle, cocos units relative to the player (y up)
const SHIP_ICON = { x: 0, y: 5, scale: 0.55 }; // toggleFlyMode
const SHIP_SPRITE_Y = -5;
const UFO_ICON = { x: 0, y: 5, scale: 0.55 }; // toggleBirdMode
const UFO_SPRITE_Y = -7;
const SHIP_EMITTER = { x: -12, y: SHIP_SPRITE_Y - 4 }; // setPosition
const UFO_EMITTER = { x: 0, y: UFO_SPRITE_Y - 3 };
const SWING_EMITTER = { x: -10, y: 0 };
const SWING_FIRES = {
  middle: { x: -14, y: 0, rot: 90, size: 0.8 * 1.2 },
  bottom: { x: -9.5, y: -10, rot: 45, size: 0.6 * 1.2 },
  top: { x: -9.5, y: 10, rot: 135, size: 0.6 * 1.2 },
};

// updateShipRotation 0x140390c40: every step the icon slerps towards the direction it just moved by
// factor * 0.25 (dt). the ufo aims at -0.4x that direction, so it tilts gently against its motion,
// and never more than 0.1 rad nose-down
const ROT_FACTOR = { wave: 0.25, ship: 0.15, swing: 0.15, ufo: 0.07 };

// where the regular trail is attached (setPosition 0x14039c640): ship at its particle emitter plus
// 4 units forward, swing at its emitter, ufo under the sprite
const SHIP_TRAIL_FORWARD = 4;

// regular trail 3: CCMotionStreak(fade 0.3, minSeg 5, stroke 8.5, streak_03_001.png), additive
const TRAIL_FADE = 0.3;
const TRAIL_MIN_SEG = 5;
const TRAIL_STROKE = 8.5;
// wave trail: HardStreak::updateStroke, a color quad of width 6 * pulse and a white one of 2 * pulse at
// 65% opacity, additive. pulse follows the music in gd, no music here so 1
const WAVE_OUTER = 6;
const WAVE_CORE = 2;

// the canvas reaches this far below the horizon so explosions there aren't cut off (Home.css .flyers)
const BELOW = 180;

// ball vs the cube sun: the ball's hitbox is 30 units, the cube's body is 120/128 of its image.
// when the ball reaches the cube it checks how the cube is turned: within 22.5 degrees of a diamond
// it's a slope and the ball rides up it (never steeper than 45 degrees), otherwise the cube is on its
// side, a wall, and the ball dies
const BALL_R = 15;
const CUBE_BODY = 120 / 128;
const DIAGONAL_RANGE = 22.5;

// playDeathEffect 0x14037ef10, the default effect: explodeEffect.plist all at once, starting in color 1;
// a filled CCCircleWave in color 1 from 10 to 90 units (x0.9) over 0.5s; and ExplodeItemNode, the icon
// cut into a 2-4 x 2-4 grid of pieces that fly off, fall, bounce on the floor and fade
const EXPLODE = { burst: 100, life: 0, lifeVar: 0.8, size: 10, sizeVar: 5, speed: 250, speedVar: 150, angle: 0, angleVar: 360, gx: 0, gy: 0, posVarX: 10, posVarY: 10, from: MAIN.map((c) => c / 255), to: [0, 0, 0] };
const SHATTER_X = 0.9 * 5.77 * 0.9 * 0.8; // playerSpeed * speedMultiplier * 0.9 * 0.8
const SHATTER = { xVel: SHATTER_X * 0.5, xVar: SHATTER_X, yVel: 6, yVar: 3, life: 1.4, fade: 0.5 };

const rand = (a, b) => a + Math.random() * (b - a);
const vary = (v, by) => v + (Math.random() * 2 - 1) * by;

export default function FlyingIcons() {
  const ref = useRef(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const img = {};
    for (const [k, m] of Object.entries(IMG)) {
      img[k] = new Image();
      img[k].src = m.src;
    }

    // streak_03 tinted with color 2, turned so its cross-section runs down a 1px column
    const streak = document.createElement("canvas");
    const streakTex = new Image();
    streakTex.onload = () => {
      streak.width = 1;
      streak.height = streakTex.height;
      const s = streak.getContext("2d");
      s.translate(1, 0);
      s.rotate(Math.PI / 2);
      s.drawImage(streakTex, 0, 0);
      s.globalCompositeOperation = "source-in";
      s.fillStyle = rgb(SECONDARY);
      s.fillRect(-100, -100, 300, 300);
    };
    streakTex.src = streakImg;

    const forced = import.meta.env.DEV ? new URLSearchParams(location.search).get("fly") : null;

    let W = 0;
    let H = 0; // the horizon
    let CH = 0; // canvas height
    let k = 1; // px per gd unit

    // the horizon is wherever the cube sun's center is on screen, so the icons can't drift off it
    function horizonY() {
      const el = document.querySelector(".sun-cube img");
      const cr = canvas.getBoundingClientRect();
      if (!el) return cr.height - BELOW;
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2 - cr.top;
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width;
      CH = r.height;
      H = horizonY();
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(CH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      k = Math.min(40, Math.max(24, W * 0.024)) / 30;
    }

    let p = null; // the player
    let systems = []; // particle emitters, kept until their particles die
    let lastMode = "";
    let timer = 0;
    let raf = 0;
    let last = 0;
    let acc = 0;
    let explosions = [];

    const emitter = (cfg) => {
      const e = { cfg, on: true, carry: 0, x: 0, y: 0, parts: [], burst: cfg.burst ?? 0 };
      systems.push(e);
      return e;
    };

    function spawn() {
      const kinds = MODES.filter((m) => m !== lastMode);
      const mode = MODES.includes(forced) ? forced : kinds[Math.floor(Math.random() * kinds.length)];
      lastMode = mode;
      const top = H * 0.12;
      const bottom = H - 3 * 30 * k;
      p = {
        mode,
        x: -60 * k,
        y: mode === "ball" ? H - BALL_R * k : rand(top + 30 * k, Math.max(top + 30 * k, bottom - 30 * k)),
        feet: H, // ball: where it touches the ground
        onSurface: true,
        climb: 0,
        cube: null,
        cubePts: [],
        cubeAngle: 0,
        onCube: false,
        v: 0, // gd m_yVelocity, y up
        sign: 1, // gravity, -1 upside down (swing)
        hold: false,
        target: 0,
        retarget: 0,
        sinceClick: 1,
        top,
        bottom,
        rot: 0,
        tx: 0,
        ty: 0,
        trail: [], // regular trail points {x, y, t}
        wave: [], // wave trail points
        age: 0,
        done: 0,
        fireOn: "top",
        fireT: 0,
      };
      p.tx = p.x;
      p.ty = p.y;
      p.target = p.y;
      p.emitters = {};
      if (mode === "ship") {
        p.emitters.trailing = emitter(TRAILING);
        p.emitters.click = emitter(SHIP_CLICK);
      } else if (mode === "ufo") p.emitters.trailing = emitter(TRAILING);
      else if (mode === "swing") {
        p.emitters.trailing = emitter(TRAILING);
        p.emitters.burstTop = emitter(SWING_BURST);
        p.emitters.burstBottom = emitter(SWING_BURST);
      } else if (mode === "ball") p.emitters.ground = emitter(GROUND);
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }

    function schedule(delay) {
      clearTimeout(timer);
      timer = setTimeout(spawn, delay);
    }

    // a fake player steering towards a target height that keeps changing
    function decide(dt) {
      p.retarget -= dt;
      p.sinceClick += dt;
      if (p.retarget <= 0) {
        p.target = rand(p.top + 30 * k, p.bottom);
        p.retarget = rand(0.5, 1.4);
      }
      const below = p.y > p.target; // canvas y grows downwards
      const band = 18 * k;
      if (p.mode === "ship" || p.mode === "wave") {
        if (p.hold && p.y < p.target - band) p.hold = false;
        else if (!p.hold && p.y > p.target + band) p.hold = true;
      } else if (p.mode === "ufo") {
        if (below && p.v < 1 && p.sinceClick > 0.12) click();
      } else if (p.mode === "swing") {
        const pulledDown = p.sign > 0;
        if (p.sinceClick > 0.15 && ((pulledDown && p.y > p.target + band * 0.5) || (!pulledDown && p.y < p.target - band * 0.5))) click();
      }
    }

    function click() {
      p.sinceClick = 0;
      if (p.mode === "ufo") {
        // updateJump bird: only when slower than the click velocity
        if (p.v < 7) p.v = 7;
      } else if (p.mode === "swing") {
        // flipGravity, then v = 0.8 x the velocity before the flip: it keeps going the same way
        const before = p.v;
        p.sign = -p.sign;
        p.v = before * 0.8;
        p.fireOn = p.sign > 0 ? "top" : "bottom"; // updateSwingFire
        p.fireT = 0;
      }
    }

    // the cube sun as a square, read from the page: its spot, size and current spin
    function readCube() {
      const el = document.querySelector(".sun-cube img");
      if (!el) return null;
      const cr = canvas.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2 - cr.left;
      const cy = r.top + r.height / 2 - cr.top;
      const half = (el.offsetWidth * CUBE_BODY) / 2;
      const tf = getComputedStyle(el).transform;
      const mm = /matrix\(([^,]+),\s*([^,]+)/.exec(tf);
      const th = mm ? Math.atan2(parseFloat(mm[2]), parseFloat(mm[1])) : 0;
      p.cubeAngle = th;
      const c = Math.cos(th);
      const sn = Math.sin(th);
      return [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([a, b]) => [cx + a * half * c - b * half * sn, cy + a * half * sn + b * half * c]);
    }

    // points along the cube's outline, refreshed with the cube every frame
    function cubePoints() {
      const q = p.cube;
      if (!q) return [];
      const pts = [];
      for (let i = 0; i < 4; i++) {
        const [x1, y1] = q[i];
        const [x2, y2] = q[(i + 1) % 4];
        const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 1.5));
        for (let j = 0; j < n; j++) pts.push([x1 + ((x2 - x1) * j) / n, y1 + ((y2 - y1) * j) / n]);
      }
      return pts;
    }

    // the highest the ball's center can sit at x without overlapping the floor or the cube,
    // and the cube point holding it there
    function support(x, r) {
      let best = H - r;
      let at = null;
      for (const [px, py] of p.cubePts) {
        const dx = px - x;
        if (dx <= -r || dx >= r || py > H + 0.5) continue;
        const cy = py - Math.sqrt(r * r - dx * dx);
        if (cy < best) {
          best = cy;
          at = [px, py];
        }
      }
      return [best, at];
    }

    // how far the cube is from sitting like a diamond, in degrees (0 = diamond, 45 = flat on a side)
    function offDiagonal() {
      const deg = ((((p.cubeAngle * 180) / Math.PI) % 90) + 90) % 90;
      return Math.abs(deg - 45);
    }

    // rolls on the horizon and over the cube
    function ballStep() {
      const r = BALL_R * k;
      const [top, at] = support(p.x, r);
      if (top < p.y - 0.01) {
        // touching the cube from the side: a slope if it's turned like a diamond, a wall if not
        if (at && !p.onCube) {
          if (offDiagonal() > DIAGONAL_RANGE) {
            die();
            return;
          }
          p.onCube = true;
        }
        const rise = Math.min(p.y - top, X_STEP * k); // ride up at 45 degrees at most
        if (p.onSurface) p.climb = rise / k / JDT;
        p.y -= rise;
        if (!p.onSurface) {
          p.onSurface = true;
          p.v = 0;
        }
      } else if (p.onSurface) {
        if (top > p.y + 0.5) {
          // off an edge: keeps the speed the slope gave it, then falls
          p.onSurface = false;
          p.v = p.climb;
        } else {
          p.y = top;
          p.climb = 0;
        }
      } else {
        // updateJump ball gravity: 0.6 x the fly gravity, terminal 15
        p.v = Math.max(-15, p.v - JDT * G * 0.6);
        p.y -= JDT * p.v * k;
        if (p.y >= top) {
          p.y = top;
          p.onSurface = true;
          p.v = 0;
          p.climb = 0;
        }
      }
      if (!at && top >= H - r - 0.5) p.onCube = false;
      p.feet = p.y + r;
      p.rot += (X_STEP * k) / r;
    }

    function die() {
      p.dead = true;
      p.done = p.age;
      for (const e of Object.values(p.emitters)) e.on = false;
      const e = emitter(EXPLODE);
      e.x = p.x;
      e.y = p.y;

      // render the icon as it looks right now, then cut it into a grid
      const m = IMG.ball;
      const size = Math.ceil((m.w / 4) * k * 1.42);
      const tex = document.createElement("canvas");
      tex.width = tex.height = size;
      const t = tex.getContext("2d");
      t.translate(size / 2, size / 2);
      t.rotate(p.rot);
      const w = (m.w / 4) * k;
      if (img.ball.complete) t.drawImage(img.ball, -w / 2, -w / 2, w, w);
      const cx = 2 + Math.floor(Math.random() * 3);
      const cy = 2 + Math.floor(Math.random() * 3);
      const pieces = [];
      for (let i = 0; i < cx; i++) {
        for (let j = 0; j < cy; j++) {
          const sw = size / cx;
          const sh = size / cy;
          pieces.push({
            sx: i * sw,
            sy: j * sh,
            sw,
            sh,
            x: p.x - size / 2 + (i + 0.5) * sw,
            y: p.y - size / 2 + (j + 0.5) * sh,
            vx: vary(SHATTER.xVel, SHATTER.xVar),
            vy: vary(SHATTER.yVel, SHATTER.yVar),
            rot: 0,
            spin: vary(0, 6),
            t: SHATTER.life,
          });
        }
      }
      explosions.push({ x: p.x, y: p.y, t: 0, tex, pieces });
    }

    function drawExplosions(dt) {
      const f = dt * 54; // ExplodeItemNode::update works in these ticks
      explosions = explosions.filter((x) => {
        x.t += dt;
        // CCCircleWave, eased out, fading
        const c = Math.min(1, x.t / 0.5);
        if (c < 1) {
          const rr = (9 + 72 * (1 - (1 - c) * (1 - c))) * k;
          ctx.fillStyle = rgb(MAIN, 1 - c);
          ctx.beginPath();
          ctx.arc(x.x, x.y, rr, 0, Math.PI * 2);
          ctx.fill();
        }
        let alive = c < 1;
        for (const q of x.pieces) {
          q.t -= dt;
          if (q.t <= 0) continue;
          alive = true;
          q.vy -= 0.5 * f;
          q.vx *= 0.98 + 0.02 * (1 - f);
          q.x += q.vx * f * k;
          q.y -= q.vy * f * k;
          q.rot += q.spin * f;
          const half = (Math.min(q.sw, q.sh) / 2) * 0.5;
          if (q.y + half > H && q.vy < 0) {
            q.y = H - half;
            q.vy *= -0.8; // bounce off the floor
            if (q.vy < 1.5) q.vy = 0;
          }
          ctx.save();
          ctx.globalAlpha = Math.min(1, q.t / SHATTER.fade);
          ctx.translate(q.x, q.y);
          ctx.rotate((q.rot * Math.PI) / 180);
          ctx.drawImage(x.tex, q.sx, q.sy, q.sw, q.sh, -q.sw / 2, -q.sh / 2, q.sw, q.sh);
          ctx.restore();
        }
        return alive;
      });
    }

    function wrapAngle(a) {
      return Math.atan2(Math.sin(a), Math.cos(a));
    }

    function stepRotation(dx, dy) {
      const f = ROT_FACTOR[p.mode];
      if (!f) return;
      let target = Math.atan2(dy, dx);
      if (p.mode === "ufo") target = Math.max(-0.1, target * -0.4);
      p.rot += wrapAngle(target - p.rot) * f * 0.25;
    }

    // PlayerObject::update + updateJump for one 1/240 s step
    function physicsStep() {
      const x0 = p.x;
      const y0 = p.y;
      physicsMove();
      stepRotation(p.x - x0, p.y - y0);
    }

    function physicsMove() {
      p.x += X_STEP * k;
      if (p.mode === "ship") {
        const fallingBugged = p.v < FALLING;
        let kk = p.hold ? -1 : 0.8;
        if (!p.hold && !fallingBugged) kk = 1.2;
        const c = p.hold && fallingBugged ? 0.5 : 0.4;
        p.v -= JDT * G * kk * c;
        p.v = Math.max(-6.4, Math.min(8, p.v));
        p.y -= JDT * p.v * k;
      } else if (p.mode === "ufo") {
        const kk = p.v < FALLING ? 0.8 : 1.2;
        p.v -= JDT * G * kk * 0.5;
        p.v = Math.max(-6.4, Math.min(8, p.v));
        p.y -= JDT * p.v * k;
      } else if (p.mode === "swing") {
        p.v -= p.sign * JDT * G * 0.4;
        p.v = Math.max(-8, Math.min(8, p.v));
        p.y -= JDT * p.v * k;
      } else if (p.mode === "wave") {
        // exact 45 degrees, no velocity
        const dy = X_STEP * (p.hold ? 1 : -1);
        const turned = p.wave.length && p.wave.at(-1).hold !== p.hold;
        p.y -= dy * k;
        if (!p.wave.length || turned) p.wave.push({ x: p.x, y: p.y, hold: p.hold });
      } else if (p.mode === "ball") ballStep();
    }

    // local cocos offset (y up, gd units) -> canvas point, rotated with the player
    function local(lx, ly) {
      const x = lx * k;
      const y = -ly * k;
      const c = Math.cos(p.rot);
      const s = Math.sin(p.rot);
      return [p.x + x * c - y * s, p.y + x * s + y * c];
    }

    function emit(e, dt) {
      const c = e.cfg;
      if (!e.on) return;
      let n = e.carry + (c.burst ? e.burst : (c.max / c.life) * dt);
      if (c.burst) {
        e.burst = 0;
        e.on = false;
      }
      while (n >= 1) {
        n--;
        if (e.parts.length >= (c.max ?? c.burst)) continue;
        const life = vary(c.life, c.lifeVar);
        if (life <= 0) continue;
        const a = (vary(c.angle, c.angleVar) * Math.PI) / 180;
        const sp = vary(c.speed, c.speedVar) * k;
        e.parts.push({
          x: e.x + vary(0, c.posVarX) * k,
          y: e.y + vary(0, c.posVarY) * k,
          vx: Math.cos(a) * sp,
          vy: -Math.sin(a) * sp,
          size: Math.max(0, vary(c.size, c.sizeVar)) * k,
          life,
          a0: c.alphaVar ? Math.random() : 1,
          a1: c.alphaVar ? Math.random() : 1,
          t: 0,
        });
      }
      e.carry = n;
    }

    function update(dt) {
      p.age += dt;
      if (p.mode === "ball") {
        p.cube = readCube();
        p.cubePts = cubePoints();
      }
      decide(dt);
      acc += dt;
      while (acc >= STEP && !p.dead) {
        acc -= STEP;
        physicsStep();
      }
      if (p.dead) return;

      // trail anchor, then a point every 5 units like CCMotionStreak's minSeg
      if (p.mode === "ship" || p.mode === "ufo" || p.mode === "swing") {
        if (p.mode === "ship") {
          [p.tx, p.ty] = local(SHIP_EMITTER.x, SHIP_EMITTER.y);
          p.tx += SHIP_TRAIL_FORWARD * k;
        } else if (p.mode === "ufo") [p.tx, p.ty] = local(UFO_EMITTER.x, UFO_EMITTER.y);
        else [p.tx, p.ty] = local(SWING_EMITTER.x, SWING_EMITTER.y);
        const lastPt = p.trail.at(-1);
        if (!lastPt || Math.hypot(p.tx - lastPt.x, p.ty - lastPt.y) >= TRAIL_MIN_SEG * k) p.trail.push({ x: p.tx, y: p.ty, t: p.age });
        while (p.trail.length && p.age - p.trail[0].t > TRAIL_FADE) p.trail.shift();
      }

      const em = p.emitters;
      if (p.mode === "ship") {
        [em.trailing.x, em.trailing.y] = local(SHIP_EMITTER.x, SHIP_EMITTER.y);
        em.click.x = em.trailing.x;
        em.click.y = em.trailing.y;
        em.click.on = p.hold; // update: ship click particles only while holding
      } else if (p.mode === "ufo") {
        [em.trailing.x, em.trailing.y] = local(UFO_EMITTER.x, UFO_EMITTER.y);
      } else if (p.mode === "swing") {
        [em.trailing.x, em.trailing.y] = local(SWING_EMITTER.x, SWING_EMITTER.y);
        [em.burstTop.x, em.burstTop.y] = local(SWING_FIRES.top.x, SWING_FIRES.top.y);
        [em.burstBottom.x, em.burstBottom.y] = local(SWING_FIRES.bottom.x, SWING_FIRES.bottom.y);
        em.burstTop.on = p.fireOn === "top";
        em.burstBottom.on = p.fireOn === "bottom";
        p.fireT += dt;
      } else if (p.mode === "ball") {
        em.ground.x = p.x;
        em.ground.y = p.feet;
        em.ground.on = p.onSurface;
      }
    }

    function stepParticles(dt) {
      for (const e of systems) {
        emit(e, dt);
        const c = e.cfg;
        e.parts = e.parts.filter((q) => {
          q.t += dt;
          if (q.t >= q.life) return false;
          q.vx += c.gx * k * dt;
          q.vy -= c.gy * k * dt;
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          return true;
        });
      }
      systems = systems.filter((e) => e.on || e.parts.length);
    }

    function drawParticles() {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const e of systems) {
        const c = e.cfg;
        for (const q of e.parts) {
          const f = q.t / q.life;
          const col = c.from.map((v, i) => Math.round((v + (c.to[i] - v) * f) * 255));
          const s = q.size * (1 - f);
          ctx.fillStyle = rgb(col, q.a0 + (q.a1 - q.a0) * f);
          ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
        }
      }
      ctx.restore();
    }

    function drawRegularTrail() {
      const pts = [...p.trail, { x: p.tx, y: p.ty, t: p.age }];
      if (pts.length < 2 || !streak.width) return;
      const w = TRAIL_STROKE * k;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < 0.01) continue;
        // CCMotionStreak fades each vertex's opacity linearly over the fade time
        ctx.globalAlpha = Math.max(0, 1 - (p.age - (a.t + b.t) / 2) / TRAIL_FADE);
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
        ctx.drawImage(streak, 0, -w / 2, len + 0.6, w);
        ctx.restore();
      }
      ctx.restore();
    }

    function drawWaveTrail(alpha) {
      const pts = [...p.wave, { x: p.x, y: p.y }];
      if (pts.length < 2) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineJoin = "miter";
      ctx.lineCap = "butt";
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (const q of pts.slice(1)) ctx.lineTo(q.x, q.y);
      };
      path();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = rgb(MAIN);
      ctx.lineWidth = WAVE_OUTER * 2 * k;
      ctx.stroke();
      path();
      ctx.globalAlpha = alpha * 0.65;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = WAVE_CORE * 2 * k;
      ctx.stroke();
      ctx.restore();
    }

    function sprite(name, cx, cy, scale = 1, rot = 0, sx = 1, sy = 1, anchorY = 0.5) {
      const m = IMG[name];
      const im = img[name];
      if (!im.complete || !im.naturalWidth) return;
      const w = (m.w / 4) * k * scale * sx;
      const h = (m.h / 4) * k * scale * sy;
      const ox = ((m.ox ?? 0) / 4) * k * scale;
      const oy = (-(m.oy ?? 0) / 4) * k * scale;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.drawImage(im, ox - w / 2, oy - h * anchorY, w, h);
      ctx.restore();
    }

    // PlayerFireBoostSprite::loopFireAnimation: 0.06s to 1.2x, 0.06s to (0.6x, 1.5x), forever.
    // updateSwingFire shrinks the side that turned off to 0.01 over 0.4s
    function fireScale(t, active) {
      if (!active) {
        const s = Math.max(0.01, 1.2 * (1 - t / 0.4));
        return [s, s];
      }
      return Math.floor(t / 0.06) % 2 === 0 ? [1.2, 1.2] : [0.6, 1.5];
    }

    function drawPlayer() {
      const [ix, iy] = [p.x, p.y];
      if (p.mode === "ship") {
        const [cx, cy] = local(SHIP_ICON.x, SHIP_ICON.y);
        sprite("cube", cx, cy, SHIP_ICON.scale, p.rot);
        const [sx, sy] = local(0, SHIP_SPRITE_Y);
        sprite("ship", sx, sy, 1, p.rot);
      } else if (p.mode === "ufo") {
        const [ux, uy] = local(0, UFO_SPRITE_Y);
        sprite("ufoDome", ux, uy, 1, p.rot);
        const [cx, cy] = local(UFO_ICON.x, UFO_ICON.y);
        sprite("cube", cx, cy, UFO_ICON.scale, p.rot);
        sprite("ufoBody", ux, uy, 1, p.rot);
      } else if (p.mode === "swing") {
        for (const [name, f] of Object.entries(SWING_FIRES)) {
          const active = name === "middle" || name === p.fireOn;
          const [fsx, fsy] = fireScale(name === "middle" ? p.age : p.fireT, active);
          const [fx, fy] = local(f.x, f.y);
          // the fire's wide end sits on the swing and the point sticks out
          sprite("fire", fx, fy, f.size, p.rot + (f.rot * Math.PI) / 180, fsx, fsy, 0);
        }
        sprite("swing", ix, iy, 1, p.rot);
      } else sprite(p.mode, ix, iy, 1, p.rot);
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      H = horizonY();
      ctx.clearRect(0, 0, W, CH);

      if (p && !p.done) {
        update(dt);
        if (p.x > W + 60 * k) {
          p.done = p.age;
          for (const e of Object.values(p.emitters)) e.on = false;
        }
      }
      stepParticles(dt);

      if (p) {
        if (p.mode === "wave") drawWaveTrail(p.done ? Math.max(0, 1 - (p.age - p.done) / 0.4) : 1);
        else drawRegularTrail();
      }
      drawParticles();
      if (p && !p.done) drawPlayer();
      drawExplosions(dt);

      if (p && p.done) {
        p.age += dt;
        if (p.age - p.done > (p.dead ? 1.5 : 0.45)) {
          p = null;
          schedule(forced ? 600 : rand(4000, 9000));
        }
      }

      if (p || systems.length || explosions.length) raf = requestAnimationFrame(frame);
      else {
        ctx.clearRect(0, 0, W, CH);
        raf = 0;
      }
    }

    resize();
    window.addEventListener("resize", resize);
    // also catches size changes that don't fire a window resize (css changes, zoom quirks)
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    schedule(forced ? 300 : 2500);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="flyers" aria-hidden="true" />;
}
