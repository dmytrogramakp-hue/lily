import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, Undo2 } from "lucide-react";
import { Card, timeAgo } from "@/components/lily/AppShell";
import { getCampaigns, unwrap } from "@/lib/api";
import { useTeam } from "@/lib/current-user";
import type { PendingInviteStats, TeamMember } from "@/lib/types";

/** Alert thresholds for pending (sent, not accepted) invites per LinkedIn account. */
export const PENDING_THRESHOLDS = [800] as const;
/** Scale of the bar: the ceiling sits at 80% so an account over it is visibly in the red. */
const BAR_MAX = 1000;

export type PendingRow = {
  account: string;
  member: TeamMember | undefined;
  stats: PendingInviteStats;
};

export function levelTone(level: number) {
  if (level >= 800)
    return {
      bar: "bg-destructive",
      text: "text-destructive",
      chip: "bg-destructive-soft text-destructive",
      label: "Over 800",
    };
  return {
    bar: "bg-primary",
    text: "text-ink",
    chip: "bg-success-soft text-success",
    label: "Healthy",
  };
}

/** Pending invites per connected LinkedIn account, from the hourly monitor in n8n. */
export function usePendingInvites() {
  const summary = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => unwrap(getCampaigns()),
    staleTime: 60_000,
  });
  const { all } = useTeam();
  const data = summary.data?.pending_invites ?? null;
  const rows = useMemo<PendingRow[]>(() => {
    if (!data) return [];
    return Object.entries(data.accounts)
      .map(([account, stats]) => ({
        account,
        stats,
        member:
          all.find((m) => m.unipile_account_id === account) ??
          all.find((m) => m.key === stats.member_key),
      }))
      .filter((r) => !r.member || r.member.active)
      .sort((a, b) => b.stats.count - a.stats.count);
  }, [data, all]);
  const alerts = rows.filter((r) => r.stats.level >= PENDING_THRESHOLDS[0]);
  return { rows, alerts, checkedAt: data?.checked_at ?? null, loaded: !!summary.data };
}

/** Per-person pending invite counts against the 800 ceiling, with a clean-up link. */
export function PendingInvitesPanel({ className = "" }: { className?: string }) {
  const { rows, checkedAt, loaded } = usePendingInvites();
  if (!loaded) return null;
  return (
    <Card className={`p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-ink">Pending invites per LinkedIn</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Sent but not accepted yet. The ceiling is 800 per account; a Slack alert goes out when
            an account reaches it. Withdraw invites older than 3 weeks to stay well below.
          </p>
        </div>
        {checkedAt && (
          <span className="text-[11px] text-muted-foreground">
            Checked {timeAgo(checkedAt)} ago, hourly on weekdays
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No counts yet. The first check runs at the next hour on a weekday.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => {
            const tone = levelTone(r.stats.level);
            const pct = Math.min(100, (r.stats.count / BAR_MAX) * 100);
            const name = r.member?.name ?? r.stats.member_name;
            return (
              <li
                key={r.account}
                className="grid gap-1.5 sm:grid-cols-[160px_1fr_auto] sm:items-center sm:gap-4"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.stats.error ? (
                      <span className="text-destructive">{r.stats.error}</span>
                    ) : (
                      <>
                        <Clock className="mr-1 inline h-3 w-3" />
                        {r.stats.older_than_21d} older than 3 weeks
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className={`text-base font-bold ${tone.text}`}>
                      {r.stats.count.toLocaleString()}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.chip}`}
                    >
                      {tone.label}
                    </span>
                  </div>
                  <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${tone.bar}`}
                      style={{ width: `${pct}%` }}
                    />
                    {PENDING_THRESHOLDS.map((t) => (
                      <span
                        key={t}
                        className="absolute top-0 h-full w-px bg-ink/25"
                        style={{ left: `${(t / BAR_MAX) * 100}%` }}
                        aria-hidden
                      />
                    ))}
                  </div>
                </div>
                <Link
                  to="/invites"
                  search={{ member: r.member?.key ?? r.stats.member_key, tab: "outgoing" }}
                  className="inline-flex items-center gap-1.5 justify-self-start rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-muted sm:justify-self-end"
                >
                  <Undo2 className="h-3.5 w-3.5" /> Clean up
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Banner shown on every page while any account is at or above 800 pending invites. */
export function PendingInvitesBanner() {
  const { alerts } = usePendingInvites();
  if (alerts.length === 0) return null;
  const worst = alerts[0]!;
  const tone = levelTone(worst.stats.level);
  return (
    <div
      role="alert"
      className={`mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-3 text-sm ${worst.stats.level >= 800 ? "border-destructive/30 bg-destructive-soft text-destructive" : "border-warning/30 bg-warning-soft text-warning"}`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="font-semibold">Too many pending LinkedIn invites.</span>
      <span>
        {alerts
          .map(
            (a) =>
              `${a.member?.name ?? a.stats.member_name} ${a.stats.count.toLocaleString()} (${levelTone(a.stats.level).label.toLowerCase()})`,
          )
          .join(", ")}
        . Withdraw the oldest so LinkedIn keeps accepting new invites.
      </span>
      <Link
        to="/invites"
        search={{ member: worst.member?.key ?? worst.stats.member_key, tab: "outgoing" }}
        className={`ml-auto font-semibold underline ${tone.text}`}
      >
        Clean up now
      </Link>
    </div>
  );
}
