'use strict';
// 3.24: Cloudflare Turnstile no login e na recuperação de palavra-passe, só nos acessos que chegam pelo túnel.
// A chave secreta vem das opções do add-on (turnstile_secret) e nunca sai do servidor.
// Pedidos de dentro de casa (sem cabeçalhos da Cloudflare) e de dentro do Home Assistant (ingress) não são afetados.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function createTurnstile({ getOptions, fetchImpl = (...a) => fetch(...a), verifyUrl = process.env.TURNSTILE_VERIFY_URL || VERIFY_URL, timeoutMs = 8000 } = {}) {
  const config = () => {
    const o = (getOptions && getOptions()) || {};
    const siteKey = String(o.turnstile_site_key || '').trim();
    const secret = String(o.turnstile_secret || '').trim();
    return { siteKey, secret, enabled: !!(siteKey && secret) };
  };

  /** Pelo túnel: a Cloudflare acrescenta sempre `cf-ray`/`cf-connecting-ip` e quem vem de fora não os consegue retirar. */
  function viaTunnel(req, net) {
    if (req.headers['x-ingress-path']) return false; // dentro do Home Assistant
    return !!(net && net.viaProxy) || !!req.headers['cf-ray'] || !!req.headers['cf-connecting-ip'];
  }
  const required = (req, net) => config().enabled && viaTunnel(req, net);
  const siteKeyFor = (req, net) => (required(req, net) ? config().siteKey : '');

  /** Verifica o token junto da Cloudflare. Falha fechada: sem resposta válida, não deixa passar. */
  async function verify(token, { ip, action } = {}) {
    const { secret } = config();
    token = String(token || '');
    if (!secret) return { ok: false, codes: ['not-configured'] };
    if (!token || token.length > 2048) return { ok: false, codes: ['missing-input-response'] };
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetchImpl(verifyUrl, { method: 'POST', body, signal: ctrl.signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      const j = await r.json().catch(() => ({}));
      if (!j.success) return { ok: false, codes: j['error-codes'] || ['invalid'] };
      if (action && j.action && j.action !== action) return { ok: false, codes: ['action-mismatch'] };
      return { ok: true, hostname: j.hostname || '' };
    } catch (e) {
      return { ok: false, codes: [e.name === 'AbortError' ? 'timeout' : 'network-error'] };
    } finally { clearTimeout(t); }
  }

  return { config, viaTunnel, required, siteKeyFor, verify };
}

module.exports = { createTurnstile, VERIFY_URL };
