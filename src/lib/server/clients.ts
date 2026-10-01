import { env, requireEnv } from "./env";

type Query = Record<string, string | number | undefined | null>;

function withQuery(base: string, query?: Query) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "")
      url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function readError(response: Response) {
  const text = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(text) as {
      title?: string;
      detail?: string;
      message?: string;
      error?: string;
    };
    return parsed.detail || parsed.title || parsed.message || parsed.error || text;
  } catch {
    return text;
  }
}

/** Calls the Unipile API with the server-side key. Adds account_id to every request. */
export async function unipile<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "DELETE";
    query?: Query;
    json?: unknown;
    form?: Record<string, string>;
  } = {},
): Promise<T> {
  const dsn = ((await env("UNIPILE_DSN")) || "https://api24.unipile.com:15454").replace(/\/$/, "");
  const key = await requireEnv(
    "UNIPILE_API_KEY",
    "Add the current Unipile key to the server environment.",
  );
  const accountId = await requireEnv("UNIPILE_ACCOUNT_ID");

  const headers: Record<string, string> = { "X-API-KEY": key, Accept: "application/json" };
  let body: BodyInit | null = null;
  if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    // Unipile write endpoints expect account_id in the JSON body as well as the query.
    const payload =
      options.json && typeof options.json === "object" && !Array.isArray(options.json)
        ? { account_id: accountId, ...(options.json as Record<string, unknown>) }
        : options.json;
    body = JSON.stringify(payload);
  } else if (options.form) {
    const form = new FormData();
    for (const [k, v] of Object.entries(options.form)) form.append(k, v);
    body = form;
  }

  const response = await fetch(
    withQuery(`${dsn}/api/v1${path}`, { account_id: accountId, ...options.query }),
    {
      method: options.method ?? "GET",
      headers,
      body,
    },
  );
  if (!response.ok) {
    throw new Error(
      `LinkedIn (Unipile) request failed, ${response.status}: ${(await readError(response)).slice(0, 240)}`,
    );
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

/** Calls the "Lily - API" n8n workflow, which owns the Google Sheets and campaign table. */
export async function n8n<T>(
  path: string,
  options: { method?: "GET" | "POST"; json?: unknown } = {},
): Promise<T> {
  const base = ((await env("N8N_BASE_URL")) || "https://newscatcher.app.n8n.cloud").replace(
    /\/$/,
    "",
  );
  const secret = await requireEnv("LILY_N8N_SECRET");
  const response = await fetch(`${base}/webhook/${path}`, {
    method: options.method ?? "GET",
    headers: {
      "x-lily-key": secret,
      Accept: "application/json",
      ...(options.json !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: options.json !== undefined ? JSON.stringify(options.json) : null,
  });
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Automation backend returned an unexpected response (${response.status}).`);
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    "message" in parsed &&
    (parsed as { message: string }).message === "Webhook call received"
  ) {
    throw new Error("Automation backend rejected the request. Check LILY_N8N_SECRET.");
  }
  if (!response.ok) {
    const err = (parsed as { error?: string })?.error;
    throw new Error(err || `Automation backend error (${response.status}).`);
  }
  return parsed as T;
}
