// neon sign. broken = { letter index: buzz | loose | hang | flaky | slip | dying }
export default function Sign({ word, broken }) {
  const faults = broken ?? defaultFaults(word);
  return (
    <div className="sign">
      <h1>
        {word.split("").map((char, index) => (
          <span
            key={char + index}
            className={faults[index] ? `animated-chars ${faults[index]}` : "animated-chars"}
            style={{ animationDelay: `${index * -350}ms` }}
          >
            {char === " " ? " " : char}
          </span>
        ))}
      </h1>
    </div>
  );
}

function defaultFaults(word) {
  const letters = [...word].map((c, i) => (c.trim() ? i : -1)).filter((i) => i >= 0);
  if (letters.length < 3) return {};
  return { [letters[1]]: "buzz", [letters[letters.length - 2]]: "flaky" };
}
