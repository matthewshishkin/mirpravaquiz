/**
 * Vercel Serverless (Node): прокси к Telegram Bot API.
 * Должен открываться: GET /api/send-telegram
 */
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body != null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      resolve(req.body);
      return;
    }
    if (typeof req.body === 'string') {
      try {
        resolve(JSON.parse(req.body));
      } catch (e) {
        reject(e);
      }
      return;
    }
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return res.status(500).json({
      ok: false,
      error: 'Server not configured: set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars',
    });
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      hint: 'POST JSON: { "text": "..." }',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid JSON' });
  }

  const text = body && body.text;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing text' });
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
    }),
  });

  const data = await r.json().catch(() => ({}));
  if (r.ok && data.ok) {
    return res.status(200).json(data);
  }

  const description = typeof data.description === 'string' ? data.description : '';
  if (/chat not found/i.test(description)) {
    return res.status(502).json({
      ok: false,
      error: 'Telegram chat not found. Проверьте TELEGRAM_CHAT_ID и добавлен ли бот в чат.',
      telegram: data,
    });
  }

  return res.status(502).json(data);
}

module.exports = handler;
