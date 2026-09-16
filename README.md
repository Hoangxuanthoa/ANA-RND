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
- **Auth**: Custom JWT (httpOnly cookie), via [jose](https://github.com/panva/jose)

## Project structure

```
prisma/schema.prisma        Database schema: User, Customer, Category, Material,
                             Product, ProductAsset, ProductVersion, Project,
                             ProjectProduct, Collection, CollectionItem,
                             Feedback, Activity
src/app/                    Routes (pages + API routes)
src/app/api/auth/           Register / login / logout / me
src/lib/prisma.ts           Prisma client singleton
src/lib/supabase.ts         Supabase client (browser) + admin client (server)
src/lib/auth.ts             JWT sign/verify, password hashing
src/lib/session.ts          Read the current session from cookies
src/middleware.ts           Route protection (redirects /dashboard/* to /login)
```

## Getting started

1. Copy `.env.example` to `.env` and fill in real values:
   - `DATABASE_URL` / `DIRECT_URL` — from Supabase project settings →
     Database → Connection string (pooled + direct).
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
     `SUPABASE_SERVICE_ROLE_KEY` — from Supabase project settings → API.
   - `JWT_SECRET` — generate with `openssl rand -base64 32`.

2. Install dependencies:

   ```bash
   npm install
   ```

3. Push the schema to your Supabase database:

   ```bash
   npm run db:push
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Notes / TODO

- Auth roles: `RND`, `SALES`, `CUSTOMER`, `ADMIN` (`Role` enum in
  `prisma/schema.prisma`). `/api/auth/register` defaults new users to `RND`.
- The submitted schema had 5 relations missing their opposite field, which
  Prisma requires on both sides — fixed while wiring it up:
  - `Product.feedback` / `Product.activity` back-relations added (`Feedback`
    and `Activity` both have an optional `productId`).
  - `ProductVersion.resolvedFeedback` (named relation `ResolvedInVersion`)
    added for `Feedback.resolvedInVersionId`.
  - `User.addedProjectProducts` added for `ProjectProduct.addedById`.
  - `ProjectProduct.feedback` removed — it had no matching foreign key on
    `Feedback` (which links to project/product/version, not the
    project-product pairing directly). Add a `projectProductId` on
    `Feedback` if that link turns out to be needed.
- `directUrl` was added to the `datasource` block (pointing at `DIRECT_URL`)
  so `prisma migrate` can bypass Supabase's connection pooler, which is
  required for migrations to work reliably.
- `npm audit` currently reports high-severity issues in `postcss`/`sharp`
  that are only fixed by upgrading to Next.js 16 — left as-is since the
  stack targets Next.js 15; revisit before going to production.
