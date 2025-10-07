# Password Vault (MVP)

**Live demo**

* Frontend: [https://frontendpassgen.netlify.app/](https://frontendpassgen.netlify.app/)
* Backend: [https://password-vault-gen.onrender.com](https://password-vault-gen.onrender.com)

> ⚠️ Backend may go to sleep on the Render free tier — the first request after idle can be slow or trigger a cold start.

**Repo**

* Add your repo URL here: `https://github.com/your-user/your-repo` *(replace with your actual repo link)*

---

## Quick README — how to run (local dev)

### Prereqs

* Node.js 18+ (or latest LTS)
* npm
* MongoDB (local or Atlas)

### Environment

Create a `.env` at the root of the API (or use your platform secrets) and set at minimum:

```
# apps/api/.env
MONGODB_URI=           # mongodb connection string
JWT_SECRET=            # random secret for JWT signing
SESSION_COOKIE_NAME=pv_session
NODE_ENV=development   # set to production in production
COOKIE_SECURE=false    # set to true in production (or rely on NODE_ENV)
FRONTEND_ORIGIN=http://localhost:3000
```

For the frontend:

```
# apps/frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000
```

> In production ensure `COOKIE_SECURE=true` (or `NODE_ENV=production`) and `SameSite=None` so cross-origin cookies work with your hosted frontend. Also configure `FRONTEND_ORIGIN` to the exact origin(s) (no trailing slash).

### Install & run (monorepo)

From the repo root:

```bash
npm ci
npm run dev
```

This runs both frontend and API (per the repo scripts).

* Frontend: [http://localhost:3000](http://localhost:3000)
* API: [http://localhost:4000](http://localhost:4000)

### Build

```bash
npm run build
```

---

## Endpoints (short)

* `POST /api/auth/signup` — `{ email, password, encryptedVMK }` → create account
* `POST /api/auth/login` — `{ email, password }` → sets HttpOnly session cookie and returns `encryptedVMK`
* `POST /api/auth/logout` — clears cookie
* `GET /api/vault` — list vault entries (authenticated)
* `POST /api/vault` — `{ encryptedBlob }` create
* `PUT /api/vault/:id` — update
* `DELETE /api/vault/:id` — delete
* `POST /api/auth/2fa/*` — TOTP endpoints (setup/confirm/login-verify/disable)

All API traffic must be over HTTPS in production.

---

## Export / Import (backup)

The app supports encrypted export (bundles `encryptedVMK` + encrypted blobs). Import prompts for password locally and re-uploads encrypted blobs to the server. Exported files are unreadable without the account password/VMK.

---

## Short note: what we used for crypto and why

* **Client-side:** Web Crypto (`SubtleCrypto`) for PBKDF2 and AES-GCM to encrypt the VMK and vault items. Web Crypto is built into browsers, and much easier to use.
* **Server-side:** Argon2 for password hashing (strong, memory-hard) and server-side AES-GCM for any server-only secrets (e.g., temporary TOTP encryption).

---

## Deployment notes

* **Frontend:** deploy `apps/frontend` to Vercel / Netlify. Set `NEXT_PUBLIC_API_URL` to the backend URL.
* **Backend:** deploy `apps/api` to Render (or Vercel serverless / other Node host). Set env vars (`MONGODB_URI`, `JWT_SECRET`, `SESSION_COOKIE_NAME`, `FRONTEND_ORIGIN`, `COOKIE_SECURE=true` in production).
* If backend is on a different origin than frontend, make sure:

  * CORS allows the exact frontend origin(s) and `credentials: true`.
  * Cookies are set with `SameSite=None; Secure` in production and the frontend uses `fetch(..., { credentials: 'include' })`.
* **Render free tier:** backend may sleep when idle. This can cause slower first requests or apparent “not signed in” behavior if cookies aren’t persisted properly during testing — keep that in mind when debugging.
