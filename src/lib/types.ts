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
  /** Team member key, or null when nobody owns the campaign. */
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
  /** Activity from before Lily (old invite automation and the March 2026 CatchAll drip). Not part of totals. */
  before_lily?: {
    leads: number;
    invited: number;
    invites_from: string | null;
    invites_to: string | null;
    tracker_connections: number;
    tracker_from: string | null;
    tracker_to: string | null;
  };
  daily: DailyActivity[];
  /** The current outreach push measured against its targets. Absent when no push is configured. */
  trial_push?: TrialPush | null;
  settings: SendingSettings;
  /** Everyone who can be picked as "who is using Lily" and assigned as a campaign owner. */
  users?: TeamMember[];
  today: {
    date: string;
    invites_sent: number;
    messages_sent?: number;
    /** Invites and messages sent today per Unipile account id. */
    by_account?: Record<string, { invites: number; messages: number }>;
  };
  /** Pending invites per Unipile account id, from the hourly monitor. */
  pending_invites?: {
    checked_at: string;
    thresholds: number[];
    accounts: Record<string, PendingInviteStats>;
  } | null;
  /** Names of deleted campaigns, reserved so a new campaign cannot reuse them. */
  deleted_names?: string[];
  /** Account used for unassigned and legacy campaigns (Dima's). */
  default_account?: string;
  jobs?: { withdraw: WithdrawJob | null };
};

export type TeamMember = {
  /** Stable id stored as the campaign owner, e.g. "dima". */
  key: string;
  name: string;
  role: string;
  email: string;
  active: boolean;
  /** Unipile account id of this person's connected LinkedIn, empty when not connected. */
  unipile_account_id?: string;
  linkedin_name?: string;
  linkedin_connected_at?: string;
  /** Used for {{calendar_link}} in this person's template messages. */
  calendar_link?: string;
  /** Invites per day from this person's LinkedIn. null = the team default. */
  daily_invite_limit?: number | null;
  /** The limit the invite sender uses today: ramp step, own limit or team default. */
  invite_limit_today?: number;
  invite_limit_source?: "ramp" | "own" | "team";
  /** Dated ramp steps (Madrid dates), set by Dima in lily_settings invite_ramp. */
  invite_ramp?: { from: string; limit: number }[];
  invite_ramp_next?: { from: string; limit: number } | null;
};

/** Pending (sent, not yet accepted) LinkedIn invites for one account, refreshed hourly on weekdays. */
export type PendingInviteStats = {
  member_key: string;
  member_name: string;
  count: number;
  older_than_14d: number;
  older_than_21d: number;
  oldest_at: string | null;
  /** 0, 300, 400 or 500: the highest alert threshold reached. */
  level: number;
  error: string | null;
};

/** A LinkedIn account in the Unipile workspace. status "OK" means it can send. */
export type LinkedInAccount = {
  id: string;
  name: string;
  status: string;
  created_at: string | null;
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

export type AiModel =
  "claude-sonnet-5-5" | "claude-opus-5-5" | "claude-haiku-5-5" | "claude-fable-5-1";
export type SendingSettings = {
  daily_invite_limit: number;
  send_weekends: boolean;
  company_context: string;
  offer: string;
  ai_model: AiModel;
  /** Script Claude follows for message 1. {first_name} marks where the name goes. */
  first_message_script?: string;
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

export type TrialPush = {
  name: string;
  start: string;
  end: string;
  days: { total: number; elapsed: number; working_total: number; working_elapsed: number };
  targets: {
    invites: number;
    connections: [number, number];
    replies: [number, number];
    signups: [number, number];
  };
  /** What the ramp schedule says should have happened by now. */
  expected_today: {
    invites: number;
    connections: [number, number];
    replies: [number, number];
    signups: [number, number];
  };
  actual: {
    invites: number;
    connections: number;
    replies: number;
    signups: number;
    keys_used: number;
    signups_updated_at: string | null;
  };
  per_sender: {
    key: string;
    name: string;
    invites: number;
    expected_invites: number;
    connections: number;
    replies: number;
  }[];
};

export type ChatMessage = { id: string; text: string; at: string | null; from_me: boolean };

/** How Claude read the latest message from the other person in a thread. */
export type TriageLabel =
  "positive" | "question" | "later" | "decline" | "out_of_office" | "vendor" | "other";
export type TriageResult = {
  label: TriageLabel;
  reason: string;
  /** Suggested reply in the sender's voice, empty when no reply is wanted. Never sent on its own. */
  reply: string;
  last_id: string | null;
};

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
