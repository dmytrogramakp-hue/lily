import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Pause,
  Play,
  RefreshCw,
  Send,
  UserCheck,
  MessageCircle,
  Upload,
  Users,
} from "lucide-react";
import {
  AppShell,
  Card,
  Btn,
  StatusPill,
  ErrorBanner,
  Loading,
  EmptyState,
  timeAgo,
} from "@/components/lily/AppShell";
import { getCampaigns, setCampaignStatus, unwrap } from "@/lib/api";
import type { Campaign } from "@/lib/types";
import { SendingCard } from "@/components/lily/SendingCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Campaigns · Lily" },
      { name: "description", content: "LinkedIn outreach campaigns, invites and replies." },
    ],
  }),
  component: Campaigns,
});

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const FILTERS = ["all", "active", "paused", "legacy", "archived"] as const;

function Campaigns() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const campaigns = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => unwrap(getCampaigns()),
    staleTime: 60_000,
  });
  const toggle = useMutation({
    mutationFn: (v: { name: string; status: "active" | "paused" | "archived" }) =>
      unwrap(setCampaignStatus({ data: v })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const data = campaigns.data;
  const list = useMemo(
    () => (data?.campaigns ?? []).filter((c) => filter === "all" || c.status === filter),
    [data, filter],
  );
  const t = data?.totals;

  const kpis = [
    {
      label: "Invites sent",
      value: t ? t.invited.toLocaleString() : "–",
      icon: Send,
      sub: t ? `${t.pending.toLocaleString()} queued in active campaigns` : "",
    },
    {
      label: "Connected",
      value: t ? t.connected.toLocaleString() : "–",
      icon: UserCheck,
      sub: t ? `${pct(t.connected, t.invited)}% of invites` : "",
    },
    {
      label: "Got message 1",
      value: t ? t.msg1.toLocaleString() : "–",
      icon: Users,
      sub: t ? `${t.msg2.toLocaleString()} got the follow-up` : "",
    },
    {
      label: "Replies",
      value: t ? t.replied.toLocaleString() : "–",
      icon: MessageCircle,
      sub: t ? `${pct(t.replied, t.msg1)}% reply rate` : "",
    },
  ];

  const onToggle = (c: Campaign) => {
    if (c.status === "active") {
      toggle.mutate({ name: c.name, status: "paused" });
      return;
    }
    const ok = window.confirm(
      `Activate "${c.name}"?\n\n${c.pending.toLocaleString()} leads are waiting. Invites go out at your daily limit (${data?.settings.daily_invite_limit ?? 20} a day) while the campaign is active.`,
    );
    if (ok) toggle.mutate({ name: c.name, status: "active" });
  };

  return (
    <AppShell
      title="Campaigns"
      subtitle="Every uploaded list is a campaign. New campaigns start paused until you activate them."
      actions={
        <>
          <Btn
            variant="outline"
            onClick={() => campaigns.refetch()}
            disabled={campaigns.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${campaigns.isFetching ? "animate-spin" : ""}`} />{" "}
            Refresh
          </Btn>
          <Link
            to="/leads"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:brightness-110"
          >
            <Upload className="h-4 w-4" /> Upload leads
          </Link>
        </>
      }
    >
      {campaigns.error && (
        <div className="mb-4">
          <ErrorBanner error={campaigns.error} />
        </div>
      )}
      {toggle.error && (
        <div className="mb-4">
          <ErrorBanner error={toggle.error} />
        </div>
      )}

      <SendingCard summary={data} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              {k.label}
              <k.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-ink">{k.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{k.sub}</div>
          </Card>
        ))}
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center gap-1 border-b px-4 py-3">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${filter === f ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted"}`}
            >
              {f}
            </button>
          ))}
          {data && (
            <span className="ml-auto text-xs text-muted-foreground">
              Updated {timeAgo(data.generated_at)} ago
            </span>
          )}
        </div>

        {campaigns.isPending ? (
          <Loading label="Reading the invite queue" />
        ) : list.length === 0 ? (
          <EmptyState title="No campaigns here yet">
            Upload a CSV of LinkedIn profiles to create your first campaign.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-semibold">Campaign</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Leads</th>
                  <th className="px-3 py-3 font-semibold">Progress</th>
                  <th className="px-3 py-3 font-semibold">Queued</th>
                  <th className="px-3 py-3 font-semibold">Skipped</th>
                  <th className="px-3 py-3 font-semibold">Connected</th>
                  <th className="px-3 py-3 font-semibold">Replies</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const busy = toggle.isPending && toggle.variables?.name === c.name;
                  return (
                    <tr key={c.name} className="border-t transition hover:bg-primary-soft/40">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-ink">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.source_file ? `${c.source_file} · ` : ""}
                          {c.created_at
                            ? `added ${timeAgo(c.created_at)} ago`
                            : "from the old queue"}
                          {c.last_invite_at
                            ? ` · last invite ${timeAgo(c.last_invite_at)} ago`
                            : ""}
                        </div>
                      </td>
                      <td className="px-3">
                        <StatusPill status={c.status} />
                      </td>
                      <td className="px-3 font-medium">{c.leads.toLocaleString()}</td>
                      <td className="w-48 px-3">
                        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="bg-primary"
                            style={{ width: `${pct(c.accepted, c.leads)}%` }}
                          />
                          <div
                            className="bg-primary-glow"
                            style={{ width: `${pct(c.invited - c.accepted, c.leads)}%` }}
                          />
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {c.invited} invited · {c.accepted} connected
                        </div>
                      </td>
                      <td className="px-3 font-medium">{c.pending.toLocaleString()}</td>
                      <td
                        className="px-3 text-muted-foreground"
                        title="Unreachable profiles or failed invites"
                      >
                        {c.excluded.toLocaleString()}
                      </td>
                      <td className="px-3 font-semibold">
                        {c.accepted ? `${pct(c.accepted, c.invited)}%` : "–"}
                      </td>
                      <td className="px-3 font-semibold text-primary">{c.replied}</td>
                      <td className="px-4 text-right">
                        {c.status !== "archived" && (
                          <Btn
                            variant={c.status === "active" ? "outline" : "primary"}
                            onClick={() => onToggle(c)}
                            disabled={busy}
                          >
                            {c.status === "active" ? (
                              <>
                                <Pause className="h-4 w-4" /> Pause
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4" /> Activate
                              </>
                            )}
                          </Btn>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Connected and reply numbers per campaign are matched by name against the outreach tracker,
        so they can lag for leads with missing names.
      </p>
    </AppShell>
  );
}
