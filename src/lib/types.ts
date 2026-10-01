export type CampaignStatus = "active" | "paused" | "archived" | "legacy";

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
  replied: number;
  last_invite_at: string | null;
  created_at: string | null;
  source_file: string | null;
  owner: string | null;
};

export type DailyActivity = {
  date: string;
  invites: number;
  msg1: number;
  msg2: number;
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
    replied: number;
  };
  daily: DailyActivity[];
  settings: SendingSettings;
  today: { date: string; invites_sent: number };
};

export type SendingSettings = { daily_invite_limit: number; send_weekends: boolean };

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
