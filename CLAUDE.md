# Lily — NewsCatcher LI Agent (design handoff)

This repo is a **UI prototype** of a LinkedIn outreach tool (Dripify-style) for sales teams.
All data is mock (`src/lib/mock.ts`). Your job: keep the design, wire the backend.

## Stack
- TanStack Start v1 (React 19, file routes in `src/routes/`), Vite, Tailwind v4.
- Design tokens live in `src/styles.css` (oklch). Use semantic classes (`bg-primary`, `text-ink`, `bg-primary-soft`, `shadow-card`, `bg-gradient-ink`) — never hardcode colours.
- Brand: NewsCatcher royal blue `#183FD9` (primary), navy `#04006B` (ink / sidebar), light `#74A0FE` (primary-glow), bg `#F6F8FB`. Font: PP Neue Montreal + PP Neue Montreal Mono, loaded locally from `public/fonts` via @font-face. Never use Google Fonts.
- Shared UI: `src/components/lily/AppShell.tsx` (sidebar layout, Card, Btn, Avatar, StatusPill).

## Screens
| Route | Purpose | Backend needed |
|---|---|---|
| `/` | Campaigns list + KPIs, pause/resume | campaigns CRUD, stats |
| `/sequences` | Sequence builder: view, like, invite, message, delay, condition (yes/no branches), follow, endorse | save sequence JSON, launch → n8n workflow |
| `/invites` | Incoming: accept / ignore / accept all. Outgoing: withdraw | Unipile invitations API |
| `/inbox` | Unified team inbox, send message, AI reply chips, lead stage | Unipile chats/messages, webhooks for new messages |
| `/analytics` | Weekly activity, funnel, team leaderboard | aggregated events |

## Intended backend
- **Unipile API** for LinkedIn actions (invites, messages, profile views, chats). Keep the API key server-side only.
- **n8n** runs sequences: each step type maps to an n8n node; respect daily limits (sidebar shows invites/day) and working hours.
- Multi-user sales team: each rep connects their own LinkedIn account; managers see "All team".
- Variables in messages: `{{first_name}}`, `{{company}}`, `{{title}}`, `{{recent_news}}` (from NewsCatcher API).
