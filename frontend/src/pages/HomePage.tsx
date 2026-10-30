import { ArrowDown, ArrowRight, Leaf, MapPin, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import RestaurantExplorer from "../components/RestaurantExplorer";

export default function HomePage() {
  return (
    <>
      <section className="hero-section">
        <div className="page-shell hero-grid">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={14} /> A little closer to delicious</span>
            <h1 className="hero-title">
              Make room
              <br />
              for <span>something</span>
              <br />
              wonderful.
            </h1>
            <p className="hero-description">
              The best meals aren’t far away. Meet the neighborhood spots that
              make an ordinary day taste a little more like itself.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to="/restaurants" className="button-primary">
                Find your next favorite <ArrowRight size={17} />
              </Link>
              <a href="#restaurants" className="text-link">
                Get a taste <ArrowDown size={15} />
              </a>
            </div>
            <div className="hero-note">
              <span className="hero-note-icon"><MapPin size={16} /></span>
              <span>Good things are happening in your neighborhood.</span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-image-frame">
              <img
                src="https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1400&q=90"
                alt="A colorful table of freshly prepared food"
              />
            </div>
            <div className="hero-image-caption">
              <span className="caption-mark"><Leaf size={17} /></span>
              <span>
                <strong>Made for good moments</strong>
                <small>And the meals in between</small>
              </span>
            </div>
            <span className="hero-orbit hero-orbit-one" />
            <span className="hero-orbit hero-orbit-two" />
          </div>
        </div>
        <div className="hero-bottom-line" />
      </section>

      <section id="restaurants" className="section-space">
        <div className="page-shell">
          <div className="section-heading">
            <div>
              <span className="eyebrow eyebrow-muted">The neighborhood table</span>
              <h2 className="section-title">Good places, <em>great taste.</em></h2>
              <p className="section-subtitle">
                Explore the restaurants serving your community.
              </p>
            </div>
            <Link to="/restaurants" className="text-link hidden sm:inline-flex">
              All restaurants <ArrowRight size={16} />
            </Link>
          </div>
          <RestaurantExplorer />
        </div>
      </section>

      <section className="closing-section">
        <div className="page-shell closing-inner">
          <span className="eyebrow eyebrow-light">Your next favorite is out there</span>
          <h2 className="closing-title">Come hungry.<br /><em>Leave inspired.</em></h2>
          <Link to="/restaurants" className="button-light">
            Meet the neighborhood <ArrowRight size={16} />
          </Link>
        </div>
        <div className="closing-art" aria-hidden="true">
          <img
            src="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85"
            alt=""
            loading="lazy"
          />
        </div>
      </section>
    </>
  );
}
