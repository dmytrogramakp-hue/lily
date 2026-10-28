import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, MessagesSquare, RotateCcw } from "lucide-react";
import {
  AppShell,
  Avatar,
  Btn,
  Card,
  EmptyState,
  ErrorBanner,
  Loading,
  initialsOf,
} from "@/components/lily/AppShell";
import { getFollowUps, updateFollowUp, unwrap } from "@/lib/api";
import { useCurrentUser, useTeam } from "@/lib/current-user";
import type { FollowUp } from "@/lib/types";

export const Route = createFileRoute("/follow-ups")({
  head: () => ({
    meta: [
      { title: "Follow-ups · Lily" },
      {
        name: "description",
        content: "People who said later, with the date to write to them again.",
      },
    ],
  }),
  component: FollowUps,
});

/* Follow-ups are people who replied "not now" or "ask me again". Each one has a due date;
   the page groups them by how urgent they are, and the morning desk lists the ones due today. */

const DAY = 86_400_000;
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, days: number) =>
  new Date(new Date(iso + "T00:00:00Z").getTime() + days * DAY).toISOString().slice(0, 10);
const fmt = (iso: string) =>
  iso
    ? new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : "";

type Bucket = { key: string; title: string; hint: string; tone: string; items: FollowUp[] };

function bucketize(list: FollowUp[]): Bucket[] {
  const t = today();
  const week = addDays(t, 7);
  const b: { overdue: FollowUp[]; today: FollowUp[]; week: FollowUp[]; later: FollowUp[] } = {
    overdue: [],
    today: [],
    week: [],
    later: [],
  };
  for (const f of list) {
    if (f.due_on < t) b.overdue.push(f);
    else if (f.due_on === t) b.today.push(f);
    else if (f.due_on <= week) b.week.push(f);
    else b.later.push(f);
  }
  const by = (a: FollowUp, z: FollowUp) => a.due_on.localeCompare(z.due_on);
  return [
    {
      key: "overdue",
      title: "Overdue",
      hint: "Write today",
      tone: "text-warning",
      items: b.overdue.sort(by),
    },
    { key: "today", title: "Due today", hint: "", tone: "text-primary", items: b.today.sort(by) },
    { key: "week", title: "This week", hint: "", tone: "text-ink", items: b.week.sort(by) },
    {
      key: "later",
      title: "Later",
      hint: "",
      tone: "text-muted-foreground",
      items: b.later.sort(by),
    },
  ];
}

function FollowUps() {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const { byKey } = useTeam();
  const [scope, setScope] = useState<"everyone" | "mine">("everyone");
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<Record<number, string>>({});

  const q = useQuery({
    queryKey: ["followups"],
    queryFn: () => unwrap(getFollowUps()),
    staleTime: 30_000,
  });
  const update = useMutation({
    mutationFn: (v: { id: number; status?: "open" | "done"; due_on?: string; note?: string }) =>
      unwrap(updateFollowUp({ data: v })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["followups"] }),
  });

  const all = q.data?.followups ?? [];
  const visible = useMemo(
    () => all.filter((f) => scope === "everyone" || (!!user && f.member_key === user.key)),
    [all, scope, user],
  );
  const open = visible.filter((f) => f.status === "open");
  const done = visible.filter((f) => f.status === "done");
  const buckets = bucketize(open);
  const senderName = (key: string) => byKey.get(key)?.name.split(" ")[0] ?? key;

  return (
    <AppShell
      title="Follow-ups"
      subtitle="People who said later. Write to them on the day shown, by hand, from the Inbox."
      actions={
        <div className="inline-flex rounded-xl border bg-card p-1 text-sm font-semibold">
          {(["everyone", "mine"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`rounded-lg px-3 py-1.5 capitalize ${scope === s ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {s === "mine" ? "Mine" : "Everyone"}
            </button>
          ))}
        </div>
      }
    >
      {q.error && (
        <div className="mb-4">
          <ErrorBanner error={q.error} />
        </div>
      )}
      {update.error && (
        <div className="mb-4">
          <ErrorBanner error={update.error} />
        </div>
      )}
      {q.isPending ? (
        <Card>
          <Loading label="Loading follow-ups" />
        </Card>
      ) : open.length === 0 ? (
        <Card>
          <EmptyState title="Nothing to follow up">
            When someone replies with “later”, the reply alert adds them here. You can also add one
            from any Inbox thread.
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-6">
          {buckets
            .filter((b) => b.items.length > 0)
            .map((b) => (
              <section key={b.key}>
                <div className="mb-2 flex items-baseline gap-2">
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${b.tone}`}>
                    {b.title}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {b.items.length}
                    {b.hint ? ` · ${b.hint}` : ""}
                  </span>
                </div>
                <div className="grid gap-3">
                  {b.items.map((f) => {
                    const busy = update.isPending && update.variables?.id === f.id;
                    const draft = editing[f.id];
                    return (
                      <Card key={f.id} className="p-4">
                        <div className="flex flex-wrap items-start gap-4">
                          <Avatar initials={initialsOf(f.person_name)} size="lg" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-ink">{f.person_name}</span>
                              {f.profile_url && (
                                <a
                                  href={f.profile_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-muted-foreground hover:text-primary"
                                  aria-label="Open LinkedIn profile"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {[f.headline, f.company].filter(Boolean).join(" · ")}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span>
                                For <b className="text-ink">{senderName(f.member_key)}</b>
                              </span>
                              {f.campaign && (
                                <span className="rounded-full bg-muted px-2 py-0.5">
                                  {f.campaign}
                                </span>
                              )}
                              <span>
                                Due <b className="text-ink">{fmt(f.due_on)}</b>
                              </span>
                            </div>
                            {f.reason && (
                              <div className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm italic">
                                “{f.reason}”
                              </div>
                            )}
                            {f.note && <div className="mt-2 text-sm">{f.note}</div>}
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {f.chat_id && f.member_key && (
                              <Link
                                to="/inbox"
                                search={{ member: f.member_key, chat: f.chat_id }}
                                className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-muted"
                              >
                                <MessagesSquare className="h-4 w-4" /> Open thread
                              </Link>
                            )}
                            <input
                              type="date"
                              value={draft ?? f.due_on}
                              onChange={(e) =>
                                setEditing((m) => ({ ...m, [f.id]: e.target.value }))
                              }
                              onBlur={() => {
                                if (draft && draft !== f.due_on) {
                                  update.mutate({ id: f.id, due_on: draft });
                                }
                                setEditing((m) => {
                                  const n = { ...m };
                                  delete n[f.id];
                                  return n;
                                });
                              }}
                              className="rounded-xl border bg-card px-2 py-2 text-sm"
                              aria-label="Due date"
                            />
                            <Btn
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                update.mutate({ id: f.id, due_on: addDays(f.due_on, 7) })
                              }
                            >
                              +1 week
                            </Btn>
                            <Btn
                              variant="success"
                              disabled={busy}
                              onClick={() => update.mutate({ id: f.id, status: "done" })}
                            >
                              <Check className="h-4 w-4" /> Done
                            </Btn>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowDone((v) => !v)}
            className="text-sm font-semibold text-muted-foreground hover:text-ink"
          >
            {showDone ? "Hide" : "Show"} {done.length} done
          </button>
          {showDone && (
            <div className="mt-3 grid gap-2">
              {done
                .sort((a, z) => String(z.done_at).localeCompare(String(a.done_at)))
                .map((f) => (
                  <Card key={f.id} className="flex items-center gap-3 p-3 opacity-70">
                    <Avatar initials={initialsOf(f.person_name)} size="sm" />
                    <div className="min-w-0 flex-1 truncate text-sm">
                      <span className="font-semibold">{f.person_name}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {f.company || f.headline} · done{" "}
                        {f.done_at ? fmt(f.done_at.slice(0, 10)) : ""}
                      </span>
                    </div>
                    <Btn
                      variant="outline"
                      disabled={update.isPending}
                      onClick={() =>
                        update.mutate({ id: f.id, status: "open", due_on: addDays(today(), 7) })
                      }
                    >
                      <RotateCcw className="h-4 w-4" /> Reopen
                    </Btn>
                  </Card>
                ))}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
