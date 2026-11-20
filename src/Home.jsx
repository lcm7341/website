import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gd_cube from "./assets/my_cube.png";
import my_stuff from "./assets/GJ_stuffTxt_001.png";
import Space from "./Space.jsx";
import FlyingIcons from "./FlyingIcons.jsx";
import HorizonLevel from "./horizon/HorizonLevel.jsx";
import Sign from "./Sign.jsx";
import SiteFooter from "./SiteFooter.jsx";
import useSpin from "./useSpin.js";
import "./Home.css";

function Home() {
  const pageRef = useRef(null);
  const footerRef = useRef(null);
  const [cubeRef, cubeHover] = useSpin(18, 2.5);
  const emailRef = useRef(null);

  // the address is put together here so scrapers reading the html don't find it
  useEffect(() => {
    const user = ["levi", "minton", "627"].join("");
    emailRef.current.href = `mailto:${user}@${"gmail"}.com`;
  }, []);

  // on phones the horizon goes where the footer starts so the floor fills the screen, not the sky
  useEffect(() => {
    const page = pageRef.current;
    const footer = footerRef.current;
    const phone = window.matchMedia("(max-width: 1100px)");
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
      <FlyingIcons />

      {/* my cube sits in front of the pixel sun that Space.jsx draws */}
      <div className="sun">
        <Link to="/stuff" className="sun-cube" aria-label="My Stuff" {...cubeHover}>
          <img src={gd_cube} alt="My GD Cube" ref={cubeRef} />
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
          <span className="panel-tab" aria-hidden="true">
            hello.txt
          </span>
          <h2 className="hello">Hey, I&apos;m Levi.</h2>
          <p>
            I&apos;m a junior at Missouri State studying Computer Science with a
            minor in Math, graduating May 2028.
          </p>
          <p>
            I like making software that solves my own problems. I would rather
            spend weeks automating something that takes two minutes than spend two
            minutes on it every time. I also like building things that help me
            understand other things, which is how I ended up taking apart Geometry
            Dash.
          </p>
          <p>
            At 15 I made <Link to="/stuff/echo-2-1">Echo</Link>, a replay bot for
            it, before AI could write code for you. I&apos;ve maintained it for five
            years, and its Discord has about 7,100 members. I got into
            programming because my dad was a programmer and I wanted to be like him.
          </p>
        </section>

        <section className="panel panel-now">
          <span className="panel-tab" aria-hidden="true">
            now.txt
          </span>
          <p>
            I&apos;m looking for internships, part-time or contract work. Any team,
            any stack, starting whenever. Based in Springfield, MO, and happy to
            relocate.
          </p>
          <p>
            Outside of code: joking around with my friends and a lot of music.
          </p>
          <nav className="links" aria-label="Contact and links">
            <a href="#" ref={emailRef} data-track="Email">
              email
            </a>
            <a href="https://github.com/lcm7341" target="_blank" rel="noreferrer">
              github
            </a>
            <a href="https://www.linkedin.com/in/leviminton/" target="_blank" rel="noreferrer">
              linkedin
            </a>
            <a href="/levi-minton-resume.pdf" target="_blank" rel="noreferrer">
              résumé
            </a>
            <Link to="/stuff" className="links-main">
              my stuff →
            </Link>
          </nav>
          <p className="subscript">
            (P.S., this website looks like this on purpose! It&apos;s meant to have
            personality and not be boring)
            <span className="cursor" aria-hidden="true" />
          </p>
        </section>
      </main>

      <SiteFooter ref={footerRef} />
    </div>
  );
}

export default Home;

