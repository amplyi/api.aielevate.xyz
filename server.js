import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: ['https://aielevate.xyz', 'https://www.aielevate.xyz'], methods: ['POST'], allowedHeaders: ['Content-Type'] }));

// ---- PM Agent endpoint ----
app.post('/api/pm-agent', async (req, res) => {
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages[] required' });

    const SYSTEM_PROMPT = `You are the **AI PM Agent** ... (same prompt as before)`;
    const payload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: "Organization: TriFin/AVL. Region: NL (Europe/Amsterdam)." },
        ...messages.filter(m => m.role !== 'system')
      ],
      temperature: 0.3,
      max_tokens: 700
    };

    // Node 18+ has global fetch; if not, node-fetch handles it.
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) return res.status(502).json({ error: "LLM upstream error", detail: await r.text() });
    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || "I couldn't form a reply.";
    res.json({ reply });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PM Agent listening on :${PORT}`));
