import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  MessageCircle,
  Pause,
  Plus,
  RefreshCw,
  Send,
  UserCheck,
  Users,
} from "lucide-react";
import {
  AppShell,
  Btn,
  Card,
  EmptyState,
  ErrorBanner,
  Loading,
  OwnerBadge,
  StatusPill,
  timeAgo,
} from "@/components/lily/AppShell";
import { useCurrentUser, useTeam } from "@/lib/current-user";
import { SendingCard } from "@/components/lily/SendingCard";
import { getCampaigns, unwrap, updateCampaign } from "@/lib/api";
import { presetLabel } from "@/lib/sequence";

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
const FILTERS = ["all", "draft", "active", "paused", "legacy", "archived"] as const;

function Campaigns() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [scope, setScope] = useState<"everyone" | "mine">("everyone");
  const { user } = useCurrentUser();
  const { byKey: team, members } = useTeam();
  const campaigns = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => unwrap(getCampaigns()),
    staleTime: 60_000,
  });
  const pause = useMutation({
    mutationFn: (name: string) => unwrap(updateCampaign({ data: { name, status: "paused" } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const data = campaigns.data;
  const list = useMemo(
    () =>
      (data?.campaigns ?? []).filter(
        (c) =>
          (filter === "all" ? c.status !== "archived" : c.status === filter) &&
          (scope === "everyone" || (!!user && c.owner === user.key)),
      ),
    [data, filter, scope, user],
  );
  const t = data?.totals;
  const kpis = [
    {
      label: "Invites sent",
      value: t?.invited,
      icon: Send,
      sub: t ? `${t.pending.toLocaleString()} queued in active campaigns` : "",
    },
    {
      label: "Connected",
      value: t?.connected,
      icon: UserCheck,
      sub: t ? `${pct(t.connected, t.invited)}% of invites` : "",
    },
    {
      label: "Got message 1",
      value: t?.msg1,
      icon: Users,
      sub: t ? `${t.msg2.toLocaleString()} got the follow-up` : "",
    },
    {
      label: "Replies",
      value: t?.replied,
      icon: MessageCircle,
      sub: t ? `${pct(t.replied, t.msg1)}% reply rate` : "",
    },
  ];
  const open = (name: string) => navigate({ to: "/campaigns/$name", params: { name } });

  return (
    <AppShell
      title="Campaigns"
      subtitle="Each campaign has its own leads, sequence and progress. Click one to set it up or track it."
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
            to="/new-campaign"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:brightness-110"
          >
            <Plus className="h-4 w-4" /> New campaign
          </Link>
        </>
      }
    >
      {campaigns.error && (
        <div className="mb-4">
          <ErrorBanner error={campaigns.error} />
        </div>
      )}
      {pause.error && (
        <div className="mb-4">
          <ErrorBanner error={pause.error} />
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
            <div className="mt-3 text-3xl font-bold tracking-tight text-ink">
              {k.value?.toLocaleString() ?? "–"}
            </div>
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
          {members.length > 1 && user && (
            <div className="ml-3 inline-flex rounded-lg border p-0.5 text-xs font-semibold">
              {(["everyone", "mine"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setScope(v)}
                  className={`rounded-md px-2.5 py-1 capitalize transition ${scope === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          {data && (
            <span className="ml-auto text-xs text-muted-foreground">
              Updated {timeAgo(data.generated_at)} ago
            </span>
          )}
        </div>

        {campaigns.isPending ? (
          <Loading label="Reading the invite queue" />
        ) : list.length === 0 ? (
          <EmptyState
            title={scope === "mine" ? "You do not own any campaigns here" : "No campaigns here"}
          >
            <Link to="/new-campaign" className="text-primary underline">
              Create a campaign
            </Link>{" "}
            and add a CSV of LinkedIn profiles.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-semibold">Campaign</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Owner</th>
                  <th className="px-3 py-3 font-semibold">Sequence</th>
                  <th className="px-3 py-3 font-semibold">Leads</th>
                  <th className="px-3 py-3 font-semibold">Progress</th>
                  <th className="px-3 py-3 font-semibold">Queued</th>
                  <th className="px-3 py-3 font-semibold">Connected</th>
                  <th className="px-3 py-3 font-semibold">Replies</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr
                    key={c.name}
                    onClick={() => open(c.name)}
                    className="cursor-pointer border-t transition hover:bg-primary-soft/40"
                  >
                    <td className="px-5 py-4">
                      <Link
                        to="/campaigns/$name"
                        params={{ name: c.name }}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-ink hover:text-primary"
                      >
                        {c.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {c.created_at
                          ? `created ${timeAgo(c.created_at)} ago`
                          : "from the old queue"}
                        {c.last_invite_at ? ` · last invite ${timeAgo(c.last_invite_at)} ago` : ""}
                      </div>
                    </td>
                    <td className="px-3">
                      <StatusPill status={c.status} />
                    </td>
                    <td className="whitespace-nowrap px-3">
                      {c.status === "legacy" ? (
                        <span className="text-xs text-muted-foreground">–</span>
                      ) : (
                        <OwnerBadge owner={c.owner} team={team} />
                      )}
                    </td>
                    <td className="px-3 text-xs text-muted-foreground">
                      {presetLabel(c.sequence)}
                    </td>
                    <td className="px-3 font-medium">{c.leads.toLocaleString()}</td>
                    <td className="w-44 px-3">
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
                    <td className="px-3 font-semibold">
                      {c.invited ? `${pct(c.accepted, c.invited)}%` : "–"}
                    </td>
                    <td className="px-3 font-semibold text-primary">{c.replied}</td>
                    <td className="px-4 text-right">
                      {c.status === "active" ? (
                        <div className="inline-block" onClick={(e) => e.stopPropagation()}>
                          <Btn
                            variant="outline"
                            onClick={() => pause.mutate(c.name)}
                            disabled={pause.isPending && pause.variables === c.name}
                          >
                            <Pause className="h-4 w-4" /> Pause
                          </Btn>
                        </div>
                      ) : (
                        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Connections, messages and replies are tracked by LinkedIn profile and refresh every hour
        during sending hours. Leads from before Lily are matched against the old outreach tracker.
      </p>
    </AppShell>
  );
}
