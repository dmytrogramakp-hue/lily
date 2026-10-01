import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Gauge } from "lucide-react";
import { Btn, Card, ErrorBanner } from "@/components/lily/AppShell";
import { setSendingSettings, unwrap } from "@/lib/api";
import type { CampaignSummary } from "@/lib/types";

const SLIDER_MAX = 50;
const SAFE_LIMIT = 25;
const RUNS_PER_DAY = 9; // hourly, 9:05 to 17:05 Madrid

export function SendingCard({ summary }: { summary: CampaignSummary | undefined }) {
  const qc = useQueryClient();
  const saved = summary?.settings;
  const [limit, setLimit] = useState<number>(saved?.daily_invite_limit ?? 20);
  const [weekends, setWeekends] = useState<boolean>(saved?.send_weekends ?? false);

  useEffect(() => {
    if (!saved) return;
    setLimit(saved.daily_invite_limit);
    setWeekends(saved.send_weekends);
  }, [saved?.daily_invite_limit, saved?.send_weekends]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () =>
      unwrap(setSendingSettings({ data: { daily_invite_limit: limit, send_weekends: weekends } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const dirty = !!saved && (saved.daily_invite_limit !== limit || saved.send_weekends !== weekends);
  const sent = summary?.today.invites_sent ?? 0;
  const activeCount = (summary?.campaigns ?? []).filter((c) => c.status === "active").length;
  const queued = summary?.totals.pending ?? 0;
  const perRun = limit > 0 ? Math.ceil(limit / RUNS_PER_DAY) : 0;

  const setClamped = (n: number) =>
    setLimit(Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0))));

  return (
    <Card className="mb-6 p-5">
      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-[260px] flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Gauge className="h-4 w-4 text-primary" /> Daily invite limit
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Lily sends exactly this many connection requests per LinkedIn account per{" "}
            {weekends ? "day" : "weekday"}, spread hourly between 9:00 and 17:00 Madrid time, to
            leads in active campaigns.
          </p>
          <div className="mt-4 flex items-center gap-4">
            <input
              type="range"
              min={0}
              max={SLIDER_MAX}
              step={1}
              value={Math.min(limit, SLIDER_MAX)}
              onChange={(e) => setClamped(Number(e.target.value))}
              aria-label="Daily invite limit"
              className="h-2 flex-1 cursor-pointer accent-[var(--primary)]"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                value={limit}
                onChange={(e) => setClamped(Number(e.target.value))}
                aria-label="Daily invite limit, number"
                className="w-20 rounded-lg border px-3 py-1.5 text-right text-sm font-semibold"
              />
              <span className="text-sm text-muted-foreground">per day</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {limit === 0
              ? "Invites are paused for all campaigns."
              : `About ${perRun} per hourly run.`}
          </div>
          {limit > SAFE_LIMIT && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              LinkedIn caps connection requests at roughly 100 to 200 a week, depending on the
              account. Above {SAFE_LIMIT} a day you risk a temporary restriction.
            </div>
          )}
        </div>

        <div className="w-full space-y-4 sm:w-64">
          <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
            <span>
              <span className="font-semibold text-ink">Send on weekends</span>
              <span className="block text-xs text-muted-foreground">
                Off means Monday to Friday only
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={weekends}
              onClick={() => setWeekends((w) => !w)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${weekends ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition ${weekends ? "left-[22px]" : "left-0.5"}`}
              />
            </button>
          </label>

          <div className="rounded-xl bg-muted/60 p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sent today</span>
              <span className="font-semibold text-ink">
                {sent} / {saved?.daily_invite_limit ?? "–"}
              </span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">Queued in active campaigns</span>
              <span className="font-semibold text-ink">{queued.toLocaleString()}</span>
            </div>
            {activeCount === 0 && (
              <div className="mt-2 text-warning">
                No campaign is active, so nothing is being sent.
              </div>
            )}
          </div>

          <Btn
            className="w-full justify-center"
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending}
          >
            {save.isSuccess && !dirty ? (
              <>
                <Check className="h-4 w-4" /> Saved
              </>
            ) : save.isPending ? (
              "Saving"
            ) : (
              "Save sending settings"
            )}
          </Btn>
        </div>
      </div>
      {save.error && (
        <div className="mt-4">
          <ErrorBanner error={save.error} />
        </div>
      )}
    </Card>
  );
}
