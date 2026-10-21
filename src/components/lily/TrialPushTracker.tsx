import { Card } from "@/components/lily/AppShell";
import type { TrialPush } from "@/lib/types";

/* Progress of the current push against its targets. "Expected by today" follows the ramp schedule
   in Lily, so the comparison is against what should have happened by now, not the end goal. */

type Row = {
  label: string;
  actual: number;
  expected: [number, number];
  target: [number, number];
  note?: string;
};

const fmt = (n: number) => n.toLocaleString();
const range = (r: [number, number]) => (r[0] === r[1] ? fmt(r[0]) : `${fmt(r[0])} to ${fmt(r[1])}`);

function pace(actual: number, expected: [number, number]) {
  if (expected[0] <= 0)
    return actual > 0
      ? { label: "Ahead", tone: "bg-success-soft text-success" }
      : { label: "Not started", tone: "bg-muted text-muted-foreground" };
  if (actual >= expected[1]) return { label: "Ahead", tone: "bg-success-soft text-success" };
  if (actual >= expected[0] * 0.9)
    return { label: "On pace", tone: "bg-primary-soft text-primary" };
  return { label: "Behind", tone: "bg-warning-soft text-warning" };
}

function fmtDay(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function TrialPushTracker({ t }: { t: TrialPush }) {
  const rows: Row[] = [
    {
      label: "Invites sent",
      actual: t.actual.invites,
      expected: [t.expected_today.invites, t.expected_today.invites],
      target: [t.targets.invites, t.targets.invites],
    },
    {
      label: "Connections",
      actual: t.actual.connections,
      expected: t.expected_today.connections,
      target: t.targets.connections,
      note: "15 to 25% acceptance",
    },
    {
      label: "Replies",
      actual: t.actual.replies,
      expected: t.expected_today.replies,
      target: t.targets.replies,
      note: "10 to 15% of connections",
    },
    {
      label: "Trial sign-ups",
      actual: t.actual.signups,
      expected: t.expected_today.signups,
      target: t.targets.signups,
      note: t.actual.signups_updated_at
        ? `${fmt(t.actual.keys_used)} keys used, matched ${fmtDay(t.actual.signups_updated_at)}`
        : "matched by the morning desk",
    },
  ];
  const dayLine =
    t.days.elapsed <= 0
      ? `Starts ${fmtDay(t.start)}`
      : t.days.elapsed >= t.days.total
        ? "Finished"
        : `Working day ${t.days.working_elapsed} of ${t.days.working_total}`;

  return (
    <Card className="mb-6 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="font-semibold text-ink">{t.name}</div>
          <div className="text-xs text-muted-foreground">
            {fmtDay(t.start)} to {fmtDay(t.end)} · {dayLine}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Success means the sign-up target. Everything else tells you whether the funnel is on
          course for it.
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {rows.map((r) => {
          const p = pace(r.actual, r.expected);
          const pct = Math.min(100, (r.actual / Math.max(1, r.target[1])) * 100);
          const marker = Math.min(100, (r.expected[0] / Math.max(1, r.target[1])) * 100);
          return (
            <div key={r.label} className="rounded-xl border bg-background p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.tone}`}>
                  {p.label}
                </span>
              </div>
              <div className="mt-1 text-2xl font-semibold text-ink tabular-nums">
                {fmt(r.actual)}
              </div>
              <div className="relative mt-3 h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-primary"
                  style={{ width: `${pct}%` }}
                />
                {r.expected[0] > 0 && (
                  <div
                    className="absolute top-[-3px] h-[14px] w-0.5 bg-ink"
                    style={{ left: `${marker}%` }}
                    title={`Expected by today: ${range(r.expected)}`}
                  />
                )}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                <span>By today: {range(r.expected)}</span>
                <span>Target: {range(r.target)}</span>
              </div>
              {r.note && <div className="mt-1 text-[11px] text-muted-foreground">{r.note}</div>}
            </div>
          );
        })}
      </div>
      {t.per_sender.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-2">Sender</th>
                <th className="py-2">Invites</th>
                <th className="py-2">Expected by today</th>
                <th className="py-2">Connections</th>
                <th className="py-2">Replies</th>
              </tr>
            </thead>
            <tbody>
              {t.per_sender.map((s) => {
                const p = pace(s.invites, [s.expected_invites, s.expected_invites]);
                return (
                  <tr key={s.key} className="border-t">
                    <td className="py-2 font-semibold">{s.name}</td>
                    <td className="py-2 tabular-nums">
                      {fmt(s.invites)}{" "}
                      <span
                        className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${p.tone}`}
                      >
                        {p.label}
                      </span>
                    </td>
                    <td className="py-2 tabular-nums">{fmt(s.expected_invites)}</td>
                    <td className="py-2 tabular-nums">
                      {fmt(s.connections)}
                      {s.invites > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {Math.round((s.connections / s.invites) * 100)}%
                        </span>
                      )}
                    </td>
                    <td className="py-2 tabular-nums">{fmt(s.replies)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
