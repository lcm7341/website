import { useEffect, useRef } from "react";
import { SIM_DT, generate, makeCube, surfaceAt, update } from "./game.js";
import "./HorizonLevel.css";

const HORIZON = 48; // px of sky above the floor at the top of the canvas
const SILHOUETTE = "#020308";

// floorgrid.jpg is cropped from a bigger grid, its lines meet 186.7px above its top edge
const VP_IMAGE = 186.7;
const SHADOW_C = 0.22; // lower sun = longer shadows
const SHADOW_MAX = 8;
const SHADOW_FADE = 3;

export default function HorizonLevel() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let unit, level, cubes, width, height, raf;
    let vpUp = 140;
    let staticShadows = [];

    // blurring is slow so everything that never moves gets drawn once into backdrop
    const layer = () => {
      const c = document.createElement("canvas");
      return [c, c.getContext("2d")];
    };
    const [backdrop, bctx] = layer();
    const [hard, hctx] = layer();
    const [near, nctx] = layer();
    const [far, fctx] = layer();

    // traces the top of the my stuff text so cubes can slide on it
    function measureLabel() {
      const img = document.querySelector(".my-stuff");
      if (!img || !img.complete || !img.naturalWidth) return null;
      const cr = canvas.getBoundingClientRect();
      const r = img.getBoundingClientRect();
      const w = Math.round(r.width), h = Math.round(r.height);
      if (!w || !h) return null;
      const oc = document.createElement("canvas");
      oc.width = w;
      oc.height = h;
      const ox = oc.getContext("2d");
      ox.drawImage(img, 0, 0, w, h);
      const data = ox.getImageData(0, 0, w, h).data;

      const top = new Float32Array(w).fill(-1);
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
          if (data[(y * w + x) * 4 + 3] > 128) {
            top[x] = (HORIZON - (r.top - cr.top + y)) / unit;
            break;
          }
        }
      }
      // fill the gaps between letters & smooth it so it's a slide not stairs
      let last = -1;
      for (let x = 0; x < w; x++) {
        if (top[x] < 0) continue;
        if (last >= 0 && x - last > 1 && x - last < unit * 2.5) {
          for (let k = last + 1; k < x; k++) top[k] = top[last] + ((top[x] - top[last]) * (k - last)) / (x - last);
        }
        last = x;
      }
      const smooth = new Float32Array(w).fill(-1);
      for (let x = 0; x < w; x++) {
        if (top[x] < 0) continue;
        let sum = 0, n = 0;
        for (let k = Math.max(0, x - 3); k <= Math.min(w - 1, x + 3); k++) {
          if (top[k] >= 0) {
            sum += top[k];
            n++;
          }
        }
        smooth[x] = Math.max(0, sum / n);
      }
      return { x0: (r.left - cr.left) / unit, res: unit, h: smooth };
    }

    function measureVanishingPoint() {
      const horizonY = canvas.getBoundingClientRect().top + HORIZON;
      const pinned = getComputedStyle(canvas).position === "fixed"; // phones scroll it with the page
      const bottom = pinned ? window.innerHeight : canvas.parentElement.getBoundingClientRect().bottom;
      vpUp = VP_IMAGE * Math.max(window.innerWidth / 2560, (bottom - horizonY) / 533);
    }

    // where a point h units up lands on the floor, in perspective, with the sun straight ahead
    function project(px, h) {
      const d = 1 - SHADOW_C * Math.max(h, 0);
      const k = d > 1 / SHADOW_MAX ? 1 / d : SHADOW_MAX;
      return [width / 2 + (px - width / 2) * k, HORIZON + vpUp * (k - 1)];
    }

    function makeShadow(xL, xR, h0, h1, spike) {
      const mid = (xL + xR) / 2;
      const pts = spike
        ? [project(xL, h0), project(xR, h0), project(mid, h1)]
        : [project(xL, h0), project(xR, h0), project(xR, h1), project(xL, h1)];
      const path = new Path2D();
      pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
      path.closePath();
      const grad = ctx.createLinearGradient(...project(mid, 0), ...project(mid, SHADOW_FADE));
      grad.addColorStop(0, `rgba(0, 0, 0, ${(0.6 / (1 + h0 * 0.5)).toFixed(3)})`); // higher = fainter
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      return { path, grad };
    }

    const boxShadow = (x0, x1, h0, h1) => makeShadow(x0 * unit, x1 * unit, h0, h1, false);
    const spikeShadow = (x, base) => makeShadow(x * unit, (x + 1) * unit, base, base + 1, true);

    // brighter near the sun so the silhouettes show up against it
    function rimColor(px, k = 1) {
      const d = (px - width / 2) / 260;
      return `rgba(170, 255, 110, ${((0.18 + 0.7 * Math.exp(-d * d)) * k).toFixed(3)})`;
    }

    function drawFloorLight(x) {
      x.save();
      x.translate(width / 2, HORIZON);
      x.scale(1, (height - HORIZON) / (width * 0.6));
      const light = x.createRadialGradient(0, 0, 0, 0, 0, width * 0.6);
      light.addColorStop(0, "rgba(170, 255, 100, 0.34)");
      light.addColorStop(0.18, "rgba(110, 230, 90, 0.2)");
      light.addColorStop(0.45, "rgba(60, 170, 190, 0.1)");
      light.addColorStop(0.75, "rgba(70, 110, 255, 0.05)");
      light.addColorStop(1, "rgba(70, 110, 255, 0)");
      x.fillStyle = light;
      x.fillRect(-width / 2, 0, width, width * 0.6);
      x.restore();
    }

    // shadows are sharp at the object & blur out with distance: a sharp copy and a blurred copy,
    // crossfaded down the floor (the cube sun is huge so they'd be really soft)
    function bakeShadows(dpr) {
      hctx.setTransform(1, 0, 0, 1, 0, 0);
      hctx.clearRect(0, 0, hard.width, hard.height);
      hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const sh of staticShadows) {
        hctx.fillStyle = sh.grad;
        hctx.fill(sh.path);
      }

      const floorY = HORIZON * dpr;
      for (const [c, x, blur, from, to] of [
        [near, nctx, 0.6, "black", "transparent"],
        [far, fctx, 5, "transparent", "black"],
      ]) {
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.clearRect(0, 0, c.width, c.height);
        x.filter = `blur(${blur * dpr}px)`;
        x.drawImage(hard, 0, 0);
        x.filter = "none";
        const g = x.createLinearGradient(0, floorY, 0, floorY + 70 * dpr);
        g.addColorStop(0, from);
        g.addColorStop(1, to);
        x.globalCompositeOperation = "destination-in";
        x.fillStyle = g;
        x.fillRect(0, floorY, c.width, c.height);
        x.globalCompositeOperation = "source-over";
      }

      bctx.save();
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.drawImage(near, 0, 0);
      bctx.drawImage(far, 0, 0);
      bctx.restore();
    }

    function drawLevel(x) {
      x.lineWidth = 1;
      for (const b of level.blocks) {
        const bx = b.x * unit, by = HORIZON - (b.y0 + b.h) * unit, w = b.w * unit, h = b.h * unit;
        x.fillStyle = SILHOUETTE;
        x.fillRect(bx, by, w, h);
        x.strokeStyle = rimColor(bx + w / 2);
        x.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1);
      }
      for (const s of level.spikes) {
        const left = s.x * unit, base = HORIZON - s.base * unit;
        x.beginPath();
        x.moveTo(left, base);
        x.lineTo(left + unit / 2, base - unit);
        x.lineTo(left + unit, base);
        x.closePath();
        x.fillStyle = SILHOUETTE;
        x.fill();
        x.strokeStyle = rimColor(left + unit / 2);
        x.stroke();
      }
      for (const o of level.orbs) {
        const ox = o.x * unit, oy = HORIZON - o.y * unit;
        x.beginPath();
        x.arc(ox, oy, unit * 0.38, 0, Math.PI * 2);
        x.fillStyle = SILHOUETTE;
        x.fill();
        x.strokeStyle = rimColor(ox);
        x.stroke();
        x.beginPath();
        x.arc(ox, oy, unit * 0.62, 0, Math.PI * 2);
        x.strokeStyle = rimColor(ox, 0.6);
        x.stroke();
      }
    }

    function setup() {
      const dpr = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const [c, x] of [[backdrop, bctx], [hard, hctx], [near, nctx], [far, fctx]]) {
        c.width = canvas.width;
        c.height = canvas.height;
        x.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      unit = width < 700 ? 4.5 : 6;
      level = generate(Math.ceil(width / unit) + 2, measureLabel());
      const count = width < 700 ? 1 : 2;
      // phones resize when the address bar slides, don't restart the cubes for that
      if (cubes?.length === count && cubes.levelLength === level.length) {
        for (const c of cubes) {
          c.planX = null;
          c.checkAt = 0;
        }
      } else {
        cubes = Array.from({ length: count }, (_, i) => makeCube((level.length / count) * i + 1));
        cubes.levelLength = level.length;
      }

      measureVanishingPoint();
      staticShadows = [
        ...level.blocks.map((b) => boxShadow(b.x, b.x + b.w, b.y0, b.y0 + b.h)),
        ...level.spikes.map((s) => spikeShadow(s.x, s.base)),
        ...level.orbs.map((o) => boxShadow(o.x - 0.35, o.x + 0.35, o.y - 0.35, o.y + 0.35)),
      ];

      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.clearRect(0, 0, backdrop.width, backdrop.height);
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawFloorLight(bctx);
      bakeShadows(dpr);
      drawLevel(bctx);
    }

    function draw() {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(backdrop, 0, 0);
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, HORIZON, width, height - HORIZON);
      ctx.clip();
      for (const c of cubes) {
        const sh = boxShadow(c.x, c.x + 1, c.y, c.y + 1);
        ctx.fillStyle = sh.grad;
        ctx.fill(sh.path);
      }
      ctx.restore();

      ctx.lineWidth = 1;
      for (const c of cubes) {
        const cx = (c.x + 0.5) * unit;
        let cy = HORIZON - (c.y + 0.5) * unit;
        let rot = (c.rot * Math.PI) / 180;
        if (c.onSurface) {
          // hop over each letter & tilt with the text. just looks, physics stays flat
          cy -= Math.abs(Math.sin(c.x * 2.4)) * 0.35 * unit;
          const ahead = surfaceAt(level, c.x + 0.4) ?? c.y;
          const behind = surfaceAt(level, c.x - 0.4) ?? c.y;
          rot -= Math.max(-0.4, Math.min(0.4, Math.atan2(ahead - behind, 0.8)));
        }
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.fillStyle = SILHOUETTE;
        ctx.fillRect(-unit / 2, -unit / 2, unit, unit);
        ctx.strokeStyle = rimColor(cx);
        ctx.strokeRect(-unit / 2 + 0.5, -unit / 2 + 0.5, unit - 1, unit - 1);
        ctx.restore();
      }
    }

    let last = performance.now();
    function frame(now) {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const steps = Math.max(1, Math.round(dt / SIM_DT)); // same game at any fps
      for (const c of cubes) for (let i = 0; i < steps; i++) update(level, c, dt / steps);
      draw();
      raf = requestAnimationFrame(frame);
    }

    setup();
    if (reduceMotion) draw();
    else raf = requestAnimationFrame(frame);

    let pending = 0;
    const onResize = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        setup();
        draw();
      });
    };
    window.addEventListener("resize", onResize);
    const pageSize = new ResizeObserver(onResize); // on phones the horizon moves with the page height
    pageSize.observe(canvas.parentElement);
    const label = document.querySelector(".my-stuff");
    if (label && !label.complete) label.addEventListener("load", onResize, { once: true });

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(pending);
      window.removeEventListener("resize", onResize);
      pageSize.disconnect();
      label?.removeEventListener("load", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="horizon-level" aria-hidden="true" />;
}
