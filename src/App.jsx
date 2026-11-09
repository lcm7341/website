import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Home from "./Home.jsx";
import Stuff from "./Stuff.jsx";
import Project from "./Project.jsx";
import Content from "./Content.jsx";
import Post from "./Post.jsx";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/stuff" element={<Stuff />} />
        <Route path="/stuff/:slug" element={<Project />} />
        <Route path="/other" element={<Content />} />
        <Route path="/blog/:year/:month/:day" element={<Post />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
