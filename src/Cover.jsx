const reduceMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function Cover({ project }) {
  const c = project.cover ?? {};
  let inner;
  if (c.youtube) {
    inner = (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${c.youtube}?rel=0`}
        title={c.title ?? project.name}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    );
  } else if (c.video) {
    inner = <video src={c.video} poster={c.poster} autoPlay={!reduceMotion} muted loop playsInline aria-hidden="true" />;
  } else {
    inner = <img src={c.image} alt="" style={c.position ? { objectPosition: c.position } : undefined} />;
  }
  return <div className={c.youtube ? "cover cover-youtube" : "cover"}>{inner}</div>;
}
