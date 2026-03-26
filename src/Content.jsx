import { Link } from "react-router-dom";
import posts from "./blog/index.js";
import './Content.css'
import { useNavigate } from "react-router-dom";

function numberToMonth(n) {
  const months = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
  return months[n - 1];
}

export default function Content() {
  const sorted = [...posts].sort((a, b) => {
    if (b.date.year !== a.date.year) return b.date.year - a.date.year;
    if (b.date.month !== a.date.month) return b.date.month - a.date.month;
    return b.date.day - a.date.day;
  });

  // Group by year, then month
  const grouped = {};
  for (const post of sorted) {
    const { year, month } = post.date;
    if (!grouped[year]) grouped[year] = {};
    if (!grouped[year][month]) grouped[year][month] = [];
    grouped[year][month].push(post);
  }

  const navigate = useNavigate();

  return (
    <div className="green-bg">
    <div className="content">
   <button className="home-btn" onClick={() => navigate("/")}>Back Home</button>
      <h1 className="maTitle">Ma jake! Ma Bloga!</h1>
      {Object.keys(grouped).sort((a, b) => b - a).map(year => (
        <div key={year}>
          <h2 className="year-header">{year}</h2>
          {Object.keys(grouped[year]).sort((a, b) => b - a).map(month => (
            <div key={month}>
              <h3 className="month-header">{numberToMonth(+month)}</h3>
              <ul className="blog-list">
                {grouped[year][month].map(post => (
                  <li key={post.slug}>
                    <Link to={`/blog/${post.slug}`}>
                      {post.date_string} - {post.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
      </div>
    </div>
  );
}