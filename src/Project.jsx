import { useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import Desktop from "./Desktop.jsx";
import Cover from "./Cover.jsx";
import AppIcon from "./AppIcon.jsx";
import projects from "./projects.js";

const paras = (v) => [].concat(v ?? []);

function filesFor(p) {
  const files = [{ id: "readme", name: "README.TXT", kind: "text" }];
  if (p.cover) files.push({ id: "shot", name: p.cover.youtube ? "RELEASE.MP4" : p.cover.video ? "SCREEN.MP4" : "SCREEN.PNG", kind: "image" });
  const text = [
    ["how", "HOW_IT_WORKS.TXT"],
    ["hardest", "HARDEST.TXT"],
    ["fun", "FUN.TXT"],
    ["learned", "LEARNED.TXT"],
    ["features", "FEATURES.TXT"],
  ];
  for (const [key, name] of text) if (p[key]?.length) files.push({ id: key, name, kind: "text" });
  for (const l of p.links ?? []) files.push({ id: l.href, name: `${l.label}.URL`, kind: "link", href: l.href });
  return files;
}

function Notepad({ p, file }) {
  if (file.id === "readme") {
    return (
      <>
        <p className="np-title">{p.name}</p>
        <p>{p.tagline}</p>
        {paras(p.about).map((t, i) => (
          <p key={i}>{t}</p>
        ))}
        {p.facts?.length > 0 && (
          <ul className="np-facts">
            {p.facts.map(([n, label]) => (
              <li key={label}>
                <b>{n}</b> {label}
              </li>
            ))}
          </ul>
        )}
        <p className="np-dim">
          {p.version && <>Version: {p.version}<br /></>}
          Built with: {p.stack.join(", ")}
        </p>
      </>
    );
  }
  if (file.id === "features") {
    return (
      <ul className="np-list">
        {p.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    );
  }
  return paras(p[file.id]).map((t, i) => <p key={i}>{t}</p>);
}

export default function Project() {
  const { slug } = useParams();
  const p = projects.find((x) => x.slug === slug);
  // back to README when you go to another project
  const [open, setOpen] = useState({ slug, id: "readme" });
  const openId = open.slug === slug ? open.id : "readme";
  const setOpenId = (id) => setOpen({ slug, id });
  if (!p) return <Navigate to="/stuff" replace />;

  const files = filesFor(p);
  const file = files.find((f) => f.id === openId) ?? files[0];

  return (
    <Desktop title={p.name} icon={<AppIcon project={p} size={18} />}>
      <div className="toolbar">
        <Link to="/stuff" className="tool-btn">
          ← My Stuff
        </Link>
        <span className="address">
          <span className="address-label">Address</span>
          <span className="address-field">C:\LEVI\MY STUFF\{p.name.toUpperCase()}\{file.name}</span>
        </span>
      </div>

      <div className="split">
        <ul className="filelist" aria-label="Files">
          {files.map((f) => (
            <li key={f.id}>
              {f.kind === "link" ? (
                <a href={f.href} target="_blank" rel="noreferrer" className="file">
                  <span className="file-glyph file-link" aria-hidden="true" />
                  {f.name}
                </a>
              ) : (
                <button
                  type="button"
                  className={f.id === file.id ? "file file-open" : "file"}
                  onClick={() => setOpenId(f.id)}
                  aria-pressed={f.id === file.id}
                >
                  <span className={`file-glyph file-${f.kind}`} aria-hidden="true" />
                  {f.name}
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="pane">
          {file.kind === "image" ? (
            <div className="viewer">
              <Cover project={p} />
            </div>
          ) : (
            <div className="notepad">
              <Notepad p={p} file={file} />
            </div>
          )}
        </div>
      </div>

      <footer className="statusbar">
        <span>{file.name}</span>
        <span>{files.length} file(s)</span>
      </footer>
    </Desktop>
  );
}
