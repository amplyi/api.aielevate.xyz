// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();

// --- CORS (allow your WP site) ---
const ALLOWED_ORIGINS = [
  'https://aielevate.xyz',
  'https://www.aielevate.xyz'
];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-APP-KEY');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '1mb' }));

// --- Health checks ---
app.get('/', (_req, res) => res.json({ status: 'ok', service: 'pm-agent', root: true }));
app.get('/ping', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// --- PM Agent endpoint ---
app.post('/api/pm-agent', async (req, res) => {
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages[] required' });

    const SYSTEM_PROMPT = `
You are the **AI PM Agent**. Be concise and actionable. Provide steps, checklists, KPIs, risks, and examples (Jira, SAP, SLAs, OKRs, RACI).
Do not reveal chain-of-thought; answer directly with brief rationale when useful.
`;

    const payload = {
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'system', content: 'Org: AVL/TriFin (NL, Europe/Amsterdam). Domain: SAP/Jira PM.' },
        ...messages.filter(m => m.role !== 'system')
      ]
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('OpenAI error:', r.status, detail);
      return res.status(502).json({ error: 'LLM upstream error', detail });
    }

    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || 'I could not form a reply.';
    res.json({ reply });
  } catch (e) {
    console.error('Server error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PM Agent listening on :${PORT}`));
