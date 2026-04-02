import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes, createHash } from "node:crypto";
import { ForgeError } from "@forge/core";

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32; // 256 bits for AES-256
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const APP_SALT = "forge:secrets:v1:application-salt";

/**
 * Derives a 256-bit AES key from a raw encryption key string using PBKDF2.
 * This ensures any 32+ character string can be used as a valid encryption key.
 */
function deriveKey(rawKey: string): Buffer {
  return pbkdf2Sync(rawKey, APP_SALT, PBKDF2_ITERATIONS, KEY_LENGTH, "sha512");
}

/**
 * Generates a stable key ID as a SHA-256 fingerprint of the raw encryption key.
 * Used to detect key rotations.
 */
function computeKeyId(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex").slice(0, 32);
}

export interface EncryptedResult {
  ciphertext: string;
  keyId: string;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * The output format is: base64(iv):base64(ciphertext):base64(authTag)
 */
export function encrypt(plaintext: string, rawKey: string): EncryptedResult {
  if (!rawKey || rawKey.length < 32) {
    throw new ForgeError(
      "INVALID_ENCRYPTION_KEY",
      500,
      "Encryption key must be at least 32 characters long"
    );
  }

  const key = deriveKey(rawKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const ciphertext = [
    iv.toString("base64"),
    encrypted.toString("base64"),
    authTag.toString("base64"),
  ].join(":");

  return {
    ciphertext,
    keyId: computeKeyId(rawKey),
  };
}

/**
 * Decrypts a ciphertext string encrypted with AES-256-GCM.
 *
 * Expects format: base64(iv):base64(ciphertext):base64(authTag)
 */
export function decrypt(ciphertext: string, rawKey: string): string {
  if (!rawKey || rawKey.length < 32) {
    throw new ForgeError(
      "INVALID_ENCRYPTION_KEY",
      500,
      "Encryption key must be at least 32 characters long"
    );
  }

  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new ForgeError(
      "INVALID_CIPHERTEXT_FORMAT",
      500,
      "Ciphertext must be in format: base64(iv):base64(ciphertext):base64(authTag)"
    );
  }

  const [ivB64, encryptedB64, authTagB64] = parts;

  let iv: Buffer;
  let encrypted: Buffer;
  let authTag: Buffer;

  try {
    iv = Buffer.from(ivB64, "base64");
    encrypted = Buffer.from(encryptedB64, "base64");
    authTag = Buffer.from(authTagB64, "base64");
  } catch {
    throw new ForgeError(
      "INVALID_CIPHERTEXT_ENCODING",
      500,
      "Ciphertext components must be valid base64"
    );
  }

  if (iv.length !== IV_LENGTH) {
    throw new ForgeError(
      "INVALID_CIPHERTEXT_IV",
      500,
      `IV must be ${IV_LENGTH} bytes, got ${iv.length}`
    );
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new ForgeError(
      "INVALID_CIPHERTEXT_AUTH_TAG",
      500,
      `Auth tag must be ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`
    );
  }

  const key = deriveKey(rawKey);

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("unsupported state")
        ? "Authentication failed: ciphertext may have been tampered with or was encrypted with a different key"
        : "Decryption failed: the ciphertext may be corrupted or was encrypted with a different key";

    throw new ForgeError("DECRYPTION_FAILED", 500, message);
  }
}
