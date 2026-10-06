// Computes the exact same {drawing, frameResult, handlePaths, handleArcView,
// material} bundle the breakdown studio page (page.tsx) derives — via a long
// chain of useMemo hooks — for whichever product is currently `active`, but
// as a plain, non-hook function that takes ANY ProductState directly. Exists
// so the multi-product "Xuất gộp" export can compute every SELECTED
// product's drawing data (not just the one currently open in the studio)
// without re-deriving this logic a second time, or needing to actually
// switch the studio's active product to get each page's PDF.
//
// Kept in lockstep with page.tsx's own result/rectResult/ovalResult/
// ellipseResult, frameResult/rectFrameResult/ovalFrameResult/
// ellipseFrameResult, drawingInput, and handlePaths useMemo blocks — if
// those change, mirror the change here too.
import { buildSteelFrame } from "./geometry/frameEngine";
import { computeHandlePaths } from "./geometry/handlePaths";
import { buildDiameterSpline, smoothDiameters } from "./geometry/photoSpline";
import { buildProfileSamples, buildRoundSolid, circlePoints, normalizeRings, type Sample } from "./geometry/profileEngine";
import { buildRoundedRectPoints2D, DEFAULT_RECT_SEGMENTS_PER_CORNER, interpolateRectCorner } from "./geometry/rectProfileEngine";
import { buildRectSteelFrame } from "./geometry/rectFrameEngine";
import { computeRectHandlePaths } from "./geometry/rectHandlePaths";
import { buildOvalProfileSamples, normalizeOvalRings, type OvalSample } from "./geometry/ovalProfileEngine";
import { buildOvalSteelFrame } from "./geometry/ovalFrameEngine";
import { computeOvalHandlePaths } from "./geometry/ovalHandlePaths";
import { buildEllipseProfileSamples, DEFAULT_ELLIPSE_SEGMENTS, ellipsePoints2D, normalizeEllipseRings, type EllipseSample } from "./geometry/ellipseProfileEngine";
import { buildEllipseSteelFrame } from "./geometry/ellipseFrameEngine";
import { computeEllipseHandlePaths } from "./geometry/ellipseHandlePaths";
import { ringLabel, type ShapeDrawingInput, type ShapeDrawingRow } from "./geometry/drawingEngine";
import { num } from "./geometry/math";
import type { MaterialInput, ProductState } from "./geometry/types";
import type { SteelFrameResult } from "./geometry/frameEngine";
import * as THREE from "three";

// A product with a lid exports TWO drawing sheets: "Thân" (body + base +
// handle, no lid) and "Nắp" (the lid alone). Without a lid there's just one.
export type SheetPart = "body" | "lid";
export const SHEET_PART_LABEL: Record<SheetPart, string> = { body: "Thân", lid: "Nắp" };
export const productHasLid = (p: ProductState) => p.lid?.mode === "flat" || p.lid?.mode === "cover";
export const sheetPartsOf = (p: ProductState): SheetPart[] => (productHasLid(p) ? ["body", "lid"] : ["body"]);

// A flat lid ("nắp bằng") has no thickness of its own in the model (it's just
// ribs + a rim at one height); the Solid drawing gives it this much so it
// shows as a thin plate instead of a zero-height line.
const LID_FLAT_THICKNESS_MM = 3;
// Same default overhang the frame engines give a cover lid (RECT_LID_DEFAULT_OVERHANG_MM).
const LID_DEFAULT_OVERHANG_MM = 20;

// The frame engines tag every lid member group "Nắp" — split the tubes by that.
function frameTubes(frame: SteelFrameResult | null, lidOnly: boolean): SteelFrameResult | null {
  if (!frame) return null;
  return { ...frame, tubes: frame.tubes.filter((t) => (t.part?.group === "Nắp") === lidOnly) };
}
export const frameWithoutLid = (frame: SteelFrameResult | null) => frameTubes(frame, false);

// The lid's own ShapeDrawingInput (Solid view + auto dimensions), derived from
// the body's: same outline function, but rows = the lid's top/bottom at its
// real height above the mouth. Dimension defaults mirror the frame engines'
// addLid so the Solid lid and the frame lid always agree.
function buildLidDrawing(product: ProductState, body: ShapeDrawingInput): ShapeDrawingInput {
  const lid = product.lid;
  const mouth = body.rows[0];
  const mouthL = mouth.halfLengthMm * 2;
  const mouthW = mouth.halfWidthMm * 2;
  const cover = lid.mode === "cover";
  const isRect = product.shape === "square" || product.shape === "rectangle";

  let topL: number, topW: number, botL: number, botW: number, cornerR = 0;
  if (product.shape === "round") {
    topL = topW = Math.max(num(lid.diameter, mouthL), 0.4);
    botL = botW = cover ? Math.max(num(lid.bottomDiameter, topL), 0.4) : topL;
  } else {
    const extra = cover ? LID_DEFAULT_OVERHANG_MM : 0;
    topL = Math.max(num(lid.length, mouthL + extra), 1);
    topW = Math.max(num(lid.width, mouthW + extra), 1);
    botL = cover ? Math.max(num(lid.bottomLength, mouthL + LID_DEFAULT_OVERHANG_MM), 1) : topL;
    botW = cover ? Math.max(num(lid.bottomWidth, mouthW + LID_DEFAULT_OVERHANG_MM), 1) : topW;
    if (isRect) cornerR = Math.max(num(lid.cornerR, mouth.cornerRMm), 0);
  }

  const height = Math.max(num(lid.height, 60), cover ? 1 : 0);
  const zTop = mouth.zMm + height;
  const zBottom = cover ? mouth.zMm : zTop - LID_FLAT_THICKNESS_MM;
  const rows: ShapeDrawingRow[] = [
    { zMm: zTop, halfLengthMm: topL / 2, halfWidthMm: topW / 2, cornerRMm: cornerR },
    { zMm: zBottom, halfLengthMm: botL / 2, halfWidthMm: botW / 2, cornerRMm: cornerR },
  ];
  const rings = rows.map((r, i) => ({ zMm: r.zMm, label: ringLabel(i, rows.length), lengthMm: r.halfLengthMm * 2, widthMm: r.halfWidthMm * 2 }));
  return { ...body, rows, rings };
}

export interface DrawingBundle {
  drawing: ShapeDrawingInput;
  frameResult: SteelFrameResult | null;
  handlePaths: THREE.Vector3[][];
  handleArcView: "front" | "side";
  material: MaterialInput;
}

function roundDenseSamples(product: ProductState): Sample[] | undefined {
  if (!product.photoCurve || product.photoCurve.length < 2) return undefined;
  const source = product.photoCurveSource === "manual" ? product.photoCurve : smoothDiameters(product.photoCurve);
  const spline = buildDiameterSpline(source);
  const heightMm = Math.max(...product.photoCurve.map((p) => p.z));
  const steps = Math.max(2, Math.round(heightMm / 4));
  return Array.from({ length: steps + 1 }, (_, i): Sample => {
    const z = heightMm * (1 - i / steps);
    return [spline(z) / 2, z];
  });
}

function ovalDenseSamples(product: ProductState): OvalSample[] | undefined {
  if (!product.ovalPhotoCurve || product.ovalPhotoCurve.length < 2) return undefined;
  const lengthSpline = buildDiameterSpline(product.ovalPhotoCurve.map((p) => ({ z: p.z, diameter: p.length })));
  const widthSpline = buildDiameterSpline(product.ovalPhotoCurve.map((p) => ({ z: p.z, diameter: p.width })));
  const zs = product.ovalPhotoCurve.map((p) => p.z);
  const maxZ = Math.max(...zs);
  const minZ = Math.min(...zs);
  const steps = Math.max(2, Math.round((maxZ - minZ) / 4));
  return Array.from({ length: steps + 1 }, (_, i): OvalSample => {
    const z = maxZ - ((maxZ - minZ) * i) / steps;
    return [lengthSpline(z), widthSpline(z), z];
  });
}

function ellipseDenseSamples(product: ProductState): EllipseSample[] | undefined {
  if (!product.ellipsePhotoCurve || product.ellipsePhotoCurve.length < 2) return undefined;
  const lengthSpline = buildDiameterSpline(product.ellipsePhotoCurve.map((p) => ({ z: p.z, diameter: p.length })));
  const widthSpline = buildDiameterSpline(product.ellipsePhotoCurve.map((p) => ({ z: p.z, diameter: p.width })));
  const zs = product.ellipsePhotoCurve.map((p) => p.z);
  const maxZ = Math.max(...zs);
  const minZ = Math.min(...zs);
  const steps = Math.max(2, Math.round((maxZ - minZ) / 4));
  return Array.from({ length: steps + 1 }, (_, i): EllipseSample => {
    const z = maxZ - ((maxZ - minZ) * i) / steps;
    return [lengthSpline(z), widthSpline(z), z];
  });
}

export function buildDrawingBundle(product: ProductState, part: SheetPart = "body"): DrawingBundle | null {
  if (part === "lid" && !productHasLid(product)) return null;
  const isRect = product.shape === "square" || product.shape === "rectangle";
  const isOval = product.shape === "oval";
  const isEllipse = product.shape === "ellipse";
  const isRound = product.shape === "round";

  let frameResult: SteelFrameResult | null = null;
  let drawing: ShapeDrawingInput | null = null;
  let handlePaths: THREE.Vector3[][] = [];

  try {
    if (isRound) {
      const dense = roundDenseSamples(product);
      const result = buildRoundSolid(product.rings, product.lid, product.handle, product.scallop, dense);
      frameResult = buildSteelFrame(product.rings, product.lid, product.handle, product.frame, product.scallop, dense);
      const rows: ShapeDrawingRow[] = result.samples.map(([r, z]) => ({ zMm: z, halfLengthMm: r, halfWidthMm: r, cornerRMm: 0 }));
      const rings = result.sections.map((s, i) => ({ zMm: s.zMm, label: ringLabel(i, result.sections.length), lengthMm: s.diameterMm, widthMm: s.diameterMm }));
      drawing = {
        rows,
        rings,
        outline2D: (length: number, _width: number, _cornerR: number, segments?: number) =>
          circlePoints(length / 2, 0, segments ?? 64).map(([x, y]): [number, number] => [x, y]),
        isRound: true,
      };
      const samples = buildProfileSamples(normalizeRings(product.rings));
      handlePaths = computeHandlePaths(normalizeRings(product.rings)[0], samples, product.handle);
    } else if (isRect) {
      frameResult = buildRectSteelFrame(product.rectProfile, product.lid, product.handle, product.frame, product.rectFrame);
      const { mouth, base, horizontalRings } = product.rectProfile;
      const middle = horizontalRings.map((r) => ({ z: r.z, ...interpolateRectCorner(mouth, base, r.z) })).sort((a, b) => b.z - a.z);
      const points = [
        { z: mouth.z, length: mouth.length, width: mouth.width, cornerR: mouth.cornerR },
        ...middle,
        { z: base.z, length: base.length, width: base.width, cornerR: base.cornerR },
      ];
      const rows: ShapeDrawingRow[] = points.map((p) => ({ zMm: p.z, halfLengthMm: p.length / 2, halfWidthMm: p.width / 2, cornerRMm: p.cornerR }));
      const rings = points.map((p, i) => ({ zMm: p.z, label: ringLabel(i, points.length), lengthMm: p.length, widthMm: p.width }));
      drawing = {
        rows,
        rings,
        outline2D: (length: number, width: number, cornerR: number, segments?: number) =>
          buildRoundedRectPoints2D(length, width, cornerR, Math.max(2, Math.round((segments ?? 32) / 4))),
        isRound: false,
      };
      handlePaths = computeRectHandlePaths(product.rectProfile.mouth, product.rectProfile.base, product.handle);
    } else if (isOval) {
      const dense = ovalDenseSamples(product);
      frameResult = buildOvalSteelFrame(product.ovalProfile, product.lid, product.handle, product.frame, product.ovalFrame, DEFAULT_RECT_SEGMENTS_PER_CORNER, dense);
      const samples = dense && dense.length >= 2 ? dense : buildOvalProfileSamples(product.ovalProfile.rings);
      const rows: ShapeDrawingRow[] = samples.map(([length, width, z]) => ({ zMm: z, halfLengthMm: length / 2, halfWidthMm: width / 2, cornerRMm: 0 }));
      const sections = normalizeOvalRings(product.ovalProfile.rings);
      const rings = sections.map((s, i) => ({ zMm: s.zMm, label: ringLabel(i, sections.length), lengthMm: s.lengthMm, widthMm: s.widthMm }));
      drawing = {
        rows,
        rings,
        outline2D: (length: number, width: number, _cornerR: number, segments?: number) =>
          buildRoundedRectPoints2D(length, width, width / 2, Math.max(2, Math.round((segments ?? 32) / 4))),
        isRound: false,
      };
      handlePaths = computeOvalHandlePaths(product.ovalProfile.rings, product.handle);
    } else if (isEllipse) {
      const dense = ellipseDenseSamples(product);
      frameResult = buildEllipseSteelFrame(product.ellipseProfile, product.lid, product.handle, product.frame, product.ellipseFrame, DEFAULT_ELLIPSE_SEGMENTS, dense);
      const samples = dense && dense.length >= 2 ? dense : buildEllipseProfileSamples(product.ellipseProfile.rings);
      const rows: ShapeDrawingRow[] = samples.map(([length, width, z]) => ({ zMm: z, halfLengthMm: length / 2, halfWidthMm: width / 2, cornerRMm: 0 }));
      const sections = normalizeEllipseRings(product.ellipseProfile.rings);
      const rings = sections.map((s, i) => ({ zMm: s.zMm, label: ringLabel(i, sections.length), lengthMm: s.lengthMm, widthMm: s.widthMm }));
      drawing = {
        rows,
        rings,
        outline2D: (length: number, width: number, _cornerR: number, segments?: number) => ellipsePoints2D(length, width, segments ?? 64),
        isRound: false,
      };
      handlePaths = computeEllipseHandlePaths(product.ellipseProfile.rings, product.handle);
    }
  } catch {
    return null;
  }

  if (!drawing) return null;

  const handleArcView: "front" | "side" = isRect && product.handle.side === "length" ? "front" : "side";

  if (part === "lid") {
    return {
      drawing: buildLidDrawing(product, drawing),
      frameResult: frameTubes(frameResult, true),
      handlePaths: [],
      handleArcView: "side",
      // The body's material bands/zones are measured along the BODY's height —
      // meaningless on the lid, so it just gets the plain fill.
      material: { ...product.material, enabled: false, splits: [], bands: [] },
    };
  }
  return { drawing, frameResult: frameTubes(frameResult, false), handlePaths, handleArcView, material: product.material };
}
