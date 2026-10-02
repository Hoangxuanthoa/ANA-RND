"use client";

import { useEffect, useRef, useState } from "react";
import { autoSuggestRingZs, buildRingsFromTrace, computeCalibration, tracePointsToMm } from "@/lib/breakdown/geometry/photoCalibration";
import { detectSilhouette } from "@/lib/breakdown/geometry/photoEdgeDetect";
import { buildDiameterSpline } from "@/lib/breakdown/geometry/photoSpline";
import { DEFAULT_PHOTO_TRACE, type PhotoTraceInput, type PhotoTracePoint, type RingInput } from "@/lib/breakdown/geometry/types";
import { Field, inputClass } from "./field";

const MAX_W = 420;
const MAX_H = 460;
const HIT_RADIUS_DISPLAY = 8;
const AXIS_HIT_DISPLAY = 6;
const ZOOM_MIN = 1;
const ZOOM_MAX = 6;
const ZOOM_STEP = 0.5;
const WHEEL_ZOOM_FACTOR = 0.0015;
const UNDO_DEBOUNCE_MS = 500;
const UNDO_STACK_LIMIT = 50;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

type DragKind = { type: "point"; index: number } | { type: "axis" } | { type: "marquee"; start: { xPx: number; yPx: number } };

const DEFAULT_SAMPLE_ROWS = 48;
const MIN_SAMPLE_ROWS = 8;
const MAX_SAMPLE_ROWS = 150;

export function PhotoTraceForm({
  value,
  onChange,
  onApply,
}: {
  value: PhotoTraceInput;
  onChange: (v: PhotoTraceInput) => void;
  onApply: (rings: RingInput[], photoCurve: { z: number; diameter: number }[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragKindRef = useRef<DragKind | null>(null);
  const zoomAnchorRef = useRef<{ xPx: number; yPx: number; viewX: number; viewY: number } | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [dragPreview, setDragPreview] = useState<{ points: PhotoTracePoint[]; axisXPx: number } | null>(null);
  // Kept as raw text (not a clamped number) so typing a multi-digit value
  // works normally — clamping on every keystroke made the field jump to a
  // half-typed, already-clamped value instead of letting the user finish
  // typing. Clamped only when actually used (detection, or on blur to tidy
  // the display).
  const [sampleRowsInput, setSampleRowsInput] = useState(String(DEFAULT_SAMPLE_ROWS));
  const sampleRows = clamp(parseInt(sampleRowsInput, 10) || DEFAULT_SAMPLE_ROWS, MIN_SAMPLE_ROWS, MAX_SAMPLE_ROWS);
  const hasDetectedRef = useRef(false);
  const sampleRowsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [marquee, setMarquee] = useState<{ start: { xPx: number; yPx: number }; end: { xPx: number; yPx: number } } | null>(null);

  // Undo/redo: burst-debounced so rapid edits (typing digits, dragging a
  // point) collapse into ONE step instead of one per keystroke/pixel — only
  // the first commit() after a UNDO_DEBOUNCE_MS gap pushes to history.
  const [history, setHistory] = useState<PhotoTraceInput[]>([]);
  const [future, setFuture] = useState<PhotoTraceInput[]>([]);
  const lastCommitTimeRef = useRef(0);

  function commit(next: PhotoTraceInput) {
    const now = Date.now();
    if (now - lastCommitTimeRef.current > UNDO_DEBOUNCE_MS) {
      setHistory((h) => [...h, value].slice(-UNDO_STACK_LIMIT));
      setFuture([]);
    }
    lastCommitTimeRef.current = now;
    onChange(next);
  }

  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [value, ...f].slice(0, UNDO_STACK_LIMIT));
    lastCommitTimeRef.current = 0;
    onChange(prev);
  }

  function redo() {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, value].slice(-UNDO_STACK_LIMIT));
    lastCommitTimeRef.current = 0;
    onChange(next);
  }

  useEffect(() => {
    if (!value.imageDataUrl) return;
    const el = new window.Image();
    el.onload = () => setImg(el);
    el.src = value.imageDataUrl;
  }, [value.imageDataUrl]);

  const baseScale = value.imageWidth && value.imageHeight ? Math.min(MAX_W / value.imageWidth, MAX_H / value.imageHeight) : 1;
  const scale = baseScale * zoom;
  const scaleRef = useRef(scale);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  const canvasW = Math.round(value.imageWidth * scale);
  const canvasH = Math.round(value.imageHeight * scale);
  const displayPoints = dragPreview?.points ?? value.points;
  const displayAxis = dragPreview?.axisXPx ?? value.axisXPx;
  const liveTrace = { ...value, points: displayPoints, axisXPx: displayAxis };
  const calibration = computeCalibration(liveTrace);
  const mmPoints = tracePointsToMm(liveTrace);
  const spline = mmPoints.length >= 2 ? buildDiameterSpline(mmPoints) : null;
  const effectiveRingZMm = value.ringZMm.length > 0 ? value.ringZMm : calibration.scaleMmPerPx ? autoSuggestRingZs(liveTrace) : [];
  const sortedRingZMm = [...effectiveRingZMm].sort((a, b) => b - a);
  const sortedDisplayPoints = [...displayPoints].sort((a, b) => a.yPx - b.yPx);
  const bottomYPx = sortedDisplayPoints[sortedDisplayPoints.length - 1]?.yPx ?? 0;

  function updateRingZMm(next: number[]) {
    commit({ ...value, ringZMm: [...new Set(next.map((z) => Math.round(z)))].sort((a, b) => b - a) });
  }

  // Wheel zoom (cursor-anchored): re-attaches whenever the scroll container
  // (re)mounts, e.g. once an image finishes loading. Reads scaleRef so it
  // never needs to depend on — and re-attach for — every zoom change.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = container!.getBoundingClientRect();
      const viewX = e.clientX - rect.left;
      const viewY = e.clientY - rect.top;
      zoomAnchorRef.current = {
        xPx: (container!.scrollLeft + viewX) / scaleRef.current,
        yPx: (container!.scrollTop + viewY) / scaleRef.current,
        viewX,
        viewY,
      };
      setZoom((z) => clamp(z * (1 - e.deltaY * WHEEL_ZOOM_FACTOR), ZOOM_MIN, ZOOM_MAX));
    }
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [value.imageDataUrl]);

  // Keeps whatever image point was under the cursor fixed on screen as zoom changes.
  useEffect(() => {
    const container = scrollRef.current;
    const anchor = zoomAnchorRef.current;
    if (!container || !anchor) return;
    container.scrollLeft = anchor.xPx * scale - anchor.viewX;
    container.scrollTop = anchor.yPx * scale - anchor.viewY;
    zoomAnchorRef.current = null;
  }, [scale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (!value.boundaryLocked) {
      const axisXDisp = displayAxis * scale;
      ctx.strokeStyle = "rgba(37,99,235,0.85)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(axisXDisp, 0);
      ctx.lineTo(axisXDisp, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);

      const sorted = sortedDisplayPoints;

      ctx.strokeStyle = "#16a34a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      sorted.forEach((p, i) => {
        const x = p.xPx * scale;
        const y = p.yPx * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.strokeStyle = "rgba(22,163,74,0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      sorted.forEach((p, i) => {
        const x = (2 * displayAxis - p.xPx) * scale;
        const y = p.yPx * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      sorted.forEach((p) => {
        const x = p.xPx * scale;
        const y = p.yPx * scale;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#16a34a";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      if (marquee) {
        const xMin = Math.min(marquee.start.xPx, marquee.end.xPx) * scale;
        const xMax = Math.max(marquee.start.xPx, marquee.end.xPx) * scale;
        const yMin = Math.min(marquee.start.yPx, marquee.end.yPx) * scale;
        const yMax = Math.max(marquee.start.yPx, marquee.end.yPx) * scale;
        ctx.fillStyle = "rgba(220,38,38,0.1)";
        ctx.fillRect(xMin, yMin, xMax - xMin, yMax - yMin);
        ctx.strokeStyle = "rgba(220,38,38,0.85)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(xMin, yMin, xMax - xMin, yMax - yMin);
        ctx.setLineDash([]);
      }
    }

    if (calibration.scaleMmPerPx && spline && sortedDisplayPoints.length >= 2) {
      const scaleMmPerPx = calibration.scaleMmPerPx;
      const heightMm = calibration.heightMm ?? 0;
      const STEPS = 60;

      [1, -1].forEach((side) => {
        ctx.strokeStyle = "#ea580c";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= STEPS; i++) {
          const zMm = (i / STEPS) * heightMm;
          const yPx = bottomYPx - zMm / scaleMmPerPx;
          const halfWidthPx = spline(zMm) / 2 / scaleMmPerPx;
          const x = (displayAxis + side * halfWidthPx) * scale;
          const y = yPx * scale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      sortedRingZMm.forEach((zMm) => {
        const yPx = bottomYPx - zMm / scaleMmPerPx;
        const halfWidthPx = spline(zMm) / 2 / scaleMmPerPx;
        const y = yPx * scale;
        ctx.strokeStyle = "rgba(234,88,12,0.5)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
        ctx.setLineDash([]);
        [displayAxis + halfWidthPx, displayAxis - halfWidthPx].forEach((xPxPos) => {
          const x = xPxPos * scale;
          ctx.fillStyle = "#ea580c";
          ctx.fillRect(x - 4, y - 4, 8, 8);
        });
      });
    }
  }, [img, displayPoints, displayAxis, scale, canvasW, canvasH, calibration.scaleMmPerPx, calibration.heightMm, spline, sortedRingZMm, value.boundaryLocked, sortedDisplayPoints, bottomYPx, marquee]);

  function toImageCoords(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPx = clamp((e.clientX - rect.left) / scale, 0, value.imageWidth);
    const yPx = clamp((e.clientY - rect.top) / scale, 0, value.imageHeight);
    return { xPx, yPx };
  }

  function hitTestPoint(points: PhotoTracePoint[], xPx: number, yPx: number): number | null {
    const radiusPx = HIT_RADIUS_DISPLAY / scale;
    let best: number | null = null;
    let bestDist = radiusPx;
    points.forEach((p, i) => {
      const d = Math.hypot(p.xPx - xPx, p.yPx - yPx);
      if (d <= bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }

  function hitTestRingZ(yPx: number): number | null {
    if (!calibration.scaleMmPerPx) return null;
    const tolerancePx = HIT_RADIUS_DISPLAY / scale;
    let best: number | null = null;
    let bestDist = tolerancePx;
    sortedRingZMm.forEach((z) => {
      const ringYPx = bottomYPx - z / calibration.scaleMmPerPx!;
      const d = Math.abs(ringYPx - yPx);
      if (d <= bestDist) {
        bestDist = d;
        best = z;
      }
    });
    return best;
  }

  function handleRingClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!calibration.scaleMmPerPx) return;
    const { yPx } = toImageCoords(e);
    const hit = hitTestRingZ(yPx);
    if (hit !== null) {
      updateRingZMm(sortedRingZMm.filter((z) => z !== hit));
      return;
    }
    const zMm = clamp((bottomYPx - yPx) * calibration.scaleMmPerPx, 0, calibration.heightMm ?? Infinity);
    updateRingZMm([...sortedRingZMm, zMm]);
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (value.boundaryLocked) {
      handleRingClick(e);
      return;
    }
    const { xPx, yPx } = toImageCoords(e);
    if (e.shiftKey) {
      dragKindRef.current = { type: "marquee", start: { xPx, yPx } };
      setMarquee({ start: { xPx, yPx }, end: { xPx, yPx } });
      return;
    }
    const hitIdx = hitTestPoint(value.points, xPx, yPx);
    if (hitIdx !== null) {
      dragKindRef.current = { type: "point", index: hitIdx };
      setDragPreview({ points: value.points, axisXPx: value.axisXPx });
      return;
    }
    if (Math.abs(xPx - value.axisXPx) <= AXIS_HIT_DISPLAY / scale) {
      dragKindRef.current = { type: "axis" };
      setDragPreview({ points: value.points, axisXPx: value.axisXPx });
      return;
    }
    const newPoints = [...value.points, { xPx, yPx }];
    dragKindRef.current = { type: "point", index: value.points.length };
    setDragPreview({ points: newPoints, axisXPx: value.axisXPx });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const kind = dragKindRef.current;
    if (!kind) return;
    const { xPx, yPx } = toImageCoords(e);
    if (kind.type === "marquee") {
      setMarquee({ start: kind.start, end: { xPx, yPx } });
      return;
    }
    setDragPreview((prev) => {
      if (!prev) return prev;
      if (kind.type === "axis") return { ...prev, axisXPx: xPx };
      const points = prev.points.slice();
      points[kind.index] = { xPx, yPx };
      return { ...prev, points };
    });
  }

  function handleMouseUp() {
    const kind = dragKindRef.current;
    if (kind?.type === "marquee" && marquee) {
      const xMin = Math.min(marquee.start.xPx, marquee.end.xPx);
      const xMax = Math.max(marquee.start.xPx, marquee.end.xPx);
      const yMin = Math.min(marquee.start.yPx, marquee.end.yPx);
      const yMax = Math.max(marquee.start.yPx, marquee.end.yPx);
      const kept = value.points.filter((p) => p.xPx < xMin || p.xPx > xMax || p.yPx < yMin || p.yPx > yMax);
      if (kept.length !== value.points.length) commit({ ...value, points: kept });
      dragKindRef.current = null;
      setMarquee(null);
      return;
    }
    if (dragKindRef.current && dragPreview) {
      commit({ ...value, points: dragPreview.points, axisXPx: dragPreview.axisXPx });
    }
    dragKindRef.current = null;
    setDragPreview(null);
  }

  function handleContextMenu(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (value.boundaryLocked) return;
    const { xPx, yPx } = toImageCoords(e);
    const hitIdx = hitTestPoint(value.points, xPx, yPx);
    if (hitIdx === null) return;
    commit({ ...value, points: value.points.filter((_, i) => i !== hitIdx) });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const probe = new window.Image();
      probe.onload = () => {
        hasDetectedRef.current = false;
        commit({
          ...DEFAULT_PHOTO_TRACE,
          imageDataUrl: dataUrl,
          imageWidth: probe.naturalWidth,
          imageHeight: probe.naturalHeight,
          axisXPx: probe.naturalWidth / 2,
          points: [],
        });
      };
      probe.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function runAutoDetect(rows = sampleRows) {
    if (!img || detecting) return;
    setDetecting(true);
    requestAnimationFrame(() => {
      const off = document.createElement("canvas");
      off.width = value.imageWidth;
      off.height = value.imageHeight;
      const octx = off.getContext("2d");
      if (!octx) {
        setDetecting(false);
        return;
      }
      octx.drawImage(img, 0, 0, value.imageWidth, value.imageHeight);
      const imageData = octx.getImageData(0, 0, value.imageWidth, value.imageHeight);
      const result = detectSilhouette(imageData, rows);
      if (result) commit({ ...value, axisXPx: result.axisXPx, points: result.points });
      hasDetectedRef.current = true;
      setDetecting(false);
    });
  }

  // Once the user has run auto-detect at least once, changing the point
  // count re-runs it immediately instead of waiting for another click —
  // debounced so it doesn't re-scan the image on every single keystroke
  // while typing a 2-3 digit number.
  function handleSampleRowsInput(text: string) {
    setSampleRowsInput(text);
    if (!hasDetectedRef.current) return;
    if (sampleRowsDebounceRef.current) clearTimeout(sampleRowsDebounceRef.current);
    const rows = clamp(parseInt(text, 10) || DEFAULT_SAMPLE_ROWS, MIN_SAMPLE_ROWS, MAX_SAMPLE_ROWS);
    sampleRowsDebounceRef.current = setTimeout(() => runAutoDetect(rows), 400);
  }

  if (!value.imageDataUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-2.5 rounded-lg border-2 border-dashed border-line bg-surface p-8 text-center">
        <span className="text-[13px] font-semibold text-text-muted">Dò biên dạng từ ảnh</span>
        <label className="cursor-pointer rounded-lg bg-accent px-4 py-2 text-[12.5px] font-bold text-white hover:bg-accent-hover">
          Chọn ảnh sản phẩm
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-wide text-text-muted uppercase">Dò biên dạng từ ảnh</span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={undo} disabled={history.length === 0} className="text-[12px] font-semibold text-text-muted hover:text-text disabled:opacity-30">
            ↶ Hoàn tác
          </button>
          <button type="button" onClick={redo} disabled={future.length === 0} className="text-[12px] font-semibold text-text-muted hover:text-text disabled:opacity-30">
            ↷ Làm lại
          </button>
          {!value.boundaryLocked && (
            <button type="button" onClick={() => commit({ ...value, points: [] })} className="text-[12px] font-semibold text-text-muted hover:text-text">
              Xóa điểm
            </button>
          )}
          <label className="cursor-pointer text-[12px] font-semibold text-accent hover:underline">
            Đổi ảnh
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>
          <button type="button" onClick={() => commit({ ...DEFAULT_PHOTO_TRACE, points: [] })} className="text-[12px] font-semibold text-red hover:underline">
            Xóa ảnh
          </button>
        </div>
      </div>

      {!value.boundaryLocked && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => runAutoDetect()}
            disabled={detecting}
            className="h-9 flex-1 rounded-lg bg-accent text-[12.5px] font-bold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {detecting ? "Đang dò biên..." : "Dò biên tự động"}
          </button>
          <label className="flex flex-shrink-0 items-center gap-1.5 text-[11.5px] text-text-muted">
            Số điểm
            <input
              type="number"
              min={MIN_SAMPLE_ROWS}
              max={MAX_SAMPLE_ROWS}
              value={sampleRowsInput}
              onChange={(e) => handleSampleRowsInput(e.target.value)}
              onBlur={() => setSampleRowsInput(String(sampleRows))}
              className="h-9 w-14 rounded-md border border-line bg-surface px-1.5 text-center text-[12px]"
            />
          </label>
        </div>
      )}

      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setZoom((z) => clamp(z - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
          disabled={zoom <= ZOOM_MIN}
          className="h-7 w-7 rounded-md border border-line text-[13px] font-bold text-text-muted hover:text-text disabled:opacity-40"
        >
          −
        </button>
        <span className="w-12 text-center text-[12px] text-text-muted">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={() => setZoom((z) => clamp(z + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
          disabled={zoom >= ZOOM_MAX}
          className="h-7 w-7 rounded-md border border-line text-[13px] font-bold text-text-muted hover:text-text disabled:opacity-40"
        >
          +
        </button>
      </div>

      <div ref={scrollRef} className="self-center overflow-auto rounded-md border border-line" style={{ maxWidth: MAX_W, maxHeight: MAX_H }}>
        <canvas
          ref={canvasRef}
          width={canvasW}
          height={canvasH}
          className="block cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={handleContextMenu}
        />
      </div>

      <p className="text-[11.5px] text-text-faint">
        {value.boundaryLocked
          ? "Click trên đường biên để thêm vòng ngang · click lại điểm đã đặt để xóa · lăn chuột để zoom"
          : `Click để thêm điểm biên · kéo điểm hoặc trục tâm để chỉnh · chuột phải để xóa 1 điểm · giữ Shift + kéo để quét xóa nhiều điểm · lăn chuột để zoom · ${displayPoints.length} điểm`}
      </p>

      <div className="flex flex-col gap-2.5 border-t border-line pt-2.5">
        <span className="text-[11px] font-bold tracking-wide text-text-muted uppercase">Khóa kích thước</span>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Miệng (mm)">
            <input
              type="number"
              value={value.mouthMmOverride ?? (calibration.mouthMm != null ? Math.round(calibration.mouthMm) : "")}
              onChange={(e) => commit({ ...value, mouthMmOverride: e.target.value === "" ? null : Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
          <Field label="Thân lớn nhất (mm)">
            <input
              type="number"
              value={value.maxBodyMmOverride ?? (calibration.maxDiameterMm != null ? Math.round(calibration.maxDiameterMm) : "")}
              onChange={(e) => commit({ ...value, maxBodyMmOverride: e.target.value === "" ? null : Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
          <Field label="Đáy (mm)">
            <input
              type="number"
              value={value.baseMmOverride ?? (calibration.baseMm != null ? Math.round(calibration.baseMm) : "")}
              onChange={(e) => commit({ ...value, baseMmOverride: e.target.value === "" ? null : Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
          <Field label="Chiều cao (mm)">
            <input
              type="number"
              value={value.heightMmOverride ?? (calibration.heightMm != null ? Math.round(calibration.heightMm) : "")}
              onChange={(e) => commit({ ...value, heightMmOverride: e.target.value === "" ? null : Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
        </div>
        {calibration.scaleMmPerPx && (
          <button
            type="button"
            onClick={() => commit({ ...value, boundaryLocked: !value.boundaryLocked })}
            className={
              value.boundaryLocked
                ? "h-9 rounded-lg border border-line text-[12.5px] font-bold text-text-muted hover:text-text"
                : "h-9 rounded-lg bg-accent text-[12.5px] font-bold text-white hover:bg-accent-hover"
            }
          >
            {value.boundaryLocked ? "Mở khóa đường biên" : "Khóa đường biên"}
          </button>
        )}
      </div>

      {calibration.scaleMmPerPx && (
        <div className="flex flex-col gap-2 border-t border-line pt-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wide text-text-muted uppercase">Vị trí vòng ngang</span>
            <button type="button" onClick={() => updateRingZMm(autoSuggestRingZs(value))} className="text-[12px] font-semibold text-accent hover:underline">
              Đề xuất lại
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {sortedRingZMm.map((z, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="number"
                  value={z}
                  onChange={(e) => {
                    const next = [...sortedRingZMm];
                    next[i] = Number(e.target.value);
                    updateRingZMm(next);
                  }}
                  className={`${inputClass} h-8 flex-1`}
                />
                <span className="w-24 flex-shrink-0 text-[12px] text-text-muted">⌀ {spline ? Math.round(spline(z)) : "-"} mm</span>
                <button
                  type="button"
                  onClick={() => updateRingZMm(sortedRingZMm.filter((_, idx) => idx !== i))}
                  className="flex-shrink-0 text-[12px] font-semibold text-red hover:underline"
                >
                  Xóa
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => updateRingZMm([...sortedRingZMm, Math.round((calibration.heightMm ?? 0) / 2)])}
            className="h-8 rounded-lg border border-line text-[12px] font-semibold text-text-muted hover:text-text"
          >
            + Thêm vòng
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          disabled={!calibration.scaleMmPerPx}
          onClick={() => {
            const rings = buildRingsFromTrace(value);
            if (rings) onApply(rings, tracePointsToMm(value));
          }}
          className="h-9 rounded-lg bg-accent text-[12.5px] font-bold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Dùng đường biên này cho Round
        </button>
      </div>
    </div>
  );
}
