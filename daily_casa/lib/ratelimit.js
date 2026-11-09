'use strict';
// Limite de tentativas falhadas com bloqueio temporário (em memória; volta a zero quando o add-on reinicia).
// - max falhas dentro de windowMs bloqueiam a chave durante blockMs.
// - progressive: cada novo bloqueio da mesma chave dura o dobro do anterior, até maxBlockMs;
//   as reincidências esquecem-se ao fim de 24 h sem bloqueios.
function createLimiter({ max, windowMs, blockMs, progressive = false, maxBlockMs = 24 * 3600_000, now = () => Date.now() }) {
  const entries = new Map();
  function get(key) {
    const t = now(); let e = entries.get(key);
    if (e && e.until && e.until <= t) { e.until = 0; e.fails = []; }
    if (e && e.strikes && !e.until && t - (e.lastBlock || 0) > 24 * 3600_000) e.strikes = 0;
    if (e) e.fails = e.fails.filter(x => t - x < windowMs);
    return e;
  }
  function status(key) {
    const e = get(key); const t = now();
    if (e && e.until > t) return { blocked: true, retryAfter: Math.ceil((e.until - t) / 1000) };
    return { blocked: false, retryAfter: 0, failures: e ? e.fails.length : 0 };
  }
  function fail(key) {
    const t = now(); let e = get(key);
    if (!e) { e = { fails: [], until: 0, strikes: 0, lastBlock: 0 }; entries.set(key, e); }
    if (e.until > t) return { blocked: true, justBlocked: false, retryAfter: Math.ceil((e.until - t) / 1000) };
    e.fails.push(t);
    if (e.fails.length >= max) {
      const dur = progressive ? Math.min(maxBlockMs, blockMs * 2 ** e.strikes) : blockMs;
      e.until = t + dur; e.strikes++; e.lastBlock = t; e.fails = [];
      prune();
      return { blocked: true, justBlocked: true, retryAfter: Math.ceil(dur / 1000) };
    }
    prune();
    return { blocked: false, justBlocked: false, failures: e.fails.length };
  }
  function success(key) { const e = entries.get(key); if (e) { e.fails = []; if (!e.until && !e.strikes) entries.delete(key); } }
  function clear(key) { if (key === undefined) entries.clear(); else entries.delete(key); }
  function blocked() { const t = now(); return [...entries].filter(([, e]) => e.until > t).map(([key, e]) => ({ key, until: new Date(e.until).toISOString() })); }
  function prune() {
    if (entries.size < 5000) return; const t = now();
    for (const [k, e] of entries) if (!(e.until > t) && !e.fails.some(x => t - x < windowMs) && t - (e.lastBlock || 0) > 24 * 3600_000) entries.delete(k);
  }
  return { status, fail, success, clear, blocked };
}
// Limite de ritmo para todos os pedidos (3.9.2): «balde de fichas» por chave. Cada pedido gasta uma ficha;
// as fichas repõem-se a perMin por minuto, até burst. Sem fichas, o pedido é recusado (429) com o tempo de espera.
function createRateLimiter({ perMin, burst = perMin, now = () => Date.now(), maxKeys = 20000 }) {
  const b = new Map(); const rate = perMin / 60000;
  function take(key, cost = 1) {
    const t = now(); let e = b.get(key);
    if (!e) { if (b.size >= maxKeys) sweep(t); e = { tokens: burst, at: t }; b.set(key, e); }
    e.tokens = Math.min(burst, e.tokens + (t - e.at) * rate); e.at = t;
    if (e.tokens >= cost) { e.tokens -= cost; return { ok: true, retryAfter: 0 }; }
    return { ok: false, retryAfter: Math.max(1, Math.ceil((cost - e.tokens) / rate / 1000)) };
  }
  function sweep(t) { for (const [k, e] of b) if (e.tokens + (t - e.at) * rate >= burst) b.delete(k); if (b.size >= maxKeys) b.clear(); }
  return { take, size: () => b.size };
}
const minutes = s => Math.max(1, Math.ceil(s / 60));
function waitText(seconds) { const m = minutes(seconds); return m >= 90 ? `${Math.round(m / 60)} horas` : m === 1 ? '1 minuto' : `${m} minutos`; }
module.exports = { createLimiter, createRateLimiter, waitText };
