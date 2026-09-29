# X-PLORING BANGLADESH — Server

Backend API for the X-Ploring Bangladesh travel booking web app (MERN stack).

## Stack

- Node.js + Express 4
- MongoDB (native driver v6)
- Deployed on Vercel (vercel.json -> index.js)

## Project structure (newly organized)

```
├── index.js                  # entry: loads .env, creates app from src/app.js, listens (exports app for Vercel)
├── db.js                     # cached MongoDB client + getCollections() helper
├── vercel.json               # Vercel build config
├── .env.example              # sample env vars (copy to .env)
├── src/
│   ├── app.js                # Express factory: middleware, routes, 404 + error handler
│   ├── routes/
│   │   ├── index.js          # mounts /packages + /bookings under /api
│   │   ├── packages.routes.js
│   │   ├── bookings.routes.js
│   │   └── legacy.routes.js  # old /myPackages/:email compat
│   ├── controllers/
│   │   ├── packages.controller.js
│   │   └── bookings.controller.js
│   ├── middleware/
│   │   ├── asyncHandler.js
│   │   └── errorHandler.js   # notFound + errorHandler
│   └── utils/
│       └── ids.js            # ObjectId validation (fixes ObjectId() crash)
```

## Setup

```bash
npm install
# copy .env.example to .env then fill DB_USER / DB_PASS / DB_NAME
npm run dev    # nodemon index.js
npm start      # node index.js
```

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
| DELETE | `/myPackages/:email`         | (legacy) delete one booking by email          |

All success responses are `{ success: true, data/count }`; errors are `{ success: false, message }`.

## Key fixes vs old code

- `ObjectId(req.params.id)` -> `new ObjectId(id)` + validation (old code crashed on invalid ids).
- Removed deprecated useNewUrlParser / useUnifiedTopology options; uses Stable API v1.
- Central error handling — no more try/catch repeated in every route.
- Added helmet, morgan, JSON body limit, 400/404 validation, createdAt/status defaults.
- index.js exports app without auto-listening when required (Vercel-safe).
- Fixed vercel.json dest (/index.js).

## KEY Features (frontend)

- Selecting a package with a private route leads to the user to checkout page.
- Users can see his/her packages and delete ordered packages from the dashboard
- Admins can add new packages and delete any packages.
- Day wise tour details showing on booking page.
- Simple login system using google.
