import { timingSafeEqual } from "node:crypto";

export function isProcessorAuthorizationValid(
  authorization: string | null,
  secretValue: string | undefined,
) {
  const secret = secretValue?.trim();
  if (!secret || !authorization?.startsWith("Bearer ")) return false;

  const supplied = authorization.slice("Bearer ".length);
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  if (expectedBytes.length !== suppliedBytes.length) return false;
  return timingSafeEqual(expectedBytes, suppliedBytes);
}
