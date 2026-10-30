import { useEffect, useState } from "react";
import { ArrowRight, LoaderCircle, PackageSearch } from "lucide-react";
import { Link } from "react-router-dom";
import { api, getApiErrorMessage } from "../lib/api";
import { isOrderResponse } from "../lib/contracts";
import { formatInrAmount } from "../lib/currency";
import type { OrderResponse } from "../types/cart";

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderResponse[] | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    api.get<unknown[]>("/orders/mine", { signal: controller.signal })
      .then(({ data }) => {
        if (!Array.isArray(data) || !data.every(isOrderResponse)) {
          throw new Error("The Order Service returned an unexpected order-history response.");
        }
        setOrders(data);
        setErrorMessage("");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(getApiErrorMessage(error));
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="page-shell page-top-space">
      <div className="cart-page-heading">
        <div>
          <span className="eyebrow eyebrow-muted">Your CraveDash account</span>
          <h1 className="page-title">My orders.</h1>
          <p className="section-subtitle">A record of orders associated with your account.</p>
        </div>
      </div>

      {orders === null && !errorMessage && (
        <div className="state-panel state-panel-compact" role="status">
          <LoaderCircle size={20} className="animate-spin" />
          <p>Loading your orders…</p>
        </div>
      )}
      {errorMessage && (
        <div className="state-panel state-panel-compact" role="alert">
          <p>{errorMessage}</p>
        </div>
      )}
      {orders?.length === 0 && (
        <div className="state-panel state-panel-compact">
          <PackageSearch size={24} />
          <h2 className="font-display text-2xl">No orders yet.</h2>
          <p>Your orders will appear here after you place one.</p>
          <Link to="/restaurants" className="button-primary mt-2">
            Explore restaurants <ArrowRight size={16} />
          </Link>
        </div>
      )}
      {orders && orders.length > 0 && (
        <div className="grid gap-4">
          {orders.map((order) => (
            <article className="checkout-form-card" key={order.orderId}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span className="eyebrow eyebrow-muted">Order #{order.orderId}</span>
                  <h2 className="mt-1 text-lg font-semibold">Restaurant #{order.restaurantId}</h2>
                  <p className="mt-1 text-sm text-stone-500">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <span className="eyebrow eyebrow-muted">Status</span>
                  <p className="font-semibold">{order.status}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-stone-200 pt-4">
                <span className="text-sm text-stone-600">Order total (INR display)</span>
                <strong>{formatInrAmount(order.totalAmount)}</strong>
              </div>
              <Link to={`/orders/${order.orderId}`} className="summary-back mt-4">
                Order details <ArrowRight size={14} />
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
