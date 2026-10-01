import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Info, MessageSquare, Plus, Sparkles, Trash2, UserPlus } from "lucide-react";
import { Btn, Card, ErrorBanner } from "@/components/lily/AppShell";
import { unwrap, updateCampaign } from "@/lib/api";
import { PRESETS, renderPreview } from "@/lib/sequence";
import type { MessageStep, Sequence, SequencePreset } from "@/lib/types";

const NOTE_VARS = ["{{first_name}}", "{{company}}", "{{title}}"];
const MESSAGE_VARS = ["{{first_name}}", "{{company}}", "{{title}}", "{{calendar_link}}"];
const MAX_MESSAGES = 3;

function presetFor(steps: Sequence["steps"]): SequencePreset {
  const messages = steps.length - 1;
  if (messages === 0) return "invite_only";
  if (messages === 1 && steps[1]?.wait_days === 0) return "invite_message";
  if (messages === 2 && steps[1]?.wait_days === 0) return "invite_two_messages";
  return "custom";
}

function VarChips({ vars, onInsert }: { vars: string[]; onInsert: (v: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {vars.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onInsert(v)}
          className="rounded-md bg-primary-soft px-2 py-0.5 font-mono text-[11px] text-primary hover:bg-primary hover:text-primary-foreground"
        >
          {v}
        </button>
      ))}
    </div>
  );
}

export function SequenceEditor({
  campaign,
  initial,
  sampleLead,
  locked,
}: {
  campaign: string;
  initial: Sequence | null;
  sampleLead?: { first_name?: string; company?: string; title?: string } | undefined;
  locked?: string | null;
}) {
  const qc = useQueryClient();
  const [seq, setSeq] = useState<Sequence>(initial ?? PRESETS[0]!.build());
  const [noteOn, setNoteOn] = useState<boolean>(!!initial?.steps[0].note);

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

  const setInviteNote = (note: string) =>
    setSeq((s) => ({
      ...s,
      steps: [{ type: "invite", note }, ...s.steps.slice(1)] as Sequence["steps"],
    }));
  const setMessage = (i: number, patch: Partial<MessageStep>) =>
    setSeq((s) => {
      const steps = [...s.steps] as Sequence["steps"];
      steps[i + 1] = { ...(steps[i + 1] as MessageStep), ...patch };
      return { ...s, steps };
    });
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
  const removeMessage = (i: number) =>
    setSeq((s) => ({
      ...s,
      steps: s.steps.filter((_, idx) => idx !== i + 1) as Sequence["steps"],
    }));
  const applyPreset = (id: (typeof PRESETS)[number]["id"]) => {
    const p = PRESETS.find((x) => x.id === id)!.build();
    // keep the invite note the user may already have written
    p.steps[0] = { type: "invite", note: seq.steps[0].note };
    setSeq(p);
  };

  const disabled = !!locked;

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
        <div className="space-y-0">
          {/* Invite step */}
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
                <textarea
                  value={seq.steps[0].note}
                  disabled={disabled}
                  onChange={(e) => setInviteNote(e.target.value)}
                  rows={4}
                  maxLength={300}
                  placeholder="Hi {{first_name}}, I work with teams like yours at {{company}} on news monitoring. Would be good to connect."
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
                <div className="flex items-start justify-between">
                  <VarChips
                    vars={NOTE_VARS}
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
                <p className="mt-2 text-xs text-muted-foreground">
                  If a lead is missing a value you used, for example no company, the invite goes out
                  without a note.
                </p>
              </div>
            )}
          </Card>

          {messages.map((m, i) => (
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
                      wait_days: Math.max(0, Math.min(30, Math.round(Number(e.target.value) || 0))),
                    })
                  }
                  className="w-14 rounded-md border px-2 py-0.5 text-center text-xs"
                  aria-label={`Days to wait before message ${i + 1}`}
                />
                <span>day{m.wait_days === 1 ? "" : "s"}</span>
              </div>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-ink text-ink-foreground">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="flex-1 font-semibold text-ink">Message {i + 1}</div>
                  <div className="inline-flex rounded-lg border p-0.5 text-xs font-semibold">
                    {(["ai", "template"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        disabled={disabled}
                        onClick={() => setMessage(i, { mode })}
                        className={`rounded-md px-2.5 py-1 ${m.mode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                      >
                        {mode === "ai" ? "AI writes it" : "My template"}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => removeMessage(i)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                    aria-label={`Remove message ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4">
                  {m.mode === "ai" && (
                    <div className="mb-2 flex items-start gap-2 rounded-lg bg-primary-soft px-3 py-2 text-xs text-accent-foreground">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Claude reads each lead's title, company and headline, picks the closest
                      vertical and writes a short note in your tone. Add instructions below to steer
                      it, or leave it empty.
                    </div>
                  )}
                  <textarea
                    value={m.text}
                    disabled={disabled}
                    onChange={(e) => setMessage(i, { text: e.target.value })}
                    rows={m.mode === "ai" ? 3 : 6}
                    maxLength={2000}
                    placeholder={
                      m.mode === "ai"
                        ? "Optional. For example: focus on regulatory monitoring and mention we cover 150,000+ sources."
                        : "Hey {{first_name}}, thanks for connecting. ..."
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                  {m.mode === "template" && (
                    <>
                      <VarChips
                        vars={MESSAGE_VARS}
                        onInsert={(v) =>
                          setMessage(i, {
                            text: `${m.text}${m.text.endsWith(" ") || !m.text ? "" : " "}${v}`,
                          })
                        }
                      />
                      {m.text.trim() && (
                        <div className="mt-3 whitespace-pre-wrap rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Preview
                          </div>
                          {renderPreview(m.text, sampleLead ?? {}).replace(
                            /\{\{\s*calendar_link\s*\}\}/g,
                            "https://savvycal.com/dimagrama/08f252b4",
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Card>
            </div>
          ))}

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
        </div>

        <div className="space-y-4">
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
