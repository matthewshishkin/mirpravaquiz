/**
 * Vercel Serverless (Node): прокси к Telegram Bot API.
 * Должен открываться: GET /api/send-telegram
 * parse_mode HTML + tg-spoiler для UTM
 */
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

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

function sanitizeUtmValue(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, 300);
}

function normalizeUtm(utm) {
  if (!utm || typeof utm !== 'object') return null;
  const out = {
    utm_source: sanitizeUtmValue(utm.utm_source),
    utm_medium: sanitizeUtmValue(utm.utm_medium),
    utm_campaign: sanitizeUtmValue(utm.utm_campaign),
    utm_content: sanitizeUtmValue(utm.utm_content),
    utm_term: sanitizeUtmValue(utm.utm_term),
  };
  const hasAny = Object.values(out).some(Boolean);
  return hasAny ? out : null;
}

/** Telegram HTML: &, <, > */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Склонение «N лид / лида / лидов» */
function pluralLeadsRu(n) {
  const x = Math.abs(Math.floor(Number(n)) || 0);
  const mod100 = x % 100;
  const mod10 = x % 10;
  let word = 'лидов';
  if (mod100 < 11 || mod100 > 14) {
    if (mod10 === 1) word = 'лид';
    else if (mod10 >= 2 && mod10 <= 4) word = 'лида';
  }
  return `${x} ${word}`;
}

async function upstashIncr(key) {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return null;
  const url = `${UPSTASH_REDIS_REST_URL.replace(/\/$/, '')}/incr/${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
  });
  const data = await r.json().catch(() => null);
  if (!r.ok || !data || typeof data.result !== 'number') return null;
  return data.result;
}

function buildUtmSpoilerHtml(utm) {
  if (!utm) return '';
  const lines = ['🔎 UTM'];
  if (utm.utm_source) lines.push(`utm_source: ${utm.utm_source}`);
  if (utm.utm_medium) lines.push(`utm_medium: ${utm.utm_medium}`);
  if (utm.utm_campaign) lines.push(`utm_campaign: ${utm.utm_campaign}`);
  if (utm.utm_content) lines.push(`utm_content: ${utm.utm_content}`);
  if (utm.utm_term) lines.push(`utm_term: ${utm.utm_term}`);
  if (lines.length <= 1) return '';
  /* В HTML-режиме Telegram тег <br> не поддерживается — только \n */
  const inner = lines.map((line) => escapeHtml(line)).join('\n');
  return `<tg-spoiler>${inner}</tg-spoiler>`;
}

/** Тело заявки: экранирование HTML; переносы строк — \n (не <br>) */
function bodyToTelegramHtml(plain) {
  return escapeHtml(plain).replace(/\r\n/g, '\n');
}

function buildMessageHtml({ text, utm, totalLeadNo, perAdLeadNo, adName }) {
  const blocks = [];
  blocks.push('🔔 Новая заявка с сайта!');
  blocks.push('');
  if (typeof totalLeadNo === 'number') {
    blocks.push(`№ Лида: ${totalLeadNo}`);
  } else {
    blocks.push('№ Лида: —');
  }
  if (adName) {
    const safeName = escapeHtml(adName);
    if (typeof perAdLeadNo === 'number') {
      blocks.push(`От крео &quot;${safeName}&quot;: ${pluralLeadsRu(perAdLeadNo)}`);
    } else {
      blocks.push(`От крео &quot;${safeName}&quot;: —`);
    }
  }
  blocks.push('');
  const spoiler = buildUtmSpoilerHtml(utm);
  if (spoiler) {
    blocks.push(spoiler);
    blocks.push('');
  }
  blocks.push(bodyToTelegramHtml(text));
  return blocks.join('\n');
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
      hint: 'POST JSON: { "text": "...", "utm": { ... } }',
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

  const utm = normalizeUtm(body && body.utm);
  const adName = utm && utm.utm_term ? utm.utm_term : null;

  const totalLeadNo = await upstashIncr('leads:total');
  const perAdLeadNo = adName ? await upstashIncr(`leads:ad:${adName}`) : null;

  const html = buildMessageHtml({
    text,
    utm,
    totalLeadNo,
    perAdLeadNo,
    adName,
  });

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: html,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  const data = await r.json().catch(() => ({}));
  return res.status(r.ok && data.ok ? 200 : 502).json(data);
}

module.exports = handler;
