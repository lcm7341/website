import { useParams } from "react-router-dom";
import { Suspense, lazy, useMemo } from "react";
import posts from "./blog/index.js";

export default function BlogPost() {
  const { year, month, day } = useParams();
  const slug = `${year}/${month}/${day}`;

  const post = posts.find((p) => p.slug === slug);

  const PostComponent = useMemo(() => {
    if (!post) return null;
    return lazy(post.component);
  }, [post]);

  if (!post) return <p>Post not found.</p>;

  return (
    <Suspense fallback={<p>Loading...</p>}>
      <PostComponent />
    </Suspense>
  );
}