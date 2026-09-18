// Cloudflare R2 via the generic S3-compatible protocol (not an R2-specific
// SDK) — an S3 client pointed at R2's endpoint works because R2 speaks the
// same API, so swapping to another S3-compatible provider later is just a
// config change, not a rewrite. Server-only: never import from client code.
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: "auto",
    endpoint: `https://${requiredEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
    forcePathStyle: true,
  });
  return client;
}

export async function uploadFile(input: {
  buffer: Buffer;
  key: string;
  contentType: string;
}): Promise<{ url: string; key: string }> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: requiredEnv("R2_BUCKET_NAME"),
      Key: input.key,
      Body: input.buffer,
      ContentType: input.contentType,
    }),
  );
  const publicUrl = requiredEnv("R2_PUBLIC_URL").replace(/\/$/, "");
  return { url: `${publicUrl}/${input.key}`, key: input.key };
}

// A file too big for our own relay (/api/upload — see RELAY_MAX_BYTES)
// uploads straight from the browser to R2 instead, bypassing Vercel's
// serverless request-size ceiling entirely. Requires the R2 bucket's
// CORS policy to allow PUT from the app's own origins — the bucket's S3
// API endpoint (this one) honors bucket CORS normally, unlike the free
// public r2.dev URL used for reads (see api/image-proxy/route.ts).
export async function getPresignedUploadUrl(input: { key: string; contentType: string }): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: requiredEnv("R2_BUCKET_NAME"),
    Key: input.key,
    ContentType: input.contentType,
  });
  return getSignedUrl(getClient(), command, { expiresIn: 300 });
}

export async function deleteFile(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: requiredEnv("R2_BUCKET_NAME"),
      Key: key,
    }),
  );
}
