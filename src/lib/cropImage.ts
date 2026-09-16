// Canvas-based crop, following react-easy-crop's own documented recipe:
// draw only the cropped pixel rectangle onto a canvas sized to match,
// then export that canvas as a real Blob. Callers that need a real,
// persisted image (any product/photo upload) pass the blob to
// uploadFile() themselves rather than getting a session-only blob: URL
// back — see ImageCropModal/BulkUploadModal for the upload step.
export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (e) => reject(e));
    img.src = url;
  });
}

// Auto center-crop to a square — used by bulk upload, where there's no
// per-image interactive crop step (see ImageCropModal for the manual
// version used everywhere else a single image is uploaded).
export async function autoSquareCropBlob(imageSrc: string): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const size = Math.min(image.naturalWidth, image.naturalHeight);
  const x = (image.naturalWidth - size) / 2;
  const y = (image.naturalHeight - size) / 2;
  return getCroppedImageBlob(imageSrc, { x, y, width: size, height: size });
}

export async function getCroppedImageBlob(imageSrc: string, crop: PixelCrop): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not supported");
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Crop failed"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.92,
    );
  });
}
