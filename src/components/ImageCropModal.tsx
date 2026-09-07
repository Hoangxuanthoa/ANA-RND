"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { getCroppedImageUrl } from "@/lib/cropImage";

interface ImageCropModalProps {
  open: boolean;
  imageSrc: string;
  onCancel: () => void;
  onCropped: (url: string) => void;
}

// Every image upload in the app is cropped to a square before it's
// stored — Library/Collection grids and the PPTX export all show
// thumbnails, and a fixed 1:1 crop at upload time keeps those consistent
// instead of relying on each container's own CSS object-fit cropping a
// different part of the image.
export function ImageCropModal({ open, imageSrc, onCancel, onCropped }: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_croppedArea: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  if (!open) return null;

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setBusy(true);
    try {
      const url = await getCroppedImageUrl(imageSrc, croppedAreaPixels);
      onCropped(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-[420px] flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-md">
        <h3 className="text-[15px] font-bold">Cắt ảnh (vuông 1:1)</h3>

        <div className="relative h-[320px] w-full overflow-hidden rounded-lg bg-bg">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </label>

        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-bold hover:bg-bg"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !croppedAreaPixels}
            className="h-9 rounded-lg bg-accent px-3.5 text-[13px] font-bold text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {busy ? "Đang xử lý…" : "Cắt ảnh"}
          </button>
        </div>
      </div>
    </div>
  );
}
