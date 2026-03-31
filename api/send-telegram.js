/**
 * Vercel Serverless (Node): прокси к Telegram Bot API.
 * Должен открываться: GET /api/send-telegram
 */
const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const TELEGRAM_CHAT_ID = (process.env.TELEGRAM_CHAT_ID || '').trim();

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
    if (req.query && (req.query.health === '1' || req.query.health === 'true')) {
      const baseUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
      const [meResp, chatResp, updatesResp] = await Promise.all([
        fetch(`${baseUrl}/getMe`),
        fetch(`${baseUrl}/getChat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID }),
        }),
        fetch(`${baseUrl}/getUpdates?offset=-20&limit=20&timeout=0`),
      ]);

      const meData = await meResp.json().catch(() => ({}));
      const chatData = await chatResp.json().catch(() => ({}));
      const updatesData = await updatesResp.json().catch(() => ({}));

      const recentChatsMap = new Map();
      const updates = Array.isArray(updatesData && updatesData.result) ? updatesData.result : [];
      updates.forEach((u) => {
        const msg = (u && (u.message || u.channel_post || u.edited_message || u.edited_channel_post)) || null;
        const c = msg && msg.chat ? msg.chat : null;
        if (!c || c.id == null) return;
        const key = String(c.id);
        if (!recentChatsMap.has(key)) {
          recentChatsMap.set(key, {
            id: c.id,
            type: c.type || null,
            title: c.title || c.username || [c.first_name, c.last_name].filter(Boolean).join(' ') || null,
          });
        }
      });
      const recentChats = Array.from(recentChatsMap.values()).slice(0, 10);

      return res.status(200).json({
        ok: Boolean(meData.ok) && Boolean(chatData.ok),
        env: {
          hasBotToken: Boolean(TELEGRAM_BOT_TOKEN),
          hasChatId: Boolean(TELEGRAM_CHAT_ID),
          chatIdPreview: TELEGRAM_CHAT_ID ? `${TELEGRAM_CHAT_ID.slice(0, 5)}...` : null,
        },
        tokenCheck: {
          ok: Boolean(meData.ok),
          description: meData.description || null,
          botId: meData && meData.result ? meData.result.id : null,
          botUsername: meData && meData.result ? meData.result.username : null,
        },
        chatCheck: {
          ok: Boolean(chatData.ok),
          description: chatData.description || null,
          chatId: chatData && chatData.result ? chatData.result.id : null,
          chatType: chatData && chatData.result ? chatData.result.type : null,
          chatTitle: chatData && chatData.result ? (chatData.result.title || chatData.result.username || null) : null,
        },
        updatesCheck: {
          ok: Boolean(updatesData.ok),
          description: updatesData.description || null,
          recentChats,
        },
      });
    }

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
