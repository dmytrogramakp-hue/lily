import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Card, Avatar } from "@/components/lily/AppShell";
import { weekly, teammates, campaigns } from "@/lib/mock";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Lily" },
      { name: "description", content: "Team and campaign performance for LinkedIn outreach." },
      { property: "og:title", content: "Analytics — Lily" },
      { property: "og:description", content: "Team and campaign performance for LinkedIn outreach." },
    ],
  }),
  component: Analytics,
});

const team = [
  { invites: 980, accept: 41, reply: 28, meetings: 20 },
  { invites: 712, accept: 36, reply: 30, meetings: 16 },
  { invites: 190, accept: 32, reply: 29, meetings: 3 },
  { invites: 0, accept: 0, reply: 0, meetings: 0 },
];

function Analytics() {
  const max = Math.max(...weekly.map((w) => w.invites));
  const tot = campaigns.reduce((a, c) => ({ leads: a.leads + c.leads, invited: a.invited + c.invited, accepted: a.accepted + c.accepted, replied: a.replied + c.replied, meetings: a.meetings + c.meetings }), { leads: 0, invited: 0, accepted: 0, replied: 0, meetings: 0 });
  const funnel = [
    { label: "Leads", v: tot.leads }, { label: "Invited", v: tot.invited }, { label: "Accepted", v: tot.accepted }, { label: "Replied", v: tot.replied }, { label: "Meetings", v: tot.meetings },
  ];

  return (
    <AppShell title="Analytics" subtitle="Last 7 days · all team members">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-ink">Weekly activity</div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary-glow" />Invites</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary" />Accepted</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-ink" />Replies</span>
            </div>
          </div>
          <div className="mt-6 flex h-56 items-end gap-4">
            {weekly.map((w) => (
              <div key={w.day} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-48 w-full items-end justify-center gap-1">
                  <div className="w-3 rounded-t bg-primary-glow" style={{ height: `${(w.invites / max) * 100}%` }} />
                  <div className="w-3 rounded-t bg-primary" style={{ height: `${(w.accepted / max) * 100}%` }} />
                  <div className="w-3 rounded-t bg-ink" style={{ height: `${(w.replies / max) * 100}%` }} />
                </div>
                <div className="text-xs text-muted-foreground">{w.day}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="font-semibold text-ink">Conversion funnel</div>
          <div className="mt-5 space-y-3">
            {funnel.map((f) => (
              <div key={f.label}>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">{f.label}</span><span className="font-semibold">{f.v.toLocaleString()}</span></div>
                <div className="mt-1 h-2.5 rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-primary" style={{ width: `${Math.max(2, (f.v / tot.leads) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b px-6 py-4 font-semibold text-ink">Team leaderboard</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-6 py-3">Rep</th><th className="px-3 py-3">Invites</th><th className="px-3 py-3">Accept rate</th><th className="px-3 py-3">Reply rate</th><th className="px-3 py-3">Meetings</th></tr>
          </thead>
          <tbody>
            {teammates.map((t, i) => (
              <tr key={t.id} className="border-t">
                <td className="flex items-center gap-3 px-6 py-3"><Avatar initials={t.initials} size="sm" /><div><div className="font-semibold">{t.name}</div><div className="text-xs text-muted-foreground">{t.role}</div></div></td>
                <td className="px-3">{team[i]?.invites}</td>
                <td className="px-3">{team[i]?.accept}%</td>
                <td className="px-3">{team[i]?.reply}%</td>
                <td className="px-3 font-semibold text-primary">{team[i]?.meetings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
