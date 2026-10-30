import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import ResilientImage from "../components/ResilientImage";
import { menuItemImage } from "../lib/images";
import { formatInrAmount } from "../lib/currency";

export default function CartPage() {
  const { cart, itemCount, subtotal, storageError, setQuantity, removeItem } =
    useCart();

  return (
    <div className="page-shell page-top-space">
      <Link to="/restaurants" className="back-link">
        <ArrowLeft size={15} /> Keep exploring
      </Link>
      <div className="cart-page-heading">
        <div>
          <span className="eyebrow eyebrow-muted">A few good choices</span>
          <h1 className="page-title">Your cart.</h1>
          <p className="section-subtitle">
            {itemCount} {itemCount === 1 ? "item" : "items"}
            {cart ? ` from ${cart.restaurantName}` : ""}
          </p>
        </div>
        <span className="cart-heading-icon"><ShoppingBag size={24} /></span>
      </div>

      {storageError && (
        <div className="cart-notice cart-notice-warning mb-5" role="alert">
          <p>{storageError}</p>
        </div>
      )}

      {!cart ? (
        <div className="state-panel state-panel-compact cart-empty">
          <span className="state-icon"><ShoppingBag size={21} /></span>
          <h3>Your cart is ready for something good.</h3>
          <p>Explore a restaurant’s live menu to add an item.</p>
          <Link to="/restaurants" className="button-primary mt-2">
            Find a restaurant <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <>
          <div className="cart-layout">
            <section className="cart-lines" aria-label="Cart items">
              {cart.items.map((item) => (
                <article className="cart-line" key={item.id}>
                  <ResilientImage
                    src={menuItemImage(item)}
                    alt={item.name}
                    className="cart-line-photo"
                    loading="lazy"
                  />
                  <div className="cart-line-copy">
                    <h2>{item.name}</h2>
                    <p>{item.description}</p>
                    <div className="cart-line-controls">
                      <div className="quantity-control" aria-label={`${item.name} quantity`}>
                        <button
                          type="button"
                          aria-label={`Decrease ${item.name} quantity`}
                          onClick={() =>
                            item.quantity === 1
                              ? removeItem(item.id)
                              : setQuantity(item.id, item.quantity - 1)
                          }
                        >
                          <Minus size={14} />
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          aria-label={`Increase ${item.name} quantity`}
                          disabled={item.quantity >= 2_147_483_647}
                          onClick={() => setQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="remove-item"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                  </div>
                  <div className="cart-line-price">
                    <span>{formatInrAmount(item.price * item.quantity)}</span>
                    <small>{formatInrAmount(item.price)} each</small>
                  </div>
                </article>
              ))}
            </section>

            <aside className="cart-summary">
              <span className="eyebrow eyebrow-muted">Order summary</span>
              <div className="summary-row">
                <span>Subtotal</span>
                <strong>{formatInrAmount(subtotal)}</strong>
              </div>
              <p className="summary-note">
                Amounts are displayed in INR; currency is not represented in
                the API. Delivery fees and taxes are not included. Prices are
                checked again before an order is sent.
              </p>
              {storageError || !Number.isFinite(subtotal) ? (
                <button type="button" className="button-primary w-full" disabled>
                  Checkout unavailable
                </button>
              ) : (
                <Link to="/checkout" className="button-primary w-full">
                  Continue to checkout <ArrowRight size={16} />
                </Link>
              )}
              <Link to={`/restaurants/${cart.restaurantId}`} className="summary-back">
                <ArrowLeft size={14} /> Back to {cart.restaurantName}
              </Link>
            </aside>
          </div>
          <p className="mt-5 pb-12 text-center text-xs text-stone-400">
            This cart is a saved snapshot, not an authoritative quote. The Order Service verifies availability and prices.
          </p>
        </>
      )}
    </div>
  );
}
