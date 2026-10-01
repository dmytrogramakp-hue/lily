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
                                              └─ n8n data table "lily_settings"                         (daily_invite_limit, send_weekends)
```
- Server functions never throw across the boundary. They return `Result<T>`; the client calls `unwrap()`. Thrown errors from server fns did not reach the client in this TanStack version.
- All keys stay server-side. `src/lib/server/env.ts` reads `.env.local` in dev because Vite does not expose non-`VITE_` vars to `process.env`.
- `src/server.ts` enforces HTTP basic auth on every request (pages and server fns). In production it refuses to serve if the password is not set.

## n8n workflows (newscatcher.app.n8n.cloud, CatchAll project, folder Sales Automation)
| Workflow | Id | Role |
|---|---|---|
| Lily - API | v0UKQJZ7ljJSo3UB | Webhooks `lily-upload`, `lily-campaigns`, `lily-campaign-status`, `lily-settings`. Guarded by `x-lily-key` header = `LILY_N8N_SECRET`. |
| LinkedIn Drip v2 - Message 1 | vlhdApprJVEOwNe7 | Daily 9:00. New connections from the queue get a Claude-written intro. |
| LinkedIn Drip v2 - Message 2 | muc4p1HwTOQGq6Ib | Daily 9:30. Follow-up with calendar link 3 days later if no reply. |
| LinkedIn - Send Invites v2 | kUijiwRnqELRkEQt | Hourly 9:05 to 17:05 Madrid. Sends exactly `daily_invite_limit` per day (from `lily_settings`), spread over the remaining runs, max 10 per run, only to `active` campaigns. Marks unreachable and failed leads. |
| LinkedIn - Withdraw Invites (Lily) | vsdvwNnZUBTCHux7 | Webhook `lily-withdraw` with invitation ids. Withdraws them one by one, 3 to 8 s apart, in the background. Job status in `lily_settings` key `withdraw_job`, surfaced as `jobs.withdraw` in `lily-campaigns`. |
| LinkedIn - Send Invites (old) | sywANecBVuOg2Bss | Unpublished. Used a revoked Unipile key and ignored campaigns. |

Campaign rules: uploads create campaigns with no status, shown as paused. Only `active` campaigns should be invited. Old rows without `campaign_name` show as "Legacy queue".

## Screens
| Route | Data |
|---|---|
| `/` | Daily invite limit + weekend switch (`lily-settings`), KPIs and campaigns from `lily-campaigns`, activate / pause via `lily-campaign-status` |
| `/leads` | CSV upload (papaparse), column auto-mapping, preview, dedupe, posts to `lily-upload` |
| `/sequences` | Read-only description of the real flow |
| `/invites` | Unipile received (accept / ignore) and sent (withdraw) invitations. Outgoing tab has bulk withdraw: the server pages all sent invites (100 per page), picks the oldest N, and hands the ids to `lily-withdraw`. |
| `/inbox` | Unipile chats, thread view, send reply |
| `/analytics` | 14-day activity, funnel, per-campaign table from `lily-campaigns` |

## Run
```
cp .env.example .env.local   # fill in values
npm install
npm run dev -- --port 5174
```
Deploy: Vercel auto-detects the host at build time (nitro). Set the env vars from `.env.example` in the project settings.
