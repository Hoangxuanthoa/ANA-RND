"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildSteelFrame } from "@/lib/breakdown/geometry/frameEngine";
import { computeHandlePaths } from "@/lib/breakdown/geometry/handlePaths";
import { buildDiameterSpline, smoothDiameters } from "@/lib/breakdown/geometry/photoSpline";
import { buildProfileSamples, buildRoundSolid, circlePoints, normalizeRings, type Sample, type SolidLike } from "@/lib/breakdown/geometry/profileEngine";
import { buildRectSolid, buildRoundedRectPoints2D, DEFAULT_RECT_SEGMENTS_PER_CORNER, interpolateRectCorner } from "@/lib/breakdown/geometry/rectProfileEngine";
import { buildRectSteelFrame } from "@/lib/breakdown/geometry/rectFrameEngine";
import { computeRectHandlePaths } from "@/lib/breakdown/geometry/rectHandlePaths";
import { buildOvalProfileSamples, buildOvalSolid, normalizeOvalRings, ovalDimsAtZ, type OvalSample } from "@/lib/breakdown/geometry/ovalProfileEngine";
import { buildOvalSteelFrame } from "@/lib/breakdown/geometry/ovalFrameEngine";
import { computeOvalHandlePaths } from "@/lib/breakdown/geometry/ovalHandlePaths";
import {
  buildEllipseProfileSamples,
  buildEllipseSolid,
  DEFAULT_ELLIPSE_SEGMENTS,
  ellipseDimsAtZ,
  ellipsePoints2D,
  normalizeEllipseRings,
  type EllipseSample,
} from "@/lib/breakdown/geometry/ellipseProfileEngine";
import { buildEllipseSteelFrame } from "@/lib/breakdown/geometry/ellipseFrameEngine";
import { computeEllipseHandlePaths } from "@/lib/breakdown/geometry/ellipseHandlePaths";
import { ringLabel, type ShapeDrawingInput, type ShapeDrawingRow } from "@/lib/breakdown/geometry/drawingEngine";
import { buildAreaBom, buildEllipseAreaBom, buildOvalAreaBom, buildRectAreaBom, buildSteelBom, type BomAreaRow, type BomSteelRow } from "@/lib/breakdown/geometry/bomEngine";
import {
  createDefaultMaterial,
  DEFAULT_ELLIPSE_FRAME,
  DEFAULT_ELLIPSE_PROFILE,
  DEFAULT_FRAME,
  DEFAULT_HANDLE,
  DEFAULT_OVAL_FRAME,
  DEFAULT_OVAL_PROFILE,
  DEFAULT_PHOTO_TRACE,
  DEFAULT_RECT_FRAME,
  DEFAULT_RECT_PROFILE,
  DEFAULT_SCALLOP,
  type EllipseCorner,
  type EllipseProfileInput,
  type OvalCorner,
  type OvalProfileInput,
  type ProductState,
  type RingInput,
} from "@/lib/breakdown/geometry/types";
import type { Bounds3D } from "@/components/breakdown/three/Viewport3D";
import { ActionBar } from "@/components/breakdown/studio/ActionBar";
import { DrawShapeForm } from "@/components/breakdown/studio/DrawShapeForm";
import { EllipseFrameForm } from "@/components/breakdown/studio/EllipseFrameForm";
import { EllipseProfileForm } from "@/components/breakdown/studio/EllipseProfileForm";
import { ViewPlaceholder } from "@/components/breakdown/studio/FrameViewPlaceholder";
import { InputModeToggle, type InputMode } from "@/components/breakdown/studio/InputModeToggle";
import { MaterialForm } from "@/components/breakdown/studio/MaterialForm";
import { OvalFrameForm } from "@/components/breakdown/studio/OvalFrameForm";
import { OvalProfileForm } from "@/components/breakdown/studio/OvalProfileForm";
import { PhotoTraceForm } from "@/components/breakdown/studio/PhotoTraceForm";
import { ProductList } from "@/components/breakdown/studio/ProductList";
import { RectFrameForm } from "@/components/breakdown/studio/RectFrameForm";
import { RectProfileForm } from "@/components/breakdown/studio/RectProfileForm";
import { RoundProfileForm } from "@/components/breakdown/studio/RoundProfileForm";
import { ShapeTabs } from "@/components/breakdown/studio/ShapeTabs";
import { SteelFrameForm } from "@/components/breakdown/studio/SteelFrameForm";
import { DrawingSheetA4 } from "@/components/breakdown/studio/DrawingSheetA4";
import { MultiDrawingExport } from "@/components/breakdown/studio/MultiDrawingExport";
import { BomSheet } from "@/components/breakdown/studio/BomSheet";
import { TopNav } from "@/components/TopNav";
import { useRole } from "@/components/RoleProvider";
import { canViewBreakdown } from "@/lib/permissions";

const ProductScene = dynamic(() => import("@/components/breakdown/three/ProductScene"), { ssr: false });
const FrameScene = dynamic(() => import("@/components/breakdown/three/FrameScene"), { ssr: false });

const DEFAULT_RINGS: RingInput[] = [
  { z: 300, diameter: 220, transition: "straight" },
  { z: 150, diameter: 260, transition: "outward", curveDepth: 0.35 },
  { z: 0, diameter: 160, transition: "straight", cap: true },
];

// Oval's profile used to be `{ mouth, base, horizontalRings }` (a fixed
// 2-corner taper — "vòng ngang" was just a Z marker, no shape of its own)
// before it became a flat `{ rings }` list like Round's own, so a bulge/
// waist ring can exist. A product saved under the old shape has no `rings`
// array at all — converts it losslessly into the new shape (every
// horizontalRing becomes a real ring, its length/width computed via the
// exact SAME linear interpolation the old engine used, and every ring's
// transition defaults to "straight" — so the migrated body renders
// IDENTICALLY to before, just now expressed as editable rings instead of a
// fixed taper).
function migrateOvalProfile(op: OvalProfileInput | { mouth: OvalCorner; base: OvalCorner; horizontalRings: { z: number }[] } | undefined): OvalProfileInput {
  if (op && "rings" in op && Array.isArray(op.rings)) {
    return { rings: op.rings.map((r) => ({ ...r })) };
  }
  if (op && "mouth" in op && "base" in op) {
    const { mouth, base, horizontalRings } = op;
    const span = mouth.z - base.z;
    const middle = (horizontalRings ?? []).map((r) => {
      const t = Math.abs(span) < 0.001 ? 0 : Math.max(0, Math.min(1, (mouth.z - r.z) / span));
      return {
        z: r.z,
        length: mouth.length + (base.length - mouth.length) * t,
        width: mouth.width + (base.width - mouth.width) * t,
        transition: "straight",
      };
    });
    return {
      rings: [{ z: mouth.z, length: mouth.length, width: mouth.width }, ...middle, { z: base.z, length: base.length, width: base.width, cap: base.cap }],
    };
  }
  return { rings: DEFAULT_OVAL_PROFILE.rings.map((r) => ({ ...r })) };
}

// Same lossless conversion as migrateOvalProfile above, for Ellipse's own
// old `{ mouth, base, horizontalRings }` shape.
function migrateEllipseProfile(
  ep: EllipseProfileInput | { mouth: EllipseCorner; base: EllipseCorner; horizontalRings: { z: number }[] } | undefined,
): EllipseProfileInput {
  if (ep && "rings" in ep && Array.isArray(ep.rings)) {
    return { rings: ep.rings.map((r) => ({ ...r })) };
  }
  if (ep && "mouth" in ep && "base" in ep) {
    const { mouth, base, horizontalRings } = ep;
    const span = mouth.z - base.z;
    const middle = (horizontalRings ?? []).map((r) => {
      const t = Math.abs(span) < 0.001 ? 0 : Math.max(0, Math.min(1, (mouth.z - r.z) / span));
      return {
        z: r.z,
        length: mouth.length + (base.length - mouth.length) * t,
        width: mouth.width + (base.width - mouth.width) * t,
        transition: "straight",
      };
    });
    return {
      rings: [{ z: mouth.z, length: mouth.length, width: mouth.width }, ...middle, { z: base.z, length: base.length, width: base.width, cap: base.cap }],
    };
  }
  return { rings: DEFAULT_ELLIPSE_PROFILE.rings.map((r) => ({ ...r })) };
}

// The persisted shape isn't versioned — a product saved by an OLDER build
// (e.g. `material` before it grew splits/bands/ringTube) would otherwise
// crash the geometry code the moment it tries to read a field that didn't
// exist yet. Rather than build a full migration/version system for what's
// still a single evolving field, just re-default anything that doesn't
// look like the current shape — same spirit as photoTrace/scallop already
// getting a fresh default on every new product, just applied on restore.
function migrateProduct(p: ProductState): ProductState {
  const material = p.material && Array.isArray(p.material.splits) && Array.isArray(p.material.bands) ? p.material : createDefaultMaterial();
  // `note` (free-text) was renamed to `code` (mã sản phẩm) — carry over
  // whatever an older save already has under the old key so it isn't lost.
  const code = p.code ?? (p as unknown as { note?: string }).note ?? "";
  // ovalProfile/ovalFrame are NEW fields — any product saved before Oval
  // existed won't have them at all. ovalFrame has ALSO grown fields twice
  // already (straightRibCount/capRibCount → bodyRibsPerHalf, then again
  // adding bodyRibMode/bodyRibsPerQuarter) — a save from an in-between
  // build would still have an ovalFrame object, just missing whatever
  // field(s) got added after it was saved. Rather than keep adding one
  // more `typeof` check per field every time this grows again, merge onto
  // the current defaults — any missing field (old OR future) falls back
  // safely while anything the user DID customize is preserved.
  // rectFrame gained bodyRibMode/bodyRibsPerHalf/bodyRibsPerQuarter — same
  // merge-onto-defaults as ovalFrame below so older saves pick them up.
  const rectFrame = { ...DEFAULT_RECT_FRAME, ...(p.rectFrame ?? {}) };
  const ovalProfile = migrateOvalProfile(p.ovalProfile);
  const ovalFrame = { ...DEFAULT_OVAL_FRAME, ...(p.ovalFrame ?? {}) };
  const ovalPhotoCurve = p.ovalPhotoCurve ?? null;
  const ovalPreLockRings = p.ovalPreLockRings ?? null;
  const ellipseProfile = migrateEllipseProfile(p.ellipseProfile);
  const ellipseFrame = { ...DEFAULT_ELLIPSE_FRAME, ...(p.ellipseFrame ?? {}) };
  const ellipsePhotoCurve = p.ellipsePhotoCurve ?? null;
  const ellipsePreLockRings = p.ellipsePreLockRings ?? null;
  return {
    ...p,
    material,
    code,
    rectFrame,
    ovalProfile,
    ovalFrame,
    ovalPhotoCurve,
    ovalPreLockRings,
    ellipseProfile,
    ellipseFrame,
    ellipsePhotoCurve,
    ellipsePreLockRings,
  };
}

// Each BreakdownProduct row in Postgres (see prisma/schema.prisma) stores
// one product's ENTIRE ProductState as its own `data` JSON blob. That row's
// own uuid `id` is a DIFFERENT identifier than ProductState's own embedded
// `id` ("P001"-style, the one every ported geometry/UI component already
// keys off — ProductList, updateActive, etc.) — dbIdByCodeRef (declared
// inside the component below) bridges the two so none of that ported code
// needs to learn about database ids at all.
interface ApiProduct {
  id: string;
  code: string;
  name: string;
  data: ProductState;
}

// `seq` comes from the CALLER's own productSeqRef (scoped per-breakdown via
// the component instance, re-derived from existing products' own ids on
// load — see the hydration effect) rather than a module-level counter — a
// module-level counter would keep climbing across every breakdown ever
// opened in the same browser session, so a brand-new breakdown's first
// product could end up "P014" instead of "P001" just because other
// breakdowns had already used up lower numbers this session.
function createProduct(seq: number): ProductState {
  const id = `P${String(seq).padStart(3, "0")}`;
  return {
    id,
    name: `Sản phẩm ${id}`,
    code: "",
    shape: "round",
    rings: DEFAULT_RINGS.map((r) => ({ ...r })),
    rectProfile: {
      mouth: { ...DEFAULT_RECT_PROFILE.mouth },
      base: { ...DEFAULT_RECT_PROFILE.base },
      horizontalRings: DEFAULT_RECT_PROFILE.horizontalRings.map((r) => ({ ...r })),
    },
    ovalProfile: { rings: DEFAULT_OVAL_PROFILE.rings.map((r) => ({ ...r })) },
    ovalPhotoCurve: null,
    ovalPreLockRings: null,
    ellipseProfile: { rings: DEFAULT_ELLIPSE_PROFILE.rings.map((r) => ({ ...r })) },
    ellipsePhotoCurve: null,
    ellipsePreLockRings: null,
    lid: { mode: "none" },
    handle: { ...DEFAULT_HANDLE },
    frame: { ...DEFAULT_FRAME },
    rectFrame: { ...DEFAULT_RECT_FRAME },
    ovalFrame: { ...DEFAULT_OVAL_FRAME },
    ellipseFrame: { ...DEFAULT_ELLIPSE_FRAME },
    scallop: { ...DEFAULT_SCALLOP },
    photoTrace: { ...DEFAULT_PHOTO_TRACE, points: [] },
    material: createDefaultMaterial(),
    photoCurve: null,
    photoCurveSource: "trace",
    preLockRings: null,
  };
}

export default function BreakdownDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { role } = useRole();

  if (!canViewBreakdown(role)) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <TopNav />
        <div className="flex flex-1 flex-col items-center justify-center gap-3.5 p-20">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-bg text-text-faint">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 018 0v3" />
            </svg>
          </div>
          <h2 className="text-[17px] font-extrabold">Không có quyền truy cập</h2>
          <p className="max-w-[360px] text-center text-sm text-text-muted">&quot;Bóc tách kỹ thuật&quot; dành cho Admin, R&amp;D và Mua hàng.</p>
        </div>
      </div>
    );
  }
  return <BreakdownStudio key={id} id={id} />;
}

// A fresh `key={id}` on this from the route wrapper above makes React fully
// unmount/remount it on every breakdown switch — simpler and safer than
// manually resetting every piece of per-breakdown state (hydrated, products,
// productSeqRef, dbIdByCodeRef, …) by hand inside an effect keyed on `id`,
// and it's what lets every piece of state below start clean with its own
// normal initial value, same as this component did when it was still
// anasu-web's own per-project studio page.
function BreakdownStudio({ id }: { id: string }) {
  const productSeqRef = useRef(1);
  // Maps a product's own embedded ProductState.id ("P001", what every
  // ported form/list component already keys off) to that row's real
  // database uuid (what the /api/breakdowns/.../products/:productId
  // endpoints address) — populated from the initial GET, and whenever a
  // product is created.
  const dbIdByCodeRef = useRef<Record<string, string>>({});
  // Guards the "brand-new breakdown, create a default product" POST below
  // against firing twice — React Strict Mode double-invokes this effect in
  // dev (mount → cleanup → remount), and a plain `cancelled` flag doesn't
  // help here since each invocation starts fresh, unaware of the other.
  // A ref survives across that synthetic pair within the same real mount.
  const bootstrappedRef = useRef(false);
  // Serializes the ▲/▼ reorder PUTs (see moveProduct).
  const reorderChainRef = useRef<Promise<void>>(Promise.resolve());

  const [products, setProducts] = useState<ProductState[]>(() => [createProduct(1)]);
  const [activeId, setActiveId] = useState<string>(() => products[0].id);
  const [inputMode, setInputMode] = useState<InputMode>("params");
  const [breakdownName, setBreakdownName] = useState("");
  // A breakdown shared WITH me (not mine, and I'm not Admin) opens read-only:
  // the server already rejects every write (lib/server/breakdown-access.ts),
  // this flag just keeps the UI from offering edits that would be refused —
  // and from autosaving, which would otherwise fire PATCHes that 403.
  const [canEdit, setCanEdit] = useState(false);
  const readOnly = !canEdit;

  // Server-backed equivalent of ANASU's original IndexedDB hydration —
  // `hydrated` gates the render AND the autosave effect the exact same way
  // it always did (see the original comment this replaced), just restoring
  // from `GET /api/breakdowns/:id/products` instead of IndexedDB.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/breakdowns/${id}/products`)
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: { breakdown: { name: string; activeProductId: string | null; canEdit: boolean }; products: ApiProduct[] } | null) => {
        if (cancelled || !payload) return;
        setBreakdownName(payload.breakdown.name);
        setCanEdit(payload.breakdown.canEdit);
        if (payload.products.length > 0) {
          const nextProducts = payload.products.map((p) => migrateProduct(p.data));
          dbIdByCodeRef.current = Object.fromEntries(payload.products.map((p) => [p.data.id, p.id]));
          const maxSeq = Math.max(0, ...nextProducts.map((p) => Number(p.id.replace(/^P/, "")) || 0));
          productSeqRef.current = maxSeq + 1;
          const restored = payload.breakdown.activeProductId && payload.products.find((p) => p.id === payload.breakdown.activeProductId);
          setProducts(nextProducts);
          setActiveId(restored ? restored.data.id : nextProducts[0].id);
          setHydrated(true);
          return;
        }
        // A read-only viewer must never bootstrap (it would POST and 403).
        if (!payload.breakdown.canEdit) {
          setHydrated(true);
          return;
        }
        // Brand-new breakdown, no products yet — same default-product
        // bootstrap ANASU always did, just persisted to the server right
        // away so a reload before any edit doesn't lose it.
        if (bootstrappedRef.current) return;
        bootstrappedRef.current = true;
        productSeqRef.current = 1;
        const fresh = createProduct(productSeqRef.current++);
        setProducts([fresh]);
        setActiveId(fresh.id);
        fetch(`/api/breakdowns/${id}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: fresh.id, name: fresh.name, data: fresh }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((created: ApiProduct | null) => {
            if (!cancelled && created) dbIdByCodeRef.current[fresh.id] = created.id;
          });
        setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Debounced autosave — PATCHes every product's current name/data (a
  // breakdown typically holds a handful of products, so this is cheap) plus
  // which one is active, same 400ms cadence the original IndexedDB save
  // used. A product not yet in dbIdByCodeRef (just created, POST still in
  // flight) is skipped — addProduct's own POST already carries its initial
  // data, so skipping here never loses anything, just avoids a duplicate
  // write racing the POST.
  useEffect(() => {
    if (!hydrated || readOnly) return;
    const timer = setTimeout(() => {
      for (const p of products) {
        const dbId = dbIdByCodeRef.current[p.id];
        if (!dbId) continue;
        fetch(`/api/breakdowns/${id}/products/${dbId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: p.name, data: p }),
        });
      }
      fetch(`/api/breakdowns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeProductId: dbIdByCodeRef.current[activeId] ?? null }),
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [products, activeId, hydrated, readOnly, id]);
  const [showDrawing, setShowDrawing] = useState(false);
  const [showBom, setShowBom] = useState(false);
  const [showMultiExport, setShowMultiExport] = useState(false);

  const active = products.find((p) => p.id === activeId) ?? products[0];

  function updateActive(patch: Partial<ProductState>) {
    if (readOnly) return;
    setProducts((prev) => prev.map((p) => (p.id === active.id ? { ...p, ...patch } : p)));
  }

  // "Khóa dáng": captures the CURRENT ring-driven curve (the engine's own
  // analytic Hermite/bow curve, via buildProfileSamples — exactly what's on
  // screen right now) into photoCurve, the same field/pipeline "Đính kèm
  // ảnh"/"Vẽ tay" already use to decouple the body shape from ring choice.
  // From this point on, rings are free to add/remove/reposition without
  // touching the shape — the whole reason this exists: a bulge/waist needs a
  // ring to exist as a curve ANCHOR, but that doesn't mean the user wants it
  // to exist as real welded structure.
  function lockRoundShape() {
    const sections = normalizeRings(active.rings);
    const samples = buildProfileSamples(sections);
    const photoCurve = samples.map(([r, z]) => ({ z, diameter: r * 2 }));
    updateActive({ photoCurve, photoCurveSource: "manual", preLockRings: active.rings });
  }

  // "Quay về gốc": restores the ring list exactly as it was the moment
  // "Khóa dáng" was pressed, discarding whatever was added/removed/moved
  // while locked. "Giữ hiện tại" (revertToOriginal=false) keeps those
  // edits — the CURRENT rings simply become the new manual baseline.
  function unlockRoundShape(revertToOriginal: boolean) {
    updateActive({
      photoCurve: null,
      photoCurveSource: "trace",
      preLockRings: null,
      ...(revertToOriginal && active.preLockRings ? { rings: active.preLockRings } : {}),
    });
  }

  // Resample the SMOOTH spline at fine, even steps rather than lathing the
  // raw traced points directly — those come from independent per-row edge
  // detection (see photoEdgeDetect.ts), so consecutive rows can have a few
  // px of jitter; both buildBodyGeometry and the steel frame's tube paths
  // connect rows/points with flat segments (no in-between smoothing), so raw
  // jitter would show up as visible faceting. smoothDiameters denoises the
  // points FIRST — buildDiameterSpline interpolates EXACTLY through whatever
  // it's given, so without this the spline still wobbles through the same
  // noise with continuous derivatives instead of hard corners: smoother, but
  // not actually smooth. The traced SHAPE doesn't change (the smoothing
  // window is much narrower than any real bulge/waist), just the noise on
  // top of it. Shared by the Solid AND the steel frame's own rib/tube paths
  // — a bent rod genuinely can follow this exact curve (that's what a real
  // fixture/template bend would do), it isn't limited to profileEngine's
  // ring-to-ring bow the way a hand-specified (no photo reference) shape is;
  // only the "vòng ngang" ring positions themselves stay exactly where the
  // user chose them, driving what actually gets welded as a structural ring.
  const denseSamples: Sample[] | undefined = useMemo(() => {
    if (!active.photoCurve || active.photoCurve.length < 2) return undefined;
    // A "Khóa dáng" curve is already the engine's own analytic Hermite/bow
    // curve — smoothDiameters is a denoiser for real per-row trace jitter,
    // and running it over an already-smooth, deliberately-shaped curve would
    // just erode the curveDepth the user dialed in, not remove any noise.
    const source = active.photoCurveSource === "manual" ? active.photoCurve : smoothDiameters(active.photoCurve);
    const spline = buildDiameterSpline(source);
    const heightMm = Math.max(...active.photoCurve.map((p) => p.z));
    const steps = Math.max(2, Math.round(heightMm / 4));
    return Array.from({ length: steps + 1 }, (_, i): Sample => {
      const z = heightMm * (1 - i / steps);
      return [spline(z) / 2, z];
    });
  }, [active.photoCurve, active.photoCurveSource]);

  // Oval's own "Khóa dáng" — same idea as lockRoundShape above, just
  // capturing BOTH length and width per Z (buildOvalProfileSamples' own
  // dense curve) since an oval cross-section needs 2 dimensions, not 1.
  function lockOvalShape() {
    const samples = buildOvalProfileSamples(active.ovalProfile.rings);
    const ovalPhotoCurve = samples.map(([length, width, z]) => ({ z, length, width }));
    updateActive({ ovalPhotoCurve, ovalPreLockRings: active.ovalProfile.rings });
  }

  function unlockOvalShape(revertToOriginal: boolean) {
    updateActive({
      ovalPhotoCurve: null,
      ovalPreLockRings: null,
      ...(revertToOriginal && active.ovalPreLockRings ? { ovalProfile: { rings: active.ovalPreLockRings } } : {}),
    });
  }

  // Same resample-at-fine-even-steps idea as Round's own denseSamples above
  // — Oval never has a "traced" source (no photo/hand-draw input mode for
  // it), so there's no smoothDiameters denoising step: a locked oval curve
  // is always the engine's own already-smooth analytic bow.
  const ovalDenseSamples: OvalSample[] | undefined = useMemo(() => {
    if (!active.ovalPhotoCurve || active.ovalPhotoCurve.length < 2) return undefined;
    const lengthSpline = buildDiameterSpline(active.ovalPhotoCurve.map((p) => ({ z: p.z, diameter: p.length })));
    const widthSpline = buildDiameterSpline(active.ovalPhotoCurve.map((p) => ({ z: p.z, diameter: p.width })));
    const zs = active.ovalPhotoCurve.map((p) => p.z);
    const maxZ = Math.max(...zs);
    const minZ = Math.min(...zs);
    const steps = Math.max(2, Math.round((maxZ - minZ) / 4));
    return Array.from({ length: steps + 1 }, (_, i): OvalSample => {
      const z = maxZ - ((maxZ - minZ) * i) / steps;
      return [lengthSpline(z), widthSpline(z), z];
    });
  }, [active.ovalPhotoCurve]);

  // Ellipse's own "Khóa dáng" — same idea as lockOvalShape above.
  function lockEllipseShape() {
    const samples = buildEllipseProfileSamples(active.ellipseProfile.rings);
    const ellipsePhotoCurve = samples.map(([length, width, z]) => ({ z, length, width }));
    updateActive({ ellipsePhotoCurve, ellipsePreLockRings: active.ellipseProfile.rings });
  }

  function unlockEllipseShape(revertToOriginal: boolean) {
    updateActive({
      ellipsePhotoCurve: null,
      ellipsePreLockRings: null,
      ...(revertToOriginal && active.ellipsePreLockRings ? { ellipseProfile: { rings: active.ellipsePreLockRings } } : {}),
    });
  }

  const ellipseDenseSamples: EllipseSample[] | undefined = useMemo(() => {
    if (!active.ellipsePhotoCurve || active.ellipsePhotoCurve.length < 2) return undefined;
    const lengthSpline = buildDiameterSpline(active.ellipsePhotoCurve.map((p) => ({ z: p.z, diameter: p.length })));
    const widthSpline = buildDiameterSpline(active.ellipsePhotoCurve.map((p) => ({ z: p.z, diameter: p.width })));
    const zs = active.ellipsePhotoCurve.map((p) => p.z);
    const maxZ = Math.max(...zs);
    const minZ = Math.min(...zs);
    const steps = Math.max(2, Math.round((maxZ - minZ) / 4));
    return Array.from({ length: steps + 1 }, (_, i): EllipseSample => {
      const z = maxZ - ((maxZ - minZ) * i) / steps;
      return [lengthSpline(z), widthSpline(z), z];
    });
  }, [active.ellipsePhotoCurve]);

  const { result, error } = useMemo(() => {
    if (active.shape !== "round") return { result: null, error: null as string | null };
    try {
      return { result: buildRoundSolid(active.rings, active.lid, active.handle, active.scallop, denseSamples), error: null as string | null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [active.shape, active.rings, active.lid, active.handle, active.scallop, denseSamples]);

  const isRect = active.shape === "square" || active.shape === "rectangle";
  const { rectResult, rectError } = useMemo(() => {
    if (!isRect) return { rectResult: null, rectError: null as string | null };
    try {
      return { rectResult: buildRectSolid(active.rectProfile, active.lid, active.handle), rectError: null as string | null };
    } catch (e) {
      return { rectResult: null, rectError: e instanceof Error ? e.message : String(e) };
    }
  }, [isRect, active.rectProfile, active.lid, active.handle]);

  const isOval = active.shape === "oval";
  const { ovalResult, ovalError } = useMemo(() => {
    if (!isOval) return { ovalResult: null, ovalError: null as string | null };
    try {
      return {
        ovalResult: buildOvalSolid(active.ovalProfile, active.lid, active.handle, DEFAULT_RECT_SEGMENTS_PER_CORNER, ovalDenseSamples),
        ovalError: null as string | null,
      };
    } catch (e) {
      return { ovalResult: null, ovalError: e instanceof Error ? e.message : String(e) };
    }
  }, [isOval, active.ovalProfile, active.lid, active.handle, ovalDenseSamples]);

  const isEllipse = active.shape === "ellipse";
  const { ellipseResult, ellipseError } = useMemo(() => {
    if (!isEllipse) return { ellipseResult: null, ellipseError: null as string | null };
    try {
      return {
        ellipseResult: buildEllipseSolid(active.ellipseProfile, active.lid, active.handle, DEFAULT_ELLIPSE_SEGMENTS, ellipseDenseSamples),
        ellipseError: null as string | null,
      };
    } catch (e) {
      return { ellipseResult: null, ellipseError: e instanceof Error ? e.message : String(e) };
    }
  }, [isEllipse, active.ellipseProfile, active.lid, active.handle, ellipseDenseSamples]);

  const solidResult: SolidLike | null = active.shape === "round" ? result : isRect ? rectResult : isOval ? ovalResult : isEllipse ? ellipseResult : null;
  // Material-band splitting/ring-tubes only work for Round today (Rect/Oval/
  // Ellipse's own solid geometry has no UV yet — see profileEngine.ts's
  // cylindricalUV comment), so they just get `undefined` and ProductScene
  // falls back to treating the whole body as one band.
  const solidSamples = active.shape === "round" ? result?.samples : undefined;

  const { frameResult, frameError } = useMemo(() => {
    if (active.shape !== "round") return { frameResult: null, frameError: null as string | null };
    try {
      return {
        frameResult: buildSteelFrame(active.rings, active.lid, active.handle, active.frame, active.scallop, denseSamples),
        frameError: null as string | null,
      };
    } catch (e) {
      return { frameResult: null, frameError: e instanceof Error ? e.message : String(e) };
    }
  }, [active.shape, active.rings, active.lid, active.handle, active.frame, active.scallop, denseSamples]);

  const { rectFrameResult, rectFrameError } = useMemo(() => {
    if (!isRect) return { rectFrameResult: null, rectFrameError: null as string | null };
    try {
      return {
        rectFrameResult: buildRectSteelFrame(active.rectProfile, active.lid, active.handle, active.frame, active.rectFrame),
        rectFrameError: null as string | null,
      };
    } catch (e) {
      return { rectFrameResult: null, rectFrameError: e instanceof Error ? e.message : String(e) };
    }
  }, [isRect, active.rectProfile, active.lid, active.handle, active.frame, active.rectFrame]);

  const { ovalFrameResult, ovalFrameError } = useMemo(() => {
    if (!isOval) return { ovalFrameResult: null, ovalFrameError: null as string | null };
    try {
      return {
        ovalFrameResult: buildOvalSteelFrame(
          active.ovalProfile,
          active.lid,
          active.handle,
          active.frame,
          active.ovalFrame,
          DEFAULT_RECT_SEGMENTS_PER_CORNER,
          ovalDenseSamples,
        ),
        ovalFrameError: null as string | null,
      };
    } catch (e) {
      return { ovalFrameResult: null, ovalFrameError: e instanceof Error ? e.message : String(e) };
    }
  }, [isOval, active.ovalProfile, active.lid, active.handle, active.frame, active.ovalFrame, ovalDenseSamples]);

  const { ellipseFrameResult, ellipseFrameError } = useMemo(() => {
    if (!isEllipse) return { ellipseFrameResult: null, ellipseFrameError: null as string | null };
    try {
      return {
        ellipseFrameResult: buildEllipseSteelFrame(
          active.ellipseProfile,
          active.lid,
          active.handle,
          active.frame,
          active.ellipseFrame,
          DEFAULT_ELLIPSE_SEGMENTS,
          ellipseDenseSamples,
        ),
        ellipseFrameError: null as string | null,
      };
    } catch (e) {
      return { ellipseFrameResult: null, ellipseFrameError: e instanceof Error ? e.message : String(e) };
    }
  }, [isEllipse, active.ellipseProfile, active.lid, active.handle, active.frame, active.ellipseFrame, ellipseDenseSamples]);

  // Calculate (BOM) — steel rows come straight from whichever frame's own
  // tubes are already tagged with a BomPart (see frameEngine.ts/
  // rectFrameEngine.ts/ovalFrameEngine.ts/ellipseFrameEngine.ts); area rows
  // only have a real spec to match for Round (ANASU's calculate_engine.rb) —
  // the other 3 shapes use bomEngine.ts's own from-scratch generalization
  // (see its own comment for the approximation it makes), since no
  // reference formula exists for them.
  const bomSteelTubes =
    active.shape === "round" ? frameResult?.tubes : isRect ? rectFrameResult?.tubes : isOval ? ovalFrameResult?.tubes : isEllipse ? ellipseFrameResult?.tubes : undefined;
  const bomSteelRows: BomSteelRow[] = useMemo(() => buildSteelBom(bomSteelTubes ?? []), [bomSteelTubes]);
  const bomAreaRows: BomAreaRow[] = useMemo(() => {
    if (active.shape === "round" && result) {
      const top = result.sections[0];
      const bottom = result.sections[result.sections.length - 1];
      return buildAreaBom(result.samples, top.cap, bottom.cap, active.material, active.handle, active.lid, top.radiusMm, bottom.radiusMm);
    }
    if (isRect) {
      return buildRectAreaBom(active.rectProfile.mouth, active.rectProfile.base, active.material, active.handle, active.lid);
    }
    if (isOval && ovalResult) {
      const sections = normalizeOvalRings(active.ovalProfile.rings);
      return buildOvalAreaBom(
        ovalResult.samples,
        (z) => ovalDimsAtZ(ovalResult.samples, z),
        sections[0].cap,
        sections[sections.length - 1].cap,
        active.material,
        active.handle,
        active.lid,
      );
    }
    if (isEllipse && ellipseResult) {
      const sections = normalizeEllipseRings(active.ellipseProfile.rings);
      return buildEllipseAreaBom(
        ellipseResult.samples,
        (z) => ellipseDimsAtZ(ellipseResult.samples, z),
        sections[0].cap,
        sections[sections.length - 1].cap,
        active.material,
        active.handle,
        active.lid,
      );
    }
    return [];
  }, [active.shape, result, isRect, active.rectProfile, isOval, ovalResult, active.ovalProfile, isEllipse, ellipseResult, active.ellipseProfile, active.material, active.handle, active.lid]);
  const bomEnabled = bomSteelRows.length > 0 || bomAreaRows.length > 0;

  // "Xuất bản vẽ" (2D technical drawing) — one shared ShapeDrawingInput for
  // whichever shape is currently active, built from that shape's own 3D
  // Solid result (its denseSamples-respecting `samples`, when Khóa dáng is
  // active, so the drawing always matches the 3D view exactly — a
  // pre-existing gap the old Round-only version of this drawing had: it
  // rebuilt its own samples from `rings` alone via buildProfileSamples,
  // silently diverging from a locked/traced product's real body instead of
  // reusing `result.samples`). Every shape maps onto the SAME generic
  // (halfLength, halfWidth, z) row representation TechnicalDrawing.tsx
  // consumes — see drawingEngine.ts's own comment for why that's a faithful
  // generalization, not an approximation, for the shape (Round) it was
  // originally written for.
  const drawingInput: ShapeDrawingInput | null = useMemo(() => {
    if (active.shape === "round") {
      if (!result) return null;
      const rows: ShapeDrawingRow[] = result.samples.map(([r, z]) => ({ zMm: z, halfLengthMm: r, halfWidthMm: r, cornerRMm: 0 }));
      const rings = result.sections.map((s, i) => ({ zMm: s.zMm, label: ringLabel(i, result.sections.length), lengthMm: s.diameterMm, widthMm: s.diameterMm }));
      return {
        rows,
        rings,
        outline2D: (length: number, _width: number, _cornerR: number, segments?: number) =>
          circlePoints(length / 2, 0, segments ?? 64).map(([x, y]): [number, number] => [x, y]),
        isRound: true,
      };
    }
    if (isRect) {
      const { mouth, base, horizontalRings } = active.rectProfile;
      const middle = horizontalRings.map((r) => ({ z: r.z, ...interpolateRectCorner(mouth, base, r.z) })).sort((a, b) => b.z - a.z);
      const points = [
        { z: mouth.z, length: mouth.length, width: mouth.width, cornerR: mouth.cornerR },
        ...middle,
        { z: base.z, length: base.length, width: base.width, cornerR: base.cornerR },
      ];
      const rows: ShapeDrawingRow[] = points.map((p) => ({ zMm: p.z, halfLengthMm: p.length / 2, halfWidthMm: p.width / 2, cornerRMm: p.cornerR }));
      const rings = points.map((p, i) => ({ zMm: p.z, label: ringLabel(i, points.length), lengthMm: p.length, widthMm: p.width }));
      return {
        rows,
        rings,
        outline2D: (length: number, width: number, cornerR: number, segments?: number) =>
          buildRoundedRectPoints2D(length, width, cornerR, Math.max(2, Math.round((segments ?? 32) / 4))),
        isRound: false,
      };
    }
    if (isOval) {
      if (!ovalResult) return null;
      const rows: ShapeDrawingRow[] = ovalResult.samples.map(([length, width, z]) => ({ zMm: z, halfLengthMm: length / 2, halfWidthMm: width / 2, cornerRMm: 0 }));
      const sections = normalizeOvalRings(active.ovalProfile.rings);
      const rings = sections.map((s, i) => ({ zMm: s.zMm, label: ringLabel(i, sections.length), lengthMm: s.lengthMm, widthMm: s.widthMm }));
      return {
        rows,
        rings,
        outline2D: (length: number, width: number, _cornerR: number, segments?: number) =>
          buildRoundedRectPoints2D(length, width, width / 2, Math.max(2, Math.round((segments ?? 32) / 4))),
        isRound: false,
      };
    }
    if (isEllipse) {
      if (!ellipseResult) return null;
      const rows: ShapeDrawingRow[] = ellipseResult.samples.map(([length, width, z]) => ({ zMm: z, halfLengthMm: length / 2, halfWidthMm: width / 2, cornerRMm: 0 }));
      const sections = normalizeEllipseRings(active.ellipseProfile.rings);
      const rings = sections.map((s, i) => ({ zMm: s.zMm, label: ringLabel(i, sections.length), lengthMm: s.lengthMm, widthMm: s.widthMm }));
      return {
        rows,
        rings,
        outline2D: (length: number, width: number, _cornerR: number, segments?: number) => ellipsePoints2D(length, width, segments ?? 64),
        isRound: false,
      };
    }
    return null;
  }, [active.shape, result, isRect, active.rectProfile, isOval, active.ovalProfile, ovalResult, isEllipse, active.ellipseProfile, ellipseResult]);

  const drawingFrameResult = active.shape === "round" ? frameResult : isRect ? rectFrameResult : isOval ? ovalFrameResult : isEllipse ? ellipseFrameResult : null;

  // Which view shows a standing handle's true arc — "front" only for a
  // Rectangle/Square handle mounted on the width axis (its arc then sweeps
  // across X, not Y) — see rectHandlePaths.ts's own rectHandleAxis.
  const handleArcView: "front" | "side" = isRect && active.handle.side === "length" ? "front" : "side";

  // A guide-line preview of the handle on the Solid view — same
  // centerlines FrameEngine sweeps into steel tubes, just drawn thin.
  const handlePaths = useMemo(() => {
    if (isRect) {
      try {
        return computeRectHandlePaths(active.rectProfile.mouth, active.rectProfile.base, active.handle);
      } catch {
        return [];
      }
    }
    if (isOval) {
      try {
        return computeOvalHandlePaths(active.ovalProfile.rings, active.handle);
      } catch {
        return [];
      }
    }
    if (isEllipse) {
      try {
        return computeEllipseHandlePaths(active.ellipseProfile.rings, active.handle);
      } catch {
        return [];
      }
    }
    if (!result) return [];
    try {
      const samples = buildProfileSamples(result.sections);
      return computeHandlePaths(result.sections[0], samples, active.handle);
    } catch {
      return [];
    }
  }, [isRect, active.rectProfile, isOval, active.ovalProfile, isEllipse, active.ellipseProfile, result, active.handle]);

  const bounds: Bounds3D = useMemo(() => {
    if (isRect) {
      const { mouth, base, horizontalRings } = active.rectProfile;
      const lidHeight = active.lid.mode === "cover" || active.lid.mode === "flat" ? (active.lid.height ?? 60) : 0;
      const zs = [mouth.z, base.z, ...horizontalRings.map((r) => r.z)];
      const diagonals = [Math.hypot(mouth.length, mouth.width), Math.hypot(base.length, base.width)];
      if (active.lid.bottomLength || active.lid.bottomWidth) {
        diagonals.push(Math.hypot(active.lid.bottomLength ?? mouth.length * 2, active.lid.bottomWidth ?? mouth.width * 2));
      }
      const halfDiagonal = Math.max(...diagonals, 100) / 2;
      return {
        heightMm: Math.max(...zs, 1) - Math.min(...zs, 0) + lidHeight,
        radiusMm: halfDiagonal,
        minZMm: Math.min(...zs, 0),
        maxZMm: Math.max(...zs, 0) + lidHeight,
      };
    }
    if (isOval) {
      const { rings } = active.ovalProfile;
      const mouth = rings[0];
      const lidHeight = active.lid.mode === "cover" || active.lid.mode === "flat" ? (active.lid.height ?? 60) : 0;
      const zs = rings.map((r) => r.z);
      // Every ring, not just mouth/base — a bulging middle ring can exceed
      // both endpoints, and the bounds need to contain that.
      const diagonals = rings.map((r) => Math.hypot(r.length, r.width));
      if (active.lid.bottomLength || active.lid.bottomWidth) {
        diagonals.push(Math.hypot(active.lid.bottomLength ?? mouth.length * 2, active.lid.bottomWidth ?? mouth.width * 2));
      }
      const halfDiagonal = Math.max(...diagonals, 100) / 2;
      return {
        heightMm: Math.max(...zs, 1) - Math.min(...zs, 0) + lidHeight,
        radiusMm: halfDiagonal,
        minZMm: Math.min(...zs, 0),
        maxZMm: Math.max(...zs, 0) + lidHeight,
      };
    }
    if (isEllipse) {
      const { rings } = active.ellipseProfile;
      const mouth = rings[0];
      const lidHeight = active.lid.mode === "cover" || active.lid.mode === "flat" ? (active.lid.height ?? 60) : 0;
      const zs = rings.map((r) => r.z);
      // Every ring, not just mouth/base — a bulging middle ring can exceed
      // both endpoints, and the bounds need to contain that.
      const diagonals = rings.map((r) => Math.hypot(r.length, r.width));
      if (active.lid.bottomLength || active.lid.bottomWidth) {
        diagonals.push(Math.hypot(active.lid.bottomLength ?? mouth.length * 2, active.lid.bottomWidth ?? mouth.width * 2));
      }
      const halfDiagonal = Math.max(...diagonals, 100) / 2;
      return {
        heightMm: Math.max(...zs, 1) - Math.min(...zs, 0) + lidHeight,
        radiusMm: halfDiagonal,
        minZMm: Math.min(...zs, 0),
        maxZMm: Math.max(...zs, 0) + lidHeight,
      };
    }
    const zs = active.rings.map((r) => r.z);
    const diameters = active.rings.map((r) => r.diameter);
    if (active.lid.diameter) diameters.push(active.lid.diameter);
    if (active.lid.bottomDiameter) diameters.push(active.lid.bottomDiameter);
    const height = Math.max(...zs, 1) - Math.min(...zs, 0);
    const lidHeight = active.lid.mode === "cover" ? (active.lid.height ?? 60) : 0;
    return {
      heightMm: height + lidHeight,
      radiusMm: Math.max(...diameters, 100) / 2,
      minZMm: Math.min(...zs, 0),
      maxZMm: Math.max(...zs, 0) + lidHeight,
    };
  }, [isRect, active.rectProfile, isOval, active.ovalProfile, isEllipse, active.ellipseProfile, active.rings, active.lid]);

  // Switching TO Square should read as an immediate, visible change — not
  // just hide the width field while leaving a stale, mismatched width in
  // state until the user happens to retype the length.
  function changeShape(shape: ProductState["shape"]) {
    const wasRect = isRect;
    const willBeRect = shape === "square" || shape === "rectangle";
    // Round's "center_axis" lean has no meaning on a flat rect wall — swap
    // to rect's own default ("taper") once, the same spirit as Square's
    // width=length sync just below: land on a value the new shape's own
    // dropdown actually offers, instead of a silently-mismatched leftover.
    // The reverse also matters now: "taper" (Rect-only) has no meaning once
    // leaving Rect for anything else — Oval mounts its handle "giống
    // Round" (radial, at the 2 cap tips), so it swaps back to center_axis
    // exactly like Round does.
    const handlePatch =
      !wasRect && willBeRect && active.handle.leanMode === "center_axis"
        ? { handle: { ...active.handle, leanMode: "taper" as const } }
        : wasRect && !willBeRect && active.handle.leanMode === "taper"
          ? { handle: { ...active.handle, leanMode: "center_axis" as const } }
          : {};
    if (shape === "square") {
      updateActive({
        shape,
        rectProfile: {
          ...active.rectProfile,
          mouth: { ...active.rectProfile.mouth, width: active.rectProfile.mouth.length },
          base: { ...active.rectProfile.base, width: active.rectProfile.base.length },
        },
        // Square shows ONE rib count for both faces — make them agree now.
        rectFrame: { ...active.rectFrame, widthRibCount: active.rectFrame.lengthRibCount },
        ...handlePatch,
      });
      return;
    }
    updateActive({ shape, ...handlePatch });
  }

  function addProduct() {
    // Refuse to touch the product list before the server-confirmed list has
    // actually loaded — acting on the pre-hydration placeholder (or mid-GET)
    // state here would POST/DELETE against a `dbIdByCodeRef` that doesn't
    // yet reflect what's really in the database.
    if (!hydrated || readOnly) return;
    const product = createProduct(productSeqRef.current++);
    setProducts((prev) => [...prev, product]);
    setActiveId(product.id);
    // Posted immediately (not left to the debounced autosave above) so
    // dbIdByCodeRef has a row to PATCH against before that effect's next
    // tick — the debounce loop silently skips any product still missing
    // from the map.
    fetch(`/api/breakdowns/${id}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: product.id, name: product.name, data: product }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((created: ApiProduct | null) => {
        if (created) dbIdByCodeRef.current[product.id] = created.id;
      });
  }

  // ▲/▼ in ProductList: swap the product with its neighbour, then persist the
  // whole new order right away (the autosave below only PATCHes name/data, never
  // sortOrder). Row ids still missing from dbIdByCodeRef (create-POST in
  // flight) are left out; the server keeps those after the listed ones.
  function moveProduct(code: string, delta: -1 | 1) {
    if (!hydrated || readOnly) return;
    const from = products.findIndex((p) => p.id === code);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= products.length) return;
    const next = [...products];
    [next[from], next[to]] = [next[to], next[from]];
    setProducts(next);
    const order = next.map((p) => dbIdByCodeRef.current[p.id]).filter((x): x is string => !!x);
    // Chained, not fired in parallel: two quick clicks must reach the server in
    // click order, or an older order could land last and win.
    reorderChainRef.current = reorderChainRef.current.then(() =>
      fetch(`/api/breakdowns/${id}/products/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      }).then(
        () => undefined,
        () => undefined,
      ),
    );
  }

  function removeProduct(code: string) {
    // Same pre-hydration guard as addProduct — never delete against a
    // product list/dbIdByCodeRef that hasn't been confirmed from the server
    // yet.
    if (!hydrated || readOnly) return;
    if (products.length <= 1) return; // always keep at least one product
    setProducts((prev) => prev.filter((p) => p.id !== code));
    if (code === activeId) {
      const next = products.filter((p) => p.id !== code);
      if (next.length > 0) setActiveId(next[0].id);
    }
    const dbId = dbIdByCodeRef.current[code];
    if (dbId) {
      delete dbIdByCodeRef.current[code];
      fetch(`/api/breakdowns/${id}/products/${dbId}`, { method: "DELETE" });
    }
  }

  if (!hydrated) {
    return (
      <div className="flex h-screen flex-col bg-bg">
        <TopNav />
        <div className="flex flex-1 items-center justify-center text-[13px] text-text-faint">Đang tải…</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-bg">
      <TopNav />
      <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-line bg-surface px-6">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-text-faint">Bóc tách kỹ thuật ·</span>
          <span className="text-[13px] font-semibold text-text">{breakdownName}</span>
          {readOnly && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">Chỉ xem · được chia sẻ</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <ActionBar exportEnabled={!!drawingInput} onExportDrawing={() => setShowDrawing(true)} bomEnabled={bomEnabled} onCalculateBom={() => setShowBom(true)} />
          {products.length > 1 && (
            <button
              type="button"
              onClick={() => setShowMultiExport(true)}
              className="flex h-8 items-center justify-center rounded-md border border-line bg-white px-3 text-[12.5px] font-bold text-text hover:bg-bg"
            >
              Xuất gộp nhiều SP
            </button>
          )}
          <Link
            href="/breakdown"
            className="rounded-md border border-line bg-white px-3 py-1 text-[12.5px] font-semibold text-text-muted hover:bg-bg hover:text-text"
          >
            ← Bóc tách kỹ thuật
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left: sản phẩm + nhập liệu */}
        <div className="flex w-[720px] flex-shrink-0 flex-col gap-4 overflow-y-auto border-r border-line bg-bg p-4">
          <ProductList
            products={products}
            activeId={active.id}
            readOnly={readOnly}
            onSelect={setActiveId}
            onAdd={addProduct}
            onRemove={removeProduct}
            onMove={moveProduct}
            onRename={(id, name) => setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))}
            onCodeChange={(id, code) => setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, code } : p)))}
          />

          <fieldset disabled={readOnly} className="contents">
          <InputModeToggle value={inputMode} onChange={setInputMode} />

          {inputMode === "photo" || inputMode === "draw" ? (
            (() => {
              const traceProps = {
                value: active.photoTrace,
                onChange: (photoTrace: typeof active.photoTrace) => updateActive({ photoTrace }),
                onApply: (rings: RingInput[], photoCurve: { z: number; diameter: number }[]) => {
                  updateActive({ shape: "round", rings, photoCurve, photoCurveSource: "trace" });
                  setInputMode("params");
                },
              };
              return inputMode === "photo" ? <PhotoTraceForm key={active.id} {...traceProps} /> : <DrawShapeForm key={active.id} {...traceProps} />;
            })()
          ) : (
            <>
              <ShapeTabs value={active.shape} onChange={changeShape} />

              {active.shape === "round" ? (
                <>
                  {error && (
                    <p className="rounded-lg bg-red-soft px-3 py-2 text-[12.5px] font-semibold text-red">{error}</p>
                  )}
                  <RoundProfileForm
                    rings={active.rings}
                    lid={active.lid}
                    handle={active.handle}
                    scallop={active.scallop}
                    photoCurve={active.photoCurveSource === "manual" ? active.photoCurve : null}
                    onChangeRings={(rings) => updateActive({ rings })}
                    onChangeLid={(lid) => updateActive({ lid })}
                    onChangeHandle={(handle) => updateActive({ handle })}
                    onChangeScallop={(scallop) => updateActive({ scallop })}
                    onLockShape={lockRoundShape}
                    onUnlockShape={unlockRoundShape}
                  />
                </>
              ) : isRect ? (
                <>
                  {rectError && (
                    <p className="rounded-lg bg-red-soft px-3 py-2 text-[12.5px] font-semibold text-red">{rectError}</p>
                  )}
                  <RectProfileForm
                    profile={active.rectProfile}
                    isSquare={active.shape === "square"}
                    lid={active.lid}
                    handle={active.handle}
                    onChange={(rectProfile) => updateActive({ rectProfile })}
                    onChangeLid={(lid) => updateActive({ lid })}
                    onChangeHandle={(handle) => updateActive({ handle })}
                  />
                </>
              ) : isOval ? (
                <>
                  {ovalError && (
                    <p className="rounded-lg bg-red-soft px-3 py-2 text-[12.5px] font-semibold text-red">{ovalError}</p>
                  )}
                  <OvalProfileForm
                    profile={active.ovalProfile}
                    lid={active.lid}
                    handle={active.handle}
                    photoCurve={active.ovalPhotoCurve}
                    onChange={(ovalProfile) => updateActive({ ovalProfile })}
                    onChangeLid={(lid) => updateActive({ lid })}
                    onChangeHandle={(handle) => updateActive({ handle })}
                    onLockShape={lockOvalShape}
                    onUnlockShape={unlockOvalShape}
                  />
                </>
              ) : isEllipse ? (
                <>
                  {ellipseError && (
                    <p className="rounded-lg bg-red-soft px-3 py-2 text-[12.5px] font-semibold text-red">{ellipseError}</p>
                  )}
                  <EllipseProfileForm
                    profile={active.ellipseProfile}
                    lid={active.lid}
                    handle={active.handle}
                    photoCurve={active.ellipsePhotoCurve}
                    onChange={(ellipseProfile) => updateActive({ ellipseProfile })}
                    onChangeLid={(lid) => updateActive({ lid })}
                    onChangeHandle={(handle) => updateActive({ handle })}
                    onLockShape={lockEllipseShape}
                    onUnlockShape={unlockEllipseShape}
                  />
                </>
              ) : (
                <div className="rounded-lg border border-line bg-surface p-6 text-center text-[13px] text-text-faint">
                  Shape này sắp có.
                </div>
              )}
            </>
          )}

          <MaterialForm
            value={active.material}
            onChange={(material) => updateActive({ material })}
            bodyZRange={
              solidSamples
                ? { minZ: Math.min(...solidSamples.map(([, z]) => z)), maxZ: Math.max(...solidSamples.map(([, z]) => z)) }
                : { minZ: 0, maxZ: Math.max(...active.rings.map((r) => r.z), 1) }
            }
          />
          </fieldset>
        </div>

        {/* Right: 2 view (khung sắt | solid) phía trên, thông số khung sắt phía dưới */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-[240px] flex-1 basis-0">
            <div className="w-1/2 border-r border-line">
              {active.shape === "round" && frameResult ? (
                <FrameScene result={frameResult} bounds={bounds} liftLid={active.lid.mode === "cover"} />
              ) : isRect && rectFrameResult ? (
                <FrameScene result={rectFrameResult} bounds={bounds} liftLid={active.lid.mode === "cover"} />
              ) : isOval && ovalFrameResult ? (
                <FrameScene result={ovalFrameResult} bounds={bounds} liftLid={active.lid.mode === "cover"} />
              ) : isEllipse && ellipseFrameResult ? (
                <FrameScene result={ellipseFrameResult} bounds={bounds} liftLid={active.lid.mode === "cover"} />
              ) : (
                <ViewPlaceholder
                  title="View khung sắt"
                  message={
                    active.shape === "round"
                      ? (frameError ?? "Shape này sắp có.")
                      : isRect
                        ? (rectFrameError ?? "Shape này sắp có.")
                        : isOval
                          ? (ovalFrameError ?? "Shape này sắp có.")
                          : (ellipseFrameError ?? "Shape này sắp có.")
                  }
                />
              )}
            </div>
            <div className="w-1/2">
              {solidResult ? (
                <ProductScene
                  result={solidResult}
                  samples={solidSamples}
                  handlePaths={handlePaths}
                  bounds={bounds}
                  material={active.material}
                  liftLid={active.lid.mode === "cover"}
                />
              ) : (
                <ViewPlaceholder title="View Solid" message="Shape này sắp có." />
              )}
            </div>
          </div>
          <fieldset disabled={readOnly} className="min-h-[160px] min-w-0 flex-1 basis-0 overflow-y-auto border-t border-line bg-surface p-4">
            {isRect ? (
              <RectFrameForm
                isSquare={active.shape === "square"}
                rectFrame={active.rectFrame}
                frame={active.frame}
                lid={active.lid}
                hasHorizontalRings={active.rectProfile.horizontalRings.length > 0}
                onChangeRectFrame={(rectFrame) => updateActive({ rectFrame })}
                onChangeFrame={(frame) => updateActive({ frame })}
              />
            ) : isOval ? (
              <OvalFrameForm
                ovalFrame={active.ovalFrame}
                frame={active.frame}
                lid={active.lid}
                hasHorizontalRings={active.ovalProfile.rings.length > 2}
                onChangeOvalFrame={(ovalFrame) => updateActive({ ovalFrame })}
                onChangeFrame={(frame) => updateActive({ frame })}
              />
            ) : isEllipse ? (
              <EllipseFrameForm
                ellipseFrame={active.ellipseFrame}
                frame={active.frame}
                lid={active.lid}
                hasHorizontalRings={active.ellipseProfile.rings.length > 2}
                onChangeEllipseFrame={(ellipseFrame) => updateActive({ ellipseFrame })}
                onChangeFrame={(frame) => updateActive({ frame })}
              />
            ) : (
              <SteelFrameForm
                frame={active.frame}
                onChange={(frame) => updateActive({ frame })}
                segmentCount={Math.max(active.rings.length - 1, 1)}
                lid={active.lid}
                handle={active.handle}
                hasHorizontalRings={active.rings.length > 2}
              />
            )}
          </fieldset>
        </div>
      </div>

      {showDrawing && drawingInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex h-[94vh] w-[97vw] max-w-[1800px] flex-col rounded-xl bg-surface p-5 shadow-xl">
            <DrawingSheetA4
              drawing={drawingInput}
              productName={active.name}
              frameResult={drawingFrameResult}
              handle={active.handle}
              handleArcView={handleArcView}
              handlePaths={handlePaths}
              material={active.material}
              onClose={() => setShowDrawing(false)}
              initialDoc={active.drawingDoc}
              onDocChange={(drawingDoc) => updateActive({ drawingDoc })}
            />
          </div>
        </div>
      )}

      {showMultiExport && (
        <MultiDrawingExport products={products} breakdownName={breakdownName} onClose={() => setShowMultiExport(false)} />
      )}

      {showBom && bomEnabled && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex h-[94vh] w-[97vw] max-w-[1400px] flex-col gap-3 rounded-xl bg-surface p-5 shadow-xl">
            <div className="flex flex-shrink-0 items-center justify-between">
              <span className="text-[15px] font-bold text-text">Calculate (BOM) — {active.name}</span>
              <button
                type="button"
                onClick={() => setShowBom(false)}
                className="rounded-md px-2.5 py-1 text-[13px] font-semibold text-text-muted hover:bg-bg hover:text-text"
              >
                Đóng
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <BomSheet productName={active.name} productCode={active.code} steelRows={bomSteelRows} areaRows={bomAreaRows} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
