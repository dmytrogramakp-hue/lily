import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, Send } from "lucide-react";
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
import { getInbox, getThread, sendMessage, unwrap } from "@/lib/api";

export const Route = createFileRoute("/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox · Lily" },
      { name: "description", content: "Your LinkedIn conversations in one place." },
    ],
  }),
  component: Inbox,
});

const FILTERS = ["All", "Needs reply", "Unread"] as const;

function Inbox() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [active, setActive] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const inbox = useQuery({
    queryKey: ["inbox"],
    queryFn: () => unwrap(getInbox({ data: { limit: 40 } })),
    staleTime: 30_000,
  });
  const conversations = (inbox.data?.conversations ?? []).filter((c) =>
    filter === "All" ? true : filter === "Unread" ? c.unread > 0 : c.last_from_me === false,
  );
  const activeId = active ?? conversations[0]?.chat_id ?? null;
  const summary = (inbox.data?.conversations ?? []).find((c) => c.chat_id === activeId) ?? null;

  const thread = useQuery({
    queryKey: ["thread", activeId],
    queryFn: () => unwrap(getThread({ data: { chatId: activeId! } })),
    enabled: !!activeId,
    staleTime: 15_000,
  });

  const send = useMutation({
    mutationFn: (text: string) => unwrap(sendMessage({ data: { chatId: activeId!, text } })),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["thread", activeId] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
    },
  });

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [thread.data]);

  const submit = () => {
    const text = draft.trim();
    if (!text || !activeId || send.isPending) return;
    send.mutate(text);
  };

  const person = thread.data?.person ?? summary?.person ?? null;

  return (
    <AppShell
      title="Inbox"
      subtitle="Your LinkedIn conversations. Replies here go out from your own account."
      actions={
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
                    {x.last_from_me === false && (
                      <span className="mt-1.5 inline-block rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning">
                        Needs reply
                      </span>
                    )}
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
              </div>
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
