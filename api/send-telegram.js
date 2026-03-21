/**
 * Vercel Serverless (Node): прокси к Telegram Bot API.
 * Должен открываться: GET https://mainur.vercel.app/api/send-telegram
 */
const BOT_TOKEN = '8633244693:AAFYxNx52ZqGvUq2irDoWa4_-9JWiqSW1X4';
const CHAT_ID = '611386647';

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

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: 'HTML',
    }),
  });

  const data = await r.json().catch(() => ({}));
  return res.status(r.ok && data.ok ? 200 : 502).json(data);
}

module.exports = handler;
