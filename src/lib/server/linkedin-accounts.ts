import { n8n, unipile } from "./clients";
import type { LinkedInAccount, TeamMember } from "../types";

type UAccount = {
  id: string;
  type?: string;
  name?: string;
  created_at?: string;
  sources?: { status?: string }[];
};

function toAccount(a: UAccount): LinkedInAccount {
  const statuses = (a.sources ?? []).map((s) => s.status).filter(Boolean) as string[];
  // Unipile reports OK when the session works; anything else (CREDENTIALS, STOPPED, ...) needs a reconnect.
  const status = statuses.find((s) => s !== "OK") ?? statuses[0] ?? "UNKNOWN";
  return { id: a.id, name: a.name || "LinkedIn account", status, created_at: a.created_at ?? null };
}

/** Every LinkedIn account in the Unipile workspace, linked to a team member or not. */
export async function listLinkedInAccounts(): Promise<LinkedInAccount[]> {
  const res = await unipile<{ items?: UAccount[] }>("/accounts", {
    workspace: true,
    query: { limit: 100 },
  });
  return (res.items ?? []).filter((a) => a.type === "LINKEDIN").map(toAccount);
}

export async function getLinkedInAccount(id: string): Promise<LinkedInAccount> {
  const a = await unipile<UAccount>(`/accounts/${encodeURIComponent(id)}`, { workspace: true });
  if (a.type !== "LINKEDIN") throw new Error("That Unipile account is not a LinkedIn account.");
  return toAccount(a);
}

/** Attach a Unipile LinkedIn account to a team member (stored in the n8n lily_users table). */
export async function linkMemberAccount(memberKey: string, accountId: string) {
  const account = await getLinkedInAccount(accountId);
  return n8n<{ ok: boolean; user: TeamMember }>("lily-settings", {
    method: "POST",
    json: {
      user_action: "link_account",
      user: { key: memberKey, unipile_account_id: account.id, linkedin_name: account.name },
    },
  });
}
