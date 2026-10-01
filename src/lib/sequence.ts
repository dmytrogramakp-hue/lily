import type { MessageStep, Sequence, SequencePreset } from "./types";

export const VARIABLES = ["{{first_name}}", "{{company}}", "{{title}}"] as const;

const aiMessage = (wait_days: number): MessageStep => ({
  type: "message",
  wait_days,
  mode: "ai",
  text: "",
});

export const PRESETS: {
  id: Exclude<SequencePreset, "custom">;
  label: string;
  description: string;
  build: () => Sequence;
}[] = [
  {
    id: "invite_only",
    label: "Invite only",
    description:
      "Send connection requests and stop. Good for building your network before you pitch.",
    build: () => ({ version: 1, preset: "invite_only", steps: [{ type: "invite", note: "" }] }),
  },
  {
    id: "invite_message",
    label: "Invite + message",
    description: "Connection request, then one message once they accept.",
    build: () => ({
      version: 1,
      preset: "invite_message",
      steps: [{ type: "invite", note: "" }, aiMessage(0)],
    }),
  },
  {
    id: "invite_two_messages",
    label: "Invite + 2 messages",
    description:
      "Connection request, a first message on acceptance, and a follow-up 3 days later if they do not reply.",
    build: () => ({
      version: 1,
      preset: "invite_two_messages",
      steps: [{ type: "invite", note: "" }, aiMessage(0), aiMessage(3)],
    }),
  },
];

export function presetLabel(seq: Sequence | null | undefined) {
  if (!seq) return "No sequence yet";
  const p = PRESETS.find((x) => x.id === seq.preset);
  return p ? p.label : "Custom sequence";
}

export function describeSequence(seq: Sequence | null | undefined): string[] {
  if (!seq) return [];
  const lines: string[] = [];
  const [invite, ...messages] = seq.steps;
  lines.push(
    invite.note.trim()
      ? "Connection request with a personal note"
      : "Connection request without a note",
  );
  messages.forEach((m, i) => {
    const when =
      i === 0
        ? m.wait_days === 0
          ? "within the hour after they accept"
          : `${m.wait_days} day${m.wait_days > 1 ? "s" : ""} after they accept`
        : m.wait_days === 0
          ? "right after the previous message if no reply"
          : `${m.wait_days} day${m.wait_days > 1 ? "s" : ""} after the previous message if no reply`;
    lines.push(
      `Message ${i + 1}, ${when}, ${m.mode === "ai" ? "written by AI for each lead" : "from your template"}`,
    );
  });
  return lines;
}

/** Renders a template with a sample lead so the user can preview personalisation. */
export function renderPreview(
  text: string,
  lead: { first_name?: string; company?: string; title?: string },
) {
  return text
    .replace(/\{\{\s*first_name\s*\}\}/g, lead.first_name || "Jane")
    .replace(/\{\{\s*company\s*\}\}/g, lead.company || "Acme")
    .replace(/\{\{\s*title\s*\}\}/g, lead.title || "Head of Risk");
}
