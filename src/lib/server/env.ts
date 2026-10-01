// Server-only environment access.
// In production (Vercel etc.) variables come from the platform. In local dev Vite does not
// expose non-VITE_ variables to process.env, so we read .env.local once on first use.

let loaded = false;

async function loadLocalEnv() {
  if (loaded) return;
  loaded = true;
  if (process.env["LILY_N8N_SECRET"]) return;
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = path.resolve(process.cwd(), ".env.local");
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      const key = match[1] ?? "";
      const raw = match[2] ?? "";
      if (!key || process.env[key] !== undefined) continue;
      process.env[key] = raw.replace(/^["']|["']$/g, "");
    }
  } catch {
    // Not running on Node with a filesystem; rely on platform env.
  }
}

export async function env(name: string): Promise<string> {
  await loadLocalEnv();
  return process.env[name] ?? "";
}

export async function requireEnv(name: string, hint?: string): Promise<string> {
  const value = await env(name);
  if (!value) {
    throw new Error(`${name} is not configured on the server.${hint ? ` ${hint}` : ""}`);
  }
  return value;
}
