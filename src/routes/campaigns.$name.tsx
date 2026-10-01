import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  Circle,
  ExternalLink,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Rocket,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import {
  AppShell,
  Btn,
  Card,
  EmptyState,
  ErrorBanner,
  Loading,
  StatusPill,
  timeAgo,
} from "@/components/lily/AppShell";
import { LeadUploader } from "@/components/lily/LeadUploader";
import { SequenceEditor } from "@/components/lily/SequenceEditor";
import { DeleteCampaignDialog } from "@/components/lily/DeleteCampaignDialog";
import { getCampaignLeads, getCampaigns, unwrap, updateCampaign } from "@/lib/api";
import { describeSequence, presetLabel } from "@/lib/sequence";
import type { Campaign, CampaignLead, LeadStage } from "@/lib/types";
import { senderFor, senderProfile, useCurrentUser, useTeam } from "@/lib/current-user";

export const Route = createFileRoute("/campaigns/$name")({
  head: ({ params }) => ({ meta: [{ title: `${params.name} · Lily` }] }),
  component: CampaignPage,
});

type Tab = "overview" | "leads" | "sequence";
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

const STAGES: { id: LeadStage | "all"; label: string; tone: string }[] = [
  { id: "all", label: "All", tone: "" },
  { id: "queued", label: "Queued", tone: "bg-muted text-muted-foreground" },
  { id: "invited", label: "Invited", tone: "bg-primary-soft text-primary" },
  { id: "connected", label: "Connected", tone: "bg-success-soft text-success" },
  { id: "message_1", label: "Message 1 sent", tone: "bg-ink/10 text-ink" },
  { id: "message_2", label: "Message 2 sent", tone: "bg-ink/10 text-ink" },
  { id: "message_3", label: "Message 3 sent", tone: "bg-ink/10 text-ink" },
  { id: "replied", label: "Replied", tone: "bg-success text-primary-foreground" },
  { id: "needs_review", label: "Needs review", tone: "bg-warning-soft text-warning" },
  { id: "stopped", label: "Stopped", tone: "bg-muted text-muted-foreground" },
  { id: "skipped", label: "Skipped", tone: "bg-destructive-soft text-destructive" },
];
const stageMeta = (s: LeadStage) => STAGES.find((x) => x.id === s) ?? STAGES[1]!;

/** Next scheduled message as a short Madrid date, or "Due now" when the date has passed. */
function nextMessageLabel(l: CampaignLead): string {
  if (!l.next_message_on) return "–";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  const step = l.next_message_step ? `Msg ${l.next_message_step}, ` : "";
  if (l.next_message_on <= today) return `${step}due now`;
  const d = new Date(`${l.next_message_on}T12:00:00Z`);
  return `${step}${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}`;
}

function CampaignPage() {
  const { name } = Route.useParams();
  const qc = useQueryClient();
  const summary = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => unwrap(getCampaigns()),
    staleTime: 60_000,
  });
  const c = summary.data?.campaigns.find((x) => x.name === name);
  const isLegacyQueue = name === "Legacy queue";
  const { byKey: team } = useTeam();

  const [tab, setTab] = useState<Tab | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (tab || !c) return;
    if (c.status === "draft" && c.leads === 0) setTab("leads");
    else if (!c.sequence && !isLegacyQueue) setTab("sequence");
    else setTab("overview");
  }, [c, tab, isLegacyQueue]);

  const status = useMutation({
    mutationFn: (s: "active" | "paused" | "archived") =>
      unwrap(updateCampaign({ data: { name, status: s } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  if (summary.isPending) {
    return (
      <AppShell title={name}>
        <Card>
          <Loading label="Loading campaign" />
        </Card>
      </AppShell>
    );
  }
  if (summary.error || !c) {
    return (
      <AppShell title={name}>
        {summary.error ? (
          <ErrorBanner error={summary.error} />
        ) : (
          <Card>
            <EmptyState title="Campaign not found">
              <Link to="/" className="text-primary underline">
                Back to campaigns
              </Link>
            </EmptyState>
          </Card>
        )}
      </AppShell>
    );
  }

  const limit = summary.data?.settings.daily_invite_limit ?? 20;
  const from = senderFor(c.owner, team, summary.data?.default_account);
  const noSender = !isLegacyQueue && !from.account;
  const canLaunch = !isLegacyQueue && c.leads > 0 && !!c.sequence && c.pending > 0 && !noSender;
  const etaDays = limit > 0 ? Math.ceil(c.pending / limit) : null;

  const launch = () => {
    const lines = describeSequence(c.sequence)
      .map((l, i) => `${i + 1}. ${l}`)
      .join("\n");
    const ok = window.confirm(
      `Launch "${c.name}"?\n\n${c.pending.toLocaleString()} leads queued.\n${lines}\n\n` +
        `Invites go out at ${limit} a day, hourly from 9:00 to 17:00 Madrid time` +
        (etaDays
          ? `, about ${etaDays} sending day${etaDays > 1 ? "s" : ""} to get through the list.`
          : "."),
    );
    if (ok) status.mutate("active");
  };

  const headerActions = (
    <>
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-lg border bg-card px-3.5 py-2 text-sm font-semibold hover:bg-muted"
      >
        <ArrowLeft className="h-4 w-4" /> All campaigns
      </Link>
      {c.status === "active" ? (
        <Btn variant="outline" onClick={() => status.mutate("paused")} disabled={status.isPending}>
          <Pause className="h-4 w-4" /> Pause
        </Btn>
      ) : c.status !== "archived" ? (
        <Btn onClick={launch} disabled={!canLaunch || status.isPending}>
          {c.status === "paused" ? <Play className="h-4 w-4" /> : <Rocket className="h-4 w-4" />}
          {c.status === "paused" ? "Resume" : "Launch campaign"}
        </Btn>
      ) : null}
    </>
  );

  return (
    <AppShell
      title={c.name}
      subtitle={[
        presetLabel(c.sequence),
        c.source_file ? c.source_file : null,
        c.created_at ? `created ${timeAgo(c.created_at)} ago` : null,
      ]
        .filter(Boolean)
        .join(" · ")}
      actions={headerActions}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusPill status={c.status} />
        {!isLegacyQueue && <OwnerControl campaign={c} />}
        {!isLegacyQueue && from.account && (
          <span className="text-xs text-muted-foreground">
            Sends from {from.member?.linkedin_name || from.member?.name || "Dima"}'s LinkedIn
            {from.reason === "default" ? " (unassigned campaigns use Dima's)" : ""}
          </span>
        )}
        {c.status === "active" && (
          <span className="text-xs text-muted-foreground">
            Sending {limit} invites a day{etaDays ? `, about ${etaDays} sending days left` : ""}
          </span>
        )}
        {status.error && <ErrorBanner error={status.error} />}
      </div>

      {noSender && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          {from.member?.active === false
            ? `${from.member.name} has left the team.`
            : `${from.member?.name ?? "The owner"} has not connected a LinkedIn account yet.`}{" "}
          {c.status === "active"
            ? "Nothing is being sent for this campaign until that is fixed."
            : "Connect it or assign the campaign to someone with LinkedIn connected before launching."}
          <Link to="/settings" className="font-semibold underline">
            Open Team settings
          </Link>
        </div>
      )}

      {(c.status === "draft" || c.status === "legacy") && !isLegacyQueue && (
        <SetupChecklist campaign={c} onGo={setTab} canLaunch={canLaunch} onLaunch={launch} />
      )}

      <div className="mb-5 flex gap-1 border-b">
        {(["overview", "leads", "sequence"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold capitalize transition ${(tab ?? "overview") === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t === "leads" ? `Leads (${c.leads.toLocaleString()})` : t}
          </button>
        ))}
      </div>

      {(tab ?? "overview") === "overview" && (
        <Overview campaign={c} limit={limit} onEditSequence={() => setTab("sequence")} />
      )}
      {tab === "leads" && <LeadsTab campaign={c} locked={isLegacyQueue} />}
      {tab === "sequence" && (
        <SequenceTab
          campaign={c}
          locked={
            isLegacyQueue
              ? "These leads came from the old queue without a campaign, so a sequence cannot be attached. Upload them into a campaign to run one."
              : null
          }
        />
      )}

      {!isLegacyQueue && (
        <div className="mt-10 flex flex-wrap items-center justify-end gap-4 border-t pt-4">
          {c.status === "archived" ? (
            <button
              onClick={() => status.mutate("paused")}
              disabled={status.isPending}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Archive className="h-3.5 w-3.5" /> Restore from archive
            </button>
          ) : c.status !== "legacy" ? (
            <button
              onClick={() =>
                window.confirm(
                  `Archive "${c.name}"? It stops sending and moves to the Archived filter. You can restore it later.`,
                ) && status.mutate("archived")
              }
              disabled={status.isPending}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Archive className="h-3.5 w-3.5" /> Archive campaign
            </button>
          ) : null}
          <button
            onClick={() => setDeleteOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete campaign
          </button>
        </div>
      )}
      <DeleteCampaignDialog
        campaign={c}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => navigate({ to: "/" })}
      />
    </AppShell>
  );
}

/** Owner dropdown plus an "Assign to me" shortcut. Anyone on the team can reassign. */
function OwnerControl({ campaign: c }: { campaign: Campaign }) {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const { members, byKey } = useTeam();
  const assign = useMutation({
    mutationFn: (owner: string) => unwrap(updateCampaign({ data: { name: c.name, owner } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
  const current = c.owner ? byKey.get(c.owner) : undefined;
  // Keep a removed owner visible in the list so the select still shows who owns it.
  const options = current && !current.active ? [...members, current] : members;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="h-4 w-px bg-border" />
      <label htmlFor="owner" className="font-medium">
        Owner
      </label>
      <select
        id="owner"
        value={c.owner ?? ""}
        disabled={assign.isPending}
        onChange={(e) => assign.mutate(e.target.value)}
        className="rounded-lg border bg-card px-2 py-1 text-xs font-semibold text-ink"
      >
        <option value="">Unassigned</option>
        {options.map((m) => (
          <option key={m.key} value={m.key}>
            {m.name}
            {m.active ? "" : " (left team)"}
          </option>
        ))}
        {c.owner && !current && <option value={c.owner}>{c.owner}</option>}
      </select>
      {user && c.owner !== user.key && (
        <button
          type="button"
          onClick={() => assign.mutate(user.key)}
          disabled={assign.isPending}
          className="font-semibold text-primary hover:underline disabled:opacity-50"
        >
          Assign to me
        </button>
      )}
      {assign.isPending && <span>Saving</span>}
      {assign.error && (
        <span className="text-destructive">
          {assign.error instanceof Error ? assign.error.message : "Could not save"}
        </span>
      )}
    </div>
  );
}

function SetupChecklist({
  campaign: c,
  onGo,
  canLaunch,
  onLaunch,
}: {
  campaign: Campaign;
  onGo: (t: Tab) => void;
  canLaunch: boolean;
  onLaunch: () => void;
}) {
  const steps = [
    {
      done: c.leads > 0,
      title: "Add leads",
      detail:
        c.leads > 0
          ? `${c.leads.toLocaleString()} leads in this campaign`
          : "Upload a CSV of LinkedIn profiles",
      tab: "leads" as Tab,
    },
    {
      done: !!c.sequence,
      title: "Build the sequence",
      detail: c.sequence ? presetLabel(c.sequence) : "Invite only, or invite plus messages",
      tab: "sequence" as Tab,
    },
    {
      done: false,
      title: "Review and launch",
      detail: canLaunch ? "Everything is ready" : "Finish the steps above first",
      tab: "overview" as Tab,
    },
  ];
  return (
    <Card className="mb-6 p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Set up this campaign
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {steps.map((s, i) => (
          <button
            key={s.title}
            onClick={() => (i === 2 && canLaunch ? onLaunch() : onGo(s.tab))}
            className={`flex items-start gap-3 rounded-xl border p-3 text-left transition hover:border-primary/50 ${i === 2 && canLaunch ? "border-primary bg-primary-soft" : ""}`}
          >
            {s.done ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <div>
              <div className="text-sm font-semibold text-ink">
                {i + 1}. {s.title}
              </div>
              <div className="text-xs text-muted-foreground">{s.detail}</div>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}

function Overview({
  campaign: c,
  limit,
  onEditSequence,
}: {
  campaign: Campaign;
  limit: number;
  onEditSequence: () => void;
}) {
  const kpis = [
    { label: "Leads", value: c.leads },
    { label: "Queued", value: c.pending },
    { label: "Invited", value: c.invited },
    {
      label: "Connected",
      value: c.accepted,
      sub: c.invited ? `${pct(c.accepted, c.invited)}% acceptance` : "",
    },
    {
      label: "Replied",
      value: c.replied,
      sub: c.msg1 ? `${pct(c.replied, c.msg1)}% of messaged` : "",
    },
    {
      label: "Skipped",
      value: c.excluded,
      sub: c.unreachable ? `${c.unreachable} unreachable profiles` : "",
    },
  ];
  const funnel = [
    { label: "Invited", v: c.invited },
    { label: "Connected", v: c.accepted },
    { label: "Message 1", v: c.msg1 },
    { label: "Message 2", v: c.msg2 },
    ...(c.msg3 ? [{ label: "Message 3", v: c.msg3 }] : []),
    { label: "Replied", v: c.replied },
  ];
  const lines = describeSequence(c.sequence);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="mt-2 text-2xl font-bold text-ink">{k.value.toLocaleString()}</div>
            {k.sub && <div className="mt-1 text-[11px] text-muted-foreground">{k.sub}</div>}
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-ink">Progress</div>
            <div className="text-xs text-muted-foreground">
              {pct(c.invited + c.excluded, c.leads)}% of the list processed
            </div>
          </div>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted">
            <div className="bg-primary" style={{ width: `${pct(c.accepted, c.leads)}%` }} />
            <div
              className="bg-primary-glow"
              style={{ width: `${pct(c.invited - c.accepted, c.leads)}%` }}
            />
            <div className="bg-destructive/40" style={{ width: `${pct(c.excluded, c.leads)}%` }} />
          </div>
          <div className="mt-6 space-y-3">
            {funnel.map((f) => (
              <div key={f.label}>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className="font-semibold">{f.v.toLocaleString()}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-primary"
                    style={{ width: `${Math.max(1, pct(f.v, Math.max(1, c.invited)))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          {c.last_invite_at && (
            <div className="mt-4 text-xs text-muted-foreground">
              Last invite sent {timeAgo(c.last_invite_at)} ago
            </div>
          )}
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-ink">Sequence</div>
            <button
              onClick={onEditSequence}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          </div>
          {lines.length ? (
            <ol className="mt-3 space-y-2 text-sm">
              {lines.map((l, i) => (
                <li key={i} className="flex gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary-soft text-[11px] font-bold text-primary">
                    {i + 1}
                  </span>
                  {l}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No sequence yet.</p>
          )}
          <div className="mt-5 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            Pace: {limit} invites a day across all active campaigns, hourly from 9:00 to 17:00
            Madrid time. Change it on the Campaigns page.
          </div>
        </Card>
      </div>
    </div>
  );
}

const PAGE = 50;

function LeadsTab({ campaign: c, locked }: { campaign: Campaign; locked: boolean }) {
  const [adding, setAdding] = useState(c.leads === 0 && !locked);
  const [stage, setStage] = useState<LeadStage | "all">("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const leads = useQuery({
    queryKey: ["campaign-leads", c.name],
    queryFn: () => unwrap(getCampaignLeads({ data: { name: c.name } })),
    staleTime: 60_000,
  });
  const all = leads.data?.leads ?? [];
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: all.length };
    for (const l of all) m[l.stage] = (m[l.stage] ?? 0) + 1;
    return m;
  }, [all]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (l) =>
        (stage === "all" || l.stage === stage) &&
        (!needle ||
          `${l.first_name} ${l.last_name} ${l.company} ${l.title}`.toLowerCase().includes(needle)),
    );
  }, [all, stage, q]);
  useEffect(() => setPage(0), [stage, q]);
  const shown = filtered.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div className="space-y-4">
      {!locked && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Add more leads any time. Duplicates are skipped.
          </div>
          <Btn variant={adding ? "outline" : "primary"} onClick={() => setAdding((a) => !a)}>
            <Upload className="h-4 w-4" /> {adding ? "Close upload" : "Add leads"}
          </Btn>
        </div>
      )}
      {adding && <LeadUploader campaign={c.name} />}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          {STAGES.filter((s) => s.id === "all" || counts[s.id]).map((s) => (
            <button
              key={s.id}
              onClick={() => setStage(s.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${stage === s.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              {s.label} <span className="opacity-70">{(counts[s.id] ?? 0).toLocaleString()}</span>
            </button>
          ))}
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, company, title"
              className="w-56 rounded-lg border bg-background py-1.5 pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <button
            onClick={() => leads.refetch()}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Refresh leads"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${leads.isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
        {leads.error ? (
          <div className="p-4">
            <ErrorBanner error={leads.error} />
          </div>
        ) : leads.isPending ? (
          <Loading label="Loading leads" />
        ) : filtered.length === 0 ? (
          <EmptyState title={all.length ? "No leads match" : "No leads yet"}>
            {all.length ? null : "Upload a CSV to add leads to this campaign."}
          </EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Title</th>
                    <th className="px-3 py-2.5">Company</th>
                    <th className="px-3 py-2.5">Stage</th>
                    <th className="px-3 py-2.5">Invited</th>
                    <th className="px-3 py-2.5">Next message</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((l: CampaignLead) => {
                    const m = stageMeta(l.stage);
                    return (
                      <Fragment key={l.linkedin_url}>
                        <tr className="border-t">
                          <td className="px-4 py-2.5">
                            <a
                              href={l.linkedin_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-ink hover:text-primary"
                            >
                              {[l.first_name, l.last_name].filter(Boolean).join(" ") ||
                                l.linkedin_url.replace(
                                  /^https?:\/\/(www\.)?linkedin\.com\/in\//,
                                  "",
                                )}
                              <ExternalLink className="h-3 w-3 opacity-50" />
                            </a>
                          </td>
                          <td className="max-w-[280px] truncate px-3 py-2.5 text-muted-foreground">
                            {l.title || "–"}
                          </td>
                          <td className="px-3 py-2.5">{l.company || "–"}</td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.tone}`}
                              title={l.note || undefined}
                            >
                              {m.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">
                            {l.invite_sent_at ? `${timeAgo(l.invite_sent_at)} ago` : "–"}
                          </td>
                          <td
                            className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground"
                            title={
                              l.connected_at
                                ? `Accepted ${new Date(l.connected_at).toLocaleDateString("en-GB")}`
                                : undefined
                            }
                          >
                            {nextMessageLabel(l)}
                          </td>
                        </tr>
                        {l.stage === "needs_review" && l.note && (
                          <tr className="bg-warning-soft/40">
                            <td colSpan={6} className="px-4 pb-2.5 pt-0 text-xs text-warning">
                              {l.note}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > PAGE && (
              <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
                <span>
                  {page * PAGE + 1} to {Math.min(filtered.length, (page + 1) * PAGE)} of{" "}
                  {filtered.length.toLocaleString()}
                </span>
                <div className="flex gap-1">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                    className="rounded-md border px-2 py-1 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={(page + 1) * PAGE >= filtered.length}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-md border px-2 py-1 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function SequenceTab({ campaign: c, locked }: { campaign: Campaign; locked: string | null }) {
  const { byKey } = useTeam();
  const summary = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => unwrap(getCampaigns()),
    staleTime: 60_000,
  });
  const from = senderFor(c.owner, byKey, summary.data?.default_account);
  const leads = useQuery({
    queryKey: ["campaign-leads", c.name],
    queryFn: () => unwrap(getCampaignLeads({ data: { name: c.name } })),
    staleTime: 60_000,
    enabled: c.leads > 0,
  });
  return (
    <SequenceEditor
      campaign={c.name}
      initial={c.sequence}
      leads={leads.data?.leads ?? []}
      locked={locked}
      sender={senderProfile(from.member)}
      account={from.account ?? undefined}
      active={c.status === "active"}
    />
  );
}
