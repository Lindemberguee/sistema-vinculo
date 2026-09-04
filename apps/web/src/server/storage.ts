import "server-only";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "@donation/shared";
import { env, isStorageConfigured } from "@/env";

/**
 * Private object storage for KYC documents. The bucket is never public; reads
 * only ever happen through short-lived signed URLs handed to authorized users.
 * The client is built lazily so the app boots without storage configured.
 */
let client: S3Client | undefined;

function s3(): S3Client {
  if (!isStorageConfigured) {
    throw new AppError("storage_unconfigured", "Armazenamento de arquivos não está configurado (S3_*).", 503);
  }
  return (client ??= new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: true, // required for MinIO / most S3-compatible stores
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
  }));
}

export const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function buildKycKey(orgId: string, kind: string, ext: string): string {
  return `kyc/${orgId}/${kind}/${crypto.randomUUID()}.${ext}`;
}

/** Image types accepted for e-mail template assets. */
export const EMAIL_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export const MAX_EMAIL_IMAGE_BYTES = 2 * 1024 * 1024;

export function buildEmailAssetKey(orgId: string, ext: string): string {
  return `email-assets/${orgId}/${crypto.randomUUID()}.${ext}`;
}

/** Fetch an object's bytes on the server (used by the public e-mail-asset proxy). */
export async function fetchObject(key: string): Promise<{ body: ReadableStream; contentType: string } | null> {
  const res = await s3().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  const body = res.Body as unknown as ReadableStream | undefined;
  if (!body) return null;
  return { body, contentType: res.ContentType ?? "application/octet-stream" };
}

/** Presigned PUT the browser uses to upload directly to storage. */
export function presignUpload(key: string, contentType: string) {
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: contentType }), {
    expiresIn: 300,
  });
}

/** Presigned GET for an authorized reviewer to view a document. */
export function presignDownload(key: string) {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), { expiresIn: 120 });
}

/** Verify a direct-to-storage upload exists and return its server-side metadata. */
export async function headObject(key: string): Promise<{ contentType?: string; contentLength?: number } | null> {
  try {
    const result = await s3().send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return { contentType: result.ContentType, contentLength: result.ContentLength };
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw err;
  }
}
