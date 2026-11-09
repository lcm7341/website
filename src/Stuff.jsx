import { useState } from "react";
import { Link } from "react-router-dom";
import Desktop from "./Desktop.jsx";
import AppIcon from "./AppIcon.jsx";
import projects from "./projects.js";

const FOLDERS = [
  { id: "gd", name: "Geometry Dash" },
  { id: "other", name: "Other" },
];

export default function Stuff() {
  // the hovered or focused project, described in the status bar
  const [hover, setHover] = useState(null);

  return (
    <Desktop title="My Stuff" fit>
      <div className="toolbar">
        <Link to="/" className="tool-btn">
          ← Back
        </Link>
        <span className="address">
          <span className="address-label">Address</span>
          <span className="address-field">C:\LEVI\MY STUFF\</span>
        </span>
      </div>

      <div className="explorer">
        {FOLDERS.map((folder) => (
          <section key={folder.id} className="explorer-group">
            <h2 className="group-head">
              <span className="folder-glyph" aria-hidden="true" />
              {folder.name}
            </h2>
            <ul className="icons">
              {projects
                .filter((p) => p.category === folder.id)
                .map((p) => (
                  <li key={p.slug}>
                    <Link
                      to={`/stuff/${p.slug}`}
                      className="icon"
                      title={p.short}
                      onMouseEnter={() => setHover(p)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(p)}
                      onBlur={() => setHover(null)}
                    >
                      <AppIcon project={p} />
                      <span className="icon-label">{p.name}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>

      <footer className="statusbar">
        <span>{hover ? `${hover.name}: ${hover.short}` : "Click a project to open it"}</span>
        <span>{projects.length} object(s)</span>
      </footer>
    </Desktop>
  );
}
