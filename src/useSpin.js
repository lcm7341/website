import { useEffect, useRef } from "react";

const RAMP_TIME = 0.3; // seconds to go from normal to full hover speed (and back)

// spins an element forever. hovering speeds it up, and the speed eases in and out
// instead of jumping, so the angle never skips (changing a css animation's duration
// mid-spin restarts it from a different angle).
// returns [ref for the spinning element, handlers for whatever should trigger the speedup]
export default function useSpin(secondsPerTurn, fastSecondsPerTurn) {
  const ref = useRef(null);
  const fast = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const slow = 360 / secondsPerTurn;
    const quick = 360 / fastSecondsPerTurn;
    let angle = 0;
    let ramp = 0; // 0 = normal speed, 1 = full hover speed
    let last = performance.now();
    let raf = 0;
    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      // the ramp moves at a constant rate and the speed follows an ease-in-out curve on it,
      // so it starts gently, picks up, and settles. RAMP_TIME seconds from one end to the other
      ramp = Math.min(1, Math.max(0, ramp + (fast.current ? dt : -dt) / RAMP_TIME));
      const eased = ramp * ramp * (3 - 2 * ramp);
      const speed = slow + (quick - slow) * eased; // degrees per second
      angle = (angle + speed * dt) % 360;
      el.style.transform = `rotate(${angle.toFixed(2)}deg)`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [secondsPerTurn, fastSecondsPerTurn]);

  const on = () => (fast.current = true);
  const off = () => (fast.current = false);
  return [ref, { onMouseEnter: on, onMouseLeave: off, onFocus: on, onBlur: off }];
}
