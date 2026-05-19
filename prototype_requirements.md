# Prototype Requirements: Resolvr (Non-AI Foundation)

**Status:** Draft v1
**Scope:** Prototype / v0 foundation
**Tech direction:** React frontend + SQL database (SQLite for prototype)
**Last updated:** May 17, 2026

---

## 1. Purpose of This Document

This document specifies the **non-AI foundation** of Resolvr — the underlying customer support workspace that the AI layer will eventually be built on top of. The intent is to ship a working prototype that demonstrates the core CX workflow (receive ticket → triage → respond → resolve → audit) end-to-end using human agents only.

All AI capabilities described in the PRD/FRD (AI agent, AI-drafted replies, auto-QA, confidence-based escalation, action guardrails for AI, knowledge gap detection, topic clustering, AI-derived analytics) are explicitly **out of scope** for this prototype. Hooks should be present in the data model where AI will plug in later (e.g. an `author_type` field that today is only `customer | agent | system`, but will later include `ai`), but no AI behavior should be implemented.

This is the scaffolding. AI gets added in v1.

---

## 2. Goals

1. A working, demoable customer support workspace.
2. A clean data model that AI features can be layered onto later without redesign.
3. Enough realism that we can validate the agent workspace UX and the conversation lifecycle before investing in AI integration.
4. Buildable by one engineer in 2–3 weeks.

---

## 3. Scope

### In Scope

- Conversation management (create, view, update, close, reopen).
- Customer profiles with basic context.
- Human agent workspace (list + detail views).
- Manual reply composition with saved replies (macros).
- Status, priority, assignee, tag management.
- Internal notes.
- Manual actions (e.g. issue refund, reset password) — recorded but not actually executed against external systems; for the prototype these are logged stubs.
- Action audit log.
- Basic role distinction (agent vs. admin).
- Basic dashboard with operational counts.
- Email channel (inbound parsing + outbound send) — simulated in the prototype with a textarea-based "inbound message" admin tool, no real SMTP/IMAP.

### Out of Scope (Prototype)

- All AI features: AI agent, AI-drafted replies, AI confidence scoring, AI escalation, AI reasoning trace, action guardrails for AI, knowledge gap detection, topic clustering, product insight feed, auto-QA scoring, pre-send CSAT checks.
- Real channel integrations (no actual email/SMS/voice/chat connectors). All "channels" are simulated through an admin panel.
- SSO/SAML, SCIM provisioning. Auth is a simple email+password (or hardcoded agent selector for the demo).
- Real third-party integrations (CRM, billing, telemetry). Customer context is fully in our SQL database.
- Voice channel.
- Multi-tenancy. Single-workspace prototype only.
- PII detection/redaction.
- Multilingual.
- Mobile apps.

---

## 4. Tech Stack

| Layer            | Choice                                                             | Rationale                                                                                 |
| ---------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Database         | SQLite (via better-sqlite3)                                        | Zero-config for prototype; same SQL dialect as Postgres roughly; trivial to migrate later |
| Backend          | Node.js + Express (or Fastify)                                     | Simple, fast to set up, TS-friendly                                                       |
| Frontend         | React + Vite                                                       | Fast dev experience; TS optional but recommended                                          |
| Styling          | Tailwind CSS or plain CSS modules                                  | Prototype aesthetic should still be polished                                              |
| State management | TanStack Query for server state                                    | Caching + refetch is essential for inbox UX                                               |
| Auth             | Hardcoded agent selector in dev; basic email+password if needed    | Skip SSO complexity                                                                       |
| Real-time        | None for prototype (poll every 10s)                                | WebSockets can be added later                                                             |
| Deployment       | Local dev only; optionally Vercel + Fly.io if a demo URL is needed | Prototype                                                                                 |

---

## 5. Data Model

The schema below is the SQL foundation. Field naming follows snake_case. Every table has `id` (UUID or autoincrement int), `created_at`, `updated_at` unless noted.

### `customers`

| Column        | Type        | Notes                               |
| ------------- | ----------- | ----------------------------------- |
| id            | TEXT (UUID) | PK                                  |
| name          | TEXT        |                                     |
| email         | TEXT        | Unique, indexed                     |
| phone         | TEXT        | Optional                            |
| plan          | TEXT        | e.g. `free`, `pro`, `enterprise`    |
| mrr           | REAL        | Monthly recurring revenue, nullable |
| signup_date   | DATETIME    |                                     |
| metadata_json | TEXT        | JSON blob for extensibility         |
| created_at    | DATETIME    |                                     |
| updated_at    | DATETIME    |                                     |

### `agents`

| Column     | Type        | Notes                            |
| ---------- | ----------- | -------------------------------- |
| id         | TEXT (UUID) | PK                               |
| name       | TEXT        |                                  |
| email      | TEXT        | Unique                           |
| role       | TEXT        | `agent`, `senior_agent`, `admin` |
| avatar_url | TEXT        | Optional                         |
| active     | BOOLEAN     | Default true                     |
| created_at | DATETIME    |                                  |

### `conversations`

| Column      | Type        | Notes                                                                |
| ----------- | ----------- | -------------------------------------------------------------------- |
| id          | TEXT (UUID) | PK                                                                   |
| customer_id | TEXT        | FK → customers.id                                                    |
| subject     | TEXT        |                                                                      |
| status      | TEXT        | `open`, `pending_customer`, `pending_internal`, `resolved`, `closed` |
| priority    | TEXT        | `low`, `normal`, `high`, `urgent`                                    |
| channel     | TEXT        | `email`, `chat`, `in_app` (prototype channels)                       |
| assignee_id | TEXT        | FK → agents.id, nullable                                             |
| sla_due_at  | DATETIME    | Optional, computed on create                                         |
| resolved_at | DATETIME    | Nullable                                                             |
| closed_at   | DATETIME    | Nullable                                                             |
| created_at  | DATETIME    |                                                                      |
| updated_at  | DATETIME    |                                                                      |

### `messages`

| Column          | Type        | Notes                                            |
| --------------- | ----------- | ------------------------------------------------ |
| id              | TEXT (UUID) | PK                                               |
| conversation_id | TEXT        | FK → conversations.id, indexed                   |
| author_type     | TEXT        | `customer`, `agent`, `system` (AI added later)   |
| author_id       | TEXT        | FK → customers.id or agents.id depending on type |
| body            | TEXT        | Plain text or basic markdown                     |
| internal_note   | BOOLEAN     | True if note, false if reply to customer         |
| created_at      | DATETIME    |                                                  |

### `tags`

| Column | Type        | Notes    |
| ------ | ----------- | -------- |
| id     | TEXT (UUID) | PK       |
| name   | TEXT        | Unique   |
| color  | TEXT        | Hex code |

### `conversation_tags`

Join table: `conversation_id`, `tag_id`. Composite PK.

### `actions`

This is the manual version of what will later become the AI action layer. Each action is recorded but in the prototype it's a stub — clicking "Issue Refund" creates an audit row, does not actually charge anything.

| Column              | Type        | Notes                                                                               |
| ------------------- | ----------- | ----------------------------------------------------------------------------------- |
| id                  | TEXT (UUID) | PK                                                                                  |
| conversation_id     | TEXT        | FK → conversations.id                                                               |
| invoked_by_agent_id | TEXT        | FK → agents.id                                                                      |
| action_type         | TEXT        | `issue_refund`, `reset_password`, `extend_trial`, `cancel_subscription`, `escalate` |
| inputs_json         | TEXT        | JSON of action inputs (e.g. `{"amount": 25, "reason": "billing error"}`)            |
| result              | TEXT        | `success`, `failure` (always `success` in prototype stubs)                          |
| created_at          | DATETIME    |                                                                                     |

### `macros`

Saved reply templates.

| Column              | Type        | Notes                                                                   |
| ------------------- | ----------- | ----------------------------------------------------------------------- |
| id                  | TEXT (UUID) | PK                                                                      |
| name                | TEXT        |                                                                         |
| body                | TEXT        | Supports `{{customer.name}}`, `{{customer.plan}}` variable substitution |
| created_by_agent_id | TEXT        | FK → agents.id                                                          |
| created_at          | DATETIME    |                                                                         |

### `audit_log`

Append-only log of consequential events.

| Column        | Type        | Notes                                                                                                                                        |
| ------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| id            | TEXT (UUID) | PK                                                                                                                                           |
| actor_type    | TEXT        | `agent`, `system`                                                                                                                            |
| actor_id      | TEXT        |                                                                                                                                              |
| event_type    | TEXT        | `conversation.created`, `conversation.status_changed`, `conversation.assigned`, `action.invoked`, `message.sent`, `agent.role_changed`, etc. |
| target_type   | TEXT        | `conversation`, `agent`, etc.                                                                                                                |
| target_id     | TEXT        |                                                                                                                                              |
| metadata_json | TEXT        | Event-specific details                                                                                                                       |
| created_at    | DATETIME    |                                                                                                                                              |

---

## 6. API Endpoints

Backend exposes a REST API. JSON only. The frontend talks exclusively to this.

### Conversations

- `GET /api/conversations` — list with filters: `status`, `assignee_id`, `priority`, `tag`, `customer_id`, `q` (text search on subject and message body). Supports pagination (`limit`, `offset`).
- `GET /api/conversations/:id` — single conversation with messages, customer, tags, recent actions.
- `POST /api/conversations` — create new conversation (used by the simulated-inbound admin tool).
- `PATCH /api/conversations/:id` — update status, priority, assignee, subject, add/remove tags.
- `POST /api/conversations/:id/messages` — add a message (agent reply or internal note).
- `POST /api/conversations/:id/actions` — invoke an action stub.

### Customers

- `GET /api/customers/:id` — full profile + summary stats (open conversations count, lifetime conversations count, total refunded, etc.).
- `GET /api/customers` — list with search (used for linking new conversations).
- `GET /api/customers/:id/conversations` — conversation history for that customer.

### Agents

- `GET /api/agents` — list active agents.
- `GET /api/agents/me` — currently selected agent (hardcoded via header or session for prototype).

### Macros

- `GET /api/macros` — list all macros.
- `POST /api/macros` — create.
- `DELETE /api/macros/:id` — delete.

### Tags

- `GET /api/tags` — list all.
- `POST /api/tags` — create.

### Dashboard

- `GET /api/dashboard/stats` — counts by status, by assignee, today's resolved count, average resolution time.

### Audit

- `GET /api/audit?conversation_id=...&limit=...` — recent audit entries.

---

## 7. Core Screens

### 7.1 Inbox (Main Workspace)

Three-column layout:

**Left: Conversation list**

- Filterable by status, assignee (Me / Unassigned / All), priority, tag.
- Sortable by newest, oldest, priority, SLA due.
- Each item shows: customer name, subject, channel icon, snippet of last message, time, unread indicator, priority dot, tag pills.
- Search bar at top (text search across subjects and message bodies).
- Keyboard navigation (J/K to move, Enter to open).

**Center: Conversation detail**

- Header: customer name (clickable → opens customer panel), subject, status dropdown, priority dropdown, assignee dropdown, tag editor.
- Message thread: chronological. Customer messages on the left, agent replies on the right (or distinct visual treatment). Internal notes have distinct background and an "Internal" badge.
- Reply composer at bottom:
  - Tabs: "Reply" (sends to customer) / "Internal note" (visible only to agents).
  - Macro selector (filterable dropdown).
  - Send button + keyboard shortcut (Cmd+Enter).
  - Action buttons inline: "Issue Refund", "Reset Password", "Extend Trial", "Escalate". Each opens a tiny modal for inputs (e.g. refund amount), then logs to `actions` table on confirm.

**Right: Customer context panel** (collapsible)

- Customer name, email, phone, plan, MRR.
- Signup date, lifetime value summary.
- Open conversations count, total conversations count.
- Recent activity (last 5 conversations as links).
- Recent actions taken (refunds, trial extensions).
- "View full profile" link.

### 7.2 Customer Detail Page

A dedicated route for full customer view. Shows:

- All conversations (sortable).
- All actions ever invoked against this customer.
- Tags applied across conversations.
- Editable customer fields (admin only).

### 7.3 Dashboard

Simple operational view (admin/team-lead role).

- Open / pending / resolved counts.
- Open conversations by priority (small bar chart).
- Open conversations per agent.
- Average resolution time (last 7 days).
- Actions invoked in last 7 days, broken down by type.

### 7.4 Macros / Settings

CRUD for macros, tags, and agents (admin only).

### 7.5 Simulated Inbound (Admin Tool)

Since real email/chat ingestion is out of scope, an admin page lets the demo'er manually create inbound messages:

- Pick or create a customer.
- Pick channel (`email`, `chat`, `in_app`).
- Enter subject + body.
- Submit → creates a new conversation in `open` status, unassigned.

This simulates inbound traffic for demos and testing.

### 7.6 Audit Log Page (Admin)

Searchable, filterable audit log view.

---

## 8. Key Flows

### Flow 1: New ticket arrives → agent resolves

1. Simulated inbound creates conversation in `open` status.
2. Conversation appears in unassigned queue.
3. Agent clicks → opens detail.
4. Agent reads customer message and context panel.
5. Agent assigns to themselves (dropdown).
6. Agent composes reply (optionally using a macro), sends.
7. Status auto-transitions to `pending_customer`.
8. Customer "replies" (simulated inbound again) → status auto-transitions back to `open`.
9. Agent invokes an action (e.g. issue refund $25) → modal → confirm → row written to `actions` + `audit_log`.
10. Agent marks resolved → status becomes `resolved`, `resolved_at` stamped.
11. After 72 hours of no reply, auto-close transitions to `closed` (background job, runs hourly in prototype).

### Flow 2: Internal note + handoff

1. Agent opens conversation.
2. Switches reply composer to "Internal note" tab.
3. @mentions another agent (basic mention parsing: `@name`).
4. Adds note → saved as `messages` row with `internal_note=true`.
5. Mentioned agent gets a notification in the inbox header (badge count). For prototype, this is just a count from a `notifications` table or computed on the fly.

### Flow 3: Reopening

1. Resolved conversation gets a new customer message (within 14 days).
2. Status auto-transitions to `open`, `resolved_at` cleared.
3. Audit log entry: `conversation.reopened`.

---

## 9. Acceptance Criteria

- All endpoints in §6 implemented and tested with at least one happy-path test each.
- All screens in §7 implemented with seed data (see §10).
- All status transitions correctly fire audit log entries.
- Conversation list loads in under 500ms with 500 seeded conversations.
- Conversation detail loads in under 300ms.
- Keyboard shortcuts work: `J/K` to navigate list, `Enter` to open, `Cmd+Enter` to send, `Esc` to close modals.
- Action stubs (refund etc.) successfully write to `actions` and `audit_log` tables.
- Macro variable substitution works for at least `{{customer.name}}` and `{{customer.plan}}`.
- A single command (`npm run dev` or equivalent) starts both server and client.

---

## 10. Seed Data

The prototype must seed the database on first run with realistic-feeling data:

- **5 agents** with varied roles (3 agents, 1 senior agent, 1 admin).
- **30 customers** with varied plans, MRR, signup dates.
- **150 conversations** in varied states (50 open, 30 pending_customer, 20 pending_internal, 30 resolved, 20 closed) across different channels and priorities.
- **~600 messages** distributed across conversations (4 average per conversation).
- **40 actions** logged historically.
- **10 macros** covering common reply scenarios (refund acknowledgment, password reset instructions, trial extension confirmation, escalation handoff, etc.).
- **8 tags** (`billing`, `bug`, `feature_request`, `vip`, `urgent`, `refund`, `auth`, `onboarding`).
- **Full audit log** for all seeded conversations.

Seed data should look realistic — use plausible names, varied message lengths, and a believable distribution of statuses and priorities.

---

## 11. Non-Functional Requirements

| Area                            | Target                                                      |
| ------------------------------- | ----------------------------------------------------------- |
| Page load (conversation list)   | ≤ 500ms with 500 conversations                              |
| Page load (conversation detail) | ≤ 300ms                                                     |
| API p95 latency                 | ≤ 200ms                                                     |
| Code organization               | Clean separation: server/ and client/ directories           |
| Database migrations             | Single `init.sql` or programmatic schema setup on first run |
| Test coverage                   | Smoke tests on each API endpoint; not full coverage         |

---

## 12. Repo Structure

```
resolvr-prototype/
├── README.md
├── package.json                 # root scripts (concurrently runs server + client)
├── server/
│   ├── package.json
│   ├── index.js                 # Express bootstrap
│   ├── db.js                    # SQLite setup, schema, seed
│   ├── routes/
│   │   ├── conversations.js
│   │   ├── customers.js
│   │   ├── agents.js
│   │   ├── macros.js
│   │   ├── tags.js
│   │   ├── audit.js
│   │   └── dashboard.js
│   └── lib/
│       ├── audit.js             # helper to write audit log entries
│       └── seed.js
└── client/
    ├── package.json
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api.js               # fetch wrappers
        ├── components/
        │   ├── Sidebar.jsx
        │   ├── ConversationList.jsx
        │   ├── ConversationDetail.jsx
        │   ├── MessageThread.jsx
        │   ├── ReplyComposer.jsx
        │   ├── CustomerPanel.jsx
        │   ├── ActionModal.jsx
        │   ├── MacroPicker.jsx
        │   └── Dashboard.jsx
        ├── pages/
        │   ├── Inbox.jsx
        │   ├── CustomerDetail.jsx
        │   ├── DashboardPage.jsx
        │   ├── Settings.jsx
        │   └── SimulatedInbound.jsx
        └── styles/
            └── index.css
```

---

## 13. Design Notes for AI Layer (Forward-Looking)

These notes are intentionally vague in this doc — they exist to make sure the prototype doesn't paint into a corner. When AI features are added in v1, the following extension points should already exist:

- `author_type` enum has room for `ai` value.
- `actions` table records `invoked_by_agent_id`; later this becomes `invoked_by_actor_id` with `invoked_by_actor_type` distinguishing agent vs. AI.
- `audit_log.actor_type` already has room for `ai` and `system`.
- Conversation lifecycle states unchanged when AI is the assignee.
- Knowledge base table not yet built — to be added in v1 when retrieval is needed.
- No constraint that ties a conversation to a single human; an AI agent can be the assignee.

---

## 14. Open Decisions

1. **TypeScript or plain JS?** Recommend TypeScript on both server and client for a prototype that will evolve into production code.
2. **Auth model for the prototype?** Recommend a simple hardcoded "current agent" header with a dropdown switcher in the UI for demos. Real auth comes in v1.
3. **Visual design baseline?** Recommend Linear / Plain / Pylon as references for a refined, dense, agent-workspace aesthetic.
4. **Hosting for demo URL?** Optional. If needed, frontend → Vercel, backend → Fly.io with persistent SQLite volume.

---

## 15. What This Document Is Not

- Not a final spec for production. It's a prototype scoping doc.
- Not an exhaustive list of edge cases. Focus is on happy paths.
- Not the AI product. AI explicitly out of scope; v1 spec covers that.

---

_End of document._
