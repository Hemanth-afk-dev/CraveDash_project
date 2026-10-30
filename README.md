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
| `MYSQL_ROOT_PASSWORD` | Docker Compose | MySQL administrative password |
| `DB_USERNAME` | Business services | MySQL application user; defaults to `root` for local runs |
| `DB_PASSWORD` | Business services | MySQL application-user password |
| `SPRING_DATASOURCE_URL` | Business services | Overrides the module's local MySQL URL |
| `EUREKA_URL` | Gateway and business services | Eureka registry URL; Docker uses `http://eureka-server:8761/eureka/` |
| `EUREKA_INSTANCE_HOSTNAME` | Gateway and business services | Hostname advertised to Eureka |
| `REACT_APP_ORIGIN` | API Gateway | Allowed frontend origin; defaults to `http://localhost:5173` |
| `VITE_API_BASE_URL` | Frontend build/dev server | Defaults to `http://localhost:8080` |

The services use separate schemas: `cravedash_user_db`, `cravedash_order_db`,
`cravedash_payment_db`, and `cravedash_restaurant_db`. For local runs, provision
them before starting the services. Docker Compose creates them on the first
MySQL-volume initialization.

## Run the complete application with Docker Compose

Requirements: Docker Desktop (or Docker Engine with the Compose plugin) and
network access to pull the build/runtime images and Maven/npm dependencies.

1. Copy `.env.example` to `.env`.
2. Replace the three password/secret placeholders with private values. Use the
   same `JWT_SECRET` for every service; it must contain at least 32 UTF-8 bytes.
   The `.env` file is ignored by Git.
3. From the repository root, run:

   ```powershell
   docker compose up --build -d
   ```

Compose builds all six Spring Boot services and the production Vite/Nginx
frontend. It waits for MySQL, Eureka, and backend service health checks before
starting dependent services. The services share a private Docker bridge
network; only the frontend, API Gateway, and Eureka dashboard ports are
published to the host. MySQL's port is not published.

Open `http://localhost:5173`. The browser uses the API Gateway at
`http://localhost:8080`; backend containers communicate through Compose service
names and Eureka. If you change the frontend or gateway host ports in `.env`,
also set `REACT_APP_ORIGIN` to the frontend origin and rebuild with
`docker compose up --build -d`.

Useful commands:

```powershell
docker compose ps
docker compose logs -f
docker compose logs -f api-gateway user-service restaurant-service
docker compose down
```

`docker compose down` stops and removes containers but keeps the named MySQL
volume. To permanently remove the local database contents as well, run
`docker compose down --volumes`; this is destructive and should only be used
when you intend to reset the local Docker database.

Troubleshooting:

- If a service is unhealthy, inspect its logs with
  `docker compose logs <service-name>` and confirm Docker has enough memory.
- Check `.env` values if Compose reports a missing/weak configuration value.
- If a host port is already in use, change its port variable in `.env`. Update
  `REACT_APP_ORIGIN` and `VITE_API_BASE_URL` to match, then rebuild the frontend.
- MySQL initialization scripts run only when the data volume is first created.
  Changing credentials later does not rewrite an existing database volume.
- A new Docker volume contains empty application schemas. Existing local
  restaurant/menu/customer/order/payment records are not included in Git and
  are not copied automatically; restore or create only the records you intend
  to use in this isolated Docker database.

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

Set the same strong `JWT_SECRET` and the matching `DB_PASSWORD` in every
business-service process, then start each component in a separate terminal, in
this order:

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
