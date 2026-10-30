import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import RestaurantExplorer from "../components/RestaurantExplorer";

export default function DiscoverPage() {
  return (
    <div className="page-shell page-top-space">
      <Link to="/" className="back-link"><ArrowLeft size={15} /> Back home</Link>
      <div className="discover-heading">
        <div>
          <span className="eyebrow eyebrow-muted">A table for every kind of day</span>
          <h1 className="page-title">Find your <em>kind of delicious.</em></h1>
          <p className="section-subtitle max-w-xl">
            Browse local restaurants and find the spot that feels just right.
            Restaurant details are supplied by the CraveDash Restaurant Service.
          </p>
        </div>
        <div className="discover-aside">
          <span className="aside-number">01</span>
          <span>Discover<br />something lovely</span>
          <ArrowRight size={17} />
        </div>
      </div>
      <div className="mb-16">
        <RestaurantExplorer />
      </div>
    </div>
  );
}
