# JobRadar

Job opening radar & tailored-application assistant. This is the production-ready implementation of `JobRadar_Project_Documentation.pdf` — a full-stack Next.js + Express + MongoDB architecture that watches job platforms, scores new listings against your profile and resume, pre-drafts tailored resumes and cover letters per match, and tracks applications through to follow-up.

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

## Live Deployment with MongoDB Atlas

### 1. Create a MongoDB Atlas Database
1. Create a free M0 cluster on [MongoDB Atlas](https://cloud.mongodb.com).
2. Create a Database User with username and password.
3. In **Network Access**, allow access from anywhere (`0.0.0.0/0`) or whitelist your deployment server IP.
4. Copy your connection string:
   `mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/job_radar?retryWrites=true&w=majority`

### 2. Deploy Backend (e.g. Render / Railway / Fly.io)
Set the following environment variables:
```env
NODE_ENV=production
PORT=4000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/job_radar?retryWrites=true&w=majority
FRONTEND_ORIGIN=https://your-frontend-domain.vercel.app
SESSION_COOKIE_NAME=jr_session
JWT_SECRET=your-random-32-byte-production-secret-key
JWT_EXPIRES_IN=7d
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
```

### 3. Deploy Frontend (e.g. Vercel)
Set the following environment variables:
```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend-api.onrender.com
API_INTERNAL_URL=https://your-backend-api.onrender.com
```

---

## Key Features & Endpoints

### ATS Connectors & Portal Ingestion
JobRadar directly queries real public ATS APIs without requiring authentication:
- **Greenhouse**: `https://boards-api.greenhouse.io/v1/boards/{token}/jobs`
- **Lever**: `https://api.lever.co/v0/postings/{token}`
- Supported companies include GitLab, Reddit, Affirm, Brex, Canonical, Datadog, Stripe, Cloudflare, etc.
- Ingestion endpoint: `POST /api/v1/jobs/sync` or the "Scan ATS Portals" button directly in the dashboard UI.

### Resume & Image Uploads
- Profile avatars and resumes are handled via Multer and stored securely.
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
