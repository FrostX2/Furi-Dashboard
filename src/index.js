import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 5000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(16).toString('hex');
const SESSIONS = new Map();

const AI_BOT_URL = process.env.AI_BOT_URL || 'http://localhost:3000';
const MUSIC_BOT_URL = process.env.MUSIC_BOT_URL || 'http://localhost:10000';
const REFRESH_INTERVAL = parseInt(process.env.REFRESH_INTERVAL) || 10;

const AI_INVITE = process.env.AI_INVITE || '';
const MUSIC_INVITE = process.env.MUSIC_INVITE || '';
const TUNNEL_URL = process.env.TUNNEL_URL || '';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function requireAuth(req, res, next) {
  if (!ADMIN_PASSWORD) return next();
  const token = req.cookies?.session;
  if (token && SESSIONS.get(token)?.expires > Date.now()) return next();
  if (req.path.startsWith('/login') || req.path === '/health') return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'unauthorized' });
  res.redirect('/login');
}

app.use((req, res, next) => {
  const cookies = {};
  if (req.headers.cookie) {
    req.headers.cookie.split(';').forEach(c => {
      const [k, ...v] = c.trim().split('=');
      cookies[k] = v.join('=');
    });
  }
  req.cookies = cookies;
  next();
});

app.use(requireAuth);

app.get('/login', (req, res) => {
  if (!ADMIN_PASSWORD) return res.redirect('/');
  const token = req.cookies?.session;
  if (token && SESSIONS.get(token)?.expires > Date.now()) return res.redirect('/');
  res.render('login');
});

app.post('/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    const token = crypto.randomBytes(16).toString('hex');
    SESSIONS.set(token, { expires: Date.now() + 86400000 });
    res.setHeader('Set-Cookie', `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
    return res.redirect('/');
  }
  res.render('login', { error: 'Wrong password' });
});

app.get('/health', (req, res) => res.send('ok'));

async function fetchJson(url, options = {}) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), ...options });
    if (!res.ok) return null;
    if (options.method === 'POST') return { ok: true };
    return await res.json();
  } catch { return null; }
}

function postJson(url, body) {
  return fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

app.get('/', async (req, res) => {
  const [ai, music] = await Promise.all([
    fetchJson(`${AI_BOT_URL}/api/status`),
    fetchJson(`${MUSIC_BOT_URL}/api/status`),
  ]);
  res.render('index', {
    ai, music, refreshInterval: REFRESH_INTERVAL,
    adminPassword: !!ADMIN_PASSWORD,
    aiInvite: AI_INVITE, musicInvite: MUSIC_INVITE,
    tunnelUrl: TUNNEL_URL,
  });
});

app.get('/api/dashboard', async (req, res) => {
  const [ai, music] = await Promise.all([
    fetchJson(`${AI_BOT_URL}/api/status`),
    fetchJson(`${MUSIC_BOT_URL}/api/status`),
  ]);
  res.json({ ai, music });
});

app.get('/api/ai/guilds', async (req, res) => {
  const data = await fetchJson(`${AI_BOT_URL}/api/guilds`);
  res.json(data || { error: 'unreachable' });
});

app.get('/api/ai/settings', async (req, res) => {
  const data = await fetchJson(`${AI_BOT_URL}/api/settings`);
  res.json(data || { error: 'unreachable' });
});

app.post('/api/ai/settings', async (req, res) => {
  const data = await postJson(`${AI_BOT_URL}/api/settings`, req.body);
  res.json(data || { error: 'unreachable' });
});

app.get('/api/music/guilds', async (req, res) => {
  const data = await fetchJson(`${MUSIC_BOT_URL}/api/guilds`);
  res.json(data || { error: 'unreachable' });
});

app.get('/api/music/players', async (req, res) => {
  const data = await fetchJson(`${MUSIC_BOT_URL}/api/players`);
  res.json(data || { error: 'unreachable' });
});

app.post('/api/music/player/skip', async (req, res) => {
  const data = await postJson(`${MUSIC_BOT_URL}/api/player/skip`, req.body);
  res.json(data || { error: 'unreachable' });
});

app.post('/api/music/player/stop', async (req, res) => {
  const data = await postJson(`${MUSIC_BOT_URL}/api/player/stop`, req.body);
  res.json(data || { error: 'unreachable' });
});

app.post('/api/music/player/volume', async (req, res) => {
  const data = await postJson(`${MUSIC_BOT_URL}/api/player/volume`, req.body);
  res.json(data || { error: 'unreachable' });
});

app.post('/api/music/player/loop', async (req, res) => {
  const data = await postJson(`${MUSIC_BOT_URL}/api/player/loop`, req.body);
  res.json(data || { error: 'unreachable' });
});

app.get('/api/music/settings', async (req, res) => {
  const data = await fetchJson(`${MUSIC_BOT_URL}/api/settings`);
  res.json(data || { error: 'unreachable' });
});

app.use((err, req, res, next) => {
  console.error('[error]', err?.message || err);
  res.status(500).send('Internal error');
});

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Dashboard running on http://${HOST}:${PORT}`);
  console.log(`  AI Bot:  ${AI_BOT_URL}`);
  console.log(`  Music Bot: ${MUSIC_BOT_URL}`);
  console.log(`  Auth: ${ADMIN_PASSWORD ? 'enabled' : 'disabled'}`);
});
