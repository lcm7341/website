import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gd_cube from "./assets/my_cube.png";
import my_stuff from "./assets/GJ_stuffTxt_001.png";
import Space from "./Space.jsx";
import HorizonLevel from "./horizon/HorizonLevel.jsx";
import Sign from "./Sign.jsx";
import SiteFooter from "./SiteFooter.jsx";
import "./Home.css";

function Home() {
  const pageRef = useRef(null);
  const footerRef = useRef(null);

  // on phones the horizon goes where the footer starts so the floor fills the screen, not the sky
  useEffect(() => {
    const page = pageRef.current;
    const footer = footerRef.current;
    const phone = window.matchMedia("(max-width: 700px)");
    let last = "";
    const sync = () => {
      const value = phone.matches ? `${footer.offsetTop}px` : "";
      if (value === last) return;
      last = value;
      if (value) page.style.setProperty("--horizon", value);
      else page.style.removeProperty("--horizon");
      window.dispatchEvent(new Event("resize")); // let the horizon level re-measure
    };
    const watch = new ResizeObserver(sync);
    watch.observe(page);
    watch.observe(footer);
    phone.addEventListener("change", sync);
    sync();
    return () => {
      watch.disconnect();
      phone.removeEventListener("change", sync);
    };
  }, []);

  return (
    <div className="home-bg" ref={pageRef}>
      <Space />

      {/* my cube as the sun */}
      <div className="sun">
        <div className="sun-halo" aria-hidden="true" />
        <div className="sun-horizon-glow" aria-hidden="true" />
        <div className="sun-path" aria-hidden="true" />
        <div className="sun-reflection" aria-hidden="true">
          <img src={gd_cube} alt="" />
        </div>
        <Link to="/stuff" className="sun-cube" aria-label="My Stuff">
          <img src={gd_cube} alt="My GD Cube" />
        </Link>
      </div>

      {/* separate so it sits above the horizon level */}
      <div className="sun sun-label">
        <Link to="/stuff" className="my-stuff-link">
          <img src={my_stuff} className="my-stuff" alt="My Stuff" />
        </Link>
      </div>

      <HorizonLevel />

      <div className="bg">
        <header className="header">
          <Sign
            word="Levi's Website"
            broken={{ 3: "buzz", 4: "loose", 7: "hang", 10: "flaky", 12: "slip", 13: "dying" }}
          />
        </header>
      </div>

      <main className="space">
        <section className="panel">
          <span className="panel-bracket" aria-hidden="true" />
          <span className="panel-corner" aria-hidden="true" />
          <p>
            Hello World! This is my personal website. Here I will make a bunch of
            stuff that might consist of the following types of things:
          </p>
          <ul>
            <li>Stuff for class</li>
            <li>Anything I want to talk about</li>
            <li>Cool things I made</li>
          </ul>
          <p>
            I plan on updating this frequently with new and interesting CSS and
            HTML stuff I have learned.
          </p>
          <p className="subscript">
            (P.S., this website looks like this on purpose! It's meant to have
            personality and not be boring)
          </p>
        </section>
      </main>

      <SiteFooter ref={footerRef} />
    </div>
  );
}

export default Home;

