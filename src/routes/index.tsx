import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pause, Play, MoreHorizontal, Send, UserCheck, MessageCircle, CalendarCheck } from "lucide-react";
import { AppShell, Card, Btn, StatusPill } from "@/components/lily/AppShell";
import { campaigns } from "@/lib/mock";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Campaigns — Lily, NewsCatcher LI Agent" },
      { name: "description", content: "Manage LinkedIn outreach campaigns for your sales team with Lily." },
      { property: "og:title", content: "Campaigns — Lily, NewsCatcher LI Agent" },
      { property: "og:description", content: "Manage LinkedIn outreach campaigns for your sales team with Lily." },
    ],
  }),
  component: Campaigns,
});

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function Campaigns() {
  const [filter, setFilter] = useState("all");
  const list = campaigns.filter((c) => filter === "all" || c.status === filter);
  const tot = campaigns.reduce((a, c) => ({ invited: a.invited + c.invited, accepted: a.accepted + c.accepted, replied: a.replied + c.replied, meetings: a.meetings + c.meetings }), { invited: 0, accepted: 0, replied: 0, meetings: 0 });

  const kpis = [
    { label: "Invites sent", value: tot.invited, icon: Send, sub: "+12% vs last week" },
    { label: "Acceptance rate", value: `${pct(tot.accepted, tot.invited)}%`, icon: UserCheck, sub: `${tot.accepted} accepted` },
    { label: "Reply rate", value: `${pct(tot.replied, tot.accepted)}%`, icon: MessageCircle, sub: `${tot.replied} replies` },
    { label: "Meetings booked", value: tot.meetings, icon: CalendarCheck, sub: "This month" },
  ];

  return (
    <AppShell title="Campaigns" subtitle="Your team's LinkedIn outreach at a glance." actions={<Btn><Plus className="h-4 w-4" /> New campaign</Btn>}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5">
            <div className="flex items-center justify-between text-sm text-muted-foreground">{k.label}<k.icon className="h-4 w-4 text-primary" /></div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-ink">{k.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{k.sub}</div>
          </Card>
        ))}
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center gap-1 border-b px-4 py-3">
          {["all", "active", "paused", "draft", "completed"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${filter === f ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted"}`}>{f}</button>
          ))}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-5 py-3 font-semibold">Campaign</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">Leads</th><th className="px-3 py-3 font-semibold">Funnel</th><th className="px-3 py-3 font-semibold">Accept</th><th className="px-3 py-3 font-semibold">Reply</th><th className="px-3 py-3 font-semibold">Meetings</th><th /></tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-t transition hover:bg-primary-soft/40">
                <td className="px-5 py-4"><div className="font-semibold text-ink">{c.name}</div><div className="text-xs text-muted-foreground">Owner · {c.owner}</div></td>
                <td className="px-3"><StatusPill status={c.status} /></td>
                <td className="px-3 font-medium">{c.leads.toLocaleString()}</td>
                <td className="w-48 px-3">
                  <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                    <div className="bg-primary" style={{ width: `${pct(c.accepted, c.leads)}%` }} />
                    <div className="bg-primary-glow" style={{ width: `${pct(c.invited - c.accepted, c.leads)}%` }} />
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{c.invited} invited · {c.accepted} accepted</div>
                </td>
                <td className="px-3 font-semibold">{pct(c.accepted, c.invited)}%</td>
                <td className="px-3 font-semibold">{pct(c.replied, c.accepted)}%</td>
                <td className="px-3 font-semibold text-primary">{c.meetings}</td>
                <td className="px-4 text-right">
                  <div className="flex justify-end gap-1">
                    <button className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted">{c.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
                    <button className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><MoreHorizontal className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
