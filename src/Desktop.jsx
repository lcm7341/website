import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import gd_cube from "./assets/my_cube.png";
import developed_by from "./assets/developedBy_001.png";
import nametag from "./assets/nametag.png";
import "@fontsource/vt323";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/700.css";
import "./Stuff.css";

// remembers whether the lamp is on. dark by default, it's only a display setting
function useLights() {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem("lm.lights") === "on";
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setOn((v) => {
      try {
        if (v) localStorage.removeItem("lm.lights");
        else localStorage.setItem("lm.lights", "on");
      } catch {
        // storage blocked, it just won't be remembered
      }
      return !v;
    });
  return [on, toggle];
}

// my stuff + project pages: an old desktop with one window open
export default function Desktop({ title, icon, fit = false, children }) {
  const [lights, toggleLights] = useLights();
  return (
    <div className="desktop" data-lights={lights ? "on" : "off"}>
      <main className="desktop-area">
        <Window title={title} icon={icon} fit={fit}>
          {children}
        </Window>
      </main>
      <Taskbar title={title} icon={icon} lights={lights} onLights={toggleLights} />
    </div>
  );
}

function Window({ title, icon, fit, children }) {
  return (
    <section className={fit ? "window window-fit" : "window"} aria-label={title}>
      <header className="titlebar">
        {icon && <span className="titlebar-icon">{icon}</span>}
        <h1 className="titlebar-text">{title}</h1>
        <span className="titlebar-buttons" aria-hidden="true">
          <span className="tb-btn">_</span>
          <span className="tb-btn">□</span>
          <Link to="/" className="tb-btn tb-close" aria-label="Close and go home">
            ×
          </Link>
        </span>
      </header>
      {children}
    </section>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  return <span className="tray-clock">{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>;
}

function Taskbar({ title, icon, lights, onLights }) {
  return (
    <nav className="taskbar">
      <Link to="/" className="start-btn">
        <img src={gd_cube} alt="" />
        Home
      </Link>
      <Link to="/stuff" className="task-btn">
        My Stuff
      </Link>
      {title !== "My Stuff" && (
        <span className="task-btn task-btn-active">
          {icon && <span className="task-icon">{icon}</span>}
          {title}
        </span>
      )}
      <span className="tray">
        <button
          type="button"
          className="lamp"
          onClick={onLights}
          aria-pressed={lights}
          title={lights ? "Lights off" : "Lights on"}
          data-track={lights ? "Lights off" : "Lights on"}
        >
          {lights ? "☀" : "☾"}
        </button>
        <img src={developed_by} alt="Developed By:" className="tray-dev" />
        <img src={nametag} alt="Levi Minton" className="tray-name" />
        <Clock />
      </span>
    </nav>
  );
}
