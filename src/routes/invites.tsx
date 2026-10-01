import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, X, Users, Undo2, CheckCheck } from "lucide-react";
import { AppShell, Card, Btn, Avatar } from "@/components/lily/AppShell";
import { invites as initial } from "@/lib/mock";

export const Route = createFileRoute("/invites")({
  head: () => ({
    meta: [
      { title: "Invites — Lily" },
      { name: "description", content: "Accept, reject and manage LinkedIn connection invites." },
      { property: "og:title", content: "Invites — Lily" },
      { property: "og:description", content: "Accept, reject and manage LinkedIn connection invites." },
    ],
  }),
  component: Invites,
});

function Invites() {
  const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");
  const [handled, setHandled] = useState<Record<string, "accepted" | "rejected" | "withdrawn">>({});
  const list = initial.filter((i) => i.direction === tab);
  const pending = initial.filter((i) => i.direction === "incoming" && !handled[i.id]);

  return (
    <AppShell
      title="Invites"
      subtitle="Review who wants to connect, and track invites your campaigns sent."
      actions={tab === "incoming" ? <Btn variant="outline" onClick={() => setHandled((h) => ({ ...h, ...Object.fromEntries(pending.map((p) => [p.id, "accepted" as const])) }))}><CheckCheck className="h-4 w-4" /> Accept all ({pending.length})</Btn> : undefined}
    >
      <div className="mb-4 inline-flex rounded-xl border bg-card p-1">
        {(["incoming", "outgoing"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t} <span className="opacity-70">{initial.filter((i) => i.direction === t).length}</span></button>
        ))}
      </div>

      <div className="grid gap-3">
        {list.map((i) => {
          const h = handled[i.id];
          return (
            <Card key={i.id} className={`flex items-center gap-4 p-4 transition ${h ? "opacity-60" : ""}`}>
              <Avatar initials={i.initials} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="font-semibold text-ink">{i.name}</span><span className="text-xs text-muted-foreground">· {i.when} ago</span></div>
                <div className="text-sm text-muted-foreground">{i.title} at <span className="font-medium text-foreground">{i.company}</span></div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {i.mutual} mutual</span>
                  {i.campaign && <span className="rounded-md bg-primary-soft px-2 py-0.5 font-medium text-primary">{i.campaign}</span>}
                </div>
                {i.note && <div className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm italic">"{i.note}"</div>}
              </div>
              <div className="flex shrink-0 gap-2">
                {h ? (
                  <>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${h === "accepted" ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive"}`}>{h}</span>
                    <button onClick={() => setHandled(({ [i.id]: _, ...r }) => r)} className="text-muted-foreground hover:text-foreground"><Undo2 className="h-4 w-4" /></button>
                  </>
                ) : tab === "incoming" ? (
                  <>
                    <Btn variant="danger" onClick={() => setHandled((s) => ({ ...s, [i.id]: "rejected" }))}><X className="h-4 w-4" /> Ignore</Btn>
                    <Btn variant="success" onClick={() => setHandled((s) => ({ ...s, [i.id]: "accepted" }))}><Check className="h-4 w-4" /> Accept</Btn>
                  </>
                ) : (
                  <>
                    <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning">Pending</span>
                    <Btn variant="outline" onClick={() => setHandled((s) => ({ ...s, [i.id]: "withdrawn" }))}>Withdraw</Btn>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
