import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MenuItem, Restaurant } from "../types/api";
import type { AddToCartResult, Cart, CartLine } from "../types/cart";
import { SESSION_EXPIRED_EVENT } from "../lib/api";

export const CART_STORAGE_KEY = "cravedash_cart";
export const ORDER_ATTEMPT_STORAGE_KEY = "cravedash_order_attempt";
const MAX_QUANTITY = 2_147_483_647;

interface CartContextValue {
  cart: Cart | null;
  itemCount: number;
  subtotal: number;
  storageError: string;
  addItem: (restaurant: Restaurant, item: MenuItem) => AddToCartResult;
  replaceWithItem: (restaurant: Restaurant, item: MenuItem) => AddToCartResult;
  setQuantity: (menuItemId: number, quantity: number) => void;
  removeItem: (menuItemId: number) => void;
  updateItem: (item: MenuItem) => void;
  clearCart: () => void;
}

interface InitialCart {
  cart: Cart | null;
  storageError: string;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

function isValidMenuItem(value: unknown): value is MenuItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "number" &&
    Number.isSafeInteger(item.id) &&
    item.id > 0 &&
    typeof item.restaurantId === "number" &&
    Number.isSafeInteger(item.restaurantId) &&
    item.restaurantId > 0 &&
    typeof item.name === "string" &&
    (typeof item.description === "string" || item.description === null) &&
    typeof item.price === "number" &&
    Number.isFinite(item.price) &&
    item.price > 0 &&
    typeof item.available === "boolean" &&
    (item.imageUrl === undefined ||
      item.imageUrl === null ||
      typeof item.imageUrl === "string")
  );
}

function parseCart(value: unknown): Cart | null {
  if (!value || typeof value !== "object") return null;
  const cartValue = value as Record<string, unknown>;
  if (
    typeof cartValue.restaurantId !== "number" ||
    !Number.isSafeInteger(cartValue.restaurantId) ||
    cartValue.restaurantId <= 0 ||
    typeof cartValue.restaurantName !== "string" ||
    !Array.isArray(cartValue.items)
  ) {
    return null;
  }

  const items: CartLine[] = [];
  for (const candidate of cartValue.items) {
    if (!candidate || typeof candidate !== "object") return null;
    const line = candidate as Record<string, unknown>;
    if (
      !isValidMenuItem(line) ||
      line.restaurantId !== cartValue.restaurantId ||
      typeof line.quantity !== "number" ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > MAX_QUANTITY
    ) {
      return null;
    }
    items.push({ ...line, quantity: line.quantity });
  }

  if (items.length === 0) return null;
  return {
    restaurantId: cartValue.restaurantId,
    restaurantName: cartValue.restaurantName,
    items,
  };
}

function readInitialCart(): InitialCart {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) return { cart: null, storageError: "" };
    const cart = parseCart(JSON.parse(stored) as unknown);
    return cart
      ? { cart, storageError: "" }
      : {
          cart: null,
          storageError: "Your saved cart could not be read and has been cleared.",
        };
  } catch {
    return {
      cart: null,
      storageError: "Your saved cart could not be read and has been cleared.",
    };
  }
}

function isValidCartItem(item: MenuItem): boolean {
  return (
    Number.isSafeInteger(item.id) &&
    Number.isSafeInteger(item.restaurantId) &&
    item.restaurantId > 0 &&
    typeof item.name === "string" &&
    Number.isFinite(item.price) &&
    item.price > 0 &&
    item.available
  );
}

function nextLine(items: CartLine[], item: MenuItem): CartLine[] {
  const existing = items.find((line) => line.id === item.id);
  if (existing) {
    if (existing.quantity >= MAX_QUANTITY) return items;
    return items.map((line) =>
      line.id === item.id ? { ...item, quantity: line.quantity + 1 } : line,
    );
  }
  return [...items, { ...item, quantity: 1 }];
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [initialCart] = useState(readInitialCart);
  const [cart, setCart] = useState<Cart | null>(initialCart.cart);
  const [storageError, setStorageError] = useState(initialCart.storageError);

  useEffect(() => {
    try {
      if (cart) {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      } else {
        localStorage.removeItem(CART_STORAGE_KEY);
      }
      setStorageError("");
    } catch {
      setStorageError(
        "This browser could not save your cart. Keep this tab open; checkout is disabled until cart and duplicate-order protection can be saved.",
      );
    }
  }, [cart]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== CART_STORAGE_KEY) return;
      if (!event.newValue) {
        setCart(null);
        return;
      }
      try {
        const parsed = parseCart(JSON.parse(event.newValue) as unknown);
        if (parsed) setCart(parsed);
        else setStorageError("The cart changed in another tab but could not be read.");
      } catch {
        setStorageError("The cart changed in another tab but could not be read.");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => setCart(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () =>
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  const addItem = useCallback(
    (restaurant: Restaurant, item: MenuItem): AddToCartResult => {
      if (
        !restaurant.available ||
        !isValidCartItem(item) ||
        item.restaurantId !== restaurant.id
      ) {
        return "invalid-item";
      }
      if (cart && cart.restaurantId !== restaurant.id) {
        return "restaurant-conflict";
      }
      setCart((current) => ({
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        items: nextLine(current?.items ?? [], item),
      }));
      return "added";
    },
    [cart],
  );

  const replaceWithItem = useCallback(
    (restaurant: Restaurant, item: MenuItem): AddToCartResult => {
      if (
        !restaurant.available ||
        !isValidCartItem(item) ||
        item.restaurantId !== restaurant.id
      ) {
        return "invalid-item";
      }
      setCart({
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        items: [{ ...item, quantity: 1 }],
      });
      return "added";
    },
    [],
  );

  const setQuantity = useCallback((menuItemId: number, quantity: number) => {
    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY
    ) {
      return;
    }
    setCart((current) =>
      current
        ? {
            ...current,
            items: current.items.map((line) =>
              line.id === menuItemId ? { ...line, quantity } : line,
            ),
          }
        : current,
    );
  }, []);

  const removeItem = useCallback((menuItemId: number) => {
    setCart((current) => {
      if (!current) return current;
      const items = current.items.filter((line) => line.id !== menuItemId);
      return items.length ? { ...current, items } : null;
    });
  }, []);

  const updateItem = useCallback((item: MenuItem) => {
    setCart((current) =>
      current
        ? {
            ...current,
            items: current.items.map((line) =>
              line.id === item.id ? { ...item, quantity: line.quantity } : line,
            ),
          }
        : current,
    );
  }, []);

  const clearCart = useCallback(() => setCart(null), []);

  const value = useMemo(() => {
    const items = cart?.items ?? [];
    return {
      cart,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      subtotal: items.reduce(
        (total, item) => total + item.price * item.quantity,
        0,
      ),
      storageError,
      addItem,
      replaceWithItem,
      setQuantity,
      removeItem,
      updateItem,
      clearCart,
    };
  }, [
    addItem,
    cart,
    clearCart,
    removeItem,
    replaceWithItem,
    setQuantity,
    storageError,
    updateItem,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider.");
  }
  return context;
}
