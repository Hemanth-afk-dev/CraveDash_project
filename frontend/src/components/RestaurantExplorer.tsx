import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, LoaderCircle, Search, UtensilsCrossed } from "lucide-react";
import { Link } from "react-router-dom";
import { api, getApiErrorMessage } from "../lib/api";
import { isRestaurant } from "../lib/contracts";
import type { Restaurant } from "../types/api";
import { useAuth } from "../context/AuthContext";
import RestaurantCard from "./RestaurantCard";

export default function RestaurantExplorer() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [search, setSearch] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setErrorMessage("");

    api
      .get<Restaurant[]>("/restaurants")
      .then(({ data }) => {
        if (!Array.isArray(data) || !data.every(isRestaurant)) {
          throw new Error(
            "The restaurant service returned data that does not match its API contract.",
          );
        }
        if (active) {
          setRestaurants(data);
          setStatus("ready");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setErrorMessage(getApiErrorMessage(error));
          setStatus("error");
        }
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const matchingRestaurants = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return restaurants.filter((restaurant) => {
      const matchesQuery =
        !query ||
        [restaurant.name, restaurant.address, restaurant.phone].some((value) =>
          value.toLocaleLowerCase().includes(query),
        );
      return matchesQuery && (!availableOnly || restaurant.available);
    });
  }, [availableOnly, restaurants, search]);
  const visibleRestaurants = matchingRestaurants;

  if (status === "loading") {
    return (
      <div className="state-panel">
        <LoaderCircle className="animate-spin text-terracotta" size={25} />
        <p>Finding the good stuff…</p>
      </div>
    );
  }

  if (status === "error") {
    const needsSignIn = errorMessage.includes("sign in");
    return (
      <div className="state-panel state-panel-error">
        <span className="state-icon">
          <AlertCircle size={21} />
        </span>
        <h3>{needsSignIn ? "A seat is waiting for you" : "We couldn’t reach the restaurant service"}</h3>
        <p>{errorMessage}</p>
        {needsSignIn ? (
          <Link to="/login" className="button-primary mt-2">
            Sign in to explore <ArrowRight size={16} />
          </Link>
        ) : (
          <p className="text-xs">Check that the API Gateway and Restaurant Service are running, then refresh.</p>
        )}
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="state-panel">
        <span className="state-icon"><UtensilsCrossed size={21} /></span>
        <h3>No restaurants just yet</h3>
        <p>The restaurant service is connected, but it hasn’t returned any listings.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="discovery-controls mb-7">
        <label className="search-field">
          <Search size={18} className="shrink-0 text-stone-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by restaurant or address"
            aria-label="Search restaurants by name or address"
          />
          <span className="hidden text-xs text-stone-400 sm:inline">Search</span>
        </label>
        <label className="availability-filter">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(event) => setAvailableOnly(event.target.checked)}
          />
          <span>Available now</span>
        </label>
        <span className="restaurant-result-count" aria-live="polite">
          Showing {visibleRestaurants.length} of {matchingRestaurants.length} matching · {restaurants.length} from API
        </span>
      </div>
      {visibleRestaurants.length ? (
        <div className="restaurant-grid grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visibleRestaurants.map((restaurant) => (
            <RestaurantCard key={restaurant.id} restaurant={restaurant} />
          ))}
        </div>
      ) : (
        <div className="state-panel state-panel-compact">
          <p>No restaurants match “{search}”. Try another search.</p>
        </div>
      )}
      <p className="mt-5 text-center text-xs text-stone-400">
        Showing live Restaurant Service results; this page does not add demo restaurants. Food photography is illustrative.
      </p>
    </div>
  );
}
