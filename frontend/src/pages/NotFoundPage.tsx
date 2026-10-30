import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="page-shell not-found-page">
      <span className="eyebrow eyebrow-muted">A little off the menu</span>
      <h1 className="page-title">This page isn’t here.</h1>
      <p className="section-subtitle">Let’s get you back to something delicious.</p>
      <Link to="/" className="button-primary mt-7"><ArrowLeft size={16} /> Back to CraveDash</Link>
    </div>
  );
}
