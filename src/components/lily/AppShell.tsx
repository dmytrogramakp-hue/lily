import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCampaigns, unwrap } from "@/lib/api";
import {
  LayoutGrid,
  Workflow,
  UserPlus,
  MessagesSquare,
  BarChart3,
  Upload,
  AlertTriangle,
  Loader2,
} from "lucide-react";

const nav = [
  { to: "/", label: "Campaigns", icon: LayoutGrid },
  { to: "/leads", label: "Upload leads", icon: Upload },
  { to: "/sequences", label: "Sequence", icon: Workflow },
  { to: "/invites", label: "Invites", icon: UserPlus },
  { to: "/inbox", label: "Inbox", icon: MessagesSquare },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const summary = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => unwrap(getCampaigns()),
    staleTime: 60_000,
  });
  const limit = summary.data?.settings.daily_invite_limit;
  const sent = summary.data?.today.invites_sent ?? 0;
  const weekends = summary.data?.settings.send_weekends;
  const activeCount = (summary.data?.campaigns ?? []).filter((c) => c.status === "active").length;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-gradient-ink text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground font-extrabold shadow-elegant">
            L
          </div>
          <div>
            <div className="text-sm font-bold text-sidebar-accent-foreground">Lily</div>
            <div className="text-[11px] text-sidebar-foreground/70">NewsCatcher LI Agent</div>
          </div>
        </div>
        <div className="px-3">
          <Link
            to="/leads"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-sidebar-primary px-3 py-2.5 text-sm font-semibold text-sidebar-primary-foreground transition hover:brightness-110"
          >
            <Upload className="h-4 w-4" /> Upload a list
          </Link>
        </div>
        <nav className="mt-6 flex flex-1 flex-col gap-1 px-3">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground"
            >
              <n.icon className="h-4 w-4" />
              <span className="flex-1">{n.label}</span>
            </Link>
          ))}
        </nav>
        <Link
          to="/"
          className="m-3 block rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3 transition hover:bg-sidebar-accent"
        >
          <div className="flex items-center justify-between text-xs">
            <span>Invites today</span>
            <span className="font-semibold text-sidebar-accent-foreground">
              {limit === undefined ? "–" : `${sent} / ${limit}`}
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-sidebar-border">
            <div
              className="h-full rounded-full bg-sidebar-ring"
              style={{ width: `${limit ? Math.min(100, (sent / limit) * 100) : 0}%` }}
            />
          </div>
          <div className="mt-2 text-[11px] text-sidebar-foreground/70">
            {limit === undefined
              ? "Loading sending status"
              : activeCount === 0
                ? "No active campaign, nothing is sending"
                : `${activeCount} active campaign${activeCount > 1 ? "s" : ""} · 9:00 to 17:00${weekends ? ", every day" : ", weekdays"}`}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full bg-success" /> Dima Grama · LinkedIn via Unipile
          </div>
        </Link>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-4 border-b bg-card/80 px-8 py-3 backdrop-blur">
          <div className="text-sm text-muted-foreground">NewsCatcher LinkedIn outreach</div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-semibold text-ink">Dima Grama</div>
              <div className="text-[11px] text-muted-foreground">Account Executive</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">
              DG
            </div>
          </div>
        </header>
        <div className="flex items-end justify-between gap-4 px-8 pb-6 pt-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
        <div className="flex-1 px-8 pb-10">{children}</div>
      </main>
    </div>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl border bg-card shadow-card ${className}`}>{children}</div>;
}

export function Btn({
  variant = "primary",
  children,
  onClick,
  className = "",
  disabled = false,
  type = "button",
}: {
  variant?: "primary" | "ghost" | "outline" | "danger" | "success";
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const v = {
    primary: "bg-primary text-primary-foreground hover:brightness-110 shadow-elegant",
    outline: "border bg-card text-foreground hover:bg-muted",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
    danger:
      "bg-destructive-soft text-destructive hover:bg-destructive hover:text-destructive-foreground",
    success: "bg-success-soft text-success hover:bg-success hover:text-primary-foreground",
  }[variant];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`}
    >
      {children}
    </button>
  );
}

export function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function Avatar({
  initials,
  src,
  size = "md",
}: {
  initials: string;
  src?: string | null | undefined;
  size?: "sm" | "md" | "lg";
}) {
  const s = { sm: "h-8 w-8 text-[11px]", md: "h-10 w-10 text-xs", lg: "h-14 w-14 text-base" }[size];
  if (src)
    return (
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        className={`shrink-0 rounded-full object-cover ${s}`}
      />
    );
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full bg-primary-soft font-bold text-primary ${s}`}
    >
      {initials}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-success-soft text-success",
    paused: "bg-warning-soft text-warning",
    draft: "bg-muted text-muted-foreground",
    completed: "bg-primary-soft text-primary",
    archived: "bg-muted text-muted-foreground",
    legacy: "bg-muted text-muted-foreground",
    Interested: "bg-success-soft text-success",
    Objection: "bg-warning-soft text-warning",
    Meeting: "bg-primary-soft text-primary",
    Later: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${map[status] ?? "bg-muted"}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function ErrorBanner({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error ?? "Something went wrong.");
  return (
    <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="font-semibold text-ink">{title}</div>
      {children && (
        <div className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{children}</div>
      )}
    </div>
  );
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
