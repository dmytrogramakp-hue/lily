import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCampaigns, unwrap } from "@/lib/api";
import { useCurrentUser, useTeam } from "@/lib/current-user";
import type { TeamMember } from "@/lib/types";

/**
 * Whose LinkedIn a page shows (Inbox, Invites). Defaults to the person using Lily when they
 * have a LinkedIn connected, otherwise Dima's account. Anyone can switch to a teammate's.
 */
export function useAccountChoice() {
  const { user } = useCurrentUser();
  const { members } = useTeam();
  const summary = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => unwrap(getCampaigns()),
    staleTime: 60_000,
  });
  const withLinkedIn = useMemo(() => members.filter((m) => !!m.unipile_account_id), [members]);
  const fallback =
    (user?.unipile_account_id ? user : null) ??
    withLinkedIn.find((m) => m.unipile_account_id === summary.data?.default_account) ??
    withLinkedIn[0] ??
    null;
  const [picked, setPicked] = useState<string | null>(null);
  // Follow the person using Lily until someone picks an account explicitly.
  useEffect(() => setPicked(null), [user?.key]);
  const member: TeamMember | null =
    (picked ? withLinkedIn.find((m) => m.key === picked) : null) ?? fallback;
  return {
    member,
    account: member?.unipile_account_id || undefined,
    options: withLinkedIn,
    loaded: !!summary.data,
    setMember: setPicked,
  };
}

export function AccountPicker({
  member,
  options,
  onChange,
}: {
  member: TeamMember | null;
  options: TeamMember[];
  onChange: (key: string) => void;
}) {
  if (options.length <= 1) {
    return member ? (
      <span className="text-xs text-muted-foreground">
        {member.linkedin_name || member.name}'s LinkedIn
      </span>
    ) : null;
  }
  return (
    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      LinkedIn
      <select
        value={member?.key ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border bg-card px-2 py-1.5 text-xs font-semibold text-ink"
      >
        {options.map((m) => (
          <option key={m.key} value={m.key}>
            {m.name}
            {m.linkedin_name && m.linkedin_name !== m.name ? ` (${m.linkedin_name})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
