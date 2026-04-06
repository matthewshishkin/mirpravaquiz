/**
 * Vercel Serverless (Node): прокси к Telegram Bot API.
 * Должен открываться: GET /api/send-telegram
 * parse_mode HTML; UTM — в expandable blockquote (не tg-spoiler)
 */
const crypto = require('crypto');

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
    /** {{ad.name}} из рекламы; старые ссылки могли слать utm_term — храним для спойлера */
    utm_adname: sanitizeUtmValue(utm.utm_adname),
    utm_term: sanitizeUtmValue(utm.utm_term),
  };
  const hasAny = Object.values(out).some(Boolean);
  return hasAny ? out : null;
}

/** URL страницы заявки (домен + путь); только http(s), длина ограничена */
function sanitizePageUrl(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  const s = String(raw).trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const href = u.href;
    return href.length > 2000 ? href.slice(0, 2000) : href;
  } catch {
    return null;
  }
}

function normalizePhoneDigits(raw) {
  return String(raw || '').replace(/\D/g, '');
}

/** 8XXXXXXXXXXX (РФ/КЗ) → 7… для международного формата */
function digitsToInternationalDigits(digits) {
  let d = digits;
  if (!d) return '';
  if (d.length === 11 && d[0] === '8') d = `7${d.slice(1)}`;
  return d;
}

function sanitizeLeadField(v, max) {
  if (v == null) return '';
  const s = String(v).trim();
  return s.slice(0, max || 200);
}

function normalizeLead(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = sanitizeLeadField(raw.name, 200);
  const phone = sanitizeLeadField(raw.phone, 40);
  const city = sanitizeLeadField(raw.city, 200);
  if (!phone && !name && !city) return null;
  return { name, phone, city };
}

function formatLeadContactHtml(lead) {
  const name = escapeHtml(lead.name || '—');
  const city = escapeHtml(lead.city || '—');
  const phoneDisplay = escapeHtml(lead.phone || '—');
  const d = digitsToInternationalDigits(normalizePhoneDigits(lead.phone));
  const waUrl = d && d.length >= 10 ? `https://wa.me/${d}` : null;
  const waSafe = waUrl ? escapeHtml(waUrl) : null;
  const waLine = waSafe
    ? `📞 WhatsApp: <a href="${waSafe}">${waSafe}</a>`
    : `📞 WhatsApp: —`;
  return [`👤 Имя: ${name}`, `📍 Город: ${city}`, `📞 Телефон: ${phoneDisplay}`, waLine].join('\n');
}

/**
 * Ключ Redis для лида по «странице» (один сайт — разные пути считаются отдельно).
 * Учитываются hostname + pathname (без query/hash), регистр хоста нижний.
 */
function buildPageLeadKey(pageUrl) {
  if (!pageUrl) return null;
  try {
    const u = new URL(pageUrl);
    const host = u.hostname.toLowerCase();
    let path = u.pathname || '/';
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    const suffix = `${host}${path}`;
    if (suffix.length > 380) {
      const h = crypto.createHash('sha256').update(suffix).digest('hex').slice(0, 40);
      return `leads:page:${h}`;
    }
    return `leads:page:${suffix}`;
  } catch {
    return null;
  }
}

/** Короткая подпись для Telegram (домен + путь) */
function formatPageLabel(pageUrl) {
  if (!pageUrl) return '—';
  try {
    const u = new URL(pageUrl);
    const host = u.hostname.toLowerCase();
    const path = u.pathname || '/';
    const s = path === '/' ? host : `${host}${path}`;
    return s.length > 140 ? `${s.slice(0, 137)}…` : s;
  } catch {
    return '—';
  }
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

/** UTM в сворачиваемой цитате (expandable blockquote), не спойлер */
function buildUtmExpandableBlockquoteHtml(utm) {
  if (!utm) return '';
  const lines = [];
  if (utm.utm_source) lines.push(`utm_source: ${utm.utm_source}`);
  if (utm.utm_medium) lines.push(`utm_medium: ${utm.utm_medium}`);
  if (utm.utm_campaign) lines.push(`utm_campaign: ${utm.utm_campaign}`);
  if (utm.utm_content) lines.push(`utm_content: ${utm.utm_content}`);
  if (utm.utm_adname) lines.push(`utm_adname: ${utm.utm_adname}`);
  else if (utm.utm_term) lines.push(`utm_adname: ${utm.utm_term}`);
  if (utm.utm_term && utm.utm_adname && utm.utm_term !== utm.utm_adname) {
    lines.push(`utm_term (legacy): ${utm.utm_term}`);
  }
  if (lines.length === 0) return '';
  const inner = lines.map((line) => escapeHtml(line)).join('\n');
  /* Без \n сразу после <blockquote expandable> — иначе в клиенте пустая строка перед utm_source */
  return `🔎 UTM\n\n<blockquote expandable>${inner}</blockquote>`;
}

/** Тело заявки: экранирование HTML; переносы строк — \n (не <br>) */
function bodyToTelegramHtml(plain) {
  return escapeHtml(plain).replace(/\r\n/g, '\n');
}

function buildMessageHtml({ text, utm, totalLeadNo, perAdLeadNo, adName, pageUrl, perPageLeadNo, lead }) {
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
  if (pageUrl) {
    const safe = escapeHtml(pageUrl);
    blocks.push(`🌐 Страница: <a href="${safe}">${safe}</a>`);
    const label = formatPageLabel(pageUrl);
    const safeLabel = escapeHtml(label);
    if (typeof perPageLeadNo === 'number') {
      blocks.push(`По этой странице (путь): ${pluralLeadsRu(perPageLeadNo)} (${safeLabel})`);
    } else {
      blocks.push(`По этой странице (путь): — (${safeLabel})`);
    }
  } else {
    blocks.push('🌐 Страница: —');
  }
  blocks.push('');
  const utmQuote = buildUtmExpandableBlockquoteHtml(utm);
  if (utmQuote) {
    blocks.push(utmQuote);
    blocks.push('');
  }
  let bodyHtml;
  if (lead && (lead.phone || lead.name || lead.city)) {
    bodyHtml = formatLeadContactHtml(lead);
    bodyHtml += '\n\n' + bodyToTelegramHtml(text);
  } else {
    bodyHtml = bodyToTelegramHtml(text);
  }
  blocks.push(bodyHtml);
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
      hint:
        'POST JSON: { "text": "...", "lead": { "name","phone","city" }, "utm": {...}, "pageUrl": "https://..." }',
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
  const adName = utm ? utm.utm_adname || utm.utm_term || null : null;
  const pageUrl = sanitizePageUrl(body && body.pageUrl);
  const lead = normalizeLead(body && body.lead);

  const totalLeadNo = await upstashIncr('leads:total');
  const perAdLeadNo = adName ? await upstashIncr(`leads:ad:${adName}`) : null;
  const pageKey = pageUrl ? buildPageLeadKey(pageUrl) : null;
  const perPageLeadNo = pageKey ? await upstashIncr(pageKey) : null;

  const html = buildMessageHtml({
    text,
    utm,
    totalLeadNo,
    perAdLeadNo,
    adName,
    pageUrl,
    perPageLeadNo,
    lead,
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
