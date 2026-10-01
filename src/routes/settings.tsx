import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CheckCircle2, Loader2, PlugZap, XCircle } from "lucide-react";
import { AppShell, Btn, Card, ErrorBanner, Loading } from "@/components/lily/AppShell";
import { TeamCard } from "@/components/lily/TeamCard";
import { getCampaigns, setSendingSettings, testClaude, unwrap } from "@/lib/api";
import type { AiModel } from "@/lib/types";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · Lily" }] }),
  component: Settings,
});

const MODELS: { id: AiModel; label: string; detail: string }[] = [
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    detail: "Recommended. Fast, strong writing, lower cost per message.",
  },
  {
    id: "claude-opus-5",
    label: "Claude Opus 5",
    detail: "Highest quality reasoning about each profile. Slower and pricier.",
  },
];

function Settings() {
  const qc = useQueryClient();
  const summary = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => unwrap(getCampaigns()),
    staleTime: 60_000,
  });
  const saved = summary.data?.settings;
  const [model, setModel] = useState<AiModel>("claude-sonnet-5");
  const [context, setContext] = useState("");
  const [offer, setOffer] = useState("");
  const [script, setScript] = useState("");
  // Unipile sends people back here after the LinkedIn connect wizard.
  const [linkResult, setLinkResult] = useState<"connected" | "failed" | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("linkedin");
    if (r === "connected" || r === "failed") {
      setLinkResult(r);
      window.history.replaceState(null, "", window.location.pathname);
      if (r === "connected") {
        // The account is attached by Unipile's callback, usually within seconds.
        const t = [3000, 8000, 15000].map((ms) =>
          setTimeout(() => qc.invalidateQueries({ queryKey: ["campaigns"] }), ms),
        );
        return () => t.forEach(clearTimeout);
      }
    }
    return undefined;
  }, [qc]);

  useEffect(() => {
    if (!saved) return;
    setModel(saved.ai_model);
    setContext(saved.company_context);
    setOffer(saved.offer);
    setScript(saved.first_message_script ?? "");
  }, [saved?.ai_model, saved?.company_context, saved?.offer, saved?.first_message_script]); // eslint-disable-line react-hooks/exhaustive-deps

  const test = useMutation({ mutationFn: () => unwrap(testClaude()) });
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        setSendingSettings({
          data: {
            ai_model: model,
            company_context: context.trim(),
            offer: offer.trim(),
            first_message_script: script.trim(),
          },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const dirty =
    !!saved &&
    (saved.ai_model !== model ||
      saved.company_context !== context.trim() ||
      saved.offer !== offer.trim() ||
      (saved.first_message_script ?? "") !== script.trim());
  const scriptMissingName = script.trim().length > 0 && !script.includes("{first_name}");

  return (
    <AppShell
      title="Settings"
      subtitle="Your team, how Lily connects to Claude, and what it says about NewsCatcher."
    >
      {linkResult === "connected" && (
        <div className="mb-4 rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">
          LinkedIn connected. It shows up on the team list within a few seconds. You can close this
          tab if you opened it from a link.
        </div>
      )}
      {linkResult === "failed" && (
        <div className="mb-4">
          <ErrorBanner error="LinkedIn sign-in did not finish. Create a new connect link and try again." />
        </div>
      )}
      {summary.error && <ErrorBanner error={summary.error} />}
      {summary.isPending ? (
        <Card>
          <Loading />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <TeamCard campaigns={summary.data?.campaigns ?? []} />
            <Card className="p-6">
              <div className="flex items-center gap-2 font-semibold text-ink">
                <Bot className="h-4 w-4 text-primary" /> What NewsCatcher does
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Claude reads this before every message it writes or drafts. Keep it factual: what
                you sell, who it is for, the use cases and the events you catch. Claude will not
                claim anything that is not here or on the lead's profile.
              </p>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={16}
                maxLength={4000}
                className="mt-4 w-full rounded-lg border px-3 py-2 text-sm leading-relaxed"
              />
              <div className="mt-1 text-right text-[11px] text-muted-foreground">
                {context.length}/4000
              </div>
            </Card>

            <Card className="p-6">
              <div className="font-semibold text-ink">First message</div>
              <p className="mt-1 text-sm text-muted-foreground">
                AI-written message 1 follows this script word for word. Claude only puts in the
                person's first name and may add a few words about their role. Keep {"{first_name}"}{" "}
                where the name goes. Follow-ups 2 and 3 are written fresh, each with a different
                piece of value.
              </p>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={4}
                maxLength={600}
                className="mt-4 w-full rounded-lg border px-3 py-2 text-sm leading-relaxed"
              />
              <div className="mt-1 flex justify-between text-[11px]">
                <span className="text-destructive">
                  {scriptMissingName ? "Add {first_name} where the person's name goes." : ""}
                </span>
                <span className="text-muted-foreground">{script.length}/600</span>
              </div>
            </Card>

            <Card className="p-6">
              <div className="font-semibold text-ink">Current offer</div>
              <p className="mt-1 text-sm text-muted-foreground">
                The deal you are running right now. Follow-up messages draw on it when they offer
                the trial link. Connection notes never mention it. Update this when the offer
                changes.
              </p>
              <textarea
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                rows={5}
                maxLength={1500}
                className="mt-4 w-full rounded-lg border px-3 py-2 text-sm leading-relaxed"
              />
              <div className="mt-1 text-right text-[11px] text-muted-foreground">
                {offer.length}/1500
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-2 font-semibold text-ink">
                <PlugZap className="h-4 w-4 text-primary" /> Claude connection
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Lily uses Claude through the Anthropic connection in your n8n workspace, so no API
                key is stored in this app.
              </p>
              <Btn
                variant="outline"
                className="mt-4 w-full justify-center"
                onClick={() => test.mutate()}
                disabled={test.isPending}
              >
                {test.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlugZap className="h-4 w-4" />
                )}{" "}
                Test connection
              </Btn>
              {test.data && (
                <div
                  className={`mt-3 flex items-center gap-2 text-sm ${test.data.ok ? "text-success" : "text-destructive"}`}
                >
                  {test.data.ok ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {test.data.ok
                    ? `Connected, ${test.data.model} replied.`
                    : "Claude did not answer as expected."}
                </div>
              )}
              {test.error && (
                <div className="mt-3">
                  <ErrorBanner error={test.error} />
                </div>
              )}
            </Card>

            <Card className="p-6">
              <div className="font-semibold text-ink">Model</div>
              <div className="mt-3 space-y-2">
                {MODELS.map((m) => (
                  <label
                    key={m.id}
                    className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${model === m.id ? "border-primary bg-primary-soft" : "hover:border-primary/50"}`}
                  >
                    <input
                      type="radio"
                      name="model"
                      checked={model === m.id}
                      onChange={() => setModel(m.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-ink">{m.label}</span>
                      <span className="block text-xs text-muted-foreground">{m.detail}</span>
                    </span>
                  </label>
                ))}
              </div>
            </Card>

            <Btn
              className="w-full justify-center"
              onClick={() => save.mutate()}
              disabled={!dirty || save.isPending || !context.trim() || scriptMissingName}
            >
              {save.isPending ? "Saving" : save.isSuccess && !dirty ? "Saved" : "Save AI settings"}
            </Btn>
            {save.error && <ErrorBanner error={save.error} />}
          </div>
        </div>
      )}
    </AppShell>
  );
}
