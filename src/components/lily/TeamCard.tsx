import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Pencil,
  RefreshCw,
  Unlink,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { Avatar, Btn, Card, ErrorBanner, initialsOf } from "@/components/lily/AppShell";
import {
  createLinkedInConnectLink,
  getLinkedInAccounts,
  linkLinkedInAccount,
  removeTeamMember,
  saveTeamMember,
  unlinkLinkedInAccount,
  unwrap,
} from "@/lib/api";
import { useCurrentUser, useTeam } from "@/lib/current-user";
import type { Campaign, LinkedInAccount, TeamMember } from "@/lib/types";

type Draft = { key?: string; name: string; role: string; email: string; calendar_link: string };
const EMPTY: Draft = { name: "", role: "", email: "", calendar_link: "" };

/**
 * Team members share the one Lily login. Each person connects their own LinkedIn through
 * Unipile; their campaigns then invite and message from that account, and Claude writes as them.
 */
export function TeamCard({ campaigns }: { campaigns: Campaign[] }) {
  const qc = useQueryClient();
  const { members } = useTeam();
  const { user, setUser } = useCurrentUser();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [waitingFor, setWaitingFor] = useState<string | null>(null);

  const accounts = useQuery({
    queryKey: ["linkedin-accounts"],
    queryFn: () => unwrap(getLinkedInAccounts()),
    staleTime: 60_000,
  });
  const accountById = new Map((accounts.data?.accounts ?? []).map((a) => [a.id, a]));
  const linkedIds = new Set(members.map((m) => m.unipile_account_id).filter(Boolean));
  const unlinked = (accounts.data?.accounts ?? []).filter((a) => !linkedIds.has(a.id));

  // While someone finishes the LinkedIn sign-in in another tab, refresh until their account shows up.
  useEffect(() => {
    if (!waitingFor) return;
    const started = Date.now();
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["linkedin-accounts"] });
      if (Date.now() - started > 10 * 60_000) setWaitingFor(null);
    }, 5000);
    return () => clearInterval(t);
  }, [waitingFor, qc]);
  useEffect(() => {
    if (waitingFor && members.find((m) => m.key === waitingFor)?.unipile_account_id) {
      setWaitingFor(null);
    }
  }, [members, waitingFor]);

  const owned = (key: string) =>
    campaigns.filter((c) => c.owner === key && c.status !== "archived").length;

  const save = useMutation({
    mutationFn: (d: Draft) =>
      unwrap(
        saveTeamMember({
          data: {
            ...(d.key ? { key: d.key } : {}),
            name: d.name.trim(),
            role: d.role.trim(),
            email: d.email.trim(),
            calendar_link: d.calendar_link.trim(),
          },
        }),
      ),
    onSuccess: () => {
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
  const remove = useMutation({
    mutationFn: (m: TeamMember) => unwrap(removeTeamMember({ data: { key: m.key } })),
    onSuccess: (_r, m) => {
      if (user?.key === m.key) setUser(null);
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (draft && draft.name.trim()) save.mutate(draft);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold text-ink">
          <Users className="h-4 w-4 text-primary" /> Team and LinkedIn accounts
        </div>
        {!draft && (
          <Btn variant="outline" onClick={() => setDraft({ ...EMPTY })}>
            <UserPlus className="h-4 w-4" /> Add person
          </Btn>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Everyone signs in with the same Lily login, then picks who they are. Each person connects
        their own LinkedIn: campaigns they own send invites and messages from that account, and
        Claude writes and signs as them. Unassigned campaigns send from Dima's LinkedIn.
      </p>

      <ul className="mt-4 divide-y rounded-xl border">
        {members.map((m) => {
          const n = owned(m.key);
          return (
            <li key={m.key} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar initials={initialsOf(m.name)} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                    {m.name}
                    {user?.key === m.key && (
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
                        You
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[m.role, m.email].filter(Boolean).join(" · ") || "No role set"}
                  </div>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {n} campaign{n === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      key: m.key,
                      name: m.name,
                      role: m.role,
                      email: m.email,
                      calendar_link: m.calendar_link ?? "",
                    })
                  }
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Edit ${m.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={members.length <= 1 || remove.isPending}
                  onClick={() =>
                    window.confirm(
                      `Remove ${m.name} from the team?` +
                        (n
                          ? `\n\n${n} campaign${n === 1 ? " stays" : "s stay"} as they are and will show "${m.name} (left team)" until you reassign ${n === 1 ? "it" : "them"}.`
                          : "") +
                        (m.unipile_account_id
                          ? "\n\nTheir LinkedIn stays connected in Unipile. Disconnect it there if they should no longer send."
                          : ""),
                    ) && remove.mutate(m)
                  }
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive-soft hover:text-destructive disabled:opacity-30"
                  aria-label={`Remove ${m.name}`}
                  title={members.length <= 1 ? "The team needs at least one person" : undefined}
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              </div>
              <LinkedInRow
                member={m}
                account={m.unipile_account_id ? accountById.get(m.unipile_account_id) : undefined}
                accountsLoading={accounts.isPending}
                unlinked={unlinked}
                waiting={waitingFor === m.key}
                onWaiting={() => setWaitingFor(m.key)}
              />
            </li>
          );
        })}
      </ul>
      {accounts.error && (
        <p className="mt-2 text-xs text-muted-foreground">
          Could not read LinkedIn account status from Unipile right now.
        </p>
      )}

      {draft && (
        <form onSubmit={submit} className="mt-4 rounded-xl border bg-muted/30 p-4">
          <div className="text-sm font-semibold text-ink">
            {draft.key ? `Edit ${draft.name || "person"}` : "Add a person"}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Name" required>
              <input
                autoFocus
                value={draft.name}
                maxLength={80}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Full name"
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Role">
              <input
                value={draft.role}
                maxLength={80}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                placeholder="e.g. SDR, Head of Growth"
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={draft.email}
                maxLength={160}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                placeholder="name@newscatcherapi.com"
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Calendar link">
              <input
                type="url"
                value={draft.calendar_link}
                maxLength={300}
                onChange={(e) => setDraft({ ...draft, calendar_link: e.target.value })}
                placeholder="https://savvycal.com/..."
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            The calendar link fills {"{{calendar_link}}"} in this person's template messages. The
            role is how Claude introduces them.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Btn type="submit" disabled={!draft.name.trim() || save.isPending}>
              {save.isPending ? "Saving" : draft.key ? "Save changes" : "Add to team"}
            </Btn>
            <Btn variant="ghost" onClick={() => setDraft(null)} disabled={save.isPending}>
              Cancel
            </Btn>
          </div>
          {save.error && (
            <div className="mt-3">
              <ErrorBanner error={save.error} />
            </div>
          )}
        </form>
      )}
      {remove.error && (
        <div className="mt-3">
          <ErrorBanner error={remove.error} />
        </div>
      )}
    </Card>
  );
}

function LinkedInRow({
  member: m,
  account,
  accountsLoading,
  unlinked,
  waiting,
  onWaiting,
}: {
  member: TeamMember;
  account: LinkedInAccount | undefined;
  accountsLoading: boolean;
  unlinked: LinkedInAccount[];
  waiting: boolean;
  onWaiting: () => void;
}) {
  const qc = useQueryClient();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [picking, setPicking] = useState(false);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["campaigns"] });
    qc.invalidateQueries({ queryKey: ["linkedin-accounts"] });
  };

  const connect = useMutation({
    mutationFn: (reconnect?: string) =>
      unwrap(
        createLinkedInConnectLink({
          data: { member: m.key, ...(reconnect ? { reconnect } : {}) },
        }),
      ),
    onSuccess: (r) => {
      setLink(r.url);
      onWaiting();
    },
  });
  const linkExisting = useMutation({
    mutationFn: (account: string) =>
      unwrap(linkLinkedInAccount({ data: { member: m.key, account } })),
    onSuccess: () => {
      setPicking(false);
      refresh();
    },
  });
  const unlink = useMutation({
    mutationFn: () => unwrap(unlinkLinkedInAccount({ data: { member: m.key } })),
    onSuccess: refresh,
  });

  const connected = !!m.unipile_account_id;
  const healthy = !account || account.status === "OK";
  const err = connect.error || linkExisting.error || unlink.error;

  return (
    <div className="ml-11 mt-2 rounded-lg bg-muted/40 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {connected ? (
          healthy ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-success">
              <span className="h-2 w-2 rounded-full bg-success" />
              LinkedIn connected{m.linkedin_name ? ` as ${m.linkedin_name}` : ""}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-medium text-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              LinkedIn needs reconnecting ({account?.status.toLowerCase()})
            </span>
          )
        ) : waiting ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-primary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for {m.name.split(" ")[0]} to
            finish signing in to LinkedIn
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-border" /> LinkedIn not connected
          </span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {(!connected || !healthy) && (
            <Btn
              variant={connected ? "outline" : "primary"}
              className="px-2.5 py-1 text-xs"
              disabled={connect.isPending}
              onClick={() => connect.mutate(connected ? m.unipile_account_id : undefined)}
            >
              {connect.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : connected ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              {connected ? "Reconnect" : "Connect LinkedIn"}
            </Btn>
          )}
          {!connected && unlinked.length > 0 && !accountsLoading && (
            <Btn
              variant="ghost"
              className="px-2.5 py-1 text-xs"
              onClick={() => setPicking((p) => !p)}
            >
              Link existing account
            </Btn>
          )}
          {connected && (
            <Btn
              variant="ghost"
              className="px-2.5 py-1 text-xs"
              disabled={unlink.isPending}
              onClick={() =>
                window.confirm(
                  `Disconnect ${m.linkedin_name || "this LinkedIn"} from ${m.name} in Lily?\n\nCampaigns ${m.name.split(" ")[0]} owns stop sending new invites until a LinkedIn is connected again. Leads already invited from this account keep their messages on it. The account stays in Unipile.`,
                ) && unlink.mutate()
              }
            >
              <Unlink className="h-3.5 w-3.5" /> Disconnect
            </Btn>
          )}
        </div>
      </div>

      {picking && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Unipile accounts not linked to anyone:</span>
          {unlinked.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={linkExisting.isPending}
              onClick={() => linkExisting.mutate(a.id)}
              className="rounded-md border bg-card px-2 py-1 font-medium text-ink hover:border-primary disabled:opacity-50"
            >
              {a.name}
              {a.status !== "OK" ? ` (${a.status.toLowerCase()})` : ""}
            </button>
          ))}
        </div>
      )}

      {link && !connected && (
        <div className="mt-2 rounded-lg border bg-card p-2.5">
          <div className="font-medium text-ink">
            Connect link ready. {m.name.split(" ")[0]} signs in to LinkedIn on Unipile's page, so
            Lily never sees the password. The link works for 2 hours.
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 font-semibold text-primary-foreground hover:brightness-110"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open here
            </a>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(link).then(
                  () => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  },
                  () => setCopied(false),
                );
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-semibold hover:bg-muted"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : `Copy link to send to ${m.name.split(" ")[0]}`}
            </button>
          </div>
        </div>
      )}
      {err && (
        <div className="mt-2 text-destructive">
          {err instanceof Error ? err.message : String(err)}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
  );
}
