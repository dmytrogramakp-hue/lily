import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Undo2 } from "lucide-react";
import { Btn, Card, ErrorBanner, timeAgo } from "@/components/lily/AppShell";
import { getCampaigns, getSentSummary, startBulkWithdraw, unwrap } from "@/lib/api";

const AGE_OPTIONS = [
  { days: 0, label: "Any age" },
  { days: 7, label: "Older than 1 week" },
  { days: 14, label: "Older than 2 weeks" },
  { days: 21, label: "Older than 3 weeks" },
  { days: 30, label: "Older than 1 month" },
];
const PRESETS = [100, 400, 500];
const AVG_SECONDS_PER_WITHDRAW = 6.5;

export function BulkWithdrawCard({
  account,
  accountLabel,
}: {
  /** Unipile account to withdraw from. Undefined = Dima's default account. */
  account?: string | undefined;
  accountLabel?: string | null;
}) {
  const acc = account ? { account } : {};
  const qc = useQueryClient();
  const [minAgeDays, setMinAgeDays] = useState(0);
  const [count, setCount] = useState<number>(100);

  const campaigns = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => unwrap(getCampaigns()),
    staleTime: 60_000,
  });
  const job = campaigns.data?.jobs?.withdraw ?? null;
  const running = job?.status === "running";

  const summary = useQuery({
    queryKey: ["sent-summary", account, minAgeDays],
    queryFn: () => unwrap(getSentSummary({ data: { minAgeDays, ...acc } })),
    staleTime: 60_000,
    refetchInterval: running ? 30_000 : false,
  });

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => qc.invalidateQueries({ queryKey: ["campaigns"] }), 30_000);
    return () => clearInterval(t);
  }, [running, qc]);

  const eligible = summary.data?.eligible ?? 0;
  const total = summary.data?.total ?? 0;
  const effective = Math.min(count, eligible);

  const start = useMutation({
    mutationFn: () => unwrap(startBulkWithdraw({ data: { count: effective, minAgeDays, ...acc } })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["sent-summary"] });
      qc.invalidateQueries({ queryKey: ["invites"] });
    },
  });

  const onStart = () => {
    if (effective < 1) return;
    const minutes = Math.max(1, Math.round((effective * AVG_SECONDS_PER_WITHDRAW) / 60));
    const ok = window.confirm(
      `Withdraw ${effective.toLocaleString()} pending invite${effective > 1 ? "s" : ""}${accountLabel ? ` from ${accountLabel}'s LinkedIn` : ""}, oldest first?\n\n` +
        `This runs in the background and takes about ${minutes} minute${minutes > 1 ? "s" : ""}. ` +
        "LinkedIn will not let you invite these people again for about 3 weeks.",
    );
    if (ok) start.mutate();
  };

  const done =
    running && job?.start_total != null && summary.data
      ? Math.max(0, job.start_total - total)
      : null;

  return (
    <Card className="mb-4 p-5">
      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-[260px] flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Undo2 className="h-4 w-4 text-primary" /> Withdraw pending invites in bulk
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Old pending invites count against LinkedIn's limit and lower your acceptance rate. Lily
            withdraws the oldest ones first, a few seconds apart.
          </p>
          <div className="mt-4 text-sm">
            {summary.isPending ? (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Counting pending invites
              </span>
            ) : summary.data ? (
              <span>
                <span className="text-2xl font-bold text-ink">{total.toLocaleString()}</span>{" "}
                <span className="text-muted-foreground">pending in total</span>
                {minAgeDays > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {eligible.toLocaleString()} match the age filter
                  </span>
                )}
                {summary.data.oldest_at && (
                  <span className="block text-xs text-muted-foreground">
                    Oldest sent {timeAgo(summary.data.oldest_at)} ago
                  </span>
                )}
                {summary.data.truncated && (
                  <span className="block text-xs text-warning">Counted the first 5,000 only.</span>
                )}
              </span>
            ) : null}
          </div>
        </div>

        <div className="w-full space-y-3 sm:w-80">
          <div className="flex gap-2">
            <select
              value={minAgeDays}
              onChange={(e) => setMinAgeDays(Number(e.target.value))}
              aria-label="Minimum invite age"
              className="flex-1 rounded-lg border bg-card px-2 py-1.5 text-sm"
              disabled={running}
            >
              {AGE_OPTIONS.map((o) => (
                <option key={o.days} value={o.days}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={3000}
              value={count}
              onChange={(e) =>
                setCount(Math.max(1, Math.min(3000, Math.round(Number(e.target.value) || 1))))
              }
              aria-label="Number of invites to withdraw"
              className="w-24 rounded-lg border px-3 py-1.5 text-right text-sm font-semibold"
              disabled={running}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setCount(p)}
                disabled={running}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${count === p ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary"}`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCount(Math.max(1, Math.min(3000, eligible)))}
              disabled={running || eligible === 0}
              className="rounded-md bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary disabled:opacity-50"
            >
              All ({Math.min(3000, eligible).toLocaleString()})
            </button>
          </div>
          <Btn
            variant="danger"
            className="w-full justify-center"
            onClick={onStart}
            disabled={running || start.isPending || summary.isPending || effective < 1}
          >
            {running
              ? "Withdrawal in progress"
              : start.isPending
                ? "Starting"
                : effective < 1
                  ? "Nothing to withdraw"
                  : `Withdraw ${effective.toLocaleString()} invite${effective > 1 ? "s" : ""}`}
          </Btn>
          {count > eligible && eligible > 0 && !running && (
            <p className="text-xs text-muted-foreground">
              Only {eligible.toLocaleString()} match, so that is the maximum.
            </p>
          )}
        </div>
      </div>

      {job && (
        <div className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-xs">
          {running ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              Withdrawing {job.requested.toLocaleString()} invites, started{" "}
              {timeAgo(job.started_at)} ago
              {done != null && ` · about ${Math.min(done, job.requested).toLocaleString()} done`}.
              You can leave this page.
            </span>
          ) : (
            <span>
              Last bulk withdrawal: {job.withdrawn?.toLocaleString() ?? 0} withdrawn
              {job.failed ? `, ${job.failed} failed` : ""}, finished {timeAgo(job.finished_at)} ago.
            </span>
          )}
        </div>
      )}
      {start.isSuccess && !running && (
        <div className="mt-3 text-xs font-semibold text-success">
          Started. Progress appears here within a minute.
        </div>
      )}
      {(summary.error || start.error) && (
        <div className="mt-4">
          <ErrorBanner error={summary.error ?? start.error} />
        </div>
      )}
    </Card>
  );
}
