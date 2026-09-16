# ANA-RND

Internal web app to store and manage 3D product designs (rattan / bamboo /
water hyacinth products), manage customer projects, and collect feedback
from designers, sales, and customers.

## Tech stack

- **Frontend**: Next.js 15 (App Router, TypeScript)
- **Backend**: Next.js API routes (Node.js runtime)
- **Database**: PostgreSQL via [Supabase](https://supabase.com), accessed
  through [Prisma](https://www.prisma.io/)
- **File storage**: Supabase Storage (3D model files, thumbnails)
- **Styling**: Tailwind CSS
- **Auth**: [Supabase Auth](https://supabase.com/docs/guides/auth) (email +
  password), via `@supabase/ssr` for cookie-based sessions

## Project structure

```
prisma/schema.prisma        Database schema: User, Customer, Category, Material,
                             Product, ProductAsset, ProductVersion, Project,
                             ProjectProduct, Collection, CollectionItem,
                             Feedback, Activity, RndTask, ProjectPhoto, and more
src/app/                    Routes (pages + API routes)
src/app/api/me/             GET the current session's real identity (role/name/
                             email/phone from the User table); PATCH to update phone
src/app/login/              Real Supabase Auth sign-in page
src/lib/prisma.ts           Prisma client singleton
src/lib/supabase/client.ts  Browser Supabase client (Client Components)
src/lib/supabase/server.ts  Server Supabase client (Server Components, Route Handlers)
src/lib/supabase/admin.ts   Service-role client — server-only, manages auth users
src/lib/supabase/middleware.ts  Session refresh + route gate, called from src/middleware.ts
src/middleware.ts           Redirects unauthenticated requests to /login (and back)
scripts/seed-users.mjs      One-off: creates the initial 9 staff Supabase Auth users
```

## Getting started

1. Copy `.env.example` to `.env` and fill in real values:
   - `DATABASE_URL` / `DIRECT_URL` — from Supabase project settings →
     Database → Connection string (pooled + direct).
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
     `SUPABASE_SERVICE_ROLE_KEY` — from Supabase project settings → API.

2. Install dependencies:

   ```bash
   npm install
   ```

3. Apply the schema to your Supabase database:

   ```bash
   npm run db:migrate
   ```

4. Create the initial staff accounts (placeholder emails/shared temp
   password — see the script's header comment):

   ```bash
   node --env-file=.env scripts/seed-users.mjs
   ```

5. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Notes / TODO

- Auth roles: `ADMIN`, `RND`, `SALES`, `MARKETING`, `CUSTOMER` (`Role` enum
  in `prisma/schema.prisma`). A real account is a Supabase Auth user *plus*
  a matching `User` row with the same `id` — creating just one half (e.g.
  via the Supabase dashboard) isn't enough on its own, see
  `scripts/seed-users.mjs` for the pattern.
- Admin gets a "Xem thử vai trò" switcher (top nav) to preview any other
  role's UI without actually being that person — see `RoleProvider.tsx`.
  Non-admin accounts always see their own real role only.
- The rest of the app (Products/Projects/Collections/etc.) still runs on
  the in-memory mock data in `src/lib/mock-data.ts`, not the real database
  — only login/session and `/api/me` (role/name/email/phone, plus updating
  phone) are wired to real data so far. See `PROGRESS.md`'s "Backend
  wiring" section for the module-by-module plan for the rest.
- Known gap: real password change isn't wired up yet (the "Đổi mật khẩu"
  fields in the profile modal are still cosmetic) — worth prioritizing
  since every seeded account currently shares one temp password.
- `npm audit` currently reports high-severity issues in `postcss`/`sharp`
  that are only fixed by upgrading to Next.js 16 — left as-is since the
  stack targets Next.js 15; revisit before going to production.
