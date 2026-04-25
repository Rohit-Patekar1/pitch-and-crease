import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "pc_admin";
const SEVEN_DAYS = 60 * 60 * 24 * 7;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET env var is missing or too short");
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

/** Sign a session token for the given timestamp. */
export function makeSessionToken(): string {
  const ts = Date.now().toString();
  return `${ts}.${sign(ts)}`;
}

/** Verify a session cookie value. Returns true if valid and not expired. */
export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [tsStr, sig] = token.split(".");
  if (!tsStr || !sig) return false;
  const expected = sign(tsStr);
  if (expected.length !== sig.length) return false;
  if (!timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"))) return false;
  const ts = Number(tsStr);
  if (!Number.isFinite(ts)) return false;
  const ageSeconds = (Date.now() - ts) / 1000;
  return ageSeconds >= 0 && ageSeconds <= SEVEN_DAYS;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SEVEN_DAYS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  if (input.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(input), Buffer.from(expected));
}
