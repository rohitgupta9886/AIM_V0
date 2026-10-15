# Production Deployment Guide: Cloudflare Pages + Render + Supabase

This guide provides a comprehensive, step-by-step walkthrough for deploying **StockMatrix ERP (AIM_V0)** to production using:
- **Frontend:** Cloudflare Pages (React 18 + TypeScript + Vite SPA on global edge CDN)
- **Backend:** Render Web Service (FastAPI REST API with Python 3.11+)
- **Database:** Supabase PostgreSQL (Managed PostgreSQL 15+ with Connection Pooling)

---

## 📐 Production Architecture Overview

```mermaid
graph LR
    User[End User Browser] -->|HTTPS| CF[Cloudflare Pages CDN\nReact + Vite SPA]
    CF -->|API Requests\nBearer JWT| Render[Render Web Service\nFastAPI Backend API]
    Render -->|Pooled SSL Connection\nPort 5432 / 6543| Supabase[(Supabase PostgreSQL 15\nManaged Database)]
    Render -->|Automatic Health Checks| Health[Render Health Monitor\n/health]
```

### Security & Separation of Concerns
- **Zero Secrets on Frontend:** Database connection strings, PostgreSQL passwords, and JWT secret keys reside strictly on the backend as encrypted environment variables in Render.
- **Frontend Configuration:** The Cloudflare Pages frontend only receives the public backend API URL via `VITE_API_URL`.
- **Database Engine:** PostgreSQL is strictly enforced by SQLAlchemy. SQLite is completely disabled and rejected.

---

## 🗄️ Phase 1: Set Up Supabase PostgreSQL Database

### 1.1 Create Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and sign in or create a free account.
2. In the Supabase Dashboard, click **New Project**.
3. Fill in the project details:
   - **Name:** `stockmatrix-db` (or your choice)
   - **Database Password:** Enter a strong password (save this securely; you will need it).
   - **Region:** Choose a region close to your Render deployment (e.g., `US East (North Virginia)` or `EU Central (Frankfurt)`).
   - **Pricing Plan:** Free tier.
4. Click **Create new project** and wait ~2 minutes for provisioning to finish.

### 1.2 Obtain the IPv4 Connection Pooler URI
> [!IMPORTANT]
> **IPv4 vs IPv6 Notice for Render:**
> Render free instances connect via **IPv4**. Direct Supabase connections (`db.[REF].supabase.co:5432`) use IPv6. You **must** use the **Supabase Connection Pooler** address (`aws-0-[REGION].pooler.supabase.com`), which supports IPv4.

1. In your Supabase Project Dashboard, navigate to **Project Settings** (gear icon) > **Database**.
2. Scroll to the **Connection parameters** section and locate **Connection Pooling**.
3. Set the mode to **Session** (recommended for migrations + app, port `5432`) or **Transaction** (port `6543`).
4. Copy the connection string format:
   ```text
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require
   ```
5. Replace `[YOUR-PASSWORD]` with your actual database password. This is your `DATABASE_URL`.

---

## 🚀 Phase 2: Deploy FastAPI Backend on Render

You can deploy the backend using either the automated **Render Blueprint** (recommended) or **Manual Setup**.

### Option A: Deploy via Render Blueprint (Recommended)
1. Push your latest code to your GitHub repository:
   ```bash
   git push origin main
   ```
2. Log in to [Render](https://render.com).
3. In the Render Dashboard, click **New +** and select **Blueprint**.
4. Connect your GitHub repository `rohitgupta9886/AIM_V0`.
5. Render will automatically detect [`render.yaml`](./render.yaml).
6. Under **Environment Variables**:
   - `DATABASE_URL`: Paste your Supabase connection pooler URI from Phase 1.2.
   - `SECRET_KEY`: Render will auto-generate a secure random key.
7. Click **Apply**. Render will build the service, apply migrations, seed initial users, and launch FastAPI!

---

### Option B: Manual Setup on Render
1. In the Render Dashboard, click **New +** > **Web Service**.
2. Connect your GitHub repository `rohitgupta9886/AIM_V0`.
3. Configure the service settings:
   | Setting | Value |
   | :--- | :--- |
   | **Name** | `aim-v0-backend` |
   | **Region** | Same region as Supabase (e.g., `Oregon` or `Frankfurt`) |
   | **Branch** | `main` |
   | **Root Directory** | `backend` |
   | **Runtime** | `Python 3` |
   | **Build Command** | `pip install -r requirements.txt && alembic upgrade head && python -m app.core.seed` |
   | **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
   | **Instance Type** | `Free` |
   | **Health Check Path**| `/health` |

4. Scroll down to **Environment Variables** and add the following:
   | Key | Recommended Value | Purpose |
   | :--- | :--- | :--- |
   | `PYTHON_VERSION` | `3.11.8` | Stable Python runtime |
   | `ENVIRONMENT` | `production` | Production environment flag |
   | `DATABASE_URL` | `postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require` | Supabase Postgres URI |
   | `SECRET_KEY` | *(Click "Generate" or enter a 64-char random string)* | JWT signature secret |
   | `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | 24-hour token validity |
   | `CORS_ORIGIN_REGEX` | `^https:\/\/.*\.pages\.dev$` | Allows all Cloudflare Pages domains |
   | `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Local dev origins |

5. Click **Create Web Service**.
6. Wait for the build to complete. The logs will confirm:
   ```text
   Running database migrations...
   Created user: admin (admin)
   Created user: viewer (viewer)
   [Startup] PostgreSQL database connection verified and schema synced.
   Application startup complete.
   Uvicorn running on http://0.0.0.0:10000
   ```
7. Note your live Render URL (e.g., `https://aim-v0-backend.onrender.com`).
8. Verify health in your browser: `https://aim-v0-backend.onrender.com/health`.
   Response:
   ```json
   {
     "status": "healthy",
     "database": "connected",
     "environment": "production",
     "version": "1.0.0"
   }
   ```

---

## ⚡ Phase 3: Deploy React Frontend on Cloudflare Pages

### 3.1 Connect Repository to Cloudflare Pages
1. Sign in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left navigation, select **Workers & Pages** > **Overview**.
3. Click **Create application** > **Pages** tab > **Connect to Git**.
4. Select your GitHub repository: `rohitgupta9886/AIM_V0`.
5. Click **Begin setup**.

### 3.2 Configure Build Settings
Fill in the deployment configuration:
- **Project name:** `aim-v0` (or `stockmatrix-erp`)
- **Production branch:** `main`
- **Framework preset:** `Vite`
- **Root directory:** `frontend`
- **Build command:** `npm run build`
- **Build output directory:** `dist`

### 3.3 Set Production Environment Variable
Under **Environment variables (production)**, click **Add variable**:
| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://aim-v0-backend.onrender.com/api` | Your live Render backend URL with `/api` suffix |

### 3.4 Deploy
1. Click **Save and Deploy**.
2. Cloudflare will install dependencies, compile TypeScript, run `vite build`, and publish your SPA to the edge in ~1 minute.
3. Your live application URL will be displayed: `https://aim-v0.pages.dev` (or similar).

---

## 📊 Phase 4: Initial Data Ingestion (`desktop.xlsx`)

Once both backend and frontend are live:
1. Open your Cloudflare Pages URL: `https://aim-v0.pages.dev`.
2. Sign in with the pre-seeded administrator credentials:
   - **Username:** `admin`
   - **Password:** `Admin@123`
3. Navigate to the **Excel Import & Reconciliation** tab in the sidebar.
4. Upload `desktop.xlsx` (located in the root of the project).
5. Click **Preview & Validate**:
   - The engine will verify all 204 SKUs, inward/outward totals, and mathematical parity.
6. Click **Confirm & Ingest Workbook**:
   - The data is committed atomically to your Supabase PostgreSQL database.
7. Open the **Dashboard** and **Inventory Analysis & Reports** tabs to observe the live operational metrics!

---

## 🔐 System Credentials & RBAC Matrix

| Role | Username | Default Password | Deployed Permissions |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `Admin@123` | Full mutations: Inward, Outward (with database balance locks), Stock Adjustments, Excel import commit, User account management. |
| **Viewer** | `viewer` | `Viewer@123` | Read-only access: Product catalogue, stock summary, KPI metrics, movement ledger, CSV/XLSX export downloads. All mutations blocked. |

> [!TIP]
> After your first deployment, log in as `admin`, navigate to **User & Access Governance**, and update the passwords for operational security.

---

## 💾 Database Backup & Disaster Recovery

### 1. Automated Backups (Supabase)
- Supabase automatically maintains daily database snapshots.
- Navigate to **Project Settings** > **Database** > **Backups** to inspect recent snapshots.

### 2. Manual Backup (`pg_dump`)
Run from your local terminal to create an encrypted, compressed snapshot of your production data:
```bash
# Export full binary snapshot
pg_dump "postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require" \
  -F c -b -v -f stockmatrix_prod_$(date +%Y%m%d).dump
```

### 3. Manual Restore (`pg_restore`)
To restore from a backup snapshot:
```bash
pg_restore -d "postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require" \
  --clean --if-exists -v stockmatrix_prod_20261015.dump
```

---

## ⚠️ Free-Tier Lifecycle & Cold Start Mitigations

| Provider | Free Tier Characteristic | Operational Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Render** | Spins down after 15 minutes of inactivity | The first API request after idle takes ~50–90 seconds to start the container | 1. The frontend displays an *"Initializing Enterprise Inventory Engine..."* spinner with auto-retry.<br>2. Set up a free 10-minute HTTP ping to `https://your-backend.onrender.com/health` using [UptimeRobot](https://uptimerobot.com) or [cron-job.org](https://cron-job.org). |
| **Supabase** | Project paused after 7 days of zero database queries | The database goes to sleep if unused for a week | If paused, visit your Supabase dashboard and click **Restore Project** (takes ~60 seconds to resume). |
| **Cloudflare Pages** | Always online on Cloudflare's edge | Zero cold starts. Pages load instantly worldwide | None required. Unlimited bandwidth on free tier. |

---

## 🔍 Verification & Post-Deployment Checklist

- [ ] **Health Endpoint:** `GET https://your-backend.onrender.com/health` returns status `200` with `"database": "connected"`.
- [ ] **CORS Verification:** Opening `https://your-app.pages.dev` and inspecting the network tab shows successful API preflight (`OPTIONS 204`) without CORS errors.
- [ ] **Login Flow:** Successfully logs in with `admin` / `Admin@123` and receives JWT token stored in browser localStorage.
- [ ] **SPA Direct Refresh:** Refreshing the browser on any view (`https://your-app.pages.dev/`) reloads properly without 404s (handled by `_redirects`).
- [ ] **Excel Import:** Commits `desktop.xlsx` and reconciles 204 SKUs with 100% parity.
- [ ] **Live Mutex Locks:** Recording an outward dispatch verifies that insufficient stock is blocked by PostgreSQL row-level locks.
- [ ] **Analytics Reports Export:** Clicking **Export Reports** downloads styled XLSX and CSV files with active date and spec filters applied.
