import type { MenuItem, PaymentResponse, Restaurant } from "../types/api";
import type { OrderResponse } from "../types/cart";

export function isRestaurant(value: unknown): value is Restaurant {
  if (!value || typeof value !== "object") return false;
  const restaurant = value as Record<string, unknown>;
  return (
    typeof restaurant.id === "number" &&
    Number.isSafeInteger(restaurant.id) &&
    restaurant.id > 0 &&
    typeof restaurant.name === "string" &&
    typeof restaurant.address === "string" &&
    typeof restaurant.phone === "string" &&
    typeof restaurant.available === "boolean" &&
    (restaurant.imageUrl === undefined ||
      restaurant.imageUrl === null ||
      typeof restaurant.imageUrl === "string")
  );
}

export function isMenuItem(value: unknown): value is MenuItem {
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
    typeof item.available === "boolean" &&
    (item.imageUrl === undefined ||
      item.imageUrl === null ||
      typeof item.imageUrl === "string")
  );
}

export function isPaymentResponse(value: unknown): value is PaymentResponse {
  if (!value || typeof value !== "object") return false;
  const payment = value as Record<string, unknown>;
  return (
    Number.isSafeInteger(payment.paymentId) &&
    Number(payment.paymentId) > 0 &&
    Number.isSafeInteger(payment.orderId) &&
    Number(payment.orderId) > 0 &&
    Number.isSafeInteger(payment.userId) &&
    Number(payment.userId) > 0 &&
    typeof payment.amount === "number" &&
    Number.isFinite(payment.amount) &&
    payment.amount > 0 &&
    typeof payment.paymentMethod === "string" &&
    typeof payment.status === "string" &&
    (payment.paymentDate === null ||
      (typeof payment.paymentDate === "string" &&
        Number.isFinite(Date.parse(payment.paymentDate))))
  );
}

export function isOrderResponse(value: unknown): value is OrderResponse {
  if (!value || typeof value !== "object") return false;
  const order = value as Record<string, unknown>;
  return (
    Number.isSafeInteger(order.orderId) &&
    Number(order.orderId) > 0 &&
    Number.isSafeInteger(order.userId) &&
    Number(order.userId) > 0 &&
    Number.isSafeInteger(order.restaurantId) &&
    Number(order.restaurantId) > 0 &&
    typeof order.totalAmount === "number" &&
    Number.isFinite(order.totalAmount) &&
    order.totalAmount >= 0 &&
    typeof order.status === "string" &&
    typeof order.createdAt === "string" &&
    Number.isFinite(Date.parse(order.createdAt)) &&
    Array.isArray(order.items) &&
    order.items.every((item) => {
      if (!item || typeof item !== "object") return false;
      const line = item as Record<string, unknown>;
      return (
        Number.isSafeInteger(line.menuItemId) &&
        Number(line.menuItemId) > 0 &&
        typeof line.itemName === "string" &&
        Number.isSafeInteger(line.quantity) &&
        Number(line.quantity) > 0 &&
        typeof line.price === "number" &&
        Number.isFinite(line.price) &&
        line.price > 0
      );
    })
  );
}
