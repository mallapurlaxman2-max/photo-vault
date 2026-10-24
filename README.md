# 📸 Lumière Studio — Professional Photographer QR Photo Gallery & Sharing Platform

> A production-ready, full-stack web application designed for professional wedding and event photographers. Upload high-resolution photographs into independent client galleries, each protected by its own secure password and unique QR code for instant guest access.

---

## 🌟 Key Features

### 1. Public Fine Art Photography Website
- **Luxury Editorial Design:** Obsidian black aesthetic with warm champagne gold accents, serif typography, and cinematic imagery.
- **Client Photo Portal:** Direct quick-lookup modal where guests can enter their gallery code or link.
- **Curated Portfolio Showcase:** Categorized works (Weddings, Private Galas, Editorial, Intimate Portraits).
- **Philosophy, Services & Inquiries:** Master photographer accolades, signature collections, and booking inquiry form.

### 2. Multi-Gallery QR Architecture
- **Independent Client Collections:** Host hundreds of galleries simultaneously (e.g., *Rahul & Priya Wedding*, *Birthday Celebration*, *College Farewell*) without mixing photos or settings.
- **Dynamic High-Resolution QR Codes:** Generates instant high-res PNG (1200×1200) and vector SVG for every gallery.
- **Printable Table Stand / Tent Cards:** One-click printable A5/A6 luxury table card layout featuring the studio crest, QR code, event title, and guest scan instructions.
- **One-Click Share Links:** Permanent short links (`/g/[slug]`) with instant clipboard copy.

### 3. Fortified Access Security
- **Strict Server-Side Password Verification:** Passwords hashed with `bcrypt` (cost factor 12). Passwords are never exposed in URLs, client code, or public queries.
- **Brute-Force Rate Limiting:** Enforces progressive lockouts after 5 failed attempts (15-minute lockouts).
- **Cryptographic Guest Tokens:** Signed HTTP-only session cookies granting access strictly to the authenticated gallery.
- **Cross-Gallery Partitioning:** Tokens for Gallery A cannot decrypt or access photos from Gallery B.
- **Single-Owner Guard:** Secure first-owner registration wizard (`/admin/setup`). Once configured, public registration is **permanently closed and forbidden**.

### 4. Photo Ingestion & Storage Pipeline
- **Drag-and-Drop Batch Upload:** Supports JPG, PNG, and WebP up to 50MB per photo.
- **Automated Sharp Image Processing:**
  - Fast-loading WebP thumbnail generation (max 600px width, 80% quality).
  - High-definition display version (max 1920px width, 85% quality).
  - Preserves untouched original master for permitted downloads.
- **Cover Photo Control:** One-click cover photo selector with badge indicators.
- **Flexible Storage Adapters:** Works out-of-the-box locally with zero external accounts, and seamlessly integrates with cloud object storage (**Supabase Storage** / AWS S3).

### 5. Premium Customer Gallery Experience
- **Frosted Password Screen:** Elegant blurred cover photo backdrop and event header.
- **Responsive Masonry Grid:** Touch-friendly layout optimized for iPhones, Android phones, tablets, and 4K displays.
- **Fullscreen Lightbox Viewer:**
  - Keyboard navigation (Left / Right / Escape).
  - Mobile touch swipe gestures.
  - Zoom toggle (1× / 2.5×).
  - Automated Slideshow mode with timed transitions.
- **Flexible Download Controls:**
  - Individual high-resolution photo download.
  - Full-collection ZIP archive download streamed on-the-fly.
  - Photographer can toggle download permissions per gallery.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js (App Router, Turbopack, React 19) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS with luxury gold design tokens |
| **Database ORM** | Prisma ORM (SQLite for local dev, PostgreSQL for production) |
| **Cloud Database** | Supabase PostgreSQL (migration script included: `supabase_schema.sql`) |
| **Object Storage** | Pluggable Engine (Local storage / Supabase Storage) |
| **Image Processing**| Sharp (WebP conversion, auto-rotation, metadata extraction) |
| **Cryptography** | bcryptjs & jsonwebtoken |
| **QR Code Engine** | qrcode (PNG Data URLs & SVG vector string) |
| **Archive Streaming**| archiver (On-the-fly streaming ZIP packaging) |

---

## 🚀 Quickstart Guide (Local Development)

### Prerequisites
- Node.js 18.17+ or Node.js 20+ installed.

### 1. Install Dependencies
```bash
cd photographer-qr-gallery
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default `.env` values are pre-configured to run immediately with local SQLite and local storage:
```env
NEXT_PUBLIC_APP_URL="http://localhost:3000"
JWT_SECRET="lumiere_super_secure_production_secret_key_89234789123847"
DATABASE_URL="file:./dev.db"
STORAGE_PROVIDER="local"
MAX_UPLOAD_SIZE_MB="50"
MAX_PASSWORD_ATTEMPTS="5"
LOCKOUT_MINUTES="15"
```

### 3. Initialize Database
```bash
npx prisma db push
npx prisma generate
```

### 4. Start the Application
```bash
npm run dev
# Or production build & start:
npm run build
npm run start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🔐 Initial Setup & First Owner Onboarding

1. Open **[http://localhost:3000/admin/setup](http://localhost:3000/admin/setup)**.
2. Enter your:
   - Full Name (e.g., `Robert Vance`)
   - Studio Name (e.g., `Lumière Fine Art Photography`)
   - Tagline (e.g., `Capturing Timeless Moments into Eternal Art`)
   - Master Email Address
   - Master Password (minimum 8 characters)
3. Click **Create Master Account**.
4. You will be automatically authenticated into the Photographer Dashboard (`/admin`).
5. **Security Guarantee:** Any subsequent visit to `/admin/setup` will be permanently blocked with `403 Forbidden`. Unauthorized visitors cannot register themselves as owners.

---

## ☁️ Production Deployment Guide (Vercel + Supabase)

### Step 1: Create a Supabase Project (Free Tier)
1. Sign up at [supabase.com](https://supabase.com) and create a new project.
2. Go to **SQL Editor** in your Supabase dashboard.
3. Open the file `supabase_schema.sql` located in this repository, paste its contents into the SQL Editor, and click **Run**.
4. Go to **Storage** -> Click **New Bucket**:
   - Bucket name: `galleries`
   - Keep bucket **Private** (authenticated downloads protect raw photos).
5. In **Project Settings** -> **Database**:
   - Copy your PostgreSQL connection string (Transaction pooler URL or Direct URL).
6. In **Project Settings** -> **API**:
   - Copy `Project URL` (e.g., `https://xyz.supabase.co`)
   - Copy `service_role` secret key (for secure server-side uploads).

### Step 2: Deploy to Vercel
1. Push this project to GitHub.
2. In [vercel.com](https://vercel.com), click **Add New** -> **Project** -> Import your repository.
3. If using the root directory, set Root Directory to `photographer-qr-gallery`.
4. Add the following **Environment Variables** in Vercel:
   ```env
   NEXT_PUBLIC_APP_URL = "https://your-custom-domain.com"
   JWT_SECRET = "generate-a-strong-secret-32-chars-long"
   DATABASE_URL = "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?pgbouncer=true"
   STORAGE_PROVIDER = "supabase"
   NEXT_PUBLIC_SUPABASE_URL = "https://your-project.supabase.co"
   SUPABASE_SERVICE_ROLE_KEY = "your-supabase-service-role-key"
   SUPABASE_STORAGE_BUCKET = "galleries"
   MAX_UPLOAD_SIZE_MB = "50"
   MAX_BATCH_PHOTOS = "100"
   MAX_PASSWORD_ATTEMPTS = "5"
   LOCKOUT_MINUTES = "15"
   ```
5. In `schema.prisma`, update `provider = "postgresql"` if deploying directly with Prisma Postgres.
6. Click **Deploy**.

### Step 3: Connect Custom Domain
1. In Vercel Project Settings -> **Domains**, add your domain (e.g., `gallery.lumierestudio.com` or `lumierestudio.com`).
2. Add the CNAME / A records provided by Vercel in your domain registrar (GoDaddy, Namecheap, Cloudflare).
3. Ensure `NEXT_PUBLIC_APP_URL` in Vercel matches your domain. All QR codes will point directly to your domain!

---

## 📱 Testing QR Codes with Mobile Phones

1. From the Photographer Dashboard, click **Create New Gallery**.
2. Name it (e.g. `Rahul & Priya Wedding`) and assign a password (e.g. `Wedding2026`).
3. Click the **QR Code** button on the gallery card.
4. Open the camera app on any iPhone or Android phone.
5. Point the phone at your laptop screen to scan the QR code.
6. The phone opens the private gallery URL directly.
7. Enter `Wedding2026` to unlock and browse photos in high resolution!

---

## 💰 Transparent Storage & Hosting Cost Breakdown

| Resource | Free Tier Allowance | What Happens When Scaling |
|---|---|---|
| **Vercel Hosting** | Free Hobby tier (100GB bandwidth/mo) | Free for personal use; $20/mo Pro tier for high traffic |
| **Supabase Database** | 500 MB PostgreSQL database | Free for thousands of galleries; $25/mo Pro tier includes 8GB DB |
| **Supabase Storage** | 1 GB Object Storage included free | ~$0.021 per additional GB/mo ($2.10 per 100 GB) |
| **Local Self-Hosted**| Unlimited (limited only by your VPS hard drive) | Host on a $5/mo VPS with 50GB NVMe storage |

---

## 🧪 Automated Quality Assurance Test Suite

The repository includes an automated end-to-end test suite (`scripts/test-full-suite.ts`) testing 45 distinct security, database, and image processing assertions:

```bash
cd photographer-qr-gallery
npx tsx scripts/test-full-suite.ts
```

### Verified Test Cases:
- [x] Initial state verification & single-owner setup lock.
- [x] Bcrypt password hashing & timing attack resistance.
- [x] Multi-gallery isolation (simultaneous creation of multiple galleries with distinct QR codes & slugs).
- [x] Sharp real-time image processing (WebP generation, orientation, dimension extraction).
- [x] Partitioning verification: Gallery 1 photos never appear in Gallery 2.
- [x] Appending additional photos to an existing gallery without altering prior uploads.
- [x] Brute-force rate limiting: Progressive lockouts after 5 consecutive failed attempts.
- [x] Cryptographic guest token generation and cross-gallery rejection.
- [x] Permission enforcement: Individual download vs download-all ZIP controls.
- [x] Immediate access revocation when gallery status is toggled to `DISABLED` or expired.
- [x] Safe gallery deletion with cascade cleanup of physical files from storage.

---

## 📄 License
MIT License. Built for professional photographers worldwide.
