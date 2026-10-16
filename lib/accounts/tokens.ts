import { createHash, randomBytes } from "node:crypto";

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}
