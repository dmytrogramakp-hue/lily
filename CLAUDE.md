# Lily — NewsCatcher LinkedIn outreach

Internal tool for Dima's LinkedIn outreach. Upload a list, it becomes a campaign, n8n sends invites and two AI-written messages, replies land in the inbox.

## Stack
- TanStack Start v1 (React 19, file routes in `src/routes/`), Vite, Tailwind v4. Started from a Lovable prototype.
- Design tokens in `src/styles.css` (oklch). Use semantic classes (`bg-primary`, `text-ink`, `bg-primary-soft`, `shadow-card`). Never hardcode colours.
- Brand: NewsCatcher royal blue `#183FD9`, navy `#04006B`, light `#74A0FE`, bg `#F6F8FB`. Font: PP Neue Montreal + PP Neue Montreal Mono, local `@font-face` from `public/fonts`. Never Google Fonts.
- Shared UI: `src/components/lily/AppShell.tsx`.

## Architecture
```
Browser ──server fns (src/lib/api.ts)──▶ Unipile API          (inbox, invites, send message)
                                    └──▶ n8n "Lily - API"     (upload leads, campaign stats, campaign status)
                                              │
                                              ├─ Google Sheet "LI Invites Only" / tab "Invite Queue"   (all leads)
                                              ├─ Google Sheet tracker / tab "LinkedIn Outreach Tracker" (messages, replies)
                                              ├─ n8n data table "lily_campaigns"                        (campaign status)
                                              ├─ n8n data table "lily_settings"                         (daily_invite_limit, send_weekends)
                                              └─ n8n data table "lily_lead_progress"                    (per lead: accepted, messages sent, replies)
```
- Server functions never throw across the boundary. They return `Result<T>`; the client calls `unwrap()`. Thrown errors from server fns did not reach the client in this TanStack version.
- All keys stay server-side. `src/lib/server/env.ts` reads `.env.local` in dev because Vite does not expose non-`VITE_` vars to `process.env`.
- `src/server.ts` enforces HTTP basic auth on every request (pages and server fns). In production it refuses to serve if the password is not set.

## n8n workflows (newscatcher.app.n8n.cloud, CatchAll project, folder Sales Automation)
| Workflow | Id | Role |
|---|---|---|
| Lily - API | v0UKQJZ7ljJSo3UB | Webhooks `lily-upload`, `lily-campaigns`, `lily-campaign-status` (create, status, sequence), `lily-campaign-leads`, `lily-settings`. Guarded by `x-lily-key` header = `LILY_N8N_SECRET`. |
| LinkedIn - Campaign Messages | I4a0XgRsdByYz8iH | Hourly 9:20 to 17:20 Madrid, weekdays unless `send_weekends`. Reads new connections from Unipile `/users/relations`, records each accepted lead of an active campaign in `lily_lead_progress` (key = LinkedIn public id), and sends the campaign's message steps. Message 1 is due `wait_days` calendar days after the acceptance date, each later message `wait_days` after the previous one. Any reply from the lead stops the sequence. AI steps call Lily - AI Writer as a sub-workflow; tone-check failures go to `needs_review` with the draft in `note`. Caps: 15 sends per run, 60 per day, 30 to 90 s between sends. |
| LinkedIn Drip v2 - Message 1 / 2 | vlhdApprJVEOwNe7 / muc4p1HwTOQGq6Ib | Old, unpublished. Replaced by Campaign Messages. |
| LinkedIn - Send Invites v2 | kUijiwRnqELRkEQt | Hourly 9:05 to 17:05 Madrid. Sends exactly `daily_invite_limit` per day (from `lily_settings`), spread over the remaining runs, max 10 per run, only to `active` campaigns. Marks unreachable and failed leads. |
| LinkedIn - Withdraw Invites (Lily) | vsdvwNnZUBTCHux7 | Webhook `lily-withdraw` with invitation ids. Withdraws them one by one, 3 to 8 s apart, in the background. Job status in `lily_settings` key `withdraw_job`, surfaced as `jobs.withdraw` in `lily-campaigns`. |
| Lily - AI Writer | 2sG66FCH2lVpMpPm | Webhook `lily-generate`. The single Claude entry point (Anthropic node, shared n8n credential, model and company context from `lily_settings`). Modes: `message` (analyses a compact LinkedIn profile and writes, returns analysis + text + tone issues), `template` (generic text with placeholders from an audience sample), `ping`. Also callable as a sub-workflow (trigger "Called By Workflow", same body as the webhook), which is how Campaign Messages uses it, so previews match what is sent. |
| LinkedIn - Send Invites (old) | sywANecBVuOg2Bss | Unpublished. Used a revoked Unipile key and ignored campaigns. |

Campaign rules: statuses are draft, active, paused, archived (plus legacy for queue rows with no campaign row). A campaign row with no status shows as draft. Only `active` campaigns are invited. Old rows without `campaign_name` show as "Legacy queue" and cannot run a sequence.

Sequence JSON (column `sequence` in `lily_campaigns`): `{ version: 1, preset, steps: [{ type: "invite", note }, { type: "message", wait_days, mode: "ai" | "template", text }...] }`, max 3 messages. The invite sender fills the invite note per lead from the live LinkedIn profile (first and last name, current role company and title), falling back to the CSV, and sends without a note if a used value is missing. Message steps are sent by LinkedIn - Campaign Messages. Lead stages in `lily-campaign-leads` come from `lily_lead_progress` (queued, invited, connected, message_1..3, replied, needs_review, stopped, skipped) with the next scheduled message date; leads from before Lily fall back to the old tracker matched by name.

## Screens
| Route | Data |
|---|---|
| `/` | Daily invite limit + weekend switch, KPIs, campaign list. Rows open the campaign. |
| `/new-campaign` | Name + preset, creates a draft campaign, opens it |
| `/campaigns/$name` | Setup checklist, launch / pause / resume / archive. Tabs: Overview (KPIs, funnel, sequence summary), Leads (CSV upload into this campaign, lead table with stage filters and search via `lily-campaign-leads`), Sequence (presets, invite note with Draft with AI, message steps: AI mode with per-lead preview showing Claude's profile analysis, or template mode with Draft with AI and placeholders) |
| `/invites` | Unipile received (accept / ignore) and sent (withdraw). Outgoing tab has bulk withdraw. |
| `/inbox` | Unipile chats, thread view, send reply |
| `/analytics` | 14-day activity, funnel, per-campaign table |
| `/settings` | Claude connection test, model (Sonnet 5 / Opus 5), "What NewsCatcher does" context used by every AI prompt |

## Run
```
cp .env.example .env.local   # fill in values
npm install
npm run dev -- --port 5174
```
Deploy: Vercel project `lily` (team dima-4116s-projects, prj_uxb0jNTsIvVv3Bx9kncIsvtE2StV), production URL https://lily-steel-sigma.vercel.app, target domain sales.newscatcher.business (previously the old `sales-tracker` project, which is kept but detached). Nitro detects Vercel at build time and writes `.vercel/output`. Production env vars (all sensitive) mirror `.env.example`. Deploy with `npx vercel --scope dima-4116s-projects deploy --prod`. Git auto-deploy is not connected yet.
