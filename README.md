# X-PLORING BANGLADESH — Server

Backend API for the X-Ploring Bangladesh travel booking web app (MERN stack).

## Stack

- Node.js (>=18) + Express 4
- MongoDB (native driver v6)
- Firebase Admin (firebase-admin v12) — user listing + ID-token auth
- Deployed on Vercel (vercel.json -> index.js)

## Project structure

```
├── index.js                        # entry: loads .env, creates app from src/app.js, listens (exports app for Vercel)
├── db.js                     # cached MongoDB client + getCollections() helper (packages, bookings, users)
├── vercel.json               # Vercel build config
├── .env.example              # sample env vars (copy to .env)
├── src/
│   ├── app.js                # Express factory: middleware, routes, 404 + error handler
│   ├── config/
│   │   └── firebase.js       # lazy Firebase Admin init (boots even without keys)
│   ├── routes/
│   │   ├── index.js          # mounts /packages + /bookings + /users under /api
│   │   ├── packages.routes.js
│   │   ├── bookings.routes.js
│   │   ├── users.routes.js
│   │   └── legacy.routes.js  # old /myPackages/:param compat (booking _id OR email)
│   ├── controllers/
│   │   ├── packages.controller.js
│   │   ├── bookings.controller.js
│   │   └── users.controller.js  # getAllUsers (auto/mongo/firebase/bookings), upsertUser
│   ├── middleware/
│   │   ├── asyncHandler.js
│   │   ├── auth.js           # optionalAuth / requireAuth / requireAdminOrAllowlist
│   │   └── errorHandler.js   # notFound + errorHandler
│   └── utils/
│       └── ids.js            # ObjectId validation (fixes ObjectId() crash)
```

## Setup

```bash
npm install
# copy .env.example to .env then fill values
npm run dev    # nodemon index.js
npm start      # node index.js
```

### Environment variables

| Var | Required | Description |
| --- | --- | --- |
| `PORT` | no | default `5000` |
| `DB_USER` / `DB_PASS` / `DB_NAME` | yes | MongoDB Atlas credentials (`DB_NAME` defaults to `traveller`) |
| `FIREBASE_PROJECT_ID` | for `?source=firebase` | Firebase project id (e.g. `tourism-website-b846d`) |
| `FIREBASE_CLIENT_EMAIL` | for `?source=firebase` | Service-account client email |
| `FIREBASE_PRIVATE_KEY` | for `?source=firebase` | Service-account private key (keep newlines, quoted) |
| `ADMIN_EMAILS` | recommended in prod | Comma-separated admin emails allowed to list users |

Get the Firebase key: Console > Project Settings > Service accounts > Generate new private key.
Never commit it — `serviceAccountKey.json` is git-ignored. Set the same vars in Vercel.

## API

Base URL locally: http://localhost:5000

| Method | Path                         | Description                                   |
| ------ | ---------------------------- | --------------------------------------------- |
| GET    | `/`                          | Health message                                |
| GET    | `/health`                    | status ok                                     |
| GET    | `/api/packages`              | List all packages (also GET /packages legacy) |
| GET    | `/api/packages/:id`          | Single package (also /packages/:id)           |
| POST   | `/api/packages`              | Create package (also POST /packages)          |
| DELETE | `/api/packages/:id`          | Delete package (also DELETE /packages/:id)    |
| POST   | `/api/bookings`              | Create booking (also POST /bookings)          |
| GET    | `/api/bookings?email=`       | List/filter bookings                          |
| GET    | `/api/bookings/email/:email` | Bookings by email                             |
| DELETE | `/api/bookings/:id`          | Delete one booking by id (new, preferred)     |
| GET    | `/myPackages/:email`         | (legacy) bookings by email                    |
| DELETE | `/myPackages/:param`         | (legacy, smart) booking _id OR email          |

### Users (Google + Email/Password)

Users live in **Firebase Auth**, not MongoDB — unless synced. Three sources supported:

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/users` | Auto: Mongo (if synced) -> Firebase (if configured) -> bookings fallback. With Firebase configured, requires `Authorization: Bearer <idToken>` + admin |
| GET | `/api/users?source=mongo` | Synced Mongo `users` (supports roles) |
| GET | `/api/users?source=firebase` | Live Firebase Auth list (Google + Email/Password). `503` until service-account envs set |
| GET | `/api/users?source=bookings` | Derived from bookings, zero setup — only users who booked |
| GET | `/api/users/from-bookings` | Same as above (short alias) |
| GET | `/api/users/:idOrEmail` | One synced user by Mongo `_id` or email |
| POST | `/api/users/upsert` | Create/update Mongo user after Firebase login (allowlisted emails auto-become admin) |
| GET | `/api/users/me?email=` | Role lookup for UI gating → `{ role, isAdmin }` (public) |
| PATCH | `/api/users/:idOrEmail/role` | Set `admin`/`user` (admin Bearer token required) |

Frontend sync snippet — call after Firebase sign-in:

```js
const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
await fetch("http://localhost:5000/api/users/upsert", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    provider: user.providerData[0]?.providerId,
  }),
});
// admin list:
const token = await user.getIdToken();
await fetch("http://localhost:5000/api/users?source=firebase", {
  headers: { Authorization: `Bearer ${token}` },
});
// normal vs admin UI gating:
const me = await fetch(`http://localhost:5000/api/users/me?email=${user.email}`).then(r => r.json());
if (me.data.isAdmin) { /* show admin dashboard */ }
```

**Roles (normal vs admin):**

- Role lives in Mongo `users.role`: `"user"` (default) or `"admin"`. Firebase list merges it by email and exposes `role` + `isAdmin`.
- First admin: set `ADMIN_EMAILS=you@example.com` in `.env` (+ Vercel). On next login/upsert that email is auto-promoted to admin (also syncs Firebase `admin:true` claim when configured). No existing admin needed.
- Promote/demote later: `PATCH /api/users/:email/role { "role": "admin" }` with an admin Bearer token.
- Filter lists: `?role=admin` / `?role=user` works on `?source=mongo|firebase` and auto.
- Admin gate order: Firebase `admin:true` claim → Mongo `role` → `ADMIN_EMAILS` allowlist.
```

All success responses are `{ success: true, data/count }`; errors are `{ success: false, message }`.

## Key fixes vs old code

- `ObjectId(req.params.id)` -> `new ObjectId(id)` + validation (old code crashed on invalid ids).
- Removed deprecated useNewUrlParser / useUnifiedTopology options; uses Stable API v1.
- Central error handling — no more try/catch repeated in every route.
- Added helmet, morgan, JSON body limit, 400/404 validation, createdAt/status defaults.
- index.js exports app without auto-listening when required (Vercel-safe).
- Fixed vercel.json dest (/index.js).
- Legacy `DELETE /myPackages/:param` accepts booking `_id` or email (frontend sends `_id`).
- Stray `exploring-bangladesh-server: file:` self-dependency removed; `firebase-admin` added.

## KEY Features (frontend)

- Selecting a package with a private route leads to the user to checkout page.
- Users can see his/her packages and delete ordered packages from the dashboard
- Admins can add new packages and delete any packages.
- Day wise tour details showing on booking page.
- Simple login system using google + email/password.
