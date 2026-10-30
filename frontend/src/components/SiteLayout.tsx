import { useState } from "react";
import { ArrowUpRight, Menu, ShoppingBag, X } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export default function SiteLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated, signOut } = useAuth();
  const { itemCount, clearCart } = useCart();

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen">
      <header className="site-header">
        <div className="page-shell flex h-[76px] items-center justify-between">
          <Link
            to="/"
            className="brand-mark"
            aria-label="CraveDash home"
            onClick={closeMenu}
          >
            <span className="brand-symbol">c</span>
            <span>crave<span className="text-terracotta">dash</span></span>
          </Link>

          <button
            type="button"
            className="icon-button md:hidden"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>

          <nav
            className={`mobile-nav ${menuOpen ? "mobile-nav-open" : ""}`}
            aria-label="Main navigation"
          >
            <NavLink
              to="/"
              onClick={closeMenu}
              className={({ isActive }) =>
                `nav-link ${isActive ? "nav-link-active" : ""}`
              }
              end
            >
              Home
            </NavLink>
            <NavLink
              to="/restaurants"
              onClick={closeMenu}
              className={({ isActive }) =>
                `nav-link ${isActive ? "nav-link-active" : ""}`
              }
            >
              Restaurants
            </NavLink>
            {isAuthenticated && (
              <NavLink
                to="/cart"
                onClick={closeMenu}
                className={({ isActive }) =>
                  `nav-link cart-nav-link ${isActive ? "nav-link-active" : ""}`
                }
                aria-label={`Cart, ${itemCount} items`}
              >
                <ShoppingBag size={15} />
                Cart
                {itemCount > 0 && <span className="cart-count">{itemCount}</span>}
              </NavLink>
            )}
            {isAuthenticated && (
              <NavLink
                to="/orders"
                onClick={closeMenu}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "nav-link-active" : ""}`
                }
              >
                My orders
              </NavLink>
            )}
            {isAuthenticated && (
              <NavLink
                to="/profile"
                onClick={closeMenu}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "nav-link-active" : ""}`
                }
              >
                Profile
              </NavLink>
            )}
            {isAuthenticated ? (
              <button
                type="button"
                className="nav-cta"
                onClick={() => {
                  signOut();
                  clearCart();
                  closeMenu();
                }}
              >
                Logout
                <ArrowUpRight size={15} strokeWidth={1.8} />
              </button>
            ) : (
              <>
                <NavLink
                  to="/register"
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    `nav-link ${isActive ? "nav-link-active" : ""}`
                  }
                >
                  Register
                </NavLink>
                <Link
                  to="/login"
                  className="nav-cta"
                  onClick={closeMenu}
                >
                  Sign in
                  <ArrowUpRight size={15} strokeWidth={1.8} />
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="page-shell flex flex-col gap-3 py-7 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="brand-mark brand-mark-small">
            <span className="brand-symbol">c</span>
            <span>crave<span className="text-terracotta">dash</span></span>
          </Link>
          <p>Good food, close by.</p>
        </div>
      </footer>
    </div>
  );
}
