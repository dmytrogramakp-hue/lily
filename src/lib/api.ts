import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { n8n, unipile } from "./server/clients";
import type {
  CampaignLead,
  CampaignSummary,
  GeneratedText,
  ChatMessage,
  ConversationSummary,
  Invitation,
  Person,
  SentSummary,
  UploadResult,
} from "./types";

/* ---------------------------------------------------------------- result envelope */
// Server functions return errors as data. Thrown errors from server functions are not
// reliably surfaced to the client in this TanStack Start version, so we never throw across
// the boundary. Use unwrap() on the client to turn a failed result back into an Error.

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function guard<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    console.error("[lily] server function failed", error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function unwrap<T>(promise: Promise<Result<T>>): Promise<T> {
  const result = await promise;
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

/* ---------------------------------------------------------------- campaigns */

export const getCampaigns = createServerFn({ method: "GET" }).handler(() =>
  guard(async () => {
    return n8n<CampaignSummary>("lily-campaigns");
  }),
);

const sequenceSchema = z.object({
  version: z.literal(1).optional(),
  preset: z.enum(["invite_only", "invite_message", "invite_two_messages", "custom"]),
  steps: z
    .array(
      z.union([
        z.object({ type: z.literal("invite"), note: z.string().max(300) }),
        z.object({
          type: z.literal("message"),
          wait_days: z.number().int().min(0).max(30),
          mode: z.enum(["ai", "template"]),
          text: z.string().max(2000),
        }),
      ]),
    )
    .min(1)
    .max(4),
});

export const updateCampaign = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().trim().min(1).max(120),
      create: z.boolean().optional(),
      status: z.enum(["draft", "active", "paused", "archived"]).optional(),
      sequence: sequenceSchema.optional(),
    }),
  )
  .handler(({ data }) =>
    guard(async () => {
      return n8n<{ ok: boolean; name: string; status?: string }>("lily-campaign-status", {
        method: "POST",
        json: data,
      });
    }),
  );

export const setCampaignStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1).max(120),
      status: z.enum(["draft", "active", "paused", "archived"]),
    }),
  )
  .handler(({ data }) =>
    guard(async () => {
      return n8n<{ ok: boolean; name: string; status: string }>("lily-campaign-status", {
        method: "POST",
        json: data,
      });
    }),
  );

export const getCampaignLeads = createServerFn({ method: "GET" })
  .validator(z.object({ name: z.string().min(1).max(120) }))
  .handler(({ data }) =>
    guard(async () => {
      return n8n<{ name: string; total: number; leads: CampaignLead[] }>(
        `lily-campaign-leads?name=${encodeURIComponent(data.name)}`,
      );
    }),
  );

export const setSendingSettings = createServerFn({ method: "POST" })
  .validator(
    z.object({
      daily_invite_limit: z.number().int().min(0).max(100).optional(),
      send_weekends: z.boolean().optional(),
      company_context: z.string().max(4000).optional(),
      ai_model: z.enum(["claude-sonnet-5", "claude-opus-5"]).optional(),
    }),
  )
  .handler(({ data }) =>
    guard(async () => {
      return n8n<{ ok: boolean }>("lily-settings", { method: "POST", json: data });
    }),
  );

const leadSchema = z.object({
  linkedin_url: z.string().max(400),
  first_name: z.string().max(120).optional(),
  last_name: z.string().max(120).optional(),
  company: z.string().max(200).optional(),
  title: z.string().max(300).optional(),
});

export const uploadLeads = createServerFn({ method: "POST" })
  .validator(
    z.object({
      campaign_name: z.string().trim().min(1, "Campaign name is required").max(120),
      source_file: z.string().max(200).optional(),
      leads: z.array(leadSchema).min(1).max(5000),
    }),
  )
  .handler(({ data }) =>
    guard(async () => {
      return n8n<UploadResult>("lily-upload", { method: "POST", json: data });
    }),
  );

/* ---------------------------------------------------------------- unipile shapes */

type UAttendee = {
  is_self?: number | boolean;
  provider_id?: string;
  name?: string;
  picture_url?: string;
  profile_url?: string;
  specifics?: { occupation?: string; public_identifier?: string };
};
type UMessage = {
  id: string;
  text?: string | null;
  timestamp?: string;
  is_sender?: number | boolean;
};
type UChat = {
  id: string;
  timestamp?: string;
  unread_count?: number;
  archived?: number | boolean;
  name?: string | null;
};
type UList<T> = { items?: T[]; cursor?: string | null };

const isTrue = (v: unknown) => v === true || v === 1 || v === "1";
const linkedinUrl = (publicId?: string | null) =>
  publicId ? `https://www.linkedin.com/in/${publicId}` : null;

async function attendeeOf(chatId: string): Promise<Person> {
  const res = await unipile<UList<UAttendee>>(
    `/chats/${encodeURIComponent(chatId)}/attendees`,
  ).catch(() => ({ items: [] }));
  const other = (res.items ?? []).find((a) => !isTrue(a.is_self)) ?? null;
  return {
    name: other?.name || "LinkedIn member",
    headline: other?.specifics?.occupation || null,
    picture_url: other?.picture_url || null,
    profile_url: other?.profile_url || linkedinUrl(other?.specifics?.public_identifier) || null,
    provider_id: other?.provider_id || null,
  };
}

function toMessage(m: UMessage): ChatMessage {
  return { id: m.id, text: m.text ?? "", at: m.timestamp ?? null, from_me: isTrue(m.is_sender) };
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i] as T);
      }
    }),
  );
  return out;
}

/* ---------------------------------------------------------------- inbox */

export const getInbox = createServerFn({ method: "GET" })
  .validator(z.object({ limit: z.number().int().min(1).max(60).default(30) }).optional())
  .handler(({ data }) =>
    guard(async () => {
      const limit = data?.limit ?? 30;
      const chats = await unipile<UList<UChat>>("/chats", { query: { limit } });
      const active = (chats.items ?? []).filter((c) => !isTrue(c.archived));
      const conversations = await mapLimit(
        active,
        6,
        async (chat): Promise<ConversationSummary> => {
          const [person, messages] = await Promise.all([
            attendeeOf(chat.id),
            unipile<UList<UMessage>>(`/chats/${encodeURIComponent(chat.id)}/messages`, {
              query: { limit: 1 },
            }).catch(() => ({ items: [] })),
          ]);
          const last = (messages.items ?? [])[0];
          return {
            chat_id: chat.id,
            person,
            unread: Number(chat.unread_count || 0),
            last_text: last?.text ?? "",
            last_at: last?.timestamp ?? chat.timestamp ?? null,
            last_from_me: last ? isTrue(last.is_sender) : null,
          };
        },
      );
      conversations.sort((a, b) => String(b.last_at ?? "").localeCompare(String(a.last_at ?? "")));
      return { conversations };
    }),
  );

export const getThread = createServerFn({ method: "GET" })
  .validator(z.object({ chatId: z.string().min(1).max(200) }))
  .handler(({ data }) =>
    guard(async () => {
      const [person, messages] = await Promise.all([
        attendeeOf(data.chatId),
        unipile<UList<UMessage>>(`/chats/${encodeURIComponent(data.chatId)}/messages`, {
          query: { limit: 60 },
        }),
      ]);
      const list = (messages.items ?? [])
        .map(toMessage)
        .sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")));
      return { person, messages: list };
    }),
  );

export const sendMessage = createServerFn({ method: "POST" })
  .validator(
    z.object({ chatId: z.string().min(1).max(200), text: z.string().trim().min(1).max(8000) }),
  )
  .handler(({ data }) =>
    guard(async () => {
      const res = await unipile<{ message_id?: string }>(
        `/chats/${encodeURIComponent(data.chatId)}/messages`,
        {
          method: "POST",
          form: { text: data.text },
        },
      );
      return { ok: true, message_id: res.message_id ?? null };
    }),
  );

/* ---------------------------------------------------------------- invitations */

type UReceived = {
  id: string;
  date?: string;
  parsed_datetime?: string;
  invitation_text?: string | null;
  message?: string | null;
  inviter?: {
    inviter_id?: string;
    inviter_name?: string;
    inviter_description?: string;
    inviter_public_identifier?: string;
    inviter_profile_picture_url?: string;
  };
  specifics?: { shared_secret?: string };
  shared_secret?: string;
};
type USent = {
  id: string;
  parsed_datetime?: string;
  invitation_text?: string | null;
  invited_user?: string;
  invited_user_id?: string;
  invited_user_public_id?: string;
  invited_user_profile_picture_url?: string;
  invited_user_description?: string;
};

export const getInvites = createServerFn({ method: "GET" }).handler(() =>
  guard(async () => {
    const [received, sent] = await Promise.all([
      unipile<UList<UReceived>>("/users/invite/received", { query: { limit: 100 } }),
      unipile<UList<USent>>("/users/invite/sent", { query: { limit: 100 } }),
    ]);
    const incoming: Invitation[] = (received.items ?? []).map((r) => ({
      id: r.id,
      direction: "incoming",
      person: {
        name: r.inviter?.inviter_name || "LinkedIn member",
        headline: r.inviter?.inviter_description || null,
        picture_url: r.inviter?.inviter_profile_picture_url || null,
        profile_url: linkedinUrl(r.inviter?.inviter_public_identifier),
        provider_id: r.inviter?.inviter_id || null,
      },
      note: r.invitation_text || r.message || null,
      at: r.parsed_datetime || null,
      shared_secret: r.specifics?.shared_secret || r.shared_secret || null,
    }));
    const outgoing: Invitation[] = (sent.items ?? []).map((s) => ({
      id: s.id,
      direction: "outgoing",
      person: {
        name: s.invited_user || "LinkedIn member",
        headline: s.invited_user_description || null,
        picture_url: s.invited_user_profile_picture_url || null,
        profile_url: linkedinUrl(s.invited_user_public_id),
        provider_id: s.invited_user_id || null,
      },
      note: s.invitation_text || null,
      at: s.parsed_datetime || null,
      shared_secret: null,
    }));
    return { incoming, outgoing };
  }),
);

export const respondToInvite = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1).max(200),
      action: z.enum(["accept", "decline"]),
      shared_secret: z.string().min(1).max(500),
    }),
  )
  .handler(({ data }) =>
    guard(async () => {
      await unipile(`/users/invite/received/${encodeURIComponent(data.id)}`, {
        method: "POST",
        json: { provider: "LINKEDIN", action: data.action, shared_secret: data.shared_secret },
      });
      return { ok: true };
    }),
  );

export const withdrawInvite = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1).max(200) }))
  .handler(({ data }) =>
    guard(async () => {
      await unipile(`/users/invite/sent/${encodeURIComponent(data.id)}`, { method: "DELETE" });
      return { ok: true };
    }),
  );

/* ---------------------------------------------------------------- bulk withdraw */

const MAX_SENT_SCAN = 5000;

async function listAllSent(): Promise<{ items: USent[]; truncated: boolean }> {
  const items: USent[] = [];
  let cursor: string | null | undefined;
  do {
    const page: UList<USent> = await unipile<UList<USent>>("/users/invite/sent", {
      query: { limit: 100, cursor: cursor ?? undefined },
    });
    items.push(...(page.items ?? []));
    cursor = page.cursor;
  } while (cursor && items.length < MAX_SENT_SCAN);
  return { items, truncated: !!cursor };
}

function eligibleOldestFirst(items: USent[], minAgeDays: number) {
  const cutoff = Date.now() - minAgeDays * 86_400_000;
  const at = (s: USent) => {
    const t = s.parsed_datetime ? new Date(s.parsed_datetime).getTime() : NaN;
    return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
  };
  return items.filter((s) => minAgeDays <= 0 || at(s) <= cutoff).sort((a, b) => at(a) - at(b));
}

const ageSchema = z.object({ minAgeDays: z.number().int().min(0).max(365).default(0) });

export const getSentSummary = createServerFn({ method: "GET" })
  .validator(ageSchema)
  .handler(({ data }) =>
    guard(async (): Promise<SentSummary> => {
      const { items, truncated } = await listAllSent();
      const eligible = eligibleOldestFirst(items, data.minAgeDays);
      return {
        total: items.length,
        eligible: eligible.length,
        oldest_at: eligible[0]?.parsed_datetime ?? null,
        truncated,
      };
    }),
  );

export const startBulkWithdraw = createServerFn({ method: "POST" })
  .validator(ageSchema.extend({ count: z.number().int().min(1).max(3000) }))
  .handler(({ data }) =>
    guard(async () => {
      const { items } = await listAllSent();
      const picked = eligibleOldestFirst(items, data.minAgeDays).slice(0, data.count);
      if (picked.length === 0) throw new Error("No pending invites match. Nothing was withdrawn.");
      return n8n<{ ok: boolean; queued: number }>("lily-withdraw", {
        method: "POST",
        json: { ids: picked.map((p) => p.id), start_total: items.length },
      });
    }),
  );

/* ---------------------------------------------------------------- AI writer (Claude via n8n) */

type UProfile = {
  first_name?: string;
  last_name?: string;
  headline?: string;
  summary?: string;
  location?: string;
  provider_id?: string;
  work_experience?: {
    position?: string;
    company?: string;
    description?: string;
    start?: string;
    end?: string | null;
  }[];
  skills?: ({ name?: string } | string)[];
};
type UPost = { text?: string; date?: string; parsed_datetime?: string };

const clipText = (v: unknown, n: number) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n);

/** Reads a lead's LinkedIn profile and recent posts and compacts them for the prompt. */
async function profileForAI(linkedinUrl: string) {
  const m = linkedinUrl.match(/linkedin\.com\/(?:in|pub)\/([^/?#\s]+)/i);
  if (!m?.[1]) throw new Error("This lead has no valid LinkedIn URL.");
  const p = await unipile<UProfile>(`/users/${encodeURIComponent(m[1].replace(/\/$/, ""))}`, {
    query: { linkedin_sections: "*" },
  });
  const posts = p.provider_id
    ? ((
        await unipile<UList<UPost>>(`/users/${encodeURIComponent(p.provider_id)}/posts`, {
          query: { limit: 3 },
        }).catch(() => ({ items: [] as UPost[] }))
      ).items ?? [])
    : [];
  const exp = p.work_experience ?? [];
  const current = exp.filter((e) => !e.end).slice(0, 2);
  const past = exp.filter((e) => e.end).slice(0, 3);
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || "LinkedIn member";
  return {
    compact: {
      name,
      first_name: p.first_name ?? "",
      last_name: p.last_name ?? "",
      headline: clipText(p.headline, 300),
      location: clipText(p.location, 100),
      about: clipText(p.summary, 1500),
      current_roles: current.map((e) => ({
        title: clipText(e.position, 150),
        company: clipText(e.company, 120),
        since: e.start ?? null,
        description: clipText(e.description, 700),
      })),
      previous_roles: past.map((e) => ({
        title: clipText(e.position, 150),
        company: clipText(e.company, 120),
      })),
      skills: (p.skills ?? [])
        .map((s) => (typeof s === "string" ? s : s.name))
        .filter(Boolean)
        .slice(0, 10),
      recent_posts: posts.map((x) => ({
        when: x.date ?? x.parsed_datetime ?? null,
        text: clipText(x.text, 500),
      })),
    },
    summary: {
      name,
      headline: p.headline ?? null,
      current_role: current[0]
        ? `${current[0].position ?? ""} at ${current[0].company ?? ""}`.trim()
        : null,
      posts: posts.length,
    },
  };
}

const stepSchema = z.object({
  index: z.number().int().min(1).max(3),
  wait_days: z.number().int().min(0).max(30),
  instructions: z.string().max(2000).optional(),
});

async function writer(payload: Record<string, unknown>) {
  const res = await n8n<GeneratedText>("lily-generate", { method: "POST", json: payload });
  if (!res.ok) throw new Error(res.error || "Claude could not write this message.");
  return res;
}

export const generateForLead = createServerFn({ method: "POST" })
  .validator(
    z.object({
      lead_url: z.string().min(10).max(400),
      kind: z.enum(["invite_note", "message"]),
      step: stepSchema,
      previous_message: z.string().max(2000).optional(),
    }),
  )
  .handler(({ data }) =>
    guard(async (): Promise<GeneratedText> => {
      const profile = await profileForAI(data.lead_url);
      const res = await writer({
        mode: "message",
        kind: data.kind,
        step: data.step,
        profile: profile.compact,
        previous_message: data.previous_message,
      });
      return { ...res, profile: profile.summary };
    }),
  );

export const draftTemplate = createServerFn({ method: "POST" })
  .validator(
    z.object({
      kind: z.enum(["invite_note", "message"]),
      step: stepSchema,
      audience: z
        .array(z.object({ title: z.string().max(200), company: z.string().max(200) }))
        .max(20),
      previous_message: z.string().max(2000).optional(),
    }),
  )
  .handler(({ data }) => guard(async () => writer({ mode: "template", ...data })));

export const testClaude = createServerFn({ method: "GET" }).handler(() =>
  guard(async () =>
    n8n<{ ok: boolean; model: string; reply: string }>("lily-generate", {
      method: "POST",
      json: { mode: "ping" },
    }),
  ),
);
