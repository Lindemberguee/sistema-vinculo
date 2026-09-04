import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const configured = Boolean(
  process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY,
);

let client: S3Client | undefined;
function s3(): S3Client {
  if (!configured) throw new Error("Object storage is not configured (S3_*) — CSV export needs it");
  return (client ??= new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  }));
}

export async function putObject(key: string, body: string | Buffer, contentType: string): Promise<void> {
  await s3().send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key, Body: body, ContentType: contentType }));
}
