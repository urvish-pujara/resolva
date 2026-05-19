import { v4 as uuid } from 'uuid';
import { initSchema, isSeeded, withTransaction, pool } from '../db.js';
import { writeAudit } from './audit.js';

const AGENT_DATA = [
  { name: 'Alex Tran', email: 'alex@resolvr.dev', role: 'admin' },
  { name: 'Priya Shah', email: 'priya@resolvr.dev', role: 'senior_agent' },
  { name: 'Jordan Kim', email: 'jordan@resolvr.dev', role: 'agent' },
  { name: 'Sam Diaz', email: 'sam@resolvr.dev', role: 'agent' },
  { name: 'Riley Chen', email: 'riley@resolvr.dev', role: 'agent' },
];

const FIRST_NAMES = ['Aria', 'Ben', 'Cleo', 'Dana', 'Eli', 'Faye', 'Gus', 'Hana', 'Ivan', 'June', 'Kai', 'Lia', 'Milo', 'Nina', 'Owen', 'Pia', 'Quinn', 'Rosa', 'Theo', 'Uma', 'Vera', 'Wes', 'Xian', 'Yara', 'Zane', 'Maya', 'Leo', 'Iris', 'Noor', 'Reza'];
const LAST_NAMES = ['Patel', 'Nguyen', 'Garcia', 'Smith', 'Johnson', 'Lee', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Robinson', 'Clark', 'Lewis', 'Walker', 'Hall', 'Young', 'King', 'Wright', 'Lopez', 'Hill', 'Scott'];
const PLANS = ['free', 'free', 'pro', 'pro', 'pro', 'enterprise'];
const CHANNELS = ['email', 'email', 'email', 'chat', 'in_app'];
const PRIORITIES = ['low', 'normal', 'normal', 'normal', 'high', 'urgent'];

const SUBJECTS = [
  'Barcode scanner not pairing with iPad',
  'QuickBooks Online sync failed last night',
  'Stock counts off after cycle count import',
  'Low-stock alerts firing for archived items',
  'Cannot print QR labels to Dymo 450',
  'Warehouse transfer stuck in pending',
  'Custom field "Lot #" missing on mobile app',
  'Need help bulk-importing 5k SKUs from Excel',
  'Zebra scanner stopped reading EAN-13 codes',
  'Photo uploads failing on Android app',
  'How do I set reorder points per warehouse?',
  'Multi-warehouse permissions not working',
  'API returning 429 on inventory fetch',
  'Webhook stopped firing on stock_changed event',
  'Need to merge duplicate SKUs after migration',
  'Lot tracking not appearing in reports',
  'Cannot delete a warehouse with archived items',
  'Upgrading from Free → Pro — keep my SKU history?',
  'Receipt missing from email after renewal',
  'Workspace name change request — rebrand',
  'Bug: total quantity shows NaN in CSV export',
  'Lost 2FA — need to recover admin account',
  'Mobile app crashing when scanning 100+ items',
  'Reports with >50k SKUs timing out',
  'Cancellation — moving to Fishbowl',
  'Want to reactivate canceled account with old data',
  'GDPR data deletion request',
  'Security question: encryption at rest for SKU data',
  'Invoice address change',
  'Tax ID needed on invoices',
];

const CUSTOMER_BODIES = [
  "We bought 4 new Zebra TC21 scanners and none of them will pair with the iPad app. Tried a Bluetooth reset already.",
  "QuickBooks sync ran overnight and failed silently. Now our books are off by ~$8k. Can you push it again?",
  "After importing a 12k row cycle count CSV, half the SKU quantities are wrong. Looks like units got swapped.",
  "Getting low-stock email alerts every morning for ~200 items we archived last month. They shouldn't be firing anymore.",
  "Trying to print QR labels to my Dymo 450 and it just prints blank. Worked fine last week.",
  "I started a warehouse-to-warehouse transfer Monday and it's been 'pending' for 3 days. 250 items in limbo.",
  "Our 'Lot #' custom field is fine on web but completely missing in the iOS app. Field techs can't see it.",
  "We're migrating from Cin7. I have 5,200 SKUs in an Excel file. Best way to bulk import them with all custom fields?",
  "Zebra DS2208 scanner stopped reading EAN-13 barcodes today. UPC and Code 128 still work fine.",
  "Photo uploads keep failing on Android — Samsung S23. 'Upload failed, try again' on every item.",
  "How do I set a different reorder point per warehouse? Our LA warehouse runs hotter than our NJ one.",
  "Sub-user only assigned to Warehouse B can still see Warehouse A inventory. Permissions seem broken.",
  "Our integration is getting hit with 429s pulling inventory every hour. Limit seems much lower than docs say.",
  "Webhook for stock_changed stopped firing around 4pm yesterday. No errors on our end.",
  "We have ~80 duplicate SKUs after a botched import. Need a way to merge them and keep history.",
  "We enabled lot tracking last month but no lot info shows in our usage reports. Custom field shows on items though.",
  "Trying to delete an old warehouse but it still has archived items in it. Won't let me delete.",
  "About to upgrade Free → Pro. Just want to confirm — do I keep all my existing SKU and quantity history?",
  "Got charged for the Pro renewal but no receipt arrived. Need it for our books.",
  "We rebranded from 'TestCo' to 'Ridgeline Outfitters'. Can you rename the workspace?",
  "Bug — quantity columns export as 'NaN' in CSV downloads when an item has a custom unit. Started ~3 days ago.",
  "I'm the admin and I lost my phone with the 2FA codes. No one else has admin access. Help!",
  "Mobile app crashes for our warehouse team after scanning 100+ items in a session. Have to force-quit and reopen.",
  "Our inventory has grown to 65k SKUs and the quantity-by-warehouse report just spins forever.",
  "Sadly canceling — Fishbowl had better manufacturing features. Please make sure billing stops at end of cycle.",
  "I canceled in November but want to come back. Is my old SKU data and history still there?",
  "Per GDPR I'd like all my personal data removed from your systems. Please confirm in writing what's deleted.",
  "Our IT team needs to know — is SKU and inventory data encrypted at rest? With what cipher?",
  "Please update the billing address on our next invoice. New details attached.",
  "Our finance team needs the company tax/VAT ID listed on invoices going forward.",
];

const AGENT_BODIES = [
  "Hi! Thanks for reaching out — taking a look right now.",
  "I've kicked off a fresh sync on my end. Should be reflected in the next 5-10 minutes.",
  "Could you send me the SKU ID and a screenshot? That'll help me debug.",
  "I've regenerated the labels for those items — try printing again now.",
  "Looped in our integrations team. We'll get back to you within an hour.",
  "Confirmed and extended your trial by 14 days. Happy evaluating!",
  "Thanks for the patience — should be sorted now. Let me know if you still see it.",
  "Following up. Is this still an issue on your end?",
  "Closing this for now since I haven't heard back — feel free to reopen anytime.",
  "Sorry for the trouble. Escalating this to our senior support team.",
];

const TAG_DATA = [
  { name: 'sku-sync', color: '#0ea5e9' },
  { name: 'bug', color: '#ef4444' },
  { name: 'feature-request', color: '#8b5cf6' },
  { name: 'vip', color: '#ec4899' },
  { name: 'urgent', color: '#dc2626' },
  { name: 'barcode-scan', color: '#f97316' },
  { name: 'qbo-integration', color: '#10b981' },
  { name: 'mobile-app', color: '#f59e0b' },
];

const MACRO_DATA = [
  { name: 'Resync confirmation', body: "Hi {{customer.name}},\n\nI've kicked off a fresh sync on your account. Everything should be updated within 5-10 minutes. Let me know if anything still looks off." },
  { name: 'Label format guide', body: "Hi {{customer.name}},\n\nWe support QR, Code 128, and EAN/UPC label formats. Make sure your printer is set to 'label' mode (not 'document'). Full guide in your dashboard under Settings → Labels." },
  { name: 'Scanner pairing steps', body: "Hi {{customer.name}},\n\nTo pair a Bluetooth scanner: 1) put the scanner in pairing mode (hold trigger ~10s), 2) open Settings → Devices in our app, 3) tap Pair. If it fails, fully unpair from iOS Bluetooth settings first and try again." },
  { name: 'QBO sync troubleshooting', body: "Hi {{customer.name}},\n\nQuickBooks sync issues are usually a stale OAuth token. Try Settings → Integrations → QuickBooks → Reconnect. That fixes about 90% of cases. Let me know if you still see errors after." },
  { name: 'Bulk import template', body: "Hi {{customer.name}},\n\nAttaching our bulk import template. Required columns: name, SKU, quantity, unit. Custom fields go in the extra columns matching your field names exactly." },
  { name: 'Multi-warehouse setup', body: "Hi {{customer.name}},\n\nHappy to walk through multi-warehouse setup. Quick steps: create warehouses under Settings → Locations, then assign team members to specific warehouses for permissions." },
  { name: 'Trial extension confirmation', body: "Hi {{customer.name}},\n\nGood news — I've extended your trial by 14 days. You're all set on the {{customer.plan}} plan for now. Reach out anytime with questions." },
  { name: 'Escalation handoff', body: "Hi {{customer.name}},\n\nThanks for your patience. I've escalated this to our senior team. Someone will follow up within 1 business day." },
  { name: 'Closing — no reply', body: "Hi {{customer.name}},\n\nI haven't heard back so I'm going to close this out for now. Feel free to reply anytime to reopen this conversation." },
  { name: 'Welcome — Pro upgrade', body: "Welcome to Pro, {{customer.name}}! All your SKU history, custom fields, and warehouse data carry over. Enjoy the new features." },
];

const ACTION_TYPES = ['resync_inventory', 'regenerate_labels', 'reset_scanner_pairing', 'extend_trial', 'escalate'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}
function isoDaysAgo(days, jitterHours = 24) {
  const ms = Date.now() - days * 86400000 - Math.random() * jitterHours * 3600000;
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

export async function seedAll() {
  if (await isSeeded()) {
    return { skipped: true };
  }
  await withTransaction(async (client) => {
    const agents = await seedAgents(client);
    const customers = await seedCustomers(client);
    const tags = await seedTags(client);
    await seedMacros(client, agents);
    const conversations = await seedConversations(client, { agents, customers, tags });
    await seedMessagesAndActions(client, { agents, conversations });
  });
  return { skipped: false };
}

async function seedAgents(client) {
  const out = [];
  for (const a of AGENT_DATA) {
    const id = uuid();
    await client.query(
      'INSERT INTO agents (id, name, email, role, active) VALUES ($1, $2, $3, $4, 1)',
      [id, a.name, a.email, a.role],
    );
    out.push({ id, ...a });
  }
  return out;
}

async function seedCustomers(client) {
  const out = [];
  for (let i = 0; i < 30; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 7) % LAST_NAMES.length];
    const name = `${first} ${last}`;
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`;
    const plan = pick(PLANS);
    const mrr = plan === 'free' ? 0 : plan === 'pro' ? 49 + Math.round(Math.random() * 200) : 499 + Math.round(Math.random() * 1500);
    const signup = isoDaysAgo(Math.floor(Math.random() * 700) + 5);
    const id = uuid();
    await client.query(
      `INSERT INTO customers (id, name, email, phone, plan, mrr, signup_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, name, email, null, plan, mrr, signup, signup, signup],
    );
    out.push({ id, name, email, plan, mrr, signup_date: signup });
  }
  return out;
}

async function seedTags(client) {
  const out = [];
  for (const t of TAG_DATA) {
    const id = uuid();
    await client.query('INSERT INTO tags (id, name, color) VALUES ($1, $2, $3)', [id, t.name, t.color]);
    out.push({ id, ...t });
  }
  return out;
}

async function seedMacros(client, agents) {
  for (const m of MACRO_DATA) {
    await client.query(
      'INSERT INTO macros (id, name, body, created_by_agent_id, created_at) VALUES ($1, $2, $3, $4, $5)',
      [uuid(), m.name, m.body, pick(agents).id, isoDaysAgo(Math.random() * 60 + 5)],
    );
  }
}

async function seedConversations(client, { agents, customers, tags }) {
  const statusDistribution = [
    ...Array(50).fill('open'),
    ...Array(30).fill('pending_customer'),
    ...Array(20).fill('pending_internal'),
    ...Array(30).fill('resolved'),
    ...Array(20).fill('closed'),
  ];

  const conversations = [];
  for (let i = 0; i < statusDistribution.length; i++) {
    const id = uuid();
    const status = statusDistribution[i];
    const customer = pick(customers);
    const priority = pick(PRIORITIES);
    const channel = pick(CHANNELS);
    const subjectIdx = i % SUBJECTS.length;
    const subject = SUBJECTS[subjectIdx];

    const isOpen = status === 'open' || status === 'pending_customer' || status === 'pending_internal';
    const assignee = isOpen && Math.random() > 0.2 ? pick(agents) : (status === 'resolved' || status === 'closed' ? pick(agents) : null);

    const createdDaysAgo = status === 'closed' ? Math.random() * 60 + 10 : status === 'resolved' ? Math.random() * 14 + 1 : Math.random() * 10;
    const created_at = isoDaysAgo(createdDaysAgo);
    const updated_at = isoDaysAgo(Math.max(0, createdDaysAgo - Math.random() * 3));
    const resolved_at = status === 'resolved' || status === 'closed' ? isoDaysAgo(Math.max(0, createdDaysAgo - Math.random() * 5)) : null;
    const closed_at = status === 'closed' ? isoDaysAgo(Math.max(0, createdDaysAgo - Math.random() * 3)) : null;
    const sla_hours = priority === 'urgent' ? 1 : priority === 'high' ? 4 : priority === 'normal' ? 24 : 72;
    const slaMs = new Date(created_at).getTime() + sla_hours * 3600000;
    const sla_due_at = new Date(slaMs).toISOString().slice(0, 19).replace('T', ' ');

    await client.query(
      `INSERT INTO conversations (id, customer_id, subject, status, priority, channel, assignee_id, sla_due_at, resolved_at, closed_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, customer.id, subject, status, priority, channel, assignee?.id || null, sla_due_at, resolved_at, closed_at, created_at, updated_at],
    );

    const tagCount = Math.random() < 0.4 ? 0 : Math.random() < 0.7 ? 1 : 2;
    for (const t of pickN(tags, tagCount)) {
      await client.query('INSERT INTO conversation_tags (conversation_id, tag_id) VALUES ($1, $2)', [id, t.id]);
    }

    conversations.push({ id, customer_id: customer.id, customer, status, priority, channel, assignee_id: assignee?.id || null, created_at, subject });

    await writeAudit({
      actor_type: 'system',
      actor_id: null,
      event_type: 'conversation.created',
      target_type: 'conversation',
      target_id: id,
      metadata: { subject, channel, priority },
      created_at,
    }, client);
    if (assignee) {
      await writeAudit({
        actor_type: 'agent',
        actor_id: assignee.id,
        event_type: 'conversation.assigned',
        target_type: 'conversation',
        target_id: id,
        metadata: { assignee_id: assignee.id },
        created_at: updated_at,
      }, client);
    }
    if (resolved_at) {
      await writeAudit({
        actor_type: 'agent',
        actor_id: assignee?.id || null,
        event_type: 'conversation.status_changed',
        target_type: 'conversation',
        target_id: id,
        metadata: { from: 'open', to: 'resolved' },
        created_at: resolved_at,
      }, client);
    }
    if (closed_at) {
      await writeAudit({
        actor_type: 'system',
        actor_id: null,
        event_type: 'conversation.status_changed',
        target_type: 'conversation',
        target_id: id,
        metadata: { from: 'resolved', to: 'closed' },
        created_at: closed_at,
      }, client);
    }
  }
  return conversations;
}

async function seedMessagesAndActions(client, { agents, conversations }) {
  let actionsRemaining = 40;

  for (const c of conversations) {
    const messageCount = 2 + Math.floor(Math.random() * 6);
    let lastTime = new Date(c.created_at).getTime();
    for (let i = 0; i < messageCount; i++) {
      const isCustomer = i % 2 === 0;
      const body = isCustomer ? CUSTOMER_BODIES[Math.floor(Math.random() * CUSTOMER_BODIES.length)] : AGENT_BODIES[Math.floor(Math.random() * AGENT_BODIES.length)];
      const internal_note = !isCustomer && Math.random() < 0.15 ? 1 : 0;
      lastTime += (15 + Math.random() * 240) * 60000;
      const created_at = new Date(lastTime).toISOString().slice(0, 19).replace('T', ' ');
      const authorId = isCustomer ? c.customer_id : (c.assignee_id || pick(agents).id);
      await client.query(
        `INSERT INTO messages (id, conversation_id, author_type, author_id, body, internal_note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuid(), c.id, isCustomer ? 'customer' : 'agent', authorId, body, internal_note, created_at],
      );

      if (!isCustomer && !internal_note) {
        await writeAudit({
          actor_type: 'agent',
          actor_id: authorId,
          event_type: 'message.sent',
          target_type: 'conversation',
          target_id: c.id,
          metadata: { length: body.length },
          created_at,
        }, client);
      }
    }

    if (actionsRemaining > 0 && Math.random() < 0.3 && c.assignee_id) {
      const action_type = pick(ACTION_TYPES);
      const inputs = action_type === 'resync_inventory' ? { scope: pick(['single_sku', 'warehouse', 'full']), reason: 'sync drift' }
        : action_type === 'regenerate_labels' ? { format: pick(['qr', 'barcode_128', 'barcode_ean']), count: Math.round(Math.random() * 200) + 10 }
        : action_type === 'reset_scanner_pairing' ? { device_id: `dev_${Math.random().toString(36).slice(2, 8)}` }
        : action_type === 'extend_trial' ? { days: 14 }
        : { reason: 'requires senior_agent' };
      const created_at = isoDaysAgo(Math.random() * 14);
      const actionId = uuid();
      await client.query(
        `INSERT INTO actions (id, conversation_id, invoked_by_agent_id, action_type, inputs_json, result, created_at)
         VALUES ($1, $2, $3, $4, $5, 'success', $6)`,
        [actionId, c.id, c.assignee_id, action_type, JSON.stringify(inputs), created_at],
      );
      await writeAudit({
        actor_type: 'agent',
        actor_id: c.assignee_id,
        event_type: 'action.invoked',
        target_type: 'conversation',
        target_id: c.id,
        metadata: { action_type, inputs, action_id: actionId },
        created_at,
      }, client);
      actionsRemaining--;
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await initSchema();
  const result = await seedAll();
  if (result.skipped) {
    console.log('DB already seeded — skipping. Truncate tables to re-seed.');
  } else {
    console.log('Seed complete.');
  }
  await pool.end();
}
