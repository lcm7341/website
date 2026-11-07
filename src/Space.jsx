import "./Space.css";

// seeded so the stars stay put between loads
function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// a whole layer of stars as box-shadows on one 1px div, thinner toward the horizon
function starLayer(count, seed, width = 2560, height = 1100) {
  const r = rng(seed);
  const colors = ["#ffffff", "#e4ecff", "#cfe2ff", "#fff4e0"];
  const stars = [];
  for (let i = 0; i < count; i++) {
    const x = Math.round(r() * width);
    const y = Math.round(Math.pow(r(), 1.6) * height);
    const c = colors[Math.floor(r() * colors.length)];
    stars.push(`${x}px ${y}px ${c}`);
  }
  return stars.join(",");
}

const SMALL = starLayer(520, 7);
const MEDIUM = starLayer(120, 42);
const BIG = starLayer(28, 1337);

export default function Space() {
  return (
    <div className="space-sky" aria-hidden="true">
      <div className="nebula" />
      <div className="star-field">
        <div className="stars stars-sm" style={{ boxShadow: SMALL }} />
        <div className="stars stars-md" style={{ boxShadow: MEDIUM }} />
        <div className="stars stars-lg" style={{ boxShadow: BIG }} />
        <div className="shooting-star" />
      </div>
      <div className="horizon-glow" />
    </div>
  );
}
