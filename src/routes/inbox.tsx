import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send, Sparkles, Paperclip, ExternalLink, CalendarPlus } from "lucide-react";
import { AppShell, Card, Avatar, StatusPill, Btn } from "@/components/lily/AppShell";
import { conversations, thread as initialThread } from "@/lib/mock";

export const Route = createFileRoute("/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — Lily" },
      { name: "description", content: "Unified LinkedIn inbox for your whole sales team." },
      { property: "og:title", content: "Inbox — Lily" },
      { property: "og:description", content: "Unified LinkedIn inbox for your whole sales team." },
    ],
  }),
  component: Inbox,
});

function Inbox() {
  const [active, setActive] = useState("m1");
  const [msgs, setMsgs] = useState(initialThread);
  const [draft, setDraft] = useState("");
  const c = conversations.find((x) => x.id === active)!;
  const send = () => { if (!draft.trim()) return; setMsgs((m) => [...m, { from: "me", text: draft, when: "now" }]); setDraft(""); };

  return (
    <AppShell title="Inbox" subtitle="Every LinkedIn conversation across your team.">
      <Card className="grid h-[calc(100vh-220px)] min-h-[520px] grid-cols-[320px_1fr_260px] overflow-hidden">
        <div className="overflow-y-auto border-r">
          <div className="flex gap-1 border-b p-3 text-xs font-semibold">
            {["All", "Unread", "Interested", "Meetings"].map((f, i) => <button key={f} className={`rounded-md px-2.5 py-1 ${i === 0 ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted"}`}>{f}</button>)}
          </div>
          {conversations.map((x) => (
            <button key={x.id} onClick={() => setActive(x.id)} className={`flex w-full gap-3 border-b px-4 py-3 text-left transition ${active === x.id ? "bg-primary-soft" : "hover:bg-muted/50"}`}>
              <Avatar initials={x.initials} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between"><span className={`text-sm ${x.unread ? "font-bold text-ink" : "font-medium"}`}>{x.name}</span><span className="text-[11px] text-muted-foreground">{x.when}</span></div>
                <div className="truncate text-xs text-muted-foreground">{x.preview}</div>
                <div className="mt-1.5"><StatusPill status={x.tag} /></div>
              </div>
              {x.unread && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary" />}
            </button>
          ))}
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-3 border-b px-5 py-3">
            <Avatar initials={c.initials} size="sm" />
            <div className="flex-1"><div className="text-sm font-semibold text-ink">{c.name}</div><div className="text-xs text-muted-foreground">{c.company} · via {c.campaign}</div></div>
            <Btn variant="outline"><CalendarPlus className="h-4 w-4" /> Book meeting</Btn>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-background p-5">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.from === "me" ? "justify-end" : ""}`}>
                <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${m.from === "me" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card"}`}>
                  {m.text}<div className="mt-1 text-[10px] opacity-60">{m.when}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t p-3">
            <div className="mb-2 flex gap-2">
              {["Send pricing", "Propose a call", "Share demo"].map((s) => <button key={s} onClick={() => setDraft(`Lily suggestion: ${s.toLowerCase()} for ${c.company}…`)} className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary"><Sparkles className="h-3 w-3" />{s}</button>)}
            </div>
            <div className="flex items-end gap-2 rounded-xl border bg-card p-2">
              <button className="p-2 text-muted-foreground"><Paperclip className="h-4 w-4" /></button>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={2} placeholder="Write a message…" className="flex-1 resize-none bg-transparent text-sm outline-none" />
              <Btn onClick={send}><Send className="h-4 w-4" /></Btn>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto border-l p-5">
          <div className="flex flex-col items-center text-center">
            <Avatar initials={c.initials} size="lg" />
            <div className="mt-2 font-semibold text-ink">{c.name}</div>
            <div className="text-xs text-muted-foreground">{c.company}</div>
            <a className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">LinkedIn profile <ExternalLink className="h-3 w-3" /></a>
          </div>
          <div className="mt-5 space-y-3 text-xs">
            <div><div className="font-semibold uppercase tracking-wider text-muted-foreground">Stage</div><select className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"><option>{c.tag}</option><option>Meeting</option><option>Not interested</option></select></div>
            <div><div className="font-semibold uppercase tracking-wider text-muted-foreground">Owner</div><div className="mt-1 text-sm">Maya Chen</div></div>
            <div><div className="font-semibold uppercase tracking-wider text-muted-foreground">Sequence</div><div className="mt-1 text-sm">Paused — lead replied</div></div>
          </div>
          <div className="mt-5 rounded-xl bg-gradient-ink p-4 text-xs text-ink-foreground">
            <div className="flex items-center gap-1 font-semibold"><Sparkles className="h-3 w-3" /> Latest news on {c.company}</div>
            <p className="mt-2 opacity-80">"{c.company} expands data team after Series F" — 2 days ago</p>
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
