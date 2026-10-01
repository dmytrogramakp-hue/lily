export type CampaignStatus = "draft" | "active" | "paused" | "archived" | "legacy";

export type Campaign = {
  name: string;
  status: CampaignStatus;
  leads: number;
  invited: number;
  pending: number;
  unreachable: number;
  excluded: number;
  accepted: number;
  msg1: number;
  msg2: number;
  msg3?: number;
  replied: number;
  needs_review?: number;
  last_invite_at: string | null;
  created_at: string | null;
  source_file: string | null;
  owner: string | null;
  sequence: Sequence | null;
};

export type DailyActivity = {
  date: string;
  invites: number;
  msg1: number;
  msg2: number;
  msg3?: number;
  replied: number;
};

export type CampaignSummary = {
  generated_at: string;
  campaigns: Campaign[];
  totals: {
    leads: number;
    invited: number;
    pending: number;
    connected: number;
    msg1: number;
    msg2: number;
    msg3?: number;
    replied: number;
    needs_review?: number;
  };
  daily: DailyActivity[];
  settings: SendingSettings;
  today: { date: string; invites_sent: number; messages_sent?: number };
  jobs?: { withdraw: WithdrawJob | null };
};

export type WithdrawJob = {
  status: "running" | "finished";
  requested: number;
  start_total: number | null;
  started_at?: string;
  withdrawn?: number;
  failed?: number;
  finished_at?: string;
};

export type SentSummary = {
  total: number;
  eligible: number;
  oldest_at: string | null;
  truncated: boolean;
};

export type AiModel = "claude-sonnet-5" | "claude-opus-5";
export type SendingSettings = {
  daily_invite_limit: number;
  send_weekends: boolean;
  company_context: string;
  offer: string;
  ai_model: AiModel;
};

export type ProfileAnalysis = {
  role?: string;
  company?: string;
  current_focus?: string;
  best_use_case?: string;
  angle?: string;
};
export type GeneratedText = {
  ok: boolean;
  error?: string | null;
  model: string;
  text: string;
  analysis: ProfileAnalysis | null;
  angle: string | null;
  issues: string[];
  profile?: { name: string; headline: string | null; current_role: string | null; posts: number };
};

export type LeadInput = {
  linkedin_url: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
};

export type UploadResult = {
  ok: boolean;
  error?: string | null;
  campaign_name: string;
  total: number;
  added: number;
  duplicates: number;
  invalid: number;
};

export type Person = {
  name: string;
  headline: string | null;
  picture_url: string | null;
  profile_url: string | null;
  provider_id: string | null;
};

export type ConversationSummary = {
  chat_id: string;
  person: Person;
  unread: number;
  last_text: string;
  last_at: string | null;
  last_from_me: boolean | null;
};

export type ChatMessage = { id: string; text: string; at: string | null; from_me: boolean };

export type Invitation = {
  id: string;
  direction: "incoming" | "outgoing";
  person: Person;
  note: string | null;
  at: string | null;
  shared_secret: string | null;
};

export type SequencePreset = "invite_only" | "invite_message" | "invite_two_messages" | "custom";
export type InviteStep = { type: "invite"; note: string };
export type MessageStep = {
  type: "message";
  wait_days: number;
  mode: "ai" | "template";
  text: string;
};
export type SequenceStep = InviteStep | MessageStep;
export type Sequence = {
  version: 1;
  preset: SequencePreset;
  steps: [InviteStep, ...MessageStep[]];
};

export type LeadStage =
  | "queued"
  | "invited"
  | "connected"
  | "message_1"
  | "message_2"
  | "message_3"
  | "replied"
  | "needs_review"
  | "stopped"
  | "skipped";
export type CampaignLead = {
  linkedin_url: string;
  first_name: string;
  last_name: string;
  company: string;
  title: string;
  stage: LeadStage;
  invite_sent_at: string | null;
  added_at: string | null;
  /** When LinkedIn shows the connection was accepted (set by the message sender). */
  connected_at?: string | null;
  last_message_at?: string | null;
  /** Madrid calendar date the next message is scheduled for, from the campaign's wait_days. */
  next_message_on?: string | null;
  next_message_step?: number | null;
  note: string;
};
