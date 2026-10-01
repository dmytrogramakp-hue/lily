import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, UserPlus, MessageSquare, Clock, GitBranch, ThumbsUp, Award, UserRoundPlus, Plus, Save, Rocket, Trash2 } from "lucide-react";
import { AppShell, Card, Btn } from "@/components/lily/AppShell";
import { sequence as initial, type Step, type StepType } from "@/lib/mock";

export const Route = createFileRoute("/sequences")({
  head: () => ({
    meta: [
      { title: "Sequence builder — Lily" },
      { name: "description", content: "Build LinkedIn outreach sequences: invites, messages, delays and conditions." },
      { property: "og:title", content: "Sequence builder — Lily" },
      { property: "og:description", content: "Build LinkedIn outreach sequences: invites, messages, delays and conditions." },
    ],
  }),
  component: Sequences,
});

const meta: Record<StepType, { icon: typeof Eye; label: string; tone: string }> = {
  view: { icon: Eye, label: "View profile", tone: "bg-primary-soft text-primary" },
  follow: { icon: UserRoundPlus, label: "Follow", tone: "bg-primary-soft text-primary" },
  like: { icon: ThumbsUp, label: "Like post", tone: "bg-primary-soft text-primary" },
  endorse: { icon: Award, label: "Endorse skill", tone: "bg-primary-soft text-primary" },
  invite: { icon: UserPlus, label: "Connection invite", tone: "bg-primary text-primary-foreground" },
  message: { icon: MessageSquare, label: "Message", tone: "bg-ink text-ink-foreground" },
  delay: { icon: Clock, label: "Delay", tone: "bg-muted text-muted-foreground" },
  condition: { icon: GitBranch, label: "Condition", tone: "bg-warning-soft text-warning" },
};

function Sequences() {
  const [steps, setSteps] = useState<Step[]>(initial);
  const [selected, setSelected] = useState<string>("s4");
  const sel = steps.find((s) => s.id === selected);
  const main = steps.filter((s) => !s.branch);
  const yes = steps.filter((s) => s.branch === "yes");
  const no = steps.filter((s) => s.branch === "no");

  const add = (type: StepType) => {
    const id = `n${Date.now()}`;
    setSteps((s) => [...s, { id, type, title: meta[type].label, detail: "Configure this step", branch: "yes" }]);
    setSelected(id);
  };
  const update = (patch: Partial<Step>) => setSteps((s) => s.map((x) => (x.id === selected ? { ...x, ...patch } : x)));

  const Node = ({ s }: { s: Step }) => {
    const m = meta[s.type];
    return (
      <button onClick={() => setSelected(s.id)} className={`w-72 rounded-xl border bg-card p-3 text-left shadow-card transition hover:-translate-y-0.5 ${selected === s.id ? "ring-2 ring-primary" : ""}`}>
        <div className="flex items-center gap-3">
          <div className={`grid h-9 w-9 place-items-center rounded-lg ${m.tone}`}><m.icon className="h-4 w-4" /></div>
          <div className="min-w-0"><div className="text-sm font-semibold text-ink">{s.title}</div><div className="truncate text-xs text-muted-foreground">{s.detail}</div></div>
        </div>
      </button>
    );
  };
  const Line = () => <div className="mx-auto h-6 w-px bg-border" />;

  return (
    <AppShell title="Sequence builder" subtitle="Fintech Heads of Data — EU" actions={<><Btn variant="outline"><Save className="h-4 w-4" /> Save draft</Btn><Btn><Rocket className="h-4 w-4" /> Launch</Btn></>}>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr_320px]">
        <Card className="h-fit p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add step</div>
          <div className="flex flex-col gap-1.5">
            {(Object.keys(meta) as StepType[]).map((t) => {
              const m = meta[t];
              return (
                <button key={t} onClick={() => add(t)} className="flex items-center gap-2.5 rounded-lg border border-dashed px-2.5 py-2 text-sm font-medium hover:border-primary hover:bg-primary-soft">
                  <span className={`grid h-7 w-7 place-items-center rounded-md ${m.tone}`}><m.icon className="h-3.5 w-3.5" /></span>{m.label}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="bg-dots overflow-x-auto p-8">
          <div className="flex flex-col items-center">
            <div className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-ink-foreground">Start · 842 leads</div>
            {main.map((s) => (<div key={s.id} className="flex flex-col items-center"><Line /><Node s={s} /></div>))}
            <Line />
            <div className="grid grid-cols-2 gap-10">
              {[{ label: "Yes", list: yes, tone: "bg-success-soft text-success" }, { label: "No", list: no, tone: "bg-destructive-soft text-destructive" }].map((b) => (
                <div key={b.label} className="flex flex-col items-center">
                  <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${b.tone}`}>{b.label}</span>
                  {b.list.map((s) => (<div key={s.id} className="flex flex-col items-center"><Line /><Node s={s} /></div>))}
                  <Line />
                  <button onClick={() => add("message")} className="grid h-8 w-8 place-items-center rounded-full border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary"><Plus className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="h-fit p-5">
          {sel ? (
            <>
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{meta[sel.type].label}</div>
                <button onClick={() => setSteps((s) => s.filter((x) => x.id !== sel.id))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
              <label className="mt-4 block text-xs font-semibold">Step name</label>
              <input value={sel.title} onChange={(e) => update({ title: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
              <label className="mt-4 block text-xs font-semibold">{sel.type === "message" || sel.type === "invite" ? "Message" : "Settings"}</label>
              <textarea value={sel.detail} onChange={(e) => update({ detail: e.target.value })} rows={6} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
              {(sel.type === "message" || sel.type === "invite") && (
                <>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {["{{first_name}}", "{{company}}", "{{title}}", "{{recent_news}}"].map((v) => (
                      <button key={v} onClick={() => update({ detail: sel.detail + " " + v })} className="rounded-md bg-primary-soft px-2 py-0.5 font-mono text-[11px] text-primary">{v}</button>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl bg-primary-soft p-3 text-xs text-accent-foreground"><b>Lily AI:</b> Personalise with the lead's latest company news from NewsCatcher. <button className="font-semibold underline">Generate</button></div>
                  {sel.type === "invite" && <div className="mt-2 text-right text-[11px] text-muted-foreground">{sel.detail.length}/300</div>}
                </>
              )}
              {sel.type === "delay" && (
                <div className="mt-4 flex gap-2"><input defaultValue={1} type="number" className="w-20 rounded-lg border px-3 py-2 text-sm" /><select className="flex-1 rounded-lg border px-3 py-2 text-sm"><option>days</option><option>hours</option></select></div>
              )}
            </>
          ) : <div className="text-sm text-muted-foreground">Select a step to edit it.</div>}
        </Card>
      </div>
    </AppShell>
  );
}
