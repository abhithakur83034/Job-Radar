# JobRadar

Job opening radar & tailored-application assistant. This is the production-ready implementation of `JobRadar_Project_Documentation.pdf` — a full-stack Next.js + Express + MongoDB architecture that watches job platforms, scores new listings against your profile and resume, pre-drafts tailored resumes and cover letters per match, and tracks applications through to follow-up.

**Live:** https://job-radar-lime.vercel.app

Submission itself stays manual by design (see doc section 2.3) — JobRadar gets you to "ready to submit" in seconds, the actual click on the job board is always yours.

---

## Architecture: 100% MongoDB & Production Ready

- **Backend**: Express REST API (`/backend`) with Mongoose ODM, JWT httpOnly cookie sessions, Multer file upload handling, and automated ATS connectors.
- **Frontend**: Next.js 14 App Router (`/frontend`) with React server components, Tailwind CSS styling, and zero-dependency inline SVG graphics.
- **Database**: Pure MongoDB (supports local MongoDB or **MongoDB Atlas** for live cloud production). Zero SQLite. Zero Prisma.

---

## Quick start (Local Development)

### 1. Prerequisites
- Node.js (v18+)
- MongoDB running locally (`mongodb://127.0.0.1:27017/job_radar`) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster connection string.

### 2. Backend Setup
```bash
cd backend
cp .env.example .env
npm install
npm run seed     # Seeds demo user, search profile, and live ATS jobs
npm run dev      # Starts Express server on http://localhost:4000
```

### 3. Frontend Setup
```bash
cd frontend
cp .env.example .env
npm install
npm run dev      # Starts Next.js on http://localhost:3000
```

Open `http://localhost:3000` to access JobRadar.

---

## Live Deployment

| Part | Host | URL |
|---|---|---|
| Website (frontend) | Vercel | https://job-radar-lime.vercel.app |
| API (backend) | Render | https://job-radar-9hqa.onrender.com (health: `/health`) |
| Database + uploaded files | MongoDB Atlas (GridFS) | — |

Every push to `master` redeploys both. The browser only talks to the Vercel domain: `/api/v1/*` and `/uploads/*` are proxied to Render by `frontend/next.config.js`, so the session cookie is first-party.

### Backend — Render web service
Root directory `backend`, build `npm install`, start `npm start`, health check path `/health`.
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/job_radar?retryWrites=true&w=majority
JWT_SECRET=<random, at least 32 characters>
FRONTEND_ORIGIN=https://job-radar-lime.vercel.app
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
```
Atlas **Network Access** must allow `0.0.0.0/0` (Render has no fixed outbound IP).

### Frontend — Vercel project
Root directory `frontend`, framework preset Next.js.
```env
API_INTERNAL_URL=https://job-radar-9hqa.onrender.com
ANTHROPIC_API_KEY=<optional>
```
The build fails on purpose if `API_INTERNAL_URL` is missing, rather than silently falling back to localhost.

### Gmail job-alert import (optional)
Imports jobs from LinkedIn / Naukri / Indeed **alert emails** via Gmail OAuth (read-only). No portal passwords are ever collected and the portals themselves are never scraped.

1. Google Cloud Console → create a project → enable **Gmail API**.
2. **OAuth consent screen**: External, Testing mode, add your Gmail as a test user, scopes `openid`, `email`, `gmail.readonly`.
3. **Credentials → OAuth client ID → Web application**, authorized redirect URIs:
   `http://localhost:3000/api/v1/gmail/callback` and `https://job-radar-lime.vercel.app/api/v1/gmail/callback`.
4. Set on Render (and locally in `backend/.env`): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GMAIL_TOKEN_KEY`.

Security: OAuth state + PKCE, refresh token encrypted with AES-256-GCM (key only in env), only alert senders are queried, email bodies are not stored, disconnect revokes the token at Google. In Testing mode Google expires the grant after 7 days, so users must reconnect weekly; removing that requires Google's restricted-scope verification.

### Notes
- Render's free tier sleeps after ~15 min idle; the first request afterwards takes ~50s.
- Adding a custom domain: add it in Vercel → Domains, then append it to `FRONTEND_ORIGIN` on Render (comma-separated).

---

## Key Features & Endpoints

### ATS Connectors & Portal Ingestion
JobRadar directly queries real public ATS APIs without requiring authentication:
- **Greenhouse**: `https://boards-api.greenhouse.io/v1/boards/{token}/jobs`
- **Lever**: `https://api.lever.co/v0/postings/{token}`
- Supported companies include GitLab, Reddit, Affirm, Brex, Canonical, Datadog, Stripe, Cloudflare, etc.
- Ingestion endpoint: `POST /api/v1/jobs/sync` or the "Scan ATS Portals" button directly in the dashboard UI.

### Resume & Image Uploads
- Profile avatars and resumes are handled via Multer and stored in MongoDB GridFS, so they survive redeploys.
- Supported image formats: JPEG, PNG, WebP, GIF (up to 5MB).
- Avatars update in real-time on the profile page and persist directly to MongoDB.

---

## Project Structure

```
backend/
├── src/
│   ├── config/          # MongoDB connection (db.js) & Zod env validation (env.js)
│   ├── controllers/     # Auth, Profile, Resume, Upload, Job, Match, Draft, Application
│   ├── middleware/      # Authentication & error handling
│   ├── models/          # Mongoose models: User, Profile, Resume, Job, Match, Draft, Application, FollowUp
│   ├── routes/          # Express route definitions
│   ├── utils/           # Greenhouse & Lever connectors, match scoring
│   ├── seed.js          # MongoDB database seed script
│   ├── app.js           # Express app setup, CORS, helmet, cookies
│   └── server.js        # Server listener and graceful shutdown
frontend/
├── src/
│   ├── app/             # Next.js App Router: Feed, Profile, Drafts, Tracker, Billing, Onboarding
│   ├── components/      # RadarHero, ScanPortalsButton, AvatarUpload, FitBadge, etc.
│   └── lib/             # API client, queries, auth utilities
```
