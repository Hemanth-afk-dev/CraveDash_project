import type { MenuItem } from "./api";

export interface CartLine extends MenuItem {
  quantity: number;
}

export interface Cart {
  restaurantId: number;
  restaurantName: string;
  items: CartLine[];
}

export type AddToCartResult =
  | "added"
  | "restaurant-conflict"
  | "invalid-item";

export interface OrderRequest {
  restaurantId: number;
  items: Array<{
    menuItemId: number;
    quantity: number;
  }>;
  paymentMethod: string;
}

export interface OrderResponse {
  orderId: number;
  userId: number;
  restaurantId: number;
  totalAmount: number;
  status: string;
  createdAt: string;
  items: Array<{
    menuItemId: number;
    itemName: string;
    quantity: number;
    price: number;
  }>;
}
