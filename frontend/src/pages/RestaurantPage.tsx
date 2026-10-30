import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  LoaderCircle,
  MapPin,
  Minus,
  Phone,
  Plus,
  ShoppingBag,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api, getApiErrorMessage } from "../lib/api";
import { isMenuItem, isRestaurant } from "../lib/contracts";
import ResilientImage from "../components/ResilientImage";
import { menuItemImage, restaurantImage } from "../lib/images";
import { getDisplayableMenuItems } from "../lib/menu";
import { formatInrAmount } from "../lib/currency";
import type { MenuItem, Restaurant } from "../types/api";
import { useCart } from "../context/CartContext";

type PageState = "loading" | "ready" | "error";

export default function RestaurantPage() {
  const { restaurantId } = useParams();
  const { cart, addItem, replaceWithItem, setQuantity, removeItem } = useCart();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [state, setState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [cartMessage, setCartMessage] = useState("");
  const [replaceItem, setReplaceItem] = useState<MenuItem | null>(null);

  useEffect(() => {
    let active = true;
    setState("loading");
    setErrorMessage("");
    setRestaurant(null);
    setMenu([]);
    const loadRestaurant = async () => {
      try {
        const [restaurantResponse, menuResponse] = await Promise.all([
          api.get<Restaurant>(`/restaurants/${restaurantId}`),
          api.get<MenuItem[]>(`/restaurants/${restaurantId}/menu`),
        ]);
        if (
          !isRestaurant(restaurantResponse.data) ||
          !Array.isArray(menuResponse.data) ||
          !menuResponse.data.every(isMenuItem)
        ) {
          throw new Error("The restaurant service returned data that does not match its API contract.");
        }
        if (active) {
          setRestaurant(restaurantResponse.data);
          setMenu(menuResponse.data);
          setState("ready");
        }
      } catch (error: unknown) {
        if (active) {
          setErrorMessage(getApiErrorMessage(error));
          setState("error");
        }
      }
    };
    void loadRestaurant();
    return () => {
      active = false;
    };
  }, [restaurantId]);

  if (state === "loading") {
    return (
      <div className="state-panel page-shell page-top-space">
        <LoaderCircle className="animate-spin text-terracotta" size={25} />
        <p>Setting the table…</p>
      </div>
    );
  }

  if (state === "error" || !restaurant) {
    return (
      <div className="page-shell page-top-space">
        <div className="state-panel state-panel-error">
          <span className="state-icon"><AlertCircle size={21} /></span>
          <h1>{errorMessage.includes("sign in") ? "Sign in to see this restaurant" : "We couldn’t load this restaurant"}</h1>
          <p>{errorMessage}</p>
          <Link to={errorMessage.includes("sign in") ? "/login" : "/restaurants"} className="button-primary mt-2">
            {errorMessage.includes("sign in") ? "Sign in" : "Back to restaurants"}
          </Link>
        </div>
      </div>
    );
  }

  const displayableMenu = getDisplayableMenuItems(menu, restaurant.name);
  const hiddenMenuCount = menu.length - displayableMenu.length;

  return (
    <div className="page-shell page-top-space">
      <Link to="/restaurants" className="back-link"><ArrowLeft size={15} /> All restaurants</Link>
      <section className="detail-hero">
        <div className="detail-photo">
          <ResilientImage
            src={restaurantImage(restaurant)}
            alt={`${restaurant.name} restaurant`}
            loading="lazy"
          />
          <span className="photo-disclaimer">Illustrative photography</span>
        </div>
        <div className="detail-copy">
          <span className="eyebrow eyebrow-muted">From your neighborhood</span>
          <h1 className="page-title">{restaurant.name}</h1>
          <span className={`availability-pill ${restaurant.available ? "availability-open" : "availability-closed"}`}>
            <span className="availability-dot" />
            {restaurant.available ? "Available" : "Unavailable"}
          </span>
          <div className="detail-contact">
            <p><MapPin size={17} /><span>{restaurant.address}</span></p>
            <p><Phone size={17} /><span>{restaurant.phone}</span></p>
          </div>
        </div>
      </section>

      <section className="menu-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow eyebrow-muted">From the kitchen</span>
            <h2 className="section-title">The menu.</h2>
          </div>
          <p className="menu-note">
            Menu amounts are shown in INR. The Restaurant Service provides numeric prices without currency metadata.
          </p>
        </div>
        {cartMessage && (
          <div className="cart-notice" role="status">
            <p>{cartMessage}</p>
            <Link to="/cart">View cart <ShoppingBag size={14} /></Link>
          </div>
        )}
        {hiddenMenuCount > 0 && (
          <div className="cart-notice cart-notice-warning mb-4" role="status">
            <p>
              {hiddenMenuCount} menu {hiddenMenuCount === 1 ? "entry was" : "entries were"} hidden because it has an invalid price or repeats the restaurant name. Please have the restaurant data reviewed.
            </p>
          </div>
        )}
        {replaceItem && (
          <div className="cart-notice cart-notice-warning" role="alert">
            <p>
              Your cart has items from {cart?.restaurantName}. Starting a cart
              for {restaurant.name} will replace it.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  const result = replaceWithItem(restaurant, replaceItem);
                  if (result === "added") {
                    setCartMessage(`${replaceItem.name} added to your cart.`);
                  }
                  setReplaceItem(null);
                }}
              >
                Replace cart and add item
              </button>
              <button
                type="button"
                className="text-link"
                onClick={() => setReplaceItem(null)}
              >
                Keep current cart
              </button>
            </div>
          </div>
        )}
        {displayableMenu.length ? (
          <div className="menu-list">
            {displayableMenu.map((item) => {
              const cartLine =
                cart?.restaurantId === restaurant.id
                  ? cart.items.find((line) => line.id === item.id)
                  : undefined;
              const validPrice =
                Number.isFinite(item.price) && item.price > 0;
              return (
                <article key={item.id} className="menu-item menu-item-orderable">
                  <ResilientImage
                    src={menuItemImage(item)}
                    alt={item.name}
                    className="menu-item-photo"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3>{item.name}</h3>
                      {!item.available && (
                        <span className="menu-unavailable">Currently unavailable</span>
                      )}
                      {item.available && !validPrice && (
                        <span className="menu-unavailable">Price unavailable</span>
                      )}
                    </div>
                    <p>{item.description}</p>
                    <div className="mt-4">
                      {cartLine ? (
                        <div className="quantity-control" aria-label={`${item.name} quantity`}>
                          <button
                            type="button"
                            aria-label={`Decrease ${item.name} quantity`}
                            onClick={() =>
                              cartLine.quantity === 1
                                ? removeItem(item.id)
                                : setQuantity(item.id, cartLine.quantity - 1)
                            }
                          >
                            <Minus size={14} />
                          </button>
                          <span>{cartLine.quantity}</span>
                          <button
                            type="button"
                            aria-label={`Increase ${item.name} quantity`}
                            disabled={cartLine.quantity >= 2_147_483_647}
                            onClick={() => setQuantity(item.id, cartLine.quantity + 1)}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="add-to-cart"
                          disabled={!restaurant.available || !item.available || !validPrice}
                          onClick={() => {
                            setCartMessage("");
                            const result = addItem(restaurant, item);
                            if (result === "restaurant-conflict") {
                              setReplaceItem(item);
                            } else if (result === "added") {
                              setCartMessage(`${item.name} added to your cart.`);
                            } else {
                              setCartMessage(
                                "This restaurant or menu item is unavailable, or its price is invalid.",
                              );
                            }
                          }}
                        >
                          <Plus size={14} /> Add to cart
                        </button>
                      )}
                    </div>
                  </div>
                  <span className="menu-price">
                    {validPrice ? formatInrAmount(item.price) : "—"}
                  </span>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="state-panel state-panel-compact">
            <p>
              {menu.length
                ? "No valid menu items are currently available."
                : "No menu items have been added to this restaurant yet."}
            </p>
          </div>
        )}
        {!restaurant.available && (
          <p className="mt-4 text-sm text-stone-500">
            This restaurant is currently unavailable, so items cannot be added to an order.
          </p>
        )}
      </section>
    </div>
  );
}
