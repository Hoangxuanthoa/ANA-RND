// Shared between the two upload paths (the small-file relay through our
// own server, and the presigned-URL direct-to-R2 path for anything too
// big for that relay) and both client and server code — one allowlist,
// so they never drift apart. No server-only imports here on purpose.
export const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  // Project attachments (brief, moodboard, spec sheet) aren't always
  // images — everything else here is deliberately still an allowlist,
  // not "anything goes", to keep R2 from becoming an arbitrary file host.
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/zip": "zip",
};

// Vercel serverless functions hard-reject any request body over ~4.5MB
// at the platform level (FUNCTION_PAYLOAD_TOO_LARGE) before our own
// route code even runs — confirmed by testing directly against
// production. Anything under this goes through the simple one-request
// relay (/api/upload); anything over needs the presigned direct-to-R2
// path instead (/api/upload/presign) since that's the only way to get a
// large file past Vercel's own limit at all.
export const RELAY_MAX_BYTES = 4 * 1024 * 1024;

// The presigned path talks straight to R2, not through our own
// serverless function, so Vercel's body-size ceiling doesn't apply —
// this is just a sane upper bound so an internal tool with a handful of
// trusted users doesn't become an unbounded file host. Raise it if a
// real need for bigger files ever comes up.
export const PRESIGNED_MAX_BYTES = 100 * 1024 * 1024;
