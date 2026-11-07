import { forwardRef } from "react";
import react_logo from "./assets/react.svg";
import developed_by from "./assets/developedBy_001.png";
import powered_by from "./assets/poweredBy_001.png";
import nametag from "./assets/nametag.png";

const SiteFooter = forwardRef(function SiteFooter(_, ref) {
  return (
    <footer className="footer" ref={ref}>
      <div className="footer-item">
        <img src={developed_by} className="developed-by" alt="Developed By:" />
        <img src={nametag} className="name" alt="Levi Minton" />
      </div>
      <div className="footer-item">
        <img src={powered_by} className="powered-by" alt="Powered By:" />
        <a href="https://react.dev/">
          <img src={react_logo} className="react" alt="React" />
        </a>
      </div>
    </footer>
  );
});

export default SiteFooter;
