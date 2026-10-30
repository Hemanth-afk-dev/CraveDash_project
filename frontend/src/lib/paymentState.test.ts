import { describe, expect, it } from "vitest";
import { getVerifiedOrderPaymentState } from "./paymentState";
import type { PaymentResponse } from "../types/api";
import type { OrderResponse } from "../types/cart";

const order: OrderResponse = {
  orderId: 12,
  userId: 5,
  restaurantId: 3,
  totalAmount: 450,
  status: "CONFIRMED",
  createdAt: "2026-10-30T12:00:00",
  items: [],
};

const payment: PaymentResponse = {
  paymentId: 8,
  orderId: 12,
  userId: 5,
  amount: 450,
  paymentMethod: "SIMULATED",
  status: "SUCCESS",
  paymentDate: "2026-10-30T12:00:00",
};

describe("verified order payment state", () => {
  it("only confirms when order and matching payment both succeeded", () => {
    expect(getVerifiedOrderPaymentState(order, payment, 5)).toBe("confirmed");
    expect(getVerifiedOrderPaymentState(order, null, 5)).toBe("payment-pending");
  });

  it("does not confirm a pending or mismatched payment", () => {
    expect(
      getVerifiedOrderPaymentState(
        { ...order, status: "PAYMENT_PENDING" },
        payment,
        5,
      ),
    ).toBe("payment-pending");
    expect(
      getVerifiedOrderPaymentState(order, { ...payment, amount: 451 }, 5),
    ).toBe("payment-pending");
  });

  it("reports failed payment without confirming the order", () => {
    expect(
      getVerifiedOrderPaymentState(
        { ...order, status: "PAYMENT_PENDING" },
        { ...payment, status: "FAILED" },
        5,
      ),
    ).toBe("payment-failed");
    expect(
      getVerifiedOrderPaymentState(
        { ...order, status: "PAYMENT_FAILED" },
        null,
        5,
      ),
    ).toBe("payment-failed");
  });
});
