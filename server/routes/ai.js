import express from "express";
import { query } from "../db.js";

export const router = express.Router();

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`;

async function loadContext(conversationId) {
  const convRes = await query("SELECT * FROM conversations WHERE id = $1", [conversationId]);
  const conv = convRes.rows[0];
  if (!conv) return null;
  const customerRes = await query(
    "SELECT id, name, email, plan, mrr FROM customers WHERE id = $1",
    [conv.customer_id],
  );
  const messagesRes = await query(
    `SELECT author_type, body, internal_note, created_at
     FROM messages WHERE conversation_id = $1
     ORDER BY created_at ASC`,
    [conversationId],
  );
  return { conv, customer: customerRes.rows[0] || null, messages: messagesRes.rows };
}

function buildPrompt({ conv, customer, messages }) {
  const transcript = messages
    .filter((m) => !m.internal_note)
    .map((m) => `[${m.author_type.toUpperCase()}] ${m.body}`)
    .join("\n\n");
  const notes = messages
    .filter((m) => m.internal_note)
    .map((m) => `- ${m.body}`)
    .join("\n");

  return `You are a senior customer support agent at Resolva, an inventory-management SaaS for small businesses. Draft a single reply to the customer's latest message.

CUSTOMER
Name: ${customer?.name || "Unknown"}
Email: ${customer?.email || ""}
Plan: ${customer?.plan || "unknown"}${
    customer?.mrr ? ` (${customer.mrr} MRR)` : ""
  }

CONVERSATION
Subject: ${conv.subject}
Status: ${conv.status}
Priority: ${conv.priority}

TRANSCRIPT
${transcript || "(no messages yet)"}
${
  notes
    ? `\nINTERNAL NOTES (for context only — do not reference)\n${notes}`
    : ""
}

GUIDELINES
- Address the customer by first name.
- Be warm, concise, and specific. Match the tone of a real support agent — no marketing fluff.
- If the issue is resolvable, give clear next steps. If you need info, ask one or two pointed questions.
- Do not invent product features. Do not promise refunds, SLAs, or escalations unless the transcript already mentions them.
- Sign off with "— Resolva Support".
- Output ONLY the reply body. No subject line, no preamble, no commentary.`;
}

router.post("/conversations/:id/suggest-reply", async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res
      .status(503)
      .json({
        error: "ai_not_configured",
        message: "Failed to suggest reply.",
      });
  }

  const ctx = await loadContext(req.params.id);
  if (!ctx) return res.status(404).json({ error: "not_found" });

  const prompt = buildPrompt(ctx);

  let upstream;
  try {
    upstream = await fetch(
      `${GEMINI_URL}&key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 600 },
        }),
      }
    );
  } catch (e) {
    return res
      .status(502)
      .json({ error: "upstream_unreachable", message: e.message });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return res
      .status(502)
      .json({
        error: "upstream_error",
        status: upstream.status,
        detail: detail.slice(0, 500),
      });
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const json = line.slice(5).trim();
        if (!json || json === "[DONE]") continue;
        try {
          const obj = JSON.parse(json);
          const text =
            obj?.candidates?.[0]?.content?.parts
              ?.map((p) => p.text)
              .filter(Boolean)
              .join("") || "";
          if (text) res.write(text);
        } catch {
          // ignore malformed chunk
        }
      }
    }
    res.end();
  } catch (e) {
    res.write(`\n\n[stream-error: ${e.message}]`);
    res.end();
  }
});
