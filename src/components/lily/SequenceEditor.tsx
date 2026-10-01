import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  Clock,
  Info,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UserPlus,
  Wand2,
} from "lucide-react";
import { Btn, Card, ErrorBanner } from "@/components/lily/AppShell";
import { draftTemplate, generateForLead, unwrap, updateCampaign } from "@/lib/api";
import { PRESETS } from "@/lib/sequence";
import type {
  CampaignLead,
  GeneratedText,
  MessageStep,
  Sequence,
  SequencePreset,
} from "@/lib/types";

const NOTE_VARS = ["{{first_name}}", "{{last_name}}", "{{company}}", "{{title}}"];
const MESSAGE_VARS = [...NOTE_VARS, "{{calendar_link}}"];
const MAX_MESSAGES = 3;
const CALENDAR = "https://savvycal.com/dimagrama/08f252b4";

function presetFor(steps: Sequence["steps"]): SequencePreset {
  const messages = steps.length - 1;
  if (messages === 0) return "invite_only";
  if (messages === 1 && steps[1]?.wait_days === 0) return "invite_message";
  if (messages === 2 && steps[1]?.wait_days === 0) return "invite_two_messages";
  return "custom";
}

function fill(text: string, lead: CampaignLead | undefined) {
  return text
    .replace(/\{\{\s*first_name\s*\}\}/g, lead?.first_name || "Jane")
    .replace(/\{\{\s*last_name\s*\}\}/g, lead?.last_name || "Doe")
    .replace(/\{\{\s*company\s*\}\}/g, lead?.company || "Acme")
    .replace(/\{\{\s*title\s*\}\}/g, lead?.title || "Head of Risk")
    .replace(/\{\{\s*calendar_link\s*\}\}/g, CALENDAR);
}

function VarChips({
  vars,
  onInsert,
  disabled,
}: {
  vars: string[];
  onInsert: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {vars.map((v) => (
        <button
          key={v}
          type="button"
          disabled={disabled}
          onClick={() => onInsert(v)}
          className="rounded-md bg-primary-soft px-2 py-0.5 font-mono text-[11px] text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function Issues({ issues }: { issues: string[] }) {
  if (!issues.length) return null;
  return (
    <div className="mt-2 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      Check before using: {issues.join(", ")}.
    </div>
  );
}

function AiPreview({ result }: { result: GeneratedText }) {
  const a = result.analysis;
  return (
    <div className="mt-3 space-y-3">
      {result.profile && (
        <div className="text-xs text-muted-foreground">
          Read {result.profile.name}'s profile
          {result.profile.current_role ? `, ${result.profile.current_role}` : ""}
          {result.profile.posts
            ? `, and ${result.profile.posts} recent post${result.profile.posts > 1 ? "s" : ""}`
            : ""}
          .
        </div>
      )}
      {a && (
        <div className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-xs sm:grid-cols-2">
          {[
            ["Role", a.role],
            ["Company", a.company],
            ["Working on", a.current_focus],
            ["Best fit", a.best_use_case],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <div className="font-semibold uppercase tracking-wider text-muted-foreground">
                  {k}
                </div>
                <div className="mt-0.5 text-foreground">{v}</div>
              </div>
            ))}
          {a.angle && (
            <div className="sm:col-span-2">
              <div className="font-semibold uppercase tracking-wider text-muted-foreground">
                Angle
              </div>
              <div className="mt-0.5 text-foreground">{a.angle}</div>
            </div>
          )}
        </div>
      )}
      <div className="whitespace-pre-wrap rounded-lg border bg-card px-3 py-2 text-sm shadow-card">
        {result.text}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{result.text.length} characters</span>
        <span>{result.model}</span>
      </div>
      <Issues issues={result.issues} />
    </div>
  );
}

export function SequenceEditor({
  campaign,
  initial,
  leads,
  locked,
}: {
  campaign: string;
  initial: Sequence | null;
  leads: CampaignLead[];
  locked?: string | null;
}) {
  const qc = useQueryClient();
  const [seq, setSeq] = useState<Sequence>(initial ?? PRESETS[0]!.build());
  const [noteOn, setNoteOn] = useState<boolean>(!!initial?.steps[0].note);
  const named = useMemo(() => leads.filter((l) => l.first_name).slice(0, 200), [leads]);
  const [leadUrl, setLeadUrl] = useState<string>("");
  const lead = named.find((l) => l.linkedin_url === leadUrl) ?? named[0];
  const [previews, setPreviews] = useState<Record<number, GeneratedText>>({});
  const [draftIssues, setDraftIssues] = useState<Record<number, string[]>>({});

  useEffect(() => {
    if (initial) {
      setSeq(initial);
      setNoteOn(!!initial.steps[0].note);
    }
  }, [JSON.stringify(initial)]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: (s: Sequence) => unwrap(updateCampaign({ data: { name: campaign, sequence: s } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const preview = useMutation({
    mutationFn: (v: { stepIndex: number }) => {
      const m = seq.steps[v.stepIndex] as MessageStep;
      const prevStep = v.stepIndex > 1 ? (seq.steps[v.stepIndex - 1] as MessageStep) : null;
      const previous = prevStep
        ? prevStep.mode === "template"
          ? fill(prevStep.text, lead)
          : previews[v.stepIndex - 1]?.text
        : undefined;
      return unwrap(
        generateForLead({
          data: {
            lead_url: lead!.linkedin_url,
            kind: "message",
            step: { index: v.stepIndex, wait_days: m.wait_days, instructions: m.text },
            ...(previous ? { previous_message: previous } : {}),
          },
        }),
      );
    },
    onSuccess: (r, v) => setPreviews((p) => ({ ...p, [v.stepIndex]: r })),
  });

  const draft = useMutation({
    mutationFn: (v: { stepIndex: number }) => {
      const isNote = v.stepIndex === 0;
      const m = isNote ? null : (seq.steps[v.stepIndex] as MessageStep);
      const prevStep = v.stepIndex > 1 ? (seq.steps[v.stepIndex - 1] as MessageStep) : null;
      return unwrap(
        draftTemplate({
          data: {
            kind: isNote ? "invite_note" : "message",
            step: { index: Math.max(1, v.stepIndex), wait_days: m?.wait_days ?? 0 },
            audience: leads
              .slice(0, 20)
              .map((l) => ({ title: l.title.slice(0, 200), company: l.company.slice(0, 200) })),
            ...(prevStep?.mode === "template" && prevStep.text
              ? { previous_message: prevStep.text }
              : {}),
          },
        }),
      );
    },
    onSuccess: (r, v) => {
      setDraftIssues((d) => ({ ...d, [v.stepIndex]: r.issues }));
      if (v.stepIndex === 0) setInviteNote(r.text.slice(0, 300));
      else setMessage(v.stepIndex - 1, { text: r.text });
    },
  });

  const normalized = useMemo<Sequence>(() => {
    const [invite, ...messages] = seq.steps;
    const steps: Sequence["steps"] = [
      { type: "invite", note: noteOn ? invite.note : "" },
      ...messages,
    ];
    return { version: 1, preset: presetFor(steps), steps };
  }, [seq, noteOn]);

  const dirty = JSON.stringify(normalized) !== JSON.stringify(initial ?? null);
  const messages = normalized.steps.slice(1) as MessageStep[];
  const invalidTemplate = messages.some((m) => m.mode === "template" && !m.text.trim());
  const noteTooLong = normalized.steps[0].note.length > 300;
  const noteEmptyButOn = noteOn && !seq.steps[0].note.trim();

  function setInviteNote(note: string) {
    setSeq((s) => ({
      ...s,
      steps: [{ type: "invite", note }, ...s.steps.slice(1)] as Sequence["steps"],
    }));
  }
  function setMessage(i: number, patch: Partial<MessageStep>) {
    setSeq((s) => {
      const steps = [...s.steps] as Sequence["steps"];
      steps[i + 1] = { ...(steps[i + 1] as MessageStep), ...patch };
      return { ...s, steps };
    });
  }
  const addMessage = () =>
    setSeq((s) =>
      s.steps.length - 1 >= MAX_MESSAGES
        ? s
        : {
            ...s,
            steps: [
              ...s.steps,
              { type: "message", wait_days: s.steps.length === 1 ? 0 : 3, mode: "ai", text: "" },
            ] as Sequence["steps"],
          },
    );
  const removeMessage = (i: number) => {
    setSeq((s) => ({
      ...s,
      steps: s.steps.filter((_, idx) => idx !== i + 1) as Sequence["steps"],
    }));
    setPreviews({});
  };
  const applyPreset = (id: (typeof PRESETS)[number]["id"]) => {
    const p = PRESETS.find((x) => x.id === id)!.build();
    p.steps[0] = { type: "invite", note: seq.steps[0].note };
    setSeq(p);
    setPreviews({});
  };
  const runDraft = (stepIndex: number, current: string) => {
    if (current.trim() && !window.confirm("Replace the current text with a new AI draft?")) return;
    draft.mutate({ stepIndex });
  };

  const disabled = !!locked;
  const busyPreview = (i: number) => preview.isPending && preview.variables?.stepIndex === i;
  const busyDraft = (i: number) => draft.isPending && draft.variables?.stepIndex === i;

  return (
    <div className="space-y-6">
      {locked && (
        <div className="flex items-start gap-2 rounded-xl border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" /> {locked}
        </div>
      )}

      <div>
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Start from a preset
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {PRESETS.map((p) => {
            const selected = normalized.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={disabled}
                onClick={() => applyPreset(p.id)}
                className={`rounded-2xl border bg-card p-4 text-left shadow-card transition disabled:opacity-60 ${selected ? "ring-2 ring-primary" : "hover:border-primary/50"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">{p.label}</span>
                  {selected && <Check className="h-4 w-4 text-primary" />}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{p.description}</div>
              </button>
            );
          })}
        </div>
        {normalized.preset === "custom" && (
          <div className="mt-2 text-xs text-muted-foreground">Custom sequence</div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
                <UserPlus className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-ink">Connection request</div>
                <div className="text-xs text-muted-foreground">
                  Sent at your daily limit while the campaign is active
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={noteOn}
                  disabled={disabled}
                  onChange={(e) => setNoteOn(e.target.checked)}
                />
                Add a note
              </label>
            </div>
            {noteOn && (
              <div className="mt-4">
                <div className="mb-2 flex justify-end">
                  <Btn
                    variant="outline"
                    disabled={disabled || draft.isPending}
                    onClick={() => runDraft(0, seq.steps[0].note)}
                  >
                    {busyDraft(0) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}{" "}
                    Draft with AI
                  </Btn>
                </div>
                <textarea
                  value={seq.steps[0].note}
                  disabled={disabled}
                  onChange={(e) => setInviteNote(e.target.value)}
                  rows={4}
                  maxLength={300}
                  placeholder="Hi {{first_name}}, I work with teams at companies like {{company}} on news data for AI agents and risk monitoring. Would be good to connect."
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
                <div className="flex items-start justify-between">
                  <VarChips
                    vars={NOTE_VARS}
                    disabled={disabled}
                    onInsert={(v) =>
                      setInviteNote(
                        `${seq.steps[0].note}${seq.steps[0].note.endsWith(" ") || !seq.steps[0].note ? "" : " "}${v}`,
                      )
                    }
                  />
                  <span
                    className={`mt-2 text-[11px] ${noteTooLong ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {seq.steps[0].note.length}/300
                  </span>
                </div>
                <Issues issues={draftIssues[0] ?? []} />
                {seq.steps[0].note.trim() && (
                  <div className="mt-3 whitespace-pre-wrap rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Preview for{" "}
                      {lead ? `${lead.first_name} ${lead.last_name}`.trim() : "a sample lead"}
                    </div>
                    {fill(seq.steps[0].note, lead)}
                  </div>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Placeholders are filled from each person's LinkedIn profile when the invite is
                  sent, with your CSV as the fallback. If a value is missing, the invite goes
                  without a note.
                </p>
              </div>
            )}
          </Card>

          {messages.map((m, i) => {
            const stepIndex = i + 1;
            return (
              <div key={i}>
                <div className="flex items-center gap-2 py-2 pl-[30px] text-xs text-muted-foreground">
                  <div className="h-6 w-px bg-border" />
                  <Clock className="h-3.5 w-3.5" />
                  <span>{i === 0 ? "After they accept, wait" : "If no reply, wait"}</span>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={m.wait_days}
                    disabled={disabled}
                    onChange={(e) =>
                      setMessage(i, {
                        wait_days: Math.max(
                          0,
                          Math.min(30, Math.round(Number(e.target.value) || 0)),
                        ),
                      })
                    }
                    className="w-14 rounded-md border px-2 py-0.5 text-center text-xs"
                    aria-label={`Days to wait before message ${stepIndex}`}
                  />
                  <span>day{m.wait_days === 1 ? "" : "s"}</span>
                </div>
                <Card className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-ink text-ink-foreground">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="flex-1 font-semibold text-ink">Message {stepIndex}</div>
                    <div className="inline-flex rounded-lg border p-0.5 text-xs font-semibold">
                      {(["ai", "template"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          disabled={disabled}
                          onClick={() => setMessage(i, { mode })}
                          className={`rounded-md px-2.5 py-1 ${m.mode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                        >
                          {mode === "ai" ? "AI writes each one" : "My template"}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => removeMessage(i)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                      aria-label={`Remove message ${stepIndex}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4">
                    {m.mode === "ai" ? (
                      <>
                        <div className="mb-2 flex items-start gap-2 rounded-lg bg-primary-soft px-3 py-2 text-xs text-accent-foreground">
                          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          For every lead, Claude reads their LinkedIn profile: current role,
                          company, about section, role description and recent posts. It decides
                          which NewsCatcher use case fits, then writes the message in your tone.
                          What NewsCatcher does is set in Settings. Add instructions to steer this
                          step.
                        </div>
                        <textarea
                          value={m.text}
                          disabled={disabled}
                          onChange={(e) => setMessage(i, { text: e.target.value })}
                          rows={3}
                          maxLength={2000}
                          placeholder="Optional instructions for this step. For example: lead with the News MCP for teams building agents."
                          className="w-full rounded-lg border px-3 py-2 text-sm"
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Btn
                            variant="outline"
                            disabled={disabled || !lead || preview.isPending}
                            onClick={() => preview.mutate({ stepIndex })}
                          >
                            {busyPreview(stepIndex) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : previews[stepIndex] ? (
                              <RefreshCw className="h-4 w-4" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                            {previews[stepIndex] ? "Regenerate" : "Generate preview"}
                            {lead ? ` for ${lead.first_name}` : ""}
                          </Btn>
                          {!lead && (
                            <span className="text-xs text-muted-foreground">
                              Add leads with names to preview.
                            </span>
                          )}
                          {busyPreview(stepIndex) && (
                            <span className="text-xs text-muted-foreground">
                              Reading the profile and writing, about 15 seconds
                            </span>
                          )}
                        </div>
                        {previews[stepIndex] && <AiPreview result={previews[stepIndex]} />}
                      </>
                    ) : (
                      <>
                        <div className="mb-2 flex justify-end">
                          <Btn
                            variant="outline"
                            disabled={disabled || draft.isPending}
                            onClick={() => runDraft(stepIndex, m.text)}
                          >
                            {busyDraft(stepIndex) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Wand2 className="h-4 w-4" />
                            )}{" "}
                            Draft with AI
                          </Btn>
                        </div>
                        <textarea
                          value={m.text}
                          disabled={disabled}
                          onChange={(e) => setMessage(i, { text: e.target.value })}
                          rows={7}
                          maxLength={2000}
                          placeholder="Hey {{first_name}}, ..."
                          className="w-full rounded-lg border px-3 py-2 text-sm"
                        />
                        <VarChips
                          vars={MESSAGE_VARS}
                          disabled={disabled}
                          onInsert={(v) =>
                            setMessage(i, {
                              text: `${m.text}${m.text.endsWith(" ") || !m.text ? "" : " "}${v}`,
                            })
                          }
                        />
                        <Issues issues={draftIssues[stepIndex] ?? []} />
                        {m.text.trim() && (
                          <div className="mt-3 whitespace-pre-wrap rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Preview for{" "}
                              {lead
                                ? `${lead.first_name} ${lead.last_name}`.trim()
                                : "a sample lead"}
                            </div>
                            {fill(m.text, lead)}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              </div>
            );
          })}

          {messages.length < MAX_MESSAGES && !disabled && (
            <div className="pt-3">
              <button
                type="button"
                onClick={addMessage}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary"
              >
                <Plus className="h-4 w-4" /> Add{" "}
                {messages.length === 0 ? "a message after they accept" : "a follow-up message"}
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 py-3 pl-[30px] text-xs text-muted-foreground">
            <div className="h-6 w-px bg-border" /> The sequence stops for anyone who replies.
          </div>
          {(preview.error || draft.error) && <ErrorBanner error={preview.error ?? draft.error} />}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Preview with a real lead
            </div>
            {named.length ? (
              <>
                <select
                  value={lead?.linkedin_url ?? ""}
                  onChange={(e) => {
                    setLeadUrl(e.target.value);
                    setPreviews({});
                  }}
                  className="mt-2 w-full rounded-lg border bg-card px-2 py-1.5 text-sm"
                >
                  {named.map((l) => (
                    <option key={l.linkedin_url} value={l.linkedin_url}>
                      {l.first_name} {l.last_name}
                      {l.company ? `, ${l.company}` : ""}
                    </option>
                  ))}
                </select>
                {lead?.title && (
                  <div className="mt-2 text-xs text-muted-foreground">{lead.title}</div>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  AI previews read this person's live profile through your account, which LinkedIn
                  may show as a profile view.
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Add leads to this campaign to preview messages with real people.
              </p>
            )}
          </Card>
          <Card className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Save
            </div>
            <Btn
              className="mt-3 w-full justify-center"
              onClick={() => save.mutate(normalized)}
              disabled={
                disabled ||
                !dirty ||
                save.isPending ||
                invalidTemplate ||
                noteTooLong ||
                noteEmptyButOn
              }
            >
              {save.isPending ? "Saving" : !dirty && initial ? "Saved" : "Save sequence"}
            </Btn>
            {invalidTemplate && (
              <p className="mt-2 text-xs text-destructive">Template messages need text.</p>
            )}
            {noteEmptyButOn && (
              <p className="mt-2 text-xs text-destructive">
                Write the note or untick "Add a note".
              </p>
            )}
            {!initial && (
              <p className="mt-2 text-xs text-muted-foreground">
                This campaign has no saved sequence yet.
              </p>
            )}
            {save.error && (
              <div className="mt-3">
                <ErrorBanner error={save.error} />
              </div>
            )}
          </Card>
          {messages.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-xs text-warning">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Message steps are saved with the campaign. They start sending once message sending is
              switched on for your account. It is off right now, so only connection requests go out.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
