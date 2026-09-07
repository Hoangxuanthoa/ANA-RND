# PROGRESS

**Read this file + `git log --oneline -30` first, on either machine, before doing
anything else.** The user alternates between a work computer and a home
computer, pushing to GitHub when done on one and pulling on the other. This
file is the handoff note between those sessions — keep it current instead of
relying on chat history, which doesn't carry over between machines.

## What this project is

Internal web app (Vietnamese UI) to store/manage 3D product designs (rattan /
bamboo / water hyacinth), manage customer projects, and collect feedback from
designers, sales, and customers. See [README.md](README.md) for tech stack
and setup.

## Current state (important — read before assuming anything is "real")

**This is a frontend-only prototype.** Every page runs on in-memory mock
state — there is no live database traffic, no auth check, no persistence
across a page reload.

- All data lives in [src/lib/mock-data.ts](src/lib/mock-data.ts) and is
  mutated through React Context providers (`ProductsProvider`,
  `ProjectsProvider`, `CollectionsProvider`, `SettingsProvider`,
  `RoleProvider`). Reload the page and every edit is gone.
- [src/app/login/page.tsx](src/app/login/page.tsx) is cosmetic: it does not
  check credentials, just `setTimeout` then redirects to `/dashboard`.
  `RoleProvider` is what actually controls which role you're "logged in" as
  (there's a role switcher for testing — not real auth).
- `prisma/schema.prisma` has a fairly complete real schema (User, Customer,
  Product, Project, Collection, Feedback, Activity, Notification, etc.) and
  Supabase/Prisma client libs are installed, but **none of it is wired up**:
  there are no `src/app/api/*` routes at all. `src/lib/prisma.ts` and
  `src/lib/supabase.ts` exist but nothing calls them yet.
- Do not assume README's "Auth: Custom JWT via jose" is implemented — `jose`
  isn't even in `package.json`. The README describes the intended target
  architecture, not the current one.

Wiring the real backend (API routes + auth + migrating providers from
in-memory state to real API calls) is a known, deliberately-deferred chunk of
work — see "Next candidates" below. Confirm with the user before starting it;
it's a different scope than the frontend feature work most sessions have been
doing.

## Business rules worth knowing (so you don't re-derive them)

Roles: `ADMIN`, `RND`, `SALES`, `MARKETING`, `CUSTOMER`. Full rule set with
rationale comments is in [src/lib/permissions.ts](src/lib/permissions.ts) —
read it before changing any access-control logic. Highlights:

- Library only ever shows `RELEASED` products (everyone) or `PENDING_REVIEW`
  ones (owner R&D sees their own, Admin sees all). `DRAFT`/`DEVELOPING`/
  `ARCHIVED` never show there.
- A project's products go through: creator's own approval (Sales/Marketing/
  Admin who made the project, or Admin overseeing) → if creator is Sales,
  then a real Customer approval step. Admin/Marketing projects stop at the
  creator's approval since there's no external customer.
- "My Task" (`/my-tasks`) is R&D-only: a personal queue of `ProjectProduct`
  items assigned to that specific person, distinct from the project's overall
  `rndOwner`.
- Releasing a design to the general Library requires the project to be
  `COMPLETED` first.
- Exclusive-marking a design is Sales/Admin only, and only while it's still a
  NEW design inside the project that produced it.

## Feature status (by page)

- **Dashboard** (`/dashboard`) — real computed stats from mock data (not
  fake numbers), activity feed.
- **Library** (`/library`, `/library/[code]`) — catalog browse, product
  detail with tabs (info/projects used in/feedback), comment threads
  (add + display), favorites, edit/delete/archive, size+color variants.
- **Projects** (`/projects`, `/projects/[code]`) — My Project / All Project
  tabs, full project detail (products, feedback tab, activity), approval
  pipeline (creator approval → customer approval), Exclusive/Reuse marking,
  reject-with-reason flow.
- **Collections** (`/collections`, `/collections/[id]`) — build a shareable
  set of designs, pitch log (who was pitched what, when).
- **My Task** (`/my-tasks`) — R&D personal queue, quick-view with
  approve/request-change actions.
- **Review** (`/review`, "Duyệt sản phẩm") — Admin-only catalog approval
  queue for `PENDING_REVIEW` products.
- **Settings** (`/settings`) — Admin-only CRUD for Category/Material/Size/
  Color tags and staff/user roster (with role assignment).
- **Notifications** — bell dropdown UI in `TopNav` works, but
  [src/lib/mock-data.ts](src/lib/mock-data.ts) only defines one
  `NotificationType`: `PRODUCT_REJECTED`. Nothing else in the app triggers a
  notification yet (task assigned, customer approved/rejected, new feedback,
  new pitch, etc. are all silent right now). **This is the most concrete
  known gap** — flagged in conversation on 2026-09-05, not yet started.

## Next candidates (discussed with user, not yet decided/started)

1. Expand the notification system to cover the missing event types above.
2. Audit the CUSTOMER role's experience end-to-end (what they see, how they
   approve) — not yet specifically reviewed.
3. Eventually: wire the real backend (Prisma/Supabase/auth) and migrate the
   Context providers to call real API routes instead of holding state in
   memory. Big, separate-scope effort — do not start opportunistically.

## Workflow

- After finishing a meaningful chunk of work: update this file's "Feature
  status" / "Next candidates" sections, then commit with a **detailed**
  commit message (what changed and why, not just a title) so the log itself
  is useful context on the other machine.
- Before starting work on either machine: `git pull`, read this file, skim
  recent `git log`.
- Push when done on a machine so the other one can pick up cleanly.
