# CBMS Operations Dashboard — Supabase Backend Setup Guide

## Overview

This guide walks you through connecting the CBMS Operations Dashboard to Supabase for full persistent backend functionality.

---

## Step 1 — Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in (or create a free account).
2. Click **"New Project"**.
3. Choose your organization, give the project a name (e.g. `cbms-dashboard`), set a database password, and select the **Southeast Asia (Singapore)** region for best latency from Iloilo.
4. Click **"Create new project"** and wait ~2 minutes for provisioning.

---

## Step 2 — Run the Database Migrations

In your Supabase project dashboard, click **SQL Editor** (left sidebar) → **New query**.

Run each migration file **in order**:

### 2a. Initial Schema
Copy the contents of `supabase/migrations/001_initial_schema.sql` and run it.
This creates all tables, indexes, RLS policies, and triggers.

### 2b. Seed Data
Copy the contents of `supabase/migrations/002_seed_data.sql` and run it.
This populates the database with initial calendar events, requirements, documents, and announcements.

### 2c. Storage Buckets
Copy the contents of `supabase/migrations/003_storage.sql` and run it.
This creates the `document-attachments` bucket with appropriate RLS.

---

## Step 3 — Create User Accounts

Since this is a government system, user accounts must be created by an administrator — there is no public signup form.

### Creating the Admin Account

1. In Supabase Dashboard → **Authentication** → **Users** → **Invite user**
2. Enter the admin email address and click **Send invite**.
3. The user will receive a magic link to set their password.
4. After they sign in once, go to **Table Editor** → **profiles** → find their row and change `role` from `viewer` to `admin`.

### Creating Viewer Accounts

1. In Supabase Dashboard → **Authentication** → **Users** → **Invite user**
2. Enter the viewer's email. Their default role will be `viewer`.

> **Tip:** You can also use the SQL editor to bulk-create users and set roles:
> ```sql
> UPDATE public.profiles SET role = 'admin' WHERE email = 'yourname@dasmo.gov.ph';
> ```

---

## Step 4 — Configure Environment Variables

1. In your Supabase project → **Project Settings** → **API**
2. Copy the **Project URL** and **anon / public** key.

3. In your project root, copy the example file:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and fill in your values:
   ```
   VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

---

## Step 5 — Run the Application

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

---

## Step 6 — Deploy to Production

### Option A: Vercel (Recommended — Free Tier Available)

1. Push your code to a GitHub repository.
2. Go to [vercel.com](https://vercel.com) and import the repository.
3. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
4. Click **Deploy**. Your dashboard will have a public URL in ~2 minutes.

### Option B: Netlify

1. Push code to GitHub.
2. In Netlify → **Add new site** → **Import from Git**.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add environment variables in **Site settings → Environment variables**.

### Option C: Manual / Government Server

```bash
npm run build
# Upload the contents of the `dist/` folder to your web server
```

> **Important:** For single-page apps, configure your server to redirect all routes to `index.html`.
> - **Nginx:** `try_files $uri $uri/ /index.html;`
> - **Apache:** Create `.htaccess` with `FallbackResource /index.html`

---

## Role-Based Access Summary

| Feature | Admin | Viewer |
|---------|-------|--------|
| View Dashboard | ✅ | ✅ |
| View Calendar Events | ✅ | ✅ |
| Add / Edit / Delete Events | ✅ | ❌ |
| View Requirements Checklist | ✅ | ✅ |
| Add / Edit / Delete Requirements | ✅ | ❌ |
| Update Requirement Status (inline) | ✅ | ❌ |
| View Documents | ✅ | ✅ |
| Add / Edit / Delete Documents | ✅ | ❌ |
| View Document History | ✅ | ✅ |
| View Announcements | ✅ | ✅ |
| View Analytics | ✅ | ✅ |
| Access Monitoring / Folder / Quick Links | ✅ | ✅ |

---

## Database Tables Summary

| Table | Description |
|-------|-------------|
| `profiles` | Extended user info (name, role) linked to Supabase auth |
| `calendar_events` | CBMS schedule entries |
| `requirements` | Data turnover compliance checklist items |
| `documents` | Incoming/outgoing document records |
| `document_history` | Audit trail of document routing/movements |
| `announcements` | Office notice board entries |

---

## Storage Buckets

| Bucket | Access | Purpose |
|--------|--------|---------|
| `document-attachments` | Private (authenticated read) | File attachments for tracked documents |

---

## Troubleshooting

### "Missing Supabase environment variables" error
- Make sure you have a `.env` file (not just `.env.example`) with both variables filled in.

### "Invalid login credentials"
- The user must be created in Supabase Auth first (Step 3). Old demo credentials (`admin@example.com`) no longer work.
- Check that the user accepted their email invite and set a password.

### Data not loading after login
- Check the browser console for errors.
- Verify your Supabase project is active and the migrations ran successfully.
- Confirm RLS policies are in place (SQL Editor → run `SELECT * FROM pg_policies;`).

### "Row-level security policy violation" on insert
- The user may be a `viewer` trying to write data. Confirm their role in the `profiles` table.

---

## Files Modified / Created

### New files (backend layer)
| File | Purpose |
|------|---------|
| `src/lib/supabase.js` | Supabase client singleton |
| `src/services/authService.js` | Login, logout, session, profile |
| `src/services/eventsService.js` | Calendar CRUD |
| `src/services/requirementsService.js` | Checklist CRUD |
| `src/services/documentsService.js` | Document CRUD + history + file upload |
| `src/services/announcementsService.js` | Announcements CRUD |
| `supabase/migrations/001_initial_schema.sql` | All tables + RLS + triggers |
| `supabase/migrations/002_seed_data.sql` | Initial data |
| `supabase/migrations/003_storage.sql` | Storage bucket setup |
| `.env.example` | Environment variables template |
| `SETUP.md` | This file |

### Modified files (minimal changes to wire up backend)
| File | What changed | Why |
|------|-------------|-----|
| `src/context/AppContext.jsx` | Replaced in-memory state with Supabase service calls; added `authLoading`, async CRUD, session restoration | Core data layer swap |
| `src/App.jsx` | Added `authLoading` spinner on protected route | Prevents redirect flicker during session restore |
| `src/pages/Login.jsx` | Replaced demo account check with real `supabase.auth.signInWithPassword` | Real authentication |
| `src/components/Sidebar.jsx` | Made logout async, added `loggingOut` spinner | Supabase signOut is async |
| `src/components/CalendarCard.jsx` | Made save/delete handlers async + added `saving` state + error display | All mutations are now async |
| `src/components/ChecklistCard.jsx` | Same as above | Same reason |
| `src/components/DocumentTracking.jsx` | Same as above + made `isDuplicateTrackingNumber` await-able | Same reason |
| `package.json` | Added `@supabase/supabase-js` dependency | Required for Supabase client |

### Unchanged files (100% preserved)
- `src/components/Analytics.jsx`
- `src/components/Announcements.jsx`
- `src/components/FolderDirectory.jsx`
- `src/components/MonitoringTable.jsx`
- `src/components/Navbar.jsx`
- `src/components/QuickLinks.jsx`
- `src/components/TopBar.jsx`
- `src/pages/Dashboard.jsx`
- `src/data/announcements.js`
- `src/data/calendar.js`
- `src/data/folders.js`
- `src/data/quickLinks.js`
- `src/data/requirements.js`
- `src/index.css`
- `src/main.jsx`
- `tailwind.config.js`
- `postcss.config.js`
- `vite.config.js`
- `index.html`
