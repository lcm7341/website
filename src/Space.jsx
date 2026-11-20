import { useEffect, useRef } from "react";
import "./Space.css";

// the sky is drawn tiny and scaled up with no smoothing, so every "pixel" is a chunky square.
// colors step down in hard bands with a 4x4 bayer dither between them instead of a gradient.

const PX = 3; // css pixels per sky pixel

// top of the sky -> horizon
const SKY = ["#020312", "#040820", "#08102f", "#0c1740", "#122054", "#1a2c6a", "#243b82", "#304d99"];
// sun bands, top -> horizon
const SUN = ["#f6ffb8", "#d8ff8a", "#b2f562", "#8de646", "#66cf33", "#45b02a"];
const BELOW = "#03040c";

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16));

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const SKY_RGB = SKY.map(hex);
const SUN_RGB = SUN.map(hex);
const BELOW_RGB = hex(BELOW);
const RING_RGB = hex("#2c6b1c");

// stars live in 0..1 space so they stay put when the window changes size
const STARS = (() => {
  const r = rng(1337);
  return Array.from({ length: 420 }, () => {
    const roll = r();
    return {
      x: r(),
      y: Math.pow(r(), 1.7), // fewer near the horizon
      kind: roll < 0.04 ? "cross" : roll < 0.3 ? "bright" : "dim",
      phase: r(),
    };
  });
})();

// same formula as .sun --s in Home.css
function cubeSize(w, h, phone) {
  if (phone) return Math.min(150, Math.max(96, 0.3 * w));
  return Math.min(210, Math.max(80, Math.min(0.2 * h, 0.26 * w)));
}

function paintBase(w, h, horizon, cube, sun) {
  const img = new ImageData(w, h);
  const d = img.data;
  const cx = w / 2;
  const R = sun ? (cube * 0.7) / PX : 0; // sun radius in sky pixels
  const set = (i, [r, g, b]) => {
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const t = BAYER[y & 3][x & 3];

      if (y >= horizon) {
        set(i, BELOW_RGB); // floor, the grid on top of it comes from Home.css
        continue;
      }

      const dist = Math.hypot(x - cx, (y - horizon) * 1.0);
      const up = horizon - y; // rows above the horizon
      if (dist < R) {
        // stripes cut out of the bottom of the sun, wider closer to the horizon
        const k = up / R;
        const cut = k < 0.45 && up % Math.max(3, Math.round(R * 0.16)) < Math.round((0.45 - k) * 9);
        if (!cut) {
          const f = (1 - k) * (SUN.length - 1);
          const band = Math.floor(f);
          const next = Math.min(SUN.length - 1, band + 1);
          set(i, SUN_RGB[(f - band) > 0.55 + t * 0.45 ? next : band]);
          continue;
        }
      } else if (sun && dist < R + 5 && t < 0.5 - (dist - R) / 12) {
        // one dithered ring around it, no glow
        set(i, RING_RGB);
        continue;
      }

      // sky bands
      const f = Math.pow(y / horizon, 1.5) * (SKY.length - 1);
      const band = Math.floor(f);
      const frac = f - band;
      const next = Math.min(SKY.length - 1, band + 1);
      set(i, SKY_RGB[frac > 0.55 && (frac - 0.55) / 0.45 > t ? next : band]);
    }
  }
  return img;
}

// sun={false} gives just the night sky (the /dev dashboard uses it as wallpaper)
export default function Space({ sun = true }) {
  const skyRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const sky = skyRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const base = document.createElement("canvas");
    const bctx = base.getContext("2d");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let horizon = 0;
    let raf = 0;

    function layout() {
      const rect = sky.getBoundingClientRect();
      w = Math.ceil(rect.width / PX);
      h = Math.ceil(rect.height / PX);
      const hv = getComputedStyle(sky).getPropertyValue("--horizon").trim();
      const hpx = hv.endsWith("%") ? (parseFloat(hv) / 100) * rect.height : parseFloat(hv) || rect.height * 0.64;
      horizon = Math.round(hpx / PX);
      canvas.width = base.width = w;
      canvas.height = base.height = h;
      const phone = window.matchMedia("(max-width: 1100px)").matches;
      bctx.putImageData(paintBase(w, h, horizon, cubeSize(window.innerWidth, window.innerHeight, phone), sun), 0, 0);
    }

    const shooting = { at: performance.now() + 4000, x: 0, y: 0 };

    function draw(now) {
      ctx.drawImage(base, 0, 0);
      const tick = Math.floor(now / 450); // twinkle moves in steps, like an old game
      const sunR = sun ? (cubeSize(window.innerWidth, window.innerHeight, false) * 0.7) / PX + 7 : 0;
      for (const s of STARS) {
        const x = Math.floor(s.x * w);
        const y = Math.floor(s.y * horizon * 0.92);
        if (Math.hypot(x - w / 2, y - horizon) < sunR) continue;
        const blink = Math.floor(s.phase * 97 + tick) % 11 === 0;
        if (s.kind === "dim") {
          ctx.fillStyle = blink ? "#2a3570" : "#6c78b4";
          ctx.fillRect(x, y, 1, 1);
        } else if (s.kind === "bright") {
          ctx.fillStyle = blink ? "#6c78b4" : "#e9eeff";
          ctx.fillRect(x, y, 1, 1);
        } else {
          const big = Math.floor(s.phase * 13 + tick) % 4 !== 0;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x, y, 1, 1);
          ctx.fillStyle = big ? "#9fb0f0" : "#3c4a90";
          ctx.fillRect(x - 1, y, 1, 1);
          ctx.fillRect(x + 1, y, 1, 1);
          ctx.fillRect(x, y - 1, 1, 1);
          ctx.fillRect(x, y + 1, 1, 1);
          if (big) {
            ctx.fillStyle = "#3c4a90";
            ctx.fillRect(x - 2, y, 1, 1);
            ctx.fillRect(x + 2, y, 1, 1);
            ctx.fillRect(x, y - 2, 1, 1);
            ctx.fillRect(x, y + 2, 1, 1);
          }
        }
      }

      // a shooting star every so often: a 6 pixel streak that hops along
      const age = now - shooting.at;
      if (age > 0 && age < 900) {
        if (!shooting.x) {
          shooting.x = w * (0.1 + Math.random() * 0.4);
          shooting.y = horizon * (0.05 + Math.random() * 0.25);
        }
        const step = Math.floor(age / 40);
        const hx = Math.floor(shooting.x + step * 3);
        const hy = Math.floor(shooting.y + step);
        const trail = ["#ffffff", "#d6defc", "#9fb0f0", "#6c78b4", "#3c4a90", "#26306a"];
        trail.forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.fillRect(hx - i * 3, hy - i, 3, 1);
        });
      } else if (age >= 900) {
        shooting.at = now + 9000 + Math.random() * 12000;
        shooting.x = 0;
      }
    }

    let last = 0;
    function frame(now) {
      if (now - last > 80) {
        draw(now);
        last = now;
      }
      raf = requestAnimationFrame(frame);
    }

    const onResize = () => {
      layout();
      draw(performance.now());
    };
    layout();
    draw(performance.now());
    if (!still) raf = requestAnimationFrame(frame);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [sun]);

  return (
    <div className="space-sky" ref={skyRef} aria-hidden="true">
      <canvas ref={canvasRef} className="pixel-sky" />
    </div>
  );
}
