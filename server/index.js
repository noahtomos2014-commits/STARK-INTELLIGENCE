import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const here = path.dirname(fileURLToPath(import.meta.url));
const JARVIS_INSTRUCTIONS = 'You are JARVIS, the personal AI assistant for STARK INTELLIGENCE. Be intelligent, calm, polished, concise but useful, and lightly witty. Answer the actual question with fresh reasoning. Admit uncertainty. Never claim to have performed actions you cannot perform.';

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    aiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY),
    primaryConfigured: Boolean(process.env.GEMINI_API_KEY),
    backupConfigured: Boolean(process.env.OPENROUTER_API_KEY)
  });
});

async function askOpenRouter(history, message) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OpenRouter backup is not configured. Add OPENROUTER_API_KEY in Render.');
  }

  const messages = [
    { role: 'system', content: JARVIS_INSTRUCTIONS },
    ...history
      .filter(x => x && ['user', 'model'].includes(x.role) && typeof x.text === 'string')
      .map(x => ({ role: x.role === 'model' ? 'assistant' : 'user', content: x.text.slice(0, 12000) })),
    { role: 'user', content: message }
  ];

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://stark-intelligence.onrender.com',
      'X-OpenRouter-Title': 'STARK INTELLIGENCE'
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'openrouter/auto',
      messages,
      temperature: 0.7,
      max_tokens: 1200
    }),
    signal: AbortSignal.timeout(60000)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || response.statusText || 'Unknown OpenRouter error';
    throw new Error(`OpenRouter HTTP ${response.status}: ${detail}`);
  }

  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply || typeof reply !== 'string') {
    throw new Error('OpenRouter returned an empty response.');
  }
  return { reply, model: data.model || process.env.OPENROUTER_MODEL || 'openrouter/auto', provider: 'OpenRouter backup' };
}

app.post('/api/chat', async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) return res.status(400).json({ error: 'Please enter a message.' });
  if (message.length > 12000) return res.status(413).json({ error: 'Message is too long.' });

  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-16) : [];

  if (process.env.GEMINI_API_KEY) {
    try {
      const contents = history
        .filter(x => x && ['user', 'model'].includes(x.role) && typeof x.text === 'string')
        .map(x => ({ role: x.role, parts: [{ text: x.text.slice(0, 12000) }] }));
      contents.push({ role: 'user', parts: [{ text: message }] });

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          timeout: 10000,
          retryOptions: {
            attempts: 1,
            initialDelay: 1,
            maxDelay: 1,
            expBase: 2,
            jitter: 0.2,
            httpStatusCodes: [408, 429, 500, 502, 503, 504]
          }
        }
      });

      const result = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: { systemInstruction: JARVIS_INSTRUCTIONS }
      });

      const reply = result.text?.trim();
      if (!reply) throw new Error('Gemini returned an empty response.');
      return res.json({ reply, model: 'gemini-3.8-flash', provider: 'Gemini primary' });
    } catch (error) {
      console.error('Gemini request failed; attempting OpenRouter backup:', error);
    }
  }

  try {
    const backup = await askOpenRouter(history, message);
    console.log('JARVIS response served by', backup.provider, 'using', backup.model);
    return res.json(backup);
  } catch (error) {
    console.error('OpenRouter backup failed:', error);
    const hasGemini = Boolean(process.env.GEMINI_API_KEY);
    const hasBackup = Boolean(process.env.OPENROUTER_API_KEY);
    if (!hasGemini && !hasBackup) {
      return res.status(503).json({ error: 'No AI provider is configured. Add GEMINI_API_KEY and/or OPENROUTER_API_KEY in Render.' });
    }
    return res.status(503).json({
      error: hasBackup
        ? 'Both Gemini and the backup AI are currently unavailable. Please try again shortly.'
        : 'Gemini is unavailable and the OpenRouter backup has not been configured yet. Add OPENROUTER_API_KEY in Render.'
    });
  }
});

const dist = path.resolve(here, '../dist');
app.use(express.static(dist));
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
app.listen(PORT, () => console.log('STARK INTELLIGENCE listening on ' + PORT));
