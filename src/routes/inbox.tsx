import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ExternalLink, RefreshCw, Send } from "lucide-react";
import {
  AppShell,
  Card,
  Avatar,
  Btn,
  ErrorBanner,
  Loading,
  EmptyState,
  initialsOf,
  timeAgo,
} from "@/components/lily/AppShell";
import { createFollowUp, getInbox, getThread, sendMessage, triageThread, unwrap } from "@/lib/api";
import type { TriageLabel, TriageResult } from "@/lib/types";
import { AccountPicker, useAccountChoice } from "@/components/lily/AccountPicker";

type InboxSearch = { member?: string; chat?: string };

export const Route = createFileRoute("/inbox")({
  // Deep links from Slack reply alerts: /inbox?member=bohdan&chat=<chat id>
  validateSearch: (s: Record<string, unknown>): InboxSearch => {
    const member = s["member"];
    const chat = s["chat"];
    return {
      ...(typeof member === "string" && /^[a-z0-9-]{1,60}$/.test(member) ? { member } : {}),
      ...(typeof chat === "string" && /^[A-Za-z0-9_-]{4,80}$/.test(chat) ? { chat } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Inbox · Lily" },
      { name: "description", content: "Your LinkedIn conversations in one place." },
    ],
  }),
  component: Inbox,
});

const FILTERS = ["All", "Needs reply", "Unread"] as const;

/* Claude reads every thread that is waiting on us and labels it. Results are kept per browser,
   keyed by the thread and the time of its last message, so a thread is read once per new message. */
const TRIAGE_KEY = "lily.triage.v1";
type Cached = TriageResult & { at: string | null };
const readTriageCache = (): Record<string, Cached> => {
  try {
    return JSON.parse(localStorage.getItem(TRIAGE_KEY) || "{}") as Record<string, Cached>;
  } catch {
    return {};
  }
};
const LABEL_ORDER: Record<TriageLabel, number> = {
  positive: 0,
  question: 1,
  later: 2,
  other: 3,
  decline: 4,
  vendor: 5,
  out_of_office: 6,
};
const LABEL_TEXT: Record<TriageLabel, string> = {
  positive: "Interested",
  question: "Question",
  later: "Later",
  decline: "Declined",
  out_of_office: "Out of office",
  vendor: "Vendor",
  other: "Needs reply",
};
const LABEL_TONE: Record<TriageLabel, string> = {
  positive: "bg-success-soft text-success",
  question: "bg-primary-soft text-primary",
  later: "bg-warning-soft text-warning",
  other: "bg-warning-soft text-warning",
  decline: "bg-muted text-muted-foreground",
  vendor: "bg-muted text-muted-foreground",
  out_of_office: "bg-muted text-muted-foreground",
};

function Inbox() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [active, setActive] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [triage, setTriage] = useState<Record<string, Cached>>(() => readTriageCache());
  // "Follow up later": a reminder in Follow-ups for this thread, default two weeks out.
  const [followOpen, setFollowOpen] = useState(false);
  const [followDate, setFollowDate] = useState(() =>
    new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
  );
  const [followNote, setFollowNote] = useState("");
  const [followSaved, setFollowSaved] = useState<string | null>(null);
  const [triaging, setTriaging] = useState<Record<string, boolean>>({});
  const inFlight = useRef(new Set<string>());
  const bottom = useRef<HTMLDivElement>(null);
  const search = Route.useSearch();
  const choice = useAccountChoice(search.member);
  const account = choice.account;
  useEffect(() => setActive(search.chat ?? null), [account]); // eslint-disable-line react-hooks/exhaustive-deps

  const inbox = useQuery({
    queryKey: ["inbox", account],
    queryFn: () => unwrap(getInbox({ data: { limit: 40, ...(account ? { account } : {}) } })),
    enabled: choice.loaded,
    staleTime: 30_000,
  });
  const conversations = (inbox.data?.conversations ?? []).filter((c) =>
    filter === "All" ? true : filter === "Unread" ? c.unread > 0 : c.last_from_me === false,
  );
  if (filter === "Needs reply") {
    conversations.sort(
      (a, b) =>
        LABEL_ORDER[triage[a.chat_id]?.label ?? "other"] -
          LABEL_ORDER[triage[b.chat_id]?.label ?? "other"] ||
        String(b.last_at ?? "").localeCompare(String(a.last_at ?? "")),
    );
  }
  const activeId = active ?? conversations[0]?.chat_id ?? null;
  const summary = (inbox.data?.conversations ?? []).find((c) => c.chat_id === activeId) ?? null;

  const thread = useQuery({
    queryKey: ["thread", account, activeId],
    queryFn: () =>
      unwrap(getThread({ data: { chatId: activeId!, ...(account ? { account } : {}) } })),
    enabled: !!activeId,
    staleTime: 15_000,
  });

  const send = useMutation({
    mutationFn: (text: string) =>
      unwrap(sendMessage({ data: { chatId: activeId!, text, ...(account ? { account } : {}) } })),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["thread", account, activeId] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
    },
  });

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [thread.data]);

  const memberKey = choice.member?.key;
  const memberName = choice.member?.name;
  const memberRole = choice.member?.role;
  const runTriage = useCallback(
    async (chatId: string, at: string | null) => {
      if (inFlight.current.has(chatId)) return;
      inFlight.current.add(chatId);
      setTriaging((t) => ({ ...t, [chatId]: true }));
      try {
        const sender = memberName
          ? {
              name: memberName,
              ...(memberRole ? { role: memberRole } : {}),
              first_name: memberName.split(" ")[0]!,
            }
          : undefined;
        const r = await unwrap(
          triageThread({
            data: { chatId, ...(account ? { account } : {}), ...(sender ? { sender } : {}) },
          }),
        );
        setTriage((m) => {
          const next = { ...m, [chatId]: { ...r, at } };
          try {
            localStorage.setItem(TRIAGE_KEY, JSON.stringify(next));
          } catch {
            /* per-browser convenience only */
          }
          return next;
        });
      } catch {
        /* stays "Needs reply"; the thread itself is unaffected */
      } finally {
        inFlight.current.delete(chatId);
        setTriaging((t) => {
          const n = { ...t };
          delete n[chatId];
          return n;
        });
      }
    },
    [account, memberKey, memberName, memberRole], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Read the threads waiting on us, two at a time, newest first. Nothing is sent.
  useEffect(() => {
    const waiting = (inbox.data?.conversations ?? [])
      .filter((c) => c.last_from_me === false)
      .slice(0, 20)
      .filter((c) => {
        const cached = triage[c.chat_id];
        return (!cached || cached.at !== c.last_at) && !inFlight.current.has(c.chat_id);
      });
    if (waiting.length === 0) return undefined;
    let cancelled = false;
    const queue = [...waiting];
    const worker = async () => {
      while (!cancelled && queue.length) {
        const c = queue.shift()!;
        await runTriage(c.chat_id, c.last_at);
      }
    };
    void Promise.all([worker(), worker()]);
    return () => {
      cancelled = true;
    };
  }, [inbox.data, runTriage]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    const text = draft.trim();
    if (!text || !activeId || send.isPending) return;
    send.mutate(text);
  };

  const person = thread.data?.person ?? summary?.person ?? null;
  const follow = useMutation({
    mutationFn: () =>
      unwrap(
        createFollowUp({
          data: {
            person_name: person?.name ?? "LinkedIn member",
            ...(person?.headline ? { headline: person.headline } : {}),
            ...(person?.profile_url ? { profile_url: person.profile_url } : {}),
            ...(choice.member ? { member_key: choice.member.key } : {}),
            ...(account ? { account_id: account } : {}),
            ...(activeId ? { chat_id: activeId } : {}),
            due_on: followDate,
            ...(followNote.trim() ? { note: followNote.trim() } : {}),
            reason: summary?.last_from_me === false ? summary.last_text.slice(0, 300) : "",
          },
        }),
      ),
    onSuccess: () => {
      setFollowSaved(followDate);
      setFollowOpen(false);
      setFollowNote("");
      qc.invalidateQueries({ queryKey: ["followups"] });
    },
  });

  return (
    <AppShell
      title="Inbox"
      subtitle={
        choice.member
          ? `${choice.member.name.split(" ")[0]}'s LinkedIn conversations. Replies go out from this account.`
          : "LinkedIn conversations."
      }
      actions={
        <>
          <AccountPicker
            member={choice.member}
            options={choice.options}
            onChange={choice.setMember}
          />
          <Btn
            variant="outline"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["inbox"] });
              qc.invalidateQueries({ queryKey: ["thread"] });
            }}
            disabled={inbox.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${inbox.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Btn>
        </>
      }
    >
      {inbox.error && (
        <div className="mb-4">
          <ErrorBanner error={inbox.error} />
        </div>
      )}
      <Card className="grid h-[calc(100vh-220px)] min-h-[520px] grid-cols-1 overflow-hidden md:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_260px]">
        <div className="flex min-h-0 flex-col border-r">
          <div className="flex gap-1 border-b p-3 text-xs font-semibold">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-2.5 py-1 ${filter === f ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {inbox.isPending ? (
              <Loading label="Loading conversations" />
            ) : conversations.length === 0 ? (
              <EmptyState title="Nothing here" />
            ) : (
              conversations.map((x) => (
                <button
                  key={x.chat_id}
                  onClick={() => setActive(x.chat_id)}
                  className={`flex w-full gap-3 border-b px-4 py-3 text-left transition ${activeId === x.chat_id ? "bg-primary-soft" : "hover:bg-muted/50"}`}
                >
                  <Avatar initials={initialsOf(x.person.name)} src={x.person.picture_url} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-sm ${x.unread ? "font-bold text-ink" : "font-medium"}`}
                      >
                        {x.person.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {timeAgo(x.last_at)}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {x.last_from_me ? "You: " : ""}
                      {x.last_text || "No messages yet"}
                    </div>
                    {x.last_from_me === false &&
                      (() => {
                        const t = triage[x.chat_id];
                        const label = t && t.at === x.last_at ? t.label : null;
                        return (
                          <span
                            className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${label ? LABEL_TONE[label] : "bg-warning-soft text-warning"}`}
                          >
                            {label
                              ? LABEL_TEXT[label]
                              : triaging[x.chat_id]
                                ? "Reading"
                                : "Needs reply"}
                          </span>
                        );
                      })()}
                  </div>
                  {x.unread > 0 && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col">
          {!activeId ? (
            <EmptyState title="Select a conversation" />
          ) : (
            <>
              <div className="flex items-center gap-3 border-b px-5 py-3">
                <Avatar
                  initials={initialsOf(person?.name ?? "?")}
                  src={person?.picture_url}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{person?.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{person?.headline}</div>
                </div>
                {person?.profile_url && (
                  <a
                    href={person.profile_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary"
                  >
                    Profile <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setFollowSaved(null);
                    setFollowOpen((v) => !v);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium hover:bg-muted"
                >
                  <CalendarClock className="h-3.5 w-3.5" /> Follow up later
                </button>
              </div>
              {followOpen && (
                <div className="flex flex-wrap items-center gap-2 border-b bg-primary-soft px-5 py-2 text-sm">
                  <span className="text-xs text-muted-foreground">Remind on</span>
                  <input
                    type="date"
                    value={followDate}
                    onChange={(e) => setFollowDate(e.target.value)}
                    className="rounded-lg border bg-card px-2 py-1 text-sm"
                  />
                  <input
                    value={followNote}
                    onChange={(e) => setFollowNote(e.target.value)}
                    placeholder="Note, optional"
                    className="min-w-0 flex-1 rounded-lg border bg-card px-2 py-1 text-sm"
                  />
                  <Btn onClick={() => follow.mutate()} disabled={follow.isPending || !followDate}>
                    Save
                  </Btn>
                  {follow.error && <ErrorBanner error={follow.error} />}
                </div>
              )}
              {followSaved && (
                <div className="border-b bg-success-soft px-5 py-1.5 text-xs text-success">
                  Follow-up saved for {followSaved}. It is listed under Follow-ups.
                </div>
              )}
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-background p-5">
                {thread.isLoading ? (
                  <Loading label="Loading messages" />
                ) : thread.error ? (
                  <ErrorBanner error={thread.error} />
                ) : (
                  (thread.data?.messages ?? []).map((m) => (
                    <div key={m.id} className={`flex ${m.from_me ? "justify-end" : ""}`}>
                      <div
                        className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${m.from_me ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card"}`}
                      >
                        {m.text}
                        <div className="mt-1 text-[10px] opacity-60">
                          {m.at
                            ? new Date(m.at).toLocaleString("en-GB", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottom} />
              </div>
              <div className="border-t p-3">
                {send.error && (
                  <div className="mb-2">
                    <ErrorBanner error={send.error} />
                  </div>
                )}
                {summary?.last_from_me === false &&
                  (() => {
                    const t = triage[activeId];
                    const fresh = t && t.at === summary.last_at ? t : null;
                    return (
                      <div className="mb-2 rounded-xl border bg-primary-soft p-3 text-sm">
                        {fresh ? (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${LABEL_TONE[fresh.label]}`}
                              >
                                {LABEL_TEXT[fresh.label]}
                              </span>
                              <span className="text-xs text-muted-foreground">{fresh.reason}</span>
                              <button
                                type="button"
                                className="ml-auto text-xs font-medium text-primary disabled:opacity-50"
                                disabled={!!triaging[activeId]}
                                onClick={() => void runTriage(activeId, summary.last_at)}
                              >
                                {triaging[activeId] ? "Reading" : "Read again"}
                              </button>
                            </div>
                            {fresh.reply && (
                              <div className="mt-2 flex items-start gap-2">
                                <div className="min-w-0 flex-1 whitespace-pre-wrap rounded-lg border bg-card px-3 py-2 text-sm">
                                  {fresh.reply}
                                </div>
                                <Btn variant="outline" onClick={() => setDraft(fresh.reply)}>
                                  Use reply
                                </Btn>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            {triaging[activeId] ? "Claude is reading this reply" : "Not read yet"}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                <div className="flex items-end gap-2 rounded-xl border bg-card p-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submit();
                      }
                    }}
                    rows={2}
                    placeholder="Write a reply. Enter sends, Shift+Enter for a new line."
                    className="flex-1 resize-none bg-transparent px-2 text-sm outline-none"
                  />
                  <Btn onClick={submit} disabled={!draft.trim() || send.isPending}>
                    <Send className="h-4 w-4" />
                  </Btn>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="hidden overflow-y-auto border-l p-5 xl:block">
          {person && (
            <div className="flex flex-col items-center text-center">
              <Avatar initials={initialsOf(person.name)} src={person.picture_url} size="lg" />
              <div className="mt-2 font-semibold text-ink">{person.name}</div>
              {person.headline && (
                <div className="mt-1 text-xs text-muted-foreground">{person.headline}</div>
              )}
              {person.profile_url && (
                <a
                  href={person.profile_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary"
                >
                  Open LinkedIn profile <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </div>
      </Card>
    </AppShell>
  );
}
