import { createHmac, timingSafeEqual } from "node:crypto";
import { requireEnv } from "./env";

/**
 * Unipile's hosted auth wizard echoes back the `name` we give it in its notify callback.
 * We put a signed, expiring token there so the public notify endpoint only accepts
 * connections that Lily itself started, for the team member it started them for.
 *
 * Format: lily1.<member key>.<expiry unix seconds>.<signature>
 */
const PREFIX = "lily1";

async function sign(payload: string) {
  const secret = await requireEnv("LILY_N8N_SECRET");
  return createHmac("sha256", secret).update(payload).digest("base64url").slice(0, 32);
}

export async function createLinkToken(memberKey: string, ttlSeconds: number) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${PREFIX}.${memberKey}.${exp}`;
  return `${payload}.${await sign(payload)}`;
}

/** Returns the member key when the token is genuine. Expired tokens get a grace day, since
 * Unipile can deliver the callback a little after the link itself expired. */
export async function readLinkToken(token: unknown): Promise<string | null> {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== PREFIX) return null;
  const [, key, expRaw, sig] = parts as [string, string, string, string];
  if (!/^[a-z0-9-]{1,60}$/.test(key)) return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp + 86_400 < Date.now() / 1000) return null;
  const expected = Buffer.from(await sign(`${PREFIX}.${key}.${expRaw}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return key;
}
