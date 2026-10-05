"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildFrontViewData,
  buildIsoViewData,
  DEFAULT_ISO_ANGLE,
  type IsoAngle,
  buildSideViewData,
  buildTopViewData,
  projectPathsFront,
  projectPathsIso,
  projectPathsSide,
  projectTubesFront,
  projectTubesIso,
  projectTubesSide,
  projectTubesTop,
  rowAtZ,
  sliceIsoOutline,
  sliceOutline,
  type Polyline,
  type RingDimension,
  type ShapeDrawingInput,
  type ShapeDrawingRow,
  type WireSegment,
} from "@/lib/breakdown/geometry/drawingEngine";
import type { FrameTube } from "@/lib/breakdown/geometry/frameEngine";
import { radiusAtZ, type Sample } from "@/lib/breakdown/geometry/math";
import { DEFAULT_MATERIAL_ZONE, type HandleInput, type MaterialInput, type MaterialZoneSettings } from "@/lib/breakdown/geometry/types";

// Low-level SVG view renderers for the technical-drawing sheet (DrawingSheetA4).
// Every view is computed straight from the parametric ring/frame data (same
// source as the 3D view), not a screenshot/projection of the 3D mesh, so
// dimensions always match the input exactly. Each component renders a bare
// <svg> sized by its viewBox — the caller controls layout/sizing.
//
// Two draw modes: "solid" (the outer shape, for surface/BOM reference) and
// "frame" (the actual steel-member wireframe, for fabrication reference).

export type DrawMode = "solid" | "frame";
type Point3 = { x: number; y: number; z: number };

const STROKE = "#1a1a1a";
const FRAME_STROKE = "#6b5a3f";
const HANDLE_GUIDE_COLOR = "#5b86b8";
const BASE_FONT = 11;

// Per-dimension customization: click its line to hide it, drag its label to
// nudge it clear of neighbours, double-click its label to type a custom
// value. Keyed by a stable id (e.g. "ring-1", "height-total",
// "handle-width") scoped per view, so hiding a dim in Front doesn't affect
// Side/Top/Iso.
export interface DimSettings {
  hidden?: boolean;
  offset?: number;
  valueOverride?: string;
  // Per-dim override — set only when the user picked a color/size just for
  // THIS one (via the "Mục đang chọn" sidebar panel while it's selected).
  // Falls back to the sheet's global dimColor/fontScale when unset.
  color?: string;
  fontSize?: number;
}
export type DimSettingsMap = Record<string, DimSettings>;
const EMPTY_DIM: DimSettings = {};

// A built-in dim's actual rendered color/size — the sheet-wide default
// unless this ONE dim has its own override set (via the "Mục đang chọn"
// panel while it's selected).
function resolveDimStyle(settings: DimSettings, color: string, fontSize: number) {
  return { color: settings.color ?? color, fontSize: settings.fontSize ?? fontSize };
}

// Threaded onto every built-in dim-rendering function alongside dimSettings
// — clicking a dim's line or label SELECTS it (Delete removes it, the
// sidebar panel can give it its own color/size) instead of hiding it
// outright the moment it's clicked.
interface DimSelectionProps {
  selectedId?: string | null;
  onSelectDim?: (id: string) => void;
}

function ArrowDefs({ color }: { color: string }) {
  return (
    <defs>
      <marker id="arrowStart" markerWidth={8} markerHeight={8} refX={7} refY={4} orient="auto">
        <path d="M8,1 L1,4 L8,7 Z" fill={color} />
      </marker>
      <marker id="arrowEnd" markerWidth={8} markerHeight={8} refX={1} refY={4} orient="auto">
        <path d="M0,1 L7,4 L0,7 Z" fill={color} />
      </marker>
    </defs>
  );
}

function svgPoint(svg: SVGSVGElement, clientX: number, clientY: number): [number, number] {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return [0, 0];
  const p = pt.matrixTransform(ctm.inverse());
  return [p.x, p.y];
}

function useDimDrag(axis: "x" | "y", currentOffset: number, onChange: (v: number) => void) {
  const dragRef = useRef<{ startSvg: number; startOffset: number } | null>(null);
  function onPointerDown(e: React.PointerEvent<SVGGElement>) {
    e.stopPropagation();
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const p = svgPoint(svg, e.clientX, e.clientY);
    dragRef.current = { startSvg: axis === "x" ? p[0] : p[1], startOffset: currentOffset };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<SVGGElement>) {
    if (!dragRef.current) return;
    e.stopPropagation();
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const p = svgPoint(svg, e.clientX, e.clientY);
    const cur = axis === "x" ? p[0] : p[1];
    onChange(dragRef.current.startOffset + (cur - dragRef.current.startSvg));
  }
  function onPointerUp(e: React.PointerEvent<SVGGElement>) {
    e.stopPropagation();
    dragRef.current = null;
  }
  return { onPointerDown, onPointerMove, onPointerUp };
}

// The dimension label: drag it (its own natural axis) to reposition,
// double-click it to type a custom value instead of the computed one.
// Non-interactive when no `editable` group is passed (used for plain
// captions elsewhere, e.g. note text isn't DimText at all).
function DimText({
  x,
  y,
  text,
  fontSize,
  color,
  anchor = "middle",
  editable,
  selected = false,
  onSelect,
}: {
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  anchor?: "start" | "middle" | "end";
  editable?: { axis: "x" | "y"; offset: number; onOffsetChange: (v: number) => void; onCommitValue: (v: string | undefined) => void };
  // Highlighted (visible background) when this is the one item selected via
  // the sidebar's "Mục đang chọn" panel — lets the user see what Delete/a
  // per-item color-or-size change would apply to. Clicking the number
  // selects it too, same as clicking its dimension line.
  selected?: boolean;
  onSelect?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const drag = useDimDrag(editable?.axis ?? "y", editable?.offset ?? 0, editable?.onOffsetChange ?? (() => {}));
  const w = text.length * fontSize * 0.62 + 6;

  if (editing && editable) {
    const boxW = Math.max(w, 56);
    return (
      <foreignObject x={x - boxW / 2} y={y - fontSize * 1.3} width={boxW} height={fontSize * 2.2}>
        <input
          autoFocus
          defaultValue={text}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => {
            editable.onCommitValue(e.currentTarget.value.trim() || undefined);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
            if (e.key === "Escape") setEditing(false);
          }}
          style={{
            fontSize: `${fontSize}px`,
            width: "100%",
            boxSizing: "border-box",
            textAlign: "center",
            border: `1px solid ${color}`,
            borderRadius: 2,
            fontFamily: "var(--font-manrope), sans-serif",
          }}
        />
      </foreignObject>
    );
  }

  return (
    <g
      onPointerDown={editable ? drag.onPointerDown : undefined}
      onPointerMove={editable ? drag.onPointerMove : undefined}
      onPointerUp={editable ? drag.onPointerUp : undefined}
      onClick={
        onSelect
          ? (e) => {
              e.stopPropagation();
              onSelect();
            }
          : undefined
      }
      onDoubleClick={
        editable
          ? (e) => {
              e.stopPropagation();
              setEditing(true);
            }
          : undefined
      }
      style={editable ? { cursor: editable.axis === "x" ? "ew-resize" : "ns-resize" } : undefined}
    >
      {/* Invisible unless selected — keeps the same generous click/drag hit
          area as always, just without painting a box over the drawing
          underneath it except as a selection highlight. */}
      <rect
        x={x - (anchor === "middle" ? w / 2 : anchor === "end" ? w : 0) - 3}
        y={y - fontSize * 0.72 - 2}
        width={w + 6}
        height={fontSize * 1.1 + 4}
        rx={3}
        fill={selected ? "#fff3cd" : "transparent"}
        stroke={selected ? "#e8a33d" : "none"}
        strokeWidth={selected ? 1 : 0}
      />
      <text x={x} y={y} fontSize={fontSize} textAnchor={anchor} fill={color} fontWeight={600} fontFamily="Manrope, sans-serif">
        {text}
      </text>
    </g>
  );
}

function DiameterDim({
  id,
  ring,
  toY,
  fontSize,
  color,
  dimSettings,
  onDimSettingsChange,
  defaultOffset = 0,
  isRound = true,
  selectedId,
  onSelectDim,
}: {
  id: string;
  ring: RingDimension;
  toY: (z: number) => number;
  fontSize: number;
  color: string;
  dimSettings: DimSettingsMap;
  onDimSettingsChange: (id: string, next: DimSettings) => void;
  // Nudges the mouth/base rings' dim line clear of the silhouette edge it'd
  // otherwise sit exactly on top of (easy to mistake for part of the
  // outline) — only applied when the user hasn't already dragged this
  // specific dim to their own position.
  defaultOffset?: number;
  // Round's Ø prefix only makes sense for an actual circular section — a
  // rect/oval/ellipse ring shows a plain number (its length on Front, its
  // width on Side), same as any other linear dimension.
  isRound?: boolean;
} & DimSelectionProps) {
  const settings = dimSettings[id] ?? EMPTY_DIM;
  if (settings.hidden) return null;
  const offset = settings.offset ?? defaultOffset;
  const y = toY(ring.zMm) + offset;
  const text = settings.valueOverride ?? (isRound ? `Ø${Math.round(ring.diameterMm)}` : `${Math.round(ring.diameterMm)}`);
  const ringY = toY(ring.zMm);
  const { color: itemColor, fontSize: itemFontSize } = resolveDimStyle(settings, color, fontSize);
  const select = () => onSelectDim?.(id);
  return (
    <g>
      {/* Extension/witness lines: once offset pulls the dim line off the
          ring itself (the mouth/base default, or anywhere the user drags
          one to), it needs a visible line back to the actual edge it's
          measuring — same convention as HeightChain's own witness lines —
          otherwise the arrowed line just floats near the shape with
          nothing tying it to the ring it belongs to. */}
      {offset !== 0 && (
        <>
          <line x1={-ring.radiusMm} y1={ringY} x2={-ring.radiusMm} y2={y} stroke="#c7c7c7" strokeWidth={0.6} />
          <line x1={ring.radiusMm} y1={ringY} x2={ring.radiusMm} y2={y} stroke="#c7c7c7" strokeWidth={0.6} />
        </>
      )}
      <line
        x1={-ring.radiusMm}
        y1={y}
        x2={ring.radiusMm}
        y2={y}
        stroke={itemColor}
        strokeWidth={selectedId === id ? 1.6 : 0.9}
        markerStart="url(#arrowStart)"
        markerEnd="url(#arrowEnd)"
        style={{ cursor: "pointer" }}
        onClick={(e) => {
          e.stopPropagation();
          select();
        }}
      />
      <DimText
        x={0}
        y={y - 4}
        text={text}
        fontSize={itemFontSize}
        color={itemColor}
        selected={selectedId === id}
        onSelect={select}
        editable={{
          axis: "y",
          offset,
          onOffsetChange: (v) => onDimSettingsChange(id, { ...settings, offset: v }),
          onCommitValue: (v) => onDimSettingsChange(id, { ...settings, valueOverride: v }),
        }}
      />
    </g>
  );
}

// A stacked height-dimension chain on one side: one segment per pair of
// neighbouring rings, plus witness lines running from each ring's own
// silhouette edge out to the chain, plus one overall-total chain further out.
function HeightChain({
  rings,
  toY,
  chainX,
  maxRadius,
  fontSize,
  color,
  idPrefix,
  dimSettings,
  onDimSettingsChange,
  selectedId,
  onSelectDim,
}: {
  rings: RingDimension[];
  toY: (z: number) => number;
  chainX: number;
  maxRadius: number;
  fontSize: number;
  color: string;
  idPrefix: string;
  dimSettings: DimSettingsMap;
  onDimSettingsChange: (id: string, next: DimSettings) => void;
} & DimSelectionProps) {
  const outerX = chainX - Math.max(maxRadius * 0.22, 30);
  const y1 = toY(rings[0].zMm);
  const y2 = toY(rings[rings.length - 1].zMm);
  const totalId = `${idPrefix}-total`;
  const totalSettings = dimSettings[totalId] ?? EMPTY_DIM;
  const totalOffset = totalSettings.offset ?? 0;
  const ox = outerX + totalOffset;
  const total = Math.round(Math.abs(rings[0].zMm - rings[rings.length - 1].zMm));

  return (
    <g>
      {rings.map((r, i) => (
        <line key={`witness-${i}`} x1={-r.radiusMm} y1={toY(r.zMm)} x2={chainX} y2={toY(r.zMm)} stroke="#c7c7c7" strokeWidth={0.6} />
      ))}
      {rings.slice(0, -1).map((r, i) => {
        const id = `${idPrefix}-${i}`;
        const settings = dimSettings[id] ?? EMPTY_DIM;
        if (settings.hidden) return null;
        const offset = settings.offset ?? 0;
        const cx = chainX + offset;
        const next = rings[i + 1];
        const ya = toY(r.zMm);
        const yb = toY(next.zMm);
        const mid = (ya + yb) / 2;
        const height = Math.round(Math.abs(r.zMm - next.zMm));
        const text = settings.valueOverride ?? `${height}`;
        const { color: itemColor, fontSize: itemFontSize } = resolveDimStyle(settings, color, fontSize);
        const select = () => onSelectDim?.(id);
        return (
          <g key={`seg-${i}`}>
            {offset !== 0 && <line x1={chainX} y1={mid} x2={cx} y2={mid} stroke="#c7c7c7" strokeWidth={0.5} strokeDasharray="2 2" />}
            <line
              x1={cx}
              y1={ya}
              x2={cx}
              y2={yb}
              stroke={itemColor}
              strokeWidth={selectedId === id ? 1.6 : 0.9}
              markerStart="url(#arrowStart)"
              markerEnd="url(#arrowEnd)"
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                select();
              }}
            />
            <DimText
              x={cx - 6}
              y={mid + fontSize * 0.35}
              text={text}
              fontSize={itemFontSize}
              color={itemColor}
              anchor="end"
              selected={selectedId === id}
              onSelect={select}
              editable={{
                axis: "x",
                offset,
                onOffsetChange: (v) => onDimSettingsChange(id, { ...settings, offset: v }),
                onCommitValue: (v) => onDimSettingsChange(id, { ...settings, valueOverride: v }),
              }}
            />
          </g>
        );
      })}
      {rings.length > 2 &&
        !totalSettings.hidden &&
        (() => {
          const { color: itemColor, fontSize: itemFontSize } = resolveDimStyle(totalSettings, color, fontSize);
          const select = () => onSelectDim?.(totalId);
          return (
            <g>
              <line x1={-rings[0].radiusMm} y1={y1} x2={ox} y2={y1} stroke="#c7c7c7" strokeWidth={0.6} />
              <line x1={-rings[rings.length - 1].radiusMm} y1={y2} x2={ox} y2={y2} stroke="#c7c7c7" strokeWidth={0.6} />
              <line
                x1={ox}
                y1={y1}
                x2={ox}
                y2={y2}
                stroke={itemColor}
                strokeWidth={selectedId === totalId ? 1.6 : 0.9}
                markerStart="url(#arrowStart)"
                markerEnd="url(#arrowEnd)"
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  select();
                }}
              />
              <DimText
                x={ox - 6}
                y={(y1 + y2) / 2 + fontSize * 0.35}
                text={totalSettings.valueOverride ?? `${total}`}
                fontSize={itemFontSize}
                color={itemColor}
                anchor="end"
                selected={selectedId === totalId}
                onSelect={select}
                editable={{
                  axis: "x",
                  offset: totalOffset,
                  onOffsetChange: (v) => onDimSettingsChange(totalId, { ...totalSettings, offset: v }),
                  onCommitValue: (v) => onDimSettingsChange(totalId, { ...totalSettings, valueOverride: v }),
                }}
              />
            </g>
          );
        })()}
    </g>
  );
}

// Real arrow+witness-line dimensions for the handle's own width/height —
// only meaningful on the Side view, where a standing handle's true arc
// shape is visible (see the projectTubesSide/projectPathsSide comment for
// why Front collapses it to a sliver instead).
function HandleDims({
  handle,
  mouthZ,
  toY,
  fontSize,
  color,
  dimSettings,
  onDimSettingsChange,
  selectedId,
  onSelectDim,
}: {
  handle: HandleInput;
  mouthZ: number;
  toY: (z: number) => number;
  fontSize: number;
  color: string;
  dimSettings: DimSettingsMap;
  onDimSettingsChange: (id: string, next: DimSettings) => void;
} & DimSelectionProps) {
  const halfW = handle.width / 2;
  const apexZ = mouthZ + handle.height;
  const yApex = toY(apexZ);
  const yBase = toY(mouthZ);

  const wId = "handle-width";
  const hId = "handle-height";
  const wSettings = dimSettings[wId] ?? EMPTY_DIM;
  const hSettings = dimSettings[hId] ?? EMPTY_DIM;
  const wOffset = wSettings.offset ?? 0;
  const hOffset = hSettings.offset ?? 0;
  const dimY = yApex - 14 + wOffset;
  const sideX = halfW + 18 + hOffset;
  const w = resolveDimStyle(wSettings, color, fontSize);
  const h = resolveDimStyle(hSettings, color, fontSize);
  const selectW = () => onSelectDim?.(wId);
  const selectH = () => onSelectDim?.(hId);

  return (
    <g>
      {!wSettings.hidden && (
        <g>
          <line x1={-halfW} y1={yApex} x2={-halfW} y2={dimY} stroke="#c7c7c7" strokeWidth={0.6} />
          <line x1={halfW} y1={yApex} x2={halfW} y2={dimY} stroke="#c7c7c7" strokeWidth={0.6} />
          <line
            x1={-halfW}
            y1={dimY}
            x2={halfW}
            y2={dimY}
            stroke={w.color}
            strokeWidth={selectedId === wId ? 1.6 : 0.9}
            markerStart="url(#arrowStart)"
            markerEnd="url(#arrowEnd)"
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              selectW();
            }}
          />
          <DimText
            x={0}
            y={dimY - 4}
            text={wSettings.valueOverride ?? `Quai ${Math.round(handle.width)}`}
            fontSize={w.fontSize}
            color={w.color}
            selected={selectedId === wId}
            onSelect={selectW}
            editable={{
              axis: "y",
              offset: wOffset,
              onOffsetChange: (v) => onDimSettingsChange(wId, { ...wSettings, offset: v }),
              onCommitValue: (v) => onDimSettingsChange(wId, { ...wSettings, valueOverride: v }),
            }}
          />
        </g>
      )}
      {!hSettings.hidden && (
        <g>
          <line x1={halfW} y1={yBase} x2={sideX} y2={yBase} stroke="#c7c7c7" strokeWidth={0.6} />
          <line x1={halfW} y1={yApex} x2={sideX} y2={yApex} stroke="#c7c7c7" strokeWidth={0.6} />
          <line
            x1={sideX}
            y1={yBase}
            x2={sideX}
            y2={yApex}
            stroke={h.color}
            strokeWidth={selectedId === hId ? 1.6 : 0.9}
            markerStart="url(#arrowStart)"
            markerEnd="url(#arrowEnd)"
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              selectH();
            }}
          />
          <DimText
            x={sideX + 6}
            y={(yBase + yApex) / 2 + fontSize * 0.35}
            text={hSettings.valueOverride ?? `${Math.round(handle.height)}`}
            fontSize={h.fontSize}
            color={h.color}
            anchor="start"
            selected={selectedId === hId}
            onSelect={selectH}
            editable={{
              axis: "x",
              offset: hOffset,
              onOffsetChange: (v) => onDimSettingsChange(hId, { ...hSettings, offset: v }),
              onCommitValue: (v) => onDimSettingsChange(hId, { ...hSettings, valueOverride: v }),
            }}
          />
        </g>
      )}
    </g>
  );
}

// "Khoét thân" handle: a rectangular cutout in the wall, offset down from
// the mouth. Mirrors handlePaths.ts's own computeCutoutPaths conventions
// exactly — zUpper = mouthZ - cutoutOffset, zLower = zUpper - cutoutDepth,
// halfW = cutoutWidth / 2 in the same local-chord X the body outline uses —
// so these dims land directly on the cutout box drawn elsewhere, no
// separate geometry pass needed.
function CutoutHandleDims({
  handle,
  mouthZ,
  toY,
  fontSize,
  color,
  dimSettings,
  onDimSettingsChange,
  outerX,
  selectedId,
  onSelectDim,
}: {
  handle: HandleInput;
  mouthZ: number;
  toY: (z: number) => number;
  fontSize: number;
  color: string;
  dimSettings: DimSettingsMap;
  onDimSettingsChange: (id: string, next: DimSettings) => void;
  // How far out (past the body's own silhouette) the height-dim chain and
  // the width dim sit — both read clearly as "outside the product" rather
  // than overlapping the wall the cutout sits in. Falls back to a value
  // relative to the cutout itself when the caller doesn't have the body's
  // own extent handy.
  outerX?: number;
} & DimSelectionProps) {
  const halfW = handle.cutoutWidth / 2;
  const zUpper = mouthZ - Math.max(handle.cutoutOffset, 0);
  const zLower = zUpper - Math.max(handle.cutoutDepth, 5);
  const yMouth = toY(mouthZ);
  const yUpper = toY(zUpper);
  const yLower = toY(zLower);

  const wId = "cutout-width";
  const wSettings = dimSettings[wId] ?? EMPTY_DIM;
  const wOffset = wSettings.offset ?? 0;
  // Pinned to the mouth line, not the cutout's own top edge — reads as
  // clearly outside the body regardless of how far cutoutOffset pushes the
  // cutout down the wall, nested just inside the overall mouth-width dim.
  const wy = yMouth - 14 + wOffset;

  const sideX = outerX ?? halfW + 18;
  const offsetId = "cutout-offset";
  const depthId = "cutout-depth";
  const offsetSettings = dimSettings[offsetId] ?? EMPTY_DIM;
  const depthSettings = dimSettings[depthId] ?? EMPTY_DIM;
  const offsetX = sideX + (offsetSettings.offset ?? 0);
  const depthX = sideX + (depthSettings.offset ?? 0);
  const w = resolveDimStyle(wSettings, color, fontSize);
  const o = resolveDimStyle(offsetSettings, color, fontSize);
  const d = resolveDimStyle(depthSettings, color, fontSize);
  const selectW = () => onSelectDim?.(wId);
  const selectO = () => onSelectDim?.(offsetId);
  const selectD = () => onSelectDim?.(depthId);

  return (
    <g>
      {!wSettings.hidden && (
        <g>
          <line x1={-halfW} y1={yUpper} x2={-halfW} y2={wy} stroke="#c7c7c7" strokeWidth={0.6} />
          <line x1={halfW} y1={yUpper} x2={halfW} y2={wy} stroke="#c7c7c7" strokeWidth={0.6} />
          <line
            x1={-halfW}
            y1={wy}
            x2={halfW}
            y2={wy}
            stroke={w.color}
            strokeWidth={selectedId === wId ? 1.6 : 0.9}
            markerStart="url(#arrowStart)"
            markerEnd="url(#arrowEnd)"
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              selectW();
            }}
          />
          <DimText
            x={0}
            y={wy - 4}
            text={wSettings.valueOverride ?? `${Math.round(handle.cutoutWidth)}`}
            fontSize={w.fontSize}
            color={w.color}
            selected={selectedId === wId}
            onSelect={selectW}
            editable={{
              axis: "y",
              offset: wOffset,
              onOffsetChange: (v) => onDimSettingsChange(wId, { ...wSettings, offset: v }),
              onCommitValue: (v) => onDimSettingsChange(wId, { ...wSettings, valueOverride: v }),
            }}
          />
        </g>
      )}
      {handle.cutoutOffset > 0 && !offsetSettings.hidden && (
        <g>
          <line x1={halfW} y1={yMouth} x2={offsetX} y2={yMouth} stroke="#c7c7c7" strokeWidth={0.6} />
          <line x1={halfW} y1={yUpper} x2={offsetX} y2={yUpper} stroke="#c7c7c7" strokeWidth={0.6} />
          <line
            x1={offsetX}
            y1={yMouth}
            x2={offsetX}
            y2={yUpper}
            stroke={o.color}
            strokeWidth={selectedId === offsetId ? 1.6 : 0.9}
            markerStart="url(#arrowStart)"
            markerEnd="url(#arrowEnd)"
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              selectO();
            }}
          />
          <DimText
            x={offsetX + 6}
            y={(yMouth + yUpper) / 2 + fontSize * 0.35}
            text={offsetSettings.valueOverride ?? `${Math.round(handle.cutoutOffset)}`}
            fontSize={o.fontSize}
            color={o.color}
            anchor="start"
            selected={selectedId === offsetId}
            onSelect={selectO}
            editable={{
              axis: "x",
              offset: offsetSettings.offset ?? 0,
              onOffsetChange: (v) => onDimSettingsChange(offsetId, { ...offsetSettings, offset: v }),
              onCommitValue: (v) => onDimSettingsChange(offsetId, { ...offsetSettings, valueOverride: v }),
            }}
          />
        </g>
      )}
      {!depthSettings.hidden && (
        <g>
          <line x1={halfW} y1={yUpper} x2={depthX} y2={yUpper} stroke="#c7c7c7" strokeWidth={0.6} />
          <line x1={halfW} y1={yLower} x2={depthX} y2={yLower} stroke="#c7c7c7" strokeWidth={0.6} />
          <line
            x1={depthX}
            y1={yUpper}
            x2={depthX}
            y2={yLower}
            stroke={d.color}
            strokeWidth={selectedId === depthId ? 1.6 : 0.9}
            markerStart="url(#arrowStart)"
            markerEnd="url(#arrowEnd)"
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              selectD();
            }}
          />
          <DimText
            x={depthX + 6}
            y={(yUpper + yLower) / 2 + fontSize * 0.35}
            text={depthSettings.valueOverride ?? `${Math.round(handle.cutoutDepth)}`}
            fontSize={d.fontSize}
            color={d.color}
            anchor="start"
            selected={selectedId === depthId}
            onSelect={selectD}
            editable={{
              axis: "x",
              offset: depthSettings.offset ?? 0,
              onOffsetChange: (v) => onDimSettingsChange(depthId, { ...depthSettings, offset: v }),
              onCommitValue: (v) => onDimSettingsChange(depthId, { ...depthSettings, valueOverride: v }),
            }}
          />
        </g>
      )}
    </g>
  );
}

function WireframePaths({ polylines, strokeWidth = 0.7, color = FRAME_STROKE }: { polylines: Polyline[]; strokeWidth?: number; color?: string }) {
  return (
    <g>
      {polylines.map((pts, i) => (
        <path
          key={i}
          d={pts.map(([x, y], j) => `${j === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}

// Each steel member drawn at its real FI (diameter) as the stroke width —
// a "double-line" pipe convention, not an abstract centerline — so the
// Khung sắt wireframe reads as actual tube stock, matching real fabrication.
// Width (svg user-space mm, per side) of the dark "profile" line around the
// whole frame — SketchUp's silhouette/profile edge. Drawn as a wider dark
// stroke under every tube (all outlines first, then all tube fills on top),
// so only the OUTER boundary of the combined frame survives: tubes crossing
// or touching each other merge into one shape with a single clean outline,
// instead of every tube being boxed in separately.
const FRAME_PROFILE_WIDTH = 0.75;
const FRAME_PROFILE_COLOR = "#1a1a1a";

function TubeWireframe({ segments, color = FRAME_STROKE }: { segments: WireSegment[]; color?: string }) {
  const pathData = (pts: [number, number][]) => pts.map(([x, y], j) => `${j === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  return (
    <g>
      <g>
        {segments.map((seg, i) => (
          <path
            key={`profile-${i}`}
            d={pathData(seg.points)}
            fill="none"
            stroke={FRAME_PROFILE_COLOR}
            strokeWidth={Math.max(seg.diameterMm, 0.5) + FRAME_PROFILE_WIDTH * 2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>
      <g>
        {segments.map((seg, i) => (
          <path
            key={i}
            d={pathData(seg.points)}
            fill="none"
            stroke={color}
            strokeWidth={Math.max(seg.diameterMm, 0.5)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>
    </g>
  );
}

function polylinesExtentX(polylines: Polyline[]): number {
  return polylines.reduce((m, pts) => pts.reduce((mm, [x]) => Math.max(mm, Math.abs(x)), m), 0);
}

function wireSegmentsExtentX(segments: WireSegment[]): number {
  return segments.reduce((m, seg) => seg.points.reduce((mm, [x]) => Math.max(mm, Math.abs(x) + seg.diameterMm / 2), m), 0);
}

// Leader-line notes, SketchUp LayOut style: click a point on the drawing,
// drag out an arrow, type a note at the end of it. Coordinates are in the
// SAME svg user-space (mm) as everything else in that view, so they stay
// pinned to the geometry regardless of how the sheet is scaled/printed.
export interface Note {
  id: string;
  anchor: [number, number];
  label: [number, number];
  text: string;
  // Per-note override, set via the "Mục đang chọn" sidebar panel while this
  // note is selected — falls back to the sheet's global dimColor/fontScale.
  color?: string;
  fontSize?: number;
}

function useNoteDraft(onFinish: (anchor: [number, number], label: [number, number]) => void) {
  const [draft, setDraft] = useState<{ anchor: [number, number]; label: [number, number] } | null>(null);
  const draggingRef = useRef(false);

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    // Clicking into an existing note's text input/delete button — or any
    // dimension's own drag/hide handling — must reach that element
    // normally, not be hijacked into starting a new note drag.
    if ((e.target as Element).closest("foreignObject")) return;
    const svg = e.currentTarget;
    const p = svgPoint(svg, e.clientX, e.clientY);
    draggingRef.current = true;
    setDraft({ anchor: p, label: p });
    svg.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!draggingRef.current) return;
    const p = svgPoint(e.currentTarget, e.clientX, e.clientY);
    setDraft((d) => (d ? { anchor: d.anchor, label: p } : d));
  }
  function onPointerUp() {
    if (!draggingRef.current || !draft) return;
    draggingRef.current = false;
    const dist = Math.hypot(draft.label[0] - draft.anchor[0], draft.label[1] - draft.anchor[1]);
    if (dist > 4) onFinish(draft.anchor, draft.label);
    setDraft(null);
  }

  return { draft, onPointerDown, onPointerMove, onPointerUp };
}

function NoteItem({
  note,
  fontSize,
  color,
  onChange,
  onDelete,
  selected = false,
  onSelect,
}: {
  note: Note;
  fontSize: number;
  color: string;
  onChange: (text: string) => void;
  onDelete: () => void;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const itemColor = note.color ?? color;
  const itemFontSize = note.fontSize ?? fontSize;
  // Sized generously — foreignObject clips its content to exactly width×height
  // (in the SAME svg user-space units as everything else here), so an
  // undersized box silently clips/shrinks the clickable input underneath it.
  const inputW = Math.max(note.text.length * itemFontSize * 0.62 + 20, 110);
  const boxW = inputW + 26;
  const boxH = itemFontSize * 2.6;
  return (
    <g>
      <line
        x1={note.anchor[0]}
        y1={note.anchor[1]}
        x2={note.label[0]}
        y2={note.label[1]}
        stroke={itemColor}
        strokeWidth={selected ? 1.6 : 0.8}
        markerStart="url(#arrowStart)"
        style={{ cursor: onSelect ? "pointer" : undefined }}
        onClick={
          onSelect
            ? (e) => {
                e.stopPropagation();
                onSelect();
              }
            : undefined
        }
      />
      <foreignObject x={note.label[0]} y={note.label[1] - boxH / 2} width={boxW} height={boxH} style={{ overflow: "visible" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            boxShadow: selected ? "0 0 0 2px #e8a33d" : "none",
            borderRadius: 3,
          }}
        >
          <input
            value={note.text}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onSelect}
            placeholder="Ghi chú…"
            style={{
              fontSize: `${itemFontSize}px`,
              width: `${inputW}px`,
              boxSizing: "border-box",
              border: "none",
              outline: "none",
              borderRadius: 2,
              background: "transparent",
              padding: "2px 4px",
              fontFamily: "var(--font-manrope), sans-serif",
              color: itemColor,
            }}
          />
          <button
            type="button"
            onClick={onDelete}
            title="Xóa ghi chú"
            style={{
              fontSize: `${itemFontSize + 2}px`,
              color: "#b3432f",
              background: "none",
              border: "none",
              cursor: "pointer",
              lineHeight: 1,
              padding: 0,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      </foreignObject>
    </g>
  );
}

function useNoteLayer({
  notes,
  onNotesChange,
  noteMode,
  fontSize,
  color,
  selectedId,
  onSelectDim,
}: {
  notes: Note[];
  onNotesChange: (notes: Note[]) => void;
  noteMode: boolean;
  fontSize: number;
  color: string;
} & DimSelectionProps) {
  const { draft, onPointerDown, onPointerMove, onPointerUp } = useNoteDraft((anchor, label) => {
    onNotesChange([...notes, { id: `n${Date.now()}${Math.random().toString(36).slice(2, 6)}`, anchor, label, text: "" }]);
  });

  return {
    handlers: noteMode ? { onPointerDown, onPointerMove, onPointerUp } : {},
    layer: (
      <g>
        {draft && <line x1={draft.anchor[0]} y1={draft.anchor[1]} x2={draft.label[0]} y2={draft.label[1]} stroke={color} strokeWidth={0.8} strokeDasharray="3 2" />}
        {notes.map((n) => (
          <NoteItem
            key={n.id}
            note={n}
            fontSize={fontSize}
            color={color}
            onChange={(text) => onNotesChange(notes.map((x) => (x.id === n.id ? { ...x, text } : x)))}
            onDelete={() => onNotesChange(notes.filter((x) => x.id !== n.id))}
            selected={selectedId === n.id}
            onSelect={() => onSelectDim?.(n.id)}
          />
        ))}
      </g>
    ),
  };
}

// Free-standing text box — unlike a Note (above), it has no leader line
// pointing at a specific feature: just a plain draggable, multi-line box for
// general remarks (title callouts, processing notes, …) placed anywhere on
// the sheet. Dropped with a single click (no drag-to-aim needed) wherever
// textBoxMode is active, then repositioned later via its own grip bar.
export interface TextBoxItem {
  id: string;
  pos: [number, number];
  text: string;
  // Explicit size once the user has dragged the textarea's own native
  // resize corner at least once — undefined falls back to TEXT_BOX_WIDTH /
  // an auto height for the current line count (a freshly dropped box).
  w?: number;
  h?: number;
  // Per-box override, set via the "Mục đang chọn" sidebar panel while this
  // box is selected — falls back to the sheet's global dimColor/fontScale.
  color?: string;
  fontSize?: number;
}

function useTextBoxDrag(pos: [number, number], onChange: (pos: [number, number]) => void) {
  const dragRef = useRef<{ startSvg: [number, number]; startPos: [number, number] } | null>(null);
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    const svg = (e.currentTarget.closest("svg") as SVGSVGElement) ?? null;
    if (!svg) return;
    const p = svgPoint(svg, e.clientX, e.clientY);
    dragRef.current = { startSvg: p, startPos: pos };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    e.stopPropagation();
    const svg = (e.currentTarget.closest("svg") as SVGSVGElement) ?? null;
    if (!svg) return;
    const p = svgPoint(svg, e.clientX, e.clientY);
    onChange([dragRef.current.startPos[0] + (p[0] - dragRef.current.startSvg[0]), dragRef.current.startPos[1] + (p[1] - dragRef.current.startSvg[1])]);
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    dragRef.current = null;
  }
  return { onPointerDown, onPointerMove, onPointerUp };
}

const TEXT_BOX_WIDTH = 170;
// Small overlay strip reserved above the textarea for the drag handle/×,
// only ever rendered while selected — otherwise the box is nothing but
// plain text, no border or fill, at the content's own natural position.
const TEXT_BOX_HANDLE_H = 16;

function TextBoxItemView({
  box,
  fontSize,
  color,
  onChange,
  onMove,
  onResize,
  onDelete,
  selected = false,
  onSelect,
  autoFocus = false,
}: {
  box: TextBoxItem;
  fontSize: number;
  color: string;
  onChange: (text: string) => void;
  onMove: (pos: [number, number]) => void;
  onResize: (w: number, h: number) => void;
  onDelete: () => void;
  selected?: boolean;
  onSelect?: () => void;
  // Only meaningful at mount — focuses a box the instant it's dropped so the
  // user can start typing with no extra click, same gesture as placing it.
  autoFocus?: boolean;
}) {
  const drag = useTextBoxDrag(box.pos, onMove);
  const itemColor = box.color ?? color;
  const itemFontSize = box.fontSize ?? fontSize;
  const lines = Math.max(2, box.text.split("\n").length);
  const w = box.w ?? TEXT_BOX_WIDTH;
  const h = box.h ?? Math.max(itemFontSize * 1.4 * lines + 6, itemFontSize * 2.8);

  // The textarea's OWN native resize corner is the "kéo to nhỏ" handle —
  // simplest possible drag-to-resize, no custom hit-testing needed. It just
  // changes the element's DOM size directly, so a ResizeObserver is what
  // feeds that back into box.w/h (otherwise the next render's controlled
  // width/height would snap it right back). `contentRect` here is already
  // in the foreignObject's own local layout units — the SAME units `width`/
  // `height` below are set in — because ResizeObserver reports pre-paint
  // LAYOUT size, not the post-viewBox visual size (unlike client coords,
  // which DO need the getScreenCTM conversion svgPoint uses elsewhere); do
  // not "fix" this by adding one, it only turns a stable loop into an
  // exponentially growing one. ResizeObserver also always fires once
  // immediately on observe() with the CURRENT size — ignored here, both
  // because it's not a user resize and because a fresh observer gets
  // attached on every render (onResize is a new closure each time), so
  // treating that first callback as real would fight the auto-size formula
  // above on every keystroke.
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    let first = true;
    const ro = new ResizeObserver((entries) => {
      if (first) {
        first = false;
        return;
      }
      const { width, height } = entries[0].contentRect;
      onResize(width, height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [onResize]);

  return (
    <foreignObject
      x={box.pos[0]}
      y={box.pos[1] - (selected ? TEXT_BOX_HANDLE_H : 0)}
      width={w + 4}
      height={h + (selected ? TEXT_BOX_HANDLE_H : 0) + 4}
      style={{ overflow: "visible" }}
    >
      <div style={{ position: "relative", width: w + 4, height: h + (selected ? TEXT_BOX_HANDLE_H : 0) + 4 }}>
        {selected && (
          <div
            onPointerDown={drag.onPointerDown}
            onPointerMove={drag.onPointerMove}
            onPointerUp={drag.onPointerUp}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: TEXT_BOX_HANDLE_H,
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "0 3px",
              cursor: "move",
              touchAction: "none",
              background: "#fff3cd",
              border: "1px solid #e8a33d",
              borderRadius: 2,
            }}
          >
            <span style={{ fontSize: 9, color: "#8a6d1a", lineHeight: 1 }}>⠿</span>
            <button
              type="button"
              onClick={onDelete}
              title="Xóa text box"
              style={{ fontSize: 11, color: "#b3432f", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={box.text}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onSelect}
          autoFocus={autoFocus}
          placeholder="Nhập chữ…"
          style={{
            position: "absolute",
            top: selected ? TEXT_BOX_HANDLE_H : 0,
            left: 0,
            width: w,
            height: h,
            border: selected ? "1px dashed #e8a33d" : "none",
            outline: "none",
            resize: "both",
            overflow: "auto",
            fontSize: `${itemFontSize}px`,
            fontFamily: "var(--font-manrope), sans-serif",
            color: itemColor,
            background: "transparent",
            padding: 1,
            boxSizing: "border-box",
          }}
        />
      </div>
    </foreignObject>
  );
}

function useTextBoxLayer({
  textBoxes,
  onTextBoxesChange,
  textBoxMode,
  fontSize,
  color,
  selectedId,
  onSelectDim,
  onPlaced,
}: {
  textBoxes: TextBoxItem[];
  onTextBoxesChange: (next: TextBoxItem[]) => void;
  textBoxMode: boolean;
  fontSize: number;
  color: string;
  // Called right after a box is dropped — the sheet uses this to turn
  // textBoxMode back off, so clicking elsewhere afterward (to finish typing
  // and move on) just deselects instead of dropping ANOTHER box. Placing a
  // second one is then a deliberate re-click of "Chèn text box".
  onPlaced?: () => void;
} & DimSelectionProps) {
  const [justPlacedId, setJustPlacedId] = useState<string | null>(null);

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if ((e.target as Element).closest("foreignObject")) return;
    const svg = e.currentTarget;
    const p = svgPoint(svg, e.clientX, e.clientY);
    const id = `tb${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    onTextBoxesChange([...textBoxes, { id, pos: p, text: "" }]);
    setJustPlacedId(id);
    onSelectDim?.(id);
    onPlaced?.();
  }

  return {
    handlers: textBoxMode ? { onPointerDown } : {},
    layer: (
      <g>
        {textBoxes.map((b) => (
          <TextBoxItemView
            key={b.id}
            box={b}
            fontSize={fontSize}
            color={color}
            onChange={(text) => onTextBoxesChange(textBoxes.map((x) => (x.id === b.id ? { ...x, text } : x)))}
            onMove={(pos) => onTextBoxesChange(textBoxes.map((x) => (x.id === b.id ? { ...x, pos } : x)))}
            onResize={(w, h) => onTextBoxesChange(textBoxes.map((x) => (x.id === b.id ? { ...x, w, h } : x)))}
            onDelete={() => onTextBoxesChange(textBoxes.filter((x) => x.id !== b.id))}
            selected={selectedId === b.id}
            onSelect={() => onSelectDim?.(b.id)}
            autoFocus={b.id === justPlacedId}
          />
        ))}
      </g>
    ),
  };
}

// User-added "measure any two points" dimensions — same visual language as
// the built-in ring/height dims, but placed freely by the user instead of
// being derived from ring/frame data. Only meaningful on orthographic views
// (Front/Side/Top), where SVG user-space already equals real mm; Iso is a
// projection (foreshortened), so it doesn't get this layer.
export interface CustomDim {
  id: string;
  kind: "h" | "v" | "d";
  ax: number;
  ay: number;
  bx: number;
  by: number;
  offset?: number;
  valueOverride?: string;
  color?: string;
  fontSize?: number;
}
export type DimPickMode = "h" | "v" | "d" | null;

function useCustomDimDraft(onFinish: (ax: number, ay: number, bx: number, by: number) => void) {
  const [draft, setDraft] = useState<{ a: [number, number]; b: [number, number] } | null>(null);
  const draggingRef = useRef(false);

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if ((e.target as Element).closest("foreignObject")) return;
    const svg = e.currentTarget;
    const p = svgPoint(svg, e.clientX, e.clientY);
    draggingRef.current = true;
    setDraft({ a: p, b: p });
    svg.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!draggingRef.current) return;
    const p = svgPoint(e.currentTarget, e.clientX, e.clientY);
    setDraft((d) => (d ? { a: d.a, b: p } : d));
  }
  function onPointerUp() {
    if (!draggingRef.current || !draft) return;
    draggingRef.current = false;
    const dist = Math.hypot(draft.b[0] - draft.a[0], draft.b[1] - draft.a[1]);
    if (dist > 4) onFinish(draft.a[0], draft.a[1], draft.b[0], draft.b[1]);
    setDraft(null);
  }

  return { draft, onPointerDown, onPointerMove, onPointerUp };
}

// Click selects (Delete key or the sidebar panel removes it — same as every
// built-in dim now), rather than deleting outright on click.
function CustomDimItem({
  dim,
  fontSize,
  color,
  onChange,
  selected = false,
  onSelect,
}: {
  dim: CustomDim;
  fontSize: number;
  color: string;
  onChange: (next: CustomDim) => void;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const offset = dim.offset ?? 0;
  const text = dim.valueOverride;
  const itemColor = dim.color ?? color;
  const itemFontSize = dim.fontSize ?? fontSize;
  const onLineClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.();
  };

  if (dim.kind === "h") {
    const baseY = Math.max(dim.ay, dim.by) + 24 + offset;
    const value = text ?? `${Math.round(Math.abs(dim.bx - dim.ax))}`;
    return (
      <g>
        <line x1={dim.ax} y1={dim.ay} x2={dim.ax} y2={baseY} stroke="#c7c7c7" strokeWidth={0.6} />
        <line x1={dim.bx} y1={dim.by} x2={dim.bx} y2={baseY} stroke="#c7c7c7" strokeWidth={0.6} />
        <line
          x1={dim.ax}
          y1={baseY}
          x2={dim.bx}
          y2={baseY}
          stroke={itemColor}
          strokeWidth={selected ? 1.6 : 0.9}
          markerStart="url(#arrowStart)"
          markerEnd="url(#arrowEnd)"
          style={{ cursor: "pointer" }}
          onClick={onLineClick}
        />
        <DimText
          x={(dim.ax + dim.bx) / 2}
          y={baseY - 4}
          text={value}
          fontSize={itemFontSize}
          color={itemColor}
          selected={selected}
          onSelect={onSelect}
          editable={{
            axis: "y",
            offset,
            onOffsetChange: (v) => onChange({ ...dim, offset: v }),
            onCommitValue: (v) => onChange({ ...dim, valueOverride: v }),
          }}
        />
      </g>
    );
  }

  if (dim.kind === "v") {
    const baseX = Math.max(dim.ax, dim.bx) + 24 + offset;
    const value = text ?? `${Math.round(Math.abs(dim.by - dim.ay))}`;
    return (
      <g>
        <line x1={dim.ax} y1={dim.ay} x2={baseX} y2={dim.ay} stroke="#c7c7c7" strokeWidth={0.6} />
        <line x1={dim.bx} y1={dim.by} x2={baseX} y2={dim.by} stroke="#c7c7c7" strokeWidth={0.6} />
        <line
          x1={baseX}
          y1={dim.ay}
          x2={baseX}
          y2={dim.by}
          stroke={itemColor}
          strokeWidth={selected ? 1.6 : 0.9}
          markerStart="url(#arrowStart)"
          markerEnd="url(#arrowEnd)"
          style={{ cursor: "pointer" }}
          onClick={onLineClick}
        />
        <DimText
          x={baseX + 6}
          y={(dim.ay + dim.by) / 2 + fontSize * 0.35}
          text={value}
          fontSize={itemFontSize}
          color={itemColor}
          anchor="start"
          selected={selected}
          onSelect={onSelect}
          editable={{
            axis: "x",
            offset,
            onOffsetChange: (v) => onChange({ ...dim, offset: v }),
            onCommitValue: (v) => onChange({ ...dim, valueOverride: v }),
          }}
        />
      </g>
    );
  }

  // Diagonal: the dim line runs directly between the two picked points (no
  // witness lines — it IS the measurement), so only the label's placement,
  // not the line, responds to the drag offset.
  const value = text ?? `${Math.round(Math.hypot(dim.bx - dim.ax, dim.by - dim.ay))}`;
  return (
    <g>
      <line
        x1={dim.ax}
        y1={dim.ay}
        x2={dim.bx}
        y2={dim.by}
        stroke={itemColor}
        strokeWidth={selected ? 1.6 : 0.9}
        markerStart="url(#arrowStart)"
        markerEnd="url(#arrowEnd)"
        style={{ cursor: "pointer" }}
        onClick={onLineClick}
      />
      <DimText
        x={(dim.ax + dim.bx) / 2 + 10}
        y={(dim.ay + dim.by) / 2 - 6 + offset}
        text={value}
        fontSize={itemFontSize}
        color={itemColor}
        anchor="start"
        selected={selected}
        onSelect={onSelect}
        editable={{
          axis: "y",
          offset,
          onOffsetChange: (v) => onChange({ ...dim, offset: v }),
          onCommitValue: (v) => onChange({ ...dim, valueOverride: v }),
        }}
      />
    </g>
  );
}

function useCustomDimLayer({
  dims,
  onDimsChange,
  pickMode,
  fontSize,
  color,
  selectedId,
  onSelectDim,
}: {
  dims: CustomDim[];
  onDimsChange: (dims: CustomDim[]) => void;
  pickMode: DimPickMode;
  fontSize: number;
  color: string;
} & DimSelectionProps) {
  const { draft, onPointerDown, onPointerMove, onPointerUp } = useCustomDimDraft((ax, ay, bx, by) => {
    if (!pickMode) return;
    onDimsChange([...dims, { id: `d${Date.now()}${Math.random().toString(36).slice(2, 6)}`, kind: pickMode, ax, ay, bx, by }]);
  });

  return {
    handlers: pickMode ? { onPointerDown, onPointerMove, onPointerUp } : {},
    layer: (
      <g>
        {draft && <line x1={draft.a[0]} y1={draft.a[1]} x2={draft.b[0]} y2={draft.b[1]} stroke={color} strokeWidth={0.8} strokeDasharray="3 2" />}
        {dims.map((d) => (
          <CustomDimItem
            key={d.id}
            dim={d}
            fontSize={fontSize}
            color={color}
            onChange={(next) => onDimsChange(dims.map((x) => (x.id === d.id ? next : x)))}
            selected={selectedId === d.id}
            onSelect={() => onSelectDim?.(d.id)}
          />
        ))}
      </g>
    ),
  };
}

// Drag-to-pan: grabbing empty canvas (when neither note nor custom-dim
// picking is active) shifts the view's own vbX/vbY by a real mm amount —
// converted from screen pixels via the SVG's CURRENT CTM captured ONCE at
// drag start, not re-derived every move, since the viewBox itself changes
// as panning happens (re-deriving mid-drag would create a feedback loop:
// each move's client-to-mm conversion would already reflect the previous
// move's shift). A small distance threshold (in screen px, before any mm
// conversion) keeps a plain click — e.g. on a dimension line, to hide it —
// from nudging the pan by the sub-pixel jitter real mouse input always has.
function usePanDrag(pan: { x: number; y: number }, onPanChange?: (x: number, y: number) => void) {
  const dragRef = useRef<{ startClientX: number; startClientY: number; startPan: { x: number; y: number }; pxPerMm: number; moved: boolean } | null>(null);
  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!onPanChange) return;
    if ((e.target as Element).closest("foreignObject")) return;
    const ctm = e.currentTarget.getScreenCTM();
    if (!ctm || !ctm.a) return;
    dragRef.current = { startClientX: e.clientX, startClientY: e.clientY, startPan: pan, pxPerMm: ctm.a, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || !onPanChange) return;
    const dxPx = e.clientX - drag.startClientX;
    const dyPx = e.clientY - drag.startClientY;
    if (!drag.moved && Math.hypot(dxPx, dyPx) < 3) return;
    drag.moved = true;
    onPanChange(drag.startPan.x - dxPx / drag.pxPerMm, drag.startPan.y - dyPx / drag.pxPerMm);
  }
  function onPointerUp() {
    dragRef.current = null;
  }
  return { onPointerDown, onPointerMove, onPointerUp };
}

// Derives a pattern tile's real mm size from a zone's own repeat counts so
// the 2D drawing's apparent pattern density tracks the 3D Solid view's
// instead of a guessed constant — height maps directly (repeatY tiles over
// the zone's own real height, exactly like the 3D cylindricalUV's local v
// range), width doesn't have a literal equivalent (a flat silhouette isn't
// an unwrapped cylinder — there's no "circumference" to divide by), so it
// uses the zone's own diameter instead: not a true projection, but it
// keeps "more repeatX = visibly denser tiling" true, which is what
// actually reads as "matching" side by side with the 3D view. Clamped so
// a stray 0/near-0 repeat can't produce a degenerate (near-infinite or
// near-zero) tile.
function tileSizeFor(zone: MaterialZoneSettings, diameterMm: number, heightMm: number): { w: number; h: number } {
  const clampDim = (v: number) => Math.min(Math.max(v, 4), 600);
  return {
    w: clampDim(diameterMm / Math.max(zone.repeatX, 0.1)),
    h: clampDim(heightMm / Math.max(zone.repeatY, 0.1)),
  };
}

// Fills an outline with a single uploaded material image (tiled), given an
// explicit image URL + zone (repeat settings) rather than reaching into
// `material` itself — so the SAME component serves every "one image for
// this shape" case: Front/Side's own no-split fallback, and Top/Iso below,
// which each resolve a DIFFERENT zone (see topBandImage). Returns null
// (renders nothing) when there's no image to show, so callers just fall
// back to their own flat colour via solidFill.
function MaterialPatternDefs({
  imageUrl,
  zone,
  patternId,
  diameterMm,
  heightMm,
}: {
  imageUrl: string | null | undefined;
  zone: MaterialZoneSettings;
  patternId: string;
  diameterMm: number;
  heightMm: number;
}) {
  if (!imageUrl) return null;
  const { w, h } = tileSizeFor(zone, diameterMm, heightMm);
  return (
    <defs>
      <pattern id={patternId} patternUnits="userSpaceOnUse" width={w} height={h}>
        <image href={imageUrl} x={0} y={0} width={w} height={h} preserveAspectRatio="none" />
      </pattern>
    </defs>
  );
}

function solidFill(imageUrl: string | null | undefined, patternId: string, fallback: string): string {
  return imageUrl ? `url(#${patternId})` : fallback;
}

// Front/Side's own no-split fallback zone (the whole body treated as one
// "khoang") — bands[0] when there are no splits IS the whole body.
function wholeBodyZone(material: MaterialInput | undefined): MaterialZoneSettings {
  return material?.bands[0]?.settings ?? DEFAULT_MATERIAL_ZONE;
}

// Top/Iso's mouth-opening view can only show ONE image (a flat projection
// from directly above, or the rim looking down into the opening, aren't
// "chia khoang theo chiều cao" the way Front/Side's outline is) — the
// closest honest single image is whichever khoang sits at the MOUTH (the
// topmost band), since that's genuinely what's visible from that
// direction, rather than an arbitrary shared default that might not even
// be the khoang actually at the rim.
function topBandImageAndZone(material: MaterialInput | undefined): { imageUrl: string | null | undefined; zone: MaterialZoneSettings } {
  if (!material?.enabled) return { imageUrl: null, zone: DEFAULT_MATERIAL_ZONE };
  const topBand = material.bands[material.bands.length - 1];
  return { imageUrl: topBand?.imageDataUrl ?? material.imageDataUrl, zone: topBand?.settings ?? DEFAULT_MATERIAL_ZONE };
}

// Same bottom-to-top band boundaries as profileEngine.ts's own
// buildMaterialBands (the 3D Solid view) — kept as a small local helper
// here rather than a shared export since it's just array bookkeeping, not
// geometry.
function bandZRanges(splits: number[], minZ: number, maxZ: number): Array<[number, number]> {
  const bounds = [minZ, ...[...splits].sort((a, b) => a - b).filter((z) => z > minZ && z < maxZ), maxZ];
  const ranges: Array<[number, number]> = [];
  for (let i = 0; i < bounds.length - 1; i++) ranges.push([bounds[i], bounds[i + 1]]);
  return ranges;
}

// One filled <path> per material khoang (band[i] ↔ splits sorted ascending,
// same convention as the 3D Solid view and MaterialForm.tsx), each with its
// OWN image (its own override, or falling back to the shared/default
// upload) — the actual "map từng khoang trong xuất bản vẽ" a asked for,
// replacing the single whole-body fill from MaterialPatternDefs above when
// there's at least one split. The internal boundary strokes between bands
// double as a visual cue for where each khoang starts/ends, on top of the
// numeric labels MaterialHeightChain already draws.
// `sliceForPath` builds each band's OWN outline in whatever coordinate
// space the caller is rendering into (mm for Front/Side, already
// iso-projected screen space for Iso) — kept separate from the real-mm
// `rows` used for the pattern tile's own size calc below, since an
// iso-projected outline's own X-span isn't a real mm distance the way a
// Front/Side one is.
function MaterialBandFills({
  rows,
  material,
  minZ,
  maxZ,
  sliceForPath,
  toPath,
  patternIdPrefix,
}: {
  rows: ShapeDrawingRow[];
  material: MaterialInput;
  minZ: number;
  maxZ: number;
  sliceForPath: (zLow: number, zHigh: number) => Array<[number, number]>;
  toPath: (pts: Array<[number, number]>) => string;
  patternIdPrefix: string;
}) {
  const ranges = bandZRanges(material.splits, minZ, maxZ);
  const bandPts = ranges.map(([zLow, zHigh]) => sliceForPath(zLow, zHigh));
  const bandMaxHalfExtent = (zLow: number, zHigh: number) => {
    const a = rowAtZ(rows, zLow);
    const b = rowAtZ(rows, zHigh);
    let m = Math.max(a.halfLengthMm, a.halfWidthMm, b.halfLengthMm, b.halfWidthMm);
    for (const r of rows) if (r.zMm <= zHigh + 0.01 && r.zMm >= zLow - 0.01) m = Math.max(m, r.halfLengthMm, r.halfWidthMm);
    return m;
  };
  return (
    <>
      <defs>
        {ranges.map(([zLow, zHigh], i) => {
          const url = material.bands[i]?.imageDataUrl ?? material.imageDataUrl;
          if (!url) return null;
          const zone: MaterialZoneSettings = material.bands[i]?.settings ?? DEFAULT_MATERIAL_ZONE;
          const diameterMm = bandMaxHalfExtent(zLow, zHigh) * 2;
          const { w, h } = tileSizeFor(zone, diameterMm, zHigh - zLow);
          return (
            <pattern key={i} id={`${patternIdPrefix}-band-${i}`} patternUnits="userSpaceOnUse" width={w} height={h}>
              <image href={url} x={0} y={0} width={w} height={h} preserveAspectRatio="none" />
            </pattern>
          );
        })}
      </defs>
      {ranges.map((_, i) => {
        const url = material.bands[i]?.imageDataUrl ?? material.imageDataUrl;
        return (
          <path
            key={i}
            d={toPath(bandPts[i])}
            fill={url ? `url(#${patternIdPrefix}-band-${i})` : "#f3ead9"}
            stroke={STROKE}
            strokeWidth={1.1}
            strokeLinejoin="round"
          />
        );
      })}
    </>
  );
}

// Same arrow + witness-line + draggable/editable/hideable chain as the
// ring HeightChain (above), just fed the material khoang boundaries
// (mouth, each split, base) instead of ring Z's, and mirrored on the RIGHT
// of the body — reuses the SAME dimSettings map as every other dim here
// (keyed material-height-N), so hide/drag/override-value/undo all come for
// free through DrawingSheetA4's existing dim-settings + undo plumbing.
// Front view only, same reasoning as the ring dims above. No "total" —
// that would just duplicate the ring HeightChain's own total on the left.
function MaterialHeightChain({
  bounds,
  samples,
  toY,
  chainX,
  fontSize,
  color,
  idPrefix,
  dimSettings,
  onDimSettingsChange,
  selectedId,
  onSelectDim,
}: {
  bounds: number[]; // Z values, mouth → base (descending)
  samples: Sample[];
  toY: (z: number) => number;
  chainX: number;
  fontSize: number;
  color: string;
  idPrefix: string;
  dimSettings: DimSettingsMap;
  onDimSettingsChange: (id: string, next: DimSettings) => void;
} & DimSelectionProps) {
  return (
    <g>
      {bounds.map((z, i) => (
        <line key={`witness-${i}`} x1={radiusAtZ(samples, z)} y1={toY(z)} x2={chainX} y2={toY(z)} stroke="#c7c7c7" strokeWidth={0.6} />
      ))}
      {bounds.slice(0, -1).map((z, i) => {
        const id = `${idPrefix}-${i}`;
        const settings = dimSettings[id] ?? EMPTY_DIM;
        if (settings.hidden) return null;
        const offset = settings.offset ?? 0;
        const cx = chainX + offset;
        const next = bounds[i + 1];
        const ya = toY(z);
        const yb = toY(next);
        const mid = (ya + yb) / 2;
        const height = Math.round(Math.abs(z - next));
        const text = settings.valueOverride ?? `${height}`;
        const { color: itemColor, fontSize: itemFontSize } = resolveDimStyle(settings, color, fontSize);
        const select = () => onSelectDim?.(id);
        return (
          <g key={`seg-${i}`}>
            {offset !== 0 && <line x1={chainX} y1={mid} x2={cx} y2={mid} stroke="#c7c7c7" strokeWidth={0.5} strokeDasharray="2 2" />}
            <line
              x1={cx}
              y1={ya}
              x2={cx}
              y2={yb}
              stroke={itemColor}
              strokeWidth={selectedId === id ? 1.6 : 0.9}
              markerStart="url(#arrowStart)"
              markerEnd="url(#arrowEnd)"
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                select();
              }}
            />
            <DimText
              x={cx + 6}
              y={mid + fontSize * 0.35}
              text={text}
              fontSize={itemFontSize}
              color={itemColor}
              anchor="start"
              selected={selectedId === id}
              onSelect={select}
              editable={{
                axis: "x",
                offset,
                onOffsetChange: (v) => onDimSettingsChange(id, { ...settings, offset: v }),
                onCommitValue: (v) => onDimSettingsChange(id, { ...settings, valueOverride: v }),
              }}
            />
          </g>
        );
      })}
    </g>
  );
}

// A single shared square half-extent — like setting one "1:x" ortho camera
// scale for the whole sheet instead of letting each view (Front/Side/Top/
// Iso) independently zoom-to-fit its own content, which used to leave them
// at visibly different apparent sizes for the SAME product depending on
// how much margin that particular view's own layout happened to need.
// Matches TopSVG's own historical maxRadius*1.18+20 formula as the
// baseline, then grows it (never shrinks below) to also fit whatever
// Front/Side need for their dimension chains and the product's real
// height — a product taller than it is wide needs more vertical room than
// a top-down view's radius alone would ever require, so the shared scale
// has to be driven by whichever view needs the most space, not by Top's in
// isolation.
function orthoHalfExtent(drawing: ShapeDrawingInput, handleApexZ?: number): number {
  const front = buildFrontViewData(drawing);
  const side = buildSideViewData(drawing);
  const { maxZ, minZ } = front;
  // The shared scale has to fit whichever of Front/Side is wider — a
  // genuine consideration once length ≠ width (Round's two are always
  // identical, so this was a no-op there).
  const maxRadius = Math.max(front.maxRadius, side.maxRadius);
  const chainGap = Math.max(maxRadius * 0.12, 16);
  const chainReach = maxRadius + 2 * chainGap + 30;
  const verticalHalfNeeded = (Math.max(handleApexZ ?? maxZ, maxZ) - minZ) / 2 + 50;
  const baseHalfExtent = maxRadius * 1.18 + 20;

  // Iso shows the SAME body's height and diameter at once, foreshortened
  // together by the isometric projection — its natural 2D footprint is
  // bigger than either a pure elevation (Front) or pure plan (Top) needs on
  // its own, so without accounting for it here, Iso would always end up
  // more zoomed-out than the other three no matter how big they're made.
  const iso = buildIsoViewData(drawing);
  const isoPts = [...iso.outline, ...iso.mouthEllipse, ...iso.bottomEllipse];
  const isoXs = isoPts.map((p) => p[0]);
  const isoYs = isoPts.map((p) => p[1]);
  const isoSpanX = Math.max(...isoXs) - Math.min(...isoXs);
  const isoSpanY = Math.max(...isoYs) - Math.min(...isoYs);
  // Same margin formula IsoSVG's own local computation uses (proportional
  // to its X span, not a flat constant) — using a different one here would
  // under- or over-estimate Iso's true requirement relative to what it
  // actually renders at, defeating the whole point of feeding it back in.
  const isoMargin = isoSpanX * 0.12 + 16;
  const isoHalfExtent = Math.max(isoSpanX, isoSpanY) / 2 + isoMargin;

  return Math.max(baseHalfExtent, chainReach, verticalHalfNeeded, isoHalfExtent);
}

interface ViewProps {
  drawing: ShapeDrawingInput;
  mode?: DrawMode;
  tubes?: FrameTube[];
  // The user's actual chosen Khung sắt color (frameResult.colorHex) —
  // without it, TubeWireframe falls back to its own FRAME_STROKE default,
  // which is a plain reference tone, not what the product will really be.
  frameColor?: string;
  fontScale?: number;
  dimColor?: string;
  notes?: Note[];
  onNotesChange?: (notes: Note[]) => void;
  noteMode?: boolean;
  textBoxes?: TextBoxItem[];
  onTextBoxesChange?: (boxes: TextBoxItem[]) => void;
  textBoxMode?: boolean;
  onTextBoxPlaced?: () => void;
  dimSettings?: DimSettingsMap;
  onDimSettingsChange?: (id: string, next: DimSettings) => void;
  customDims?: CustomDim[];
  onCustomDimsChange?: (dims: CustomDim[]) => void;
  dimPickMode?: DimPickMode;
  material?: MaterialInput;
  // A user-chosen "1:x" print scale (see orthoHalfExtent's own comment for
  // the auto-fit this overrides) — set, every view uses this EXACT value
  // instead of independently computing its own safe minimum, so the
  // resulting drawing is genuinely at the stated scale rather than "close
  // to it, except wherever a view happened to need more room." Left
  // undefined for the normal auto-fit behaviour.
  fixedHalfExtent?: number;
  // Iso view only: the camera azimuth/elevation (default = DEFAULT_ISO_ANGLE).
  isoAngle?: IsoAngle;
  // Free drag-to-reposition within the view's own frame (mm offsets applied
  // on top of whatever half-extent — auto or fixed-scale — is in effect) —
  // lets the user recentre or push part of the object out of frame on
  // purpose, e.g. to inspect one area more closely at a fixed scale rather
  // than the auto-centred default.
  panX?: number;
  panY?: number;
  onPanChange?: (panX: number, panY: number) => void;
  // Click-to-select across every dim/note/text-box kind — Delete removes
  // whatever's selected, the sidebar's "Mục đang chọn" panel can give it its
  // own color/size. Each kind gets its own callback since the 4 underlying
  // collections (dimSettings keys, customDims, notes, textBoxes) are
  // independent id-spaces.
  selectedDimId?: string | null;
  onSelectDim?: (id: string) => void;
  selectedCustomDimId?: string | null;
  onSelectCustomDim?: (id: string) => void;
  selectedNoteId?: string | null;
  onSelectNote?: (id: string) => void;
  selectedTextBoxId?: string | null;
  onSelectTextBox?: (id: string) => void;
  // Clicking empty canvas clears whatever is currently selected.
  onClearSelection?: () => void;
}

interface ElevationProps extends ViewProps {
  view?: "front" | "side";
  handlePaths?: Point3[][];
  handle?: HandleInput;
  // Which view actually shows the standing handle's true arc — "side" for
  // every shape whose handle mounts on the length axis (Round, Oval,
  // Ellipse, and Rectangle with handle.side==="width"), "front" for a
  // Rectangle handle mounted on the width axis instead (side==="length") —
  // see rectHandlePaths.ts's own rectHandleAxis for the same convention.
  handleArcView?: "front" | "side";
}

// Front and Side genuinely differ once there's a standing handle: it's
// mounted at X=±mouthRadius and arcs across Y (see handlePaths.ts), so
// Front (drops Y) only ever shows it as a thin vertical sliver at the mount
// point, while Side (drops X) shows its true arc — see projectTubesSide.
export function FrontSideSVG({
  drawing,
  mode = "solid",
  tubes,
  frameColor,
  fontScale = 1,
  dimColor = "#2f6fb3",
  notes = [],
  onNotesChange,
  noteMode = false,
  textBoxes = [],
  onTextBoxesChange,
  textBoxMode = false,
  onTextBoxPlaced,
  dimSettings = {},
  onDimSettingsChange,
  customDims = [],
  onCustomDimsChange,
  dimPickMode = null,
  view = "front",
  handlePaths,
  handle,
  handleArcView = "side",
  material,
  fixedHalfExtent,
  panX = 0,
  panY = 0,
  onPanChange,
  selectedDimId = null,
  onSelectDim,
  selectedCustomDimId = null,
  onSelectCustomDim,
  selectedNoteId = null,
  onSelectNote,
  selectedTextBoxId = null,
  onSelectTextBox,
  onClearSelection,
}: ElevationProps) {
  const fontSize = BASE_FONT * fontScale;
  const setDim = onDimSettingsChange ?? (() => {});
  const { handlers: noteHandlers, layer: noteLayer } = useNoteLayer({
    notes,
    onNotesChange: onNotesChange ?? (() => {}),
    noteMode,
    fontSize,
    color: dimColor,
    selectedId: selectedNoteId,
    onSelectDim: onSelectNote,
  });
  const { handlers: textBoxHandlers, layer: textBoxLayer } = useTextBoxLayer({
    textBoxes,
    onTextBoxesChange: onTextBoxesChange ?? (() => {}),
    textBoxMode,
    fontSize,
    color: dimColor,
    selectedId: selectedTextBoxId,
    onSelectDim: onSelectTextBox,
    onPlaced: onTextBoxPlaced,
  });
  const { handlers: customDimHandlers, layer: customDimLayer } = useCustomDimLayer({
    dims: customDims,
    onDimsChange: onCustomDimsChange ?? (() => {}),
    pickMode: dimPickMode,
    fontSize,
    color: dimColor,
    selectedId: selectedCustomDimId,
    onSelectDim: onSelectCustomDim,
  });
  const panHandlers = usePanDrag({ x: panX, y: panY }, onPanChange);
  const handlers = dimPickMode ? customDimHandlers : noteMode ? noteHandlers : textBoxMode ? textBoxHandlers : panHandlers;
  const { outline, rings, minZ, maxZ, maxRadius: solidMaxRadius, samples } = useMemo(
    () => (view === "side" ? buildSideViewData(drawing) : buildFrontViewData(drawing)),
    [drawing, view],
  );
  const toY = (z: number) => maxZ - z;
  const projectTubes = view === "side" ? projectTubesSide : projectTubesFront;
  const projectPaths = view === "side" ? projectPathsSide : projectPathsFront;

  const framePolylines = useMemo(() => {
    if (mode !== "frame" || !tubes) return [];
    return projectTubes(tubes).map((seg) => ({ points: seg.points.map(([x, z]): [number, number] => [x, toY(z)]), diameterMm: seg.diameterMm }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tubes, view, maxZ]);

  const handleLines = useMemo(() => {
    if (mode !== "solid" || !handlePaths?.length) return [];
    return projectPaths(handlePaths).map((pts) => pts.map(([x, z]): [number, number] => [x, toY(z)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, handlePaths, view, maxZ]);

  const showHandleDims = view === handleArcView && (handle?.type === "standing" || handle?.type === "cutout");
  const apexZ = showHandleDims && handle?.type === "standing" ? drawing.rows[0].zMm + handle.height : maxZ;
  const handleHalfExtent = showHandleDims ? (handle?.type === "standing" ? handle.width / 2 + 40 : (handle?.cutoutWidth ?? 0) / 2 + 40) : 0;

  const maxRadius = Math.max(solidMaxRadius, wireSegmentsExtentX(framePolylines), polylinesExtentX(handleLines), handleHalfExtent);

  const chainGap = Math.max(maxRadius * 0.12, 16);
  const chainX = -(maxRadius + chainGap);
  const splitChainX = maxRadius + chainGap;
  // Khoang vật liệu only exists for Solid — showing its height chain over
  // the Khung sắt wireframe would dimension something that isn't there. Its
  // split Z's are the same regardless of axis, so (unlike ring Ø/length/
  // width) this genuinely IS a duplicate on Side — stays Front-only always.
  const showSplitDims = view === "front" && mode === "solid" && !!material?.splits?.length;
  // A round cross-section has no separate length/width — Front and Side
  // would show the identical numbers, so Side skips its own ring dims
  // there (matching the old Round-only behavior exactly). Any other shape
  // genuinely has a different extent on each axis, so both views get theirs.
  const showRingDims = view === "front" || !drawing.isRound;
  // The Z-height chain (ring Z positions) is the same on every axis — unlike
  // the length/width DiameterDim values above, it is never worth repeating
  // on Side, so it stays Front-only regardless of shape (same reasoning as
  // showSplitDims below).
  const showHeightChain = view === "front";

  // Shared square half-extent — see orthoHalfExtent's own comment. Front
  // and Side end up identical for Round (same maxRadius on both axes, same
  // handle apex); Top/Iso independently call the SAME function so all four
  // stay at one consistent scale instead of each fitting its own content.
  const halfExtent = fixedHalfExtent ?? orthoHalfExtent(drawing, apexZ);
  const midZ = (maxZ + minZ) / 2;

  const vbX = -halfExtent + panX;
  const vbY = toY(midZ) - halfExtent + panY;
  const vbW = halfExtent * 2;
  const vbH = halfExtent * 2;

  const outlinePath = outline.map(([x, z], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${toY(z).toFixed(2)}`).join(" ") + " Z";

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      className="h-full w-full"
      style={{ cursor: noteMode || dimPickMode || textBoxMode ? "crosshair" : "grab", touchAction: "none" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClearSelection?.();
      }}
      {...handlers}
    >
      <ArrowDefs color={dimColor} />
      {!(material?.enabled && material.imageDataUrl && material.splits.length > 0) && (
        <MaterialPatternDefs
          imageUrl={material?.enabled ? material.imageDataUrl : null}
          zone={wholeBodyZone(material)}
          patternId={`material-pattern-${view}`}
          diameterMm={solidMaxRadius * 2}
          heightMm={maxZ - minZ}
        />
      )}
      {mode === "solid" ? (
        <>
          {material?.enabled && material.imageDataUrl && material.splits.length > 0 ? (
            <MaterialBandFills
              rows={drawing.rows}
              material={material}
              minZ={minZ}
              maxZ={maxZ}
              sliceForPath={(zLow, zHigh) => sliceOutline(samples, zLow, zHigh)}
              toPath={(pts) => pts.map(([x, z], j) => `${j === 0 ? "M" : "L"} ${x.toFixed(2)} ${toY(z).toFixed(2)}`).join(" ") + " Z"}
              patternIdPrefix={`material-${view}`}
            />
          ) : (
            <path
              d={outlinePath}
              fill={solidFill(material?.enabled ? material.imageDataUrl : null, `material-pattern-${view}`, "#f3ead9")}
              stroke={STROKE}
              strokeWidth={1.1}
              strokeLinejoin="round"
            />
          )}
          <WireframePaths polylines={handleLines} color={HANDLE_GUIDE_COLOR} strokeWidth={1} />
        </>
      ) : (
        <TubeWireframe segments={framePolylines} color={frameColor} />
      )}
      {showRingDims && (
        <>
          {rings.map((r, i) => (
            <DiameterDim
              key={i}
              id={`ring-${i}`}
              ring={r}
              toY={toY}
              fontSize={fontSize}
              color={dimColor}
              dimSettings={dimSettings}
              onDimSettingsChange={setDim}
              defaultOffset={i === 0 ? -(fontSize + 14) : i === rings.length - 1 ? fontSize + 14 : 0}
              isRound={drawing.isRound}
              selectedId={selectedDimId}
              onSelectDim={onSelectDim}
            />
          ))}
          {showHeightChain && (
            <HeightChain
              rings={rings}
              toY={toY}
              chainX={chainX}
              maxRadius={maxRadius}
              fontSize={fontSize}
              color={dimColor}
              idPrefix="height"
              dimSettings={dimSettings}
              onDimSettingsChange={setDim}
              selectedId={selectedDimId}
              onSelectDim={onSelectDim}
            />
          )}
          {showSplitDims && material && (
            <MaterialHeightChain
              bounds={[maxZ, ...[...material.splits].sort((a, b) => b - a), minZ]}
              samples={samples}
              toY={toY}
              chainX={splitChainX}
              fontSize={fontSize}
              color={dimColor}
              idPrefix="material-height"
              dimSettings={dimSettings}
              onDimSettingsChange={setDim}
              selectedId={selectedDimId}
              onSelectDim={onSelectDim}
            />
          )}
        </>
      )}
      {showHandleDims && handle?.type === "standing" && (
        <HandleDims
          handle={handle}
          mouthZ={drawing.rows[0].zMm}
          toY={toY}
          fontSize={fontSize}
          color={dimColor}
          dimSettings={dimSettings}
          onDimSettingsChange={setDim}
          selectedId={selectedDimId}
          onSelectDim={onSelectDim}
        />
      )}
      {showHandleDims && handle?.type === "cutout" && (
        <CutoutHandleDims
          handle={handle}
          mouthZ={drawing.rows[0].zMm}
          toY={toY}
          fontSize={fontSize}
          color={dimColor}
          dimSettings={dimSettings}
          onDimSettingsChange={setDim}
          outerX={maxRadius + chainGap}
          selectedId={selectedDimId}
          onSelectDim={onSelectDim}
        />
      )}
      {noteLayer}
      {textBoxLayer}
      {customDimLayer}
    </svg>
  );
}

// (x, y) shape-local outline points → an SVG path string, flipping Y the
// same way projectTubesTop's own `-p.y` does — a plan view looks DOWN the Z
// axis, so Y needs the same sign flip a wireframe ring already gets there.
function topPath(pts: Array<[number, number]>, close = true): string {
  return pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${(-y).toFixed(2)}`).join(" ") + (close ? " Z" : "");
}

export function TopSVG({
  drawing,
  mode = "solid",
  tubes,
  frameColor,
  fontScale = 1,
  dimColor = "#2f6fb3",
  notes = [],
  onNotesChange,
  noteMode = false,
  textBoxes = [],
  onTextBoxesChange,
  textBoxMode = false,
  onTextBoxPlaced,
  customDims = [],
  onCustomDimsChange,
  dimPickMode = null,
  material,
  fixedHalfExtent,
  panX = 0,
  panY = 0,
  onPanChange,
  selectedCustomDimId = null,
  onSelectCustomDim,
  selectedNoteId = null,
  onSelectNote,
  selectedTextBoxId = null,
  onSelectTextBox,
  onClearSelection,
}: ViewProps) {
  const fontSize = BASE_FONT * fontScale;
  const { handlers: noteHandlers, layer: noteLayer } = useNoteLayer({
    notes,
    onNotesChange: onNotesChange ?? (() => {}),
    noteMode,
    fontSize,
    color: dimColor,
    selectedId: selectedNoteId,
    onSelectDim: onSelectNote,
  });
  const { handlers: textBoxHandlers, layer: textBoxLayer } = useTextBoxLayer({
    textBoxes,
    onTextBoxesChange: onTextBoxesChange ?? (() => {}),
    textBoxMode,
    fontSize,
    color: dimColor,
    selectedId: selectedTextBoxId,
    onSelectDim: onSelectTextBox,
    onPlaced: onTextBoxPlaced,
  });
  const { handlers: customDimHandlers, layer: customDimLayer } = useCustomDimLayer({
    dims: customDims,
    onDimsChange: onCustomDimsChange ?? (() => {}),
    pickMode: dimPickMode,
    fontSize,
    color: dimColor,
    selectedId: selectedCustomDimId,
    onSelectDim: onSelectCustomDim,
  });
  const panHandlers = usePanDrag({ x: panX, y: panY }, onPanChange);
  const handlers = dimPickMode ? customDimHandlers : noteMode ? noteHandlers : textBoxMode ? textBoxHandlers : panHandlers;
  const {
    maxRadius: solidMaxRadius,
    mouthOutline,
    bottomOutline,
    maxOutline,
    mouthIsWidest,
  } = useMemo(() => buildTopViewData(drawing), [drawing]);

  const framePolylines = useMemo(() => {
    if (mode !== "frame" || !tubes) return [];
    return projectTubesTop(tubes);
  }, [mode, tubes]);

  const maxRadius = Math.max(solidMaxRadius, wireSegmentsExtentX(framePolylines));
  // Ø/length/width labels were dropped from here — Front/Side already
  // dimension every ring's own extent, so repeating them on Top was pure
  // duplication. The outlines themselves still convey the shape; only the
  // redundant text/arrows go.
  // Shared scale with Front/Side/Iso (see orthoHalfExtent) — still floored
  // by Top's OWN frame-inclusive radius so a wide Khung sắt spoke/ring
  // extending past the body never gets clipped even on a product whose
  // Front/Side happen to need less room than that.
  const vb = fixedHalfExtent ?? Math.max(orthoHalfExtent(drawing), maxRadius * 1.18 + 20);

  return (
    <svg
      viewBox={`${-vb + panX} ${-vb + panY} ${vb * 2} ${vb * 2}`}
      className="h-full w-full"
      style={{ cursor: noteMode || dimPickMode || textBoxMode ? "crosshair" : "grab", touchAction: "none" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClearSelection?.();
      }}
      {...handlers}
    >
      <ArrowDefs color={dimColor} />
      <MaterialPatternDefs
        imageUrl={topBandImageAndZone(material).imageUrl}
        zone={topBandImageAndZone(material).zone}
        patternId="material-pattern-top"
        diameterMm={solidMaxRadius * 2}
        heightMm={solidMaxRadius * 2}
      />

      {mode === "solid" ? (
        <>
          <path
            d={topPath(maxOutline)}
            fill={solidFill(topBandImageAndZone(material).imageUrl, "material-pattern-top", "#f3ead9")}
            stroke={STROKE}
            strokeWidth={1.1}
            strokeLinejoin="round"
          />
          {!mouthIsWidest && <path d={topPath(mouthOutline)} fill="none" stroke={STROKE} strokeWidth={0.9} strokeLinejoin="round" />}
          <path d={topPath(bottomOutline)} fill="none" stroke="#9a9a9a" strokeWidth={0.8} strokeDasharray="6 3" strokeLinejoin="round" />
        </>
      ) : (
        <TubeWireframe segments={framePolylines} color={frameColor} />
      )}
      {noteLayer}
      {textBoxLayer}
      {customDimLayer}
    </svg>
  );
}

export function IsoSVG({
  drawing,
  mode = "solid",
  tubes,
  frameColor,
  fontScale = 1,
  dimColor = "#2f6fb3",
  notes = [],
  onNotesChange,
  noteMode = false,
  textBoxes = [],
  onTextBoxesChange,
  textBoxMode = false,
  onTextBoxPlaced,
  handlePaths,
  material,
  isoAngle = DEFAULT_ISO_ANGLE,
  fixedHalfExtent,
  panX = 0,
  panY = 0,
  onPanChange,
  selectedNoteId = null,
  onSelectNote,
  selectedTextBoxId = null,
  onSelectTextBox,
  onClearSelection,
}: ElevationProps) {
  const fontSize = BASE_FONT * fontScale;
  const { handlers: noteHandlers, layer: noteLayer } = useNoteLayer({
    notes,
    onNotesChange: onNotesChange ?? (() => {}),
    noteMode,
    fontSize,
    color: dimColor,
    selectedId: selectedNoteId,
    onSelectDim: onSelectNote,
  });
  const { handlers: textBoxHandlers, layer: textBoxLayer } = useTextBoxLayer({
    textBoxes,
    onTextBoxesChange: onTextBoxesChange ?? (() => {}),
    textBoxMode,
    fontSize,
    color: dimColor,
    selectedId: selectedTextBoxId,
    onSelectDim: onSelectTextBox,
    onPlaced: onTextBoxPlaced,
  });
  const panHandlers = usePanDrag({ x: panX, y: panY }, onPanChange);
  const handlers = noteMode ? noteHandlers : textBoxMode ? textBoxHandlers : panHandlers;
  const { outline, mouthEllipse, bottomEllipse, minZ, maxZ, maxRadius } = useMemo(() => buildIsoViewData(drawing, isoAngle), [drawing, isoAngle]);

  const framePolylines = useMemo(() => {
    if (mode !== "frame" || !tubes) return [];
    return projectTubesIso(tubes, isoAngle);
  }, [mode, tubes, isoAngle]);

  const handleLines = useMemo(() => {
    if (mode !== "solid" || !handlePaths?.length) return [];
    return projectPathsIso(handlePaths, isoAngle);
  }, [mode, handlePaths, isoAngle]);

  const solidPts = [...outline, ...mouthEllipse, ...bottomEllipse, ...handleLines.flat()];
  const allPts = mode === "frame" ? framePolylines.flatMap((seg) => seg.points) : solidPts;
  const xs = allPts.map((p) => p[0]);
  const ys = allPts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const margin = (maxX - minX) * 0.12 + 16;
  // Grown (never shrunk) to the shared scale — see orthoHalfExtent — around
  // the content's OWN center, so Iso never clips regardless of how its
  // isometric projection's bounding box compares to Front/Side/Top's; it
  // just ends up with more surrounding blank space once the others need a
  // bigger frame than Iso's own content strictly requires.
  const shared = fixedHalfExtent ?? orthoHalfExtent(drawing);
  const halfW = fixedHalfExtent ?? Math.max((maxX - minX) / 2 + margin, shared);
  const halfH = fixedHalfExtent ?? Math.max((maxY - minY) / 2 + margin, shared);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const vbX = centerX - halfW + panX;
  const vbY = centerY - halfH + panY;
  const vbW = halfW * 2;
  const vbH = halfH * 2;

  const path = (pts: Polyline, close: boolean) =>
    pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ") + (close ? " Z" : "");

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      className="h-full w-full"
      style={{ cursor: noteMode || textBoxMode ? "crosshair" : "grab", touchAction: "none" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClearSelection?.();
      }}
      {...handlers}
    >
      <ArrowDefs color={dimColor} />
      {!(material?.enabled && material.imageDataUrl && material.splits.length > 0) && (
        <MaterialPatternDefs
          imageUrl={material?.enabled ? material.imageDataUrl : null}
          zone={wholeBodyZone(material)}
          patternId="material-pattern-iso"
          diameterMm={maxRadius * 2}
          heightMm={maxZ - minZ}
        />
      )}
      <MaterialPatternDefs
        imageUrl={topBandImageAndZone(material).imageUrl}
        zone={topBandImageAndZone(material).zone}
        patternId="material-pattern-top-for-iso"
        diameterMm={maxRadius * 2}
        heightMm={maxZ - minZ}
      />
      {mode === "solid" ? (
        <>
          <path d={path(bottomEllipse, true)} fill="none" stroke="#9a9a9a" strokeWidth={0.8} strokeDasharray="6 3" />
          {material?.enabled && material.imageDataUrl && material.splits.length > 0 ? (
            <MaterialBandFills
              rows={drawing.rows}
              material={material}
              minZ={minZ}
              maxZ={maxZ}
              sliceForPath={(zLow, zHigh) => sliceIsoOutline(drawing, zLow, zHigh, isoAngle)}
              toPath={(pts) => path(pts, true)}
              patternIdPrefix="material-iso"
            />
          ) : (
            <path
              d={path(outline, true)}
              fill={solidFill(material?.enabled ? material.imageDataUrl : null, "material-pattern-iso", "#f3ead9")}
              stroke={STROKE}
              strokeWidth={1.1}
              strokeLinejoin="round"
            />
          )}
          <path d={path(mouthEllipse, true)} fill={solidFill(topBandImageAndZone(material).imageUrl, "material-pattern-top-for-iso", "#e9dcc2")} stroke={STROKE} strokeWidth={1} />
          <WireframePaths polylines={handleLines} color={HANDLE_GUIDE_COLOR} strokeWidth={1} />
        </>
      ) : (
        <TubeWireframe segments={framePolylines} color={frameColor} />
      )}
      {noteLayer}
      {textBoxLayer}
    </svg>
  );
}
