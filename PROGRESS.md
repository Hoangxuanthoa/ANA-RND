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
  reject-with-reason flow. Customer can now request a new project (their
  own type only, no Khách hàng/R&D pickers — see NewProjectModal); the
  chosen Sales rep becomes its real owner (`createdByName`) from creation,
  not the customer. EditProjectModal can now also assign/reassign a
  project's `rndOwner` after creation (didn't exist before at all).
- **Collections** (`/collections`, `/collections/[id]`) — build a shareable
  set of designs, pitch log (who was pitched what, when). Export is now
  real, not simulated: "Xuất Collection" (renamed from "Xuất PDF" once it
  led to a page offering both PPTX and PDF — the old name stopped making
  sense) goes to `/collections/[id]/export`, where you pick which
  products to include (checkboxes, all on by default), a customer, an
  optional note, and a "Số sản phẩm/trang" mode, then either "Xuất PPTX"
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
- **My Task** (`/my-tasks`) — R&D personal queue, quick-view with
  approve/request-change actions.
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

## Next candidates (discussed with user, going one at a time)

1. ~~Product Versions were fake (one global list shared by every product)~~
   — **done**, see Library above.
2. ~~Notification system only covered product rejection~~ — **done**, see
   Notifications above.
3. ~~Audit the CUSTOMER role's experience end-to-end~~ — **done**. Biggest
   gap found: Customer couldn't originate a project at all. Fixed by adding
   a request-intake flow (see Projects above) rather than just reviewing
   the prior read-only experience.
4. Eventually: wire the real backend (Prisma/Supabase/auth) and migrate the
   Context providers to call real API routes instead of holding state in
   memory. Big, separate-scope effort — do not start opportunistically.
   **Next candidate**, but confirm with the user first — nothing else from
   this list is currently blocking it.
5. Possible future feature (not yet requested, just noted while working on
   the above): there's still no way to assign/reassign an R&D person to a
   specific *product* inside a project (`ProjectProductItem.assigneeName`)
   — only the project-level `rndOwner` can be assigned now. If a real
   per-product "assign to teammate" flow gets built later, pair it with a
   notification the same way `PROJECT_ASSIGNED` was just added.
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

## Workflow

- After finishing a meaningful chunk of work: update this file's "Feature
  status" / "Next candidates" sections, then commit with a **detailed**
  commit message (what changed and why, not just a title) so the log itself
  is useful context on the other machine.
- Before starting work on either machine: `git pull`, read this file, skim
  recent `git log`.
- Push when done on a machine so the other one can pick up cleanly.
