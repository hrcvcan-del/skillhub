# SkillHub

A multi-center skill training institute management system: training centers, courses, batches,
students, trainers, expenses, rent, trainer salaries, equipment inventory, and a financial
dashboard with charts. Server-rendered with Express + EJS + Bootstrap 5, backed by PostgreSQL via
Sequelize.

## Tech stack

Node.js 20+ · Express · Sequelize (migrations, not `sync()`) · PostgreSQL · `express-session` +
`connect-pg-simple` · `bcrypt` · EJS + Bootstrap 5 · `express-validator` · `csurf` · `multer` ·
Chart.js · `helmet` · `express-rate-limit` · Jest + Supertest.

## Project structure

```
skillhub/
├── src/
│   ├── config/        # env, db, session, upload, sequelize-cli config
│   ├── models/        # Sequelize models
│   ├── migrations/    # sequelize-cli migrations
│   ├── seeders/       # demo data
│   ├── controllers/
│   ├── routes/
│   ├── middleware/     # auth, roles, error handler, validation, audit, CSRF-supporting helpers
│   ├── views/          # EJS templates
│   ├── public/          # css/js/uploads
│   └── utils/
├── tests/               # Jest + Supertest
├── server.js
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in the values (see table below). You need a Postgres
   database — either a free hosted instance (Neon, Supabase, Render, Railway) or the one provided
   by `docker-compose.yml` (see "Local dev with Docker" below).

3. Run migrations and seed demo data:

   ```bash
   npm run migrate
   npm run seed
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000`. Seeded logins:

   | Role  | Email                   | Password    |
   |-------|-------------------------|-------------|
   | Admin | admin@skillhub.local    | Admin@123   |
   | Staff | staff@skillhub.local    | Staff@123   |

   There is no public self-registration page — new users are created by an admin under
   **Users** in the app, which is the safer default for an internal admin tool (self-serve
   signup would let anyone create an admin account).

## Environment variables

| Variable          | Required | Description                                                                 |
|--------------------|----------|-------------------------------------------------------------------------------|
| `PORT`             | no       | Port the server listens on. Default `3000`.                                  |
| `NODE_ENV`         | no       | `development`, `production`, or `test`.                                      |
| `DATABASE_URL`     | yes      | Postgres connection string.                                                  |
| `DATABASE_SSL`     | no       | Set `true` for hosted Postgres providers that require SSL (Neon, Supabase, Render, Railway). |
| `SESSION_SECRET`   | yes      | Long random string used to sign session cookies.                             |
| `EMAIL_API_KEY`    | no       | SendGrid/Resend API key. If unset, password-reset links are logged to the console instead of emailed. |
| `EMAIL_FROM`       | no       | From-address for transactional email once `EMAIL_API_KEY` is set.            |
| `UPLOAD_DIR`       | no       | Directory for uploaded receipts. Default `src/public/uploads`.               |
| `MAX_UPLOAD_MB`    | no       | Max receipt upload size in MB. Default `5`.                                  |

## Database commands

```bash
npm run migrate        # apply pending migrations
npm run migrate:undo   # roll back the last migration
npm run seed           # load demo data
npm run seed:undo      # remove demo data
```

## Tests

```bash
npm test
```

Tests run against the real database configured in `DATABASE_URL` (there's no separate test
database wired up) and clean up any records they create. They make real network round trips, so
expect the suite to take 30+ seconds against a remote host like Neon.

## Local dev with Docker

`docker-compose.yml` runs the app and a local Postgres container together, so you don't need a
hosted database for local development:

```bash
docker compose up --build
```

This builds the image from the multi-stage `Dockerfile`, starts Postgres, waits for it to be
healthy, then starts the app — which runs pending migrations automatically before starting the
server (see `prod:start` in `package.json`). The app is available at `http://localhost:3000`. Run
`docker compose exec app npm run seed` once to load demo data into the containerized database.

**Note:** Docker was not available in the environment this project was built in, so the
`Dockerfile` and `docker-compose.yml` were written carefully but not build-tested end-to-end.
Please verify `docker compose up --build` works on your machine before relying on it, and open an
issue/fix forward if anything needs adjusting for your Docker version.

## Deploying to Render

1. Push this repository to GitHub.
2. In the Render dashboard, create a **PostgreSQL** instance (any plan). Copy its **Internal
   Database URL**.
3. Create a **Web Service** from your GitHub repo:
   - **Runtime**: Node
   - **Build Command**: `npm ci`
   - **Start Command**: `npm run prod:start` (runs migrations, then starts the server)
   - **Health Check Path**: `/healthz`
4. Add environment variables on the Web Service:
   - `DATABASE_URL` — the Internal Database URL from step 2
   - `DATABASE_SSL` — `true`
   - `SESSION_SECRET` — a long random string
   - `NODE_ENV` — `production`
   - Optionally `EMAIL_API_KEY` / `EMAIL_FROM` for real password-reset emails
5. Deploy. Render will auto-deploy on every push to your default branch once connected.
6. Once live, run the seeder once against production if you want demo data:
   `render ssh <service>` then `npm run seed`, or use Render's one-off job runner.

## What's implemented

- Role-based auth (admin / manager / staff / trainer) enforced server-side on every route, not
  just hidden in the UI.
- Full CRUD: training centers, courses, trainers, batches (auto-generated batch codes,
  date-computed status), students (with fee tracking fields per the original spec, plus
  registration details: middle/full name, education, caste category, Aadhaar number, taluka,
  district), enrollments.
- Expenses (with receipt upload and CSV export), rent payments (monthly generation, partial/full
  payment tracking, overdue flagging), trainer salary payments (monthly generation, bonus/deduction),
  equipment inventory (condition/warranty alerts, valuation report).
- Dashboard with Chart.js: income vs. expense trend, expense-by-category, per-center comparison,
  upcoming-dues widget, CSV P&L export.
- Audit log on every create/update/delete.
- CSRF protection (`csurf`) and input validation (`express-validator`) on every form.
- Jest + Supertest coverage for the auth flow and the batches module.

**Not built:** a dedicated fee-payment-recording UI. The institute this was built for runs its
training free of cost, so the fee/payment fields in the schema exist (per the original spec) but
income will read ₹0 unless fees are entered directly against an enrollment at creation time.
