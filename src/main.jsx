import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// index.html hides the page until fonts load so nothing flashes
document.fonts.ready.then(() =>
  requestAnimationFrame(() => document.getElementById("root").classList.add("ready")),
);
