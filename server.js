// server.js
import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

const app = express();

/**
 * ----------------------------
 * Config
 * ----------------------------
 */
const PORT = process.env.PORT || 3000;

// CSV of allowed origins; defaults to your WP hostnames.
// For initial troubleshooting, you can temporarily set ALLOWED_ORIGINS="*"
// but switch back to explicit domains afterwards.
const allowedOrigins =
  (process.env.ALLOWED_ORIGINS &&
    process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)) ||
  ['https://aielevate.xyz', 'https://www.aielevate.xyz'];

// Minimal debug flag to log requests and origins in Render logs
const DEBUG = /^true$/i.test(process.env.DEBUG || '');

/**
 * ----------------------------
 * Middleware
 * ----------------------------
 */
app.use(express.json({ limit: '1mb' }));

// Custom CORS handler (handles preflight)
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (DEBUG) {
    console.log(
      `[DEBUG] ${new Date().toISOString()} ${req.method} ${req.path} origin=${origin || 'NO-ORIGIN'}`
    );
  }

  // Allow explicit origins or "*" if you configured that (only for short-term debugging!)
  const allowAll = allowedOrigins.length === 1 && allowedOrigins[0] === '*';
  if (allowAll) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  } else if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Vary', 'Origin'); // cache-friendly for CDNs
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-APP-KEY');
  // If you ever need cookies/auth from browser, also set:
  // res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204); // Preflight OK
  }
  next();
});

/**
 * ----------------------------
 * Health & Root
 * ----------------------------
 */
app.get('/', (_req, res) =>
  res.json({ status: 'ok', service: 'pm-agent', root: true, time: new Date().toISOString() })
);

app.get('/ping', (_req, res) =>
  res.json({ status: 'ok', time: new Date().toISOString() })
);

/**
 * ----------------------------
 * AI PM Agent Endpoint
 * ----------------------------
 */
app.post('/api/pm-agent', async (req, res) => {
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages[] required' });
    }

    // System prompt tuned for AI in Project Management
    const SYSTEM_PROMPT = `
You are the **AI PM Agent**: expert in applying AI to project management.
Answer concisely and actionably first. When useful, add:
- steps/checklists, brief rationale, risks/trade-offs
- KPIs/OKRs, timelines, ownership (RACI), and tool examples (Jira, SAP, SLAs)
- code/config snippets only when requested or clearly helpful
Do not reveal chain-of-thought; just final answers with brief reasoning when needed.
Locale: Europe/Amsterdam when dates/times are relevant.
`;

    const payload = {
      model: 'gpt-4o-mini', // use a fast, cost-effective model; swap to your preference
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'system', content: 'Org context: AVL/TriFin (NL). Domain: SAP/Jira PM.' },
        ...messages.filter(m => m && typeof m === 'object' && m.role !== 'system')
      ]
    };

    // Node 18+ has global fetch available
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY || ''}`
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      if (DEBUG) console.error('OpenAI upstream error:', r.status, detail);
      return res.status(502).json({ error: 'LLM upstream error', status: r.status, detail });
    }

    const data = await r.json();
    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      'I could not form a reply. Please try rephrasing your question.';

    return res.json({ reply });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * ----------------------------
 * Boot
 * ----------------------------
 */
app.listen(PORT, () => {
  console.log(`PM Agent listening on :${PORT}`);
  if (DEBUG) {
    console.log('Allowed origins:', allowedOrigins.join(', ') || '(none)');
  }
});
