/**
 * worker/src/auth.js —— GitHub OAuth 登录 + JWT 会话 + 白名单 + 失败计数
 *
 * 对齐全案 §6.3 / PRD 流程② S2：
 *   - state 一次性存 KV（防 CSRF，600s TTL，携带回跳目标页）
 *   - code → client_secret 换 token → 拉取 user → 按 GitHub user id 白名单校验
 *   - 签 24h JWT（HMAC-SHA256，secret 走 Worker secrets，永不进前端）
 *   - 连续 5 类失败（拒绝/回调失败/state 不匹配或超时/授权码过期/非白名单）计 1 次，
 *     满 5 次锁定 15 分钟（KV 计数，登录页显示倒计时）
 */

const STATE_TTL = 600; // OAuth state 10 分钟有效
const JWT_TTL = 24 * 3600; // 会话 24h
const MAX_FAILS = 5;
const LOCK_SECONDS = 15 * 60;

// ---------- 基础工具 ----------

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export function redirect(url, extraHeaders = {}) {
  return new Response(null, { status: 302, headers: { Location: url, ...extraHeaders } });
}

export function parseCookies(request) {
  const out = {};
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

export function b64urlEncodeStr(s) {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlEncodeBuf(buf) {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecodeStr(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return decodeURIComponent(escape(atob(s)));
}

// ---------- JWT（HS256） ----------

async function jwtKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signJwt(payload, secret) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + JWT_TTL };
  const head = b64urlEncodeStr(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const bodyB64 = b64urlEncodeStr(JSON.stringify(body));
  const data = head + '.' + bodyB64;
  const sig = await crypto.subtle.sign('HMAC', await jwtKey(secret), new TextEncoder().encode(data));
  return data + '.' + b64urlEncodeBuf(sig);
}

export async function verifyJwt(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [head, bodyB64, sig] = parts;
  const data = head + '.' + bodyB64;
  try {
    const ok = await crypto.subtle.verify(
      'HMAC',
      await jwtKey(secret),
      b64urlToBuf(sig),
      new TextEncoder().encode(data),
    );
    if (!ok) return null;
    const payload = JSON.parse(b64urlDecodeStr(bodyB64));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function b64urlToBuf(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ---------- 白名单 ----------

export function isWhitelisted(userId, env) {
  const allowed = String(env.ALLOWED_USERS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.includes(String(userId));
}

// ---------- 失败计数 / 锁定 ----------

async function getFailState(env) {
  const raw = await env.ADMIN_KV.get('login:fail');
  if (!raw) return { count: 0, lockedUntil: 0 };
  try {
    return JSON.parse(raw);
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

export async function isLocked(env) {
  const st = await getFailState(env);
  return st.lockedUntil > Date.now() ? st.lockedUntil : 0;
}

/** 记录一次失败；返回 {count, lockedUntil} */
export async function recordFailure(env) {
  const st = await getFailState(env);
  st.count += 1;
  if (st.count >= MAX_FAILS) {
    st.lockedUntil = Date.now() + LOCK_SECONDS * 1000;
    st.count = 0;
  }
  await env.ADMIN_KV.put('login:fail', JSON.stringify(st));
  return st;
}

export async function clearFailures(env) {
  await env.ADMIN_KV.delete('login:fail');
}

// ---------- 会话 ----------

const COOKIE_NAME = 'admin_session';

export async function getSession(request, env) {
  const cookies = parseCookies(request);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifyJwt(token, env.JWT_SECRET);
}

export function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${JWT_TTL}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

/** JWT 鉴权门禁：无会话/过期 → 401 */
export async function requireAuth(request, env) {
  const session = await getSession(request, env);
  if (!session) return { ok: false, response: json({ error: 'unauthorized', message: '登录已过期，请重新登录' }, 401) };
  return { ok: true, session };
}

// ---------- OAuth 流程 ----------

function sanitizeReturnTo(value) {
  // 仅允许站内相对路径，防开放重定向
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/admin';
  return value;
}

export async function handleLogin(request, env) {
  const url = new URL(request.url);
  const lockedUntil = await isLocked(env);
  if (lockedUntil) {
    return redirect(`/admin?error=locked&until=${lockedUntil}`);
  }
  const returnTo = sanitizeReturnTo(url.searchParams.get('returnTo'));
  const stateBytes = new Uint8Array(32);
  crypto.getRandomValues(stateBytes);
  const state = b64urlEncodeBuf(stateBytes.buffer);
  await env.ADMIN_KV.put(`oauth_state:${state}`, JSON.stringify({ returnTo }), { expirationTtl: STATE_TTL });
  const redirectUri = `${new URL(request.url).origin}/api/v1/auth/callback`;
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('scope', 'read:user');
  return redirect(authorize.toString());
}

export async function handleCallback(request, env) {
  const url = new URL(request.url);
  const origin = url.origin;

  // 锁定检查
  const lockedUntil = await isLocked(env);
  if (lockedUntil) return redirect(`/admin?error=locked&until=${lockedUntil}`);

  // GitHub 返回 error（用户点拒绝等）
  if (url.searchParams.get('error')) {
    const st = await recordFailure(env);
    return redirect(`/admin?error=denied&left=${MAX_FAILS - st.count}`);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    const st = await recordFailure(env);
    return redirect(`/admin?error=callback&left=${MAX_FAILS - st.count}`);
  }

  // state 一次性校验
  const stateRaw = await env.ADMIN_KV.get(`oauth_state:${state}`);
  if (!stateRaw) {
    const st = await recordFailure(env);
    return redirect(`/admin?error=state&left=${MAX_FAILS - st.count}`);
  }
  await env.ADMIN_KV.delete(`oauth_state:${state}`);
  let returnTo = '/admin';
  try {
    returnTo = sanitizeReturnTo(JSON.parse(stateRaw).returnTo);
  } catch { /* 用默认值 */ }

  // code → access token
  let tokenResp;
  try {
    tokenResp = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'portfolio-backend-worker' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
  } catch {
    const st = await recordFailure(env);
    return redirect(`/admin?error=callback&left=${MAX_FAILS - st.count}`);
  }
  const tokenData = await tokenResp.json().catch(() => ({}));
  if (!tokenData.access_token) {
    const st = await recordFailure(env);
    return redirect(`/admin?error=callback&left=${MAX_FAILS - st.count}`);
  }

  // 拉取用户信息
  let user;
  try {
    const userResp = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'portfolio-backend-worker' },
    });
    user = await userResp.json();
    if (!user || !user.id) throw new Error('bad user');
  } catch {
    const st = await recordFailure(env);
    return redirect(`/admin?error=callback&left=${MAX_FAILS - st.count}`);
  }

  // 白名单校验（按 user id）
  if (!isWhitelisted(user.id, env)) {
    const st = await recordFailure(env);
    return redirect(`/admin?error=forbidden&left=${MAX_FAILS - st.count}`);
  }

  // 签 JWT + 种会话 cookie + 清失败计数
  const jwt = await signJwt({ sub: String(user.id), login: user.login }, env.JWT_SECRET);
  await clearFailures(env);
  return redirect(returnTo, { 'Set-Cookie': sessionCookie(jwt) });
}

export async function handleLogout(env, request) {
  return redirect('/admin', { 'Set-Cookie': clearSessionCookie() });
}
