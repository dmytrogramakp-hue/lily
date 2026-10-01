// Mock data for the Lily prototype. Replace with Unipile/n8n-backed data later.

export type CampaignStatus = "active" | "paused" | "draft" | "completed";

export const teammates = [
  { id: "u1", name: "Maya Chen", initials: "MC", role: "AE" },
  { id: "u2", name: "Diego Ruiz", initials: "DR", role: "SDR" },
  { id: "u3", name: "Priya Nair", initials: "PN", role: "SDR" },
  { id: "u4", name: "Tom Becker", initials: "TB", role: "Manager" },
];

export const campaigns = [
  { id: "c1", name: "Fintech Heads of Data — EU", owner: "Maya Chen", status: "active" as CampaignStatus, leads: 842, invited: 610, accepted: 248, replied: 71, meetings: 14 },
  { id: "c2", name: "Media monitoring — PR agencies US", owner: "Diego Ruiz", status: "active" as CampaignStatus, leads: 520, invited: 498, accepted: 176, replied: 52, meetings: 9 },
  { id: "c3", name: "Hedge funds alt-data buyers", owner: "Priya Nair", status: "paused" as CampaignStatus, leads: 310, invited: 190, accepted: 61, replied: 18, meetings: 3 },
  { id: "c4", name: "AI startups — news API intent", owner: "Maya Chen", status: "active" as CampaignStatus, leads: 1204, invited: 380, accepted: 151, replied: 40, meetings: 6 },
  { id: "c5", name: "ESG risk analysts — Q4 webinar", owner: "Tom Becker", status: "draft" as CampaignStatus, leads: 0, invited: 0, accepted: 0, replied: 0, meetings: 0 },
  { id: "c6", name: "Re-engage closed-lost 2025", owner: "Diego Ruiz", status: "completed" as CampaignStatus, leads: 214, invited: 214, accepted: 98, replied: 33, meetings: 7 },
];

export type Invite = {
  id: string;
  name: string;
  initials: string;
  title: string;
  company: string;
  mutual: number;
  note?: string;
  when: string;
  direction: "incoming" | "outgoing";
  campaign?: string;
};

export const invites: Invite[] = [
  { id: "i1", name: "Sofia Lindqvist", initials: "SL", title: "Head of Data Platform", company: "Klarna", mutual: 12, note: "Hi Maya — saw your post on news-driven risk signals, would love to connect.", when: "12m", direction: "incoming" },
  { id: "i2", name: "James O'Connor", initials: "JO", title: "VP Engineering", company: "Brandwatch", mutual: 4, when: "1h", direction: "incoming" },
  { id: "i3", name: "Aiko Tanaka", initials: "AT", title: "Quant Researcher", company: "Two Sigma", mutual: 2, note: "Interested in your alt-data coverage.", when: "3h", direction: "incoming" },
  { id: "i4", name: "Lucas Moreau", initials: "LM", title: "Recruiter", company: "TalentHub", mutual: 0, note: "Exciting opportunity for you!", when: "5h", direction: "incoming" },
  { id: "i5", name: "Rachel Kim", initials: "RK", title: "Director of Insights", company: "Meltwater", mutual: 7, when: "1d", direction: "incoming" },
  { id: "i6", name: "Ben Adler", initials: "BA", title: "CTO", company: "Signal AI", mutual: 9, when: "2d", direction: "outgoing", campaign: "AI startups — news API intent" },
  { id: "i7", name: "Elena Petrova", initials: "EP", title: "Head of Research", company: "Man Group", mutual: 3, when: "3d", direction: "outgoing", campaign: "Hedge funds alt-data buyers" },
  { id: "i8", name: "Marcus Hill", initials: "MH", title: "Data Lead", company: "Revolut", mutual: 5, when: "4d", direction: "outgoing", campaign: "Fintech Heads of Data — EU" },
];

export type StepType = "view" | "follow" | "invite" | "message" | "delay" | "condition" | "endorse" | "like";

export type Step = { id: string; type: StepType; title: string; detail: string; branch?: "yes" | "no" };

export const sequence: Step[] = [
  { id: "s1", type: "view", title: "View profile", detail: "Warm up — appear in their notifications" },
  { id: "s2", type: "delay", title: "Wait 1 day", detail: "Within working hours 9:00–17:30" },
  { id: "s3", type: "like", title: "Like a recent post", detail: "Most recent post in the last 30 days" },
  { id: "s4", type: "invite", title: "Send connection invite", detail: "Hi {{first_name}}, I noticed {{company}} is hiring for data roles…" },
  { id: "s5", type: "condition", title: "Invite accepted?", detail: "Check for up to 14 days" },
  { id: "s6", type: "message", title: "Message #1", detail: "Thanks for connecting, {{first_name}}! Quick question about how {{company}} tracks news…", branch: "yes" },
  { id: "s7", type: "delay", title: "Wait 3 days", detail: "Skip if they reply", branch: "yes" },
  { id: "s8", type: "message", title: "Message #2 — follow up", detail: "Sharing a 2-min demo of Lily pulling live news for {{company}}…", branch: "yes" },
  { id: "s9", type: "follow", title: "Follow profile", detail: "Stay visible without connecting", branch: "no" },
  { id: "s10", type: "endorse", title: "Endorse top skill", detail: "Endorse their #1 listed skill", branch: "no" },
];

export const conversations = [
  { id: "m1", name: "Sofia Lindqvist", initials: "SL", company: "Klarna", preview: "Sounds interesting — can you send pricing?", when: "9:41", unread: true, tag: "Interested", campaign: "Fintech Heads of Data — EU" },
  { id: "m2", name: "Ben Adler", initials: "BA", company: "Signal AI", preview: "We're using a competitor right now, but…", when: "8:12", unread: true, tag: "Objection", campaign: "AI startups — news API intent" },
  { id: "m3", name: "Rachel Kim", initials: "RK", company: "Meltwater", preview: "Let's do Thursday 3pm CET.", when: "Yesterday", unread: false, tag: "Meeting", campaign: "Media monitoring — PR agencies US" },
  { id: "m4", name: "Marcus Hill", initials: "MH", company: "Revolut", preview: "Not the right time, maybe Q1.", when: "Mon", unread: false, tag: "Later", campaign: "Fintech Heads of Data — EU" },
  { id: "m5", name: "Elena Petrova", initials: "EP", company: "Man Group", preview: "You: Thanks Elena, sharing the deck now.", when: "Sun", unread: false, tag: "Interested", campaign: "Hedge funds alt-data buyers" },
];

export const thread = [
  { from: "me", text: "Thanks for connecting, Sofia! Quick question — how does Klarna's data team currently track news about merchants and partners?", when: "Mon 10:02" },
  { from: "them", text: "Hi Maya! Mostly manual alerts plus a vendor feed. It's noisy honestly.", when: "Mon 14:20" },
  { from: "me", text: "That's exactly where Lily helps — deduplicated, entity-tagged news across 80k sources. Want a 2-min demo with Klarna's merchants?", when: "Tue 09:15" },
  { from: "them", text: "Sounds interesting — can you send pricing?", when: "9:41" },
];

export const weekly = [
  { day: "Mon", invites: 92, accepted: 31, replies: 9 },
  { day: "Tue", invites: 110, accepted: 42, replies: 14 },
  { day: "Wed", invites: 98, accepted: 37, replies: 11 },
  { day: "Thu", invites: 120, accepted: 49, replies: 17 },
  { day: "Fri", invites: 85, accepted: 30, replies: 10 },
  { day: "Sat", invites: 0, accepted: 6, replies: 2 },
  { day: "Sun", invites: 0, accepted: 4, replies: 1 },
];
