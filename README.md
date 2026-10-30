# CraveDash

CraveDash is a REST-based food-ordering application built as Spring Boot
services behind Spring Cloud Gateway and Eureka, with a React/TypeScript
frontend. The existing services remain in their original module directories;
`user-service/` and `frontend/` are additional projects.

## Architecture and ports

| Component | Port | Purpose |
| --- | ---: | --- |
| Eureka Server | 8761 | Service registration and discovery |
| API Gateway | 8080 | Frontend API base URL and service routing |
| Restaurant Service | 8081 | Restaurant discovery and menus |
| Order Service | 8082 | Authoritative pricing, order ownership and history |
| Payment Service | 8083 | Simulated, idempotent payment records |
| User Service | 8084 | Persistent registration, login and customer profile |
| React frontend | 5173 | Customer ordering interface |

The gateway routes `/restaurants/**`, `/orders/**`, `/payments/**`, and
`/auth/**` to the corresponding Eureka service. Every business service owns a
separate MySQL schema.

## Configuration and databases

Set environment variables in the process environment; do not commit secrets:

| Variable | Used by | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | Gateway and all business services | Shared HS256 secret, at least 32 UTF-8 bytes |
| `DB_USERNAME` | User Service | MySQL user; defaults to `root` |
| `DB_PASSWORD` | Business services | MySQL password |
| `USER_DB_URL` | User Service | Defaults to `jdbc:mysql://localhost:3306/cravedash_user_db` |
| `EUREKA_URL` | User Service | Defaults to `http://localhost:8761/eureka/` |
| `REACT_APP_ORIGIN` | API Gateway | Allowed frontend origin; defaults to `http://localhost:5173` |
| `VITE_API_BASE_URL` | Frontend build/dev server | Defaults to `http://localhost:8080` |

Provision the `cravedash_user_db` schema before starting User Service. The other
schemas are `cravedash_order_db`, `cravedash_payment_db`, and
`cravedash_restaurant_db`. Configure the DB URL/user in each existing service's
`application.properties` if its local MySQL setup differs.

Order Service adds nullable `customer_id` and `idempotency_key` columns.
Payment Service adds nullable `customer_id` and a unique constraint on
`order_id` to make repeated payment recording idempotent. Before recording a
new payment, it verifies the pending order and its authoritative amount with
Order Service. Hibernate's existing
`ddl-auto=update` configuration applies these additive changes. Before starting
Payment Service against a database with existing records, check for duplicate
payments per order:

```sql
SELECT order_id, COUNT(*)
FROM payments
GROUP BY order_id
HAVING COUNT(*) > 1;
```

Do not delete or automatically reassign conflicting records. Resolve any
duplicates through an approved data-reconciliation decision first. Historical
orders/payments from before customer registration have no trusted
`customer_id`; they remain in their databases but are intentionally excluded
from new customers' history and detail endpoints. No automatic mapping from
legacy numeric IDs to new accounts is safe.

## Start the application (Windows PowerShell)

Set the same strong `JWT_SECRET` in every service process, then start each
component in a separate terminal, in this order:

1. `eureka-server\eureka-server`
2. `restaurant-service\restaurant-service`
3. `user-service\user-service`
4. `payment-service\payment-service`
5. `order-service\order-service`
6. `api-gateway\api-gateway`
7. `frontend`

From each backend module directory, run `mvn spring-boot:run` (or
`mvn test -Dtest=<FocusedTest>` for a focused test). In the frontend directory:

```powershell
npm install
npm run dev
```

The frontend is available at `http://localhost:5173`. To validate frontend
types and the production bundle, run `npm run typecheck` and `npm run build`.

## Customer and ordering contracts

- `POST /auth/register`: persist a customer with a BCrypt password hash and
  receive a one-hour HS256 bearer token.
- `POST /auth/login`: authenticate by email/password and issue a token with a
  stable numeric `customerId` claim.
- `GET /auth/me`: return the authenticated customer's public profile.
- `GET /restaurants`, `/restaurants/{id}`, and
  `/restaurants/{id}/menu`: read live restaurant and menu data.
- `POST /restaurants`: accepts `name`, `address`, `phone`, and `available`;
  the database generates the ID. `imageUrl` is now optional.
- `POST /restaurants/{id}/menu`: accepts `name`, `description`, positive
  `price`, and `available`; the path supplies `restaurantId` and the database
  generates the item ID. `imageUrl` is optional. A menu item cannot use the
  same name as its restaurant.
- `POST /orders`: requires a bearer token and `Idempotency-Key` header. The
  service derives ownership from the signed token, checks restaurant/menu
  availability, and calculates prices from Restaurant Service data; client
  supplied customer IDs and prices are not authoritative. It creates the
  order in `PAYMENT_PENDING` and does not initiate payment.
- `POST /payments`: requires the authenticated customer and the existing
  payment request fields (`orderId`, `userId`, `amount`, `paymentMethod`).
  Checkout calls it only after the customer explicitly starts the simulated
  payment. The existing order idempotency key is then reused to reconcile the
  payment outcome; order status checks never initiate payment.
- `GET /orders/mine` and `GET /orders/{id}`: return only orders belonging to
  the authenticated customer. The legacy `/orders/user/{userId}` path remains
  but rejects IDs other than the authenticated customer.
- Payment records are associated with the authenticated customer and one
  order. The Payment Service is a simulation that records `SUCCESS` for a
  valid explicit attempt; it does not charge money or connect to a real
  payment provider. The frontend shows order confirmation only when both the
  order and matching payment record report success.

Checkout stores an idempotency key and request locally before sending an
order. It records that payment was started before making the payment request.
If the payment outcome is unclear, the customer can check the same order and
payment status without blindly retrying payment or creating another record.
Payment failure recovery beyond status reconciliation is not implemented
because the current simulation has no real failure or refund workflow.

Restaurant and menu records may include an optional `imageUrl`. The Restaurant
Service exposes these values in its read DTOs; existing rows without an image
continue to work with frontend fallbacks.

The current backend does not define delivery addresses, fees, tax, currency,
restaurant ratings, or delivery estimates. The frontend does not invent these
values. Restaurant/menu data remains whatever is actually present in the
Restaurant Service database; no restaurant fixtures are presented as live
records.

## Focused tests

```powershell
Push-Location user-service\user-service; mvn -Dtest=AuthIntegrationTest test; Pop-Location
Push-Location order-service\order-service; mvn -Dtest=OrderServiceTest test; Pop-Location
Push-Location payment-service\payment-service; mvn -Dtest=PaymentServiceTest test; Pop-Location
Push-Location api-gateway\api-gateway; mvn -Dtest=ApiGatewayApplicationTests test; Pop-Location
```

The registration tests use an isolated H2 database. Order and Payment service
tests are isolated unit tests. A full multi-service runtime E2E run requires
separately provisioned test databases and a running Eureka/Gateway stack; do
not point an E2E run at a developer database containing real records.
