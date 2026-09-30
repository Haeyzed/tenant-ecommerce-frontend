# Local development

How to run the frontend apps against the Laravel API on your machine, and how payment webhooks reach the API during local testing.

## 1. What runs where

| App | Folder | Port | Open at |
|---|---|---|---|
| Platform admin | `apps/platform-admin` | 3000 | http://localhost:3000 |
| Tenant admin | `apps/tenant-admin` | 3001 | http://demo.admin.localhost:3001 (any store: `http://{slug}.admin.localhost:3001`) |
| Storefront | `apps/storefront` | 3002 | not built yet |
| Platform website (pricing, sign-up) | `apps/platform-web` | 3003 | http://localhost:3003 |
| Affiliate portal | `apps/affiliate-portal` | 3004 | not built yet |

Browsers resolve every `*.localhost` name to your own machine, so `demo.admin.localhost` needs no hosts-file entry.

The browser never talks to Laravel directly. Each app has a small server layer (the BFF, under `/bff/...`) that calls Laravel with the right `Host` header and keeps tokens in HttpOnly cookies.

## 2. Backend prerequisites

Laravel lives in `C:\Users\amuibi\Herd\tenant-ecommerce-api` and is served by **Laravel Herd** at `http://tenant-ecommerce-api.test`.

1. Herd must be running and serving the site.
2. Keep a queue worker running. New stores are provisioned on the queue, and imports, exports and emails need it too:

   ```bash
   php artisan queue:work --queue=tenant-critical,landlord-default,tenant-default,tenant-bulk --tries=3
   ```

3. Optional: `php artisan schedule:work`, for renewals, expiry and recovering payments whose webhook never arrived (§5).
4. The backend `.env` must point its email links at the local frontends:

   ```dotenv
   PLATFORM_WEBSITE_URL=http://localhost:3003
   PLATFORM_ADMIN_URL=http://localhost:3000
   AFFILIATE_PORTAL_URL=http://localhost:3004
   TENANT_ADMIN_URL=http://{slug}.admin.localhost:3001
   ```

## 3. First-time setup

From the repository root:

```bash
pnpm install
```

Each app reads its settings from `apps/<app>/.env.local`, which git ignores. Create it from the example:

```bash
cp apps/platform-admin/.env.example apps/platform-admin/.env.local
cp apps/tenant-admin/.env.example   apps/tenant-admin/.env.local
cp apps/platform-web/.env.example   apps/platform-web/.env.local
```

platform-admin and tenant-admin need a `SESSION_SECRET` (32 random bytes, base64). Generate a different one for each app:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

The values that matter locally:

| Variable | Apps | Local value | Why |
|---|---|---|---|
| `ROOT_DOMAIN` | all | `tenant-ecommerce-api.test` | Must equal the backend `PLATFORM_ROOT_DOMAIN` |
| `LARAVEL_INTERNAL_URL` | all | `http://127.0.0.1` | Herd's nginx; the BFF sets the `Host` header itself |
| `INSECURE_COOKIES` | admin apps | `true` | Cookies over plain http (no `__Host-` prefix). Refused in production. |
| `DEV_ADMIN_HOST` | tenant-admin | `admin.localhost` | Maps `{slug}.admin.localhost:3001` to the store `{slug}`. Local only. |
| `DEV_TENANT_SLUG` | tenant-admin | `demo` (optional) | Makes plain `localhost:3001` open that store |
| `TENANT_ADMIN_URL` | platform-web | `http://{slug}.admin.localhost:3001` | Where "Open your admin" goes after sign-up |

Never commit `.env.local`, and never put real gateway keys in any frontend env file. Gateway credentials live only in the backend (entered in platform admin).

## 4. Start the apps

All apps at once:

```bash
pnpm dev
```

Or one at a time:

```bash
pnpm --filter platform-admin dev   # http://localhost:3000
pnpm --filter tenant-admin dev     # http://demo.admin.localhost:3001
pnpm --filter platform-web dev     # http://localhost:3003
```

### Development accounts (local database only)

| App | Email | Password |
|---|---|---|
| Platform admin | `qa-admin@platform.test` | `DemoPass123!` |
| Tenant admin, store `demo`, owner | `owner@demo.test` | `DemoPass123!` |
| Tenant admin, store `demo`, clerk | `clerk@demo.test` | `DemoPass123!` |

### Try a sign-up

1. Open http://localhost:3003/pricing and choose a plan.
2. Fill in the form. The six-digit code is emailed (Mailtrap locally). The email's link opens `/register/verify?...&code=...` and verifies automatically.
3. The status page polls until the store is provisioned (the queue worker must be running), then "Open your admin" takes you to `http://{slug}.admin.localhost:3001/login`.

Mailtrap's free plan limits emails per second. If a code doesn't arrive, wait a minute and use "send a new code".

### Checks

```bash
pnpm turbo run typecheck
pnpm turbo run lint
pnpm turbo run test
pnpm --filter tenant-admin test:e2e     # needs Herd and the demo store
```

## 5. Paid plans and payment webhooks

### Webhooks go to the API, not to a frontend

A paid sign-up involves two separate URLs, and they go to different places:

| | Who calls it | URL | Needs a public URL locally? |
|---|---|---|---|
| **Webhook** (payment confirmed) | The gateway's servers, server to server | **Laravel API** on the root domain: `{APP_URL}/api/webhooks/{provider}/{mode}` | **Yes**, because Paystack, Flutterwave or Stripe can't reach `tenant-ecommerce-api.test` |
| **Return URL** (after the payment page) | The customer's browser | Tenant admin: `http://{slug}.admin.localhost:3001/billing/callback?reference=...` | No. It's a browser redirect on your own machine. |

So the webhook never points at a tenant domain or at any Next.js app. It always points at the Laravel API on the landlord (root) domain:

```
https://<api host>/api/webhooks/paystack/test
https://<api host>/api/webhooks/flutterwave/test
https://<api host>/api/webhooks/stripe/test
```

`{provider}` is `paystack`, `flutterwave` or `stripe`, and `{mode}` is `test` or `live`. The API returns each gateway's exact webhook URL as `webhook_url` (built from the backend `APP_URL`) in `GET /api/admin/payment-gateways`. The platform-admin Payment gateways screen will display it with a copy button.

Store (storefront) payments use a different webhook, also on the API's root domain, with the store in the path: `/api/webhooks/{tenant}/{provider}/{mode}`.

### Exposing the API locally with ngrok

Laravel answers landlord routes only on its root domain, so the tunnel must rewrite the `Host` header:

```bash
ngrok http 80 --host-header=tenant-ecommerce-api.test
```

ngrok prints a public address such as `https://ab12-34-56.ngrok-free.app`. In each gateway's **test** dashboard, set the webhook URL to:

```
https://ab12-34-56.ngrok-free.app/api/webhooks/paystack/test
```

Notes:

- **Leave `APP_URL` as it is.** Only the gateway dashboards need the ngrok address. Platform admin will keep displaying the `.test` URL, which is expected locally.
- **The address changes on a free plan.** Each time ngrok restarts, update the gateway dashboard (or use a reserved ngrok domain).
- **Signatures are checked.** The webhook secret stored for the gateway in the backend must match the gateway's test dashboard, or the webhook is rejected.
- **Webhooks don't use the frontend at all.** You don't tunnel ports 3000–3004 for them.

### Without a tunnel

If no webhook arrives, the charge stays pending and the store stays `awaiting_payment`. The scheduled renewal job (`php artisan schedule:work`) re-checks pending charges with the gateway after 15 minutes, so a test payment still completes, just more slowly.

### Current gaps

- **Return page not built.** tenant-admin's `/billing/callback` page arrives with the billing slice. Until then, the browser lands on the admin login after paying; the webhook still activates the store.
- **Gateway list not filtered.** The sign-up payment step offers all three gateways, because no public route lists the enabled ones yet (spec BG-19).
