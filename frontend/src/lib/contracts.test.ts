// Runtime validation coverage for API response contracts.
import { describe, expect, it } from "vitest";
import {
  isMenuItem,
  isOrderResponse,
  isPaymentResponse,
  isRestaurant,
} from "./contracts";

describe("API response contracts", () => {
  it("accepts live restaurant and menu response shapes", () => {
    expect(
      isRestaurant({
        id: 1,
        name: "Spice Hub",
        address: "Main Street",
        phone: "555-0100",
        available: true,
        imageUrl: null,
      }),
    ).toBe(true);
    expect(
      isMenuItem({
        id: 2,
        restaurantId: 1,
        name: "Chicken Biryani",
        description: null,
        price: 250,
        available: true,
        imageUrl: null,
      }),
    ).toBe(true);
  });

  it("rejects malformed or invalid payment responses", () => {
    const payment = {
      paymentId: 9,
      orderId: 4,
      userId: 7,
      amount: 250,
      paymentMethod: "SIMULATED",
      status: "SUCCESS",
      paymentDate: "2025-01-15T12:30:00",
    };

    expect(isPaymentResponse(payment)).toBe(true);
    expect(isPaymentResponse({ ...payment, amount: 0 })).toBe(false);
    expect(isPaymentResponse({ ...payment, paymentDate: "not-a-date" })).toBe(
      false,
    );
  });

  it("accepts a customer order response with authoritative totals", () => {
    expect(
      isOrderResponse({
        orderId: 4,
        userId: 7,
        restaurantId: 1,
        totalAmount: 250,
        status: "CONFIRMED",
        createdAt: "2025-01-15T12:30:00",
        items: [
          {
            menuItemId: 2,
            itemName: "Chicken Biryani",
            quantity: 1,
            price: 250,
          },
        ],
      }),
    ).toBe(true);
  });
});
