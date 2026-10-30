import { describe, expect, it } from "vitest";
import type { PaymentResponse } from "../types/api";
import type { OrderResponse } from "../types/cart";
import {
  canRetrySimulatedPayment,
  createSimulatedPaymentRequest,
} from "./paymentRecovery";

const pendingOrder: OrderResponse = {
  orderId: 42,
  userId: 7,
  restaurantId: 3,
  totalAmount: 280,
  status: "PAYMENT_PENDING",
  createdAt: "2026-10-30T12:00:00",
  items: [],
};

const payment: PaymentResponse = {
  paymentId: 9,
  orderId: pendingOrder.orderId,
  userId: pendingOrder.userId,
  amount: pendingOrder.totalAmount,
  paymentMethod: "SIMULATED",
  status: "SUCCESS",
  paymentDate: "2026-10-30T12:00:00",
};

describe("simulated payment recovery", () => {
  it("allows retry after an explicit successful check finds no payment", () => {
    expect(canRetrySimulatedPayment(pendingOrder, [], true)).toBe(true);
  });

  it("requires a status check after a payment request times out", () => {
    expect(canRetrySimulatedPayment(pendingOrder, null, false)).toBe(false);
    expect(canRetrySimulatedPayment(pendingOrder, [], true)).toBe(true);
  });

  it("never retries when a successful payment already exists", () => {
    expect(canRetrySimulatedPayment(pendingOrder, [payment], true)).toBe(false);
  });

  it("never retries when a failed payment record already exists", () => {
    expect(
      canRetrySimulatedPayment(
        pendingOrder,
        [{ ...payment, status: "FAILED" }],
        true,
      ),
    ).toBe(false);
  });

  it("does not allow retry when the payment-status API is unavailable", () => {
    expect(canRetrySimulatedPayment(pendingOrder, null, false)).toBe(false);
  });

  it("reuses the exact original order, customer, amount, and simulated method", () => {
    expect(
      createSimulatedPaymentRequest(
        pendingOrder.orderId,
        pendingOrder.userId,
        pendingOrder.totalAmount,
      ),
    ).toEqual({
      orderId: 42,
      userId: 7,
      amount: 280,
      paymentMethod: "SIMULATED",
    });
  });
});
