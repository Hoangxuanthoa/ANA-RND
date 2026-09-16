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

// A blob: URL (the interactive crop source — always a just-picked local
// file) is same-origin and loads directly. A real http(s) URL (cropping
// an already-uploaded R2 photo, e.g. Ảnh dự án's "Release ảnh" flow) is
// cross-origin — and R2's free public "r2.dev" URL doesn't send
// Access-Control-Allow-Origin even with a CORS policy configured on the
// bucket (only a custom domain honors it), so drawing it straight onto
// a canvas taints the canvas and canvas.toBlob() throws a SecurityError.
// Routing it through our own /api/image-proxy first makes it same-origin
// instead, sidestepping the whole issue.
function loadImage(url: string): Promise<HTMLImageElement> {
  const src = url.startsWith("blob:") ? url : `/api/image-proxy?url=${encodeURIComponent(url)}`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (e) => reject(e));
    img.src = src;
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
