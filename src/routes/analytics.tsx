import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, Card, ErrorBanner, Loading, StatusPill } from "@/components/lily/AppShell";
import { getCampaigns, unwrap } from "@/lib/api";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics · Lily" },
      {
        name: "description",
        content: "Outreach activity and conversion for your LinkedIn campaigns.",
      },
    ],
  }),
  component: Analytics,
});

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function Analytics() {
  const q = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => unwrap(getCampaigns()),
    staleTime: 60_000,
  });
  const d = q.data;
  const daily = d?.daily ?? [];
  const max = Math.max(1, ...daily.map((x) => Math.max(x.invites, x.msg1, x.msg2, x.replied)));
  const t = d?.totals;
  const funnel = t
    ? [
        { label: "Leads in queue", v: t.leads },
        { label: "Invited", v: t.invited },
        { label: "Connected", v: t.connected },
        { label: "Got message 1", v: t.msg1 },
        { label: "Got message 2", v: t.msg2 },
        { label: "Replied", v: t.replied },
      ]
    : [];
  const campaigns = (d?.campaigns ?? []).filter((c) => c.leads > 0);

  return (
    <AppShell title="Analytics" subtitle="Last 14 days of activity, plus all-time conversion.">
      {q.error && (
        <div className="mb-4">
          <ErrorBanner error={q.error} />
        </div>
      )}
      {q.isPending ? (
        <Card>
          <Loading />
        </Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-semibold text-ink">Daily activity</div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-primary-glow" />
                    Invites
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-primary" />
                    Message 1
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-ink" />
                    Replies
                  </span>
                </div>
              </div>
              <div className="mt-6 flex h-56 items-end gap-2">
                {daily.map((w) => (
                  <div
                    key={w.date}
                    className="flex flex-1 flex-col items-center gap-2"
                    title={`${w.date}: ${w.invites} invites, ${w.msg1} message 1, ${w.msg2} message 2, ${w.replied} replies`}
                  >
                    <div className="flex h-48 w-full items-end justify-center gap-0.5">
                      <div
                        className="w-2 rounded-t bg-primary-glow"
                        style={{ height: `${(w.invites / max) * 100}%` }}
                      />
                      <div
                        className="w-2 rounded-t bg-primary"
                        style={{ height: `${(w.msg1 / max) * 100}%` }}
                      />
                      <div
                        className="w-2 rounded-t bg-ink"
                        style={{ height: `${(w.replied / max) * 100}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(w.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="font-semibold text-ink">Conversion, all time</div>
              <div className="mt-5 space-y-3">
                {funnel.map((f) => (
                  <div key={f.label}>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{f.label}</span>
                      <span className="font-semibold">{f.v.toLocaleString()}</span>
                    </div>
                    <div className="mt-1 h-2.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-primary"
                        style={{
                          width: `${Math.max(2, (f.v / Math.max(1, funnel[0]?.v ?? 0)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="mt-6 overflow-hidden">
            <div className="border-b px-6 py-4 font-semibold text-ink">By campaign</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3">Campaign</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Leads</th>
                    <th className="px-3 py-3">Invited</th>
                    <th className="px-3 py-3">Connect rate</th>
                    <th className="px-3 py-3">Reply rate</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.name} className="border-t">
                      <td className="px-6 py-3 font-semibold">{c.name}</td>
                      <td className="px-3">
                        <StatusPill status={c.status} />
                      </td>
                      <td className="px-3">{c.leads.toLocaleString()}</td>
                      <td className="px-3">{c.invited.toLocaleString()}</td>
                      <td className="px-3">{c.invited ? `${pct(c.accepted, c.invited)}%` : "–"}</td>
                      <td className="px-3 font-semibold text-primary">
                        {c.msg1 ? `${pct(c.replied, c.msg1)}%` : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </AppShell>
  );
}
