import { ArrowUpRight, MapPin, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import ResilientImage from "./ResilientImage";
import { restaurantImage } from "../lib/images";
import type { Restaurant } from "../types/api";

export default function RestaurantCard({
  restaurant,
}: {
  restaurant: Restaurant;
}) {
  return (
    <article className="restaurant-card group">
      <Link
        to={`/restaurants/${restaurant.id}`}
        className="restaurant-photo-wrap"
        aria-label={`View ${restaurant.name}`}
      >
        <ResilientImage
          src={restaurantImage(restaurant)}
          alt={restaurant.name}
          className="restaurant-photo"
          loading="lazy"
        />
        <span
          className={`availability-pill ${restaurant.available ? "availability-open" : "availability-closed"}`}
        >
          <span className="availability-dot" />
          {restaurant.available ? "Available" : "Unavailable"}
        </span>
        <span className="photo-arrow" aria-hidden="true">
          <ArrowUpRight size={18} />
        </span>
      </Link>
      <div className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="font-display text-[22px] leading-tight text-ink">
            <Link to={`/restaurants/${restaurant.id}`} className="hover:text-terracotta">
              {restaurant.name}
            </Link>
          </h3>
          <span className="restaurant-id">#{restaurant.id}</span>
        </div>
        <p className="mb-4 flex items-start gap-2 text-sm leading-6 text-stone-500">
          <MapPin size={16} className="mt-1 shrink-0 text-terracotta" />
          <span>{restaurant.address}</span>
        </p>
        <div className="flex items-center justify-between border-t border-stone-100 pt-4 text-xs text-stone-500">
          <span className="inline-flex min-w-0 items-center gap-2">
            <Phone size={14} className="shrink-0 text-stone-400" />
            <span className="truncate">{restaurant.phone}</span>
          </span>
          <Link
            to={`/restaurants/${restaurant.id}`}
            className="ml-3 shrink-0 font-semibold text-terracotta transition-colors hover:text-ink"
          >
            Explore
          </Link>
        </div>
      </div>
    </article>
  );
}
