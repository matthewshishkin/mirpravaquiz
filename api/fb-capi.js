/**
 * Vercel Serverless: Facebook Conversions API (CAPI) proxy.
 * POST /api/fb-capi
 * Body: { eventName, eventId, phone, eventSourceUrl, fbp, fbc, clientUserAgent }
 */
const crypto = require('crypto');

const FB_PIXEL_ID = process.env.FB_PIXEL_ID;
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value).toLowerCase().trim()).digest('hex');
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body != null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      resolve(req.body);
      return;
    }
    if (typeof req.body === 'string') {
      try { resolve(JSON.parse(req.body)); } catch (e) { reject(e); }
      return;
    }
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  if (!FB_PIXEL_ID || !FB_ACCESS_TOKEN) {
    return res.status(500).json({ ok: false, error: 'FB_PIXEL_ID or FB_ACCESS_TOKEN not configured' });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid JSON' });
  }

  const { eventName = 'Lead', eventId, phone, eventSourceUrl, fbp, fbc, clientUserAgent } = body || {};

  const userData = {};
  if (phone) {
    let digits = String(phone).replace(/\D/g, '');
    if (digits.length === 11 && digits[0] === '8') digits = '7' + digits.slice(1);
    if (digits) userData.ph = [sha256(digits)];
  }
  if (fbp) userData.fbp = String(fbp);
  if (fbc) userData.fbc = String(fbc);
  if (clientUserAgent) userData.client_user_agent = String(clientUserAgent);

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress;
  if (ip) userData.client_ip_address = ip;

  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    user_data: userData,
  };
  if (eventSourceUrl) event.event_source_url = String(eventSourceUrl);
  if (eventId) event.event_id = String(eventId);

  const url = `https://graph.facebook.com/v19.0/${FB_PIXEL_ID}/events?access_token=${FB_ACCESS_TOKEN}`;
  let fbRes, fbData;
  try {
    fbRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [event] }),
    });
    fbData = await fbRes.json().catch(() => ({}));
  } catch (err) {
    return res.status(502).json({ ok: false, error: String(err.message) });
  }

  return res.status(fbRes.ok ? 200 : 502).json(fbData);
};
