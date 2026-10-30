import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  ShieldAlert,
} from "lucide-react";
import { Link } from "react-router-dom";
import ResilientImage from "../components/ResilientImage";
import {
  ORDER_ATTEMPT_STORAGE_KEY,
  useCart,
} from "../context/CartContext";
import { api, getApiErrorMessage } from "../lib/api";
import { isMenuItem, isOrderResponse, isPaymentResponse } from "../lib/contracts";
import { formatInrAmount } from "../lib/currency";
import { menuItemImage } from "../lib/images";
import {
  canRetrySimulatedPayment,
  createSimulatedPaymentRequest,
} from "../lib/paymentRecovery";
import { getVerifiedOrderPaymentState } from "../lib/paymentState";
import { useAuth } from "../context/AuthContext";
import type { MenuItem, PaymentResponse } from "../types/api";
import type { OrderRequest, OrderResponse } from "../types/cart";

type CheckoutState =
  | "idle"
  | "checking"
  | "submitting"
  | "paying"
  | "confirmed"
  | "payment-failed"
  | "pending"
  | "uncertain"
  | "price-changed"
  | "error";

interface AvailabilityResponse {
  restaurantId: number;
  available: boolean;
}

interface SavedAttempt {
  key: string;
  request: OrderRequest;
  paymentStarted?: boolean;
  orderId?: number;
}

interface AttemptState {
  blocked: boolean;
  saved: SavedAttempt | null;
}

function isOrderRequest(value: unknown): value is OrderRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Record<string, unknown>;
  return (
    Number.isSafeInteger(request.restaurantId) &&
    Number(request.restaurantId) > 0 &&
    request.paymentMethod === "SIMULATED" &&
    Array.isArray(request.items) &&
    request.items.length > 0 &&
    request.items.every((item) => {
      if (!item || typeof item !== "object") return false;
      const line = item as Record<string, unknown>;
      return (
        Number.isSafeInteger(line.menuItemId) &&
        Number(line.menuItemId) > 0 &&
        Number.isSafeInteger(line.quantity) &&
        Number(line.quantity) > 0
      );
    })
  );
}

function readPendingAttempt(storageKey: string): AttemptState {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return { blocked: false, saved: null };
    const value = JSON.parse(stored) as Record<string, unknown>;
    if (
      typeof value.key === "string" &&
      /^[A-Za-z0-9._:-]{1,64}$/.test(value.key) &&
      isOrderRequest(value.request) &&
      (value.paymentStarted === undefined ||
        typeof value.paymentStarted === "boolean") &&
      (value.orderId === undefined ||
        (Number.isSafeInteger(value.orderId) && Number(value.orderId) > 0))
    ) {
      return {
        blocked: true,
        saved: {
          key: value.key,
          request: value.request,
          paymentStarted: value.paymentStarted === true,
          ...(typeof value.orderId === "number" ? { orderId: value.orderId } : {}),
        },
      };
    }
    return { blocked: true, saved: null };
  } catch {
    return { blocked: true, saved: null };
  }
}

export default function CheckoutPage() {
  const { cart, subtotal, storageError, updateItem, clearCart } = useCart();
  const { customer, profileError } = useAuth();
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("idle");
  const [message, setMessage] = useState("");
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [payments, setPayments] = useState<PaymentResponse[] | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [paymentStatusCheckSucceeded, setPaymentStatusCheckSucceeded] =
    useState(false);
  const [attempt, setAttempt] = useState<AttemptState>({ blocked: false, saved: null });
  const [attemptReady, setAttemptReady] = useState(false);
  const submissionLock = useRef(false);
  const attemptStorageKey = `${ORDER_ATTEMPT_STORAGE_KEY}:${customer?.id ?? "unknown"}`;

  function saveAttempt(saved: SavedAttempt) {
    localStorage.setItem(attemptStorageKey, JSON.stringify(saved));
    setAttempt({ blocked: true, saved });
  }

  function clearAttempt() {
    try {
      localStorage.removeItem(attemptStorageKey);
      setAttempt({ blocked: false, saved: null });
    } catch {
      setMessage((current) =>
        `${current} This browser could not clear the duplicate-order guard.`,
      );
    }
  }

  function validateOrderResponse(
    value: unknown,
    request: OrderRequest,
  ): value is OrderResponse {
    return (
      isOrderResponse(value) &&
      value.userId === customer?.id &&
      value.restaurantId === request.restaurantId
    );
  }

  async function loadPaymentRecords(orderResponse: OrderResponse) {
    const { data } = await api.get<unknown[]>(
      `/payments/order/${orderResponse.orderId}`,
    );
    if (
      !Array.isArray(data) ||
      data.length > 1 ||
      !data.every(
        (payment) =>
          isPaymentResponse(payment) &&
          payment.orderId === orderResponse.orderId &&
          payment.userId === customer?.id &&
          payment.amount === orderResponse.totalAmount &&
          payment.paymentMethod === "SIMULATED",
      )
    ) {
      throw new Error("The Payment Service returned an unexpected payment response.");
    }
    const verified = data as PaymentResponse[];
    setPayments(verified);
    setPaymentError("");
    return verified[0] ?? null;
  }

  function settleOrderStatus(
    orderResponse: OrderResponse,
    payment: PaymentResponse | null,
  ) {
    setOrder(orderResponse);
    const outcome = customer
      ? getVerifiedOrderPaymentState(orderResponse, payment, customer.id)
      : "payment-pending";
    if (outcome === "payment-failed") {
      setCheckoutState("payment-failed");
      setMessage("Payment Failed. The order was not confirmed; you can view its recorded status in My Orders.");
      clearAttempt();
      return;
    }
    if (outcome === "confirmed") {
      setCheckoutState("confirmed");
      setMessage("Payment Successful. The Order Service confirmed this order. This was simulated; no real money was charged.");
      clearCart();
      clearAttempt();
      return;
    }
    setCheckoutState("pending");
    setMessage(
      orderResponse.status === "CONFIRMED"
        ? "The order response says confirmed, but a matching successful payment could not be verified. No success is being shown; check status again."
        : payment?.status === "SUCCESS"
          ? "Payment succeeded, but the Order Service has not confirmed the order yet. Check status again."
          : "Order created. Payment Pending; no successful payment has been confirmed.",
    );
  }

  useEffect(() => {
    if (!customer) return;
    setAttempt(readPendingAttempt(attemptStorageKey));
    setAttemptReady(true);
  }, [attemptStorageKey, customer]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      submissionLock.current ||
      !customer ||
      (!cart?.items.length && !attempt.saved) ||
      (attempt.blocked && !attempt.saved)
    ) {
      return;
    }

    if (!attempt.saved && (
      !cart ||
      !Number.isFinite(subtotal) ||
      subtotal <= 0 ||
      cart.items.some(
        (item) =>
          !Number.isSafeInteger(item.quantity) ||
          item.quantity < 1 ||
          !Number.isFinite(item.price) ||
          item.price <= 0 ||
          !Number.isFinite(item.price * item.quantity),
      )
    )) {
      setCheckoutState("error");
      setMessage("The cart contains an invalid quantity or menu price. Review it before continuing.");
      return;
    }

    setCheckoutState("checking");
    setPayments(null);
    setPaymentError("");
    setPaymentStatusCheckSucceeded(false);
    setMessage(
      attempt.saved
        ? "Checking the saved order with the same idempotency key."
        : "",
    );

    let request: OrderRequest;
    let idempotencyKey: string;
    if (attempt.saved) {
      request = attempt.saved.request;
      idempotencyKey = attempt.saved.key;
    } else {
      if (!cart) return;
      try {
        const [availabilityResponse, menuResponse] = await Promise.all([
          api.get<AvailabilityResponse>(
            `/restaurants/${cart.restaurantId}/availability`,
          ),
          api.get<MenuItem[]>(`/restaurants/${cart.restaurantId}/menu`),
        ]);
        const availability = availabilityResponse.data;
        const liveMenu = menuResponse.data;
        if (
          availability.restaurantId !== cart.restaurantId ||
          typeof availability.available !== "boolean" ||
          !Array.isArray(liveMenu) ||
          !liveMenu.every(isMenuItem)
        ) {
          throw new Error("The restaurant service returned an unexpected checkout response.");
        }
        if (!availability.available) {
          setCheckoutState("error");
          setMessage("This restaurant is no longer available. Your cart has been kept.");
          return;
        }

        let changed = false;
        for (const savedItem of cart.items) {
          const currentItem = liveMenu.find((item) => item.id === savedItem.id);
          if (
            !currentItem ||
            currentItem.restaurantId !== cart.restaurantId ||
            !currentItem.available
          ) {
            setCheckoutState("error");
            setMessage(
              `${savedItem.name} is no longer on this restaurant’s available menu. Remove it from your cart to continue.`,
            );
            return;
          }
          if (!Number.isFinite(currentItem.price) || currentItem.price <= 0) {
            setCheckoutState("error");
            setMessage(
              `${savedItem.name} has an invalid live menu price and cannot be ordered.`,
            );
            return;
          }
          if (
            currentItem.price !== savedItem.price ||
            currentItem.name !== savedItem.name ||
            currentItem.description !== savedItem.description ||
            currentItem.imageUrl !== savedItem.imageUrl
          ) {
            changed = true;
            updateItem(currentItem);
          }
        }
        if (changed) {
          setCheckoutState("price-changed");
          setMessage(
            "The live menu changed since you added these items. Your cart has been updated; review the new amounts and place the order again.",
          );
          return;
        }
      } catch (error: unknown) {
        setCheckoutState("error");
        setMessage(getApiErrorMessage(error));
        return;
      }

      request = {
        restaurantId: cart.restaurantId,
        items: cart.items.map((item) => ({
          menuItemId: item.id,
          quantity: item.quantity,
        })),
        paymentMethod: "SIMULATED",
      };
      try {
        idempotencyKey = crypto.randomUUID();
        const savedAttempt = { key: idempotencyKey, request, paymentStarted: false };
        saveAttempt(savedAttempt);
      } catch {
        setCheckoutState("error");
        setMessage(
          "This browser could not save duplicate-order protection. No order was sent.",
        );
        return;
      }
    }

    submissionLock.current = true;
    setCheckoutState("submitting");
    try {
      const { data } = await api.post<OrderResponse>("/orders", request, {
        headers: { "Idempotency-Key": idempotencyKey },
      });
      if (!validateOrderResponse(data, request)) {
        setCheckoutState("uncertain");
        setMessage(
          "The Order Service responded, but its order did not match the API contract. Keep this page and check the same order again.",
        );
        return;
      }
      try {
        saveAttempt({
          ...(attempt.saved ?? { key: idempotencyKey, request }),
          orderId: data.orderId,
        });
      } catch (error: unknown) {
        setOrder(data);
        setCheckoutState("uncertain");
        setMessage(
          "The order was received, but its status could not be saved safely in this browser. Do not submit a new order; check My Orders.",
        );
        return;
      }
      try {
        const payment = await loadPaymentRecords(data);
        settleOrderStatus(data, payment);
      } catch (error: unknown) {
        setOrder(data);
        setCheckoutState("pending");
        setPaymentError(getApiErrorMessage(error));
        setMessage("Order created. Payment status could not be verified; no successful payment is being shown. Check status before continuing.");
      }
    } catch (error: unknown) {
      setCheckoutState("uncertain");
      setMessage(
        `${getApiErrorMessage(error)} The order may have been recorded. Check again using the saved order status action; the same idempotency key prevents a duplicate.`,
      );
    } finally {
      submissionLock.current = false;
    }
  }

  async function checkOrderStatus() {
    if (submissionLock.current || !customer || !attempt.saved) return;
    submissionLock.current = true;
    setCheckoutState("checking");
    setPayments(null);
    setPaymentStatusCheckSucceeded(false);
    setMessage("Checking the saved order and payment status. No payment retry will be sent.");
    setPaymentError("");
    try {
      const { data } = await api.post<unknown>("/orders", attempt.saved.request, {
        headers: { "Idempotency-Key": attempt.saved.key },
      });
      if (!validateOrderResponse(data, attempt.saved.request)) {
        throw new Error("The Order Service returned an unexpected order response.");
      }
      saveAttempt({ ...attempt.saved, orderId: data.orderId });
      const payment = await loadPaymentRecords(data);
      setPaymentStatusCheckSucceeded(true);
      settleOrderStatus(data, payment);
    } catch (error: unknown) {
      setCheckoutState("uncertain");
      setPayments(null);
      setPaymentStatusCheckSucceeded(false);
      setPaymentError(getApiErrorMessage(error));
      setMessage("The order or payment status is still uncertain. No payment retry was sent; check again later.");
    } finally {
      submissionLock.current = false;
    }
  }

  async function startSimulatedPayment(isRecoveryRetry = false) {
    if (
      submissionLock.current ||
      !customer ||
      !order ||
      !attempt.saved ||
      order.status !== "PAYMENT_PENDING" ||
      payments === null ||
      payments.length > 0
    ) {
      return;
    }
    if (
      isRecoveryRetry
        ? !canRetrySimulatedPayment(
            order,
            payments,
            paymentStatusCheckSucceeded,
          ) || !attempt.saved.paymentStarted
        : attempt.saved.paymentStarted
    ) {
      return;
    }

    const savedAttempt = {
      ...attempt.saved,
      orderId: order.orderId,
      paymentStarted: true,
    };
    try {
      saveAttempt(savedAttempt);
    } catch {
      setCheckoutState("pending");
      setMessage("Payment was not started because duplicate-payment protection could not be saved.");
      return;
    }

    submissionLock.current = true;
    setCheckoutState("paying");
    setPaymentStatusCheckSucceeded(false);
    setPaymentError("");
    setMessage("Starting the explicitly requested simulated payment. No real money will be charged.");
    try {
      const { data } = await api.post<unknown>(
        "/payments",
        createSimulatedPaymentRequest(
          savedAttempt.orderId,
          customer.id,
          order.totalAmount,
        ),
      );
      if (
        !isPaymentResponse(data) ||
        data.orderId !== order.orderId ||
        data.userId !== customer.id ||
        data.amount !== order.totalAmount ||
        data.paymentMethod !== "SIMULATED"
      ) {
        throw new Error("The Payment Service returned an unexpected payment response.");
      }
      setPayments([data]);
      if (data.status === "PENDING") {
        settleOrderStatus(order, data);
        return;
      }
      const { data: reconciled } = await api.post<unknown>(
        "/orders",
        savedAttempt.request,
        { headers: { "Idempotency-Key": savedAttempt.key } },
      );
      if (!validateOrderResponse(reconciled, savedAttempt.request)) {
        throw new Error("The Order Service could not verify the payment outcome.");
      }
      settleOrderStatus(reconciled, data);
    } catch (error: unknown) {
      setCheckoutState("uncertain");
      setPaymentError(getApiErrorMessage(error));
      setMessage("Payment outcome is uncertain. Do not retry payment; use Check status to safely verify it.");
    } finally {
      submissionLock.current = false;
    }
  }

  if (!attemptReady && profileError && !order) {
    return (
      <div className="page-shell page-top-space">
        <div className="state-panel state-panel-compact" role="alert">
          <h1 className="font-display text-2xl">Account unavailable.</h1>
          <p>{profileError}</p>
          <Link to="/login" className="button-primary mt-2">
            Sign in again <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  if (!attemptReady && !order) {
    return (
      <div className="page-shell page-top-space">
        <div className="state-panel state-panel-compact" role="status">
          <LoaderCircle size={20} className="animate-spin" />
          <p>Loading your customer account…</p>
        </div>
      </div>
    );
  }

  if (!cart && !attempt.saved && !order) {
    return (
      <div className="page-shell page-top-space">
        <div className="state-panel state-panel-compact">
          <h1 className="font-display text-2xl">Your cart is empty.</h1>
          <p>Choose an item from a restaurant menu before checking out.</p>
          <Link to="/restaurants" className="button-primary mt-2">
            Browse restaurants <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  if (order) {
    const confirmed = checkoutState === "confirmed";
    const paymentFailed = checkoutState === "payment-failed";
    const isBusy =
      checkoutState === "checking" ||
      checkoutState === "submitting" ||
      checkoutState === "paying";
    const canStartPayment =
      order.status === "PAYMENT_PENDING" &&
      payments?.length === 0 &&
      Boolean(attempt.saved) &&
      attempt.saved?.paymentStarted !== true;
    const canRetryPayment =
      attempt.saved?.paymentStarted === true &&
      canRetrySimulatedPayment(
        order,
        payments,
        paymentStatusCheckSucceeded,
      );
    return (
      <div className="page-shell page-top-space">
        <section className={`order-result ${confirmed ? "order-result-success" : ""}`}>
          <span className="state-icon">
            {confirmed ? <CheckCircle2 size={22} /> : <ShieldAlert size={22} />}
          </span>
          <span className="eyebrow eyebrow-muted">Order #{order.orderId}</span>
          <h1 className="page-title">
            {confirmed
              ? "Order confirmed."
              : paymentFailed
                ? "Payment failed."
                : "Payment pending."}
          </h1>
          <p className="section-subtitle">{message}</p>
          <div className="order-result-summary">
            <span>Backend order status</span><strong>{order.status}</strong>
            <span>Backend-calculated total (INR display)</span>
            <strong>{formatInrAmount(order.totalAmount)}</strong>
            <span>Payment status</span>
            <strong>
              {paymentError
                ? "Unable to verify"
                : payments === null
                  ? isBusy
                    ? "Checking…"
                    : "Not verified"
                  : payments.length
                    ? payments.map((payment) => payment.status).join(", ")
                    : "PENDING"}
            </strong>
          </div>
          {paymentError && (
            <p className="summary-note mt-3" role="status">
              The order was received, but its payment status could not be verified: {paymentError}
              {" "}Check My Orders; no payment retry was sent.
            </p>
          )}
          {payments?.length === 0 && (
            <p className="summary-note mt-3">
              No payment record exists yet. Payment will not be attempted unless you choose the simulated payment action.
            </p>
          )}
          <Link to="/orders" className="button-primary mt-7">
            View my orders <ArrowRight size={16} />
          </Link>
          {!confirmed && !paymentFailed && attempt.saved && (
            <div className="mt-4 flex flex-wrap gap-3">
              {canStartPayment || canRetryPayment ? (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => startSimulatedPayment(canRetryPayment)}
                  disabled={isBusy}
                >
                  {isBusy
                    ? "Starting payment…"
                    : canRetryPayment
                      ? "Retry Simulated Payment"
                      : "Start simulated payment"}
                </button>
              ) : (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={checkOrderStatus}
                  disabled={isBusy}
                >
                  {isBusy ? "Checking status…" : "Check order/payment status"}
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    );
  }

  const isBusy =
    checkoutState === "checking" ||
    checkoutState === "submitting" ||
    checkoutState === "paying";
  const unrecoverableAttempt = attempt.blocked && !attempt.saved;

  return (
    <div className="page-shell page-top-space">
      <Link to="/cart" className="back-link">
        <ArrowLeft size={15} /> Back to cart
      </Link>
      <div className="cart-page-heading">
        <div>
          <span className="eyebrow eyebrow-muted">One last look</span>
          <h1 className="page-title">Checkout.</h1>
          <p className="section-subtitle">
            {cart?.restaurantName ?? "Saved order"} · Your customer identity is securely linked to your account.
          </p>
        </div>
      </div>

      {storageError && (
        <div className="cart-notice cart-notice-warning mb-5" role="alert">
          <p>{storageError}</p>
        </div>
      )}
      {!customer && (
        <div className="cart-notice cart-notice-warning mb-5" role="alert">
          <p>Your customer profile is unavailable. Sign in again before placing an order.</p>
        </div>
      )}
      {attempt.blocked && (
        <div className="cart-notice cart-notice-warning mb-5" role="status">
          <p>
            {attempt.saved
              ? "A previous submission has no confirmed outcome. You can safely check it again with its original idempotency key."
              : "A previous submission is saved but could not be read. Checkout is blocked because its outcome is uncertain; do not submit another order."}
          </p>
        </div>
      )}
      {message && (
        <div
          className={`cart-notice ${checkoutState === "error" || checkoutState === "uncertain" ? "cart-notice-warning" : ""} mb-5`}
          role={checkoutState === "error" ? "alert" : "status"}
        >
          {isBusy ? <LoaderCircle size={18} className="animate-spin" /> : <AlertCircle size={18} />}
          <p>{message}</p>
        </div>
      )}

      <div className="cart-layout checkout-layout">
        <section className="checkout-form-card">
          <span className="eyebrow eyebrow-muted">Customer account</span>
          <h2>Order details</h2>
          <p className="checkout-explainer">
            Your customer ID comes from your validated login token. The frontend does not accept or send a customer ID.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="payment-disclosure">
              <span className="eyebrow eyebrow-muted">Payment</span>
              <p><strong>Simulated payment only — not started yet</strong></p>
              <p>
                Payment starts only after order creation, when you choose the simulated payment action. No real money will be charged.
              </p>
            </div>
            <p className="checkout-explainer">
              Amounts are displayed in INR; the Order Service contract has no currency field. Delivery fees and tax are not included.
            </p>
            {storageError || unrecoverableAttempt ? (
              <button type="button" className="button-primary w-full" disabled>
                Checkout unavailable
              </button>
            ) : (
              <button type="submit" className="button-primary w-full" disabled={isBusy}>
                {isBusy ? (
                  <>
                    <LoaderCircle size={17} className="animate-spin" />
                    {checkoutState === "checking"
                      ? "Checking live menu/order…"
                      : checkoutState === "paying"
                        ? "Starting simulated payment…"
                        : "Placing order…"}
                  </>
                ) : (
                  <>
                    {attempt.saved ? "Check saved order status" : "Place order"}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            )}
          </form>
          <p className="checkout-disclaimer">
            Before a new order is submitted, the frontend checks live restaurant availability and menu data. The Order Service recalculates the total using its own restaurant data.
          </p>
        </section>

        <aside className="cart-summary">
          <span className="eyebrow eyebrow-muted">Order summary</span>
          {cart?.items.map((item) => (
            <div className="checkout-line" key={item.id}>
              <span className="flex min-w-0 items-center gap-3">
                <ResilientImage
                  src={menuItemImage(item)}
                  alt={item.name}
                  className="checkout-line-photo"
                  loading="lazy"
                />
                <span>{item.quantity} × {item.name}</span>
              </span>
              <strong>{formatInrAmount(item.price * item.quantity)}</strong>
            </div>
          ))}
          <div className="summary-row">
            <span>Estimated total</span>
            <strong>{formatInrAmount(cart?.items.reduce((sum, item) => sum + item.price * item.quantity, 0) ?? 0)}</strong>
          </div>
          <p className="summary-note">
            Displayed in INR. The backend-calculated numeric total is authoritative; currency metadata and extra fees are not supplied.
          </p>
          <Link to="/cart" className="summary-back">
            <ArrowLeft size={14} /> Edit cart
          </Link>
        </aside>
      </div>
    </div>
  );
}
