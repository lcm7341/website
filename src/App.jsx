import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Home from "./Home.jsx";
import Stuff from "./Stuff.jsx";
import Project from "./Project.jsx";
import { trackView, startTracking } from "./analytics.js";

// only loaded when someone opens /dev, so regular visitors never download it
const Dev = lazy(() => import("./dev/Dev.jsx"));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Analytics() {
  const { pathname } = useLocation();
  useEffect(startTracking, []);
  useEffect(() => {
    trackView();
  }, [pathname]);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Analytics />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/stuff" element={<Stuff />} />
        <Route path="/stuff/:slug" element={<Project />} />
        <Route
          path="/dev"
          element={
            <Suspense fallback={null}>
              <Dev />
            </Suspense>
          }
        />
        {/* blog stays private, not in the build */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
