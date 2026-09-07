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
  (add + display), favorites, edit/delete/archive, size+color variants,
  real per-product Version history ("Upload Version" is functional —
  required change note + optional new main image, auto-numbered,
  productCode-scoped; a product with no real versions yet shows an
  implied "V01 — Bản thiết kế gốc" derived from its own creation info).
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
- **Notifications** — now a shared `NotificationsProvider` (placed above
  Projects/Products/Collections in layout.tsx) instead of living inside
  ProductsProvider, so all three can push into the same inbox. Real event
  types now firing: `PRODUCT_REJECTED`/`PRODUCT_APPROVED` (Admin review),
  `PROJECT_ITEM_NEEDS_REVIEW` (a product enters Sales Review or advances to
  Customer Review — the reviewer's turn), `PROJECT_ITEM_CHANGE_REQUESTED`
  (rejected at either stage), `PROJECT_ITEM_APPROVED` (reaches final
  Approved), `NEW_FEEDBACK` (a comment on a product/project/project-product),
  `NEW_PITCH` (a Collection pitch logged). Every one excludes whoever caused
  it as the recipient. "Task assigned" was deliberately left out — there's
  still no assign/reassign UI to hook a real event off of; that's a separate
  feature, not a notification-wiring gap.

Also worth knowing: several accidental-data-loss and UX fixes landed
recently across the create/edit forms — New Product, New/Edit Project, and
removing a product from a Collection now all require confirmation before
discarding instead of closing on a stray outside click. Deadline fields use
a custom-built calendar dropdown (`src/components/DateInput.tsx`, not the
native `<input type="date">`, which positioned inconsistently) that still
supports typing the date by hand. If you add another form with meaningful
user input, match this pattern rather than reintroducing outside-click-to-
close.

## Next candidates (discussed with user, going one at a time)

1. ~~Product Versions were fake (one global list shared by every product)~~
   — **done**, see Library above.
2. ~~Notification system only covered product rejection~~ — **done**, see
   Notifications above.
3. Audit the CUSTOMER role's experience end-to-end (what they see, how they
   approve) — not yet specifically reviewed. **Next up.**
4. Eventually: wire the real backend (Prisma/Supabase/auth) and migrate the
   Context providers to call real API routes instead of holding state in
   memory. Big, separate-scope effort — do not start opportunistically.
5. Possible future feature (not yet requested, just noted while working on
   notifications): there's no way to assign/reassign an R&D person to a
   project's product after creation — `assigneeName` only ever gets set
   automatically when an R&D creates their own NEW design. If a real "assign
   to teammate" flow gets built later, "task assigned" is the natural
   notification to pair with it.

## Workflow

- After finishing a meaningful chunk of work: update this file's "Feature
  status" / "Next candidates" sections, then commit with a **detailed**
  commit message (what changed and why, not just a title) so the log itself
  is useful context on the other machine.
- Before starting work on either machine: `git pull`, read this file, skim
  recent `git log`.
- Push when done on a machine so the other one can pick up cleanly.
