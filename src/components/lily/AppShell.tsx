import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LayoutGrid, Workflow, UserPlus, MessagesSquare, BarChart3, Users, Settings, Search, Bell, Plus } from "lucide-react";

const nav = [
  { to: "/", label: "Campaigns", icon: LayoutGrid },
  { to: "/sequences", label: "Sequence builder", icon: Workflow },
  { to: "/invites", label: "Invites", icon: UserPlus, badge: 5 },
  { to: "/inbox", label: "Inbox", icon: MessagesSquare, badge: 2 },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

export function AppShell({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-gradient-ink text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground font-extrabold shadow-elegant">L</div>
          <div>
            <div className="text-sm font-bold text-sidebar-accent-foreground">Lily</div>
            <div className="text-[11px] text-sidebar-foreground/70">NewsCatcher LI Agent</div>
          </div>
        </div>
        <div className="px-3">
          <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-sidebar-primary px-3 py-2.5 text-sm font-semibold text-sidebar-primary-foreground transition hover:brightness-110">
            <Plus className="h-4 w-4" /> New campaign
          </button>
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
              {"badge" in n && <span className="rounded-full bg-sidebar-primary px-1.5 text-[11px] font-semibold text-sidebar-primary-foreground">{n.badge}</span>}
            </Link>
          ))}
          <div className="mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">Workspace</div>
          <a className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-sidebar-accent"><Users className="h-4 w-4" /> Team & accounts</a>
          <a className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-sidebar-accent"><Settings className="h-4 w-4" /> Settings</a>
        </nav>
        <div className="m-3 rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span>Daily invite limit</span><span className="font-semibold text-sidebar-accent-foreground">62 / 100</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-sidebar-border"><div className="h-full w-[62%] rounded-full bg-sidebar-ring" /></div>
          <div className="mt-3 flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full bg-success" /> LinkedIn connected · Unipile</div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-4 border-b bg-card/80 px-8 py-3 backdrop-blur">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input placeholder="Search leads, campaigns, messages…" className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <select className="rounded-lg border bg-card px-3 py-2 text-sm font-medium">
              <option>Maya Chen (you)</option><option>Diego Ruiz</option><option>Priya Nair</option><option>All team</option>
            </select>
            <button className="relative grid h-9 w-9 place-items-center rounded-lg border bg-card"><Bell className="h-4 w-4" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-destructive" /></button>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">MC</div>
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

export function Btn({ variant = "primary", children, onClick, className = "" }: { variant?: "primary" | "ghost" | "outline" | "danger" | "success"; children: ReactNode; onClick?: () => void; className?: string }) {
  const v = {
    primary: "bg-primary text-primary-foreground hover:brightness-110 shadow-elegant",
    outline: "border bg-card text-foreground hover:bg-muted",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
    danger: "bg-destructive-soft text-destructive hover:bg-destructive hover:text-destructive-foreground",
    success: "bg-success-soft text-success hover:bg-success hover:text-primary-foreground",
  }[variant];
  return <button onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${v} ${className}`}>{children}</button>;
}

export function Avatar({ initials, size = "md" }: { initials: string; size?: "sm" | "md" | "lg" }) {
  const s = { sm: "h-8 w-8 text-[11px]", md: "h-10 w-10 text-xs", lg: "h-14 w-14 text-base" }[size];
  return <div className={`grid shrink-0 place-items-center rounded-full bg-primary-soft font-bold text-primary ${s}`}>{initials}</div>;
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-success-soft text-success",
    paused: "bg-warning-soft text-warning",
    draft: "bg-muted text-muted-foreground",
    completed: "bg-primary-soft text-primary",
    Interested: "bg-success-soft text-success",
    Objection: "bg-warning-soft text-warning",
    Meeting: "bg-primary-soft text-primary",
    Later: "bg-muted text-muted-foreground",
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${map[status] ?? "bg-muted"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>;
}
