import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Envelope encryption for secrets we must store and later use (connected gateway
 * API keys). AES-256-GCM. Stored blob: iv(12) || authTag(16) || ciphertext.
 *
 * Key: env `PAYMENTS_ENC_KEY` — 32 bytes, base64. Generate with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * Node-only (uses `node:crypto`) — never call from a client bundle.
 */
function key(): Buffer {
  const raw = process.env.PAYMENTS_ENC_KEY;
  if (!raw) throw new Error("PAYMENTS_ENC_KEY is not set — cannot store/read connected gateway secrets");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error(`PAYMENTS_ENC_KEY must decode to 32 bytes (got ${k.length})`);
  return k;
}

export function encryptSecret(plain: string): Uint8Array<ArrayBuffer> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const combined = Buffer.concat([iv, cipher.getAuthTag(), ct]);
  const buf = new ArrayBuffer(combined.length);
  new Uint8Array(buf).set(combined);
  return new Uint8Array(buf);
}

export function decryptSecret(blob: Buffer | Uint8Array): string {
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  if (buf.length < 29) throw new Error("encrypted secret blob is too short");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** Whether the encryption key is configured (so callers can degrade gracefully). */
export function isPaymentsCryptoReady(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}
