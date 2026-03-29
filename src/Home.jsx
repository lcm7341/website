import react_logo from "./assets/react.svg";
import gd_cube from "./assets/my_cube.png";
import my_stuff from "./assets/GJ_stuffTxt_001.png";
import developed_by from "./assets/developedBy_001.png";
import powered_by from "./assets/poweredBy_001.png";
import nametag from "./assets/nametag.png";
import "./Home.css";
import { useState } from "react";

function Modal({ isOpen, onClose, children }) {
  return (
    <div
      className={`overlay ${isOpen ? "open" : ""}`}
      onClick={onClose}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Home() {
  const [open, setOpen] = useState(false);

  return (
    <div className="home-bg">
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Hello">
        <h2>Crack the code.</h2>
        <input className="password-field" type="password"></input><button className="submit-guess">Submit</button>
      </Modal>
      <div className="bg">
        <div className="header">
          <h1>
            <MakeAnimatedCharacters word="Levi's Website" />
          </h1>
          {/* <a href="/other"><img src={gd_cube} className="logo gd_cube" alt="My GD Cube" /></a>*/}
          <button className="cube_button" onClick={() => setOpen(true)}><img src={gd_cube} className="logo gd_cube" alt="My GD Cube" /></button>
          <img src={my_stuff} className="my-stuff"></img>
        </div>
      </div>

      <div className="space bottom-dash">
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
      </div>

      {/* <div className="space updates">
        <h2>Updates / Changelog</h2>
      </div>*/}

      <div className="footer">
        <div>
          <img src={developed_by} className="developed-by" />
          <img src={nametag} className="name" />
        </div>
        <div>
          <img src={powered_by} className="powered-by" />
          <a href="https://react.dev/">
            <img src={react_logo} className="react logo" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default Home;

function MakeAnimatedCharacters({ word }) {
  let split = word.split("");

  let is_even = true;

  let obj_map = split.map((char, index) => {
    is_even = !is_even;
    return {
      char: char,
      delay: index % 2 == 0 ? -1000 : 0,
    };
  });

  return (
    <>
      {obj_map.map((obj, index) => (
        <span
          key={obj.char + index}
          className="animated-chars"
          style={{ animationDelay: +obj.delay + "ms" }}
        >
          {obj.char}
        </span>
      ))}
    </>
  );
}
