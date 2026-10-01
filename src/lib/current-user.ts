import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCampaigns, unwrap } from "@/lib/api";
import type { TeamMember } from "@/lib/types";

/**
 * Lily has one shared login, so "who is using Lily" is a per-browser choice. It decides the
 * default owner for new campaigns, the "Mine" filter and "Assign to me". It is a convenience,
 * not access control: everyone on the team can see and manage every campaign.
 */
const STORAGE_KEY = "lily.current-user";
const EVENT = "lily:current-user";

function read(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return memory;
  }
}

// Fallback when storage is blocked (private windows, previews), so the choice lasts the session.
let memory: string | null = null;

function write(key: string | null) {
  memory = key;
  try {
    if (key) window.localStorage.setItem(STORAGE_KEY, key);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable, the in-memory value is enough */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useTeam() {
  const summary = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => unwrap(getCampaigns()),
    staleTime: 60_000,
  });
  const all = useMemo(() => summary.data?.users ?? [], [summary.data]);
  const members = useMemo(() => all.filter((u) => u.active), [all]);
  const byKey = useMemo(() => new Map(all.map((u) => [u.key, u])), [all]);
  return { all, members, byKey, loaded: !!summary.data };
}

export function useCurrentUser() {
  const stored = useSyncExternalStore(subscribe, read, () => null);
  const { members, loaded } = useTeam();
  const fromStore = stored ? (members.find((u) => u.key === stored) ?? null) : null;
  // With a single person on the team there is nothing to choose.
  const user: TeamMember | null = fromStore ?? (members.length === 1 ? members[0]! : null);
  const setUser = useCallback((key: string | null) => write(key), []);
  // Remember the only person, so adding teammates later does not ask them who they are.
  const onlyKey = !stored && members.length === 1 ? members[0]!.key : null;
  useEffect(() => {
    if (onlyKey) write(onlyKey);
  }, [onlyKey]);
  return { user, setUser, needsChoice: loaded && !user && members.length > 1 };
}

/** The LinkedIn account a campaign sends from: its owner's, or Dima's default when unassigned. */
export function senderFor(
  owner: string | null | undefined,
  byKey: Map<string, TeamMember>,
  defaultAccount: string | undefined,
): { member: TeamMember | null; account: string | null; reason: "owner" | "default" | "missing" } {
  if (!owner) {
    const dima = byKey.get("dima") ?? null;
    return {
      member: dima,
      account: defaultAccount ?? dima?.unipile_account_id ?? null,
      reason: "default",
    };
  }
  const member = byKey.get(owner) ?? null;
  const account = member?.active ? member.unipile_account_id || null : null;
  return { member, account, reason: account ? "owner" : "missing" };
}

/** How Claude should sign as this person. */
export function senderProfile(member: TeamMember | null | undefined) {
  if (!member) return undefined;
  return {
    name: member.name,
    ...(member.role ? { role: member.role } : {}),
    first_name: member.name.split(" ")[0] ?? member.name,
  };
}
