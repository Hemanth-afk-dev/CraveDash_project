import type { PaymentResponse } from "../types/api";
import type { OrderResponse } from "../types/cart";

export type VerifiedOrderPaymentState =
  | "confirmed"
  | "payment-failed"
  | "payment-pending";

export function getVerifiedOrderPaymentState(
  order: OrderResponse,
  payment: PaymentResponse | null,
  customerId: number,
): VerifiedOrderPaymentState {
  const paymentMatchesOrder =
    payment !== null &&
    payment.orderId === order.orderId &&
    payment.userId === customerId &&
    payment.amount === order.totalAmount &&
    payment.paymentMethod === "SIMULATED";

  if (
    order.status === "PAYMENT_FAILED" ||
    (paymentMatchesOrder && payment.status === "FAILED")
  ) {
    return "payment-failed";
  }
  if (
    order.status === "CONFIRMED" &&
    paymentMatchesOrder &&
    payment.status === "SUCCESS"
  ) {
    return "confirmed";
  }
  return "payment-pending";
}
