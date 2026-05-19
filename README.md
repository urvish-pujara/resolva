# Resolva — AI-Augmented Support Workspace

An end-to-end customer support workspace for a fictional inventory-management SaaS, built to explore what a modern, AI-assisted helpdesk looks like beyond the "Zendesk clone" baseline.

> **Live demo:** _coming soon_
> **Stack:** React · Vite · TanStack Query · Tailwind · Express · Postgres (Neon) · Gemini 2.0 Flash

![screenshot placeholder](docs/screenshot.png)

## Highlights

- **AI suggest-reply.** One-click drafts grounded in the full conversation transcript, customer plan/MRR, and internal notes. Responses stream token-by-token into the composer via SSE → `ReadableStream` → React state. The agent can edit before sending — AI is the assistant, not the author.
- **Realistic conversation lifecycle.** `open → pending_customer → pending_internal → resolved → closed`, with auto-reopen on customer reply within 14 days and auto-close of stale resolved threads after 72 hours.
- **SLA tracking.** Priority-driven due times (urgent 1h / high 4h / normal 24h / low 72h), computed on create and visible per conversation.
- **Audit log.** Every status change, assignment, message, action, and AI invocation is written to an append-only audit table and shown in a dedicated view.
- **Macros + customer-action panel.** Templated responses with variable substitution, plus simulated side-effect actions (resync inventory, regen labels, extend trial, escalate) that write audit events.
- **Inbox with filters + search.** Status, assignee, priority, tag, and full-text search across subjects and message bodies.

## AI architecture

```
Browser (ReplyComposer.jsx)
   │  POST /api/ai/conversations/:id/suggest-reply
   ▼
Express (routes/ai.js)
   │  loadContext → buildPrompt
   │  fetch Gemini streamGenerateContent (SSE)
   │  parse `data:` chunks, extract candidates[0].content.parts[].text
   ▼
res.write(text) → fetch().body.getReader() → setBody(full)
```

The server is a thin streaming proxy: no SDK dependency, no buffering, no key in the browser. Prompt is assembled from the live DB row (conversation, customer, transcript, internal notes) so drafts always reflect current state.

## Run locally

1. **Provision a free Postgres database.** Create a project at <https://neon.tech> (free tier — 0.5 GB, scales to zero), copy the connection string from the dashboard.
2. **Configure env vars.** Create `server/.env`:

   ```
   DATABASE_URL=postgres://USER:PASSWORD@HOST/DBNAME?sslmode=require
   GEMINI_API_KEY=...   # optional; powers the suggest-reply button
   ```

3. **Install and run.**

   ```bash
   npm run install:all
   npm run dev
   ```

- Client: <http://localhost:5173>
- API: <http://localhost:4000>
- DB schema is created and seeded on first server boot.

Get a free Gemini key at <https://aistudio.google.com/apikey>. Without a key the app runs fully; only the "✨ Suggest reply" button degrades to a clean 503.

To re-seed, truncate the tables in Neon (`TRUNCATE agents, customers, conversations, messages, tags, conversation_tags, actions, macros, audit_log CASCADE;`) and restart the server. The seeder checks the `agents` table and skips if non-empty.

## Deploying for free

- **Backend (Render web service, free tier):** point the build at `server/`, set `DATABASE_URL`, `GEMINI_API_KEY`, and `CORS_ORIGIN=https://<your-client-host>`. Start command: `npm start`.
- **Frontend (Vercel / Netlify / Cloudflare Pages):** build `client/` with `npm run build`, deploy the `dist/` folder. Set a `VITE_API_BASE` env var pointing at the deployed server URL (the client already reads it; the Vite dev proxy is only used in `vite dev`).
- **Database (Neon):** persistent on the free tier, no time limit.

## Stack

- **Frontend:** React 18, Vite, TanStack Query, React Router, Tailwind CSS
- **Backend:** Node.js (native `--env-file`, native `fetch`), Express, `pg`
- **AI:** Google Gemini 2.0 Flash via `streamGenerateContent` (SSE)
- **DB:** Postgres (Neon free tier in production; any Postgres URL locally)

## Layout

```
Resolva/
├── client/                # Vite + React
│   └── src/
│       ├── components/    # ConversationDetail, ReplyComposer, MessageThread, …
│       ├── pages/         # Inbox, Dashboard, Customer, Audit, Settings
│       └── api.js         # typed fetch client incl. streaming AI helper
└── server/
    ├── routes/            # conversations, customers, agents, tags, macros, audit, dashboard, ai
    ├── lib/seed.js        # deterministic seed data
    ├── db.js              # pg pool + schema bootstrap
    └── index.js           # Express app + background auto-close job
```

## Design notes

- **No fake auth ceremony.** The current agent is set via an `x-agent-id` header chosen from a top-bar dropdown — appropriate for a prototype, and the audit log already records actor identity so swapping in real auth is mechanical.
- **No global state library.** TanStack Query owns server cache; React state owns UI. Cache invalidation keys are explicit on every mutation.
- **Postgres via `pg`.** The data layer is plain async `query(...)` calls — easy to swap to Drizzle/Kysely later, and keeps the binary footprint small. Neon is the default host because it scales to zero and stays free.
- **Streaming AI via raw SSE, not an SDK.** Keeps the dependency surface minimal and makes the data flow inspectable.

## What's intentionally out of scope (for now)

Real auth, websockets, automated tests, hosted demo. Tracked as next iterations.
