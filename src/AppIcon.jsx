export default function AppIcon({ project, size = 64 }) {
  if (project.icon) {
    return <img src={project.icon} alt="" className="app-icon" width={size} height={size} />;
  }
  return <span className={`app-icon stock-${project.glyph ?? "program"}`} style={{ "--s": `${size}px` }} aria-hidden="true" />;
}
