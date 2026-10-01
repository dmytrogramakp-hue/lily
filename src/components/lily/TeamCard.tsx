import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, UserMinus, UserPlus, Users } from "lucide-react";
import { Avatar, Btn, Card, ErrorBanner, initialsOf } from "@/components/lily/AppShell";
import { removeTeamMember, saveTeamMember, unwrap } from "@/lib/api";
import { useCurrentUser, useTeam } from "@/lib/current-user";
import type { Campaign, TeamMember } from "@/lib/types";

type Draft = { key?: string; name: string; role: string; email: string };
const EMPTY: Draft = { name: "", role: "", email: "" };

/**
 * Team members share the one Lily login. Each person can be picked as "who is using Lily",
 * own campaigns and be assigned campaigns. Removing someone keeps their campaigns, which
 * then show them as "left team" until reassigned.
 */
export function TeamCard({ campaigns }: { campaigns: Campaign[] }) {
  const qc = useQueryClient();
  const { members } = useTeam();
  const { user, setUser } = useCurrentUser();
  const [draft, setDraft] = useState<Draft | null>(null);

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
          <Users className="h-4 w-4 text-primary" /> Team
        </div>
        {!draft && (
          <Btn variant="outline" onClick={() => setDraft({ ...EMPTY })}>
            <UserPlus className="h-4 w-4" /> Add person
          </Btn>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Everyone signs in with the same Lily login, then picks who they are. Anyone can create,
        edit, launch and reassign any campaign. All campaigns send from Dima's LinkedIn account, and
        AI messages are written and signed as Dima.
      </p>

      <ul className="mt-4 divide-y rounded-xl border">
        {members.map((m) => {
          const n = owned(m.key);
          return (
            <li key={m.key} className="flex items-center gap-3 px-4 py-3">
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
                onClick={() => setDraft({ key: m.key, name: m.name, role: m.role, email: m.email })}
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
                        : ""),
                  ) && remove.mutate(m)
                }
                className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive-soft hover:text-destructive disabled:opacity-30"
                aria-label={`Remove ${m.name}`}
                title={members.length <= 1 ? "The team needs at least one person" : undefined}
              >
                <UserMinus className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>

      {draft && (
        <form onSubmit={submit} className="mt-4 rounded-xl border bg-muted/30 p-4">
          <div className="text-sm font-semibold text-ink">
            {draft.key ? `Edit ${draft.name || "person"}` : "Add a person"}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
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
          </div>
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
