import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { n8n, unipile } from "./server/clients";
import type {
  CampaignSummary,
  ChatMessage,
  ConversationSummary,
  Invitation,
  Person,
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

export const setCampaignStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1).max(120),
      status: z.enum(["active", "paused", "archived"]),
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

export const setSendingSettings = createServerFn({ method: "POST" })
  .validator(
    z.object({
      daily_invite_limit: z.number().int().min(0).max(100).optional(),
      send_weekends: z.boolean().optional(),
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
