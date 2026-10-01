import { createFileRoute } from "@tanstack/react-router";
import {
  Clock,
  MessageSquare,
  Sparkles,
  StopCircle,
  Upload,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { AppShell, Card } from "@/components/lily/AppShell";

export const Route = createFileRoute("/sequences")({
  head: () => ({
    meta: [
      { title: "Sequence · Lily" },
      { name: "description", content: "How Lily works a lead from upload to reply." },
    ],
  }),
  component: Sequence,
});

type Step = { icon: LucideIcon; tone: string; title: string; when: string; detail: string };

const steps: Step[] = [
  {
    icon: Upload,
    tone: "bg-muted text-muted-foreground",
    title: "Lead uploaded",
    when: "You",
    detail:
      "CSV goes into the invite queue under a campaign. Duplicates of anyone already in the queue are skipped.",
  },
  {
    icon: UserPlus,
    tone: "bg-primary text-primary-foreground",
    title: "Connection invite",
    when: "Your daily limit, spread hourly from 9:00 to 17:00 Madrid time",
    detail:
      "Only leads in active campaigns. No note, so the invite looks like a normal request. Profiles LinkedIn will not resolve are skipped and marked, so the queue never stalls.",
  },
  {
    icon: Clock,
    tone: "bg-muted text-muted-foreground",
    title: "Wait for acceptance",
    when: "Up to 14 days",
    detail:
      "Lily checks your new connections every morning and only messages people you invited through a campaign.",
  },
  {
    icon: MessageSquare,
    tone: "bg-ink text-ink-foreground",
    title: "Message 1",
    when: "Daily at 9:00, after they accept",
    detail:
      "Claude reads their title, company and headline, picks the closest vertical, and writes a short note on what NewsCatcher normally finds for teams like theirs. Ends with one small question.",
  },
  {
    icon: Clock,
    tone: "bg-muted text-muted-foreground",
    title: "Wait 3 days",
    when: "Skipped if they reply",
    detail: "If they write back, the sequence stops and the conversation is yours in the inbox.",
  },
  {
    icon: MessageSquare,
    tone: "bg-ink text-ink-foreground",
    title: "Message 2",
    when: "Daily at 9:30",
    detail:
      "A shorter follow-up with a different angle and your calendar link. Nothing after this.",
  },
  {
    icon: StopCircle,
    tone: "bg-success-soft text-success",
    title: "Done",
    when: "",
    detail:
      "Replies are flagged in the inbox. No further automated messages are sent to this person.",
  },
];

const verticals = [
  "Supply chain and procurement",
  "Fintech and financial regulation",
  "KYC, AML and financial crime",
  "Insurance",
  "PR and communications",
  "ESG and sustainability",
  "Cybersecurity and third-party risk",
  "Investment and market intelligence",
  "Data, AI and product teams",
  "General",
];

function Sequence() {
  return (
    <AppShell
      title="Sequence"
      subtitle="What happens to every lead, in order. The same sequence runs for all campaigns."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="bg-dots p-8">
          <div className="mx-auto flex max-w-xl flex-col">
            {steps.map((s, i) => (
              <div key={s.title} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${s.tone}`}
                  >
                    <s.icon className="h-4 w-4" />
                  </div>
                  {i < steps.length - 1 && <div className="w-px flex-1 bg-border" />}
                </div>
                <div className="pb-6">
                  <div className="rounded-xl border bg-card p-4 shadow-card">
                    <div className="font-semibold text-ink">{s.title}</div>
                    {s.when && (
                      <div className="mt-0.5 text-xs font-medium text-primary">{s.when}</div>
                    )}
                    <div className="mt-2 text-sm text-muted-foreground">{s.detail}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Sparkles className="h-4 w-4 text-primary" /> How messages are written
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              No templates. Each message is written for the person, then checked before sending: no
              dashes, no exclamation marks, under the length limit, starts with their first name.
              Anything that fails is held back and emailed to you.
            </p>
          </Card>
          <Card className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Verticals Lily picks from
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {verticals.map((v) => (
                <li key={v} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {v}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
