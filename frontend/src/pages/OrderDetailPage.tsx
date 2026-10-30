import { useEffect, useState } from "react";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, getApiErrorMessage } from "../lib/api";
import { isOrderResponse, isPaymentResponse } from "../lib/contracts";
import { getVerifiedOrderPaymentState } from "../lib/paymentState";
import { formatInrAmount } from "../lib/currency";
import type { PaymentResponse } from "../types/api";
import type { OrderResponse } from "../types/cart";

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const { customer } = useAuth();
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [payments, setPayments] = useState<PaymentResponse[] | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);

  useEffect(() => {
    const id = Number(orderId);
    setOrder(null);
    setErrorMessage("");
    setPayments(null);
    setPaymentError("");
    if (!Number.isSafeInteger(id) || id <= 0) {
      setErrorMessage("This order number is not valid.");
      return;
    }
    if (!customer) return;

    const controller = new AbortController();
    const loadOrderAndPayment = async () => {
      try {
        const { data } = await api.get<unknown>(`/orders/${id}`, {
          signal: controller.signal,
        });
        if (!isOrderResponse(data) || data.orderId !== id || data.userId !== customer?.id) {
          throw new Error("The Order Service returned an unexpected order response.");
        }
        setOrder(data);
        setPaymentLoading(true);
        try {
          const { data: paymentData } = await api.get<unknown[]>(
            `/payments/order/${id}`,
            { signal: controller.signal },
          );
          const verifiedPayments = Array.isArray(paymentData)
            ? paymentData.filter(isPaymentResponse)
            : [];
          if (
            !Array.isArray(paymentData) ||
            verifiedPayments.length !== paymentData.length ||
            verifiedPayments.length > 1 ||
            verifiedPayments.some(
              (payment) =>
                payment.orderId !== id ||
                payment.userId !== customer?.id ||
                payment.amount !== data.totalAmount ||
                payment.paymentMethod !== "SIMULATED",
            )
          ) {
            throw new Error("The Payment Service returned an unexpected payment response.");
          }
          setPayments(verifiedPayments);
        } catch (error: unknown) {
          if (!controller.signal.aborted) {
            setPaymentError(getApiErrorMessage(error));
          }
        } finally {
          if (!controller.signal.aborted) setPaymentLoading(false);
        }
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        setErrorMessage(getApiErrorMessage(error));
      }
    };
    void loadOrderAndPayment();
    return () => controller.abort();
  }, [customer?.id, orderId]);

  const verifiedPayment = payments?.length === 1 ? payments[0] : null;
  const paymentOutcome =
    order && customer
      ? getVerifiedOrderPaymentState(order, verifiedPayment, customer.id)
      : "payment-pending";

  return (
    <div className="page-shell page-top-space">
      <Link to="/orders" className="back-link">
        <ArrowLeft size={15} /> Back to my orders
      </Link>
      {errorMessage ? (
        <div className="state-panel state-panel-compact mt-5" role="alert">
          <h1 className="font-display text-2xl">Order unavailable.</h1>
          <p>{errorMessage}</p>
        </div>
      ) : !order ? (
        <div className="state-panel state-panel-compact mt-5" role="status">
          <LoaderCircle size={20} className="animate-spin" />
          <p>Loading order details…</p>
        </div>
      ) : (
        <section className="checkout-form-card mt-5">
          <span className="eyebrow eyebrow-muted">Order #{order.orderId}</span>
          <h1 className="page-title mt-2">Order details.</h1>
          <div className="order-result-summary mt-5">
            <span>Restaurant</span><strong>#{order.restaurantId}</strong>
            <span>Order status</span>
            <strong>
              {paymentOutcome === "confirmed"
                ? "CONFIRMED"
                : paymentOutcome === "payment-failed"
                  ? "PAYMENT_FAILED"
                  : "PAYMENT_PENDING"}
            </strong>
            <span>Backend order status</span><strong>{order.status}</strong>
            <span>Payment status</span>
            <strong>
              {paymentError
                ? "Unable to verify"
                : paymentLoading
                  ? "Checking…"
                  : payments?.length
                    ? payments.map((payment) => payment.status).join(", ")
                    : "PENDING"}
            </strong>
            <span>Placed</span><strong>{new Date(order.createdAt).toLocaleString()}</strong>
          </div>
          {paymentError && (
            <p className="summary-note mt-3" role="status">
              Payment status could not be verified: {paymentError}. No payment retry was sent.
            </p>
          )}
          {payments?.length === 0 && (
            <p className="summary-note mt-3">
              The Payment Service has not returned a payment record for this order.
            </p>
          )}
          <h2 className="mt-7 text-lg font-semibold">Items</h2>
          <div className="mt-3 divide-y divide-stone-200">
            {order.items.map((item) => (
              <div className="checkout-line" key={item.menuItemId}>
                <span>{item.quantity} × {item.itemName}</span>
                <strong>{formatInrAmount(item.price * item.quantity)}</strong>
              </div>
            ))}
          </div>
          <div className="summary-row mt-4">
            <span>Order total (INR display)</span>
            <strong>{formatInrAmount(order.totalAmount)}</strong>
          </div>
          <p className="summary-note mt-3">
            The Payment Service is simulated. No real payment was processed.
          </p>
        </section>
      )}
    </div>
  );
}
