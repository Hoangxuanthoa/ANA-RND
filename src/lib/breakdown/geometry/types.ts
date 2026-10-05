export type Transition = "straight" | "inward" | "outward";

export interface CurveControlPoint {
  t: number; // 0..1 along the segment
  offset: number; // mm, radial offset applied on top of the base bow
}

export interface RingInput {
  name?: string;
  z: number; // mm, height of this ring
  diameter: number; // mm
  transition?: string; // "straight" | "outward"/"lồi" | "inward"/"lõm"
  curveDepth?: number; // 0..0.65, how much the curve bows out/in
  curveControls?: CurveControlPoint[];
  tangentAngle?: number | null; // radians, overrides the auto tangent at this ring
  cap?: boolean; // close this ring with a flat face (used for the bottom ring)
}

export interface Section {
  name: string;
  zMm: number;
  radiusMm: number;
  diameterMm: number;
  transition: Transition;
  curveDepth: number;
  curveControls: CurveControlPoint[];
  tangentAngle: number | null;
  cap: boolean;
}

export interface LidInput {
  mode?: "none" | "flat" | "cover";
  diameter?: number; // mm, Round: top opening diameter (defaults to the mouth ring's diameter)
  height?: number; // mm, cover lid skirt height (shared by Round/Rect)
  bottomDiameter?: number; // mm, Round: cover lid skirt bottom diameter
  // Rect/Square: "Nắp bằng" = length/width only; "Nắp trùm" = length/width
  // at the lid's own top opening ("miệng nắp", defaults to the mouth's own
  // length/width) plus bottomLength/bottomWidth at its flared-out base
  // ("đáy nắp", where it comes down over the body's mouth — defaults to
  // double the top, same "gấp đôi" default Round's bottomDiameter uses).
  length?: number;
  width?: number;
  bottomLength?: number;
  bottomWidth?: number;
  cornerR?: number; // mm, Rect/Square: the lid's own corner rounding — defaults to the mouth's cornerR, editable
}

export type ShapeKind = "round" | "square" | "rectangle" | "oval" | "ellipse";

// Rectangle/Square profile: unlike Round, the body is ALWAYS just two flat
// planes per side (mouth rect straight to base rect — "đứng" when they're
// the same size, "vát" when they differ) with no bow/curve option at all.
// A "Vòng ngang" here carries no shape data of its own (length/width/R are
// linearly interpolated from mouth→base by its Z) — it only marks an extra
// Z position for the Steel Frame to hang a horizontal ring / vertical-rib
// bend point on, matching the source spec ("chỉ cần nhập chiều cao").
export interface RectCorner {
  z: number; // mm
  length: number; // mm, "chiều dài"
  width: number; // mm, "chiều rộng"
  cornerR: number; // mm, corner bo R
  cap?: boolean; // close with a flat face — only meaningful on the base
}

export interface RectHorizontalRing {
  z: number; // mm — length/width/cornerR are interpolated from mouth/base at this Z
}

export interface RectProfileInput {
  mouth: RectCorner;
  base: RectCorner;
  horizontalRings: RectHorizontalRing[];
}

export const DEFAULT_RECT_PROFILE: RectProfileInput = {
  mouth: { z: 300, length: 300, width: 200, cornerR: 5 },
  base: { z: 0, length: 260, width: 160, cornerR: 5, cap: true },
  horizontalRings: [{ z: 150 }],
};

// Steel-frame layout for Rectangle/Square — simpler than Round's FrameInput
// by design (no radial/curved patterns at all, per spec): rod diameters and
// color still come from the SAME FrameInput Round uses (topDiameter,
// bottomRimDiameter, verticalDiameter, bottomParallelDiameter,
// lidParallelDiameter, colorPreset, … all reused as-is), this only adds the
// rect-specific layout choices.
export type RectCornerRibMode = "bisector" | "tangents" | "both"; // "1 nan" / "2 nan" / "3 nan"
export type RectAxis = "length" | "width";

export interface RectFrameInput {
  // A straight edge's N ribs are always evenly spaced INCLUDING its own 2
  // corner endpoints (so those always get a rib no matter what) — this only
  // controls whether an EXTRA rib is added at the corner's own bisector
  // ("bisector"/"both") on top of that, matching the spec's "1 nan tại tâm
  // góc bo" vs "2 nan tại 2 điểm tiếp giáp" (already-guaranteed by the
  // edges) vs "3 nan" (both).
  cornerRibMode: RectCornerRibMode;
  lengthRibCount: number; // ribs along each of the 2 "mặt dài" (length-direction) edges
  widthRibCount: number; // ribs along each of the 2 "mặt rộng" (width-direction) edges
  bottomDirection: RectAxis; // which axis the Đáy's parallel ribs run along
  bottomCount: number;
  lidDirection: RectAxis; // which axis the Nắp's parallel ribs run along
  lidCount: number;
}

export const DEFAULT_RECT_FRAME: RectFrameInput = {
  cornerRibMode: "bisector",
  lengthRibCount: 5,
  widthRibCount: 4,
  bottomDirection: "width",
  bottomCount: 5,
  lidDirection: "width",
  lidCount: 5,
};

// Oval body: a "stadium" shape — 2 straight sides running along the length
// axis, capped by 2 full semicircles (radius = width/2) at each end. Reuses
// Rectangle's own rounded-rect geometry under the hood — a rounded rect
// whose corner radius is forced to width/2 IS exactly this shape (see
// ovalProfileEngine.ts's ovalCornerToRect) — rather than a wholly separate
// profile engine, since Rectangle's rounded-corner math already produces it
// correctly with zero changes. No independent cornerR field (unlike
// RectCorner): it's always derived — that IS what makes this an oval
// instead of a rectangle.
export interface OvalCorner {
  z: number; // mm
  length: number; // mm, "chiều dài" — should be ≥ width (the shorter axis becomes the cap diameter)
  width: number; // mm, "chiều rộng" — also each end cap's diameter
  cap?: boolean; // close with a flat face — only meaningful on the base
}

// A ring in Oval's own profile list — like Round's RingInput, just carrying
// 2 dimensions (length/width) instead of a single diameter, since an oval
// cross-section needs both. transition/curveDepth describe the curve from
// THIS ring down to the next one (ignored on the last ring) — applied
// independently to length and width by ovalProfileEngine.ts's bowedValue,
// same sin²-bow formula as Round's own bowedRadius, just run twice per
// segment instead of once. This replaces the old fixed mouth/base + a
// shape-less horizontalRings list: that model could only ever taper in a
// straight line mouth→base (a "vòng ngang" changed nothing about the body's
// own surface, only where the Steel Frame hung a ring) — this one is a flat
// list exactly like Round's `rings`, so any ring can bulge/waist the body
// same as Round's own "Lồi"/"Lõm" transitions do.
export interface OvalRingInput extends OvalCorner {
  transition?: string; // "straight" | "outward"/"lồi" | "inward"/"lõm"
  curveDepth?: number; // 0..0.65
}

export interface OvalProfileInput {
  rings: OvalRingInput[]; // sorted mouth→base; rings[0] = Miệng, rings[last] = Đáy — same flat-list convention as Round's own `rings: RingInput[]`
}

export const DEFAULT_OVAL_PROFILE: OvalProfileInput = {
  rings: [
    { z: 300, length: 320, width: 200 },
    { z: 0, length: 280, width: 160, cap: true },
  ],
};

// Vertical-rib layout — 2 modes, per the user:
// "fixed_tips": the 2 "tip" points (each end cap's own arc-center — the
//   farthest point along the length axis) are ALWAYS fixed ribs, not
//   counted in bodyRibsPerHalf. That many EXTRA ribs then space evenly by
//   real ARC LENGTH (through one quarter-cap, the straight side, then the
//   other quarter-cap) across each of the 2 symmetric halves the length
//   axis splits the perimeter into — the other half is the exact mirror.
// "even": no rib is forced onto the tips — bodyRibsPerQuarter spaces that
//   many ribs evenly by arc length within ONE quarter of the perimeter
//   (from a tip to the midpoint of its adjacent straight side — the
//   natural symmetric unit, since mirroring it across BOTH axes tiles the
//   whole closed loop), then mirrors that same set to the other 3
//   quarters — guaranteeing the 2 straight sides land on identical rib
//   patterns, and the 2 end caps do too, rather than a naive continuous
//   sweep around the whole loop (which wouldn't respect either symmetry
//   unless the count happened to divide evenly). See
//   ovalFrameEngine.ts's halfPerimeterPoint.
export type OvalBodyRibMode = "fixed_tips" | "even";

export interface OvalFrameInput {
  bodyRibMode: OvalBodyRibMode;
  bodyRibsPerHalf: number; // "fixed_tips" mode only
  bodyRibsPerQuarter: number; // "even" mode only
  bottomDirection: RectAxis;
  bottomCount: number;
  lidDirection: RectAxis;
  lidCount: number;
}

export const DEFAULT_OVAL_FRAME: OvalFrameInput = {
  bodyRibMode: "fixed_tips",
  bodyRibsPerHalf: 3,
  bodyRibsPerQuarter: 2,
  bottomDirection: "width",
  bottomCount: 5,
  lidDirection: "width",
  lidCount: 5,
};

// Ellipse body: a TRUE mathematical ellipse cross-section
// (x/a)² + (y/b)² = 1 — a smooth continuous curve with NO straight sides
// anywhere, unlike Oval's "stadium" shape (2 straight sides + 2 full
// semicircular caps). a = length/2 (semi-major, X axis), b = width/2
// (semi-minor, Y axis). Confirmed explicitly distinct from Oval — none of
// Rectangle's rounded-corner math applies here; see ellipseProfileEngine.ts.
export interface EllipseCorner {
  z: number; // mm
  length: number; // mm, "chiều dài" — 2× semi-major axis
  width: number; // mm, "chiều rộng" — 2× semi-minor axis
  cap?: boolean; // close with a flat face — only meaningful on the base
}

// A ring in Ellipse's own profile list — same idea as Oval's OvalRingInput,
// just for a true ellipse: length/width instead of a single diameter, plus
// transition/curveDepth describing the bow from THIS ring down to the next
// (ignored on the last ring). Replaces the old fixed mouth/base + a
// shape-less horizontalRings list — see ellipseProfileEngine.ts.
export interface EllipseRingInput extends EllipseCorner {
  transition?: string; // "straight" | "outward"/"lồi" | "inward"/"lõm"
  curveDepth?: number; // 0..0.65
}

export interface EllipseProfileInput {
  rings: EllipseRingInput[]; // sorted mouth→base; rings[0] = Miệng, rings[last] = Đáy
}

export const DEFAULT_ELLIPSE_PROFILE: EllipseProfileInput = {
  rings: [
    { z: 300, length: 320, width: 200 },
    { z: 0, length: 280, width: 160, cap: true },
  ],
};

// Same 2 vertical-rib modes and Đáy/Nắp scheme as Oval — an ellipse has
// the identical 2-axis mirror symmetry a stadium does; only the perimeter
// walk itself differs (a smooth curve via numeric arc length instead of
// arc+straight+arc) — see ellipseProfileEngine.ts's halfPerimeterPoint.
export type EllipseBodyRibMode = "fixed_tips" | "even";

export interface EllipseFrameInput {
  bodyRibMode: EllipseBodyRibMode;
  bodyRibsPerHalf: number; // "fixed_tips" mode only
  bodyRibsPerQuarter: number; // "even" mode only
  bottomDirection: RectAxis;
  bottomCount: number;
  lidDirection: RectAxis;
  lidCount: number;
}

export const DEFAULT_ELLIPSE_FRAME: EllipseFrameInput = {
  bodyRibMode: "fixed_tips",
  bodyRibsPerHalf: 3,
  bodyRibsPerQuarter: 2,
  bottomDirection: "width",
  bottomCount: 5,
  lidDirection: "width",
  lidCount: 5,
};

export type HandleType = "none" | "standing" | "cutout";
export type HandleShape = "curve" | "square";
// "taper" is Rect/Square-only: the handle's base sits at the mouth wall's
// actual position (no lean at all there — a flat wall has no chord/radius
// distinction the way a circle does), and its APEX sits wherever that same
// wall's own mouth→base taper line would be if extended past the mouth by
// the handle's height. On a "đứng" (untapered) body this is identical to
// "vertical"; it only visibly leans on a "vát" (tapered) body, where it
// reads as the handle continuing the body's own flare upward.
export type LeanMode = "vertical" | "center_axis" | "manual" | "taper";

// Handle is a shape-level design choice (does it have a handle, what
// style) — lives next to Lid in the profile form, not in the Steel Frame
// technical config. Field names/defaults mirror ANASU's
// FrameEngine.normalize_handle exactly (frame_engine.rb).
export interface HandleInput {
  type: HandleType;
  shape: HandleShape; // only used when type === "standing"
  width: number; // mm
  height: number; // mm
  lines: 1 | 2;
  offset: number; // mm, gap between the 2 lines when lines === 2
  leanMode: LeanMode;
  leanAngle: number; // degrees, only used when leanMode === "manual"
  fillet: number; // mm, corner rounding for shape === "square" and for cutout
  // Optional (not in older saves) — treat missing as "rect" everywhere this
  // is read, same convention as every other field added to HandleInput
  // after launch.
  cutoutShape?: "rect" | "round";
  cutoutWidth: number; // rect: opening width. round: opening diameter.
  cutoutOffset: number; // mm, gap from the mouth to the top of the cutout
  cutoutDepth: number; // rect only — round has no separate depth, the opening is a single circle
  side: RectAxis; // Rect/Square only: which pair of faces the handle sits on — "thường là ở cạnh rộng" (width faces), so that's the default
}

export const DEFAULT_HANDLE: HandleInput = {
  type: "none",
  shape: "curve",
  width: 110,
  height: 55,
  lines: 1,
  offset: 20,
  leanMode: "center_axis",
  leanAngle: 0,
  fillet: 5,
  cutoutShape: "rect",
  cutoutWidth: 90,
  cutoutOffset: 0,
  cutoutDepth: 40,
  side: "width",
};

// Steel-frame configuration. Mirrors ANASU's FrameEngine spec (see
// ANASU-reference/ANASU/src/geometry/frame_engine.rb `normalize_spec`).
export interface FrameInput {
  verticalMode: "continuous" | "per_curve";
  verticalCount: number; // used directly when verticalMode === "continuous", and as the fallback per-segment count otherwise
  perCurveCounts: number[]; // one count per ring segment, only used when verticalMode === "per_curve"; padded/truncated to the actual segment count at build time
  ringPlacement: "inside" | "outside";
  bottomPattern: "radial" | "parallel" | "none"; // "none" = bare rim ring only, no fill ribs — small products often don't need any
  bottomRadialMode: "center" | "center_ring";
  bottomRadialCount: number;
  bottomCenterDiameter: number; // mm, only used when bottomRadialMode === "center_ring"
  bottomParallelLines: number; // only used when bottomPattern === "parallel"
  lidPattern: "radial" | "parallel" | "none"; // "none" = bare rim ring only, no fill ribs
  lidRadialMode: "center" | "center_ring";
  lidRadialCount: number;
  lidCenterDiameter: number; // mm, only used when lidRadialMode === "center_ring"
  lidParallelLines: number; // only used when lidPattern === "parallel"
  // "Nan dọc thân nắp" — only meaningful for lid.mode === "cover" (the wall
  // ribs connecting the lid's own bottom/top rings). undefined = auto, same
  // as the body's own verticalCount (the only sensible default when
  // verticalMode === "continuous"; verticalMode === "per_curve" has no
  // single body count to copy, so this still needs an explicit value then —
  // same "defaults to X, overridable" convention as e.g. LidInput.diameter).
  // A number here means the user set an explicit override.
  lidWallCount?: number;
  diameterMode: "same" | "custom";
  sameDiameter: number; // mm, FI (steel rod diameter) when diameterMode = "same"
  // Per-part FI, only used when diameterMode === "custom". Each falls back
  // to a sensible related value (mirroring normalize_spec's fallback
  // chain) when left at the same default, not to a hard 4mm.
  topDiameter: number;
  bodyDiameter: number;
  bottomRimDiameter: number;
  verticalDiameter: number;
  bottomRadialDiameter: number;
  bottomCenterRingDiameter: number;
  bottomParallelDiameter: number;
  lidTopDiameter: number;
  lidWallDiameter: number;
  lidBottomDiameter: number;
  lidRadialDiameter: number;
  lidCenterRingDiameter: number;
  lidParallelDiameter: number;
  handleDiameter: number;
  colorPreset: string;
  customColor: string; // hex, e.g. "#e3d0b0" — used when colorPreset === "custom"
}

export const DEFAULT_FRAME: FrameInput = {
  verticalMode: "continuous",
  verticalCount: 12,
  perCurveCounts: [],
  ringPlacement: "outside",
  bottomPattern: "radial",
  bottomRadialMode: "center",
  bottomRadialCount: 12,
  bottomCenterDiameter: 60,
  bottomParallelLines: 1,
  lidPattern: "radial",
  lidRadialMode: "center",
  lidRadialCount: 12,
  lidCenterDiameter: 60,
  lidParallelLines: 1,
  diameterMode: "same",
  sameDiameter: 4,
  topDiameter: 4,
  bodyDiameter: 4,
  bottomRimDiameter: 4,
  verticalDiameter: 4,
  bottomRadialDiameter: 4,
  bottomCenterRingDiameter: 4,
  bottomParallelDiameter: 4,
  lidTopDiameter: 4,
  lidWallDiameter: 4,
  lidBottomDiameter: 4,
  lidRadialDiameter: 4,
  lidCenterRingDiameter: 4,
  lidParallelDiameter: 4,
  handleDiameter: 4,
  colorPreset: "beige",
  customColor: "#e3d0b0",
};

// Scalloped ("cánh hoa") mouth rim: the mouth ring's height undulates by
// angle instead of sitting flat — N petals, each a smooth arc from one
// junction ("valley") up to its own apex and back down to the next valley.
// Lives next to Lid/Handle as a mouth-rim style choice, not a Steel Frame
// setting — same placement rationale as Handle.
export type ScallopFrameStyle = "continuous" | "separate";
export type ScallopAnchor = "apex" | "valley";

export interface ScallopInput {
  enabled: boolean;
  count: number; // number of petals
  height?: number; // mm, undefined = auto (half the auto-computed petal width)
  frameStyle: ScallopFrameStyle; // "continuous" = one ring tube with a small fillet at each valley; "separate" = one arch tube per petal, welded at the valleys
  filletMm: number; // mm, corner rounding at each valley — only used when frameStyle === "continuous"
  verticalAnchor: ScallopAnchor; // where the mouth-adjacent vertical ribs land: petal apex or petal valley
  verticalEvery: number; // 1 = a rib at every apex/valley, 2 = every other one, 3 = every third, etc.
}

export const DEFAULT_SCALLOP: ScallopInput = {
  enabled: false,
  count: 8,
  height: undefined,
  frameStyle: "continuous",
  filletMm: 5,
  verticalAnchor: "valley",
  verticalEvery: 1,
};

// Solid-view surface material ("đổ texture/vân liệu"): one uploaded image,
// wrapped independently onto 3 zones (Thân/Đáy/Nắp — body, bottom cap, lid)
// since they use different UV schemes (body: cylindrical around the
// revolve; caps: radial/planar disc — see profileEngine.ts's cylindricalUV
// vs buildCapGeometry) and so the SAME rotation/repeat numbers land at very
// different real-world scales on each. Splitting further, to one zone per
// ring-to-ring body segment, is the bigger "nhiều khoang vật liệu" feature —
// this only separates the 3 geometrically-distinct surfaces. imageDataUrl
// (not a blob object URL) so this survives JSON persistence the same way
// PhotoTraceInput already does.
export interface MaterialZoneSettings {
  rotationDeg: 0 | 90 | 180 | 270;
  flipX: boolean;
  flipY: boolean;
  repeatX: number; // tiling count around the circumference (body) or across the disc (caps)
  repeatY: number; // tiling count along the height (body) or across the disc (caps)
  offsetX: number; // 0..1, fraction of one tile — "di chuyển map" left/right
  offsetY: number; // 0..1, fraction of one tile — "di chuyển map" up/down
}

export const DEFAULT_MATERIAL_ZONE: MaterialZoneSettings = {
  rotationDeg: 0,
  flipX: false,
  flipY: false,
  repeatX: 2,
  repeatY: 2,
  offsetX: 0,
  offsetY: 0,
};

// One paintable compartment of the body ("khoang vật liệu"). imageDataUrl
// null = fall back to MaterialInput.imageDataUrl (the shared/default
// upload), so the user only has to upload a second image for the specific
// bands that actually need a different material. `splits` (below) are
// DELIBERATELY independent of `rings`/the steel frame — a material
// compartment boundary doesn't have to be a real welded ring, and a real
// ring doesn't have to be a compartment boundary either.
export interface MaterialBand {
  id: string;
  imageDataUrl: string | null;
  settings: MaterialZoneSettings;
}

function newBand(): MaterialBand {
  return { id: `band-${Math.random().toString(36).slice(2, 9)}`, imageDataUrl: null, settings: { ...DEFAULT_MATERIAL_ZONE } };
}

// "Ống đường ngang": an optional rolled-tube ring drawn at each `splits` Z
// (reusing the same tube-sweep as the steel frame's own mouth/base rim
// tubes — see tubeSweep.ts) so the Solid view can show a real fabricated-
// looking rim at a material seam, purely as a visual/Solid-only detail —
// it does NOT add a structural member to the Khung sắt.
export interface RingTubeSettings extends MaterialBand {
  enabled: boolean;
  diameterMm: number;
}

export interface MaterialInput {
  enabled: boolean;
  imageDataUrl: string | null; // shared/default image
  splits: number[]; // Z heights (mm), strictly between base and mouth, sorted ascending — divides the body into splits.length + 1 bands
  bands: MaterialBand[]; // length === splits.length + 1; bands[0] is the bottom-most band
  bottom: MaterialBand;
  lid: MaterialBand;
  ringTube: RingTubeSettings;
}

export function withSplitAdded(material: MaterialInput, zMm: number): MaterialInput {
  const splits = [...material.splits, zMm].sort((a, b) => a - b);
  const insertAt = splits.indexOf(zMm);
  const bands = [...material.bands];
  bands.splice(insertAt + 1, 0, newBand());
  return { ...material, splits, bands };
}

export function withSplitRemoved(material: MaterialInput, index: number): MaterialInput {
  const splits = material.splits.filter((_, i) => i !== index);
  // Removing split[index] merges band[index] and band[index+1] — keep the
  // lower band's own settings/image rather than silently discarding either.
  const bands = material.bands.filter((_, i) => i !== index + 1);
  return { ...material, splits, bands };
}

// Repositions split[index] to an exact Z — clamped between its immediate
// neighbours (or the body's own min/max at the ends) with a 1mm floor gap,
// so a band can never be dragged to zero height or past a neighbouring
// split. Doesn't touch `bands`: moving a boundary doesn't add/remove any.
export function withSplitMoved(material: MaterialInput, index: number, zMm: number, bodyMinZ: number, bodyMaxZ: number): MaterialInput {
  const lowerBound = index > 0 ? material.splits[index - 1] : bodyMinZ;
  const upperBound = index < material.splits.length - 1 ? material.splits[index + 1] : bodyMaxZ;
  const clamped = Math.min(Math.max(zMm, lowerBound + 1), upperBound - 1);
  const splits = material.splits.map((z, i) => (i === index ? clamped : z));
  return { ...material, splits };
}

// A function, not a plain object constant: MaterialInput nests arrays/
// objects (bands, bottom, lid, ringTube), so every caller needs its OWN
// fresh copy — a shared constant spread with `{ ...DEFAULT_MATERIAL }`
// would still share the SAME `bands` array/object references across every
// product or reset, so editing one product's bands would corrupt another's.
export function createDefaultMaterial(): MaterialInput {
  return {
    enabled: false,
    imageDataUrl: null,
    splits: [],
    bands: [newBand()],
    bottom: newBand(),
    lid: newBand(),
    ringTube: { ...newBand(), enabled: false, diameterMm: 6 },
  };
}

// Photo-trace input ("Đính kèm ảnh"): a front-view photo the user traces the
// silhouette on. Points are stored in the ORIGINAL image's pixel space (not
// the on-screen display scale) so they stay correct regardless of zoom/panel
// size. axisXPx is the draggable vertical center-axis guide — a point's
// diameter is derived as 2×|xPx-axisXPx|, so the user only traces one side.
export interface PhotoTracePoint {
  xPx: number;
  yPx: number;
}

// A photo alone has no real-world scale, so the traced points stay in pixel
// space until at least one of these 4 overrides is set — see
// photoCalibration.ts's resolveCurve for how it bootstraps a px→mm scale
// from whichever ones are set, then (with 2+ diameter overrides) smoothly
// warps the curve so EVERY locked value holds exactly, not just one.
// null = "show the auto-measured value, still editable" (not locked).
export interface PhotoTraceInput {
  imageDataUrl: string | null;
  imageWidth: number;
  imageHeight: number;
  axisXPx: number;
  points: PhotoTracePoint[];
  mouthMmOverride: number | null;
  maxBodyMmOverride: number | null;
  baseMmOverride: number | null;
  heightMmOverride: number | null;
  // Chosen ring Z's (mm, up from the base) — only meaningful once calibrated.
  // A FEW picks, not one per traced point: profileEngine bows the segment
  // BETWEEN two rings, so a bulge/waist must be its own ring (see
  // photoSpline.ts). Empty until the user runs the auto-suggest or adds one.
  ringZMm: number[];
  // Once true, the raw trace points are frozen/hidden and the canvas instead
  // lets the user click directly on the locked curve to add/remove rings.
  boundaryLocked: boolean;
}

export const DEFAULT_PHOTO_TRACE: PhotoTraceInput = {
  imageDataUrl: null,
  imageWidth: 0,
  imageHeight: 0,
  axisXPx: 0,
  points: [],
  mouthMmOverride: null,
  maxBodyMmOverride: null,
  baseMmOverride: null,
  heightMmOverride: null,
  ringZMm: [],
  boundaryLocked: false,
};

export interface ProductState {
  id: string;
  name: string;
  code: string;
  shape: ShapeKind;
  rings: RingInput[];
  // The dense, full-fidelity boundary from a photo trace (see
  // buildRingsFromTrace/photoCalibration.ts) — null for a hand-built product.
  // When set, buildRoundSolid lofts the BODY from this instead of `rings`,
  // so the frame's ring count/positions (still driven by `rings` alone) can
  // stay sparse without flattening the visible silhouette; see buildRoundSolid's
  // denseSamples param in profileEngine.ts for why rings alone can't do both.
  // Also settable directly from "Nhập thông số" ("Khóa dáng") — the SAME
  // problem (a ring you don't want as real welded structure, forced to exist
  // just to pin a bulge/waist) turned out to affect hand-entered rings too,
  // not just photo traces.
  photoCurve: { z: number; diameter: number }[] | null;
  // "trace": came from a photo/hand-drawn trace — real per-row noise, gets
  // denoised (smoothDiameters) before use. "manual": captured from the
  // engine's OWN already-smooth analytic ring curve (Khóa dáng) — denoising
  // an already-clean curve would just erode the curveDepth the user dialed
  // in on purpose, so this skips that step.
  photoCurveSource: "trace" | "manual";
  // Snapshot of `rings` taken the moment "Khóa dáng" was pressed — while
  // locked, rings are free to add/remove/reposition without touching the
  // shape, so this is the only way back to what they looked like before
  // that editing started. Null when not locked. "Mở khóa" offers restoring
  // this (quay về gốc) or discarding it and keeping the current rings
  // (giữ hiện tại) — both just clear photoCurve/this snapshot either way.
  preLockRings: RingInput[] | null;
  rectProfile: RectProfileInput;
  ovalProfile: OvalProfileInput;
  // Same "Khóa dáng" pair as photoCurve/preLockRings above, just for Oval's
  // own 2-dimensional profile (length AND width per Z, not a single
  // diameter) — Oval has no photo-trace/hand-draw input mode, so there's no
  // "trace" source to denoise; a locked oval curve is always the engine's
  // own already-smooth analytic bow.
  ovalPhotoCurve: { z: number; length: number; width: number }[] | null;
  ovalPreLockRings: OvalRingInput[] | null;
  ellipseProfile: EllipseProfileInput;
  // Same "Khóa dáng" pair, for Ellipse's own profile.
  ellipsePhotoCurve: { z: number; length: number; width: number }[] | null;
  ellipsePreLockRings: EllipseRingInput[] | null;
  lid: LidInput;
  handle: HandleInput;
  frame: FrameInput;
  rectFrame: RectFrameInput;
  ovalFrame: OvalFrameInput;
  ellipseFrame: EllipseFrameInput;
  scallop: ScallopInput;
  photoTrace: PhotoTraceInput;
  material: MaterialInput;
  // The drawing sheet's last session for this product (title-block values,
  // dims/notes/text boxes, scale, font…), saved with the product so
  // reopening "Xuất bản vẽ" restores it. Opaque here — its shape belongs to
  // DrawingSheetA4.tsx (DocState), which validates it on restore.
  drawingDoc?: unknown;
}
