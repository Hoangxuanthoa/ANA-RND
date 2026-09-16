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

**Renamed to "ANA-RND" (2026-09-16).** Was "Design Library" — that name
collided with the in-app product catalog feature (same string used for both
the overall app brand and the catalog nav link/page), so the rename kept
"Library" as the catalog's own label (TopNav nav link, `/library` page
heading, breadcrumbs, "released into ___" messages) while everything that's
actually the app's identity (page `<title>`, TopNav's logo text, `package.json`
name, README title) became "ANA-RND". Renamed everywhere: GitHub repo,
Vercel project (and its live URL), Supabase project display name, in-app
branding. The local folder path (`design-library`) was deliberately left
unchanged — purely local, not worth the disruption of a mid-session rename.

## Current state (important — read before assuming anything is "real")

**Backend wiring is done, as of 2026-09-17.** Started 2026-09-16 with
schema + real DB only; by 2026-09-17 every module (Auth, Staff/User,
Products, Projects, Collections, RndTasks, Settings) had been migrated
off mock in-memory state onto the real Supabase/Prisma/R2 stack. See
"Backend wiring" below for the full history of how each module got
there and what was verified — kept for context, not because any of it
is still "in progress."

- Real data lives in Postgres (Supabase), read/written through
  `src/app/api/**` routes and real Prisma calls — `src/lib/mock-data.ts`
  is now **only** types, pure formatting helpers (`formatDDMMYYYY`,
  `daysUntil`, etc.), and a couple of genuinely-cosmetic constants
  (`CURRENT_USER_NAME` still backs the Admin role-preview switcher,
  since previewing a role that isn't your own real account has no real
  identity to show). No module still holds its working data as a bare
  `useState(INITIAL_X)` array. Every provider (`ProductsProvider`,
  `ProjectsProvider`, `CollectionsProvider`, `SettingsProvider`,
  `RndTasksProvider`, `StaffProvider`, `NotificationsProvider`,
  `ProjectPhotosProvider`) fetches on mount and persists real mutations —
  reload the page and everything is still there.
- [src/app/login/page.tsx](src/app/login/page.tsx) calls real Supabase
  Auth (`supabase.auth.signInWithPassword`); `src/middleware.ts` gates
  every route except `/login` and the one deliberately public surface
  (`/share/collection/[slug]`, Collections' customer-facing link —
  see the Collections entry below) behind a real, server-revalidated
  session. `RoleProvider`'s "Xem thử vai trò" switcher still exists,
  Admin-only, for previewing another role's UI — it changes what the
  UI shows, never the real authenticated identity used server-side.
- Real, live data starts from wherever each module's own migration
  entry below left it (several were deliberately seeded empty; Staff
  has the real company roster). There's no bulk "demo data" seed script
  and none is planned — this is meant to be used for real from here.
- File uploads (product photos, project photos, PPTX template images)
  go to a real Cloudflare R2 bucket via `/api/upload`; R2's CORS
  limitation and its fix (`/api/image-proxy`) are documented in the
  Projects and Settings entries below — read those before touching any
  code that draws an uploaded image onto a `<canvas>`.

## Backend wiring (started 2026-09-16, completed 2026-09-17)

Real infra now exists: a Supabase project (`design-library`, Singapore
region) with a live Postgres database. Credentials live in `.env` (gitignored
— never commit it; `.env.example` documents the shape without real values).
Doing this **module by module, verifying each before the next** (the user's
explicit choice over doing it all at once) — real Auth is in scope for this
pass too, not deferred.

**Done:**
1. Supabase project created, connection verified (`npx prisma db pull`
   round-trips cleanly against the real database).
2. **Schema audited and brought current (2026-09-16), then migrated for
   real** — the schema had been written as a "V1" design doc long before
   most of today's features existed, so pushing it as-is would have meant
   an immediate second migration for nearly every module. Read every
   relevant type in `mock-data.ts` and added what was missing before
   running anything:
   - New models: `RndTask`, `ProjectPhoto`, `Size`, `Color`,
     `ProductSizeVariant`, `CollectionPitch`, `AppSettings`.
   - New fields: `User.phone`; `Product.colorId`/`exclusiveById`/
     `sourceProjectName`/`submittedAt`/`lastRejectionReason`/`incomplete`;
     `Project.completedAt`/`rndPriority`/`rndImportantNote`/
     `rndNeedsSupport`; `ProjectProduct.lastRejectionReason`;
     `ProductVersion.imageUrl`.
   - `NotificationType` expanded from 1 value to the real 11 the app fires
     today.
   - Kept English enum members throughout (`TaskPriority.FOCUS`, not a
     literal `"Trọng tâm"`) — matches the existing convention where every
     other enum (`ProductStatus`, `ProjectStatus`, ...) is English and
     Vietnamese labels are a presentation-layer concern (`badges.ts`),
     never stored.
   - Ran `npx prisma migrate dev --name init` against the real database —
     applied cleanly, verified via `npx prisma db pull --print` that all
     22 models / 15 enums exist for real. This is migration `init`
     (`prisma/migrations/20260916034245_init/`) — treat it as the
     baseline; do not edit it after the fact, add new migrations instead.
3. **App deployed to Vercel (2026-09-16)** —
   [ana-rnd.vercel.app](https://ana-rnd.vercel.app) (was
   design-library-indol.vercel.app before the app-wide rename to ANA-RND,
   see the note near the top of this file — that old URL still works too),
   GitHub repo `Hoangxuanthoa/ANA-RND` connected for auto-deploy on
   push to `main`. Deliberately Vercel **Hobby (free)** for now, not Pro —
   the user knows this technically violates Vercel's ToS for a commercial/
   company system (this is exactly why the plan moved to a VPS back on
   2026-08-29, see the hosting-plan memory) and accepted that risk
   short-term since the app isn't live for real company use yet. **This is
   a temporary testing setup, not the final answer** — bring up migrating
   to a real VPS once backend wiring + auth are done and the app is
   heading toward real use; don't let it quietly become permanent by
   default. All 6 env vars from `.env` were entered into the Vercel
   project's Environment Variables (Production and Preview) by hand —
   verified the deploy builds clean and the app loads/logs in identically
   to local. Storage is still Cloudflare R2 per the hosting plan (already
   signed up) — not wired into any code yet, comes up when the Products/
   ProjectPhotos module needs real file uploads.

4. **Real Auth via Supabase Auth (2026-09-16)** — `/login` now calls
   `supabase.auth.signInWithPassword` for real; `src/middleware.ts` (+
   `src/lib/supabase/middleware.ts`) gates every route except `/login`
   behind having a real, server-revalidated session (`getUser()`, not
   `getSession()` — the latter only reads a cookie, doesn't check it's
   still valid). Split the old single `src/lib/supabase.ts` into
   `src/lib/supabase/{client,server,admin}.ts` (browser client, SSR
   server client via `@supabase/ssr`, and the service-role admin client)
   since a real session needs all three, not just the one browser client
   that existed before.

   New `/api/me` route (GET the real identity — role/fullName/email/phone
   from the `User` table via the session's `auth.users.id`; PATCH updates
   `phone` only) is what `RoleProvider` now bootstraps from on mount,
   instead of always defaulting to a hardcoded `"RND"`. Per the user's
   explicit choice, **the existing "Xem thử vai trò" preview switcher is
   kept, but only for the real Admin account** (`isRealAdmin`, computed
   from the real fetched role, not the currently-previewed one) —
   non-admin accounts see their own real role only, no switcher. The
   switcher's underlying mechanism (a local `role` override + the old
   per-role mock `CURRENT_USER_EMAIL`/`CURRENT_USER_PHONE` for whichever
   role is being previewed) is otherwise unchanged from before real auth.

   Ran a one-off `scripts/seed-users.mjs` to create real Supabase Auth
   users + matching `User` rows for all 9 people in the `STAFF` list —
   placeholder `@rattanco.vn` emails (real ones are coming later from the
   user) and one shared temp password, so real login works today without
   waiting on that. Idempotent (skips anyone whose auth user already
   exists), safe to re-run once real emails arrive (would need updating,
   not re-running as-is, since email is looked up to decide "already
   exists").

   **Scoping call, flagged clearly to the user:** this step is "real
   login + real role gate", not yet "real per-person identity everywhere."
   The rest of the app still resolves "who am I" via the old
   `CURRENT_USER_NAME[role]` mock mapping (one fixed name per role,
   e.g. `RND` always means "An") for all ownership checks
   (`.startsWith(userName)` across Products/Projects/etc.) — that's
   unchanged and deliberately deferred to the Staff/User migration step
   below, since fixing it here alone (without also migrating those
   modules) would leave the app in a worse, inconsistent half-state.
   **Concrete near-term risk this creates:** SALES has 5 real people
   (Hà/Hùng/Trang/Quân/Ngọc) and RND has 2 (An/Lan), but the mock mapping
   only ever attributes ownership to one name per role — e.g. Hùng
   logging in today would have his work show up as created by "Hà"
   everywhere. Low-impact while only Minh (Admin) and An have been smoke
   tested, but this should push the Staff/User + Projects/Products
   migration up in priority rather than treating it as just another item
   in the list.

   Also flagged: real password change isn't wired up yet (`ProfileModal`'s
   password fields are still cosmetic/no-op, pre-dates this change) —
   worth doing very soon given every seeded account currently shares one
   temp password. Email editing for a real account is intentionally
   disabled in the UI (`emailEditable` prop) rather than half-wired, since
   a real change there needs a Supabase confirmation-email round trip
   that placeholder `@rattanco.vn` addresses can't receive.

   Verified in the browser end-to-end: real login as Minh (Admin) and An
   (RND), confirmed the preview switcher still works for Admin and is
   completely absent for An, confirmed sign-out clears the session
   (`sb-*-auth-token` cookie) and redirects to `/login`, confirmed a
   direct/root navigation with no session redirects to `/login`, and
   confirmed the phone field in "Cập nhật thông tin" round-trips through
   a real `/api/me` PATCH (survives a full page reload).

5. **Staff/User module wired to the real database (2026-09-16)** — the
   hardcoded `STAFF` array in `mock-data.ts` (and its `StaffMember` type)
   is gone; the company roster is now real rows in the `User` table.
   - New `src/components/StaffProvider.tsx` (`useStaff()`) fetches from a
     new `GET /api/staff` (any signed-in user — every role needs the
     roster for pickers, not just Admin) and exposes `addStaff`/
     `updateStaffRole`/`removeStaff`. Wired into `layout.tsx` right after
     `RoleProvider`, ahead of everything that needs it.
   - `POST /api/staff` (Admin-only) creates a real Supabase Auth user
     (Admin sets the initial password directly in the form — same
     no-email-confirmation approach as `scripts/seed-users.mjs`) plus the
     matching `User` row. `PATCH /api/staff/[id]` changes role and/or
     deactivates (`isActive: false`) — a real account can't be
     hard-deleted without breaking every Product/Project/etc. that
     references it, so "Xóa" in Settings' User tab now deactivates and
     **also bans the real Supabase Auth login** (`ban_duration`), not
     just hides them from pickers.
   - Every call site that imported the mock `STAFF` constant now calls
     `useStaff()` instead: `NewProjectModal`/`EditProjectModal` (Sales/
     R&D owner pickers), `AddRndTaskModal` + `my-tasks/page.tsx`
     (requester picker, Admin's doer filter/overview), `ProjectsProvider`/
     `RndTasksProvider` (looking up Admin for a notification recipient),
     and `permissions.ts`'s `projectCreatorRole` (now takes `staff` as a
     parameter instead of importing the mock array directly, since it's a
     plain function and can't call a hook itself). Settings' User tab
     moved off `SettingsProvider` (which now only holds the PPTX template)
     onto `useStaff()`, and gained Email + Mật khẩu tạm fields since a
     real account needs both, not just a name.
   - **Deliberately unchanged in this step:** Projects/Products/RndTasks
     still store ownership as plain name strings (`rndOwner: "An"`, etc.),
     matched against `StaffMember.name` — real staff rows were seeded
     with the exact same names as the old mock array, so this is a
     drop-in swap with zero data-shape changes elsewhere. Fixing
     ownership to key off real `User.id` (the actual fix for the
     multi-person-per-role gap flagged in the Auth entry above) happens
     naturally once Projects/Products themselves migrate below — doing it
     piecemeal here would leave those modules half-real, half-mock.
   - Verified in the browser: Settings' User tab shows all 9 real people
     with real emails; added a real "Test User" account through the form
     (appeared immediately, survived a full reload); deactivated it
     (disappeared from the list, survived a full reload — confirmed the
     `isActive: true` filter in `GET /api/staff` is doing real filtering,
     not just a client-side hide); confirmed New Project's Sales/R&D
     owner dropdowns reflect the real roster.

   **Follow-up same day — Admin password reset:** the user pointed out
   Settings' User tab had no way for Admin to reset someone else's
   password (needed immediately — they were about to add real personal
   accounts). Added: `PATCH /api/staff/[id]` now also accepts a
   `password` field (goes straight to
   `getSupabaseAdmin().auth.admin.updateUserById` — no "current password"
   check, since this is Admin resetting someone ELSE's, unlike the
   self-service change in `/api/me`/`ProfileModal` which needs your own).
   `useStaff()` gained `resetPassword(id, password)`. UI: a small key
   icon per row in Settings' User tab opens an inline "Mật khẩu mới cho
   ___:" form (matches the app's established inline-edit convention, see
   `my-tasks/page.tsx`'s `StagedTextCell`) instead of a separate modal.
   Also created the user's own first real (non-`@rattanco.vn`) account
   through this exact flow — `henry@artexnaman.com`, Admin — as the
   template for the real emails they'll add for everyone else going
   forward. Verified end-to-end: reset a real account's password via the
   UI, signed out, signed back in with the new password successfully.

   **Observed and flagged to the user:** logging in as `henry@artexnaman.com`
   (a second, distinct ADMIN account alongside Minh) still greets "Chào
   buổi sáng, Minh" on the dashboard — confirms in practice the
   `CURRENT_USER_NAME[role]` mock-mapping gap called out in the Auth
   entry above (one fixed display name per role, not per real account).
   Not a new bug, not fixed here — flagged as it'll only get more visible
   as more real people log in before Products/Projects migrate.

6. ~~Products → Projects (+ProjectProduct/ProjectPhoto/ProjectAttachment) →
   Collections → RndTasks → Notifications → Settings~~ — **done**, see
   each module's own dated entry further down in "Backend wiring" for
   what actually shipped and how it was verified.

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
  reject-with-reason flow. Customer can now request a new project (their
  own type only, no Khách hàng/R&D pickers — see NewProjectModal); the
  chosen Sales rep becomes its real owner (`createdByName`) from creation,
  not the customer. EditProjectModal can now also assign/reassign a
  project's `rndOwner` after creation (didn't exist before at all).
  R&D-owner pickers (New/EditProjectModal) now also list Admin, not just
  RND staff — Admin does hands-on R&D work too (see the 2026-09-11 My
  Task entry below). A new "Ảnh dự án" tab (see the dated entry near the
  bottom of this file) holds a raw, un-vetted photo folder per project,
  separate from the real Product-based Product Development tab.

  **Product Development tab redone as a grid (2026-09-10):** was a
  vertical list of full-width rows with every status/action inline;
  changed to an image-forward grid (3 cols, matching Collections/Library)
  so it visually matches the rest of the app. Each row carried far more
  state than a Collection/Library card has room for (usage/status/reuse
  badges, needs-attention flag, rejection reason, assignee, customer
  approval, feedback count, and action buttons for Set Exclusive/Resubmit/
  internal review/Release to Library), so the card face keeps only what's
  needed to scan a project at a glance (image, name, code, the 3 badges,
  a "Cần duyệt" flag when something needs action, a truncated note
  preview, assignee + feedback count) — everything else moved into
  `ProjectProductQuickView` (opened by clicking the card), which grew
  from "customer-approval + feedback only" into the one place for all of
  it. Along the way, the internal/creator review stage (Sales approving
  before it goes to the customer) was merged into the same inline
  approve/request-change block the customer stage already used — both
  ultimately call the same `rejectProjectProduct`/`approveProjectProduct`,
  they just gate on a different status — so `RejectProjectProductModal`
  (a separate reason-entry dialog, only used for the creator stage) was
  deleted as redundant. `src/app/my-tasks/page.tsx` also renders this
  same quick view (its own list layout is untouched — that page is a
  separate, paused feature) and picked up the same new props.

  **Follow-up fixes (2026-09-10):**
  - **Release no longer waits on customer approval:** the gate used to be
    Sales approves → Customer approves → project Completed. The user
    doesn't yet expect customers to actually log in and act here (that's
    a real future goal, not today), so requiring their approval blocked
    release on a step nobody performs. `permissions.ts` now has
    `isProjectProductReadyToRelease`/`canReleaseProjectProduct` — release
    only needs the item to have cleared the creator/Sales review stage
    (status `CUSTOMER_REVIEW` or `APPROVED`) plus project `COMPLETED`;
    the `CUSTOMER_REVIEW` step and its "Đang chờ khách duyệt" indicator
    still exist and still work if a customer does show up, they just
    don't block release anymore. Both `projects/[code]/page.tsx` and
    `my-tasks/page.tsx` were using their own duplicated inline version of
    this condition — consolidated into the one shared permissions
    function instead of fixing it in two places.
  - **R&D can now edit a rejected item's info, not just resubmit:** the
    quick view only offered "Gửi lại duyệt" after a change request, with
    no way to actually change anything first — pointed out as illogical.
    Added a "Sửa thông tin sản phẩm" button next to it (shown whenever
    the item is `DEVELOPING` and the viewer can edit that product) that
    reuses the existing `NewProductModal` in its established edit mode
    (same one Library's product detail page already uses) — closes the
    quick view first rather than stacking a second modal on top.
  - **Release button moved onto the grid card itself:** previously only
    reachable inside the quick view; now shows directly in the card's
    badge row (right-aligned, short label "Release") whenever that item
    is release-eligible, so it's a one-click action instead of
    click-to-open-modal-then-click. Required switching the card from a
    `<button>` wrapper to a `<div role="button">` (a real button can't
    contain another button) — kept keyboard support (`tabIndex`, Enter
    key) and used `stopPropagation` on the Release button so it doesn't
    also trigger the card's own click-to-open-quick-view, same pattern
    already used for the remove button on Collection cards.
  - **"Release tất cả" bulk action:** releasing each eligible NEW design
    one at a time was tedious once a Completed project had several ready
    — added a button in the "Dự án đã hoàn thành" banner (right-aligned,
    shows the count, only rendered when at least one item qualifies) that
    calls `releaseToLibrary` for every release-eligible item at once.
    Reuse items (already-released library products picked into the
    project) are never included, since they don't need releasing.

  **Bulk image upload for rush projects (2026-09-10):** uploading many
  designs one at a time (open form, fill every field, submit, repeat)
  was too slow when a project is under time pressure. Added "Up hàng
  loạt" next to "Thiết kế mới"/"Pick Product" — `BulkUploadModal.tsx`
  takes a pile of images at once, auto-crops each to a square (no
  per-image manual crop step, that would defeat the point) via a new
  `autoSquareCropUrl` in `cropImage.ts`, and uses the file name (minus
  extension) as a starting product name. Each image becomes its own
  placeholder `Product` with `incomplete: true` — real category/
  material/kích thước aren't filled in yet, so it's flagged with a
  "Thiếu thông tin" badge (card face, quick view header, and a
  dedicated amber banner in the quick view with a "Sửa thông tin sản
  phẩm" button) and, critically, `isProjectProductReadyToRelease` in
  `permissions.ts` now also requires `!product.incomplete` — an
  incomplete item can move through the whole Sales/Customer review
  pipeline same as any other, it just can't be Released (individually
  or via "Release tất cả") until someone opens it and saves real info
  (`NewProductModal`'s edit-mode save clears the flag). Two new
  provider functions do the actual bulk writes in one state update each
  instead of looping the single-item ones: `createProductsBulk` (assigns
  all N codes off one `products` snapshot — looping `createProduct`
  instead would have every iteration compute the same "next" code,
  since none of the intermediate `setProducts` calls land before the
  next `nextProductCode` call reads the still-stale array) and
  `addProductsToProjectBulk` (also collapses what would otherwise be N
  separate "sản phẩm mới cần bạn duyệt" notifications into one).

  **"Xuất Collection" straight from a completed Project (2026-09-10):**
  previously the only way to pitch a project's approved designs was to
  manually build a Collection from the Library one product at a time.
  Added a "Xuất Collection" button next to "Release tất cả" in the "Dự
  án đã hoàn thành" banner — click it and it reuses 100% of the existing
  Collection export machinery (no new export code at all): it either
  creates a new `Collection` seeded with the project's exportable
  product codes and `sourceProjectCode` set to this project, or — if
  one linked to this project already exists — tops it up with any
  newly-eligible codes (never removing ones already there, in case
  someone deliberately took one out) instead of spawning a duplicate
  collection on every click. Then routes straight to its
  `/collections/[id]/export` page. Eligibility
  (`isProjectProductExportable` in `permissions.ts`) is intentionally
  looser than release-readiness: just cleared creator/Sales review,
  same as the user asked ("sales approve, hoặc người tạo project
  approve, và dự án Completed") — it doesn't care about the product's
  Library/DRAFT status the way release does, since exporting a pitch
  deck never touches the Library. **Bulk-upload placeholders count too
  (2026-09-10 follow-up):** initially excluded incomplete items on the
  assumption a customer shouldn't see a product with no real category/
  material — but the user pointed out a pitch sometimes only needs the
  photo (that's exactly what the export page's per-field "Hiển thị
  thông tin" toggles already support: untick Item code/Category/
  Material/Dimension and the image fills the whole cell). So
  `isProjectProductExportable` no longer checks `incomplete` at all —
  only `Release`/`Release tất cả` still do.
- **Collections** (`/collections`, `/collections/[id]`) — build a shareable
  set of designs, pitch log (who was pitched what, when). Export is now
  real, not simulated: "Xuất Collection" (renamed from "Xuất PDF" once it
  led to a page offering both PPTX and PDF — the old name stopped making
  sense) goes to `/collections/[id]/export`, where you pick which
  products to include (checkboxes, all on by default), a customer, and a
  "Số sản phẩm/trang" mode, then either "Xuất PPTX"
  (real .pptx via `pptxgenjs`, `src/lib/pptxExport.ts` — added as an npm
  dependency since there's no browser-native way to produce PowerPoint)
  or "Xuất PDF" (`window.print()` — browsers already do PDF well, no
  library needed). "Lấy link online" still logs a pitch via the existing
  `LogPitchModal`, then reveals a real working link to
  `/collections/[id]/share` — a public-style read-only page (no TopNav,
  no role gating) showing the collection's *current* full contents live
  (not the customized export subset). Per-item fields are deliberately
  just mã/category/material/kích thước, no product name — user said
  Vietnamese product names aren't standardized enough to show a customer.
  Product images embed via pptxgenjs's own `path` loader (works for both
  real URLs and session-only `blob:` object URLs); a product with no
  image gets a flat tinted rounded-rect instead of the app's usual
  placeholder icon (pptxgenjs shapes can't easily draw that SVG). Image
  loads are wrapped per-image (`safeAddImage`) so one bad image degrades
  to a colored box instead of failing the whole export. PPTX and PDF
  share the same "log the pitch once per page visit" flag, so triggering
  both on one visit doesn't double-log.

  **PDF now mirrors PPTX exactly (2026-09-07):** PDF used to be a
  completely separate, simpler HTML design (single doc, 3-col grid) from
  the PPTX's 5 fixed layouts — user pointed out this was confusing
  ("vào trong lại có 2 option") and asked PDF to just export whatever the
  PPTX pages look like. Built `src/components/CollectionSlideDeck.tsx`,
  an HTML/CSS mirror of pptxExport.ts's slides (imports `CONTENT_LAYOUTS`
  from there so the cols/rows/inner decision per mode is never
  duplicated/out of sync) — real 16:9-shaped slide cards (cover → content
  pages using the selected mode → closing), same labeled Item code/
  Category/Material/Dimension rows, same cover/closing template images
  from Settings. This is now the export page's only preview (always
  rendered, no toggle).

  **Follow-up same day:** user tried it and pointed out two things —
  (1) the "Preview" link was pointless since the deck is already always
  visible below, and (2) "Xuất PDF" still opened the OS print dialog
  (`window.print()`), which isn't a real "click and get a file" export
  like PPTX. Fixed both: removed the Preview link entirely, and replaced
  print-to-PDF with a direct download using `html2canvas-pro` (NOT the
  original `html2canvas`, which can't parse this app's `oklch()` CSS
  colors) to screenshot each slide, then `jspdf` assembling those images
  into a PDF. Trade-off at the time: the PDF's text was a raster image
  per slide, not selectable/searchable — accepted temporarily since
  matching PPTX's export flow (one click, no dialog) was the explicit
  ask. All print-specific CSS (`print:*` Tailwind classes, `globals.css`'s
  `@page` rule) was removed since nothing calls `window.print()` anywhere
  in the app anymore. **This screenshot approach was replaced entirely
  on 2026-09-09 — see below.**

  **PDF rewritten to draw natively, no more screenshots (2026-09-09):**
  user asked why the PDF couldn't have sharp text/images "như Pptx" instead
  of a photo of the screen. Screenshotting was always a quality ceiling
  (raster text, fixed resolution, larger files), so `src/lib/pdfExport.ts`
  was rewritten from scratch to draw directly with `jsPDF` — real vector
  text (`doc.text`) and real embedded images (`doc.addImage`), the same
  spirit as `pptxExport.ts`, and `html2canvas-pro` was removed as a
  dependency entirely (`npm uninstall html2canvas-pro`). To avoid the PPTX
  and PDF (and the on-page preview) quietly drifting into 3 different
  layouts over time, the shared geometry (cell/grid math, the 5 fixed
  `ProductsPerSlide` layouts, per-product label rows, colors, logo
  constants) was extracted into a new `src/lib/exportLayout.ts`, imported
  by all three (`pptxExport.ts`, `pdfExport.ts`, `CollectionSlideDeck.tsx`
  — the last is now purely the on-page preview, nothing captures its DOM
  anymore). Two things jsPDF doesn't do natively that pptxgenjs does were
  built by hand: (1) CSS `object-fit: cover` — `coverImageDataUrl()` crops
  a source image to the target box's aspect ratio on an off-screen canvas
  at 200 DPI before handing it to `addImage`, so product photos fill their
  cell without stretching; (2) Vietnamese text — jsPDF's built-in fonts
  (Helvetica/Times/Courier) don't cover Vietnamese diacritics, so a real
  Unicode font is embedded at generation time via `addFileToVFS`/`addFont`,
  fetched at runtime from `public/fonts/Lato-{Regular,Bold}.ttf` (Lato,
  OFL-licensed — same family Google Fonts ships; license text alongside at
  `public/fonts/Lato-OFL.txt`. Deliberately not the Arial.ttf already on
  the machine, since that's Monotype-licensed and not freely
  redistributable in a public `public/` folder). One bug caught during
  verification: `doc.text(..., {maxWidth})` auto-wraps text that's too
  wide for its column (e.g. mode 6's narrow info column wrapping "Item
  code: RND-00125" to 2 lines) but the row-advance logic assumed exactly
  one line per row, so the wrapped second line overlapped the next row —
  fixed by measuring the real wrapped line count first via
  `doc.splitTextToSize()` and advancing `y` by that many lines instead of
  always 1. Verified by capturing the actual generated PDF blob out of the
  running browser and inspecting it directly (not just checking for a
  thrown error) — confirmed crisp, real, non-overlapping Vietnamese text
  on cover/content/closing pages.

  **Fixed 2026-09-09:** `public/logo.png` used to have a fully opaque
  white background baked in (confirmed via canvas alpha readback — 255
  everywhere), invisible on white surfaces but showing as a visible white
  box on the green cover/closing slides. Chroma-keyed it via a one-off
  PowerShell + System.Drawing pass (same tool used earlier for the
  favicon crop): white/near-white *and* neutral (low-saturation) pixels
  go transparent, with a soft partial-alpha fade at anti-aliased edges;
  saturated logo colors (including the pale green ring, which could have
  been mistaken for background) are left untouched since they fail the
  "neutral" check. No code changed, just the asset — the fix applies
  everywhere `/logo.png` is referenced (TopNav, login, share page,
  CollectionSlideDeck, and the real .pptx via pptxExport.ts) for free.

  **Per-field info toggles, note field dropped (2026-09-09):** the
  cover-slide "Ghi chú (hiện trên file)" field was removed entirely (not
  needed — a customer-facing pitch doesn't need a freeform note baked
  into the file). In its place, each of the 4 per-product info rows
  (Item code/Category/Material/Dimension) can now be toggled on/off per
  export via pill buttons plus a "Tất cả" master toggle (standard
  select-all behavior: toggling it sets all 4 at once; toggling any one
  field off clears the master without touching the other 3).
  `exportLayout.ts`'s `buildInfoRows()` takes an `InfoVisibility` object
  and only emits the rows that are on (Dimension's header line and its
  size-variant lines travel together as one unit); `innerRects()` grows
  the image to fill the entire cell when no fields are selected at all,
  instead of leaving the info half of the cell blank — useful for a
  pitch that's meant to be pure moodboard/visual with no spec data. Wired
  through all 3 consumers (PPTX, PDF, on-page preview) the same way the
  5 layout modes already are, so none of them can drift out of sync.

  **Quick view on the collection detail page (2026-09-10):** clicking a
  product used to navigate straight to `/library/[code]`, leaving the
  collection — now it opens `ProductQuickView` (the same modal already
  used on Design Library and the Review page) in place, so you can check
  whether a design still belongs in the collection without losing your
  spot. The remove ("X") button on the thumbnail still works the same as
  before, just with `stopPropagation` so it doesn't also open the modal.

  **PPTX template (2026-09-07):** content slides use 5 fixed, deliberately
  designed layouts (not a generic auto-grid) picked via "Số sản
  phẩm/trang" — `1|2|3|4|6` (`ProductsPerSlide` in pptxExport.ts,
  `PRODUCTS_PER_SLIDE_OPTIONS`). 1/4/6 use an image-left/info-right cell
  ("LR"); 2/3 use image-top/info-bottom ("TB") — see the `LAYOUTS` table
  in pptxExport.ts for the exact per-mode grid/font-size config. A
  shorter last chunk just leaves the unused slots of that mode's layout
  empty rather than switching modes. Per-cell info is 4+N labeled rows
  now (`drawProductCell` in pptxExport.ts), stacked with each row's own
  height so the size-variant count doesn't need special-casing: "Item
  code: …", "Category: …", "Material: …", "Dimension:", then one line
  per size variant ("S: 40 x 40 x 45 cm") or a single "—" row when the
  product has none. Content slides show only the logo (moved up to
  y=0.15in) — no collection name repeated per page, since it's already
  on the cover; this freed up header space so `CONTENT_AREA` starts
  higher (y=0.75 vs the old 1.0). Cover/closing slide
  backgrounds are now configurable (a photo instead of the flat green,
  with an automatic 55%-black overlay so white text stays legible) via a
  new **"Mẫu PPTX" tab in Settings** (Admin-only, `SettingsProvider`'s
  `pptxTemplate`/`updatePptxTemplate` — cover image, closing image,
  closing text, applies to every export team-wide). The cover title
  itself stays bound to the real collection name always — not part of
  this template, matches user's own framing ("chữ thì mặc định là tên
  Collection rồi"). Cover/closing images are NOT run through the 1:1 crop
  tool (see below) — a slide background should be 16:9, cropping it
  square would letterbox it.

  **Image crop tool (2026-09-07):** every product image upload (main
  image + gallery images, both create and edit, plus Upload Version) now
  opens `ImageCropModal.tsx` (built on `react-easy-crop`, aspect locked
  to 1:1) before the file becomes state — user wants every product photo
  standardized to a square now that thumbnails show up everywhere
  (Library/Collection grids, PPTX cells) and were getting cropped
  differently by each container's own CSS. `src/lib/cropImage.ts` does
  the actual canvas crop and returns a real Blob object URL, so nothing
  downstream needs to know a crop happened.

  Bug fixed 2026-09-07 after user report: "Add to Collection" in
  `ProductQuickView.tsx` opened a dropdown that was invisible — the modal
  card had `overflow-hidden` and the button sat at the very bottom edge
  with nothing below it in the flow, so the absolutely-positioned
  dropdown got clipped to zero visible height; removed `overflow-hidden`
  from that card (nothing else in it needed the clip — the product image
  already has its own), and made the dropdown open upward there
  (`AddToCollectionButton`'s new `openUp` prop) since even visible it was
  still opening off-screen downward — same fix "Add to Project" already
  had in that modal.

  Also that day: briefly tried adding a "+ Thêm sản phẩm" button on the
  collection page itself (a search + pick list modal, so you wouldn't
  have to tab back to Library) — user tried it and reverted the idea:
  a text-only list doesn't scale once there are hundreds/thousands of
  products, no way to visually confirm you picked the right one. Decided
  the Library page (with its filters + images) is the one correct place
  to find and add a product, for both Collections and Projects — so
  "+ Thêm sản phẩm" here and "Pick Product" on the project page
  (`src/app/projects/[code]/page.tsx`) are now both just a `Link` to
  `/library`, where the existing per-product "Add to Collection" /
  "Add to Project" buttons (which only ever list a handful of
  collections/projects by name, not products — that direction is fine as
  a text list) do the actual adding. If a real product search UI is ever
  wanted directly from these pages, it should reuse Library's own
  filter/search, not a second parallel picker.
- **My Task** (`/my-tasks`) — a personal work hub for R&D and Admin (see
  the dated entries below for the 2026-09-11 rebuild): To do list (every
  project you're rndOwner of, one row each, plus ad-hoc tasks you add
  yourself), Check-in, and "Thêm công việc" to add an ad-hoc task.
  "Đăng ký KPI"/"Kết quả KPI" are planned tabs, not built yet. Check-in
  is two genuinely different forms depending on role (see the 2026-09-16
  entry near the bottom): R&D gets today's "Đang làm" items + an image
  export to paste into a chat group; Admin gets a weekly "Trọng tâm"
  report for their own boss (hoàn thành tuần trước / chưa hoàn thành /
  kế hoạch tuần này), scoped across everyone, not just their own work.
- **Review** (`/review`, "Duyệt sản phẩm") — Admin-only catalog approval
  queue for `PENDING_REVIEW` products.
- **Settings** (`/settings`) — Admin-only CRUD for Category/Material/Size/
  Color tags and staff/user roster (with role assignment).

- **Header consistency pass (2026-09-09):** after a full honest review
  (user asked for one, "công tâm khách quan") surfaced that the app
  looked "half old, half new," went through every list page and dropped
  `<h1>PageName</h1>` blocks that just repeated the already-highlighted
  TopNav label. Projects and Collections got the fuller treatment first:
  removed the h1+count-subtitle, moved "+ New Project"/"+ New Collection"
  up inline with the My/All tabs, folded counts into each tab's own
  label ("My Project (3)", "All Project (8)"), added a search box (left
  of the "+ New" button — Projects matches name/code/customer, Collections
  matches name only) and pagination (10/page, same Back/page-dropdown/Next
  pattern as Library) since neither had a page cap before. Projects'
  status filter chips (All/Created/Developing/Completed/Closed) also got
  per-status counts, computed from scope+search but not from which chip
  is currently selected (a new `searched` memo sits between the scope and
  status filters for this). My Task/Review/Settings got the same h1
  removal treatment — adapted since they have no tab/button row to fold a
  count into: My Task and Review kept their count as a plain caption line
  instead of a bold title; Settings dropped its subtitle entirely too
  (it was prose restating the tab labels, not a count — and had gone
  stale, never mentioning the later-added "Mẫu PPTX" tab).
- **Notifications** — now a shared `NotificationsProvider` (placed above
  Projects/Products/Collections in layout.tsx) instead of living inside
  ProductsProvider, so all three can push into the same inbox. Real event
  types now firing: `PRODUCT_REJECTED`/`PRODUCT_APPROVED` (Admin review),
  `PROJECT_ITEM_NEEDS_REVIEW` (a product enters Sales Review or advances to
  Customer Review — the reviewer's turn), `PROJECT_ITEM_CHANGE_REQUESTED`
  (rejected at either stage), `PROJECT_ITEM_APPROVED` (reaches final
  Approved), `NEW_FEEDBACK` (a comment on a product/project/project-product),
  `NEW_PITCH` (a Collection pitch logged), `PROJECT_REQUESTED_BY_CUSTOMER`
  (Customer submits a new project request — the chosen Sales rep is
  notified), `PROJECT_ASSIGNED` (a project's `rndOwner` is set/changed via
  EditProjectModal — the new R&D owner is notified; this is "task assigned"
  at the project level). Every one excludes whoever caused it as the
  recipient. Still not covered: assigning/reassigning a specific
  `ProjectProductItem.assigneeName` (per-product task within a project) —
  that field still only ever gets set automatically when an R&D creates
  their own NEW design; no UI to set it otherwise, so no notification
  trigger for it either.

- **Account menu** — the avatar in TopNav is now clickable: a dropdown
  shows name/role/email and two actions, "Cập nhật thông tin" (opens
  `ProfileModal` to edit email/phone — kept in `RoleProvider` as
  `profile`/`updateProfile`, per role, so it survives navigation) and
  "Đăng xuất" (just routes to `/login` — no real session to tear down).
  Deliberately did NOT make the person's *name* editable there — it's
  `CURRENT_USER_NAME`, the same string used everywhere for ownership
  matching (`createdByName`, `rndOwner`, `assigneeName`); letting it drift
  from a profile edit would silently break those comparisons. ProfileModal
  also has a "Đổi mật khẩu" section (current/new/confirm) — client-side
  validated (all 3 filled, min 6 chars, new === confirm) but purely
  cosmetic, same as the rest of auth in this prototype: there's no real
  password anywhere to check against or update. Both the bell and account
  dropdowns close on outside click now (`mousedown` listener + ref, same
  pattern as `DateInput.tsx` — match it for any future dropdown).

Also worth knowing: several accidental-data-loss and UX fixes landed
recently across the create/edit forms — New Product, New/Edit Project, and
removing a product from a Collection now all require confirmation before
discarding instead of closing on a stray outside click. Deadline fields use
a custom-built calendar dropdown (`src/components/DateInput.tsx`, not the
native `<input type="date">`, which positioned inconsistently) that still
supports typing the date by hand. If you add another form with meaningful
user input, match this pattern rather than reintroducing outside-click-to-
close.

**My Task consulted + 3 improvements shipped for department coordination
(2026-09-13):** user asked for an objective review of My Task now that
employees use it daily — confirmed 1 project always has exactly 1 R&D
owner (no multi-assignee case to design for). Gave 4 concrete suggestions;
user approved 1/2/4 and explicitly deferred 3 ("khó cập nhật theo từng
trạng thái lắm, tạm thời để như thế" — per-project x/y-products-approved
progress display, skipped for now):
- **Admin can now filter the To Do List by person** — a "Người làm"
  `<select>` in the toolbar (Admin-only), same options as the R&D-owner
  picker elsewhere (`STAFF` filtered to RND/ADMIN).
- **"Tổng quan phòng" overview block** (Admin-only, To Do List tab only,
  above the filter row) — clickable per-person cards showing đang làm/trễ
  hạn/cần hỗ trợ counts, sourced from `allRows` (ignores the table's own
  active filters, so the numbers stay a stable "true total"), sorted
  overdue-first so whoever needs attention surfaces without scanning the
  whole table. Clicking a card toggles the same `doerFilter` state as the
  dropdown above (`toggleDoerFilter`) — clicking the active one clears it.
- **"Lưu ý quan trọng" is now a real one-way channel, Admin → assignee**:
  editable only when `isAdmin` (via the same `StagedTextCell` pattern as
  "Cần hỗ trợ", save-on-blur/Enter); R&D still only ever sees it as
  read-only text, never gets edit UI — this was a deliberate design
  constraint from the user ("chỉ anh được điền, ae không được điền hay
  chỉnh sửa"), not a placeholder oversight. New provider functions
  `setProjectImportantNote`/`setTaskImportantNote` (mirroring
  `setProjectNeedsSupport`/`setTaskNeedsSupport` but notifying the
  opposite direction) fire a new `ADMIN_IMPORTANT_NOTE` notification to
  the row's owner. `RndTask.importantNote`'s "no UI yet" code comment is
  now stale/resolved.

Verified live in the browser: Admin sets a note on an R&D person's ad-hoc
task, switching to that R&D's own role view shows it as read-only text and
a real notification with the note's content in their bell inbox.

## Next candidates (discussed with user, going one at a time)

1. ~~Product Versions were fake (one global list shared by every product)~~
   — **done**, see Library above.
2. ~~Notification system only covered product rejection~~ — **done**, see
   Notifications above.
3. ~~Audit the CUSTOMER role's experience end-to-end~~ — **done**. Biggest
   gap found: Customer couldn't originate a project at all. Fixed by adding
   a request-intake flow (see Projects above) rather than just reviewing
   the prior read-only experience.
4. ~~Wiring the real backend (Prisma/Supabase/auth)~~ — **done
   2026-09-16 → 2026-09-17**, see the "Backend wiring" section right
   after "Current state" near the top of this file for the full history
   of every module's migration and how each was verified.
5. ~~Possible future feature: per-product (not just per-project) R&D
   assignment~~ — **ruled out 2026-09-13**. User confirmed the real
   workflow is always 1 project → 1 R&D owner; no need to build a
   per-product assignee flow. Don't revisit unless the user says this has
   changed.
7. Per-project product-approval progress (e.g. "3/5 sản phẩm đã duyệt" on
   a My Task project row) — suggested during the 2026-09-13 My Task
   consult, user deferred it ("khó cập nhật theo từng trạng thái lắm, tạm
   thời để như thế"). Data for it already exists via `projectProducts`;
   revisit only if the user brings it up again, don't build proactively.
6. ~~Branding pass using the real company logo~~ — **done**. User supplied
   the "Artex Nam An" logo (`public/logo.png`, full lockup) and said the
   brand colors are "xanh lá cây + nâu đất" (green + earthy brown).
   `--accent`/`--accent-hover`/`--accent-soft`/`--accent-soft-text` and
   `--green`/`--green-soft` in
   [globals.css](src/app/globals.css) were retinted to real hex values
   sampled from the logo (accent darkened to `#1c8f18` vs. the logo's
   brightest green `#25B81E` for WCAG contrast on white button text — see
   comment in globals.css). Deliberately did not add a standalone
   `--brown` token — the brown shows up naturally via the logo image
   itself, not as a UI accent color. `src/app/icon.png` (210×210 crop of
   just the leaf/drop mark) replaces the default `favicon.ico` (deleted)
   via Next's automatic file-based icon convention. TopNav uses the full
   `logo.png` lockup; the login page's green brand panel uses the cropped
   `icon.png` mark (on a white circle) plus a plain "Artex Nam An" text
   wordmark instead of the logo file, since the logo's own green/brown
   wordmark wouldn't read against a green background. `layout.tsx`
   metadata title/description updated to the real brand too.

**My Task rebuilt as an R&D/Admin work hub (2026-09-11):** the old page
was a flat queue of individually-assigned `ProjectProductItem`s, R&D-only.
Replaced with tabs — To do list / Check-in / Thêm công việc ("Đăng ký
KPI"/"Kết quả KPI" are agreed future tabs, deliberately not built or even
shown yet) — and opened up to Admin too (`canViewMyTasks` now allows
`RND || ADMIN`), each person seeing only their own work.

Two sources feed one unified To Do List table: **projects** you're
`rndOwner` of (one row per project — deliberately NOT one row per
assigned product, after the user pointed out that would just repeat the
project name; click the name to go straight to `/projects/[code]`) and
**ad-hoc tasks** (`RndTask`, a new type/provider — `RndTasksProvider`,
self-added via "Thêm công việc", never notifying anyone since it's your
own list). Columns: STT / Tên công việc / Phân loại / Mức độ (added
during the design discussion — the user's spec had it on Check-in but
not the To Do List column list, clearly an oversight since Check-in just
filters the same rows) / Trạng thái / Còn lại / Người yêu cầu / Ngày bắt
đầu / Deadline / Ngày hoàn thành thực tế / Lưu ý quan trọng / Cần hỗ trợ.

**Trạng thái is never a stored toggle — always derived, and the two
sources derive it differently by design:**
- Project rows: `project.status === "COMPLETED"`, nothing else. The user
  was explicit that this should be true even if every individual item is
  already approved — until Sales/PM actually closes the project out, the
  task stays "Đang làm", which is meant to nudge R&D to go push for that
  ("tăng tính chủ động, phối hợp"). `markCompleted` now also stamps
  `Project.completedAt` (via `todayDDMMYYYY()`) so "Ngày hoàn thành thực
  tế" shows the real day this happened instead of recomputing "today" on
  every render.
- Ad-hoc task rows: derived from whether `completedAt` holds a real
  parseable date (`parseDDMMYYYY(...) !== null`, not just truthiness —
  a partially-typed garbage string would otherwise flip the status
  mid-keystroke). The user flipped the causality from my first draft:
  R&D doesn't toggle a status dropdown, they type/pick the actual
  completion date, and *that* is what marks it done.

"Ngày còn lại" is `daysUntil()` (new helper next to `parseDDMMYYYY` in
mock-data.ts) — deadline minus **today**, not minus start date (the
literal wording in the request would have given a fixed planned
duration, not a real "how many days left"; confirmed this with the user
before building it). Negative values render as "Trễ N ngày" in red.

"Lưu ý quan trọng" is Admin-writable by design but has **no input UI
yet** — the user explicitly deferred the Admin cross-employee view
("trang riêng cho Admin, xây sau khi xong r&d") to a later phase, so for
now the column just exists on `Project`/`RndTask` and renders "—" for
everyone. "Cần hỗ trợ" is the opposite — R&D-writable right in the row
(`NeedsSupportCell`, a small local component that stages the text
locally and only calls the save function on blur/Enter, so a
notification doesn't fire on every keystroke) — saving a non-empty value
pings Admin (`setProjectNeedsSupport`/`setTaskNeedsSupport`, new
functions on Projects/RndTasksProvider respectively, both following the
existing "dedicated function, not a bare patch, because this one has a
side effect" pattern already used elsewhere in these providers). Added
`RND_NEEDS_SUPPORT` to `NotificationType`.

**Check-in** filters the same rows to "Đang làm" only, with a narrower
column set, plus an "Xuất ảnh" button — re-added `html2canvas-pro` as a
dependency (removed earlier from the PDF export for a completely
different reason: rasterizing customer-facing PDF text was a quality
regression there. Here the target format genuinely is an image — R&D
wants to paste it straight into the company's Zalo/chat check-in group —
so a DOM screenshot is the right tool, not a compromise). Tries
`navigator.clipboard.write` with a `ClipboardItem` first so the whole
flow is "click Xuất ảnh, Ctrl+V in the chat app"; falls back to a plain
file download if the browser doesn't support clipboard images. Verified
by capturing the actual blob via a patched `clipboard.write` in the
running browser, reconstructing it from base64, and viewing the real
PNG — Vietnamese text and the app's oklch-based badge colors both
render correctly (confirming `-pro`, not vanilla html2canvas, was the
right call — same finding as before).

**To Do List follow-up — filters/sort/pagination, a 4th priority tier,
inline-editable ad-hoc fields (2026-09-11):** added a status-chip row
(Tất cả/Đang làm/Hoàn thành, counts computed from every other active
filter except status itself — same convention as the Projects list
page) plus a filter/search/sort toolbar (Phân loại, Mức độ, Nguồn —
Từ Project vs Tự thêm — dropdowns; a name search box; a "Sắp xếp"
dropdown for Deadline gần nhất/Mức độ cao trước/Tên A-Z) and pagination
(`PAGE_SIZE = 12`, same Back/page-dropdown/Next pattern lifted directly
from `projects/page.tsx`). All of this is scoped to the To Do List tab
only — Check-in stays a single unpaginated "Đang làm" snapshot on
purpose, since it's meant to be captured whole as one check-in image.

`TaskPriority` gained a 4th, higher tier: `"Trọng tâm" | "Cao" |
"Trung bình" | "Thấp"`. Its badge is solid `bg-red text-white` (vs.
"Cao"'s `bg-red-soft text-red`) so the two read as genuinely different
severities, not near-duplicates.

Ad-hoc tasks (not project rows) picked up inline editing for the fields
that were previously stuck at their created value — Tên công việc
(`StagedTextCell`, generalized from the old `NeedsSupportCell` to cover
both), Người yêu cầu (a `<select>` over `STAFF`), Ngày bắt đầu and
Deadline (both `DateInput`, the same calendar-dropdown component
`EditProjectModal` already uses for Project deadlines). This was in
response to the user directly asking whether ad-hoc tasks needed their
own detail page — recommended against it: everything about a task is
already a handful of flat fields fully visible in its row, so a detail
modal would just be the same fields behind an extra click, and it'd cut
against "Thêm công việc" being deliberately fast/low-friction. Closing
the actual gap (you couldn't fix a typo without deleting and re-adding
the task) by making more cells inline-editable, the same way Phân
loại/Mức độ/Ngày hoàn thành thực tế already were, fixes the real
problem without adding a new surface. Project rows are unaffected —
their Tên/Người yêu cầu/Ngày bắt đầu/Deadline still come straight from
`Project` and are edited via the project's own Edit modal, not from
My Task.

**Follow-up same day — compact toolbar, unified row look, explicit edit
mode:** the status chips + filter/search/sort had been two stacked rows
and felt heavy; collapsed to one `flex-wrap` row (chips, search, the
three filter `<select>`s, and Sắp xếp pushed right via `ml-auto`), and
shortened each filter's resting label to just the field name ("Phân
loại" instead of "Tất cả phân loại") so it reads like a placeholder
and takes less width.

The inline-editable fields added above (Tên/Phân loại/Người yêu
cầu/Ngày bắt đầu/Deadline/Hoàn thành) had made ad-hoc task rows look
like a form next to a project row's plain text — the user asked for
them to look the same at rest. Introduced a per-row `editingTaskId`
state: a task row now renders identically to a project row (plain
text, no borders) until its own "⋯" menu → "Chỉnh sửa" is clicked,
which is when those six fields switch to their editable controls; the
same menu item becomes "Xong" while editing and switches it back.
Fields aren't gated behind edit mode though — Mức độ (the colored
`<select>` pill) and Cần hỗ trợ were already shown identically for
both row kinds and stay always-interactive, since those are meant to
be one-click actions, not something that needs an explicit edit step.
A "⋯" menu (task rows only) held "Chỉnh sửa"/"Xóa" — **superseded by
the next entry below**, which replaced the icon with clicking the task
name itself. "Xóa" opens a `ConfirmDialog` instead of deleting
immediately, matching how every other delete in the app works — that
part is unchanged.

**Follow-up again same day — click the name instead of a "⋯" icon,
Enter to finish editing:** the user found the "⋯" column fiddly.
Replaced `RowActionsMenu` with `TaskNameMenu`: clicking a task's name
(only when the row isn't already being edited — while editing, that
slot is the real text input) opens the same Chỉnh sửa/Xóa dropdown
right under the name, closing on outside click same as before. This
also let the trailing action column be dropped entirely, one less
`gridCols` track.

Exiting edit mode now has two paths: click anywhere outside the row
(a `onBlur` on the row's wrapping `<div>` that checks
`!e.currentTarget.contains(e.relatedTarget)` — native `focusout`
bubbles, so this catches focus leaving the whole row regardless of
which field had it), or press Enter — which the user specifically
asked for. Enter turned out to need its own explicit path rather than
reusing the blur mechanism: `StagedTextCell`'s Enter handler calls
`.blur()` on itself to save, but that's a DOM call made from inside
this same keydown dispatch, and the resulting native `focusout` didn't
reliably re-enter React's event handling for the row's own `onBlur` —
confirmed by testing (`document.addEventListener("keydown", ..., true)`
in the live page) that the row-level exit genuinely didn't fire on
Enter even though it fired correctly for a real mouse click elsewhere.
Fixed by giving `StagedTextCell` an `onEnter` callback that the title
field wires directly to `setEditingTaskId(null)` — an explicit state
update instead of depending on event bubbling — and adding the same
direct call to the "Hoàn thành" field's own Enter handler.

**Admin's To Do List now aggregates everyone's work (2026-09-11):**
Admin could already add ad-hoc tasks (no code change needed — "Thêm công
việc" was already gated on `canViewMyTasks`, which covers both `RND` and
`ADMIN`). What Admin didn't have was visibility into R&D's work: their To
Do List showed only their own rows, same as an R&D person. Since Admin
oversees R&D day-to-day, their To Do List tab now aggregates **every**
project row that has an `rndOwner` set (not just Admin's own) and
**every** ad-hoc task from anyone, alongside their own — a new `doer`
field on the unified `TodoRow` (`project.rndOwner` or `task.ownerName`)
renders as a "Người làm" column, shown only when `role === "ADMIN"`. R&D
users are unaffected: their filter (`p.rndOwner === userName`) and column
set are unchanged, still their own work only.

Also fixed `NewProjectModal`/`EditProjectModal`'s R&D-owner picker to
include Admin as a selectable option (`STAFF.filter(s => s.role ===
"RND" || s.role === "ADMIN")`, was RND-only) — the user pointed out Admin
does hands-on R&D work too, not just oversight, so should be assignable
like any other R&D staff member.

**Recurring bug class worth remembering:** Tailwind's JIT content
scanner only detects an arbitrary-value class (e.g. `grid-cols-[...]`)
when it appears as a **complete literal string** in source. The first
attempt at an Admin-conditional grid (interpolating an extra column width
into a template literal, e.g. `` `grid-cols-[36px_${extra}...]` ``)
silently produced no CSS at all — the class had zero effect, and the
whole grid collapsed into stacked block rows (confirmed via screenshot:
data was correct, layout was not). Fixed by defining two full literal
constants (`GRID_COLS_ADMIN`, `GRID_COLS_DEFAULT`) and picking between
them with a plain ternary — never build a Tailwind arbitrary-value class
by interpolation, even inside a helper function.

**New "Ảnh dự án" tab — a raw photo folder per project (2026-09-16):**
before this, the only way to get an image into a project was "Up hàng
loạt" (BulkUploadModal), which turns every image into a real `Product`
immediately (placeholder, `incomplete: true`, straight into Product
Development). The user wanted a lighter first step: dump reference/
factory photos into a folder, browse them, and only decide later which
ones become real products. Brainstormed the shape with the user before
building (their explicit ask going in): grid view, click-to-view with
Next/Back + zoom, still exportable as a Collection-style file or a plain
ZIP, and a "Release Library" action per photo that pre-attaches the image
to the New Product form.

New `ProjectPhoto` type + `ProjectPhotosProvider` (`src/lib/mock-data.ts`,
`src/components/ProjectPhotosProvider.tsx`) — deliberately NOT reusing
`Product`: no category/material, not part of the approval pipeline, just
`{id, projectCode, fileName, url, uploadedAt, releasedProductCode?}`.
Uploads keep the original image aspect ratio (no auto-square-crop like
Up hàng loạt — these are reference photos, not final product shots);
thumbnails still display via CSS `object-cover` in the grid the same as
every other card grid in the app, that's just a display-time crop, not a
destructive one. `PhotoViewerModal.tsx` is a new full-screen viewer
(Next/Back cycles through the whole folder, +/- zoom via a CSS
`transform: scale()`, arrow keys and Escape wired up) — deliberately not
built on `ProjectProductQuickView`, which is tightly coupled to the
product-approval workflow and has no notion of a bare image.

**Release, one at a time or in bulk, both land in the same place:**
clicking "Release" on a single photo opens `NewProductModal` (a new
`initialMainImage` prop seeds `mainImage` when creating, not editing) so
the user fills in the rest of a real product form in one pass. Selecting
several photos (checkboxes, always visible — not gated behind a
"select mode" toggle) and clicking "Release hàng loạt" instead reuses
`createProductsBulk`/`addProductsToProjectBulk` verbatim — same
placeholder-with-"Thiếu thông tin" path as Up hàng loạt, since the point
of doing several at once is speed, not a full form per photo. Either way
the photo stays in the folder afterward (`markPhotoReleased` tags it with
the resulting product code, shown as "Đã release → CODE" instead of the
Release button) rather than disappearing — the user wanted to still be
able to see the original, and avoid a photo silently vanishing looking
like data loss.

**Deliberately did NOT let this feed the real Collection system:**
discussed directly with the user whether one Collection export could mix
raw photos with picked/bulk-uploaded products. Collections are a list of
real `productCodes` used for an actual pitch (share link, pitch log) —
teaching that machinery to also accept bare, un-vetted images would mean
changing the Collection data model everywhere it's read (detail page,
share page, both exports), for photos that haven't been vetted as real
designs yet. Landed on: "Xuất ảnh" (`PhotoExportModal.tsx`) reuses the
existing PPTX/PDF generators (`generateCollectionPptx`/
`generateCollectionPdf`) 100% as-is, in the image-only mode those already
supported (`InfoVisibility` all `false` — this path already existed for
Collections' own "hide all fields" toggle, just never had a caller with
no real product data at all) — but it's a one-off file, no `Collection`
row created, no share link, no pitch log. If the user wants one file
mixing real products and specific photos, the answer is "Release those
photos first" — once released they're real Products and automatically
show up in the project's normal "Xuất Collection" alongside everything
else, no separate merge path needed.

Also added: "Tải ZIP" downloads the folder (or just the current
selection) as a real .zip — new `jszip` dependency, fetches each
`blob:` URL back into a `Blob` and zips them client-side, no server
involved, matching how every other export in this app works. A
lightweight per-photo delete (`ConfirmDialog`, matching every other
delete in the app) was added even though not explicitly requested — an
upload mistake needed some way to be removed, and every other list in
this app has one.

Every management action (upload, release single/bulk, delete) is gated
behind `canCreateProduct(role)` (RND/ADMIN only, reusing the existing
permission — no new one needed); viewing, zip, and photo-only export stay
open to anyone who can see the project page, same visibility as the rest
of the project detail page. Verified in the browser end-to-end: upload,
viewer Next/Back/zoom, single Release (product lands in Product
Development with the picked image, needs-review flag included), bulk
Release (both land as "Thiếu thông tin" placeholders), ZIP (network tab
shows both blob fetches resolving), PDF export (fonts fetch fine, no
console errors), delete, and confirmed Sales (non-RND/ADMIN) sees only
view/zip/export with no upload/Release/delete controls.

**Admin's Check-in is now a completely different form from R&D's
(2026-09-16):** the user's actual boss asks for a weekly report with 3
fixed sections — công việc hoàn thành tuần trước / chưa hoàn thành / kế
hoạch tuần này — nothing like R&D's daily "what I'm doing right now"
snapshot. Brainstormed the exact meaning of each section before coding
(the literal wording was ambiguous on a couple of points); confirmed
with the user: scoped to **Mức độ = Trọng tâm only**, across **everyone**
(Admin + R&D, reusing the same aggregated `allRows` Admin's To Do List
already computes — not just Admin's own work), computed as:
- Hoàn thành tuần trước: Trọng tâm rows where `completedAt` falls in last
  week (Mon–Sun).
- Chưa hoàn thành: every Trọng tâm row still `!isDone`, no deadline
  filter — the user explicitly wants the full backlog here, not just
  what's overdue.
- Hoàn thành tuần này (kế hoạch): Trọng tâm rows not yet done whose
  `deadline` falls in the current week — read as "planned to finish this
  week," not "already finished so far this week" (the user's answer was
  ambiguous between the two; went with this reading and flagged it back
  to them before building).

New `weekRange(offsetWeeks)` / `isDDMMYYYYInRange()` in `mock-data.ts` —
Monday-start week boundaries computed off today's real date, kept as
generic date helpers (not Admin/Check-in-specific) alongside
`daysUntil`/`parseDDMMYYYY`. `role === "ADMIN"` branches the Check-in
tab's whole render: a new `CheckinSection` component (STT/Tên công
việc/Người làm + one date column whose label and value differ per
section — Hoàn thành / Còn lại / Deadline) renders the 3 groups; R&D's
existing single-table Check-in is completely untouched below the branch.
Both variants still share the same `checkinRef`-based "Xuất ảnh"
(`html2canvas-pro` capture, clipboard-first with file-download fallback)
with no changes to that mechanism — it just captures whichever markup is
currently rendered. Verified in the browser: set 2 project rows and 1
new ad-hoc task to Trọng tâm (with `completedAt` in last week, one
deadline in this week), confirmed all 3 sections populate with the right
rows and counts, confirmed "Xuất ảnh" copies correctly, and confirmed
switching to an R&D role shows the original unchanged form.

**Follow-up (2026-09-16) — Ảnh dự án's photo viewer, smaller + wheel
zoom:** the user found the original `PhotoViewerModal` (full-screen dark
overlay) too heavy just to glance at one photo, and clicking +/- for
every zoom step "hơi bất tiện". Rebuilt to match the same bounded
quick-view sizing every other modal in this app uses (`ProductQuickView`'s
`max-w-[720px]` card on a light `bg-black/30` backdrop, click-outside to
close) instead of a bespoke full-screen dark viewer. Added scroll-wheel
zoom (`onWheel`, `e.preventDefault()` + adjust `zoom` state by a step
per wheel tick, clamped to the same `[1, 3]` range as the existing
+/- buttons) — the buttons stay too, wheel is just the fast path.
Next/Back, Escape, and arrow-key navigation are unchanged. Verified in
the browser: modal renders as a small centered card (not full-screen),
scroll-wheel over the image changes its `transform: scale(...)` live.

**Follow-up again same day — bigger still, fullscreen toggle, fixed a
real background-scroll bug:** the user tried it and asked for 3 things:
taller (the `max-w-[1400px]`/`h-[70vh]` bump wasn't enough), a
fullscreen option alongside the existing bounded size, and — a real bug,
not a preference — scrolling to zoom the photo was *also* scrolling the
project page underneath the modal.

- Height: `h-[85vh]` (capped `max-h-[950px]`), up from `70vh`/`960px`.
- Fullscreen toggle: new button next to the zoom +/- icons. Rebuilt the
  layout around this rather than bolting it on — the image area is now
  `flex-1` (fills whatever space is left) instead of a fixed/vh height,
  so the bounded mode (`h-[85vh] max-w-[1400px]`, rounded, padded) and
  fullscreen mode (`h-full`, no max-width/rounding/padding) are just two
  sets of classes on the same layout, not two different layouts to keep
  in sync.
- The background-scroll bug was real and root-caused: a plain React
  `onWheel={...}` handler's `e.preventDefault()` does **not** reliably
  stop the page behind a modal from scrolling too, because React
  attaches wheel listeners passively by default and a passive listener
  can't block the browser's native scroll action. Fixed by attaching a
  real native `wheel` listener via `useEffect` + a ref with
  `{ passive: false }` explicitly — this is the only way
  `preventDefault()` on wheel actually takes effect. **Worth remembering
  for any future wheel-driven interaction in this app** — reach for a
  manual non-passive native listener from the start, not `onWheel`.

Verified in the browser: taller card measured correctly; fullscreen
toggle swaps between the bounded card and a full-viewport view (icon and
title swap too) and back; scroll-zoomed while fullscreen and confirmed
both the image's `transform: scale(...)` changed **and**
`window.scrollY` stayed at 0 throughout.

**Follow-up (2026-09-16) — comments on Ảnh dự án photos:** the user
pointed out photos had no way to leave notes/discussion, unlike
Products/Projects/ProjectProduct which all already have a feedback
thread. Added the same pattern: `ProjectPhoto.comments: FeedbackItem[]`
(embedded directly on the photo, same spirit as
`ProjectProductItem.feedback` — a photo folder entry is a small,
self-contained item, not a top-level entity like Product/Project that
warrants its own separate feedback array). `ProjectPhotosProvider` gained
`addPhotoComment(id, content)` using the same `feedbackIdentity(role)`
helper every other comment feature already uses; `addPhotos` now seeds
`comments: []` on every new photo. New `PhotoCommentsModal.tsx` —
deliberately its own small bounded quick-view modal (`max-w-[480px]`),
not folded into the (much bigger) `PhotoViewerModal`, since commenting
and full-size viewing are different intents. Each photo card gained a
small comment-count button (speech-bubble icon + count) next to the
Release button/badge, at the exact spot the user pointed at in a
screenshot. Opening it looks up the live photo by id from the provider's
list (not a snapshot passed in at click time), so the count/thread stay
in sync immediately after posting — verified in the browser: posted a
comment, it appeared in the modal instantly with the right
author/role/time, and the card's count badge updated from 0 to 1 without
closing the modal.

**Follow-up (2026-09-16) — square product images + zoomable thumbnail:**
after the comments feature shipped, the user sent screenshots of the
Product Development grid showing bulk/single-released photos displayed
inconsistently — some cropped so badly a label or logo was mostly cut
off. Root cause: every product-image grid card (Library, Dashboard,
Product Development, Collections) used a fixed *height* box
(`h-32`/`h-40`/`h-[150px]`) with `object-cover`, so on a grid column
wider than that height, `object-cover` cropped an arbitrary-aspect
source image unpredictably. `BulkUploadModal`'s own preview grid already
used `aspect-square` and looked clean by comparison — changed all the
above to `aspect-square` too, so the frame itself is always square
regardless of column width.
That only fixed *display*, not the *source*: releasing a photo from
Ảnh dự án (single or bulk) was carrying over the raw uploaded photo's
original aspect ratio untouched as `mainImage`, unlike "Up hàng loạt"
which auto-square-crops via `autoSquareCropUrl`. Folders intentionally
keep the original ratio (an earlier decision), but a *released* product
should look like every other product — so `ProjectPhotosTab`'s single
`openRelease(photo)` and `handleBulkRelease` now both await
`autoSquareCropUrl(photo.url)` before handing the image to
`NewProductModal`/`createProductsBulk`, with a brief "Đang xử lý…" busy
state on the Release button/confirm dialog while the crop runs.
Also from the same feedback: the comment button on Ảnh dự án cards was
a bare icon the user found too small — changed to icon + "Comment (N)"
label. And: clicking a Product Development card always opened
`ProjectProductQuickView` (status/feedback) with no way to see the image
large. Generalized `PhotoViewerModal`'s prop type from `ProjectPhoto[]`
to a plain structural `{fileName, url, releasedProductCode?}[]` (no
behavior change, just decoupled from the photo-folder type) and reused
it in `ProjectProductQuickView`: clicking specifically the small
product thumbnail now opens it as a single-image zoom/fullscreen
viewer stacked on top of the quick view; clicking elsewhere on the card
still opens the quick view as before. Verified all three in the
browser: uploaded a synthetic wide (800×400) test photo, released it
both ways and confirmed the product's main image came out centered and
square in the grid; opened the new thumbnail zoom and confirmed it
opens on top of (not instead of) the quick view and closes back to it.
Noticed in passing (not fixed here, flagged as a separate follow-up):
`ImageLightbox.tsx` (used by `ProductQuickView`/`library/[code]`) has
the same passive-`onWheel` background-scroll-leak bug already fixed in
`PhotoViewerModal` this session — console showed repeated
"Unable to preventDefault inside passive event listener" while testing.

**Follow-up (2026-09-16) — stacked-modal close bug + comment sidebar in
image zoom:** the user found the new product-thumbnail zoom viewer had
a real bug: since it renders nested inside `ProjectProductQuickView`'s
own backdrop (so it can stack visually on top), a click on the
viewer's own backdrop bubbled up through the unstopped click event to
the parent quick view's backdrop `onClick`, closing both modals at
once when the user only meant to dismiss the zoomed image. Fixed by
adding `e.stopPropagation()` before calling `onClose` on
`PhotoViewerModal`'s backdrop click — harmless for its other, unnested
usage in `ProjectPhotosTab`.
Same message also proposed adding a comment column right in the image
viewer, so a reviewer doesn't have to bounce between the zoomed image
and the status quick view's feedback thread below it — agreed this was
reasonable and implemented it as an optional `comments` prop on
`PhotoViewerModal` (`{ items: FeedbackItem[], onAdd }`), rendered as a
`w-[300px]` bordered side column with the same avatar/tint/textarea
markup as every other feedback thread in the app. Only
`ProjectProductQuickView` passes it in (wired to the same
`item.feedback` / `addProjectProductFeedback` already backing its own
feedback section), so writing a comment from either place updates the
same list — verified in the browser: posted one comment from the
status quick view, opened the zoom viewer and saw it already there,
posted a second comment from inside the zoom sidebar, closed the
viewer (confirmed only the viewer closed, quick view stayed open) and
saw both comments present in the quick view's own feedback list.

**Follow-up (2026-09-16) — Ảnh dự án square crop, 4-col grids, tab
rename:** the "folder keeps original aspect ratio" decision from
earlier in the session turned out to still look bad in practice —
same fixed-height + `object-cover` overflow the rest of the session's
product-image cards already had fixed, just not applied here. Switched
Ảnh dự án's card image box to `aspect-square` too, matching Product
Development's look exactly (the crop-on-release fix from earlier still
only affects what gets copied into a *product*'s `mainImage` — the
folder's own stored photo is untouched, only how it's framed on the
card changed).
Product Development's grid was `grid-cols-3` while Ảnh dự án was
already `grid-cols-4` — changed Product Development to match so both
tabs show the same row density.
Renamed the two project tabs: "Product Development" → "Sản phẩm dạng
up", "Ảnh dự án" → "Sản phẩm dạng ảnh" — distinguishing by how the
item entered the project (typed/uploaded directly as a full product
vs. captured as a photo, pending release). Updated every other
user-facing string naming the old tabs (both `ConfirmDialog`
descriptions in `ProjectPhotosTab`, the PPTX/PDF export
`collectionName` in `PhotoExportModal`) plus two stale code comments.

## Backend wiring: Products module goes real (2026-09-16)

The user decided features are "good enough for now" and asked to wire
the backend for real so the team can start using it and give feedback
from actual usage, instead of only his own judgment. Planned (in plan
mode, approved) and built the first slice: a Cloudflare R2 storage
foundation, then the full **Products** module — matching the migration
order already set (Products → Projects → Collections → RndTasks →
Notifications → Settings). Real Products/Category/Material/Size/Color
data start **empty** (user's choice) except the lookup taxonomy itself
and 4 seeded Customers (`scripts/seed-catalog.mjs`) — real company
data, not demo content.

**R2 setup note:** the user already runs other sites on this Cloudflare
account, so R2 was set up with an isolated bucket + a token scoped to
only that bucket (never "all buckets") to avoid any risk to the other
sites — walked through step-by-step rather than navigated for them,
since it touches a shared account.

Full technical detail lives in the two commit messages (`8165cdd` R2
foundation, `3d6b123` Products backend) — summary here:
- `src/lib/storage/r2.ts` + `/api/upload`: generic, any-module-reusable
  image upload over the S3-compatible protocol (not R2's own SDK), per
  the portability rule already agreed for this app.
- Full `/api/products/*` + `/api/categories|materials|sizes|colors/*`
  route surface, same auth pattern as Staff/User (session checked via
  Supabase, role re-checked server-side from Prisma, client role never
  trusted). `ProductsProvider.tsx` rewritten to hit these instead of
  mock arrays with **zero call-site changes** at ~15 consumers — still
  addressed by business code everywhere, real UUID id never leaves the
  server.
- `RoleProvider` now exposes the real signed-in identity
  (`effectiveUserName`) — the first real fix of the long-flagged
  `CURRENT_USER_NAME` mock-identity gap, applied to every
  Products-ownership check; Projects/Collections checks in the same
  files deliberately keep the mock name until their own migration turn
  (mixing real and mock ownership in one file needed care — documented
  inline at each split).
- Found and fixed a real bug this exposed: three product quick-view
  modals (Library, Duyệt sản phẩm, Collection detail) held a frozen
  `Product` snapshot from click-time instead of re-deriving it from the
  live list, so a mutation made from inside the open modal (favoriting,
  approving) didn't visibly update until closed and reopened. Now keyed
  by code, re-derived every render — same pattern already used for
  ProjectPhotosTab's photo quick views.

**Verified end-to-end in the browser** against the real Supabase DB
(logged in as Henry's real Admin account): created a product (server
generated the code) → approved it → favorited it → posted a comment —
each step survived a hard reload. Renamed a category, confirmed the
rename persisted and cascaded into the already-fetched product list.
**Follow-up, same day — R2 credentials landed:** walked the user
through Cloudflare R2 setup step by step (their account also hosts two
other production buckets — `artex-nam-an-backup-database`,
`artex-nam-an-prod` — so this specifically used a dedicated `ana-rnd`
bucket + an Account API Token scoped to only that bucket, Object Read &
Write, never "apply to all buckets"). Public Development URL
(`*.r2.dev`) enabled for now — fine for the current testing phase, a
custom domain is one env var away whenever that matters. Added the 5
`R2_*` vars to `.env`, restarted the dev server, and verified for
real: created a product with an image end-to-end (crop → upload →
`https://pub-....r2.dev/products/<uuid>.jpg` returned and publicly
loads), the product's card still showed the real image after a full
page reload. Cleaned up the two test products (rejected → hidden from
Library by the existing DRAFT-visibility rule; no code change needed).
**Still needed before this reaches production:** the same 5 `R2_*`
vars have to be added to Vercel's own Environment Variables too — the
local `.env` only covers local dev.

**Deliberately not done this pass** (next module's turn): Projects +
Ảnh dự án + the in-project approval pipeline, Collections, RndTasks,
Notifications (Products still calls the old mock `addNotification()` —
harmless, since that provider is 100% client-side and never depended
on by anything real), Settings' PPTX template.

## Backend wiring: Notifications + Projects module go real (2026-09-16/17)

User asked to finish this module fully and test it all in one pass
("làm tiếp Projects đi bạn, bạn cứ hoàn thiện hết đi, test 1 thể").
Rereading the module first surfaced that **Projects fires 8 of the
app's 11 notification types** — by far the heaviest notification user
in the app — and that the Products migration had silently dropped
notifications entirely (its mutation logic moved server-side, so the
old mock `addNotification()` calls embedded in that logic never fire
anymore; no visible error, just a quietly regressed feature). Doing
Projects the same way would make that regression obvious and painful
(Sales wouldn't know when to review, R&D wouldn't know about a
rejection), so **real Notifications** were built first as a small
prerequisite, and Products' missing notification calls were patched
retroactively in the same pass.

**Notifications (new, real):** `src/lib/server/notify.ts` — one shared
`notify({userId, type, title, message, link})` helper any route calls
inline to create a real row, keyed by the actual recipient's user id
(no more name-matching). `GET /api/notifications` (mine) + `PATCH
/api/notifications/[id]` (mark read, ownership-checked).
`NotificationsProvider.tsx` rewritten to fetch/mark-read for real;
`addNotification()` is kept as a local-only, unsynced fallback (id
prefixed `local-`) purely so still-mock Collections/RndTasks keep
working unchanged until their own migration turn. Patched retroactively
into Products' approve/reject/feedback routes (`PRODUCT_APPROVED`/
`PRODUCT_REJECTED`/`NEW_FEEDBACK`), closing the regression above.

**Projects module, full real backend:** same proven pattern as
Products (session-derived identity, role re-checked server-side,
Provider keeps its exact public interface so ~10 call-site files needed
zero function-signature changes beyond `createProject` becoming
`async`). Covers: Project CRUD + `close`/`complete`, the full
ProjectProduct review state machine (creator/Sales approval → customer
approval, reject/resubmit, auto-complete when every item is Approved,
using the real `projectCreatorRole` role-branching logic — needed zero
rewrite since both Project and Staff were already real by this point),
and Ảnh dự án (ProjectPhoto: real raw-image upload replacing the old
session-only `blob:` URL, delete, comments, and "Release" into a real
Product). A small schema migration
(`20260916160154_add_project_photo_comments`) added `Feedback.
projectPhotoId` so photo comments persist for real — additive only,
no data touched. Since `Feedback` is one shared flat table (not
embedded per-parent), any type that embeds feedback/comments inline
client-side (project products' feedback, photo comments) is served via
a flat GET endpoint merged client-side in the provider, same approach
Products already used.

**Real bug found and fixed during testing — R2 free-tier CORS
limitation:** cropping an already-uploaded (not freshly-picked) photo
during Release draws it onto a `<canvas>`, which throws a "tainted
canvas" `SecurityError` unless the image loaded with proper CORS.
Configured the bucket's CORS Policy first, but direct
`fetch(url, {mode:'cors'})` testing in the browser proved R2's free
"Public Development URL" (`*.r2.dev`) doesn't send
`Access-Control-Allow-Origin` **at all**, regardless of the bucket's
CORS policy — only a custom domain would honor it, and one isn't set
up yet. Fixed architecturally instead of waiting on a custom domain:
new `GET /api/image-proxy?url=...` (auth-checked, only re-serves URLs
under `R2_PUBLIC_URL`) re-fetches the image server-side and returns it
same-origin; `cropImage.ts`'s `loadImage()` now routes any non-`blob:`
URL through this proxy. The CORS Policy stays configured on the bucket
as a no-op safety net for whenever a custom domain is added later, but
the actual fix bypasses it entirely.

**Verified end-to-end, both locally and on production
(`ana-rnd.vercel.app`):** full project lifecycle (create → add product
→ release from photo → approve with correct creator-role branching →
auto-complete → comment → hard-reload persistence at every step);
notifications arrive at the correct real recipient and are
self-notify-suppressed; cross-page identity correctness (Dashboard
greeting, My Task's mixed real/mock table). On production specifically:
created a real project, uploaded a real image through `/api/upload` to
R2, then exercised the Release/crop flow specifically to confirm the
image-proxy fix also works inside a Vercel serverless function (not
just local dev) — worked identically, image-proxy returned 200, crop
modal rendered correctly, product landed in the correct review status.
All production test data (project, product, ProjectPhoto, and both R2
objects) was cleaned up afterward via a one-off script against the
shared Supabase DB, same discipline as the Products-phase cleanup.

**Not fully live-tested:** the Sales-creator review branch and
reject/resubmit paths were verified via code-level porting (exact
match to the existing state-machine logic, now driven by real
`project.createdBy.role`) and `tsc --noEmit`, not via a full live E2E
test logging in as a second real Sales-role account — Henry's own
account is Admin, and the role-preview switcher only changes the
client-side preview, not the server-authenticated identity used for
`createdById`. Low risk since the logic is a direct port of what
Products/the mock already proved out, but worth a real Sales-account
smoke test whenever one is set up.

**Deliberately not done this pass** (unchanged from the approved
plan): Activity feed (stays static demo data — never had real logic to
begin with), Project file attachments (stays cosmetic filename-only —
never had real upload). Collections, RndTasks, Settings remain fully
mock, next in the established migration order.

## Backend wiring: Collections module goes real (2026-09-17)

Continuing the established order (Products → Projects → **Collections**
→ RndTasks → Settings). Schema needed zero migration this time — the
`Collection`/`CollectionItem`/`CollectionPitch` models (including a
`publicSlug` field on Collection) had already been designed in when the
schema was brought current back on 2026-09-16, before any of it was
wired up.

**A real design decision surfaced before writing any code, and was
confirmed with the user rather than assumed:** Collections' "Lấy link
online" is meant to be a link sent to an outside customer with no
account at all — but every route in the app has required a real
session since the Auth migration, which would have quietly broken that
intent the moment Collections went real. Asked the user directly; they
confirmed the link should be genuinely public. Fixed by adding the
**one deliberate exception** in `src/lib/supabase/middleware.ts`: a new
`/share/` page namespace and its own `/api/collections/public/[slug]`
data route skip the session check entirely, keyed by the real
`publicSlug` (a `crypto.randomUUID()` minted server-side the first time
a pitch is ever logged for a collection) — never the internal
database id, so a shared link can't be used to guess at others.
`RoleProvider` skips its `/api/me` bootstrap fetch for `/share/` pages
the same way it already did for `/login`. While in there, also fixed a
latent middleware bug this surfaced: an unauthenticated request to any
`/api/*` route used to redirect to `/login`'s HTML instead of returning
a JSON 401 — harmless before (every real page load already had a
session by the time its providers fetched), but would have spammed
JSON-parse console errors from every other provider's background fetch
on the new public page. Now `/api/*` returns a clean 401 JSON when
there's no session, any other page still redirects.

**Collections module, full real backend:** same proven pattern as
Products/Projects — full CRUD (`create`/`rename`/`delete`), add/remove
product, and pitch logging, all under `src/app/api/collections/`. The
public route builds its own safe, minimal subset of a product (code/
category/material/size variants/main image only — no designer/status/
exclusivity) rather than reusing the internal product serializer, since
an anonymous customer should never see internal-only fields.
`CollectionsProvider.tsx` rewritten to the same
fetch-on-mount/optimistic-update/reconcile shape as the other real
providers; `createCollection`/`logPitch` dropped their now-redundant
`createdByName`/`loggedByName` parameters (the server derives both from
the session) and `LogPitchModal` gained the same async
submitting-state pattern already used elsewhere (`NewProjectModal`,
etc.) since logging a pitch now needs a round trip before the share
banner can show a real link. Editing (rename/delete/add/remove-item) is
locked to DRAFT + (creator or Admin) — enforced server-side, not just
hidden in the UI, matching `canEditCollection` in `permissions.ts`.
This was also the last file still holding a `CURRENT_USER_NAME` mock
identity outside RndTasks/Settings (`projects/[code]/page.tsx`'s
"Xuất Collection" button, `AddToCollectionButton.tsx`) — both now use
the real `effectiveUserName`.

**Verified end-to-end locally** (`npx tsc --noEmit` and eslint both
clean): created a collection, added/removed a real product, renamed it
(survived a hard reload), logged a pitch and watched it flip to SENT
with a real `publicSlug` returned; confirmed both the client (buttons
hidden) and the server (`403 Forbidden` on a direct API call) refuse to
edit a SENT collection; deleted a DRAFT collection successfully.
Confirmed the "Xuất Collection" (from a completed Project)
`sourceProjectCode` → real `projectId` resolution round-trips
correctly. **Confirmed the public share page works with zero
session** — cleared all cookies in the browser tab used for testing and
reloaded: the page rendered the collection's real contents with no
redirect to `/login` and no console errors, proving the middleware
exception works as intended. (That cookie-clearing briefly signed the
*testing browser's* other tab out too, since a browser's cookies aren't
tab-scoped — not the user's real browser/account, no actual impact,
just needed a re-login on that one shared testing session to finish
the rest of the checks afterward.) All test data (collections,
products, one throwaway project) cleaned up from the local DB after
each check.

**Verified on production too, same day:** created a real product +
collection, logged a pitch, and confirmed the resulting `publicSlug`
share link works with genuinely zero credentials — used
`fetch(url, { credentials: "omit" })` against both
`/api/collections/public/[slug]` and the `/share/collection/[slug]`
page itself (200, no redirect either way) rather than clearing the
browser's shared cookie jar again, learning from the local pass where
doing that signed out the other tab used for the rest of the checks.
Also opened the link in a fresh tab and confirmed it renders correctly
with no TopNav. All production test data cleaned up afterward via the
same one-off Prisma script approach as prior phases.

**Deliberately not done this pass:** Collections' `CollectionItem`
schema has unused `note`/`sortOrder`/`versionId` columns — the UI has
never exposed per-item notes, manual ordering, or pinning to a specific
product version, so the routes don't set them; revisit only if the
user asks for that. RndTasks, Settings remain fully mock, next in the
established migration order.

## Backend wiring: RndTasks module goes real (2026-09-17)

Continuing the established order — Products → Projects → Collections →
**RndTasks** → Settings. Schema needed zero migration again; `RndTask`
was already fully designed in on 2026-09-16.

**Same proven pattern as the prior three modules:** `src/lib/server/
serialize-rnd-task.ts` maps the schema's English `TaskCategory` enum to
its Vietnamese label (`CATEGORY_LABEL`/`CATEGORY_VALUE`, the same shape
as `PRIORITY_LABEL`/`PRIORITY_VALUE`) and directly **reuses**
`PRIORITY_LABEL`/`PRIORITY_VALUE` from `serialize-project.ts` rather
than duplicating them — `TaskPriority` is one schema enum shared by both
`Project.rndPriority` and `RndTask.priority`, and that file's own
comment had already flagged "will be reused as-is once RndTask goes
real." `src/app/api/rnd-tasks/` gained the same CRUD shape as the other
three modules; `RndTasksProvider.tsx` rewritten to the same fetch-on-
mount/optimistic/reconcile shape, keeping every public function name
unchanged so `my-tasks/page.tsx` needed no restructuring, only the
identity switch below. `addTask` dropped its `ownerName` parameter —
"Thêm công việc" only ever adds to *your own* list (no reassignment
feature exists), so the server always uses the session's own id,
never a client-supplied name.

**Two ownership rules enforced server-side, not just hidden in the
UI** (matching the "never trust the client" principle used everywhere
else in this app): the generic `PATCH` route requires Admin or the
task's own owner (mirrors `ProjectsProvider`'s `isOwner`); a task's
`importantNote` additionally requires the caller to actually be Admin
even when they *are* the task's owner, closing a real gap the UI alone
doesn't — the UI never renders an edit control for `importantNote`
unless `isAdmin`, but nothing before this stopped an R&D account from
setting it via a raw API call to their own task, since the plain
owner-or-Admin rule would otherwise have let that through. Also added
a self-notification skip on both `needsSupport` → Admin and
`importantNote` → owner (only fires if the caller isn't the recipient)
— Admin's own ad-hoc tasks would otherwise trigger a pointless
"gửi lưu ý cho chính mình" notification, since Admin can own tasks too.

This was the **last file with any `CURRENT_USER_NAME` mock-identity
usage outside Settings** — `my-tasks/page.tsx` dropped the dual-
variable split entirely (`userName`/`effectiveUserName` had been two
different values only because Project was real and RndTask wasn't;
now both branches use the one real `effectiveUserName`).
`AddRndTaskModal.tsx`'s `onCreate` became `Promise`-returning with the
same busy-state pattern (`"Đang thêm…"`) already used for
`NewProjectModal`/`LogPitchModal`.

**Verified end-to-end locally** (`tsc --noEmit` and eslint clean):
added a real task through the UI (real owner "Henry", real requester
picked from the staff roster) — survived a hard reload; inline-edited
title (persisted), priority (persisted), `needsSupport` (persisted,
confirmed **no** self-notification fired since the caller was also the
recipient Admin), `importantNote` as Admin (persisted, same
no-self-notification check); deleted the task successfully. One
real UI-testing gotcha worth noting for future testing sessions (not a
product bug): `StagedTextCell`'s save fires on blur, not on pressing
Enter inside the field — pressing Enter alone looked like a silent
no-op the first time, but clicking/tabbing away confirmed the save
fires correctly. A transient `ReferenceError: CURRENT_USER_NAME is not
defined` appeared once mid-session in a tab that had lived through many
rapid hot-reloads; a brand-new tab loading the same page produced zero
console errors, confirming it was a stale Turbopack HMR artifact from
editing the file repeatedly in place, not a real regression — `grep`
across the whole `src/` tree turned up no remaining reference to fix.

**Verified on production too, same day:** created a real task via
`/api/rnd-tasks` (real owner "Henry", real requester "Minh"), patched
both `needsSupport` and `importantNote` in one call and confirmed
`GET /api/notifications` came back empty (self-notification correctly
skipped on production too), then deleted it via `DELETE
/api/rnd-tasks/[id]` — no leftover-data cleanup script needed this
time, the API itself round-tripped cleanly. Confirmed the page returns
to its empty state afterward.

**Deliberately not done this pass:** Settings (Category/Material/Size/
Color/AppSettings lookup tables + the "Mẫu PPTX" tab) is now the only
module left fully mock — its own turn next.

## Backend wiring: Settings module goes real — the last one (2026-09-17)

Last module in the established migration order (Products → Projects →
Collections → RndTasks → **Settings**). Turned out to be much smaller
than the prior four: **Category/Material/Size/Color were already real**
— built during the very first Products pass on 2026-09-16
(`useLookupField` in `ProductsProvider.tsx`, backing `/api/categories|
materials|sizes|colors`) and Settings' own tabs for them were already
just reading from `useProducts()`. The only piece still mock was the
**"Mẫu PPTX" tab** (`AppSettings` — cover/closing template images +
closing text for the Collection PPTX/PDF export), which is what this
pass actually wired up. No schema migration needed; `AppSettings` was
already designed in.

`GET/PATCH /api/settings` — a genuine singleton row (`findFirst()`,
created on first `PATCH` if it doesn't exist yet), readable by any
signed-in role (the export page needs it and isn't Admin-only) but
writable by Admin only, matching the page's own gate.
`SettingsProvider.tsx` rewritten to fetch-on-mount + optimistic PATCH,
same shape as the other providers, with the exact same public
interface so `collections/[id]/export/page.tsx` (the only other
consumer) needed zero changes. The cover/closing image pickers now
call the shared `uploadFile()` (real R2 upload, same helper Products/
ProjectPhotos already use) instead of `URL.createObjectURL()`, with a
busy/error state on the picker itself. The closing-text input switched
from firing a PATCH on every keystroke to a staged-locally/save-on-blur
pattern (same reasoning as `my-tasks/page.tsx`'s `StagedTextCell` —
this is a real network write now, not free local state).

**A real, currently-live bug was found and fixed as a direct
consequence of this change, not something newly introduced by it:**
tracing through how the cover/closing template image would render once
it became a real R2 URL led straight to `pdfExport.ts`'s
`coverImageDataUrl()`, which draws a URL onto a `<canvas>` and calls
`canvas.toDataURL()` — the exact "tainted canvas" pattern already
diagnosed and fixed once before, for Ảnh dự án's crop flow, during the
Projects phase (R2's free public URL doesn't send
`Access-Control-Allow-Origin`, so a same-origin-only canvas read throws
`SecurityError`). The call is wrapped in a try/catch that silently
falls back to a flat color box — which means **Collections' PDF export
has likely been silently dropping every real product photo (not just
template images) since Products went real on 2026-09-16**, with zero
visible error to anyone who exported a PDF and just saw a plain-colored
box where a photo should be. Not something anyone had reported —
found by tracing the code path, not from a bug report. Fixed the same
way as before: `pdfExport.ts`'s own `loadImage()` now routes any real
http(s) URL through `/api/image-proxy` first (blob: URLs and the
root-relative `/logo.png` asset still load directly). PPTX export and
the on-page slide-deck preview were never affected — pptxgenjs's own
image loader and a plain `<img>` tag don't touch a canvas at all.

**Verified end-to-end locally** (`tsc --noEmit` and eslint clean):
uploaded a real cover image (a synthetic PNG injected into the file
input, matching the technique used for prior modules' upload tests) —
confirmed the real R2 URL persisted after a hard reload; edited the
closing text and confirmed no `PATCH` fired while still typing, only
on blur; **then actually exercised the fixed PDF export path** — built
a real test Collection with a product, clicked "Xuất PDF", and
confirmed via the network log that `/api/image-proxy` was called for
the real cover image and returned 200, with zero console errors in a
freshly opened tab (ruling out stale-history false positives). All
test data (collection, product, the uploaded R2 image, `AppSettings`
reset to default) cleaned up afterward.

**Verified on production too, same day:** uploaded a real cover image
via `/api/upload`, `PATCH`ed it plus a test closing text into
`/api/settings`, confirmed both round-tripped correctly. Then built a
real test Collection and exported its PDF — confirmed via the network
log that `/api/image-proxy` was called for the real production R2
image and returned 200, with zero console errors, proving the
tainted-canvas fix also holds under Vercel's serverless environment
(not just local dev). All production test data (collection, product,
the uploaded R2 image, `AppSettings` reset to default) cleaned up
afterward — confirmed via `GET /api/settings` that it's back to
`{closingText: "Cảm ơn quý khách"}` with no images set.

**This closes the full backend-wiring effort** — every module
(Staff/User, Auth, Products, Projects, Collections, RndTasks, Settings)
now runs on the real Supabase/Prisma/R2 stack, no module left on mock
in-memory state. Deliberately still cosmetic/deferred, unchanged from
each module's own pass (not newly discovered gaps): the Activity feed
(static demo data), Project file attachments (filename-only, no real
upload), and real password self-service change (`ProfileModal`'s
password fields are still a no-op).

## Retired "Xem thử vai trò" role preview + fixed the avatar-initials bug it was masking (2026-09-17)

The user spotted this right after using the app as their real account
for the first time: the TopNav avatar showed "MI" for Henry, and the
Admin-only "Xem thử vai trò" switcher was still visible even though
every role now has real people logged in as themselves — both were
leftover dev-only tooling that had outlived their purpose now that
backend wiring is fully done.

**Removed the switcher entirely**, not just hidden: `RoleProvider.tsx`
lost `setRole`/`isRealAdmin`/`isPreviewingSelf`/`previewProfiles` (the
whole "Admin can browse as a different role" mechanism) along with the
mock `CURRENT_USER_EMAIL`/`CURRENT_USER_PHONE` fallback data it read
from — `role`/`effectiveUserName`/`profile` now always reflect the real
signed-in account, full stop. `TopNav.tsx` dropped the switcher UI.
`ProfileModal`'s email field was only ever conditionally editable while
previewing a non-real role (a real account's login email was already
always shown read-only) — simplified to just always read-only, dropping
the now-dead `emailEditable` prop and its local `emailInput` state.

**Root-caused the "MI" avatar as a real, separate bug, not just a
symptom of the switcher:** the account avatar (and ~7 other "your own
initials while composing a new comment" bubbles across Library/
Projects/Photo modals/ProjectProductQuickView) all read `ROLE_INITIALS[role]`
— a fixed pair of letters per role from the mock's original 5-persona
design (`ADMIN: "MI"` for the mock's original "Minh" persona), never
updated once real per-person accounts existed. Historical/submitted
comments were never affected — those already resolve real per-person
initials server-side via `feedbackAuthor()` in `src/lib/server/
identity.ts`. Fixed by adding a shared `initialsFromName()` to
`mock-data.ts` and pointing every "my own avatar" spot at
`initialsFromName(effectiveUserName)` instead; `identity.ts` now
imports the same function instead of keeping its own duplicate copy.
Also deleted `feedbackIdentity()` (mock-data.ts) and `ROLE_INITIALS`
itself once nothing referenced them anymore — both were already fully
dead code before this pass, just never cleaned up.

**A second real bug found while writing `initialsFromName`, not
inherited from the old mock code:** the "first letter of first word +
first letter of last word" algorithm (copied as-is from the already-
live server version) doubles the same letter for a one-word name —
"Henry" → "HH", "Minh" → "MM" — and **every single real person at this
company goes by one given name**, confirmed by checking the actual
`User` table (Minh, Hùng, Trang, Quân, Ngọc, Linh, Lan, An, Henry, Hà —
zero multi-word names). Fixed by taking a single-word name's own first
two letters instead ("Henry" → "HE", "Minh" → "MI"). This also
retroactively fixes every future real comment's displayed initials
(nothing stored needs a data fix — initials are computed at
render/serialize time, not persisted).

Verified in the browser: TopNav avatar and the "Cập nhật thông tin"
modal both now show "HE" for Henry, switcher is gone from TopNav
entirely, `tsc --noEmit` and eslint clean. Not yet re-verified on
production — this is a small, low-risk UI-only change; push and a
quick visual check is enough, doesn't need the full smoke-test
discipline the backend migrations got.

## First mobile-responsive pass: TopNav, Dashboard, Projects, My Task (2026-09-17)

User asked whether adding phone support now would risk anything. It
doesn't break desktop when done incrementally with Tailwind's
responsive prefixes, but the app was built desktop-first (several
tables use fixed-pixel-width columns with no small-screen fallback at
all), so a full pass across every page is real, non-trivial work — not
a quick global toggle. Agreed to start with the highest-traffic pages
first rather than the whole app at once: **TopNav** (shared by every
page, so it was the actual blocker — the nav links row already
overflowed on a phone before this), **Dashboard**, **Projects list**,
**My Task**.

**TopNav** — added a hamburger menu (`md:hidden`, standard 768px
breakpoint) that opens a stacked full-width version of the exact same
nav links (`canView*` role gates included, extracted into one shared
`navLinks(fullWidth)` closure so desktop/mobile can never drift out of
sync with each other). Closes on outside click (same ref-based pattern
already used for the bell/account dropdowns) and on every route change
(otherwise it stays visibly open under the new page while it loads).
Also capped the bell/account dropdown panels' width to
`max-w-[calc(100vw-2rem)]` — their fixed `w-80`/`w-64` could overflow a
narrow phone screen when anchored `right-0` near the edge.

**Dashboard** — stat-card and recent-products grids now step down
(`grid-cols-2` on phones, the original 4/3-column layout from `lg:`/
`sm:` up) instead of stopping at a fixed column count; page padding
drops from `p-7` to `p-4` below `sm:`.

**Projects list** — the toolbar (My/All tabs, search, "+ New Project",
status chips) already used `flex-wrap` in places but not consistently;
made every row wrap and the search input full-width below `sm:`. The
table itself was the real gap: unlike My Task's table, it had **no**
horizontal-scroll fallback at all — its columns were sized with
`minmax(0, Nfr)` specifically so header and data rows couldn't drift
out of alignment (a fr track's width depends on that row's own
content), which meant on a narrow screen it would have squeezed all 10
columns down toward unreadable instead of overflowing. Converted every
column to a fixed pixel width (except the leading Project column, kept
flexible via `minmax(220px, 2fr)` — safe now since it's the only
non-fixed track, so the drift the original comment warned about can't
happen) and wrapped the table in `overflow-x-auto` with `min-w-fit`
rows, the same pattern My Task's table already used successfully.

**My Task** — already had `overflow-x-auto` on its table and
`flex-wrap` on its filter toolbar; just needed the tab-row/header and
the "Tổng quan phòng" summary header to wrap too, plus the same `p-7`
→ `p-4` mobile padding step-down as the other three pages.

**Verified at a 375×812 viewport** (`resize_window` preset "mobile")
for all four pages: hamburger menu opens/closes and its links navigate
correctly; Dashboard's cards and activity feed are readable at 2
columns; Projects' table scrolls horizontally with a real test project
row rendering correctly across the scroll (name/code, type badge,
deadline, product count, and the edit/delete icons all confirmed by
scrolling); My Task's toolbar and table both degrade cleanly. Also
re-checked all four at desktop size afterward to confirm nothing
regressed there — visually identical to before. `tsc --noEmit` and
eslint clean. Console errors seen in one long-lived test tab turned
out to be stale history from a mid-edit transient state (confirmed via
a fresh tab showing zero errors on the same pages) — not a real
regression, same false-alarm pattern noted in earlier phases of this
log.

**Deliberately not done this pass:** every other page (Library,
Collections, Settings, Review, product/project detail pages) is
untouched — still desktop-only. Revisit only if the user asks, and
likely worth asking first which of those actually get used from a
phone before investing in them, same as the framing this pass started
from.

## Workflow

- After finishing a meaningful chunk of work: update this file's "Feature
  status" / "Next candidates" sections, then commit with a **detailed**
  commit message (what changed and why, not just a title) so the log itself
  is useful context on the other machine.
- Before starting work on either machine: `git pull`, read this file, skim
  recent `git log`.
- Push when done on a machine so the other one can pick up cleanly.
