# Lily

NewsCatcher LinkedIn outreach tool. Upload a list of LinkedIn profiles, it becomes a campaign, and the n8n automations send invites and two AI-written follow-ups. Replies show up in the inbox.

See `CLAUDE.md` for architecture, n8n workflow ids and screens.

## Local development

```sh
cp .env.example .env.local   # fill in UNIPILE_API_KEY, LILY_N8N_SECRET, LILY_BASIC_PASSWORD
npm install
npm run dev -- --port 5174
```

## Deploy

Connect this repo to Vercel and set the variables from `.env.example`. The build detects Vercel automatically.
