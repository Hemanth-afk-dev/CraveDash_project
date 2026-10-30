import type { PaymentResponse } from "../types/api";
import type { OrderResponse } from "../types/cart";

export interface SimulatedPaymentRequest {
  orderId: number;
  userId: number;
  amount: number;
  paymentMethod: "SIMULATED";
}

export function canRetrySimulatedPayment(
  order: OrderResponse | null,
  payments: PaymentResponse[] | null,
  statusCheckSucceeded: boolean,
): boolean {
  return (
    statusCheckSucceeded &&
    order?.status === "PAYMENT_PENDING" &&
    payments !== null &&
    payments.length === 0
  );
}

export function createSimulatedPaymentRequest(
  orderId: number,
  customerId: number,
  amount: number,
): SimulatedPaymentRequest {
  return {
    orderId,
    userId: customerId,
    amount,
    paymentMethod: "SIMULATED",
  };
}
