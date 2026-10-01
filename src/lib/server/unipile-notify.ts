import { readLinkToken } from "./link-token";
import { linkMemberAccount } from "./linkedin-accounts";

/**
 * Public endpoint Unipile calls when someone finishes the hosted LinkedIn connect wizard:
 * POST /api/unipile/notify  { status: "CREATION_SUCCESS" | "RECONNECTED", account_id, name }.
 * It sits outside basic auth (Unipile cannot log in), so it trusts nothing but the signed
 * token Lily put in `name` when it created the link.
 */
export const NOTIFY_PATH = "/api/unipile/notify";

export async function handleUnipileNotify(request: Request): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  let payload: { status?: string; account_id?: string; name?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return json({ ok: false, error: "invalid body" }, 400);
  }
  const memberKey = await readLinkToken(payload.name);
  if (!memberKey) return json({ ok: false, error: "unknown link" }, 403);
  if (payload.status !== "CREATION_SUCCESS" && payload.status !== "RECONNECTED") {
    return json({ ok: true, ignored: payload.status ?? null });
  }
  if (!payload.account_id || !/^[A-Za-z0-9_-]{5,64}$/.test(payload.account_id)) {
    return json({ ok: false, error: "missing account" }, 400);
  }
  try {
    await linkMemberAccount(memberKey, payload.account_id);
    return json({ ok: true });
  } catch (error) {
    console.error("[lily] unipile notify failed", error);
    return json({ ok: false, error: "could not link account" }, 500);
  }
}
