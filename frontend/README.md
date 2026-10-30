# CraveDash frontend

## Run locally

Start Eureka, the Restaurant/User/Order/Payment services, and the API Gateway
as described in the repository [README](../README.md). From this directory:

```powershell
npm install
npm run dev
```

The Vite server runs at `http://localhost:5173`. The development environment
uses the API Gateway at `http://localhost:8080`; set `VITE_API_BASE_URL` when
the gateway runs elsewhere. The gateway must allow the frontend's exact origin
through `REACT_APP_ORIGIN`.

Run `npm run typecheck` for TypeScript validation, `npm test` for focused API
contract tests, and `npm run build` for the production bundle.

## Implemented live flows

| Frontend action | API Gateway endpoint | Behavior |
| --- | --- | --- |
| Register | `POST /auth/register` | Persists a customer and hashes the password; after success, the customer signs in through the login form. |
| Sign in | `POST /auth/login`, `GET /auth/me` | Validates the bearer token, then loads the authenticated customer profile before completing sign-in. The JWT is kept in tab-scoped session storage. |
| Load profile | `GET /auth/me` | Loads the profile for the JWT's customer identity when restoring a tab session. |
| Browse | `GET /restaurants` | Uses the Restaurant Service's actual unpaged response; no demo restaurant fixtures are mixed in. |
| Restaurant/menu | `GET /restaurants/{id}`, `GET /restaurants/{id}/menu` | Renders actual restaurant and menu records, with availability and backend prices. |
| Checkout validation | `GET /restaurants/{id}/availability`, `GET /restaurants/{id}/menu` | Rechecks the live menu before a new order. |
| Create/check order | `POST /orders` with `Idempotency-Key` | Creates the order as `PAYMENT_PENDING` without initiating payment. Repeating the same request key safely checks/reconciles the existing attempt. |
| Start simulated payment | `POST /payments` | Called only after the customer explicitly starts payment; sends the existing `orderId`, authenticated `userId`, backend order total, and `SIMULATED` method. |
| Order history/details | `GET /orders/mine`, `GET /orders/{id}` | Returns only orders attached to the authenticated customer ID. |
| Payment status | `GET /payments/order/{orderId}` | Reads payment records scoped to the authenticated customer; checkout verifies matching order and payment statuses before showing success. |

Cart contents and unresolved checkout attempts persist in browser local storage.
The JWT is stored separately in session storage and is removed when the tab
session ends or the customer signs out.
The cart is limited to one restaurant and is cleared on sign-out/session expiry.
Order attempt keys are scoped to the logged-in customer's ID. Stored menu prices
are display snapshots only; the backend's order total is authoritative. Invalid
or unavailable menu items block a new checkout.

Payments are labelled simulated. The Payment Service records a simulated
`SUCCESS` result only after the customer explicitly starts payment and the
pending order total is verified; it does not charge money. Order creation
alone never starts payment. If a payment request has an uncertain network
outcome, the frontend persists the attempted state and offers status checking,
not another payment submission. The same order idempotency key is reused for
order reconciliation.

Restaurant and menu API DTOs optionally include `imageUrl`. Existing records
without image URLs use food-specific image fallbacks; failed image loads use a
local inline illustration rather than a broken-image icon. Invalid zero-price
menu rows and entries whose name duplicates the restaurant name are hidden and
reported in the menu, and new duplicate restaurant-name menu entries are
rejected by the Restaurant Service.

## Contract limitations

The current services do not define delivery addresses, currency, fees, tax,
ratings, or delivery estimates. The frontend does not fabricate those values.
Legacy orders/payments created before customer identity was linked are not
automatically attributed to a newly registered account. A real payment gateway,
payment failure recovery/refunds, and address/delivery workflows are not part
of these service contracts.
